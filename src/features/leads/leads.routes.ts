import { Hono } from "hono";
import { AppEnv } from "../../types/app";
import { requireAuth } from "../../middleware/auth";
import {
  createLeadController,
  deleteLeadController,
  getLeadController,
  listLeadsController,
  updateLeadController,
} from "./leads.controller";

const leads = new Hono<AppEnv>();

leads.get("/", requireAuth, listLeadsController);
leads.get("/:id", requireAuth, getLeadController);
leads.post("/", requireAuth, createLeadController);
leads.patch("/:id", requireAuth, updateLeadController);
leads.delete("/:id", requireAuth, deleteLeadController)

export default leads;
