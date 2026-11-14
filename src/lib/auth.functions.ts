import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { sql } from "@/lib/db.server";
import {
  createSession,
  destroySession,
  getAuthUser,
  hashPassword,
  verifyPassword,
} from "@/lib/auth.server";

export type SessionProfile = {
  id: string;
  role: "talent" | "client" | null;
  full_name: string;
  business_name: string | null;
  country: string | null;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  primary_skill: string | null;
  years_experience: string | null;
  languages: string[];
  client_type: string | null;
  onboarding_complete: boolean;
  profile_strength: number;
  verified: boolean;
  total_earned: number;
  hourly_rate: number | null;
  discoverable: boolean;
  wallet_balance: number;
  wallet_currency: string;
};

export type SessionInfo = {
  user: { id: string; email: string } | null;
  profile: SessionProfile | null;
};

export const getSessionInfo = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionInfo> => {
    const user = await getAuthUser();
    if (!user) return { user: null, profile: null };
    const rows = await sql<any[]>`
      SELECT id, role, full_name, business_name, country, avatar_url, headline, bio,
             primary_skill, years_experience, languages, client_type, onboarding_complete,
             profile_strength, verified, total_earned, hourly_rate, discoverable,
             wallet_balance, wallet_currency
      FROM public.profiles
      WHERE id = ${user.id}::uuid
      LIMIT 1
    `;
    const p = rows[0];
    if (!p) return { user, profile: null };
    return {
      user,
      profile: {
        ...p,
        languages: p.languages ?? [],
        onboarding_complete: Boolean(p.onboarding_complete),
        verified: Boolean(p.verified),
        discoverable: p.discoverable ?? true,
        total_earned: Number(p.total_earned ?? 0),
        profile_strength: Number(p.profile_strength ?? 20),
        hourly_rate: p.hourly_rate == null ? null : Number(p.hourly_rate),
        wallet_balance: Number(p.wallet_balance ?? 0),
      } as SessionProfile,
    };
  },
);

const signUpInput = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().trim().min(1).max(120),
  role: z.enum(["talent", "client"]),
  country: z.string().trim().max(80).optional(),
});

export const signUp = createServerFn({ method: "POST" })
  .inputValidator((input) => signUpInput.parse(input))
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase().trim();
    const existing = await sql<{ id: string }[]>`
      SELECT id::text AS id FROM public.users WHERE email = ${email} LIMIT 1
    `;
    if (existing[0]) throw new Error("An account with this email already exists");

    const passwordHash = await hashPassword(data.password);
    const users = await sql<{ id: string }[]>`
      INSERT INTO public.users (email, password_hash)
      VALUES (${email}, ${passwordHash})
      RETURNING id::text AS id
    `;
    const userId = users[0]!.id;

    await sql`
      INSERT INTO public.profiles (id, full_name, role, country, onboarding_complete)
      VALUES (${userId}::uuid, ${data.fullName}, ${data.role}::public.app_user_role, ${data.country ?? null}, false)
      ON CONFLICT (id) DO NOTHING
    `;

    await createSession(userId);
    return { ok: true, userId };
  });

const signInInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const signIn = createServerFn({ method: "POST" })
  .inputValidator((input) => signInInput.parse(input))
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase().trim();
    const rows = await sql<{ id: string; password_hash: string }[]>`
      SELECT id::text AS id, password_hash FROM public.users WHERE email = ${email} LIMIT 1
    `;
    const user = rows[0];
    if (!user || !(await verifyPassword(data.password, user.password_hash))) {
      throw new Error("Invalid email or password");
    }
    await createSession(user.id);
    return { ok: true, userId: user.id };
  });

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  await destroySession();
  return { ok: true };
});
