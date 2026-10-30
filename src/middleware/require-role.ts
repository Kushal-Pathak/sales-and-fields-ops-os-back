import { createMiddleware } from "hono/factory";
import { AppEnv } from "../types/app";
import { OrganizationRole } from "../core/auth/roles";
import { AppError } from "../core/errors/app-error";

export function requireRole(...allowedRoles: OrganizationRole[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const role = c.get("organizationRole");

    if (!allowedRoles.includes(role)) {
      throw new AppError(
        "FORBIDDEN",
        403,
        "You do not have permission to perform this action!",
      );
    }

    await next();
  });
}
