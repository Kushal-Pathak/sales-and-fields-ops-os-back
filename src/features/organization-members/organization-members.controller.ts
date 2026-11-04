import type { Context } from "hono";
import { AppEnv } from "../../types/app";
import {
  changeOrganizationMembersRole,
  listOrganizationMembers,
} from "./organization-members.service";
import { AppError } from "../../core/errors/app-error";
import { validate } from "../../shared/validation/validate";
import { updateOrganizationMemberRoleSchema } from "./organization-member.schema";

export async function listOrganizationMembersController(c: Context<AppEnv>) {
  const supabase = c.get("supabase");
  const organizationId = c.get("organizationId");

  const data = await listOrganizationMembers(supabase, organizationId);

  return c.json({ data });
}

export async function updateOrganizationMemberRoleController(
  c: Context<AppEnv>,
) {
  const userId = c.req.param("userId");

  if (!userId) {
    throw new AppError("USER_ID_REQUIRED", 400, "User ID is required!");
  }

  const body = await c.req.json();

  const input = validate(updateOrganizationMemberRoleSchema, body);

  const supabase = c.get("supabase");

  const organizationId = c.get("organizationId");

  const data = await changeOrganizationMembersRole(
    supabase,
    organizationId,
    userId,
    input.role,
  );

  return c.json({ data });
}
