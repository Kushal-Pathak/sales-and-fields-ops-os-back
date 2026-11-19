import { AppError } from "../../core/errors/app-error";
import type { AppSupabaseClient } from "../../types/supabase";
import {
  taskStatusSchema,
  type CreateTaskInput,
  type ListTasksQuery,
  type UpdateTaskStatusInput,
} from "./tasks.schema";
import {
  assignTask,
  deleteTask,
  getTaskAssignee,
  getTaskById,
  getTaskLead,
  getTasks,
  insertTask,
  updateTaskStatus,
} from "./tasks.repository";
import { POSTGRES_ERROR_CODES } from "../../platform/database/postgres-errors";
import { isValidTaskStatusTransition } from "./task-lifecycle";

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

export async function editTaskStatus(
  supabase: AppSupabaseClient,
  organizationId: string,
  taskId: string,
  input: UpdateTaskStatusInput,
) {
  // Check that the task exists and is accessible to the current user.
  const currentTask = await findTaskById(supabase, organizationId, taskId);

  const currentStatus = taskStatusSchema.parse(currentTask.status);

  // An unchanged status is a successful no-op.
  if (currentStatus === input.status) {
    return currentTask;
  }

  if (!isValidTaskStatusTransition(currentStatus, input.status)) {
    throw new AppError(
      "INVALID_STATUS_TRANSITION",
      409,
      `Cannot change task status from ${currentStatus} to ${input.status}`,
    );
  }

  // A completed task requires a completion timestamp.
  // All other states require that timestamp to be NULL.
  const update = {
    status: input.status,
    completed_at:
      input.status === "completed" ? new Date().toISOString() : null,
  };

  const { data, error } = await updateTaskStatus(
    supabase,
    organizationId,
    taskId,
    update,
    currentStatus,
  );

  if (error) {
    if (
      error.code === POSTGRES_ERROR_CODES.CHECK_VIOLATION &&
      error.message.includes("Invalid task status transition:")
    ) {
      throw new AppError(
        "INVALID_STATUS_TRANSITION",
        409,
        "The requested task status change is not allowed",
      );
    }

    if (
      error.code === POSTGRES_ERROR_CODES.CHECK_VIOLATION &&
      error.message.includes("tasks_completion_consistency")
    ) {
      throw new AppError(
        "TASK_STATUS_CONFLICT",
        409,
        "Task status and completion timestamp are inconsistent",
      );
    }

    throw new AppError("TASK_UPDATE_FAILED", 500, "Failed to update task");
  }

  if (!data) {
    throw new AppError(
      "TASK_STATUS_CONFLICT",
      409,
      "Task may have changed. Refresh and try again.",
    );
  }

  return data;
}

export async function removeTask(
  supabase: AppSupabaseClient,
  organizationId: string,
  taskId: string,
) {
  const { data, error } = await deleteTask(supabase, organizationId, taskId);

  if (error) {
    throw new AppError("TASK_DELETE_FAILED", 500, "Failed to delete task");
  }

  if (!data) {
    throw new AppError("TASK_NOT_FOUND", 404, "Task not found");
  }

  return data;
}

export async function assignTaskToUser(
  supabase: AppSupabaseClient,
  organizationId: string,
  taskId: string,
  assignedTo: string | null,
) {
  // Ensure the assignee belongs to the active organization.
  if (assignedTo !== null) {
    const { data: member, error: memberError } = await getTaskAssignee(
      supabase,
      organizationId,
      assignedTo,
    );

    if (memberError) {
      throw new AppError(
        "TASK_ASSIGNMENT_FAILED",
        500,
        "Failed to assign task",
      );
    }

    if (!member) {
      throw new AppError(
        "INVALID_ASSIGNEE",
        400,
        "Assigned user does not belong to this organization",
      );
    }
  }

  const { data, error } = await assignTask(
    supabase,
    organizationId,
    taskId,
    assignedTo,
  );

  if (error) {
    // Membership might have changed between validation and updating.
    if (
      assignedTo !== null &&
      error.code === POSTGRES_ERROR_CODES.FOREIGN_KEY_VIOLATION &&
      error.message.includes("tasks_assignee_membership_fk")
    ) {
      throw new AppError(
        "INVALID_ASSIGNEE",
        409,
        "The selected assignee is no longer valid. Refresh and try again.",
      );
    }

    throw new AppError("TASK_ASSIGNMENT_FAILED", 500, "Failed to assign task");
  }

  if (!data) {
    throw new AppError("TASK_NOT_FOUND", 404, "Task not found");
  }

  return data;
}
