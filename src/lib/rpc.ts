import { sql } from "@/lib/db.server";

/**
 * Calls a Postgres function directly (replaces Supabase RPC).
 * Uses named arguments: SELECT public.fn(p_arg => $1, ...)
 */
export async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const entries = Object.entries(args);
  if (entries.length === 0) {
    const rows = await sql.unsafe(`SELECT public.${name}() AS result`);
    return (rows[0] as { result: T } | undefined)?.result as T;
  }
  const keys = entries.map(([k]) => k);
  const values = entries.map(([, v]) => v);
  const params = keys.map((k, i) => `${k} => $${i + 1}`).join(", ");
  const rows = await sql.unsafe(`SELECT public.${name}(${params}) AS result`, values as any[]);
  return (rows[0] as { result: T } | undefined)?.result as T;
}
