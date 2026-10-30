import { AppError } from "../core/errors/app-error";
import { createMiddleware } from "hono/factory";
import { AppEnv } from "../types/app";
import { getOrganizationAccess } from "../core/auth/organization-access";

export const requireOrganizationAccess = createMiddleware<AppEnv>(
  async (c, next) => {
    const supabase = c.get("supabase");
    const access = await getOrganizationAccess(supabase);

    if (!access) {
      throw new AppError(
        "ORGANIZATION_ACCESS_REQUIRED",
        403,
        "User does not belong to an organization",
      );
    }

    c.set("organizationId", access.organizationId);
    c.set("organizationRole", access.role);

    await next();
  },
);
