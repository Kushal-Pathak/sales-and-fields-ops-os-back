import type { CreateLeadInput, UpdateLeadInput } from "./lead.schema";
import type { AppSupabaseClient } from "../../types/supabase";
import type { ListLeadsQuery } from "./lead.schema";
import { UUID } from "node:crypto";

export async function getLeads(
  supabase: AppSupabaseClient,
  query: ListLeadsQuery,
) {
  const from = (query.page - 1) * query.limit;
  const to = from + query.limit - 1;

  let countQuery = supabase
    .from("leads")
    .select("*", { count: "exact", head: true });

  if (query.status) {
    countQuery = countQuery.eq("status", query.status);
  }

  if (query.search) {
    const pattern = `%${query.search}%`;

    countQuery = countQuery.or(
      `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`,
    );
  }

  const { count, error: countError } = await countQuery;

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

  let dataQuery = supabase.from("leads").select("*");

  if (query.status) {
    dataQuery = dataQuery.eq("status", query.status);
  }

  if (query.search) {
    const pattern = `%${query.search}%`;

    dataQuery = dataQuery.or(
      `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`,
    );
  }

  dataQuery = dataQuery.order(query.sortBy, {
    ascending: query.sortOrder === "asc",
  });

  const { data, error } = await dataQuery.range(from, to);

  return { data, count, error };
}

export async function getLeadById(supabase: AppSupabaseClient, leadId: string) {
  return supabase.from("leads").select("*").eq("id", leadId).single();
}

export async function createLead(
  supabase: AppSupabaseClient,
  organizationId: string,
  assignedTo: string | null,
  input: CreateLeadInput,
) {
  return supabase
    .from("leads")
    .insert({
      ...input,
      organization_id: organizationId,
      assigned_to: assignedTo,
    })
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

export async function assignLead(
  supabase: AppSupabaseClient,
  leadId: string,
  assignedTo: string | null,
) {
  return supabase
    .from("leads")
    .update({ assigned_to: assignedTo })
    .eq("id", leadId)
    .select()
    .single();
}
