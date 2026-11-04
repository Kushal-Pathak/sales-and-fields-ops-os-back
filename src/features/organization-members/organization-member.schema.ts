import z from "zod";
import { ORGANIZATION_ROLES } from "../../core/auth/roles";

export const updateOrganizationMemberRoleSchema = z.object({
  role: z.enum(ORGANIZATION_ROLES),
});

export type UpdateOrganizationMemberRoleInput = z.infer<
  typeof updateOrganizationMemberRoleSchema
>;

export const addOrganizationMemberSchema = z.object({
  user_id: z.uuid(),
  role: z.enum(ORGANIZATION_ROLES).default("staff"),
});

export type AddOrganizationMemberInput = z.infer<
  typeof addOrganizationMemberSchema
>;
