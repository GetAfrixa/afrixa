-- Plain PostgreSQL baseline (adapted from Supabase migrations).
-- Replaces Supabase auth/storage/realtime/role assumptions with app-managed auth.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Auth (replaces Supabase auth.users + auth.uid())
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  email_verified boolean NOT NULL DEFAULT false,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON public.sessions(expires_at);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS users_set_updated_at ON public.users;
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Core domain
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.app_user_role AS ENUM ('talent','client');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  role public.app_user_role,
  full_name text NOT NULL DEFAULT '',
  business_name text,
  country text,
  avatar_url text,
  cover_url text,
  headline text,
  bio text,
  primary_skill text,
  years_experience text,
  languages text[] NOT NULL DEFAULT '{}',
  client_type text,
  onboarding_complete boolean NOT NULL DEFAULT false,
  profile_strength int NOT NULL DEFAULT 20,
  verified boolean NOT NULL DEFAULT false,
  total_earned numeric NOT NULL DEFAULT 0,
  profile_views int NOT NULL DEFAULT 0,
  discoverable boolean NOT NULL DEFAULT true,
  hourly_rate numeric,
  wallet_balance numeric NOT NULL DEFAULT 0,
  wallet_currency text NOT NULL DEFAULT 'NGN',
  preferred_gateway text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  tagline text,
  about text,
  industry text,
  location text,
  website text,
  company_size text,
  logo_url text,
  cover_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS companies_owner_id_idx ON public.companies(owner_id);
CREATE INDEX IF NOT EXISTS companies_industry_idx ON public.companies(industry);
DROP TRIGGER IF EXISTS companies_set_updated_at ON public.companies;
CREATE TRIGGER companies_set_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  title text NOT NULL,
  company text NOT NULL DEFAULT '',
  country text,
  category text NOT NULL DEFAULT 'job',
  job_type text,
  work_mode text,
  currency text NOT NULL DEFAULT 'USD',
  budget_min numeric,
  budget_max numeric,
  price_from numeric,
  escrow_funded boolean NOT NULL DEFAULT false,
  rating numeric,
  reviews_count int NOT NULL DEFAULT 0,
  delivery_days int,
  deadline date,
  experience_level text,
  description text,
  skills text[] NOT NULL DEFAULT '{}',
  image_url text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS opportunities_company_id_idx ON public.opportunities(company_id);

CREATE TABLE IF NOT EXISTS public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  talent_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cover_letter text NOT NULL DEFAULT '',
  bid_amount numeric,
  currency text NOT NULL DEFAULT 'USD',
  delivery_days int,
  status text NOT NULL DEFAULT 'submitted',
  escrow_id uuid,
  resume_url text,
  resume_name text,
  portfolio_urls text[] NOT NULL DEFAULT '{}'::text[],
  years_experience text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(opportunity_id, talent_id)
);

CREATE TABLE IF NOT EXISTS public.escrows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  talent_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  company text,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  local_amount numeric,
  local_currency text,
  status text NOT NULL DEFAULT 'funded',
  funded_at timestamptz,
  started_at timestamptz,
  delivered_at timestamptz,
  released_at timestamptz,
  funding_source text NOT NULL DEFAULT 'card',
  payment_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.proposals
    ADD CONSTRAINT proposals_escrow_id_fkey FOREIGN KEY (escrow_id) REFERENCES public.escrows(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  reference text NOT NULL UNIQUE,
  purpose text NOT NULL DEFAULT 'escrow',
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  status text NOT NULL DEFAULT 'pending',
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  escrow_id uuid REFERENCES public.escrows(id) ON DELETE SET NULL,
  authorization_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_reference_idx ON public.payments(reference);
CREATE INDEX IF NOT EXISTS payments_user_created_idx ON public.payments(user_id, created_at DESC);
DROP TRIGGER IF EXISTS payments_set_updated_at ON public.payments;
CREATE TRIGGER payments_set_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$ BEGIN
  ALTER TABLE public.escrows
    ADD CONSTRAINT escrows_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'credit',
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  talent_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  escrow_id uuid REFERENCES public.escrows(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Contract',
  description text,
  total_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contracts_status_check CHECK (status IN ('active','completed','cancelled')),
  CONSTRAINT contracts_parties_check CHECK (client_id <> talent_id)
);
CREATE INDEX IF NOT EXISTS contracts_client_idx ON public.contracts(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS contracts_talent_idx ON public.contracts(talent_id, created_at DESC);
DROP TRIGGER IF EXISTS contracts_set_updated_at ON public.contracts;
CREATE TRIGGER contracts_set_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  due_date date,
  position int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'planned',
  deliverable_note text,
  deliverable_url text,
  funded_at timestamptz,
  started_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT milestones_status_check CHECK (status IN ('planned','funded','in_progress','submitted','approved','paid','cancelled')),
  CONSTRAINT milestones_amount_check CHECK (amount >= 0)
);
CREATE INDEX IF NOT EXISTS milestones_contract_idx ON public.milestones(contract_id, position);
DROP TRIGGER IF EXISTS milestones_set_updated_at ON public.milestones;
CREATE TRIGGER milestones_set_updated_at BEFORE UPDATE ON public.milestones FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Messaging / social / profile extras (minimal for app compatibility)
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_a uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  participant_b uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subject text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  read_at timestamptz,
  attachment_path text,
  attachment_name text,
  attachment_type text,
  attachment_size bigint,
  reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON public.messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);
CREATE INDEX IF NOT EXISTS message_reactions_message_idx ON public.message_reactions(message_id);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'general',
  title text NOT NULL DEFAULT '',
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.portfolio_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text,
  link_url text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  skill text NOT NULL,
  score int NOT NULL DEFAULT 0,
  level text NOT NULL DEFAULT 'Beginner',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payout_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  country text,
  method text NOT NULL DEFAULT 'bank_transfer',
  bank_name text,
  account_number text,
  account_name text,
  is_default boolean NOT NULL DEFAULT false,
  phone_number text,
  bank_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS payout_methods_set_updated_at ON public.payout_methods;
CREATE TRIGGER payout_methods_set_updated_at BEFORE UPDATE ON public.payout_methods FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  image_url text,
  link_url text,
  kind text NOT NULL DEFAULT 'update',
  visibility text NOT NULL DEFAULT 'public',
  comment_count int NOT NULL DEFAULT 0,
  reaction_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.post_comments(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.post_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reaction text NOT NULL DEFAULT 'like',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(requester_id, addressee_id),
  CONSTRAINT connections_distinct_check CHECK (requester_id <> addressee_id)
);

CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CONSTRAINT follows_distinct_check CHECK (follower_id <> following_id)
);

CREATE TABLE IF NOT EXISTS public.saved_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  item_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_type, item_id)
);

CREATE TABLE IF NOT EXISTS public.profile_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  level text NOT NULL DEFAULT 'intermediate',
  years numeric,
  position int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS public.work_experiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  company text NOT NULL,
  location text,
  employment_type text,
  start_date date NOT NULL,
  end_date date,
  is_current boolean NOT NULL DEFAULT false,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.education_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  school text NOT NULL,
  qualification text,
  field_of_study text,
  start_year int,
  end_year int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  issuer text NOT NULL,
  issue_date date,
  expiry_date date,
  credential_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.identity_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  id_type text NOT NULL,
  id_number_last4 text NOT NULL,
  full_name text NOT NULL,
  document_path text NOT NULL,
  selfie_path text,
  status text NOT NULL DEFAULT 'pending',
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
CREATE INDEX IF NOT EXISTS identity_verifications_user_idx ON public.identity_verifications(user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Ledger (adapted from hardening migration for plain Postgres)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ledger_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('user_wallet', 'platform_escrow', 'platform_revenue', 'gateway_clearing')),
  user_id uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3,4}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ledger_accounts_owner_check CHECK (
    (kind = 'user_wallet' AND user_id IS NOT NULL) OR
    (kind <> 'user_wallet' AND user_id IS NULL)
  ),
  CONSTRAINT ledger_accounts_unique UNIQUE NULLS NOT DISTINCT (kind, user_id, currency)
);

CREATE TABLE IF NOT EXISTS public.ledger_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  reference text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_transaction_id uuid NOT NULL REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT,
  account_id uuid NOT NULL REFERENCES public.ledger_accounts(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('debit', 'credit')),
  amount numeric(20,2) NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ledger_entries_account_idx ON public.ledger_entries(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ledger_entries_transaction_idx ON public.ledger_entries(ledger_transaction_id);
CREATE INDEX IF NOT EXISTS ledger_transactions_reference_idx ON public.ledger_transactions(reference);

CREATE UNIQUE INDEX IF NOT EXISTS escrows_proposal_id_uniq ON public.escrows(proposal_id) WHERE proposal_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ensure_ledger_account(p_kind text, p_user uuid, p_currency text)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.ledger_accounts (kind, user_id, currency)
  VALUES (p_kind, p_user, upper(p_currency))
  ON CONFLICT (kind, user_id, currency) DO UPDATE SET kind = EXCLUDED.kind
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.start_ledger_transaction(
  p_kind text, p_idempotency_key text, p_reference text DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.ledger_transactions (kind, idempotency_key, reference, metadata)
  VALUES (p_kind, p_idempotency_key, p_reference, p_metadata)
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.post_ledger_entry(
  p_transaction_id uuid, p_account_id uuid, p_direction text, p_amount numeric
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Ledger amount must be positive'; END IF;
  INSERT INTO public.ledger_entries (ledger_transaction_id, account_id, direction, amount)
  VALUES (p_transaction_id, p_account_id, p_direction, round(p_amount, 2));
END; $$;

CREATE OR REPLACE FUNCTION public.assert_ledger_balanced() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_debits numeric; v_credits numeric;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_debits FROM public.ledger_entries
  WHERE ledger_transaction_id = NEW.ledger_transaction_id AND direction = 'debit';
  SELECT COALESCE(SUM(amount), 0) INTO v_credits FROM public.ledger_entries
  WHERE ledger_transaction_id = NEW.ledger_transaction_id AND direction = 'credit';
  IF v_debits <> v_credits THEN
    RAISE EXCEPTION 'Unbalanced ledger transaction % (debits %, credits %)', NEW.ledger_transaction_id, v_debits, v_credits;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS ledger_entries_assert_balanced ON public.ledger_entries;
CREATE CONSTRAINT TRIGGER ledger_entries_assert_balanced
AFTER INSERT ON public.ledger_entries DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.assert_ledger_balanced();

-- Wallet balance derived from ledger entries for user_wallet accounts.
CREATE OR REPLACE FUNCTION public.refresh_wallet_balance(p_user_id uuid, p_currency text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_balance numeric;
BEGIN
  SELECT COALESCE(SUM(CASE WHEN e.direction = 'credit' THEN e.amount ELSE -e.amount END), 0)
  INTO v_balance
  FROM public.ledger_entries e
  JOIN public.ledger_accounts a ON a.id = e.account_id
  WHERE a.kind = 'user_wallet' AND a.user_id = p_user_id AND a.currency = upper(p_currency);
  UPDATE public.profiles SET wallet_balance = v_balance WHERE id = p_user_id;
END; $$;

CREATE OR REPLACE FUNCTION public.apply_ledger_entry() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_account public.ledger_accounts%ROWTYPE;
BEGIN
  SELECT * INTO v_account FROM public.ledger_accounts WHERE id = NEW.account_id;
  IF v_account.kind = 'user_wallet' THEN
    PERFORM public.refresh_wallet_balance(v_account.user_id, v_account.currency);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS ledger_entries_apply ON public.ledger_entries;
CREATE TRIGGER ledger_entries_apply AFTER INSERT ON public.ledger_entries
FOR EACH ROW EXECUTE FUNCTION public.apply_ledger_entry();

CREATE OR REPLACE FUNCTION public.lock_wallet(p_user_id uuid) RETURNS numeric LANGUAGE plpgsql AS $$
DECLARE v_balance numeric;
BEGIN
  SELECT wallet_balance INTO v_balance FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  RETURN COALESCE(v_balance, 0);
END; $$;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = p_conversation_id AND p_user_id IN (c.participant_a, c.participant_b)
  ) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;
  UPDATE public.messages
  SET read_at = now()
  WHERE conversation_id = p_conversation_id
    AND sender_id <> p_user_id
    AND read_at IS NULL;
END; $$;
