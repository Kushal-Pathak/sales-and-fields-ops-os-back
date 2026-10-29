import { createClient } from "@supabase/supabase-js";
import { Env } from "../../config/env";
import type { Database } from "../../types/database";

export function createSupabaseClient(env: Env) {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
