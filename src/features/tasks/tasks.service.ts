import { AppError } from "../../core/errors/app-error";
import type { AppSupabaseClient } from "../../types/supabase";
import type { ListTasksQuery } from "./tasks.schema";
import { getTaskById, getTasks } from "./tasks.repository";

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
