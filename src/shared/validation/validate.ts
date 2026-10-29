import z from "zod";
import { AppError } from "../../core/errors/app-error";

export function validate<T extends z.ZodType>(
  schema: T,
  input: unknown,
): z.output<T> {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new AppError("VALIDATION_ERROR", 400, "Invalid request data!");
  }

  return result.data;
}
