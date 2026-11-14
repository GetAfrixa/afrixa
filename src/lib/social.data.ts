import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { sql } from "@/lib/db.server";
import { requireAuth } from "@/lib/pg-auth-middleware";

import type {
  Connection,
  FeedPost,
  Post,
  PostAuthor,
  PostComment,
  ReactionKind,
} from "@/lib/social";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: string) {
  return UUID_RE.test(value);
}

async function fetchAuthors(ids: string[]): Promise<Map<string, PostAuthor>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return new Map();
  const rows = await sql<any[]>`
    SELECT id,full_name,headline,avatar_url,primary_skill,verified,role
    FROM public.profiles WHERE id = ANY(${unique}::uuid[])
  `;
  return new Map(rows.map((row) => [row.id, row as PostAuthor]));
}

function safeTerm(term: string) {
  return term.trim().replace(/[,()"\\%*]/g, " ").replace(/\s+/g, " ").slice(0, 80);
}

async function networkIds(userId: string): Promise<string[]> {
  const [conns, follows] = await Promise.all([
    sql<any[]>`
      SELECT requester_id, addressee_id FROM public.connections
      WHERE status = 'accepted' AND (requester_id = ${userId}::uuid OR addressee_id = ${userId}::uuid)
    `,
    sql<any[]>`SELECT following_id FROM public.follows WHERE follower_id = ${userId}::uuid`,
  ]);
  const ids = new Set<string>([userId]);
  for (const row of conns) ids.add(row.requester_id === userId ? row.addressee_id : row.requester_id);
  for (const row of follows) ids.add(row.following_id);
  return [...ids];
}

export const fetchFeed = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ userId: z.string().uuid().optional(), authorId: z.string().uuid().optional() }).parse(input))
  .handler(async ({ data }): Promise<FeedPost[]> => {
    const { userId, authorId } = data;
    let posts: Post[] = [];
    if (authorId) {
      posts = await sql<Post[]>`SELECT * FROM public.posts WHERE author_id = ${authorId}::uuid ORDER BY created_at DESC LIMIT 40`;
    } else if (userId) {
      const ids = await networkIds(userId);
      posts = ids.length
        ? await sql<Post[]>`SELECT * FROM public.posts WHERE author_id = ANY(${ids}::uuid[]) ORDER BY created_at DESC LIMIT 40`
        : [];
    } else {
      posts = await sql<Post[]>`SELECT * FROM public.posts WHERE visibility = 'public' ORDER BY created_at DESC LIMIT 40`;
    }
    if (posts.length === 0) return [];
    const authors = await fetchAuthors(posts.map((p) => p.author_id));
    let mine = new Map<string, ReactionKind>();
    if (userId) {
      const reactions = await sql<any[]>`
        SELECT post_id, reaction FROM public.post_reactions
        WHERE user_id = ${userId}::uuid AND post_id = ANY(${posts.map((p) => p.id)}::uuid[])
      `;
      mine = new Map(reactions.map((row) => [row.post_id, row.reaction as ReactionKind]));
    }
    return posts.map((post) => ({ ...post, author: authors.get(post.author_id) ?? null, myReaction: mine.get(post.id) ?? null }));
  });

export const fetchComments = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ postId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<PostComment[]> => {
    const rows = await sql<any[]>`SELECT * FROM public.post_comments WHERE post_id = ${data.postId}::uuid ORDER BY created_at ASC`;
    const authors = await fetchAuthors(rows.map((row) => row.author_id));
    return rows.map((row) => ({ ...row, author: authors.get(row.author_id) ?? null }));
  });

export const setReaction = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ postId: z.string().uuid(), reaction: z.string(), current: z.string().nullable() }).parse(input))
  .handler(async ({ data, context }) => {
    const { postId, reaction, current } = data as { postId: string; reaction: ReactionKind; current: ReactionKind | null };
    if (current === reaction) {
      await sql`DELETE FROM public.post_reactions WHERE post_id = ${postId}::uuid AND user_id = ${context.userId}::uuid`;
      return null;
    }
    if (current) {
      await sql`UPDATE public.post_reactions SET reaction = ${reaction} WHERE post_id = ${postId}::uuid AND user_id = ${context.userId}::uuid`;
      return reaction;
    }
    await sql`INSERT INTO public.post_reactions (post_id, user_id, reaction) VALUES (${postId}::uuid, ${context.userId}::uuid, ${reaction})`;
    return reaction;
  });

export type NetworkData = {
  incoming: (Connection & { person: PostAuthor | null })[];
  outgoing: (Connection & { person: PostAuthor | null })[];
  connected: (Connection & { person: PostAuthor | null })[];
};

export const fetchNetwork = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<NetworkData> => {
    const userId = context.userId;
    const rows = await sql<Connection[]>`
      SELECT * FROM public.connections
      WHERE requester_id = ${userId}::uuid OR addressee_id = ${userId}::uuid
      ORDER BY created_at DESC
    `;
    const otherId = (row: Connection) => (row.requester_id === userId ? row.addressee_id : row.requester_id);
    const authors = await fetchAuthors(rows.map(otherId));
    const withPerson = rows.map((row) => ({ ...row, person: authors.get(otherId(row)) ?? null }));
    return {
      incoming: withPerson.filter((r) => r.status === "pending" && r.addressee_id === userId),
      outgoing: withPerson.filter((r) => r.status === "pending" && r.requester_id === userId),
      connected: withPerson.filter((r) => r.status === "accepted"),
    };
  });

export const requestConnection = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ addresseeId: z.string().uuid(), message: z.string().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    await sql`INSERT INTO public.connections (requester_id, addressee_id, message) VALUES (${context.userId}::uuid, ${data.addresseeId}::uuid, ${data.message ?? null})`;
    return { ok: true };
  });

export const respondToConnection = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid(), status: z.enum(["accepted","declined"]) }).parse(input))
  .handler(async ({ data, context }) => {
    // ensure user is addressee
    await sql`UPDATE public.connections SET status = ${data.status}, updated_at = now() WHERE id = ${data.id}::uuid AND addressee_id = ${context.userId}::uuid`;
    return { ok: true };
  });

export type PersonSuggestion = PostAuthor & {
  country: string | null;
  connection: "none" | "pending" | "connected";
  following: boolean;
};

export const fetchPeople = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ term: z.string().optional().default("") }).parse(input))
  .handler(async ({ data, context }): Promise<PersonSuggestion[]> => {
    const userId = context.userId;
    const clean = safeTerm(data.term || "");
    let people: any[] = [];
    if (clean) {
      const like = `%${clean}%`;
      people = await sql<any[]>`
        SELECT id,full_name,headline,avatar_url,primary_skill,verified,role,country
        FROM public.profiles
        WHERE id <> ${userId}::uuid
          AND (full_name ILIKE ${like} OR headline ILIKE ${like} OR primary_skill ILIKE ${like})
        LIMIT 40
      `;
    } else {
      people = await sql<any[]>`
        SELECT id,full_name,headline,avatar_url,primary_skill,verified,role,country
        FROM public.profiles WHERE id <> ${userId}::uuid LIMIT 40
      `;
    }
    if (people.length === 0) return [];

    const [conns, follows] = await Promise.all([
      sql<any[]>`SELECT requester_id,addressee_id,status FROM public.connections WHERE requester_id = ${userId}::uuid OR addressee_id = ${userId}::uuid`,
      sql<any[]>`SELECT following_id FROM public.follows WHERE follower_id = ${userId}::uuid`,
    ]);
    const connState = new Map<string, "pending" | "connected">();
    for (const row of conns) {
      if (row.requester_id !== userId && row.addressee_id !== userId) continue;
      const other = row.requester_id === userId ? row.addressee_id : row.requester_id;
      if (row.status === "accepted") connState.set(other, "connected");
      else if (row.status === "pending" && !connState.has(other)) connState.set(other, "pending");
    }
    const followSet = new Set(follows.map((row) => row.following_id));
    return people.map((person) => ({ ...person, connection: connState.get(person.id) ?? "none", following: followSet.has(person.id) }));
  });

export const toggleFollow = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ targetId: z.string().uuid(), following: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.following) {
      await sql`DELETE FROM public.follows WHERE follower_id = ${context.userId}::uuid AND following_id = ${data.targetId}::uuid`;
      return false;
    }
    await sql`INSERT INTO public.follows (follower_id, following_id) VALUES (${context.userId}::uuid, ${data.targetId}::uuid) ON CONFLICT DO NOTHING`;
    return true;
  });

export const openDirectConversation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ otherId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<string> => {
    const userId = context.userId;
    const otherId = data.otherId;
    if (!isUuid(userId) || !isUuid(otherId)) throw new Error("Invalid member");
    const rows = await sql<any[]>`
      SELECT id FROM public.conversations
      WHERE (participant_a = ${userId}::uuid AND participant_b = ${otherId}::uuid)
         OR (participant_a = ${otherId}::uuid AND participant_b = ${userId}::uuid)
      LIMIT 1
    `;
    if (rows[0]?.id) return rows[0].id;
    const created = await sql<any[]>`
      INSERT INTO public.conversations (participant_a, participant_b)
      VALUES (${userId}::uuid, ${otherId}::uuid)
      RETURNING id
    `;
    return created[0].id as string;
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ postId: z.string().uuid(), body: z.string().min(1).max(2000) }).parse(input))
  .handler(async ({ data, context }) => {
    await sql`INSERT INTO public.post_comments (post_id, author_id, body) VALUES (${data.postId}::uuid, ${context.userId}::uuid, ${data.body.trim()})`;
    await sql`UPDATE public.posts SET comment_count = comment_count + 1 WHERE id = ${data.postId}::uuid`;
    return { ok: true };
  });

export const addReply = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ postId: z.string().uuid(), body: z.string().min(1).max(2000), parentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await sql`INSERT INTO public.post_comments (post_id, author_id, body, parent_id) VALUES (${data.postId}::uuid, ${context.userId}::uuid, ${data.body.trim()}, ${data.parentId}::uuid)`;
    await sql`UPDATE public.posts SET comment_count = comment_count + 1 WHERE id = ${data.postId}::uuid`;
    return { ok: true };
  });

export const deletePost = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ postId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await sql`DELETE FROM public.posts WHERE id = ${data.postId}::uuid AND author_id = ${context.userId}::uuid`;
    return { ok: true };
  });

export const getConnectionStatus = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ otherId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const rows = await sql<any[]>`
      SELECT id, status, requester_id FROM public.connections
      WHERE (requester_id = ${userId}::uuid AND addressee_id = ${data.otherId}::uuid)
         OR (requester_id = ${data.otherId}::uuid AND addressee_id = ${userId}::uuid)
      LIMIT 1
    `;
    return rows[0] ?? null;
  });
