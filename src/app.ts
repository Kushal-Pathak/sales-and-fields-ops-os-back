import { Hono } from "hono";
import type { AppEnv } from "./types/app";
import { requireAuth } from "./middleware/auth";
import leads from "./features/leads/leads.routes";

const app = new Hono<AppEnv>();

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

export default app;
