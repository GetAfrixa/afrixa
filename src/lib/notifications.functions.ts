import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth } from "@/lib/pg-auth-middleware";
import { sql } from "@/lib/db.server";

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<Notification[]> => {
    return await sql<Notification[]>`
      SELECT id,type,title,body,link,read_at::text AS read_at,created_at::text AS created_at
      FROM public.notifications
      WHERE user_id = ${context.userId}::uuid
      ORDER BY created_at DESC
      LIMIT 50
    `;
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await sql`
      UPDATE public.notifications SET read_at = now()
      WHERE user_id = ${context.userId}::uuid AND read_at IS NULL
    `;
    return { ok: true };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await sql`
      UPDATE public.notifications SET read_at = now()
      WHERE id = ${data.id}::uuid AND user_id = ${context.userId}::uuid
    `;
    return { ok: true };
  });
