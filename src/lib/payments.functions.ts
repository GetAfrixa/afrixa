import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireAuth } from "@/lib/pg-auth-middleware";
import { sql } from "@/lib/db.server";

const providerSchema = z.enum(["paystack", "flutterwave"]);

/**
 * Absolute base URL for gateway callbacks. A configured APP_URL always wins so
 * that a spoofed Origin header can never redirect a payment confirmation
 * elsewhere.
 */
function originFrom(request: Request) {
  const configured = process.env["APP_URL"];
  if (configured) return configured.replace(/\/$/, "");
  const header = request.headers.get("origin");
  if (header) return header.replace(/\/$/, "");
  return new URL(request.url).origin;
}

export type WalletSummary = { balance: number; currency: string };

/** Current escrow wallet balance for the signed-in user. */
export const getWalletBalance = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<WalletSummary> => {
    const rows = await sql<{ wallet_balance: string | number; wallet_currency: string }[]>`
      SELECT wallet_balance, wallet_currency
      FROM public.profiles
      WHERE id = ${context.userId}::uuid
      LIMIT 1
    `;
    const row = rows[0];
    return {
      balance: Number(row?.wallet_balance ?? 0),
      currency: row?.wallet_currency ?? "NGN",
    };
  });

async function getUserEmail(userId: string) {
  const rows = await sql<{ email: string }[]>`
    SELECT email FROM public.users WHERE id = ${userId}::uuid LIMIT 1
  `;
  return rows[0]?.email ?? null;
}

/**
 * Starts a hosted checkout at the chosen gateway to top up the wallet.
 * Returns the URL the browser must open; the webhook credits the balance.
 */
export const startWalletTopUp = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) =>
    z
      .object({
        provider: providerSchema,
        amount: z.number().positive().max(50_000_000),
        // The wallet currency is server-owned; any client value is ignored.
        currency: z.string().trim().min(3).max(4).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { initializeCheckout, newReference } = await import("./payments.server");

    const email = await getUserEmail(context.userId);
    if (!email) throw new Error("Your account has no email address for checkout");

    const profileRows = await sql<{ wallet_currency: string }[]>`
      SELECT wallet_currency FROM public.profiles WHERE id = ${context.userId}::uuid LIMIT 1
    `;
    const currency = profileRows[0]?.wallet_currency ?? "NGN";

    const reference = newReference("top");
    const callbackUrl = `${originFrom(getRequest())}/payment-callback?provider=${data.provider}&reference=${reference}`;

    const authorizationUrl = await initializeCheckout({
      provider: data.provider,
      reference,
      amount: data.amount,
      currency,
      email,
      callbackUrl,
      description: "Afrixa wallet top-up",
    });

    await sql`
      INSERT INTO public.payments (user_id, provider, reference, purpose, amount, currency, status, authorization_url)
      VALUES (${context.userId}::uuid, ${data.provider}, ${reference}, 'topup', ${data.amount}, ${currency}, 'pending', ${authorizationUrl})
    `;

    return { authorizationUrl, reference };
  });

/**
 * Client hires a talent. `card` opens gateway checkout; `wallet` funds the
 * escrow immediately from the existing balance.
 */
export const fundHire = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) =>
    z
      .object({
        proposalId: z.string().uuid(),
        method: z.enum(["card", "wallet"]),
        provider: providerSchema.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    const proposalRows = await sql<any[]>`
      SELECT id, talent_id, opportunity_id, bid_amount, currency, status, escrow_id
      FROM public.proposals WHERE id = ${data.proposalId}::uuid LIMIT 1
    `;
    const proposal = proposalRows[0];
    if (!proposal) throw new Error("Proposal not found");
    if (proposal.escrow_id) throw new Error("This proposal is already funded");

    const oppRows = await sql<any[]>`
      SELECT id, title, client_id, currency, budget_max, budget_min, price_from
      FROM public.opportunities WHERE id = ${proposal.opportunity_id}::uuid LIMIT 1
    `;
    const opportunity = oppRows[0];
    if (!opportunity || opportunity.client_id !== userId) throw new Error("Forbidden");

    const amount =
      Number(proposal.bid_amount ?? 0) ||
      Number(opportunity.budget_max ?? opportunity.budget_min ?? opportunity.price_from ?? 0);
    if (!amount) throw new Error("This hire has no amount to fund");
    const currency = proposal.currency || opportunity.currency || "NGN";

    if (data.method === "wallet") {
      const { rpc } = await import("@/lib/rpc");
      const escrowId = await rpc<string>("fund_escrow_from_wallet", {
        p_proposal_id: proposal.id,
        p_client_id: userId,
      });
      return { method: "wallet" as const, escrowId, amount, currency };
    }

    const provider = data.provider;
    if (!provider) throw new Error("Choose a payment gateway");

    const { initializeCheckout, newReference } = await import("./payments.server");

    const email = await getUserEmail(userId);
    if (!email) throw new Error("Your account has no email address for checkout");

    const reference = newReference("esc");
    const callbackUrl = `${originFrom(getRequest())}/payment-callback?provider=${provider}&reference=${reference}`;

    const authorizationUrl = await initializeCheckout({
      provider,
      reference,
      amount,
      currency,
      email,
      callbackUrl,
      description: `Escrow for ${opportunity.title}`,
    });

    await sql`
      INSERT INTO public.payments (user_id, provider, reference, purpose, amount, currency, status, proposal_id, authorization_url)
      VALUES (${userId}::uuid, ${provider}, ${reference}, 'escrow', ${amount}, ${currency}, 'pending', ${proposal.id}::uuid, ${authorizationUrl})
    `;

    return { method: "card" as const, authorizationUrl, reference, amount, currency };
  });

/**
 * Called when the gateway redirects the buyer back. Confirms with the gateway
 * and settles the payment; webhooks do the same work so this is idempotent.
 */
export const confirmPayment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ reference: z.string().min(6).max(120) }).parse(input))
  .handler(async ({ data, context }) => {
    const rows = await sql<any[]>`
      SELECT id, user_id, purpose, amount, currency
      FROM public.payments WHERE reference = ${data.reference} LIMIT 1
    `;
    const payment = rows[0];
    if (!payment || payment.user_id !== context.userId) throw new Error("Payment not found");

    const { settlePayment } = await import("./payments.server");
    const result = await settlePayment(data.reference);
    return {
      status: result.status,
      purpose: payment.purpose,
      amount: Number(payment.amount),
      currency: payment.currency,
      ...(result.escrowId ? { escrowId: result.escrowId } : {}),
    };
  });
