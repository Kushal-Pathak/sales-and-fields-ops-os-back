import type { Context } from "hono";
import type { AppEnv } from "../../types/app";
import { validate } from "../../shared/validation/validate";
import { listTasksQuerySchema } from "./tasks.schema";
import { findTaskById, listTasks } from "./tasks.service";
import { validateUuid } from "../../shared/validation/validate-uuid";

export async function listTasksController(c: Context<AppEnv>) {
  const query = validate(listTasksQuerySchema, c.req.query());

  const { data, count } = await listTasks(
    c.get("supabase"),
    c.get("organizationId"),
    query,
  );

  return c.json({
    data,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: count,
    },
  });
}

export async function getTaskController(c: Context<AppEnv>) {
  const taskId = validateUuid(c.req.param("id"), "Task ID");
  const data = await findTaskById(
    c.get("supabase"),
    c.get("organizationId"),
    taskId,
  );
  return c.json({ data });
}
