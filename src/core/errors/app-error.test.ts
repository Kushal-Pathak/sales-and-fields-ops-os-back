import { describe, it, expect } from "vitest";
import { AppError } from "./app-error";

describe("AppError", () => {
  it("should create an error with the correct properties", () => {
    const error = new AppError("LEAD_NOT_FOUND", 404, "Lead not found!");

    expect(error.code).toBe("LEAD_NOT_FOUND");
    expect(error.status).toBe(404);
    expect(error.message).toBe("Lead not found!");
  });

  it("should be an instance of Error", () => {
    const error = new AppError(
      "VALIDATION_ERROR",
      400,
      "Invalid request data!",
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  it("should support different HTTP status codes", () => {
    const testCases = [
      { code: "INVALID_INPUT", status: 400 },
      { code: "UNAUTHORIZED", status: 401 },
      { code: "FORBIDDEN", status: 403 },
      { code: "NOT_FOUND", status: 404 },
      { code: "CONFLICT", status: 409 },
      { code: "SERVER_ERROR", status: 500 },
    ] as const;

    for (const { code, status } of testCases) {
      const error = new AppError(code, status, "Test error");

      expect(error.code).toBe(code);
      expect(error.status).toBe(status);
    }
  });

  it("should preserve the provided error message", () => {
    const error = new AppError(
      "LAST_ADMIN_REQUIRED",
      409,
      "Cannot remove the last organization admin!",
    );

    expect(error.message).toBe("Cannot remove the last organization admin!");
  });
});
