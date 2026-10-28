import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createLead,
  getLeadById,
  getLeads,
  getUserOrganization,
  updateLead,
  deleteLead,
} from "./leads.repository";
import type { CreateLeadInput } from "./lead.schema";
import type { UpdateLeadInput } from "./lead.schema";

export async function listLeads(supabase: SupabaseClient) {
  return getLeads(supabase);
}

export async function findLeadById(supabase: SupabaseClient, leadId: string) {
  return getLeadById(supabase, leadId);
}

export async function addLead(
  supabase: SupabaseClient,
  input: CreateLeadInput,
) {
  const { data: membership, error: membershipError } =
    await getUserOrganization(supabase);

  if (membershipError || !membership) {
    return {
      data: null,
      error: new Error("User does not belong to an organization!"),
    };
  }

  return createLead(supabase, membership.organization_id, input);
}

export async function editLead(
  supabase: SupabaseClient,
  leadId: string,
  input: UpdateLeadInput,
) {
  return updateLead(supabase, leadId, input);
}

export async function removeLead(supabase: SupabaseClient, leadId: string) {
  return deleteLead(supabase, leadId);
}
