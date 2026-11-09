import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppSupabaseClient } from "../../types/supabase";
import { POSTGRES_ERROR_CODES } from "../../platform/database/postgres-errors";

import {
  addOrganizationMember,
  getOrganizationMembers,
  getOrganizationMember,
  getOrganizationAdminCount,
  updateOrganizationMemberRole,
  deleteOrganizationMember,
} from "./organization-members.repository";

import {
  createOrganizationMember,
  listOrganizationMembers,
  changeOrganizationMembersRole,
  removeOrganizationMember,
} from "./organization-members.service";

// --------------------------------------------------
// MOCK DEPENDENCIES
// --------------------------------------------------

vi.mock("./organization-members.repository", () => ({
  addOrganizationMember: vi.fn(),
  getOrganizationMembers: vi.fn(),
  getOrganizationMember: vi.fn(),
  getOrganizationAdminCount: vi.fn(),
  updateOrganizationMemberRole: vi.fn(),
  deleteOrganizationMember: vi.fn(),
}));

// --------------------------------------------------
// TEST DATA
// --------------------------------------------------

const supabase = {} as AppSupabaseClient;

const organizationId = "10a2d962-85a1-4cfb-b604-314a2b6e5712";
const userId = "5c0cba42-0a5d-43f5-bb0b-7fa92661ef5e";

const member = {
  user_id: userId,
  role: "staff" as const,
  created_at: "2026-11-09T10:00:00Z",
};

const adminMember = {
  ...member,
  role: "admin" as const,
};

const input = {
  user_id: userId,
  role: "staff" as const,
};

const databaseError = {
  code: "DATABASE_ERROR",
  message: "Database unavailable",
};

// Supabase repository methods return typed query builders.
// This helper allows us to simulate their results.
function mockResult<T>(result: T): never {
  return Promise.resolve(result) as never;
}

beforeEach(() => {
  vi.resetAllMocks();
});

// --------------------------------------------------
// 1. CREATE ORGANIZATION MEMBER
// --------------------------------------------------

describe("Organization Members - createOrganizationMember", () => {
  it("should successfully create an organization member", async () => {
    vi.mocked(addOrganizationMember).mockReturnValue(
      mockResult({
        data: member,
        error: null,
      }),
    );

    const result = await createOrganizationMember(
      supabase,
      organizationId,
      input,
    );

    expect(result).toEqual(member);

    expect(addOrganizationMember).toHaveBeenCalledWith(
      supabase,
      organizationId,
      input,
    );
  });

  it("should return 409 when membership already exists", async () => {
    vi.mocked(addOrganizationMember).mockReturnValue(
      mockResult({
        data: null,
        error: {
          code: POSTGRES_ERROR_CODES.UNIQUE_VIOLATION,
          message:
            'duplicate key value violates unique constraint "organization_members_pkey"',
        },
      }),
    );

    await expect(
      createOrganizationMember(supabase, organizationId, input),
    ).rejects.toMatchObject({
      code: "MEMBER_ALREADY_EXISTS",
      status: 409,
    });
  });

  it("should not mistake another unique constraint for duplicate membership", async () => {
    vi.mocked(addOrganizationMember).mockReturnValue(
      mockResult({
        data: null,
        error: {
          code: POSTGRES_ERROR_CODES.UNIQUE_VIOLATION,
          message: 'violates unique constraint "other_unique_constraint"',
        },
      }),
    );

    await expect(
      createOrganizationMember(supabase, organizationId, input),
    ).rejects.toMatchObject({
      code: "ORGANIZATION_MEMBER_CREATE_FAILED",
      status: 500,
    });
  });

  it("should return 400 when the user does not exist", async () => {
    vi.mocked(addOrganizationMember).mockReturnValue(
      mockResult({
        data: null,
        error: {
          code: POSTGRES_ERROR_CODES.FOREIGN_KEY_VIOLATION,
          message:
            'violates foreign key constraint "organization_members_user_id_fkey"',
        },
      }),
    );

    await expect(
      createOrganizationMember(supabase, organizationId, input),
    ).rejects.toMatchObject({
      code: "INVALID_USER",
      status: 400,
    });
  });

  it("should return 404 when the organization does not exist", async () => {
    vi.mocked(addOrganizationMember).mockReturnValue(
      mockResult({
        data: null,
        error: {
          code: POSTGRES_ERROR_CODES.FOREIGN_KEY_VIOLATION,
          message:
            'violates foreign key constraint "organization_members_organization_id_fkey"',
        },
      }),
    );

    await expect(
      createOrganizationMember(supabase, organizationId, input),
    ).rejects.toMatchObject({
      code: "ORGANIZATION_NOT_FOUND",
      status: 404,
    });
  });

  it("should return 500 for an unrelated foreign key violation", async () => {
    vi.mocked(addOrganizationMember).mockReturnValue(
      mockResult({
        data: null,
        error: {
          code: POSTGRES_ERROR_CODES.FOREIGN_KEY_VIOLATION,
          message: 'violates foreign key constraint "unknown_fk"',
        },
      }),
    );

    await expect(
      createOrganizationMember(supabase, organizationId, input),
    ).rejects.toMatchObject({
      code: "ORGANIZATION_MEMBER_CREATE_FAILED",
      status: 500,
    });
  });

  it("should return 500 when member creation fails unexpectedly", async () => {
    vi.mocked(addOrganizationMember).mockReturnValue(
      mockResult({
        data: null,
        error: databaseError,
      }),
    );

    await expect(
      createOrganizationMember(supabase, organizationId, input),
    ).rejects.toMatchObject({
      code: "ORGANIZATION_MEMBER_CREATE_FAILED",
      status: 500,
    });
  });

  it("should return 500 when creation returns no data", async () => {
    vi.mocked(addOrganizationMember).mockReturnValue(
      mockResult({
        data: null,
        error: null,
      }),
    );

    await expect(
      createOrganizationMember(supabase, organizationId, input),
    ).rejects.toMatchObject({
      code: "ORGANIZATION_MEMBER_CREATE_FAILED",
      status: 500,
    });
  });
});

// --------------------------------------------------
// 2. LIST ORGANIZATION MEMBERS
// --------------------------------------------------

describe("Organization Members - listOrganizationMembers", () => {
  it("should return organization members", async () => {
    const members = [member, adminMember];

    vi.mocked(getOrganizationMembers).mockReturnValue(
      mockResult({
        data: members,
        error: null,
      }),
    );

    const result = await listOrganizationMembers(supabase, organizationId);

    expect(result).toEqual(members);

    expect(getOrganizationMembers).toHaveBeenCalledWith(
      supabase,
      organizationId,
    );
  });

  it("should return an empty array when there are no members", async () => {
    vi.mocked(getOrganizationMembers).mockReturnValue(
      mockResult({
        data: [],
        error: null,
      }),
    );

    const result = await listOrganizationMembers(supabase, organizationId);

    expect(result).toEqual([]);
  });

  it("should return 500 when fetching members fails", async () => {
    vi.mocked(getOrganizationMembers).mockReturnValue(
      mockResult({
        data: null,
        error: databaseError,
      }),
    );

    await expect(
      listOrganizationMembers(supabase, organizationId),
    ).rejects.toMatchObject({
      code: "ORGANIZATION_MEMBERS_FETCH_FAILED",
      status: 500,
    });
  });
});

// --------------------------------------------------
// 3. CHANGE ORGANIZATION MEMBER ROLE
// --------------------------------------------------

describe("Organization Members - changeOrganizationMembersRole", () => {
  beforeEach(() => {
    vi.mocked(getOrganizationMember).mockReturnValue(
      mockResult({
        data: member,
        error: null,
      }),
    );

    vi.mocked(updateOrganizationMemberRole).mockReturnValue(
      mockResult({
        data: adminMember,
        error: null,
      }),
    );
  });

  it("should promote a staff member to admin", async () => {
    const result = await changeOrganizationMembersRole(
      supabase,
      organizationId,
      userId,
      "admin",
    );

    expect(result).toEqual(adminMember);

    expect(updateOrganizationMemberRole).toHaveBeenCalledWith(
      supabase,
      organizationId,
      userId,
      "admin",
    );

    expect(getOrganizationAdminCount).not.toHaveBeenCalled();
  });

  it("should demote an admin when multiple admins exist", async () => {
    vi.mocked(getOrganizationMember).mockReturnValue(
      mockResult({
        data: adminMember,
        error: null,
      }),
    );

    vi.mocked(getOrganizationAdminCount).mockReturnValue(
      mockResult({
        count: 2,
        error: null,
      }),
    );

    vi.mocked(updateOrganizationMemberRole).mockReturnValue(
      mockResult({
        data: member,
        error: null,
      }),
    );

    const result = await changeOrganizationMembersRole(
      supabase,
      organizationId,
      userId,
      "staff",
    );

    expect(result).toEqual(member);

    expect(updateOrganizationMemberRole).toHaveBeenCalledWith(
      supabase,
      organizationId,
      userId,
      "staff",
    );
  });

  it("should return 409 when demoting the last admin", async () => {
    vi.mocked(getOrganizationMember).mockReturnValue(
      mockResult({
        data: adminMember,
        error: null,
      }),
    );

    vi.mocked(getOrganizationAdminCount).mockReturnValue(
      mockResult({
        count: 1,
        error: null,
      }),
    );

    await expect(
      changeOrganizationMembersRole(supabase, organizationId, userId, "staff"),
    ).rejects.toMatchObject({
      code: "LAST_ADMIN_REQUIRED",
      status: 409,
    });

    expect(updateOrganizationMemberRole).not.toHaveBeenCalled();
  });

  it("should return 500 when member lookup fails", async () => {
    vi.mocked(getOrganizationMember).mockReturnValue(
      mockResult({
        data: null,
        error: databaseError,
      }),
    );

    await expect(
      changeOrganizationMembersRole(supabase, organizationId, userId, "admin"),
    ).rejects.toMatchObject({
      code: "ORGANIZATION_MEMBER_FETCH_FAILED",
      status: 500,
    });
  });

  it("should return 404 when the member does not exist", async () => {
    vi.mocked(getOrganizationMember).mockReturnValue(
      mockResult({
        data: null,
        error: null,
      }),
    );

    await expect(
      changeOrganizationMembersRole(supabase, organizationId, userId, "admin"),
    ).rejects.toMatchObject({
      code: "ORGANIZATION_MEMBER_NOT_FOUND",
      status: 404,
    });

    expect(updateOrganizationMemberRole).not.toHaveBeenCalled();
  });

  it("should return 500 when admin count query fails", async () => {
    vi.mocked(getOrganizationMember).mockReturnValue(
      mockResult({
        data: adminMember,
        error: null,
      }),
    );

    vi.mocked(getOrganizationAdminCount).mockReturnValue(
      mockResult({
        count: null,
        error: databaseError,
      }),
    );

    await expect(
      changeOrganizationMembersRole(supabase, organizationId, userId, "staff"),
    ).rejects.toMatchObject({
      code: "ORGANIZATION_ADMIN_COUNT_FAILED",
      status: 500,
    });

    expect(updateOrganizationMemberRole).not.toHaveBeenCalled();
  });

  it("should return 500 when admin count is null", async () => {
    vi.mocked(getOrganizationMember).mockReturnValue(
      mockResult({
        data: adminMember,
        error: null,
      }),
    );

    vi.mocked(getOrganizationAdminCount).mockReturnValue(
      mockResult({
        count: null,
        error: null,
      }),
    );

    await expect(
      changeOrganizationMembersRole(supabase, organizationId, userId, "staff"),
    ).rejects.toMatchObject({
      code: "ORGANIZATION_ADMIN_COUNT_FAILED",
      status: 500,
    });
  });

  it("should return 409 when database last-admin protection triggers", async () => {
    vi.mocked(getOrganizationMember).mockReturnValue(
      mockResult({
        data: adminMember,
        error: null,
      }),
    );

    vi.mocked(getOrganizationAdminCount).mockReturnValue(
      mockResult({
        count: 2,
        error: null,
      }),
    );

    // Simulate another admin being removed between
    // the count check and the role update.
    vi.mocked(updateOrganizationMemberRole).mockReturnValue(
      mockResult({
        data: null,
        error: {
          code: POSTGRES_ERROR_CODES.CHECK_VIOLATION,
          message: "Cannot remove the last organization admin",
        },
      }),
    );

    await expect(
      changeOrganizationMembersRole(supabase, organizationId, userId, "staff"),
    ).rejects.toMatchObject({
      code: "LAST_ADMIN_REQUIRED",
      status: 409,
    });
  });

  it("should return 500 for an unrelated check violation", async () => {
    vi.mocked(updateOrganizationMemberRole).mockReturnValue(
      mockResult({
        data: null,
        error: {
          code: POSTGRES_ERROR_CODES.CHECK_VIOLATION,
          message: "Some other database constraint failed",
        },
      }),
    );

    await expect(
      changeOrganizationMembersRole(supabase, organizationId, userId, "admin"),
    ).rejects.toMatchObject({
      code: "ORGANIZATION_MEMBER_ROLE_UPDATE_FAILED",
      status: 500,
    });
  });

  it("should return 500 when role update fails unexpectedly", async () => {
    vi.mocked(updateOrganizationMemberRole).mockReturnValue(
      mockResult({
        data: null,
        error: databaseError,
      }),
    );

    await expect(
      changeOrganizationMembersRole(supabase, organizationId, userId, "admin"),
    ).rejects.toMatchObject({
      code: "ORGANIZATION_MEMBER_ROLE_UPDATE_FAILED",
      status: 500,
    });
  });

  it("should return 404 when the update matches no member", async () => {
    vi.mocked(updateOrganizationMemberRole).mockReturnValue(
      mockResult({
        data: null,
        error: null,
      }),
    );

    await expect(
      changeOrganizationMembersRole(supabase, organizationId, userId, "admin"),
    ).rejects.toMatchObject({
      code: "ORGANIZATION_MEMBER_NOT_FOUND",
      status: 404,
    });
  });
});

// --------------------------------------------------
// 4. REMOVE ORGANIZATION MEMBER
// --------------------------------------------------

describe("Organization Members - removeOrganizationMember", () => {
  beforeEach(() => {
    vi.mocked(getOrganizationMember).mockReturnValue(
      mockResult({
        data: member,
        error: null,
      }),
    );

    vi.mocked(deleteOrganizationMember).mockReturnValue(
      mockResult({
        data: member,
        error: null,
      }),
    );
  });

  it("should successfully remove a staff member", async () => {
    const result = await removeOrganizationMember(
      supabase,
      organizationId,
      userId,
    );

    expect(result).toEqual(member);

    expect(deleteOrganizationMember).toHaveBeenCalledWith(
      supabase,
      organizationId,
      userId,
    );

    expect(getOrganizationAdminCount).not.toHaveBeenCalled();
  });

  it("should remove an admin when multiple admins exist", async () => {
    vi.mocked(getOrganizationMember).mockReturnValue(
      mockResult({
        data: adminMember,
        error: null,
      }),
    );

    vi.mocked(getOrganizationAdminCount).mockReturnValue(
      mockResult({
        count: 2,
        error: null,
      }),
    );

    vi.mocked(deleteOrganizationMember).mockReturnValue(
      mockResult({
        data: adminMember,
        error: null,
      }),
    );

    const result = await removeOrganizationMember(
      supabase,
      organizationId,
      userId,
    );

    expect(result).toEqual(adminMember);
  });

  it("should return 500 when member lookup fails", async () => {
    vi.mocked(getOrganizationMember).mockReturnValue(
      mockResult({
        data: null,
        error: databaseError,
      }),
    );

    await expect(
      removeOrganizationMember(supabase, organizationId, userId),
    ).rejects.toMatchObject({
      code: "ORGANIZATION_MEMBER_FETCH_FAILED",
      status: 500,
    });
  });

  it("should return 404 when member does not exist", async () => {
    vi.mocked(getOrganizationMember).mockReturnValue(
      mockResult({
        data: null,
        error: null,
      }),
    );

    await expect(
      removeOrganizationMember(supabase, organizationId, userId),
    ).rejects.toMatchObject({
      code: "ORGANIZATION_MEMBER_NOT_FOUND",
      status: 404,
    });

    expect(deleteOrganizationMember).not.toHaveBeenCalled();
  });

  it("should return 500 when admin count query fails", async () => {
    vi.mocked(getOrganizationMember).mockReturnValue(
      mockResult({
        data: adminMember,
        error: null,
      }),
    );

    vi.mocked(getOrganizationAdminCount).mockReturnValue(
      mockResult({
        count: null,
        error: databaseError,
      }),
    );

    await expect(
      removeOrganizationMember(supabase, organizationId, userId),
    ).rejects.toMatchObject({
      code: "ORGANIZATION_ADMIN_COUNT_FAILED",
      status: 500,
    });

    expect(deleteOrganizationMember).not.toHaveBeenCalled();
  });

  it("should return 500 when admin count is null", async () => {
    vi.mocked(getOrganizationMember).mockReturnValue(
      mockResult({
        data: adminMember,
        error: null,
      }),
    );

    vi.mocked(getOrganizationAdminCount).mockReturnValue(
      mockResult({
        count: null,
        error: null,
      }),
    );

    await expect(
      removeOrganizationMember(supabase, organizationId, userId),
    ).rejects.toMatchObject({
      code: "ORGANIZATION_ADMIN_COUNT_FAILED",
      status: 500,
    });
  });

  it("should return 409 when removing the last admin", async () => {
    vi.mocked(getOrganizationMember).mockReturnValue(
      mockResult({
        data: adminMember,
        error: null,
      }),
    );

    vi.mocked(getOrganizationAdminCount).mockReturnValue(
      mockResult({
        count: 1,
        error: null,
      }),
    );

    await expect(
      removeOrganizationMember(supabase, organizationId, userId),
    ).rejects.toMatchObject({
      code: "LAST_ADMIN_REQUIRED",
      status: 409,
    });

    expect(deleteOrganizationMember).not.toHaveBeenCalled();
  });

  it("should return 409 when database last-admin protection triggers", async () => {
    vi.mocked(getOrganizationMember).mockReturnValue(
      mockResult({
        data: adminMember,
        error: null,
      }),
    );

    vi.mocked(getOrganizationAdminCount).mockReturnValue(
      mockResult({
        count: 2,
        error: null,
      }),
    );

    // Simulate a concurrent change reducing admin count.
    vi.mocked(deleteOrganizationMember).mockReturnValue(
      mockResult({
        data: null,
        error: {
          code: POSTGRES_ERROR_CODES.CHECK_VIOLATION,
          message: "Cannot remove the last organization admin",
        },
      }),
    );

    await expect(
      removeOrganizationMember(supabase, organizationId, userId),
    ).rejects.toMatchObject({
      code: "LAST_ADMIN_REQUIRED",
      status: 409,
    });
  });

  it("should return 500 for an unrelated check violation", async () => {
    vi.mocked(deleteOrganizationMember).mockReturnValue(
      mockResult({
        data: null,
        error: {
          code: POSTGRES_ERROR_CODES.CHECK_VIOLATION,
          message: "Some other database constraint failed",
        },
      }),
    );

    await expect(
      removeOrganizationMember(supabase, organizationId, userId),
    ).rejects.toMatchObject({
      code: "ORGANIZATION_MEMBER_DELETE_FAILED",
      status: 500,
    });
  });

  it("should return 500 when member deletion fails unexpectedly", async () => {
    vi.mocked(deleteOrganizationMember).mockReturnValue(
      mockResult({
        data: null,
        error: databaseError,
      }),
    );

    await expect(
      removeOrganizationMember(supabase, organizationId, userId),
    ).rejects.toMatchObject({
      code: "ORGANIZATION_MEMBER_DELETE_FAILED",
      status: 500,
    });
  });

  it("should return 404 when deletion matches no member", async () => {
    vi.mocked(deleteOrganizationMember).mockReturnValue(
      mockResult({
        data: null,
        error: null,
      }),
    );

    await expect(
      removeOrganizationMember(supabase, organizationId, userId),
    ).rejects.toMatchObject({
      code: "ORGANIZATION_MEMBER_NOT_FOUND",
      status: 404,
    });
  });
});
