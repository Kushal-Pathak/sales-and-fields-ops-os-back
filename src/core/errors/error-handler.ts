import { Context } from "hono";
import { AppEnv } from "../../types/app";
import { AppError } from "./app-error";
import { logger } from "../../platform/logger/logger";

export function errorHandler(error: Error, c: Context<AppEnv>) {
  if (error instanceof AppError) {
    return new Response(
      JSON.stringify({
        error: {
          code: error.code,
          message: error.message,
        },
      }),
      {
        status: error.status,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  logger.error("Unhandled application error", {
    message: error.message,
    requestId: c.get("requestId"),
  });

  return c.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong!",
      },
    },
    500,
  );
}
