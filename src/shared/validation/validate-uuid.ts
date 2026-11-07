import { z } from "zod";
import { AppError } from "../../core/errors/app-error";

const uuidSchema = z.uuid();

export function validateUuid(
  value: string | undefined,
  fieldName = "ID",
): string {
  const result = uuidSchema.safeParse(value);

  if (!result.success) {
    throw new AppError(
      "INVALID_UUID",
      400,
      `${fieldName} must be a valid UUID`,
    );
  }

  return result.data;
}
