import { createServerFn } from "@tanstack/react-start";

import { sql } from "@/lib/db.server";
import type { Opportunity } from "@/lib/afrixa";

export const listFeedOpportunities = createServerFn({ method: "GET" }).handler(async (): Promise<Opportunity[]> => {
  const rows = await sql<any[]>`SELECT * FROM public.opportunities ORDER BY created_at DESC LIMIT 20`;
  return rows as Opportunity[];
});
