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
import { AppError } from "../../core/errors/app-error";
import type { AppSupabaseClient } from "../../types/supabase";
import { ListLeadsQuery } from "./lead.schema";

export async function listLeads(
  supabase: AppSupabaseClient,
  query: ListLeadsQuery,
) {
  const { data, count, error } = await getLeads(supabase, query);

  if (error || !data) {
    throw new AppError("LEADS_FETCH_FAILED", 500, "Failed to fetch leads!");
  }

  return { data, count };
}

export async function findLeadById(
  supabase: AppSupabaseClient,
  leadId: string,
) {
  const { data, error } = await getLeadById(supabase, leadId);

  if (error || !data) {
    throw new AppError("LEAD_NOT_FOUND", 404, "Lead not found!");
  }

  return data;
}

export async function addLead(
  supabase: AppSupabaseClient,
  input: CreateLeadInput,
) {
  const { data: membership, error: membershipError } =
    await getUserOrganization(supabase);

  if (membershipError || !membership) {
    throw new AppError(
      "ORGANIZATION_MEMBERSHIP_NOT_FOUND",
      403,
      "User does not belong to an organization!",
    );
  }

  const { data, error } = await createLead(
    supabase,
    membership.organization_id,
    input,
  );

  if (error || !data) {
    throw new AppError("LEAD_CREATE_FAILED", 500, "Failed to create lead!");
  }

  return data;
}

export async function editLead(
  supabase: AppSupabaseClient,
  leadId: string,
  input: UpdateLeadInput,
) {
  const { data, error } = await updateLead(supabase, leadId, input);

  if (error || !data) {
    throw new AppError(
      "LEAD_UPDATE_FAILED",
      404,
      "Lead not found or update failed!",
    );
  }

  return data;
}

export async function removeLead(supabase: AppSupabaseClient, leadId: string) {
  const { data, error } = await deleteLead(supabase, leadId);

  if (error || !data) {
    throw new AppError(
      "LEAD_DELETE_FAILED",
      404,
      "Lead not found or delete failed!",
    );
  }

  return data;
}
