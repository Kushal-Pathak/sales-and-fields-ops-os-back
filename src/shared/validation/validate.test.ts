import { describe, it, expect } from "vitest";
import { z } from "zod";

import { validate } from "./validate";
import { AppError } from "../../core/errors/app-error";

describe("Zod Validation", () => {
  const userSchema = z.object({
    name: z.string().min(1),
    age: z.number().min(18),
  });

  it("should accept valid input", () => {
    const input = {
      name: "Ram",
      age: 25,
    };

    const result = validate(userSchema, input);

    expect(result).toEqual(input);
  });

  it("should reject invalid input", () => {
    const input = {
      name: "",
      age: 15,
    };

    expect(() => validate(userSchema, input)).toThrow(AppError);
  });

  it("should throw the correct error code and status", () => {
    const input = {
      name: "",
      age: 15,
    };

    expect(() => validate(userSchema, input)).toThrow(
      expect.objectContaining({
        code: "VALIDATION_ERROR",
        status: 400,
      }),
    );
  });

  it("should remove unknown fields", () => {
    const input = {
      name: "Ram",
      age: 25,
      is_admin: true,
    };

    const result = validate(userSchema, input);

    expect(result).toEqual({
      name: "Ram",
      age: 25,
    });

    expect(result).not.toHaveProperty("is_admin");
  });

  it("should return transformed data", () => {
    const schema = z.object({
      email: z.string().trim().toLowerCase(),
    });

    const input = {
      email: "  RAM@EXAMPLE.COM  ",
    };

    const result = validate(schema, input);

    expect(result).toEqual({
      email: "ram@example.com",
    });
  });
});
