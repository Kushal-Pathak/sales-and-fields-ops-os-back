import { describe, it, expect } from "vitest";
import { validateUuid } from "./validate-uuid";
import { AppError } from "../../core/errors/app-error";

describe("UUID Validation", () => {
  it("should accept a valid UUID", () => {
    const uuid = "4e8cde38-856b-422e-8e2a-48b377457424";

    expect(validateUuid(uuid, "Lead ID")).toBe(uuid);
  });

  it("should reject an invalid UUID", () => {
    expect(() => validateUuid("abc123", "Lead ID")).toThrow(AppError);
  });

  it("should return a meaningful error message", () => {
    expect(() => validateUuid("invalid", "Lead ID")).toThrow(
      "Lead ID must be a valid UUID",
    );
  });

  it("should reject a missing UUID", () => {
    expect(() => validateUuid(undefined, "Lead ID")).toThrow(AppError);
  });

  it("should throw an AppError with correct properties", () => {
    const execute = () => validateUuid("invalid", "Lead ID");

    expect(execute).toThrow(
      expect.objectContaining({
        code: "INVALID_UUID",
        status: 400,
        message: "Lead ID must be a valid UUID",
      }),
    );
  });
});
