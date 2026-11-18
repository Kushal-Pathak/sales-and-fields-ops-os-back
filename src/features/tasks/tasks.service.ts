import { AppError } from "../../core/errors/app-error";
import type { AppSupabaseClient } from "../../types/supabase";
import type { CreateTaskInput, ListTasksQuery } from "./tasks.schema";
import {
  getTaskAssignee,
  getTaskById,
  getTaskLead,
  getTasks,
  insertTask,
} from "./tasks.repository";
import { POSTGRES_ERROR_CODES } from "../../platform/database/postgres-errors";

export async function listTasks(
  supabase: AppSupabaseClient,
  organizationId: string,
  query: ListTasksQuery,
) {
  const { data, count, error } = await getTasks(
    supabase,
    organizationId,
    query,
  );

  if (error || data === null || count === null) {
    throw new AppError("TASKS_FETCH_FAILED", 500, "Failed to fetch tasks");
  }

  return { data, count };
}

export async function findTaskById(
  supabase: AppSupabaseClient,
  organizationId: string,
  taskId: string,
) {
  const { data, error } = await getTaskById(supabase, organizationId, taskId);

  if (error) {
    throw new AppError("TASK_FETCH_FAILED", 500, "Failed to fetch task");
  }

  if (!data) {
    // The same response covers absent, cross-organization, and RLS-hidden tasks.
    throw new AppError("TASK_NOT_FOUND", 404, "Task not found");
  }

  return data;
}

export async function createTask(
  supabase: AppSupabaseClient,
  organizationId: string,
  input: CreateTaskInput,
) {
  // Verify the assignee belongs to this organization.
  if (input.assigned_to) {
    const { data, error } = await getTaskAssignee(
      supabase,
      organizationId,
      input.assigned_to,
    );

    if (error) {
      throw new AppError("TASK_CREATE_FAILED", 500, "Failed to create task");
    }

    if (!data) {
      throw new AppError(
        "INVALID_ASSIGNEE",
        400,
        "Assignee must belong to this organization",
      );
    }
  }

  // Verify the linked lead belongs to this organization.
  if (input.lead_id) {
    const { data, error } = await getTaskLead(
      supabase,
      organizationId,
      input.lead_id,
    );

    if (error) {
      throw new AppError("TASK_CREATE_FAILED", 500, "Failed to create task");
    }

    if (!data) {
      throw new AppError(
        "INVALID_LEAD",
        400,
        "Lead does not belong to this organization or does not exist",
      );
    }
  }

  const { data, error } = await insertTask(supabase, organizationId, input);

  if (error) {
    // Handle references that change between validation and insertion.
    if (error.code === POSTGRES_ERROR_CODES.FOREIGN_KEY_VIOLATION) {
      if (error.message?.includes("tasks_assignee_membership_fk")) {
        throw new AppError(
          "INVALID_ASSIGNEE",
          409,
          "Assignee is no longer a member of this organization",
        );
      }

      if (error.message?.includes("tasks_organization_lead_fk")) {
        throw new AppError(
          "INVALID_LEAD",
          409,
          "Linked lead is no longer valid",
        );
      }
    }

    throw new AppError("TASK_CREATE_FAILED", 500, "Failed to create task");
  }

  if (!data) {
    throw new AppError("TASK_CREATE_FAILED", 500, "Failed to create task");
  }

  return data;
}
