import type { AppSupabaseClient } from "../../types/supabase";
import type { ListTasksQuery } from "./tasks.schema";

export async function getTasks(
  supabase: AppSupabaseClient,
  organizationId: string,
  query: ListTasksQuery,
) {
  const from = (query.page - 1) * query.limit;
  const to = from + query.limit - 1;

  let countQuery = supabase
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if (query.status) {
    countQuery = countQuery.eq("status", query.status);
  }

  if (query.priority) {
    countQuery = countQuery.eq("priority", query.priority);
  }

  const { count, error: countError } = await countQuery;

  if (countError || count === null) {
    return { data: null, count: null, error: countError };
  }

  if (from >= count) {
    return { data: [], count, error: null };
  }

  let dataQuery = supabase
    .from("tasks")
    .select("*")
    .eq("organization_id", organizationId);

  if (query.status) {
    dataQuery = dataQuery.eq("status", query.status);
  }

  if (query.priority) {
    dataQuery = dataQuery.eq("priority", query.priority);
  }

  const { data, error } = await dataQuery
    .order("created_at", { ascending: query.sortOrder === "asc" })
    .order("id", { ascending: query.sortOrder === "asc" })
    .range(from, to);

  return { data, count, error };
}

/** Find one task within the active organization; RLS enforces role visibility. */
export async function getTaskById(
  supabase: AppSupabaseClient,
  organizationId: string,
  taskId: string,
) {
  // Fetch task fields only. Do not join the related lead: staff may be allowed
  // to see their task without being permitted to see that lead.
  return supabase
    .from("tasks")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", taskId)
    .maybeSingle();
}
