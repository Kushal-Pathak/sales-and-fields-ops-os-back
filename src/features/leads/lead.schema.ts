import z from "zod";

export const createLeadSchema = z.object({
  first_name: z.string().trim().min(1),
  last_name: z.string().trim().min(1),
  email: z.email().optional(),
  phone: z.string().trim().optional(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const updateLeadSchema = createLeadSchema.partial();

export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

export const listLeadsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().trim().optional(),
  search: z.string().trim().min(1).optional(),
  sortBy: z
    .enum(["created_at", "updated_at", "first_name"])
    .default("created_at"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>;
