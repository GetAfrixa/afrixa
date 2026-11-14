import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { sql } from "@/lib/db.server";
import { requireAuth } from "@/lib/pg-auth-middleware";

export type PeopleMatch = {
  id: string;
  full_name: string | null;
  headline: string | null;
  avatar_url: string | null;
  verified: boolean;
  country: string | null;
  reason: string;
};

export const recommendPeople = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ interests: z.string().trim().min(5).max(1000) }).parse(data))
  .handler(async ({ data, context }): Promise<PeopleMatch[]> => {
    const userId = context.userId;
    const { rankPeople } = await import("./people-match.server");

    const people = await sql<any[]>`
      SELECT id,full_name,headline,avatar_url,verified,country,role,primary_skill
      FROM public.profiles
      WHERE discoverable = true AND id <> ${userId}::uuid
      LIMIT 80
    `;
    if (!people.length) return [];

    const skills = await sql<any[]>`
      SELECT user_id,name FROM public.profile_skills
      WHERE user_id = ANY(${people.map((p) => p.id)}::uuid[])
    `;
    const skillMap = new Map<string, string[]>();
    for (const row of skills) {
      const list = skillMap.get(row.user_id) ?? [];
      if (list.length < 6) list.push(row.name);
      skillMap.set(row.user_id, list);
    }

    const ranked = await rankPeople(
      data.interests,
      people.map((p) => ({
        id: p.id,
        name: p.full_name ?? "Member",
        headline: p.headline,
        role: p.role,
        country: p.country,
        skills: [p.primary_skill, ...(skillMap.get(p.id) ?? [])].filter(Boolean) as string[],
      })),
    );

    const byId = new Map(people.map((p) => [p.id, p]));
    return ranked.map((r) => {
      const p = byId.get(r.id)!;
      return {
        id: p.id,
        full_name: p.full_name,
        headline: p.headline ?? p.primary_skill,
        avatar_url: p.avatar_url,
        verified: p.verified,
        country: p.country,
        reason: r.reason,
      };
    });
  });
