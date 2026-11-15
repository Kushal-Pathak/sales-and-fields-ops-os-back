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
