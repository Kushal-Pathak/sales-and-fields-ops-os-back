import { describe, it, expect } from "vitest";
import { Hono } from "hono";

import type { AppEnv } from "../../types/app";
import { AppError } from "./app-error";
import { errorHandler } from "./error-handler";

describe("Centralized Error Handler", () => {
  const app = new Hono<AppEnv>();

  // Register our application's error handler
  app.onError(errorHandler);

  // Simulate a missing lead
  app.get("/test/not-found", () => {
    throw new AppError("LEAD_NOT_FOUND", 404, "Lead not found!");
  });

  // Simulate a business-rule conflict
  app.get("/test/conflict", () => {
    throw new AppError(
      "LAST_ADMIN_REQUIRED",
      409,
      "Cannot remove the last organization admin!",
    );
  });

  // Simulate an unexpected server error
  app.get("/test/unexpected", () => {
    throw new Error("Sensitive database information");
  });

  it("should return 404 with a structured JSON error", async () => {
    const response = await app.request("/test/not-found");
    const body = await response.json();

    expect(response.status).toBe(404);

    expect(body).toEqual({
      error: {
        code: "LEAD_NOT_FOUND",
        message: "Lead not found!",
      },
    });
  });

  it("should return 409 for business-rule conflicts", async () => {
    const response = await app.request("/test/conflict");
    const body = await response.json();

    expect(response.status).toBe(409);

    expect(body).toEqual({
      error: {
        code: "LAST_ADMIN_REQUIRED",
        message: "Cannot remove the last organization admin!",
      },
    });
  });

  it("should return JSON responses", async () => {
    const response = await app.request("/test/not-found");

    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("should return 500 without exposing sensitive error details", async () => {
    const response = await app.request("/test/unexpected");
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toHaveProperty("error");

    expect(JSON.stringify(body)).not.toContain(
      "Sensitive database information",
    );
  });
});
