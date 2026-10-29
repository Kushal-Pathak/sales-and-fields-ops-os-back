import { createMiddleware } from "hono/factory";
import { createSupabaseContext } from "@supabase/server";
import type { AppEnv } from "../types/app";
import { AppSupabaseClient } from "../types/supabase";

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const { data: auth, error } = await createSupabaseContext(c.req.raw, {
    auth: "user",
    env: {
      url: c.env.SUPABASE_URL,
      publishableKeys: {
        default: c.env.SUPABASE_PUBLISHABLE_KEY,
      },
      secretKeys: {
        default: c.env.SUPABASE_SECRET_KEY,
      },
    },
  });

  if (error || !auth.userClaims) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("userId", auth.userClaims.id);
  c.set("supabase", auth.supabase as AppSupabaseClient);
  await next();
});
