import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth } from "@/lib/pg-auth-middleware";
import { sql } from "@/lib/db.server";

export type MilestoneStatus =
  "planned" | "funded" | "in_progress" | "submitted" | "approved" | "paid" | "cancelled";

export type Milestone = {
  id: string;
  contract_id: string;
  title: string;
  description: string | null;
  amount: number;
  currency: string;
  due_date: string | null;
  position: number;
  status: string;
  deliverable_note: string | null;
  deliverable_url: string | null;
  funded_at: string | null;
  started_at: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
};

export type ContractSummary = {
  id: string;
  title: string;
  description: string | null;
  total_amount: number;
  currency: string;
  status: string;
  created_at: string;
  client_id: string;
  talent_id: string;
  opportunity_id: string | null;
  proposal_id: string | null;
  counterparty_name: string;
  counterparty_headline: string | null;
  role: "client" | "talent";
  milestones: Milestone[];
  funded_total: number;
  paid_total: number;
};

function num(value: unknown) {
  return Number(value ?? 0);
}

export const listMyContracts = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<ContractSummary[]> => {
    const userId = context.userId;
    const contracts = await sql<any[]>`
      SELECT * FROM public.contracts
      WHERE client_id = ${userId}::uuid OR talent_id = ${userId}::uuid
      ORDER BY created_at DESC
    `;
    if (!contracts.length) return [];

    const contractIds = contracts.map((c) => c.id);
    const milestones = await sql<any[]>`
      SELECT id,contract_id,title,description,amount,currency,due_date,position,status,deliverable_note,deliverable_url,funded_at,started_at,submitted_at,approved_at,created_at
      FROM public.milestones
      WHERE contract_id = ANY(${contractIds}::uuid[])
      ORDER BY position ASC
    `;

    const otherIds = [...new Set(contracts.map((c) => (c.client_id === userId ? c.talent_id : c.client_id)))];
    const people = otherIds.length
      ? await sql<any[]>`SELECT id, full_name, headline FROM public.profiles WHERE id = ANY(${otherIds}::uuid[])`
      : [];
    const peopleMap = new Map((people ?? []).map((p) => [p.id, p]));

    return contracts.map((contract) => {
      const rows = (milestones ?? [])
        .filter((m) => m.contract_id === contract.id)
        .map((m) => ({ ...m, amount: num(m.amount) })) as Milestone[];
      const otherId = contract.client_id === userId ? contract.talent_id : contract.client_id;
      const person = peopleMap.get(otherId);
      return {
        id: contract.id,
        title: contract.title,
        description: contract.description,
        total_amount: num(contract.total_amount),
        currency: contract.currency,
        status: contract.status,
        created_at: contract.created_at,
        client_id: contract.client_id,
        talent_id: contract.talent_id,
        opportunity_id: contract.opportunity_id,
        proposal_id: contract.proposal_id,
        counterparty_name: person?.full_name || "Afrixa member",
        counterparty_headline: person?.headline ?? null,
        role: contract.client_id === userId ? "client" : "talent",
        milestones: rows,
        funded_total: rows
          .filter((m) => ["funded", "in_progress", "submitted", "approved", "paid"].includes(m.status))
          .reduce((sum, m) => sum + m.amount, 0),
        paid_total: rows.filter((m) => m.status === "paid").reduce((sum, m) => sum + m.amount, 0),
      };
    });
  });

export const createContract = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) =>
    z.object({
      proposalId: z.string().uuid(),
      title: z.string().trim().min(3).max(140),
      description: z.string().trim().max(2000).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const proposals = await sql<any[]>`
      SELECT id,talent_id,opportunity_id,bid_amount,currency,escrow_id,status
      FROM public.proposals WHERE id = ${data.proposalId}::uuid LIMIT 1
    `;
    const proposal = proposals[0];
    if (!proposal) throw new Error("Proposal not found");

    const opps = await sql<any[]>`
      SELECT id,client_id,title FROM public.opportunities WHERE id = ${proposal.opportunity_id}::uuid LIMIT 1
    `;
    const opportunity = opps[0];
    if (!opportunity || opportunity.client_id !== userId) throw new Error("Forbidden");

    const existing = await sql<any[]>`
      SELECT id FROM public.contracts WHERE proposal_id = ${proposal.id}::uuid LIMIT 1
    `;
    if (existing[0]) return { id: existing[0].id, existing: true };

    const created = await sql<any[]>`
      INSERT INTO public.contracts (client_id, talent_id, opportunity_id, proposal_id, escrow_id, title, description, total_amount, currency)
      VALUES (${userId}::uuid, ${proposal.talent_id}::uuid, ${proposal.opportunity_id}::uuid, ${proposal.id}::uuid, ${proposal.escrow_id}::uuid, ${data.title}, ${data.description ?? null}, ${num(proposal.bid_amount)}, ${proposal.currency})
      RETURNING id
    `;

    await sql`
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (${proposal.talent_id}::uuid, 'contract', 'New contract created', ${data.title}, '/contracts')
    `;

    return { id: created[0].id, existing: false };
  });

export const addMilestone = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) =>
    z.object({
      contractId: z.string().uuid(),
      title: z.string().trim().min(2).max(140),
      description: z.string().trim().max(2000).optional(),
      amount: z.number().positive().max(10_000_000),
      dueDate: z.string().trim().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const contracts = await sql<any[]>`
      SELECT id,client_id,talent_id,currency,status FROM public.contracts WHERE id = ${data.contractId}::uuid LIMIT 1
    `;
    const contract = contracts[0];
    if (!contract || contract.client_id !== userId) throw new Error("Forbidden");
    if (contract.status !== "active") throw new Error("Contract is closed");

    const counts = await sql<{ count: string }[]>`
      SELECT count(*)::text AS count FROM public.milestones WHERE contract_id = ${contract.id}::uuid
    `;
    const count = Number(counts[0]?.count ?? 0);

    await sql`
      INSERT INTO public.milestones (contract_id, title, description, amount, currency, due_date, position, status)
      VALUES (${contract.id}::uuid, ${data.title}, ${data.description ?? null}, ${data.amount}, ${contract.currency}, ${data.dueDate || null}::date, ${count + 1}, 'planned')
    `;

    await sql`
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (${contract.talent_id}::uuid, 'contract', 'New milestone added', ${data.title}, '/contracts')
    `;

    return { ok: true };
  });

export const advanceMilestone = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) =>
    z.object({
      milestoneId: z.string().uuid(),
      action: z.enum(["fund", "start", "submit", "approve", "cancel"]),
      note: z.string().trim().max(2000).optional(),
      url: z.string().url().max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    const milestoneRows = await sql<any[]>`
      SELECT * FROM public.milestones WHERE id = ${data.milestoneId}::uuid LIMIT 1
    `;
    const milestone = milestoneRows[0];
    if (!milestone) throw new Error("Milestone not found");

    const contractRows = await sql<any[]>`
      SELECT id,client_id,talent_id,status FROM public.contracts WHERE id = ${milestone.contract_id}::uuid LIMIT 1
    `;
    const contract = contractRows[0];
    if (!contract) throw new Error("Contract not found");

    const isClient = contract.client_id === userId;
    const isTalent = contract.talent_id === userId;
    if (!isClient && !isTalent) throw new Error("Forbidden");

    const now = new Date().toISOString();
    const { rpc } = await import("@/lib/rpc");

    const advance = async (from: string[], to: string, patch: Record<string, unknown>) => {
      const fields: string[] = ["status = $2"];
      const values: unknown[] = [milestone.id, to];
      let i = 3;
      for (const [k, v] of Object.entries(patch)) {
        fields.push(`${k} = $${i++}`);
        values.push(v);
      }
      values.push(from);
      const query = `UPDATE public.milestones SET ${fields.join(", ")} WHERE id = $1::uuid AND status = ANY($${i}::text[]) RETURNING id`;
      const updated = await sql.unsafe(query, values as any[]);
      return updated.length > 0;
    };

    if (data.action === "fund") {
      if (!isClient) throw new Error("Only the client can fund a milestone");
      const status = await rpc<string>("fund_milestone", {
        p_milestone_id: milestone.id,
        p_actor_id: userId,
      });
      return { status };
    }

    if (data.action === "start") {
      if (!isTalent) throw new Error("Only the freelancer can start work");
      const ok = await advance(["funded"], "in_progress", { started_at: now });
      if (!ok) throw new Error("Milestone must be funded first");
      await sql`INSERT INTO public.notifications (user_id, type, title, body, link) VALUES (${contract.client_id}::uuid, 'contract', 'Work started on a milestone', ${milestone.title}, '/contracts')`;
      return { status: "in_progress" };
    }

    if (data.action === "submit") {
      if (!isTalent) throw new Error("Only the freelancer can submit work");
      const ok = await advance(["funded", "in_progress"], "submitted", {
        submitted_at: now,
        deliverable_note: data.note ?? null,
        deliverable_url: data.url || null,
      });
      if (!ok) throw new Error("Milestone must be funded before submitting");
      await sql`INSERT INTO public.notifications (user_id, type, title, body, link) VALUES (${contract.client_id}::uuid, 'contract', 'Milestone submitted - review work', ${milestone.title}, '/contracts')`;
      return { status: "submitted" };
    }

    if (data.action === "cancel") {
      if (!isClient) throw new Error("Only the client can cancel a milestone");
      const status = await rpc<string>("cancel_milestone", {
        p_milestone_id: milestone.id,
        p_actor_id: userId,
      });
      return { status };
    }

    if (!isClient) throw new Error("Only the client can approve work");
    const status = await rpc<string>("approve_milestone", {
      p_milestone_id: milestone.id,
      p_actor_id: userId,
    });
    return { status };
  });
