import {
  createLead,
  getLeadById,
  getLeads,
  updateLead,
  deleteLead,
} from "./leads.repository";
import type { CreateLeadInput } from "./lead.schema";
import type { UpdateLeadInput } from "./lead.schema";
import { AppError } from "../../core/errors/app-error";
import type { AppSupabaseClient } from "../../types/supabase";
import { ListLeadsQuery } from "./lead.schema";
import { OrganizationRole } from "../../core/auth/roles";
import { assignLead } from "./leads.repository";
import { isOrganizationMember } from "../../core/auth/organization-access";
import { isValidStatusTransition } from "./lead-lifecycle";
import { leadStatusSchema } from "./lead.schema";
import { getLeadActivities } from "./lead-activities.repository";

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
  organizationId: string,
  userId: string,
  role: OrganizationRole,
  input: CreateLeadInput,
) {
  const assignedTo = role === "staff" ? userId : null;

  const { data, error } = await createLead(
    supabase,
    organizationId,
    assignedTo,
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
  let expectedStatus: string | undefined;

  if (input.status !== undefined) {
    const currentLead = await findLeadById(supabase, leadId);

    const currentStatus = leadStatusSchema.parse(currentLead.status);

    if (!isValidStatusTransition(currentStatus, input.status)) {
      throw new AppError(
        "INVALID_STATUS_TRANSITION",
        409,
        `Cannot change lead status from ${currentStatus} to ${input.status}`,
      );
    }

    expectedStatus = currentStatus;
  }

  const { data, error } = await updateLead(
    supabase,
    leadId,
    input,
    expectedStatus,
  );

  if (error) {
    if (
      error.code === "23514" &&
      error.message.includes("Invalid lead status transition:")
    ) {
      throw new AppError(
        "INVALID_STATUS_TRANSITION",
        409,
        "The requested lead status change is not allowed",
      );
    }

    throw new AppError("LEAD_UPDATE_FAILED", 500, "Failed to update lead");
  }

  if (!data) {
    if (expectedStatus !== undefined) {
      throw new AppError(
        "LEAD_STATUS_CONFLICT",
        409,
        "Lead may have changed. Refresh and try again.",
      );
    }

    throw new AppError("LEAD_NOT_FOUND", 404, "Lead not found");
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

export async function assignLeadToUser(
  supabase: AppSupabaseClient,
  organizationId: string,
  leadId: string,
  assignedTo: string | null,
) {
  if (assignedTo !== null) {
    const isMember = await isOrganizationMember(
      supabase,
      organizationId,
      assignedTo,
    );

    if (!isMember) {
      throw new AppError(
        "INVALID_ASSIGNEE",
        400,
        "Assigned user does not belong to this organization!",
      );
    }
  }

  const { data, error } = await assignLead(supabase, leadId, assignedTo);

  if (error) {
    throw new AppError("LEAD_ASSIGNMENT_FAILED", 500, "Failed to assign lead!");
  }

  if (!data) {
    throw new AppError("LEAD_NOT_FOUND", 404, "Lead not found!");
  }

  return data;
}

export async function listLeadActivities(
  supabase: AppSupabaseClient,
  leadId: string,
) {
  // Ensure the user can access this lead
  await findLeadById(supabase, leadId);

  const { data, error } = await getLeadActivities(supabase, leadId);

  if (error) {
    throw new AppError(
      "LEAD_ACTIVITIES_FETCH_FAILED",
      500,
      "Failed to fetch lead activities",
    );
  }

  return data;
}
