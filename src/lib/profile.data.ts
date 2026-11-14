import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { sql } from "@/lib/db.server";
import { requireAuth } from "@/lib/pg-auth-middleware";

export type SkillLevel = "beginner" | "intermediate" | "advanced" | "expert";

export type ProfileSkill = { id: string; name: string; level: string; years: number | null };
export type WorkExperience = {
  id: string; title: string; company: string; location: string | null; employment_type: string | null;
  start_date: string; end_date: string | null; is_current: boolean; summary: string | null;
};
export type EducationEntry = {
  id: string; school: string; qualification: string | null; field_of_study: string | null;
  start_year: number | null; end_year: number | null;
};
export type Certification = {
  id: string; name: string; issuer: string; issue_date: string | null; expiry_date: string | null; credential_url: string | null;
};
export type ProfileDossier = {
  skills: ProfileSkill[]; experience: WorkExperience[]; education: EducationEntry[]; certifications: Certification[];
};

export const SKILL_LEVELS: { value: SkillLevel; label: string; percent: number }[] = [
  { value: "beginner", label: "Beginner", percent: 25 },
  { value: "intermediate", label: "Intermediate", percent: 50 },
  { value: "advanced", label: "Advanced", percent: 75 },
  { value: "expert", label: "Expert", percent: 100 },
];

export function skillPercent(level: string) {
  return SKILL_LEVELS.find((item) => item.value === level)?.percent ?? 50;
}

export function monthYear(value: string | null) {
  if (!value) return "Present";
  return new Date(value).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export const fetchProfileDossier = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<ProfileDossier> => {
    const userId = data.userId;
    const [skills, experience, education, certifications] = await Promise.all([
      sql<any[]>`SELECT id,name,level,years FROM public.profile_skills WHERE user_id=${userId}::uuid ORDER BY position ASC, created_at ASC`,
      sql<any[]>`SELECT id,title,company,location,employment_type,start_date,end_date,is_current,summary FROM public.work_experiences WHERE user_id=${userId}::uuid ORDER BY start_date DESC`,
      sql<any[]>`SELECT id,school,qualification,field_of_study,start_year,end_year FROM public.education_entries WHERE user_id=${userId}::uuid ORDER BY end_year DESC NULLS LAST`,
      sql<any[]>`SELECT id,name,issuer,issue_date,expiry_date,credential_url FROM public.certifications WHERE user_id=${userId}::uuid ORDER BY issue_date DESC NULLS LAST`,
    ]);
    return {
      skills: skills.map((row) => ({ ...row, years: row.years == null ? null : Number(row.years) })),
      experience,
      education,
      certifications,
    };
  });

export const fetchSkillsForPeople = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ userIds: z.array(z.string().uuid()) }).parse(input))
  .handler(async ({ data }) => {
    if (data.userIds.length === 0) return {} as Record<string, string[]>;
    const rows = await sql<any[]>`
      SELECT user_id, name, position FROM public.profile_skills
      WHERE user_id = ANY(${data.userIds}::uuid[]) ORDER BY position ASC
    `;
    const map: Record<string, string[]> = {};
    for (const row of rows) {
      const list = map[row.user_id] ?? [];
      if (list.length < 3) list.push(row.name);
      map[row.user_id] = list;
    }
    return map;
  });

export const addSkill = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ name: z.string().min(1), level: z.string(), years: z.number().nullable().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const counts = await sql<{ count: string }[]>`SELECT count(*)::text AS count FROM public.profile_skills WHERE user_id=${context.userId}::uuid`;
    const count = Number(counts[0]?.count ?? 0);
    await sql`INSERT INTO public.profile_skills (user_id,name,level,years,position) VALUES (${context.userId}::uuid, ${data.name}, ${data.level}, ${data.years ?? null}, ${count + 1})`;
    return { ok: true };
  });

export const addExperience = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({
    title: z.string().min(1), company: z.string().min(1), location: z.string().nullable().optional(),
    start_date: z.string(), end_date: z.string().nullable().optional(), is_current: z.boolean(), summary: z.string().nullable().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await sql`INSERT INTO public.work_experiences (user_id,title,company,location,start_date,end_date,is_current,summary)
      VALUES (${context.userId}::uuid, ${data.title}, ${data.company}, ${data.location ?? null}, ${data.start_date}::date, ${data.is_current ? null : (data.end_date ?? null)}::date, ${data.is_current}, ${data.summary ?? null})`;
    return { ok: true };
  });

export const addEducation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({
    school: z.string().min(1), qualification: z.string().nullable().optional(), field_of_study: z.string().nullable().optional(),
    start_year: z.number().nullable().optional(), end_year: z.number().nullable().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await sql`INSERT INTO public.education_entries (user_id,school,qualification,field_of_study,start_year,end_year)
      VALUES (${context.userId}::uuid, ${data.school}, ${data.qualification ?? null}, ${data.field_of_study ?? null}, ${data.start_year ?? null}, ${data.end_year ?? null})`;
    return { ok: true };
  });

export const addCertification = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({
    name: z.string().min(1), issuer: z.string().min(1), issue_date: z.string().nullable().optional(),
    expiry_date: z.string().nullable().optional(), credential_url: z.string().nullable().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await sql`INSERT INTO public.certifications (user_id,name,issuer,issue_date,expiry_date,credential_url)
      VALUES (${context.userId}::uuid, ${data.name}, ${data.issuer}, ${data.issue_date ?? null}::date, ${data.expiry_date ?? null}::date, ${data.credential_url ?? null})`;
    return { ok: true };
  });

export type DossierTable = "profile_skills" | "work_experiences" | "education_entries" | "certifications";
const ALLOWED_TABLES = new Set<DossierTable>(["profile_skills", "work_experiences", "education_entries", "certifications"]);

export const deleteDossierRow = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ table: z.enum(["profile_skills","work_experiences","education_entries","certifications"]), id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!ALLOWED_TABLES.has(data.table)) throw new Error("Invalid table");
    await sql.unsafe(`DELETE FROM public.${data.table} WHERE id = $1::uuid AND user_id = $2::uuid`, [data.id, context.userId] as any[]);
    return { ok: true };
  });

export const updateHourlyRate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ rate: z.number().nullable() }).parse(input))
  .handler(async ({ data, context }) => {
    await sql`UPDATE public.profiles SET hourly_rate = ${data.rate} WHERE id = ${context.userId}::uuid`;
    return { ok: true };
  });

export const announcePosition = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({
    title: z.string(), company: z.string(), summary: z.string().nullable().optional(), is_current: z.boolean(),
    share: z.boolean(), updateHeadline: z.boolean(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.updateHeadline) {
      await sql`UPDATE public.profiles SET headline = ${`${data.title} at ${data.company}`} WHERE id = ${context.userId}::uuid`;
    }
    if (data.share) {
      const lead = data.is_current
        ? `I'm happy to share that I'm starting a new position as ${data.title} at ${data.company}!`
        : `I've added a past role to my profile: ${data.title} at ${data.company}.`;
      const body = data.summary ? `${lead}\n\n${data.summary}` : lead;
      await sql`INSERT INTO public.posts (author_id, body, kind, visibility) VALUES (${context.userId}::uuid, ${body}, 'position', 'public')`;
    }
    return { ok: true };
  });

export const fetchPublicProfile = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const rows = await sql<any[]>`
      SELECT id,full_name,headline,bio,country,primary_skill,years_experience,languages,avatar_url,verified,hourly_rate,profile_strength,role
      FROM public.profiles WHERE id = ${data.id}::uuid LIMIT 1
    `;
    return rows[0] ?? null;
  });

export const fetchPortfolioItems = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    return await sql<any[]>`
      SELECT id,title,category,link_url,image_url
      FROM public.portfolio_items WHERE user_id = ${data.userId}::uuid
      ORDER BY created_at DESC
    `;
  });
