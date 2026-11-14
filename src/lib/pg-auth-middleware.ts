import { createMiddleware } from "@tanstack/react-start";
import { getAuthUser } from "@/lib/auth.server";
import { sql } from "@/lib/db.server";

export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");
  return next({
    context: {
      sql,
      userId: user.id,
      user,
    },
  });
});
