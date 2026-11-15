import type { Context } from "hono";
import type { AppEnv } from "../../types/app";
import { validate } from "../../shared/validation/validate";
import { listTasksQuerySchema } from "./tasks.schema";
import { listTasks } from "./tasks.service";

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
