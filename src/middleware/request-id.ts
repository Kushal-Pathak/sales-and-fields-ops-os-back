import { createMiddleware } from "hono/factory";
import { AppEnv } from "../types/app";

export const requestId = createMiddleware<AppEnv>(async (c, next) => {
  const id = crypto.randomUUID();
  c.set("requestId", id);
  c.header("X-Request-ID", id);
  await next();
});
