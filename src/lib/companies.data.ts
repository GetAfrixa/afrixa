import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { sql } from "@/lib/db.server";
import { requireAuth } from "@/lib/pg-auth-middleware";
import { getAuthUser } from "@/lib/auth.server";
import type { Opportunity } from "@/lib/afrixa";

export type Company = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  tagline: string | null;
  about: string | null;
  industry: string | null;
  location: string | null;
  website: string | null;
  company_size: string | null;
  logo_url: string | null;
  cover_url: string | null;
  created_at: string;
};

export type CompanyInput = {
  name: string;
  tagline: string;
  about: string;
  industry: string;
  location: string;
  website: string;
  company_size: string;
  logo_url: string | null;
  cover_url: string | null;
};

export const INDUSTRIES = [
  "Technology", "Design & Creative", "Finance & Fintech", "Media & Entertainment",
  "Health", "Education", "Agriculture", "Logistics", "Energy", "Non-profit", "Other",
] as const;

export const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"] as const;

export function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}

function toCompany(row: any): Company {
  return row as Company;
}

export const fetchCompanies = createServerFn({ method: "GET" }).handler(async (): Promise<Company[]> => {
  const rows = await sql<any[]>`
    SELECT id,owner_id,name,slug,tagline,about,industry,location,website,company_size,logo_url,cover_url,created_at
    FROM public.companies ORDER BY created_at DESC LIMIT 120
  `;
  return rows.map(toCompany);
});

export const fetchCompanyBySlug = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(async ({ data }): Promise<Company | null> => {
    const rows = await sql<any[]>`
      SELECT id,owner_id,name,slug,tagline,about,industry,location,website,company_size,logo_url,cover_url,created_at
      FROM public.companies WHERE slug = ${data.slug} LIMIT 1
    `;
    return rows[0] ? toCompany(rows[0]) : null;
  });

export const fetchMyCompany = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<Company | null> => {
    const rows = await sql<any[]>`
      SELECT id,owner_id,name,slug,tagline,about,industry,location,website,company_size,logo_url,cover_url,created_at
      FROM public.companies WHERE owner_id = ${context.userId}::uuid
      ORDER BY created_at ASC LIMIT 1
    `;
    return rows[0] ? toCompany(rows[0]) : null;
  });

export const fetchCompanyJobs = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ companyId: z.string().uuid(), companyName: z.string() }).parse(input))
  .handler(async ({ data }): Promise<Opportunity[]> => {
    const [byId, byName] = await Promise.all([
      sql<any[]>`SELECT * FROM public.opportunities WHERE company_id = ${data.companyId}::uuid ORDER BY created_at DESC LIMIT 40`,
      sql<any[]>`SELECT * FROM public.opportunities WHERE company = ${data.companyName} ORDER BY created_at DESC LIMIT 40`,
    ]);
    const merged = new Map<string, Opportunity>();
    for (const row of [...byId, ...byName] as Opportunity[]) merged.set(row.id, row);
    return [...merged.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 40);
  });

async function uniqueSlug(base: string, ignoreId?: string) {
  const root = base || "company";
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = attempt === 0 ? root : `${root}-${attempt + 1}`;
    const rows = ignoreId
      ? await sql<any[]>`SELECT id FROM public.companies WHERE slug = ${candidate} AND id <> ${ignoreId}::uuid LIMIT 1`
      : await sql<any[]>`SELECT id FROM public.companies WHERE slug = ${candidate} LIMIT 1`;
    if (!rows[0]) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

const companyInputSchema = z.object({
  name: z.string().trim().min(1),
  tagline: z.string().optional().default(""),
  about: z.string().optional().default(""),
  industry: z.string().optional().default(""),
  location: z.string().optional().default(""),
  website: z.string().optional().default(""),
  company_size: z.string().optional().default(""),
  logo_url: z.string().nullable().optional(),
  cover_url: z.string().nullable().optional(),
});

function payload(input: z.infer<typeof companyInputSchema>) {
  return {
    name: input.name.trim(),
    tagline: input.tagline?.trim() || null,
    about: input.about?.trim() || null,
    industry: input.industry || null,
    location: input.location?.trim() || null,
    website: input.website?.trim() || null,
    company_size: input.company_size || null,
    logo_url: input.logo_url ?? null,
    cover_url: input.cover_url ?? null,
  };
}

export const createCompany = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => companyInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<Company> => {
    const slug = await uniqueSlug(slugify(data.name));
    const p = payload(data);
    const rows = await sql<any[]>`
      INSERT INTO public.companies (owner_id, name, slug, tagline, about, industry, location, website, company_size, logo_url, cover_url)
      VALUES (${context.userId}::uuid, ${p.name}, ${slug}, ${p.tagline}, ${p.about}, ${p.industry}, ${p.location}, ${p.website}, ${p.company_size}, ${p.logo_url}, ${p.cover_url})
      RETURNING id,owner_id,name,slug,tagline,about,industry,location,website,company_size,logo_url,cover_url,created_at
    `;
    return toCompany(rows[0]);
  });

export const updateCompany = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid(), data: companyInputSchema }).parse(input))
  .handler(async ({ data, context }): Promise<Company> => {
    const existing = await sql<any[]>`SELECT id, owner_id, slug FROM public.companies WHERE id = ${data.id}::uuid LIMIT 1`;
    const company = existing[0];
    if (!company || company.owner_id !== context.userId) throw new Error("Forbidden");
    const input = data.data;
    const nextSlug = slugify(input.name) && slugify(input.name) !== company.slug
      ? await uniqueSlug(slugify(input.name), company.id)
      : company.slug;
    const p = payload(input);
    const rows = await sql<any[]>`
      UPDATE public.companies SET
        name=${p.name}, slug=${nextSlug}, tagline=${p.tagline}, about=${p.about}, industry=${p.industry},
        location=${p.location}, website=${p.website}, company_size=${p.company_size}, logo_url=${p.logo_url}, cover_url=${p.cover_url}
      WHERE id = ${data.id}::uuid
      RETURNING id,owner_id,name,slug,tagline,about,industry,location,website,company_size,logo_url,cover_url,created_at
    `;
    return toCompany(rows[0]);
  });
