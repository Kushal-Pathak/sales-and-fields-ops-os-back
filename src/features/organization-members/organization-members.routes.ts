import { Hono } from "hono";
import { AppEnv } from "../../types/app";
import { requireAuth } from "../../middleware/auth";
import { requireOrganizationAccess } from "../../middleware/organization-access";
import { requireRole } from "../../middleware/require-role";
import {
  createOrganizationMemberController,
  listOrganizationMembersController,
  updateOrganizationMemberRoleController,
  removeOrganizationMemberController,
} from "./organization-members.controller";

const organizationMembers = new Hono<AppEnv>();

organizationMembers.use("*", requireAuth);
organizationMembers.use("*", requireOrganizationAccess);

organizationMembers.post(
  "/",
  requireRole("admin"),
  createOrganizationMemberController,
);

organizationMembers.get(
  "/",
  requireRole("admin"),
  listOrganizationMembersController,
);

organizationMembers.patch(
  "/:userId/role",
  requireRole("admin"),
  updateOrganizationMemberRoleController,
);

organizationMembers.delete(
  "/:userId",
  requireRole("admin"),
  removeOrganizationMemberController,
);

export default organizationMembers;
