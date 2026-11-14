import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Opportunity } from "@/lib/afrixa";
import { sql } from "@/lib/db.server";
import { requireAuth } from "@/lib/pg-auth-middleware";
import { skillPercent } from "@/lib/profile.data";

export type TalentSignals = {
  skills: { name: string; level: string; years: number | null }[];
  experienceText: string[];
  portfolioCategories: string[];
  primarySkill: string | null;
};

export type RecommendedGig = {
  opportunity: Opportunity;
  score: number;
  reasons: string[];
};

const STOP_WORDS = new Set([
  "and",
  "for",
  "the",
  "with",
  "you",
  "your",
  "a",
  "an",
  "of",
  "to",
  "in",
  "on",
  "at",
  "we",
  "need",
  "needed",
  "looking",
  "wanted",
  "help",
]);

function tokens(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

/** Everything we know about the signed-in talent that can be matched to a gig. */
export const fetchTalentSignals = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<TalentSignals> => {
    const userId = context.userId;
    const [skills, experience, portfolio, profile] = await Promise.all([
      sql<any[]>`SELECT name,level,years FROM public.profile_skills WHERE user_id = ${userId}::uuid`,
      sql<any[]>`SELECT title,company,summary FROM public.work_experiences WHERE user_id = ${userId}::uuid`,
      sql<any[]>`SELECT category,title FROM public.portfolio_items WHERE user_id = ${userId}::uuid`,
      sql<any[]>`SELECT primary_skill FROM public.profiles WHERE id = ${userId}::uuid LIMIT 1`,
    ]);

    return {
      skills: skills.map((row) => ({
        name: row.name,
        level: row.level,
        years: row.years ? Number(row.years) : null,
      })),
      experienceText: experience.map((row) =>
        [row.title, row.company, row.summary].filter(Boolean).join(" "),
      ),
      portfolioCategories: portfolio
        .map((row) => [row.category, row.title].filter(Boolean).join(" "))
        .filter(Boolean) as string[],
      primarySkill: profile[0]?.primary_skill ?? null,
    };
  });

export const fetchOpenGigs = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ limit: z.number().int().min(1).max(200).optional() }).parse(input ?? {}))
  .handler(async ({ data }): Promise<Opportunity[]> => {
    const limit = data.limit ?? 60;
    return await sql<Opportunity[]>`
      SELECT * FROM public.opportunities
      WHERE status = 'open'
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  });

/** Ranks gigs against a talent's skills, experience and portfolio. */
export function rankGigs(gigs: Opportunity[], signals: TalentSignals): RecommendedGig[] {
  const experienceTokens = new Set(signals.experienceText.flatMap(tokens));
  const portfolioTokens = new Set(signals.portfolioCategories.flatMap(tokens));

  const ranked = gigs.map((opportunity) => {
    const haystack = new Set([
      ...tokens(opportunity.title),
      ...tokens(opportunity.description ?? ""),
      ...opportunity.skills.flatMap(tokens),
      ...tokens(opportunity.category),
    ]);

    let score = 0;
    const reasons: string[] = [];

    const matchedSkills = signals.skills.filter((skill) =>
      tokens(skill.name).some((token) => haystack.has(token)),
    );
    for (const skill of matchedSkills) {
      score += 30 * (skillPercent(skill.level) / 100) + Math.min(skill.years ?? 0, 8);
    }
    if (matchedSkills.length > 0) {
      reasons.push(
        `Matches your ${matchedSkills
          .slice(0, 3)
          .map((skill) => skill.name)
          .join(", ")}`,
      );
    }

    if (
      signals.primarySkill &&
      tokens(signals.primarySkill).some((token) => haystack.has(token))
    ) {
      score += 15;
      reasons.push(`Close to your main skill`);
    }

    const experienceHits = [...experienceTokens].filter((token) => haystack.has(token)).length;
    if (experienceHits > 0) {
      score += Math.min(experienceHits * 5, 20);
      reasons.push("Similar to your past work");
    }

    const portfolioHits = [...portfolioTokens].filter((token) => haystack.has(token)).length;
    if (portfolioHits > 0) {
      score += Math.min(portfolioHits * 4, 16);
      reasons.push("Like projects in your portfolio");
    }

    if (opportunity.escrow_funded) {
      score += 6;
      reasons.push("Payment already secured");
    }

    return { opportunity, score, reasons };
  });

  return ranked.filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
}

export function matchPercent(score: number) {
  return Math.max(20, Math.min(99, Math.round((score / 90) * 100)));
}
