/**
 * Server-only payment gateway helpers for Paystack and Flutterwave.
 * Never import this from client-reachable modules; load it inside handlers.
 *
 * Settlement is idempotent at the database level: the ledger transaction is
 * keyed on the payment reference, so a retried webhook cannot credit twice.
 */
import { sql } from "@/lib/db.server";
import { rpc } from "@/lib/rpc";

export type Provider = "paystack" | "flutterwave";

function requireEnv(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
}

async function readError(response: Response, provider: Provider) {
  try {
    const payload = (await response.json()) as { message?: string; data?: { message?: string } };
    return new Error(
      `${provider} error: ${payload.message || payload.data?.message || response.statusText}`,
    );
  } catch {
    return new Error(`${provider} error: ${response.statusText}`);
  }
}

function randomSuffix() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().split("-")[0];
  }
  return Math.random().toString(36).slice(2, 10);
}

export function newReference(prefix: "top" | "esc") {
  const ts = Date.now().toString(36).toUpperCase();
  return `AFR-${prefix.toUpperCase()}-${ts}-${randomSuffix()}`.toUpperCase();
}

export async function initializeCheckout(input: {
  provider: Provider;
  reference: string;
  amount: number;
  currency: string;
  email: string;
  callbackUrl: string;
  description: string;
}) {
  const { provider, reference, amount, currency, email, callbackUrl, description } = input;

  if (provider === "paystack") {
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requireEnv("PAYSTACK_SECRET_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amount * 100),
        currency,
        reference,
        callback_url: callbackUrl,
        metadata: { description },
      }),
    });
    if (!response.ok) throw await readError(response, provider);
    const payload = (await response.json()) as {
      status?: boolean;
      message?: string;
      data?: { authorization_url?: string };
    };
    if (!payload.status || !payload.data?.authorization_url) {
      throw new Error(
        `Paystack could not start the payment: ${payload.message ?? "unknown error"}`,
      );
    }
    return payload.data.authorization_url;
  }

  const response = await fetch("https://api.flutterwave.com/v3/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("FLUTTERWAVE_SECRET_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tx_ref: reference,
      amount,
      currency,
      redirect_url: callbackUrl,
      customer: { email },
      customizations: { title: "Afrixa", description },
    }),
  });
  if (!response.ok) throw await readError(response, provider);
  const payload = (await response.json()) as {
    status?: string;
    message?: string;
    data?: { link?: string };
  };
  if (payload.status !== "success" || !payload.data?.link) {
    throw new Error(
      `Flutterwave could not start the payment: ${payload.message ?? "unknown error"}`,
    );
  }
  return payload.data.link;
}

export type VerifiedPayment = {
  reference: string;
  status: "success" | "failed" | "pending";
  amount: number;
  currency: string;
};

export async function verifyPayment(
  provider: Provider,
  reference: string,
): Promise<VerifiedPayment> {
  if (provider === "paystack") {
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${requireEnv("PAYSTACK_SECRET_KEY")}` } },
    );
    if (!response.ok) throw await readError(response, provider);
    const payload = (await response.json()) as {
      data?: { status?: string; amount?: number; currency?: string; reference?: string };
    };
    const divisor = 100;
    const currency = payload.data?.currency ?? "NGN";
    return {
      reference: payload.data?.reference ?? reference,
      status:
        payload.data?.status === "success"
          ? "success"
          : payload.data?.status === "failed"
            ? "failed"
            : "pending",
      amount: Number(payload.data?.amount ?? 0) / divisor,
      currency,
    };
  }

  const response = await fetch(
    `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${requireEnv("FLUTTERWAVE_SECRET_KEY")}` } },
  );
  if (!response.ok) throw await readError(response, provider);
  const payload = (await response.json()) as {
    data?: { status?: string; amount?: number; currency?: string; tx_ref?: string };
  };
  const status = payload.data?.status;
  return {
    reference: payload.data?.tx_ref ?? reference,
    status: status === "successful" ? "success" : status === "failed" ? "failed" : "pending",
    amount: Number(payload.data?.amount ?? 0),
    currency: payload.data?.currency ?? "NGN",
  };
}

type PaymentRow = {
  id: string;
  user_id: string;
  purpose: string;
  status: string;
  amount: number;
  currency: string;
  proposal_id: string | null;
  provider: string;
  escrow_id: string | null;
};

export async function settlePayment(
  reference: string,
): Promise<{ status: string; escrowId?: string }> {
  const rows = await sql<PaymentRow[]>`
    SELECT id, user_id, purpose, status, amount, currency, proposal_id, provider, escrow_id
    FROM public.payments WHERE reference = ${reference} LIMIT 1
  `;
  const payment = rows[0];

  if (!payment) throw new Error("Unknown payment reference");
  if (payment.status === "paid") {
    return {
      status: "paid",
      ...(payment.escrow_id ? { escrowId: payment.escrow_id } : {}),
    };
  }
  if (payment.status === "failed") return { status: "failed" };

  const verified = await verifyPayment(payment.provider as Provider, reference);

  if (verified.status !== "success") {
    if (verified.status === "failed") {
      await sql`UPDATE public.payments SET status = 'failed', updated_at = now() WHERE id = ${payment.id}::uuid`;
    }
    return { status: verified.status };
  }

  const paid = Number(verified.amount);
  const expected = Number(payment.amount);
  if (
    !Number.isFinite(paid) ||
    Math.abs(paid - expected) > 0.01 ||
    verified.currency.toUpperCase() !== payment.currency.toUpperCase()
  ) {
    await sql`UPDATE public.payments SET status = 'failed', updated_at = now() WHERE id = ${payment.id}::uuid`;
    throw new Error("Payment amount or currency does not match the checkout");
  }

  if (payment.purpose === "topup") {
    await rpc<number>("topup_from_payment", { p_payment_id: payment.id });
    return { status: "paid" };
  }

  if (!payment.proposal_id) throw new Error("Payment is not linked to a hire");

  const escrowId = await rpc<string>("fund_escrow_from_payment", {
    p_payment_id: payment.id,
  });
  return { status: "paid", escrowId };
}
