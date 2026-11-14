import { createServerFn } from "@tanstack/react-start";

import { sql } from "@/lib/db.server";

export type LandingOpportunity = {
  id: string;
  title: string;
  company: string | null;
  country: string | null;
  kind: string;
  budget: string;
};

/**
 * Public preview of open work for the landing page. Returns an empty list
 * instead of failing so the marketing page still renders if the database is
 * unreachable.
 */
export const getLandingOpportunities = createServerFn({ method: "GET" }).handler(
  async (): Promise<LandingOpportunity[]> => {
    try {
      const rows = await sql<
        {
          id: string;
          title: string;
          company: string | null;
          country: string | null;
          category: string | null;
          job_type: string | null;
          currency: string | null;
          budget_min: number | null;
          budget_max: number | null;
          price_from: number | null;
        }[]
      >`
        SELECT id::text AS id, title, company, country, category, job_type, currency,
               budget_min, budget_max, price_from
        FROM public.opportunities
        WHERE status = 'open'
        ORDER BY created_at DESC
        LIMIT 5
      `;

      return rows.map((row) => {
        const currency = row.currency ?? "USD";
        const range =
          row.price_from != null
            ? `from ${money(row.price_from, currency)}`
            : row.budget_min != null && row.budget_max != null
              ? `${money(row.budget_min, currency)} to ${money(row.budget_max, currency)}`
              : "Rate on request";

        return {
          id: row.id,
          title: row.title,
          company: row.company,
          country: row.country,
          kind: row.category === "gig" ? "Gig" : (row.job_type ?? "Role"),
          budget: range,
        };
      });
    } catch {
      return [];
    }
  },
);

function money(amount: number, currency: string) {
  const value = Number(amount);
  const symbol = currency === "USD" ? "$" : currency === "NGN" ? "NGN " : `${currency} `;
  return `${symbol}${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
