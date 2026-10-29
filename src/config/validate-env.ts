import type { Env } from "./env";

export function validateEnv(env: Env) {
  const required = [
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
    "FRONTEND_ORIGIN",
  ] as const;

  for (const key of required) {
    if (!env[key]) {
      throw new Error(`Missing environment variable ${key}`);
    }
  }
}
