import type { AppSupabaseClient } from "../../types/supabase";
import type { OrganizationRole } from "../../core/auth/roles";
import type { AddOrganizationMemberInput } from "./organization-member.schema";

import { AppError } from "../../core/errors/app-error";
import { POSTGRES_ERROR_CODES } from "../../platform/database/postgres-errors";

import {
  addOrganizationMember,
  getOrganizationAdminCount,
  getOrganizationMember,
  getOrganizationMembers,
  updateOrganizationMemberRole,
  deleteOrganizationMember,
} from "./organization-members.repository";

export async function createOrganizationMember(
  supabase: AppSupabaseClient,
  organizationId: string,
  input: AddOrganizationMemberInput,
) {
  const { data, error } = await addOrganizationMember(
    supabase,
    organizationId,
    input,
  );

  if (
    error?.code === POSTGRES_ERROR_CODES.UNIQUE_VIOLATION &&
    error.message.includes("organization_members_pkey")
  ) {
    throw new AppError(
      "MEMBER_ALREADY_EXISTS",
      409,
      "User already belongs to this organization!",
    );
  }

  if (
    error?.code === POSTGRES_ERROR_CODES.FOREIGN_KEY_VIOLATION &&
    error.message.includes("organization_members_user_id_fkey")
  ) {
    throw new AppError("INVALID_USER", 400, "User does not exist!");
  }

  if (
    error?.code === POSTGRES_ERROR_CODES.FOREIGN_KEY_VIOLATION &&
    error.message.includes("organization_members_organization_id_fkey")
  ) {
    throw new AppError(
      "ORGANIZATION_NOT_FOUND",
      404,
      "Organization no longer exists!",
    );
  }

  if (error || !data) {
    throw new AppError(
      "ORGANIZATION_MEMBER_CREATE_FAILED",
      500,
      "Failed to add organization member!",
    );
  }

  return data;
}

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

  if (memberError) {
    throw new AppError(
      "ORGANIZATION_MEMBER_FETCH_FAILED",
      500,
      "Failed to fetch organization member!",
    );
  }

  if (!member) {
    throw new AppError(
      "ORGANIZATION_MEMBER_NOT_FOUND",
      404,
      "Organization member not found!",
    );
  }

  if (member.role === "admin" && role !== "admin") {
    const { count, error: countError } = await getOrganizationAdminCount(
      supabase,
      organizationId,
    );

    if (countError || count === null) {
      throw new AppError(
        "ORGANIZATION_ADMIN_COUNT_FAILED",
        500,
        "Failed to check organization admins",
      );
    }

    if (count === 1) {
      throw new AppError(
        "LAST_ADMIN_REQUIRED",
        409,
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

  if (error) {
    if (
      error.code === POSTGRES_ERROR_CODES.CHECK_VIOLATION &&
      error.message.includes("Cannot remove the last organization admin")
    ) {
      throw new AppError(
        "LAST_ADMIN_REQUIRED",
        409,
        "Cannot demote the last organization admin!",
      );
    }

    throw new AppError(
      "ORGANIZATION_MEMBER_ROLE_UPDATE_FAILED",
      500,
      "Failed to update organization member role!",
    );
  }

  if (!data) {
    throw new AppError(
      "ORGANIZATION_MEMBER_NOT_FOUND",
      404,
      "Organization member not found!",
    );
  }

  return data;
}

export async function removeOrganizationMember(
  supabase: AppSupabaseClient,
  organizationId: string,
  userId: string,
) {
  const { data: member, error: memberError } = await getOrganizationMember(
    supabase,
    organizationId,
    userId,
  );

  if (memberError) {
    throw new AppError(
      "ORGANIZATION_MEMBER_FETCH_FAILED",
      500,
      "Failed to fetch organization member!",
    );
  }

  if (!member) {
    throw new AppError(
      "ORGANIZATION_MEMBER_NOT_FOUND",
      404,
      "Organization member not found!",
    );
  }

  if (member.role === "admin") {
    const { count, error } = await getOrganizationAdminCount(
      supabase,
      organizationId,
    );

    if (error || count === null) {
      throw new AppError(
        "ORGANIZATION_ADMIN_COUNT_FAILED",
        500,
        "Failed to count organization admins!",
      );
    }

    if (count <= 1) {
      throw new AppError(
        "LAST_ADMIN_REQUIRED",
        409,
        "Cannot remove the last organization admin!",
      );
    }
  }

  const { data, error } = await deleteOrganizationMember(
    supabase,
    organizationId,
    userId,
  );

  if (error) {
    if (
      error.code === POSTGRES_ERROR_CODES.CHECK_VIOLATION &&
      error.message.includes("Cannot remove the last organization admin")
    ) {
      throw new AppError(
        "LAST_ADMIN_REQUIRED",
        409,
        "Cannot remove the last organization admin!",
      );
    }

    throw new AppError(
      "ORGANIZATION_MEMBER_DELETE_FAILED",
      500,
      "Failed to remove organization member!",
    );
  }

  if (!data) {
    throw new AppError(
      "ORGANIZATION_MEMBER_NOT_FOUND",
      404,
      "Organization member not found!",
    );
  }

  return data;
}
