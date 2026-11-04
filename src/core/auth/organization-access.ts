import type { AppSupabaseClient } from "../../types/supabase";
import { type OrganizationRole, isOrganizationRole } from "./roles";

export type OrganizationAccess = {
  organizationId: string;
  role: OrganizationRole;
};

export async function getOrganizationAccess(
  supabase: AppSupabaseClient,
  userId: string,
): Promise<OrganizationAccess | null> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .limit(1)
    .single();

  if (error || !data || !isOrganizationRole(data.role)) {
    return null;
  }

  return { organizationId: data.organization_id, role: data.role };
}

export async function isOrganizationMember(
  supabase: AppSupabaseClient,
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || data == null) {
    return false;
  }

  return true;
}
