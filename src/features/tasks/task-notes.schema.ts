import { z } from "zod";

export const createTaskNoteSchema = z
  .object({
    content: z.string().trim().min(1).max(5000),
  })
  .strict();

export const updateTaskNoteSchema = createTaskNoteSchema;

export type CreateTaskNoteInput = z.infer<typeof createTaskNoteSchema>;

export type UpdateTaskNoteInput = z.infer<typeof updateTaskNoteSchema>;
