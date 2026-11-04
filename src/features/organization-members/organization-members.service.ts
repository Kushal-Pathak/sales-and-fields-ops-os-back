import { AppSupabaseClient } from "../../types/supabase";
import {
  getOrganizationAdminCount,
  getOrganizationMember,
  getOrganizationMembers,
  updateOrganizationMemberRole,
} from "./organization-members.repository";
import { AppError } from "../../core/errors/app-error";
import { OrganizationRole } from "../../core/auth/roles";

export async function listOrganizationMembers(
  supabase: AppSupabaseClient,
  organizationId: string,
) {
  const { data, error } = await getOrganizationMembers(
    supabase,
    organizationId,
  );

  if (error) {
    throw new AppError(
      "ORGANIZATION_MEMBERS_FETCH_FAILED",
      500,
      "Failed to fetch organization members!",
    );
  }

  return data;
}

export async function changeOrganizationMembersRole(
  supabase: AppSupabaseClient,
  organizationId: string,
  userId: string,
  role: OrganizationRole,
) {
  const { data: member, error: memberError } = await getOrganizationMember(
    supabase,
    organizationId,
    userId,
  );

  if (memberError || !member) {
    throw new AppError(
      "ORGANIZATION_MEMBER_NOT_FOUND",
      404,
      "Organization member not found",
    );
  }

  if (member.role === "admin" && role !== "admin") {
    const { count, error: countError } = await getOrganizationAdminCount(
      supabase,
      organizationId,
    );

    if (countError) {
      throw new AppError(
        "ORGANIZATION_ADMIN_COUNT_FAILED",
        500,
        "Failed to check organization admins",
      );
    }

    if (count === 1) {
      throw new AppError(
        "LAST_ADMIN_REQUIRED",
        400,
        "The last organization admin cannot be demoted!",
      );
    }
  }

  const { data, error } = await updateOrganizationMemberRole(
    supabase,
    organizationId,
    userId,
    role,
  );

  if (error || !data) {
    throw new AppError(
      "ORGANIZATION_MEMBER_ROLE_UPDATE_FAILED",
      500,
      "Failed to update organization member role!",
    );
  }

  return data;
}
