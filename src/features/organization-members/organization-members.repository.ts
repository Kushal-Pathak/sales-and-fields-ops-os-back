import { OrganizationRole } from "../../core/auth/roles";
import type { AppSupabaseClient } from "../../types/supabase";

export async function getOrganizationMembers(
  supabase: AppSupabaseClient,
  organizationId: string,
) {
  return supabase
    .from("organization_members")
    .select("user_id, role, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
}

export async function updateOrganizationMemberRole(
  supabase: AppSupabaseClient,
  organizationId: string,
  userId: string,
  role: OrganizationRole,
) {
  return supabase
    .from("organization_members")
    .update({ role })
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .select("user_id, role, created_at")
    .single();
}

export async function getOrganizationAdminCount(
  supabase: AppSupabaseClient,
  organizationId: string,
) {
  return supabase
    .from("organization_members")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("role", "admin");
}

export async function getOrganizationMember(
  supabase: AppSupabaseClient,
  organizationId: string,
  userId: string,
) {
  return supabase
    .from("organization_members")
    .select("user_id, role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
}
