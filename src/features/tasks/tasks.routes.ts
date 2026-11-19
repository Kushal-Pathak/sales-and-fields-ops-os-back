import { Hono } from "hono";
import type { AppEnv } from "../../types/app";
import { requireAuth } from "../../middleware/auth";
import { requireOrganizationAccess } from "../../middleware/organization-access";
import {
  createTaskController,
  deleteTaskController,
  getTaskController,
  listTasksController,
  updateTaskController,
} from "./tasks.controller";
import { requireRole } from "../../middleware/require-role";

const tasks = new Hono<AppEnv>();

tasks.use("*", requireAuth);
tasks.use("*", requireOrganizationAccess);

tasks.get("/", listTasksController);
tasks.get("/:id", getTaskController);
tasks.post("/", requireRole("admin"), createTaskController);
tasks.patch("/:id", updateTaskController);
tasks.delete("/:id", requireRole("admin"), deleteTaskController);

export default tasks;
