-- Adapted hardening/money RPCs for plain PostgreSQL (no Supabase auth roles/RLS).

-- Helper alignment
CREATE OR REPLACE FUNCTION public.lock_wallet(p_user_id uuid) RETURNS numeric LANGUAGE plpgsql AS $$
DECLARE v_balance numeric;
BEGIN
  SELECT wallet_balance INTO v_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found for user %', p_user_id; END IF;
  RETURN v_balance;
END; $$;

-- Wallet top-up from a verified gateway payment
CREATE OR REPLACE FUNCTION public.topup_from_payment(p_payment_id uuid)
RETURNS numeric LANGUAGE plpgsql AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_wallet_currency text;
  v_tx uuid;
  v_wallet_account uuid;
  v_clearing_account uuid;
  v_balance numeric;
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF v_payment.purpose <> 'topup' THEN RAISE EXCEPTION 'Payment is not a wallet top-up'; END IF;

  IF v_payment.status = 'paid' THEN
    SELECT wallet_balance INTO v_balance FROM public.profiles WHERE id = v_payment.user_id;
    RETURN COALESCE(v_balance, 0);
  END IF;

  SELECT wallet_currency INTO v_wallet_currency
  FROM public.profiles WHERE id = v_payment.user_id FOR UPDATE;

  IF v_wallet_currency IS DISTINCT FROM upper(v_payment.currency) THEN
    RAISE EXCEPTION 'Payment currency % does not match wallet currency %', v_payment.currency, v_wallet_currency;
  END IF;

  v_tx := public.start_ledger_transaction(
    'wallet_topup', 'payment:' || v_payment.reference, v_payment.reference,
    jsonb_build_object('payment_id', v_payment.id, 'user_id', v_payment.user_id)
  );

  IF v_tx IS NULL THEN
    SELECT wallet_balance INTO v_balance FROM public.profiles WHERE id = v_payment.user_id;
    RETURN COALESCE(v_balance, 0);
  END IF;

  v_wallet_account := public.ensure_ledger_account('user_wallet', v_payment.user_id, v_payment.currency);
  v_clearing_account := public.ensure_ledger_account('gateway_clearing', NULL, v_payment.currency);
  PERFORM public.post_ledger_entry(v_tx, v_clearing_account, 'debit', v_payment.amount);
  PERFORM public.post_ledger_entry(v_tx, v_wallet_account, 'credit', v_payment.amount);

  INSERT INTO public.transactions (user_id, type, amount, currency, description)
  VALUES (v_payment.user_id, 'credit', v_payment.amount, v_payment.currency, 'Wallet top-up');

  UPDATE public.payments SET status = 'paid', updated_at = now() WHERE id = v_payment.id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_payment.user_id, 'payment', 'Wallet topped up',
    v_payment.currency || ' ' || v_payment.amount::text || ' added to your balance', '/wallet');

  SELECT wallet_balance INTO v_balance FROM public.profiles WHERE id = v_payment.user_id;
  RETURN COALESCE(v_balance, 0);
END; $$;

-- Escrow funded from a verified gateway payment
CREATE OR REPLACE FUNCTION public.fund_escrow_from_payment(p_payment_id uuid)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_proposal public.proposals%ROWTYPE;
  v_opportunity public.opportunities%ROWTYPE;
  v_existing uuid;
  v_escrow_id uuid;
  v_tx uuid;
  v_escrow_account uuid;
  v_clearing_account uuid;
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF v_payment.purpose <> 'escrow' OR v_payment.proposal_id IS NULL THEN RAISE EXCEPTION 'Payment is not linked to a hire'; END IF;

  IF v_payment.status = 'paid' THEN
    SELECT escrow_id INTO v_escrow_id FROM public.payments WHERE id = v_payment.id;
    IF v_escrow_id IS NOT NULL THEN RETURN v_escrow_id; END IF;
    RAISE EXCEPTION 'Payment is already marked paid without an escrow';
  END IF;

  SELECT * INTO v_proposal FROM public.proposals WHERE id = v_payment.proposal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposal not found'; END IF;
  SELECT * INTO v_opportunity FROM public.opportunities WHERE id = v_proposal.opportunity_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opportunity not found'; END IF;

  IF v_opportunity.client_id <> v_payment.user_id THEN
    RAISE EXCEPTION 'Payment does not belong to the client hiring for this opportunity';
  END IF;

  SELECT id INTO v_existing FROM public.escrows WHERE proposal_id = v_proposal.id;
  IF v_existing IS NOT NULL THEN RAISE EXCEPTION 'Proposal % is already funded', v_proposal.id; END IF;

  v_tx := public.start_ledger_transaction(
    'escrow_fund', 'payment:' || v_payment.reference, v_payment.reference,
    jsonb_build_object('payment_id', v_payment.id, 'proposal_id', v_proposal.id)
  );

  IF v_tx IS NULL THEN
    SELECT id INTO v_escrow_id FROM public.escrows WHERE proposal_id = v_proposal.id;
    IF v_escrow_id IS NULL THEN RAISE EXCEPTION 'Payment already posted but no escrow exists'; END IF;
    RETURN v_escrow_id;
  END IF;

  INSERT INTO public.escrows (
    opportunity_id, proposal_id, client_id, talent_id, title, company,
    amount, currency, status, funded_at, funding_source, payment_id
  ) VALUES (
    v_opportunity.id, v_proposal.id, v_opportunity.client_id, v_proposal.talent_id,
    v_opportunity.title, v_opportunity.company,
    v_payment.amount, v_payment.currency, 'funded', now(), 'card', v_payment.id
  ) RETURNING id INTO v_escrow_id;

  v_escrow_account := public.ensure_ledger_account('platform_escrow', NULL, v_payment.currency);
  v_clearing_account := public.ensure_ledger_account('gateway_clearing', NULL, v_payment.currency);
  PERFORM public.post_ledger_entry(v_tx, v_clearing_account, 'debit', v_payment.amount);
  PERFORM public.post_ledger_entry(v_tx, v_escrow_account, 'credit', v_payment.amount);

  INSERT INTO public.transactions (user_id, type, amount, currency, description)
  VALUES (v_payment.user_id, 'debit', v_payment.amount, v_payment.currency, 'Escrow funded — ' || v_opportunity.title);

  UPDATE public.payments SET status = 'paid', escrow_id = v_escrow_id, updated_at = now() WHERE id = v_payment.id;
  UPDATE public.proposals SET status = 'accepted', escrow_id = v_escrow_id WHERE id = v_proposal.id;
  UPDATE public.proposals SET status = 'declined'
    WHERE opportunity_id = v_opportunity.id AND id <> v_proposal.id AND status = 'submitted';
  UPDATE public.opportunities SET status = 'in_progress' WHERE id = v_opportunity.id;

  INSERT INTO public.notifications (user_id, type, title, body, link) VALUES
    (v_proposal.talent_id, 'hired', 'You have been hired', v_opportunity.title || ' — payment is held in escrow', '/wallet'),
    (v_payment.user_id, 'payment', 'Escrow funded', v_payment.currency || ' ' || v_payment.amount::text || ' — ' || v_opportunity.title, '/wallet');

  RETURN v_escrow_id;
END; $$;

-- Escrow funded from the client's wallet
CREATE OR REPLACE FUNCTION public.fund_escrow_from_wallet(p_proposal_id uuid, p_client_id uuid)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_proposal public.proposals%ROWTYPE;
  v_opportunity public.opportunities%ROWTYPE;
  v_existing uuid;
  v_escrow_id uuid;
  v_tx uuid;
  v_amount numeric;
  v_currency text;
  v_balance numeric;
  v_wallet_currency text;
  v_wallet_account uuid;
  v_escrow_account uuid;
BEGIN
  SELECT * INTO v_proposal FROM public.proposals WHERE id = p_proposal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposal not found'; END IF;
  IF v_proposal.status NOT IN ('submitted', 'accepted') THEN RAISE EXCEPTION 'This proposal is not open for funding'; END IF;

  SELECT * INTO v_opportunity FROM public.opportunities WHERE id = v_proposal.opportunity_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opportunity not found'; END IF;
  IF v_opportunity.client_id <> p_client_id THEN RAISE EXCEPTION 'Only the owning client can fund this hire'; END IF;

  SELECT id INTO v_existing FROM public.escrows WHERE proposal_id = v_proposal.id;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  v_amount := COALESCE(NULLIF(v_proposal.bid_amount, 0), v_opportunity.budget_max, v_opportunity.budget_min, v_opportunity.price_from, 0);
  IF v_amount IS NULL OR v_amount <= 0 THEN RAISE EXCEPTION 'This hire has no amount to fund'; END IF;
  v_currency := COALESCE(NULLIF(v_proposal.currency, ''), NULLIF(v_opportunity.currency, ''), 'NGN');

  v_balance := public.lock_wallet(p_client_id);
  SELECT wallet_currency INTO v_wallet_currency FROM public.profiles WHERE id = p_client_id;
  IF upper(v_wallet_currency) <> upper(v_currency) THEN
    RAISE EXCEPTION 'Wallet is in %, but this hire is priced in %', v_wallet_currency, v_currency;
  END IF;
  IF v_balance < v_amount THEN RAISE EXCEPTION 'Insufficient wallet balance' USING ERRCODE = '22003'; END IF;

  v_tx := public.start_ledger_transaction(
    'escrow_fund', 'escrow-fund:' || v_proposal.id, v_proposal.id::text,
    jsonb_build_object('proposal_id', v_proposal.id, 'client_id', p_client_id)
  );

  IF v_tx IS NULL THEN
    SELECT id INTO v_escrow_id FROM public.escrows WHERE proposal_id = v_proposal.id;
    IF v_escrow_id IS NULL THEN RAISE EXCEPTION 'Funding transaction exists but no escrow was created'; END IF;
    RETURN v_escrow_id;
  END IF;

  INSERT INTO public.escrows (
    opportunity_id, proposal_id, client_id, talent_id, title, company,
    amount, currency, status, funded_at, funding_source
  ) VALUES (
    v_opportunity.id, v_proposal.id, p_client_id, v_proposal.talent_id,
    v_opportunity.title, v_opportunity.company,
    v_amount, v_currency, 'funded', now(), 'wallet'
  ) RETURNING id INTO v_escrow_id;

  v_wallet_account := public.ensure_ledger_account('user_wallet', p_client_id, v_currency);
  v_escrow_account := public.ensure_ledger_account('platform_escrow', NULL, v_currency);
  PERFORM public.post_ledger_entry(v_tx, v_wallet_account, 'debit', v_amount);
  PERFORM public.post_ledger_entry(v_tx, v_escrow_account, 'credit', v_amount);

  INSERT INTO public.transactions (user_id, type, amount, currency, description)
  VALUES (p_client_id, 'debit', v_amount, v_currency, 'Escrow funded — ' || v_opportunity.title);

  UPDATE public.proposals SET status = 'accepted', escrow_id = v_escrow_id WHERE id = v_proposal.id;
  UPDATE public.proposals SET status = 'declined'
    WHERE opportunity_id = v_opportunity.id AND id <> v_proposal.id AND status = 'submitted';
  UPDATE public.opportunities SET status = 'in_progress' WHERE id = v_opportunity.id;

  INSERT INTO public.notifications (user_id, type, title, body, link) VALUES
    (v_proposal.talent_id, 'hired', 'You have been hired', v_opportunity.title || ' — payment is held in escrow', '/wallet'),
    (p_client_id, 'payment', 'Escrow funded', v_currency || ' ' || v_amount::text || ' — ' || v_opportunity.title, '/wallet');

  RETURN v_escrow_id;
END; $$;

-- Escrow release
CREATE OR REPLACE FUNCTION public.release_escrow(p_escrow_id uuid, p_actor_id uuid)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_escrow public.escrows%ROWTYPE;
  v_tx uuid;
  v_escrow_account uuid;
  v_talent_account uuid;
BEGIN
  SELECT * INTO v_escrow FROM public.escrows WHERE id = p_escrow_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Escrow not found'; END IF;
  IF v_escrow.client_id <> p_actor_id THEN RAISE EXCEPTION 'Only the client can release this escrow'; END IF;
  IF v_escrow.status = 'released' THEN RETURN 'released'; END IF;
  IF v_escrow.status <> 'delivered' THEN RAISE EXCEPTION 'Release is available after delivery'; END IF;

  v_tx := public.start_ledger_transaction(
    'escrow_release', 'escrow-release:' || v_escrow.id, v_escrow.id::text,
    jsonb_build_object('escrow_id', v_escrow.id, 'talent_id', v_escrow.talent_id)
  );
  IF v_tx IS NULL THEN RETURN 'released'; END IF;

  UPDATE public.escrows SET status = 'released', released_at = now() WHERE id = v_escrow.id;
  v_escrow_account := public.ensure_ledger_account('platform_escrow', NULL, v_escrow.currency);
  v_talent_account := public.ensure_ledger_account('user_wallet', v_escrow.talent_id, v_escrow.currency);
  PERFORM public.post_ledger_entry(v_tx, v_escrow_account, 'debit', v_escrow.amount);
  PERFORM public.post_ledger_entry(v_tx, v_talent_account, 'credit', v_escrow.amount);

  UPDATE public.profiles SET total_earned = total_earned + v_escrow.amount WHERE id = v_escrow.talent_id;
  INSERT INTO public.transactions (user_id, type, amount, currency, description)
  VALUES (v_escrow.talent_id, 'credit', v_escrow.amount, v_escrow.currency, 'Escrow released — ' || v_escrow.title);

  IF v_escrow.opportunity_id IS NOT NULL THEN
    UPDATE public.opportunities SET status = 'completed' WHERE id = v_escrow.opportunity_id;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_escrow.talent_id, 'escrow', 'Funds released',
    v_escrow.currency || ' ' || v_escrow.amount::text || ' — ' || v_escrow.title, '/wallet');

  RETURN 'released';
END; $$;

-- Milestone: fund
CREATE OR REPLACE FUNCTION public.fund_milestone(p_milestone_id uuid, p_actor_id uuid)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_milestone public.milestones%ROWTYPE;
  v_contract public.contracts%ROWTYPE;
  v_balance numeric;
  v_wallet_currency text;
  v_tx uuid;
  v_wallet_account uuid;
  v_escrow_account uuid;
BEGIN
  SELECT * INTO v_milestone FROM public.milestones WHERE id = p_milestone_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Milestone not found'; END IF;
  SELECT * INTO v_contract FROM public.contracts WHERE id = v_milestone.contract_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF v_contract.client_id <> p_actor_id THEN RAISE EXCEPTION 'Only the client can fund this milestone'; END IF;
  IF v_milestone.status = 'funded' THEN RETURN 'funded'; END IF;
  IF v_milestone.status <> 'planned' THEN RAISE EXCEPTION 'Milestone is already %', v_milestone.status; END IF;

  v_balance := public.lock_wallet(p_actor_id);
  SELECT wallet_currency INTO v_wallet_currency FROM public.profiles WHERE id = p_actor_id;
  IF upper(v_wallet_currency) <> upper(v_milestone.currency) THEN
    RAISE EXCEPTION 'Wallet is in %, but this milestone is priced in %', v_wallet_currency, v_milestone.currency;
  END IF;
  IF v_balance < v_milestone.amount THEN RAISE EXCEPTION 'Insufficient wallet balance' USING ERRCODE = '22003'; END IF;

  v_tx := public.start_ledger_transaction(
    'milestone_fund', 'milestone-fund:' || v_milestone.id, v_milestone.id::text,
    jsonb_build_object('milestone_id', v_milestone.id, 'contract_id', v_contract.id)
  );
  IF v_tx IS NULL THEN RETURN 'funded'; END IF;

  UPDATE public.milestones SET status = 'funded', funded_at = now() WHERE id = v_milestone.id;
  v_wallet_account := public.ensure_ledger_account('user_wallet', p_actor_id, v_milestone.currency);
  v_escrow_account := public.ensure_ledger_account('platform_escrow', NULL, v_milestone.currency);
  PERFORM public.post_ledger_entry(v_tx, v_wallet_account, 'debit', v_milestone.amount);
  PERFORM public.post_ledger_entry(v_tx, v_escrow_account, 'credit', v_milestone.amount);

  INSERT INTO public.transactions (user_id, type, amount, currency, description)
  VALUES (p_actor_id, 'debit', v_milestone.amount, v_milestone.currency, 'Milestone funded — ' || v_milestone.title);
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_contract.talent_id, 'contract', 'Milestone funded — you can start',
    v_milestone.currency || ' ' || v_milestone.amount::text || ' — ' || v_milestone.title, '/contracts');

  RETURN 'funded';
END; $$;

-- Milestone: approve
CREATE OR REPLACE FUNCTION public.approve_milestone(p_milestone_id uuid, p_actor_id uuid)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_milestone public.milestones%ROWTYPE;
  v_contract public.contracts%ROWTYPE;
  v_tx uuid;
  v_escrow_account uuid;
  v_talent_account uuid;
  v_live integer;
  v_paid integer;
BEGIN
  SELECT * INTO v_milestone FROM public.milestones WHERE id = p_milestone_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Milestone not found'; END IF;
  SELECT * INTO v_contract FROM public.contracts WHERE id = v_milestone.contract_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF v_contract.client_id <> p_actor_id THEN RAISE EXCEPTION 'Only the client can approve this milestone'; END IF;
  IF v_milestone.status = 'paid' THEN RETURN 'paid'; END IF;
  IF v_milestone.status <> 'submitted' THEN RAISE EXCEPTION 'Approve after the work is submitted'; END IF;

  v_tx := public.start_ledger_transaction(
    'milestone_release', 'milestone-approve:' || v_milestone.id, v_milestone.id::text,
    jsonb_build_object('milestone_id', v_milestone.id, 'contract_id', v_contract.id)
  );
  IF v_tx IS NULL THEN RETURN 'paid'; END IF;

  UPDATE public.milestones SET status = 'paid', approved_at = now() WHERE id = v_milestone.id;
  v_escrow_account := public.ensure_ledger_account('platform_escrow', NULL, v_milestone.currency);
  v_talent_account := public.ensure_ledger_account('user_wallet', v_contract.talent_id, v_milestone.currency);
  PERFORM public.post_ledger_entry(v_tx, v_escrow_account, 'debit', v_milestone.amount);
  PERFORM public.post_ledger_entry(v_tx, v_talent_account, 'credit', v_milestone.amount);

  UPDATE public.profiles SET total_earned = total_earned + v_milestone.amount WHERE id = v_contract.talent_id;
  INSERT INTO public.transactions (user_id, type, amount, currency, description)
  VALUES (v_contract.talent_id, 'credit', v_milestone.amount, v_milestone.currency, 'Milestone approved — ' || v_milestone.title);
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_contract.talent_id, 'contract', 'Milestone approved — funds released',
    v_milestone.currency || ' ' || v_milestone.amount::text || ' — ' || v_milestone.title, '/wallet');

  SELECT COUNT(*) FILTER (WHERE status <> 'cancelled'), COUNT(*) FILTER (WHERE status = 'paid')
  INTO v_live, v_paid FROM public.milestones WHERE contract_id = v_contract.id;
  IF v_live > 0 AND v_live = v_paid THEN
    UPDATE public.contracts SET status = 'completed' WHERE id = v_contract.id;
  END IF;

  RETURN 'paid';
END; $$;

-- Milestone: cancel
CREATE OR REPLACE FUNCTION public.cancel_milestone(p_milestone_id uuid, p_actor_id uuid)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_milestone public.milestones%ROWTYPE;
  v_contract public.contracts%ROWTYPE;
  v_tx uuid;
  v_escrow_account uuid;
  v_client_account uuid;
BEGIN
  SELECT * INTO v_milestone FROM public.milestones WHERE id = p_milestone_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Milestone not found'; END IF;
  SELECT * INTO v_contract FROM public.contracts WHERE id = v_milestone.contract_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found'; END IF;
  IF v_contract.client_id <> p_actor_id THEN RAISE EXCEPTION 'Only the client can cancel this milestone'; END IF;
  IF v_milestone.status = 'cancelled' THEN RETURN 'cancelled'; END IF;
  IF v_milestone.status = 'paid' THEN RAISE EXCEPTION 'Paid milestones cannot be cancelled'; END IF;

  IF v_milestone.status IN ('funded', 'in_progress', 'submitted') THEN
    v_tx := public.start_ledger_transaction(
      'milestone_refund', 'milestone-cancel:' || v_milestone.id, v_milestone.id::text,
      jsonb_build_object('milestone_id', v_milestone.id, 'contract_id', v_contract.id)
    );
    IF v_tx IS NULL THEN RETURN 'cancelled'; END IF;
    v_escrow_account := public.ensure_ledger_account('platform_escrow', NULL, v_milestone.currency);
    v_client_account := public.ensure_ledger_account('user_wallet', v_contract.client_id, v_milestone.currency);
    PERFORM public.post_ledger_entry(v_tx, v_escrow_account, 'debit', v_milestone.amount);
    PERFORM public.post_ledger_entry(v_tx, v_client_account, 'credit', v_milestone.amount);
    INSERT INTO public.transactions (user_id, type, amount, currency, description)
    VALUES (v_contract.client_id, 'credit', v_milestone.amount, v_milestone.currency, 'Milestone refunded — ' || v_milestone.title);
  END IF;

  UPDATE public.milestones SET status = 'cancelled' WHERE id = v_milestone.id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_contract.talent_id, 'contract', 'Milestone cancelled', v_milestone.title, '/contracts');

  RETURN 'cancelled';
END; $$;

-- mark_conversation_read: plain-PG variant takes explicit user id (server passes authenticated user)
-- We keep original name/signature compatibility is not possible without auth.uid(); app will be updated.
CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = p_conversation_id AND p_user_id IN (c.participant_a, c.participant_b)
  ) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;
  UPDATE public.messages SET read_at = now()
  WHERE conversation_id = p_conversation_id AND sender_id <> p_user_id AND read_at IS NULL;
END; $$;
