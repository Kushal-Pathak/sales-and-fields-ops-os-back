import { Hono } from "hono";
import { AppEnv } from "../../types/app";
import { requireAuth } from "../../middleware/auth";
import { requireOrganizationAccess } from "../../middleware/organization-access";
import { requireRole } from "../../middleware/require-role";

import {
  assignLeadController,
  createLeadController,
  deleteLeadController,
  getLeadController,
  listLeadsController,
  updateLeadController,
  listLeadActivitiesController,
} from "./leads.controller";

const leads = new Hono<AppEnv>();

leads.use("*", requireAuth);
leads.use("*", requireOrganizationAccess);

leads.get("/", listLeadsController);
leads.get("/:id", getLeadController);
leads.post("/", createLeadController);
leads.patch("/:id", updateLeadController);
leads.delete("/:id", requireRole("admin"), deleteLeadController);
leads.patch("/:id/assign", requireRole("admin"), assignLeadController);
leads.get("/:id/activities", listLeadActivitiesController);

export default leads;
