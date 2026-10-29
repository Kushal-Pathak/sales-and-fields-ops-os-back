import type { Env } from "../config/env";
import { AppSupabaseClient } from "./supabase";

export type AppEnv = {
  Bindings: Env;
  Variables: {
    userId: string;
    supabase: AppSupabaseClient;
    requestId: string;
  };
};
