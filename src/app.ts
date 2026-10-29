import { Hono } from "hono";
import type { AppEnv } from "./types/app";
import { requireAuth } from "./middleware/auth";
import leads from "./features/leads/leads.routes";
import { errorHandler } from "./core/errors/error-handler";
import { requestId } from "./middleware/request-id";
import { requestLogger } from "./middleware/request-logger";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

const app = new Hono<AppEnv>();

app.use("*", requestId);
app.use("*", requestLogger);

app.use("*", secureHeaders());

app.use(
  "/api/*",
  cors({
    origin: (_origin, c) => c.env.FRONTEND_ORIGIN,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["X-Request-ID"],
  }),
);

app.get("/", (c) => {
  return c.text("Pilot CRM API is running.");
});

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

app.get("/auth-test", requireAuth, (c) => {
  return c.json({ userId: c.get("userId") });
});

app.route("/api/v1/leads", leads);

app.notFound((c) => {
  return c.json(
    {
      error: {
        code: "ROUTE_NOT_FOUND",
        message: "Route not found!",
      },
    },
    404,
  );
});

app.onError(errorHandler);

export default app;
