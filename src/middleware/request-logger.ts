import { createMiddleware } from "hono/factory";
import { AppEnv } from "../types/app";
import { logger } from "../platform/logger/logger";

export const requestLogger = createMiddleware<AppEnv>(async (c, next) => {
  const start = Date.now();

  await next();

  logger.info("HTTP request completed", {
    requestId: c.get("requestId"),
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs: Date.now() - start,
  });
});
