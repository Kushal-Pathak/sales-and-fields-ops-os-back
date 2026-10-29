import { SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "../config/env";

export type AppEnv = {
  Bindings: Env;
  Variables: {
    userId: string;
    supabase: SupabaseClient;
    requestId: string;
  };
};
