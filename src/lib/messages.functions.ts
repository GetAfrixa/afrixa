import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth } from "@/lib/pg-auth-middleware";
import { rpc } from "@/lib/rpc";

export const markConversationRead = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ conversationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await rpc<void>("mark_conversation_read", {
      p_conversation_id: data.conversationId,
      p_user_id: context.userId,
    });
    return { ok: true };
  });
