import type { CreateLeadInput, UpdateLeadInput } from "./lead.schema";
import type { AppSupabaseClient } from "../../types/supabase";
import type { ListLeadsQuery } from "./lead.schema";

export async function getLeads(
  supabase: AppSupabaseClient,
  query: ListLeadsQuery,
) {
  const from = (query.page - 1) * query.limit;
  const to = from + query.limit - 1;

  const { count, error: countError } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true });

  if (countError) {
    return { data: null, count: null, error: countError };
  }

  if (count != null && from > count) {
    return {
      data: [],
      count,
      error: null,
    };
  }

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .range(from, to);
    
  return { data, count, error };
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
