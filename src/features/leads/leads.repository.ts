import { SupabaseClient } from "@supabase/supabase-js";
import type { CreateLeadInput, UpdateLeadInput } from "./lead.schema";

export async function getLeads(supabase: SupabaseClient) {
  return supabase.from("leads").select("*");
}

export async function getLeadById(supabase: SupabaseClient, leadId: string) {
  return supabase.from("leads").select("*").eq("id", leadId).single();
}

export async function getUserOrganization(supabase: SupabaseClient) {
  return supabase
    .from("organization_members")
    .select("organization_id")
    .limit(1)
    .single();
}

export async function createLead(
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
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

export async function deleteLead(supabase: SupabaseClient, leadId: string) {
  return supabase.from("leads").delete().eq("id", leadId).select().single();
}
