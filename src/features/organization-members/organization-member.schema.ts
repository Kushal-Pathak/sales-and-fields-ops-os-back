import z from "zod";
import { ORGANIZATION_ROLES } from "../../core/auth/roles";

export const updateOrganizationMemberRoleSchema = z.object({
  role: z.enum(ORGANIZATION_ROLES),
});

export type UpdateOrganizationMemberRoleInput = z.infer<
  typeof updateOrganizationMemberRoleSchema
>;
