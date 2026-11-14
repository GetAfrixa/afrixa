import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth } from "@/lib/pg-auth-middleware";
import { sql } from "@/lib/db.server";

export type ClientProposal = {
  id: string;
  status: string;
  cover_letter: string;
  bid_amount: number | null;
  currency: string;
  delivery_days: number | null;
  created_at: string;
  escrow_id: string | null;
  opportunity_id: string;
  opportunity_title: string;
  talent_id: string;
  talent_name: string;
  talent_headline: string | null;
  talent_country: string | null;
  resume_url: string | null;
  resume_name: string | null;
  portfolio_urls: string[];
  years_experience: string | null;
};

export const listClientProposals = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<ClientProposal[]> => {
    const userId = context.userId;
    const opportunities = await sql<any[]>`
      SELECT id, title FROM public.opportunities WHERE client_id = ${userId}::uuid
    `;
    if (!opportunities.length) return [];
    const titles = new Map(opportunities.map((o) => [o.id, o.title]));
    const oppIds = opportunities.map((o) => o.id);

    const proposals = await sql<any[]>`
      SELECT id,status,cover_letter,bid_amount,currency,delivery_days,created_at,escrow_id,opportunity_id,talent_id,resume_url,resume_name,portfolio_urls,years_experience
      FROM public.proposals
      WHERE opportunity_id = ANY(${oppIds}::uuid[])
      ORDER BY created_at DESC
    `;
    if (!proposals.length) return [];

    const talentIds = [...new Set(proposals.map((p) => p.talent_id))];
    const talents = await sql<any[]>`
      SELECT id,full_name,headline,country FROM public.profiles WHERE id = ANY(${talentIds}::uuid[])
    `;
    const talentMap = new Map(talents.map((t) => [t.id, t]));

    return proposals.map((p) => {
      const talent = talentMap.get(p.talent_id);
      return {
        ...p,
        opportunity_title: titles.get(p.opportunity_id) ?? "Opportunity",
        talent_name: talent?.full_name || "Afrixa talent",
        talent_headline: talent?.headline ?? null,
        talent_country: talent?.country ?? null,
        portfolio_urls: p.portfolio_urls ?? [],
      };
    });
  });

export const declineProposal = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ proposalId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const proposals = await sql<any[]>`
      SELECT id,status,opportunity_id FROM public.proposals WHERE id = ${data.proposalId}::uuid LIMIT 1
    `;
    const proposal = proposals[0];
    if (!proposal) throw new Error("Proposal not found");

    const opps = await sql<any[]>`
      SELECT id,client_id FROM public.opportunities WHERE id = ${proposal.opportunity_id}::uuid LIMIT 1
    `;
    const opportunity = opps[0];
    if (!opportunity || opportunity.client_id !== userId) throw new Error("Forbidden");
    if (proposal.status === "accepted") throw new Error("Accepted proposals cannot be declined");
    if (proposal.status === "declined") return { ok: true };

    await sql`
      UPDATE public.proposals SET status = 'declined'
      WHERE id = ${data.proposalId}::uuid AND status = 'submitted'
    `;
    return { ok: true };
  });

export const advanceEscrow = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) =>
    z.object({ escrowId: z.string().uuid(), action: z.enum(["start", "deliver", "release"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const rows = await sql<any[]>`
      SELECT id,status,amount,currency,title,client_id,talent_id,opportunity_id
      FROM public.escrows WHERE id = ${data.escrowId}::uuid LIMIT 1
    `;
    const escrow = rows[0];
    if (!escrow) throw new Error("Escrow not found");

    const isTalent = escrow.talent_id === userId;
    const isClient = escrow.client_id === userId;
    if (!isTalent && !isClient) throw new Error("Forbidden");

    const now = new Date().toISOString();

    const advance = async (from: string[], to: string, patch: Record<string, unknown>) => {
      const fields: string[] = ["status = $2"];
      const values: unknown[] = [escrow.id, to];
      let i = 3;
      for (const [k, v] of Object.entries(patch)) {
        fields.push(`${k} = $${i++}`);
        values.push(v);
      }
      values.push(from);
      const q = `UPDATE public.escrows SET ${fields.join(", ")} WHERE id = $1::uuid AND status = ANY($${i}::text[]) RETURNING id`;
      const updated = await sql.unsafe(q, values as any[]);
      return updated.length > 0;
    };

    if (data.action === "start") {
      if (!isTalent) throw new Error("Only the talent can start work");
      const ok = await advance(["funded"], "in_progress", { started_at: now });
      if (!ok) throw new Error("Escrow is not ready to start");
      await sql`INSERT INTO public.notifications (user_id, type, title, body, link) VALUES (${escrow.client_id}::uuid, 'escrow', 'Work started', ${escrow.title}, '/wallet')`;
      return { status: "in_progress" };
    }

    if (data.action === "deliver") {
      if (!isTalent) throw new Error("Only the talent can deliver");
      const ok = await advance(["funded", "in_progress"], "delivered", { delivered_at: now });
      if (!ok) throw new Error("Escrow cannot be delivered");
      await sql`INSERT INTO public.notifications (user_id, type, title, body, link) VALUES (${escrow.client_id}::uuid, 'escrow', 'Work delivered - review and release', ${escrow.title}, '/wallet')`;
      return { status: "delivered" };
    }

    if (!isClient) throw new Error("Only the client can release funds");
    if (escrow.status === "released") return { status: "released" };

    const { rpc } = await import("@/lib/rpc");
    const status = await rpc<string>("release_escrow", {
      p_escrow_id: escrow.id,
      p_actor_id: userId,
    });
    return { status };
  });

export type TalentApplication = {
  id: string;
  status: string;
  bid_amount: number | null;
  currency: string;
  delivery_days: number | null;
  created_at: string;
  opportunity_id: string;
  opportunity_title: string;
  opportunity_company: string;
  escrow_id: string | null;
  escrow_status: string | null;
};

export const listTalentApplications = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<TalentApplication[]> => {
    const userId = context.userId;
    const proposals = await sql<any[]>`
      SELECT id,status,bid_amount,currency,delivery_days,created_at,opportunity_id,escrow_id
      FROM public.proposals WHERE talent_id = ${userId}::uuid ORDER BY created_at DESC
    `;
    if (!proposals.length) return [];

    const oppIds = [...new Set(proposals.map((p) => p.opportunity_id))];
    const opportunities = await sql<any[]>`
      SELECT id,title,company FROM public.opportunities WHERE id = ANY(${oppIds}::uuid[])
    `;
    const oppMap = new Map(opportunities.map((o) => [o.id, o]));

    const escrowIds = proposals.map((p) => p.escrow_id).filter((id): id is string => Boolean(id));
    const escrowMap = new Map<string, string>();
    if (escrowIds.length) {
      const escrows = await sql<any[]>`SELECT id,status FROM public.escrows WHERE id = ANY(${escrowIds}::uuid[])`;
      for (const escrow of escrows) escrowMap.set(escrow.id, escrow.status);
    }

    return proposals.map((p) => ({
      ...p,
      opportunity_title: oppMap.get(p.opportunity_id)?.title ?? "Opportunity",
      opportunity_company: oppMap.get(p.opportunity_id)?.company ?? "Afrixa client",
      escrow_status: p.escrow_id ? (escrowMap.get(p.escrow_id) ?? null) : null,
    }));
  });
