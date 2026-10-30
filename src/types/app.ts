import type { Env } from "../config/env";
import { AppSupabaseClient } from "./supabase";
import type { OrganizationRole } from "../core/auth/roles";

export type AppEnv = {
  Bindings: Env;
  Variables: {
    userId: string;
    supabase: AppSupabaseClient;
    requestId: string;
    organizationId: string;
    organizationRole: OrganizationRole;
  };
};
