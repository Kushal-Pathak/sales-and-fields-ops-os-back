import { Hono } from "hono";
import { AppEnv } from "../../types/app";
import { requireAuth } from "../../middleware/auth";
import { requireOrganizationAccess } from "../../middleware/organization-access";
import { requireRole } from "../../middleware/require-role";
import { listOrganizationMembersController } from "./organization-members.controller";
import { updateOrganizationMemberRoleController } from "./organization-members.controller";

const organizationMembers = new Hono<AppEnv>();

organizationMembers.use("*", requireAuth);
organizationMembers.use("*", requireOrganizationAccess);

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

export default organizationMembers;
