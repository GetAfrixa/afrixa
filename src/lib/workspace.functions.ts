import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { sql } from "@/lib/db.server";
import { requireAuth } from "@/lib/pg-auth-middleware";
import type { Opportunity } from "@/lib/afrixa";

/* ------------------------------------------------------------------ */
/* Opportunities                                                       */
/* ------------------------------------------------------------------ */

export const searchOpportunities = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        category: z.string().optional(),
        country: z.string().optional(),
        query: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<Opportunity[]> => {
    const category = data.category && data.category !== "all" ? data.category : null;
    const country = data.country && data.country !== "all" ? data.country : null;
    const term = data.query?.trim() ?? "";
    const limit = data.limit ?? 50;
    return await sql<Opportunity[]>`
      SELECT * FROM public.opportunities
      WHERE (${category}::text IS NULL OR category = ${category})
        AND (${country}::text IS NULL OR country = ${country})
        AND (${term} = '' OR title ILIKE ${`%${term}%`})
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  });

export const listGigs = createServerFn({ method: "GET" }).handler(
  async (): Promise<Opportunity[]> => {
    return await sql<Opportunity[]>`
      SELECT * FROM public.opportunities
      WHERE category = 'gig'
      ORDER BY created_at DESC
      LIMIT 30
    `;
  },
);

export const getOpportunity = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<Opportunity | null> => {
    const rows = await sql<Opportunity[]>`
      SELECT * FROM public.opportunities WHERE id = ${data.id}::uuid LIMIT 1
    `;
    return rows[0] ?? null;
  });

const opportunityInput = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string().default("gig"),
  company: z.string().optional(),
  country: z.string().nullable().optional(),
  currency: z.string().default("USD"),
  price_from: z.number().nullable().optional(),
  delivery_days: z.number().int().nullable().optional(),
  escrow_funded: z.boolean().optional(),
  skills: z.array(z.string()).default([]),
  work_mode: z.string().nullable().optional(),
});

export const createOpportunity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => opportunityInput.parse(input))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const rows = await sql<{ id: string }[]>`
      INSERT INTO public.opportunities
        (title, description, category, company, client_id, country, currency,
         price_from, delivery_days, escrow_funded, skills, work_mode)
      VALUES
        (${data.title}, ${data.description ?? null}, ${data.category}, ${data.company ?? null},
         ${context.userId}::uuid, ${data.country ?? null}, ${data.currency},
         ${data.price_from ?? null}, ${data.delivery_days ?? null}, ${data.escrow_funded ?? false},
         ${data.skills}, ${data.work_mode ?? null})
      RETURNING id
    `;
    return rows[0]!;
  });

/* ------------------------------------------------------------------ */
/* Proposals                                                           */
/* ------------------------------------------------------------------ */

export const getMyProposal = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ opportunityId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const rows = await sql<any[]>`
      SELECT id,status FROM public.proposals
      WHERE opportunity_id = ${data.opportunityId}::uuid AND talent_id = ${context.userId}::uuid
      LIMIT 1
    `;
    return rows[0] ?? null;
  });

export const countProposals = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ opportunityId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<number> => {
    const rows = await sql<{ n: string }[]>`
      SELECT count(*)::text AS n FROM public.proposals WHERE opportunity_id = ${data.opportunityId}::uuid
    `;
    return Number(rows[0]?.n ?? 0);
  });

export const createProposal = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) =>
    z
      .object({
        opportunityId: z.string().uuid(),
        coverLetter: z.string().min(1).max(5000),
        bidAmount: z.number().nullable().optional(),
        currency: z.string().default("USD"),
        deliveryDays: z.number().int().nullable().optional(),
        resumeUrl: z.string().nullable().optional(),
        resumeName: z.string().nullable().optional(),
        portfolioUrls: z.array(z.string()).default([]),
        yearsExperience: z.string().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await sql`
      INSERT INTO public.proposals
        (opportunity_id, talent_id, cover_letter, bid_amount, currency, delivery_days,
         resume_url, resume_name, portfolio_urls, years_experience)
      VALUES
        (${data.opportunityId}::uuid, ${context.userId}::uuid, ${data.coverLetter},
         ${data.bidAmount ?? null}, ${data.currency}, ${data.deliveryDays ?? null},
         ${data.resumeUrl ?? null}, ${data.resumeName ?? null}, ${data.portfolioUrls},
         ${data.yearsExperience ?? null})
    `;
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

export const updateAvatar = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ avatarUrl: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    await sql`UPDATE public.profiles SET avatar_url = ${data.avatarUrl} WHERE id = ${context.userId}::uuid`;
    return { ok: true };
  });

export const setDiscoverable = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ discoverable: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    await sql`UPDATE public.profiles SET discoverable = ${data.discoverable} WHERE id = ${context.userId}::uuid`;
    return { ok: true };
  });

export const listPortfolio = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    return await sql<any[]>`
      SELECT id,title,category,link_url FROM public.portfolio_items
      WHERE user_id = ${context.userId}::uuid
      ORDER BY created_at DESC
    `;
  });

export const addPortfolioItem = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) =>
    z.object({ title: z.string().min(1).max(200), category: z.string().nullable().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await sql`
      INSERT INTO public.portfolio_items (user_id, title, category)
      VALUES (${context.userId}::uuid, ${data.title}, ${data.category ?? null})
    `;
    return { ok: true };
  });

export const escrowBalance = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<number> => {
    const rows = await sql<{ total: string | null }[]>`
      SELECT COALESCE(SUM(amount), 0)::text AS total FROM public.escrows
      WHERE client_id = ${context.userId}::uuid OR talent_id = ${context.userId}::uuid
    `;
    return Number(rows[0]?.total ?? 0);
  });

export const listAssessments = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    return await sql<any[]>`
      SELECT id,skill,score,level,created_at::text AS created_at FROM public.assessments
      WHERE user_id = ${context.userId}::uuid
      ORDER BY created_at DESC
    `;
  });

export const saveAssessment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) =>
    z.object({ skill: z.string().min(1), score: z.number().int().min(0).max(100), level: z.string() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await sql`
      INSERT INTO public.assessments (user_id, skill, score, level)
      VALUES (${context.userId}::uuid, ${data.skill}, ${data.score}, ${data.level})
    `;
    return { ok: true };
  });

const onboardingInput = z.object({
  role: z.string(),
  full_name: z.string().min(1),
  country: z.string().nullable().optional(),
  headline: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  primary_skill: z.string().nullable().optional(),
  years_experience: z.number().int().nullable().optional(),
  languages: z.array(z.string()).default([]),
  business_name: z.string().nullable().optional(),
  client_type: z.string().nullable().optional(),
  profile_strength: z.number().int().min(0).max(100),
});

export const saveOnboarding = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => onboardingInput.parse(input))
  .handler(async ({ data, context }) => {
    await sql`
      UPDATE public.profiles SET
        role = ${data.role},
        full_name = ${data.full_name},
        country = ${data.country ?? null},
        headline = ${data.headline ?? null},
        bio = ${data.bio ?? null},
        primary_skill = ${data.primary_skill ?? null},
        years_experience = ${data.years_experience ?? null},
        languages = ${data.languages},
        business_name = ${data.business_name ?? null},
        client_type = ${data.client_type ?? null},
        profile_strength = ${data.profile_strength},
        onboarding_complete = true
      WHERE id = ${context.userId}::uuid
    `;
    return { ok: true };
  });

export const listTalentDirectory = createServerFn({ method: "GET" }).handler(async () => {
  return await sql<any[]>`
    SELECT id,full_name,headline,country,primary_skill,avatar_url,verified,hourly_rate,profile_strength
    FROM public.profiles
    WHERE role = 'talent' AND onboarding_complete = true AND discoverable = true
    ORDER BY profile_strength DESC
    LIMIT 60
  `;
});

/* ------------------------------------------------------------------ */
/* Wallet                                                              */
/* ------------------------------------------------------------------ */

export const listWalletEscrows = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    return await sql<any[]>`
      SELECT id,title,company,amount::text AS amount,currency,status,client_id,talent_id
      FROM public.escrows
      WHERE client_id = ${context.userId}::uuid OR talent_id = ${context.userId}::uuid
      ORDER BY created_at DESC
    `;
  });

export const listWalletTransactions = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    return await sql<any[]>`
      SELECT id,amount::text AS amount,currency,type,description,created_at::text AS created_at
      FROM public.transactions
      WHERE user_id = ${context.userId}::uuid
      ORDER BY created_at DESC
      LIMIT 6
    `;
  });

/* ------------------------------------------------------------------ */
/* Payment setup                                                       */
/* ------------------------------------------------------------------ */

export const getPaymentProfile = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const rows = await sql<any[]>`
      SELECT preferred_gateway, country FROM public.profiles WHERE id = ${context.userId}::uuid LIMIT 1
    `;
    return rows[0] ?? null;
  });

export const listPayoutMethods = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    return await sql<any[]>`
      SELECT id, method, country, bank_name, bank_code, account_name, account_number, phone_number, is_default
      FROM public.payout_methods
      WHERE user_id = ${context.userId}::uuid
      ORDER BY is_default DESC, created_at DESC
    `;
  });

export const savePreferredGateway = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ gateway: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    await sql`UPDATE public.profiles SET preferred_gateway = ${data.gateway} WHERE id = ${context.userId}::uuid`;
    return { ok: true };
  });

const payoutInput = z.object({
  method: z.enum(["bank_transfer", "mobile_money"]),
  country: z.string().nullable().optional(),
  bank_name: z.string().nullable().optional(),
  bank_code: z.string().nullable().optional(),
  account_name: z.string().nullable().optional(),
  account_number: z.string().nullable().optional(),
  phone_number: z.string().nullable().optional(),
  is_default: z.boolean().default(false),
});

export const addPayoutMethod = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => payoutInput.parse(input))
  .handler(async ({ data, context }) => {
    await sql`
      INSERT INTO public.payout_methods
        (user_id, method, country, bank_name, bank_code, account_name, account_number, phone_number, is_default)
      VALUES
        (${context.userId}::uuid, ${data.method}, ${data.country ?? null}, ${data.bank_name ?? null},
         ${data.bank_code ?? null}, ${data.account_name ?? null}, ${data.account_number ?? null},
         ${data.phone_number ?? null}, ${data.is_default})
    `;
    return { ok: true };
  });

export const setDefaultPayoutMethod = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await sql`UPDATE public.payout_methods SET is_default = false WHERE user_id = ${context.userId}::uuid`;
    await sql`UPDATE public.payout_methods SET is_default = true WHERE id = ${data.id}::uuid AND user_id = ${context.userId}::uuid`;
    return { ok: true };
  });

export const deletePayoutMethod = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await sql`DELETE FROM public.payout_methods WHERE id = ${data.id}::uuid AND user_id = ${context.userId}::uuid`;
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Verification                                                        */
/* ------------------------------------------------------------------ */

export const getLatestVerification = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const rows = await sql<any[]>`
      SELECT * FROM public.identity_verifications
      WHERE user_id = ${context.userId}::uuid
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return rows[0] ?? null;
  });

export const submitVerification = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) =>
    z
      .object({
        idType: z.string().min(1),
        idNumberLast4: z.string().min(4).max(4),
        fullName: z.string().min(1),
        documentPath: z.string().min(1),
        selfiePath: z.string().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await sql`
      INSERT INTO public.identity_verifications
        (user_id, id_type, id_number_last4, full_name, document_path, selfie_path)
      VALUES
        (${context.userId}::uuid, ${data.idType}, ${data.idNumberLast4}, ${data.fullName},
         ${data.documentPath}, ${data.selfiePath ?? null})
    `;
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Messaging                                                           */
/* ------------------------------------------------------------------ */

export type ChatMessage = {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
  read_at: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_size: number | null;
  reply_to_id: string | null;
};

export type ChatReaction = { id: string; message_id: string; user_id: string; emoji: string };

export const getConversationSummary = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ conversationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const rows = await sql<any[]>`
      SELECT c.participant_a, c.participant_b, c.subject,
             p.id AS other_id, p.full_name, p.avatar_url, p.headline
      FROM public.conversations c
      LEFT JOIN public.profiles p
        ON p.id = CASE WHEN c.participant_a = ${context.userId}::uuid THEN c.participant_b ELSE c.participant_a END
      WHERE c.id = ${data.conversationId}::uuid
        AND (c.participant_a = ${context.userId}::uuid OR c.participant_b = ${context.userId}::uuid)
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.other_id as string,
      name: (row.full_name as string) || (row.subject as string) || "Afrixa member",
      avatar: row.avatar_url as string | null,
      headline: row.headline as string | null,
    };
  });

export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ conversationId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<ChatMessage[]> => {
    return await sql<ChatMessage[]>`
      SELECT id,body,sender_id,created_at::text AS created_at,read_at::text AS read_at,
             attachment_path,attachment_name,attachment_type,attachment_size,reply_to_id
      FROM public.messages
      WHERE conversation_id = ${data.conversationId}::uuid
      ORDER BY created_at ASC
    `;
  });

export const listMessageReactions = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ messageIds: z.array(z.string().uuid()) }).parse(input))
  .handler(async ({ data }): Promise<ChatReaction[]> => {
    if (data.messageIds.length === 0) return [];
    return await sql<ChatReaction[]>`
      SELECT id,message_id,user_id,emoji FROM public.message_reactions
      WHERE message_id = ANY(${data.messageIds}::uuid[])
    `;
  });

export const toggleMessageReaction = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) =>
    z.object({ messageId: z.string().uuid(), emoji: z.string().min(1).max(8) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const existing = await sql<any[]>`
      SELECT id,emoji FROM public.message_reactions
      WHERE message_id = ${data.messageId}::uuid AND user_id = ${context.userId}::uuid
      LIMIT 1
    `;
    const current = existing[0];
    if (current?.emoji === data.emoji) {
      await sql`DELETE FROM public.message_reactions WHERE id = ${current.id}::uuid`;
      return { ok: true };
    }
    if (current) {
      await sql`UPDATE public.message_reactions SET emoji = ${data.emoji} WHERE id = ${current.id}::uuid`;
      return { ok: true };
    }
    await sql`
      INSERT INTO public.message_reactions (message_id, user_id, emoji)
      VALUES (${data.messageId}::uuid, ${context.userId}::uuid, ${data.emoji})
    `;
    return { ok: true };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) =>
    z
      .object({
        conversationId: z.string().uuid(),
        body: z.string().max(8000).default(""),
        replyToId: z.string().uuid().nullable().optional(),
        attachmentPath: z.string().nullable().optional(),
        attachmentName: z.string().nullable().optional(),
        attachmentType: z.string().nullable().optional(),
        attachmentSize: z.number().int().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ChatMessage> => {
    const rows = await sql<ChatMessage[]>`
      INSERT INTO public.messages
        (conversation_id, sender_id, body, reply_to_id,
         attachment_path, attachment_name, attachment_type, attachment_size)
      VALUES
        (${data.conversationId}::uuid, ${context.userId}::uuid, ${data.body},
         ${data.replyToId ?? null}, ${data.attachmentPath ?? null}, ${data.attachmentName ?? null},
         ${data.attachmentType ?? null}, ${data.attachmentSize ?? null})
      RETURNING id,body,sender_id,created_at::text AS created_at,read_at::text AS read_at,
                attachment_path,attachment_name,attachment_type,attachment_size,reply_to_id
    `;
    await sql`
      UPDATE public.conversations SET last_message_at = now()
      WHERE id = ${data.conversationId}::uuid
    `;
    return rows[0]!;
  });

/* ------------------------------------------------------------------ */
/* Posts                                                               */
/* ------------------------------------------------------------------ */

export const createPost = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) =>
    z
      .object({
        body: z.string().min(1).max(5000),
        kind: z.string().default("update"),
        visibility: z.string().default("public"),
        imageUrl: z.string().nullable().optional(),
        linkUrl: z.string().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await sql`
      INSERT INTO public.posts (author_id, body, kind, visibility, image_url, link_url)
      VALUES (${context.userId}::uuid, ${data.body}, ${data.kind}, ${data.visibility},
              ${data.imageUrl ?? null}, ${data.linkUrl ?? null})
    `;
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Inbox                                                               */
/* ------------------------------------------------------------------ */

export type InboxRow = {
  id: string;
  subject: string | null;
  otherId: string;
  otherName: string;
  otherAvatar: string | null;
  otherHeadline: string | null;
  last_message_at: string | null;
  preview: string;
  unread: number;
};

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<InboxRow[]> => {
    const userId = context.userId;
    const rows = await sql<any[]>`
      SELECT c.id,
             c.subject,
             c.last_message_at::text AS last_message_at,
             p.id AS other_id,
             p.full_name AS other_name,
             p.avatar_url AS other_avatar,
             p.headline AS other_headline,
             m.body AS last_body,
             m.sender_id AS last_sender_id,
             m.attachment_name AS last_attachment,
             m.created_at::text AS last_created_at,
             COALESCE(u.unread, 0)::int AS unread
      FROM public.conversations c
      LEFT JOIN public.profiles p
        ON p.id = CASE WHEN c.participant_a = ${userId}::uuid THEN c.participant_b ELSE c.participant_a END
      LEFT JOIN LATERAL (
        SELECT body, sender_id, attachment_name, created_at
        FROM public.messages
        WHERE conversation_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
      ) m ON true
      LEFT JOIN LATERAL (
        SELECT count(*) AS unread
        FROM public.messages
        WHERE conversation_id = c.id AND sender_id <> ${userId}::uuid AND read_at IS NULL
      ) u ON true
      WHERE c.participant_a = ${userId}::uuid OR c.participant_b = ${userId}::uuid
      ORDER BY COALESCE(m.created_at, c.last_message_at, c.created_at) DESC
    `;
    return rows.map((row) => ({
      id: row.id,
      subject: row.subject,
      otherId: row.other_id as string,
      otherName: (row.other_name as string) || (row.subject as string) || "Afrixa member",
      otherAvatar: row.other_avatar ?? null,
      otherHeadline: row.other_headline ?? null,
      last_message_at: row.last_created_at ?? row.last_message_at,
      preview: row.last_body
        ? `${row.last_sender_id === userId ? "You: " : ""}${row.last_body}`
        : row.last_attachment
          ? `📎 ${row.last_attachment}`
          : "Say hello 👋",
      unread: row.unread ?? 0,
    }));
  });
