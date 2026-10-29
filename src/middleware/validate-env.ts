import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types/app";
import { validateEnv } from "../config/validate-env";

export const requireEnv = createMiddleware<AppEnv>(async (c, next) => {
  validateEnv(c.env);
  await next();
});
