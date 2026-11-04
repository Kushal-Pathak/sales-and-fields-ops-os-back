import type { Context } from "hono";
import { AppEnv } from "../../types/app";
import {
  createOrganizationMember,
  changeOrganizationMembersRole,
  listOrganizationMembers,
  removeOrganizationMember,
} from "./organization-members.service";
import { AppError } from "../../core/errors/app-error";
import { validate } from "../../shared/validation/validate";
import { updateOrganizationMemberRoleSchema } from "./organization-member.schema";
import { addOrganizationMemberSchema } from "./organization-member.schema";

export async function createOrganizationMemberController(c: Context<AppEnv>) {
  const body = await c.req.json();
  const input = validate(addOrganizationMemberSchema, body);

  const supabase = c.get("supabase");
  const organizationId = c.get("organizationId");

  const data = await createOrganizationMember(supabase, organizationId, input);

  return c.json({ data }, 201);
}

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

export async function removeOrganizationMemberController(c: Context<AppEnv>) {
  const userId = c.req.param("userId");

  if (!userId) {
    throw new AppError("USER_ID_REQUIRED", 400, "User ID is required");
  }

  const supabase = c.get("supabase");
  const organizationId = c.get("organizationId");

  const data = await removeOrganizationMember(supabase, organizationId, userId);

  return c.json({ data });
}
