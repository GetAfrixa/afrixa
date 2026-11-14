/**
 * Direct PostgreSQL connection for the app (replaces Supabase data access).
 * Server-only: never import from client modules.
 */
import postgres from "postgres";

const url = process.env["DATABASE_URL"];
if (!url && process.env["NODE_ENV"] === "production") {
  throw new Error("DATABASE_URL is required in production");
}

let _sql: ReturnType<typeof postgres> | undefined;

export function getSql() {
  if (!_sql) {
    if (!url) throw new Error("DATABASE_URL is not set");
    _sql = postgres(url, { max: 10, idle_timeout: 20, connect_timeout: 10 });
  }
  return _sql;
}

/** Tagged-template SQL client (postgres.js). */
export const sql = new Proxy((() => undefined) as unknown as ReturnType<typeof postgres>, {
  apply(_target, _this, args) {
    return (getSql() as any)(...args);
  },
  get(_target, prop) {
    return (getSql() as any)[prop];
  },
});
