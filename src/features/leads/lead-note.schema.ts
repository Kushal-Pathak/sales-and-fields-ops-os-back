import { z } from "zod";

export const createLeadNoteSchema = z.object({
  content: z.string().trim().min(1),
});

export const updateLeadNoteSchema = createLeadNoteSchema;

export type CreateLeadNoteInput = z.infer<typeof createLeadNoteSchema>;

export type UpdateLeadNoteInput = z.infer<typeof updateLeadNoteSchema>;
