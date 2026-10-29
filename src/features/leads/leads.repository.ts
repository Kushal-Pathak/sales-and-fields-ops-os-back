import type { CreateLeadInput, UpdateLeadInput } from "./lead.schema";
import type { AppSupabaseClient } from "../../types/supabase";

export async function getLeads(supabase: AppSupabaseClient) {
  return supabase.from("leads").select("*");
}

export async function getLeadById(supabase: AppSupabaseClient, leadId: string) {
  return supabase.from("leads").select("*").eq("id", leadId).single();
}

export async function getUserOrganization(supabase: AppSupabaseClient) {
  return supabase
    .from("organization_members")
    .select("organization_id")
    .limit(1)
    .single();
}

export async function createLead(
  supabase: AppSupabaseClient,
  organizationId: string,
  input: CreateLeadInput,
) {
  return supabase
    .from("leads")
    .insert({ ...input, organization_id: organizationId })
    .select()
    .single();
}

export async function updateLead(
  supabase: AppSupabaseClient,
  leadId: string,
  input: UpdateLeadInput,
) {
  return supabase
    .from("leads")
    .update(input)
    .eq("id", leadId)
    .select()
    .single();
}

export async function deleteLead(supabase: AppSupabaseClient, leadId: string) {
  return supabase.from("leads").delete().eq("id", leadId).select().single();
}
