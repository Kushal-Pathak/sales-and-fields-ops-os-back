import { AppError } from "../../core/errors/app-error";
import type { AppSupabaseClient } from "../../types/supabase";
import type { ListTasksQuery } from "./tasks.schema";
import { getTasks } from "./tasks.repository";

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
