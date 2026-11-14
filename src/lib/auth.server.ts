import crypto from "node:crypto";
import { promisify } from "node:util";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { sql } from "@/lib/db.server";

const scrypt = promisify(crypto.scrypt);

export const SESSION_COOKIE = "afrixa_session";
const SESSION_DAYS = 30;

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  if (expected.length !== derived.length) return false;
  return crypto.timingSafeEqual(expected, derived);
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await sql`
    INSERT INTO public.sessions (user_id, token_hash, expires_at)
    VALUES (${userId}::uuid, ${tokenHash}, ${expiresAt.toISOString()}::timestamptz)
  `;
  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    expires: expiresAt,
  });
  return token;
}

export async function getSessionUserId(): Promise<string | null> {
  const token = getCookie(SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = hashToken(token);
  const rows = await sql<{ user_id: string; expires_at: string }[]>`
    SELECT user_id::text AS user_id, expires_at::text AS expires_at
    FROM public.sessions
    WHERE token_hash = ${tokenHash}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await sql`DELETE FROM public.sessions WHERE token_hash = ${tokenHash}`;
    deleteCookie(SESSION_COOKIE, { path: "/" });
    return null;
  }
  return row.user_id;
}

export async function destroySession() {
  const token = getCookie(SESSION_COOKIE);
  if (token) {
    const tokenHash = hashToken(token);
    await sql`DELETE FROM public.sessions WHERE token_hash = ${tokenHash}`;
  }
  deleteCookie(SESSION_COOKIE, { path: "/" });
}

export type AuthUser = { id: string; email: string };

export async function getAuthUser(): Promise<AuthUser | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const rows = await sql<{ id: string; email: string }[]>`
    SELECT id::text AS id, email FROM public.users WHERE id = ${userId}::uuid LIMIT 1
  `;
  return rows[0] ?? null;
}
