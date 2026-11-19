import { Hono } from "hono";
import type { AppEnv } from "../../types/app";
import { requireAuth } from "../../middleware/auth";
import { requireOrganizationAccess } from "../../middleware/organization-access";
import {
  assignTaskController,
  createTaskController,
  deleteTaskController,
  getTaskController,
  listTasksController,
  updateTaskController,
  updateTaskDetailsController,
} from "./tasks.controller";
import { requireRole } from "../../middleware/require-role";

const tasks = new Hono<AppEnv>();

tasks.use("*", requireAuth);
tasks.use("*", requireOrganizationAccess);

tasks.get("/", listTasksController);
tasks.get("/:id", getTaskController);
tasks.post("/", requireRole("admin"), createTaskController);
tasks.patch("/:id", updateTaskController);
tasks.patch("/:id/assign", requireRole("admin"), assignTaskController);
tasks.patch("/:id/details", requireRole("admin"), updateTaskDetailsController);
tasks.delete("/:id", requireRole("admin"), deleteTaskController);

export default tasks;
