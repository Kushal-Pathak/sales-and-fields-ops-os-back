import { Hono } from "hono";
import type { AppEnv } from "../../types/app";
import { requireAuth } from "../../middleware/auth";
import { requireOrganizationAccess } from "../../middleware/organization-access";
import { listTasksController } from "./tasks.controller";

const tasks = new Hono<AppEnv>();

tasks.use("*", requireAuth);
tasks.use("*", requireOrganizationAccess);

tasks.get("/", listTasksController);

export default tasks;
