import { z } from "zod";

export const taskStatusSchema = z.enum([
  "todo",
  "in_progress",
  "completed",
  "cancelled",
]);

export const taskPrioritySchema = z.enum(["low", "medium", "high"]);

export const listTasksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;

/**
 * Only task details are accepted from the client.
 * Identity, organization, creator, and status are managed by the server/database.
 */
export const createTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(5000).nullable().optional(),
    assigned_to: z.uuid().nullable().optional(),
    lead_id: z.uuid().nullable().optional(),
    priority: taskPrioritySchema.optional(),
    due_at: z.iso.datetime({ offset: true }).nullable().optional(),
  })
  .strict();

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
