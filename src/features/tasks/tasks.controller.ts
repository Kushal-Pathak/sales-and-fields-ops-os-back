import type { Context } from "hono";
import type { AppEnv } from "../../types/app";
import { validate } from "../../shared/validation/validate";
import {
  createTaskSchema,
  listTasksQuerySchema,
  updateTaskStatusSchema,
} from "./tasks.schema";
import {
  createTask,
  editTaskStatus,
  findTaskById,
  listTasks,
} from "./tasks.service";
import { validateUuid } from "../../shared/validation/validate-uuid";
import { AppError } from "../../core/errors/app-error";

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

export async function createTaskController(c: Context<AppEnv>) {
  const body = await c.req.json().catch(() => {
    throw new AppError("VALIDATION_ERROR", 400, "Invalid JSON request body");
  });

  const input = validate(createTaskSchema, body);

  const data = await createTask(
    c.get("supabase"),
    c.get("organizationId"),
    input,
  );

  return c.json({ data }, 201);
}

export async function updateTaskController(c: Context<AppEnv>) {
  const taskId = validateUuid(c.req.param("id"), "Task ID");

  const body = await c.req.json().catch(() => {
    throw new AppError("VALIDATION_ERROR", 400, "Invalid JSON request body");
  });

  const input = validate(updateTaskStatusSchema, body);

  const supabase = c.get("supabase");
  const organizationId = c.get("organizationId");

  const data = await editTaskStatus(supabase, organizationId, taskId, input);

  return c.json({ data });
}
