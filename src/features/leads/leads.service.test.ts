import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppSupabaseClient } from "../../types/supabase";
import type { ListLeadsQuery } from "./lead.schema";

import { POSTGRES_ERROR_CODES } from "../../platform/database/postgres-errors";
import { isOrganizationMember } from "../../core/auth/organization-access";

import {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  assignLead,
} from "./leads.repository";

import { getLeadActivities } from "./lead-activities.repository";

import {
  listLeads,
  findLeadById,
  addLead,
  editLead,
  removeLead,
  assignLeadToUser,
  listLeadActivities,
} from "./leads.service";

// --------------------------------------------------
// MOCK DEPENDENCIES
// --------------------------------------------------

vi.mock("./leads.repository", () => ({
  getLeads: vi.fn(),
  getLeadById: vi.fn(),
  createLead: vi.fn(),
  updateLead: vi.fn(),
  deleteLead: vi.fn(),
  assignLead: vi.fn(),
}));

vi.mock("./lead-activities.repository", () => ({
  getLeadActivities: vi.fn(),
}));

vi.mock("../../core/auth/organization-access", () => ({
  isOrganizationMember: vi.fn(),
}));

// --------------------------------------------------
// TEST DATA
// --------------------------------------------------

const supabase = {} as AppSupabaseClient;

const leadId = "4e8cde38-856b-422e-8e2a-48b377457424";
const organizationId = "10a2d962-85a1-4cfb-b604-314a2b6e5712";
const userId = "5c0cba42-0a5d-43f5-bb0b-7fa92661ef5e";

const lead = {
  id: leadId,
  first_name: "Ram",
  status: "new",
  assigned_to: null,
};

const databaseError = {
  code: "DATABASE_ERROR",
  message: "Database unavailable",
};

const listQuery = {
  page: 1,
  limit: 10,
  sortBy: "created_at",
  sortOrder: "desc",
} as ListLeadsQuery;

// Supabase repository methods return typed query builders.
// This helper provides mocked results without a real database.
function mockResult<T>(result: T): never {
  return Promise.resolve(result) as never;
}

beforeEach(() => {
  vi.resetAllMocks();
});

// --------------------------------------------------
// 1. LIST LEADS
// --------------------------------------------------

describe("Lead Service - listLeads", () => {
  it("should return leads and total count", async () => {
    const leads = [lead];

    vi.mocked(getLeads).mockReturnValue(
      mockResult({
        data: leads,
        count: 1,
        error: null,
      }),
    );

    const result = await listLeads(supabase, listQuery);

    expect(result).toEqual({
      data: leads,
      count: 1,
    });

    expect(getLeads).toHaveBeenCalledWith(supabase, listQuery);
  });

  it("should return an empty array when no leads exist", async () => {
    vi.mocked(getLeads).mockReturnValue(
      mockResult({
        data: [],
        count: 0,
        error: null,
      }),
    );

    const result = await listLeads(supabase, listQuery);

    expect(result).toEqual({
      data: [],
      count: 0,
    });
  });

  it("should return 500 when fetching leads fails", async () => {
    vi.mocked(getLeads).mockReturnValue(
      mockResult({
        data: null,
        count: null,
        error: databaseError,
      }),
    );

    await expect(listLeads(supabase, listQuery)).rejects.toMatchObject({
      code: "LEADS_FETCH_FAILED",
      status: 500,
    });
  });

  it("should return 500 when lead data is null", async () => {
    vi.mocked(getLeads).mockReturnValue(
      mockResult({
        data: null,
        count: 0,
        error: null,
      }),
    );

    await expect(listLeads(supabase, listQuery)).rejects.toMatchObject({
      code: "LEADS_FETCH_FAILED",
      status: 500,
    });
  });
});

// --------------------------------------------------
// 2. FIND LEAD BY ID
// --------------------------------------------------

describe("Lead Service - findLeadById", () => {
  it("should return a lead when it exists", async () => {
    vi.mocked(getLeadById).mockReturnValue(
      mockResult({
        data: lead,
        error: null,
      }),
    );

    const result = await findLeadById(supabase, leadId);

    expect(result).toEqual(lead);

    expect(getLeadById).toHaveBeenCalledWith(supabase, leadId);
  });

  it("should return 404 when the lead does not exist", async () => {
    vi.mocked(getLeadById).mockReturnValue(
      mockResult({
        data: null,
        error: null,
      }),
    );

    await expect(findLeadById(supabase, leadId)).rejects.toMatchObject({
      code: "LEAD_NOT_FOUND",
      status: 404,
    });
  });

  it("should return 500 when the database query fails", async () => {
    vi.mocked(getLeadById).mockReturnValue(
      mockResult({
        data: null,
        error: databaseError,
      }),
    );

    await expect(findLeadById(supabase, leadId)).rejects.toMatchObject({
      code: "LEAD_FETCH_FAILED",
      status: 500,
    });
  });
});

// --------------------------------------------------
// 3. CREATE LEAD
// --------------------------------------------------

describe("Lead Service - addLead", () => {
  const input = {
    first_name: "Ram",
  };

  it("should assign a staff-created lead to the staff member", async () => {
    const createdLead = {
      ...lead,
      assigned_to: userId,
    };

    vi.mocked(createLead).mockReturnValue(
      mockResult({
        data: createdLead,
        error: null,
      }),
    );

    const result = await addLead(
      supabase,
      organizationId,
      userId,
      "staff",
      input,
    );

    expect(result).toEqual(createdLead);

    expect(createLead).toHaveBeenCalledWith(
      supabase,
      organizationId,
      userId,
      input,
    );
  });

  it("should leave admin-created leads unassigned", async () => {
    vi.mocked(createLead).mockReturnValue(
      mockResult({
        data: lead,
        error: null,
      }),
    );

    const result = await addLead(
      supabase,
      organizationId,
      userId,
      "admin",
      input,
    );

    expect(result).toEqual(lead);

    expect(createLead).toHaveBeenCalledWith(
      supabase,
      organizationId,
      null,
      input,
    );
  });

  it("should return 500 when lead creation fails", async () => {
    vi.mocked(createLead).mockReturnValue(
      mockResult({
        data: null,
        error: databaseError,
      }),
    );

    await expect(
      addLead(supabase, organizationId, userId, "staff", input),
    ).rejects.toMatchObject({
      code: "LEAD_CREATE_FAILED",
      status: 500,
    });
  });

  it("should return 500 when no created lead is returned", async () => {
    vi.mocked(createLead).mockReturnValue(
      mockResult({
        data: null,
        error: null,
      }),
    );

    await expect(
      addLead(supabase, organizationId, userId, "admin", input),
    ).rejects.toMatchObject({
      code: "LEAD_CREATE_FAILED",
      status: 500,
    });
  });
});

// --------------------------------------------------
// 4. UPDATE LEAD
// --------------------------------------------------

describe("Lead Service - editLead", () => {
  it("should update lead fields without changing status", async () => {
    const input = {
      first_name: "Shyam",
    };

    const updatedLead = {
      ...lead,
      first_name: "Shyam",
    };

    vi.mocked(updateLead).mockReturnValue(
      mockResult({
        data: updatedLead,
        error: null,
      }),
    );

    const result = await editLead(supabase, leadId, input);

    expect(result).toEqual(updatedLead);

    expect(updateLead).toHaveBeenCalledWith(supabase, leadId, input, undefined);

    expect(getLeadById).not.toHaveBeenCalled();
  });

  it("should allow a valid status transition", async () => {
    vi.mocked(getLeadById).mockReturnValue(
      mockResult({
        data: lead,
        error: null,
      }),
    );

    const updatedLead = {
      ...lead,
      status: "contacted",
    };

    vi.mocked(updateLead).mockReturnValue(
      mockResult({
        data: updatedLead,
        error: null,
      }),
    );

    const result = await editLead(supabase, leadId, {
      status: "contacted",
    });

    expect(result).toEqual(updatedLead);

    expect(updateLead).toHaveBeenCalledWith(
      supabase,
      leadId,
      { status: "contacted" },
      "new",
    );
  });

  it("should reject an invalid status transition", async () => {
    vi.mocked(getLeadById).mockReturnValue(
      mockResult({
        data: {
          ...lead,
          status: "converted",
        },
        error: null,
      }),
    );

    await expect(
      editLead(supabase, leadId, {
        status: "new",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_STATUS_TRANSITION",
      status: 409,
    });

    expect(updateLead).not.toHaveBeenCalled();
  });

  it("should return 409 when status changes concurrently", async () => {
    vi.mocked(getLeadById).mockReturnValue(
      mockResult({
        data: lead,
        error: null,
      }),
    );

    // Another request changed the status.
    // The conditional update matches zero rows.
    vi.mocked(updateLead).mockReturnValue(
      mockResult({
        data: null,
        error: null,
      }),
    );

    await expect(
      editLead(supabase, leadId, {
        status: "contacted",
      }),
    ).rejects.toMatchObject({
      code: "LEAD_STATUS_CONFLICT",
      status: 409,
    });

    expect(updateLead).toHaveBeenCalledWith(
      supabase,
      leadId,
      { status: "contacted" },
      "new",
    );
  });

  it("should return 409 for a database status constraint violation", async () => {
    vi.mocked(getLeadById).mockReturnValue(
      mockResult({
        data: lead,
        error: null,
      }),
    );

    vi.mocked(updateLead).mockReturnValue(
      mockResult({
        data: null,
        error: {
          code: POSTGRES_ERROR_CODES.CHECK_VIOLATION,
          message: "Invalid lead status transition: new -> converted",
        },
      }),
    );

    await expect(
      editLead(supabase, leadId, {
        status: "contacted",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_STATUS_TRANSITION",
      status: 409,
    });
  });

  it("should return 500 when the update query fails", async () => {
    vi.mocked(updateLead).mockReturnValue(
      mockResult({
        data: null,
        error: databaseError,
      }),
    );

    await expect(
      editLead(supabase, leadId, {
        first_name: "Shyam",
      }),
    ).rejects.toMatchObject({
      code: "LEAD_UPDATE_FAILED",
      status: 500,
    });
  });

  it("should return 404 when updating a nonexistent lead", async () => {
    vi.mocked(updateLead).mockReturnValue(
      mockResult({
        data: null,
        error: null,
      }),
    );

    await expect(
      editLead(supabase, leadId, {
        first_name: "Shyam",
      }),
    ).rejects.toMatchObject({
      code: "LEAD_NOT_FOUND",
      status: 404,
    });
  });
});

// --------------------------------------------------
// 5. DELETE LEAD
// --------------------------------------------------

describe("Lead Service - removeLead", () => {
  it("should return the deleted lead", async () => {
    vi.mocked(deleteLead).mockReturnValue(
      mockResult({
        data: lead,
        error: null,
      }),
    );

    const result = await removeLead(supabase, leadId);

    expect(result).toEqual(lead);

    expect(deleteLead).toHaveBeenCalledWith(supabase, leadId);
  });

  it("should return 404 when the lead does not exist", async () => {
    vi.mocked(deleteLead).mockReturnValue(
      mockResult({
        data: null,
        error: null,
      }),
    );

    await expect(removeLead(supabase, leadId)).rejects.toMatchObject({
      code: "LEAD_NOT_FOUND",
      status: 404,
    });
  });

  it("should return 500 when deletion fails", async () => {
    vi.mocked(deleteLead).mockReturnValue(
      mockResult({
        data: null,
        error: databaseError,
      }),
    );

    await expect(removeLead(supabase, leadId)).rejects.toMatchObject({
      code: "LEAD_DELETE_FAILED",
      status: 500,
    });
  });
});

// --------------------------------------------------
// 6. ASSIGN LEAD
// --------------------------------------------------

describe("Lead Service - assignLeadToUser", () => {
  it("should assign a lead to an organization member", async () => {
    vi.mocked(isOrganizationMember).mockResolvedValue(true);

    const assignedLead = {
      ...lead,
      assigned_to: userId,
    };

    vi.mocked(assignLead).mockReturnValue(
      mockResult({
        data: assignedLead,
        error: null,
      }),
    );

    const result = await assignLeadToUser(
      supabase,
      organizationId,
      leadId,
      userId,
    );

    expect(result).toEqual(assignedLead);

    expect(isOrganizationMember).toHaveBeenCalledWith(
      supabase,
      organizationId,
      userId,
    );

    expect(assignLead).toHaveBeenCalledWith(supabase, leadId, userId);
  });

  it("should reject users outside the organization", async () => {
    vi.mocked(isOrganizationMember).mockResolvedValue(false);

    await expect(
      assignLeadToUser(supabase, organizationId, leadId, userId),
    ).rejects.toMatchObject({
      code: "INVALID_ASSIGNEE",
      status: 400,
    });

    expect(assignLead).not.toHaveBeenCalled();
  });

  it("should allow unassigning a lead", async () => {
    const unassignedLead = {
      ...lead,
      assigned_to: null,
    };

    vi.mocked(assignLead).mockReturnValue(
      mockResult({
        data: unassignedLead,
        error: null,
      }),
    );

    const result = await assignLeadToUser(
      supabase,
      organizationId,
      leadId,
      null,
    );

    expect(result).toEqual(unassignedLead);

    expect(isOrganizationMember).not.toHaveBeenCalled();

    expect(assignLead).toHaveBeenCalledWith(supabase, leadId, null);
  });

  it("should return 404 when the lead does not exist", async () => {
    vi.mocked(isOrganizationMember).mockResolvedValue(true);

    vi.mocked(assignLead).mockReturnValue(
      mockResult({
        data: null,
        error: null,
      }),
    );

    await expect(
      assignLeadToUser(supabase, organizationId, leadId, userId),
    ).rejects.toMatchObject({
      code: "LEAD_NOT_FOUND",
      status: 404,
    });
  });

  it("should return 409 for assignee membership FK violation", async () => {
    vi.mocked(isOrganizationMember).mockResolvedValue(true);

    vi.mocked(assignLead).mockReturnValue(
      mockResult({
        data: null,
        error: {
          code: POSTGRES_ERROR_CODES.FOREIGN_KEY_VIOLATION,
          message:
            'insert or update on table "leads" violates foreign key constraint "leads_assignee_membership_fk"',
        },
      }),
    );

    await expect(
      assignLeadToUser(supabase, organizationId, leadId, userId),
    ).rejects.toMatchObject({
      code: "INVALID_ASSIGNEE",
      status: 409,
    });
  });

  it("should not mistake another foreign key error for an invalid assignee", async () => {
    vi.mocked(isOrganizationMember).mockResolvedValue(true);

    vi.mocked(assignLead).mockReturnValue(
      mockResult({
        data: null,
        error: {
          code: POSTGRES_ERROR_CODES.FOREIGN_KEY_VIOLATION,
          message:
            'violates foreign key constraint "leads_organization_id_fkey"',
        },
      }),
    );

    await expect(
      assignLeadToUser(supabase, organizationId, leadId, userId),
    ).rejects.toMatchObject({
      code: "LEAD_ASSIGNMENT_FAILED",
      status: 500,
    });
  });

  it("should return 500 when assignment fails unexpectedly", async () => {
    vi.mocked(isOrganizationMember).mockResolvedValue(true);

    vi.mocked(assignLead).mockReturnValue(
      mockResult({
        data: null,
        error: databaseError,
      }),
    );

    await expect(
      assignLeadToUser(supabase, organizationId, leadId, userId),
    ).rejects.toMatchObject({
      code: "LEAD_ASSIGNMENT_FAILED",
      status: 500,
    });
  });
});

// --------------------------------------------------
// 7. LEAD ACTIVITY HISTORY
// --------------------------------------------------

describe("Lead Service - listLeadActivities", () => {
  it("should return activities for an accessible lead", async () => {
    const activities = [
      {
        id: "activity-1",
        lead_id: leadId,
        event_type: "created",
      },
    ];

    vi.mocked(getLeadById).mockReturnValue(
      mockResult({
        data: lead,
        error: null,
      }),
    );

    vi.mocked(getLeadActivities).mockReturnValue(
      mockResult({
        data: activities,
        error: null,
      }),
    );

    const result = await listLeadActivities(supabase, leadId);

    expect(result).toEqual(activities);

    expect(getLeadById).toHaveBeenCalledWith(supabase, leadId);

    expect(getLeadActivities).toHaveBeenCalledWith(supabase, leadId);
  });

  it("should return an empty array when no activities exist", async () => {
    vi.mocked(getLeadById).mockReturnValue(
      mockResult({
        data: lead,
        error: null,
      }),
    );

    vi.mocked(getLeadActivities).mockReturnValue(
      mockResult({
        data: [],
        error: null,
      }),
    );

    const result = await listLeadActivities(supabase, leadId);

    expect(result).toEqual([]);
  });

  it("should return 404 when the lead is inaccessible", async () => {
    vi.mocked(getLeadById).mockReturnValue(
      mockResult({
        data: null,
        error: null,
      }),
    );

    await expect(listLeadActivities(supabase, leadId)).rejects.toMatchObject({
      code: "LEAD_NOT_FOUND",
      status: 404,
    });

    expect(getLeadActivities).not.toHaveBeenCalled();
  });

  it("should return 500 when fetching activities fails", async () => {
    vi.mocked(getLeadById).mockReturnValue(
      mockResult({
        data: lead,
        error: null,
      }),
    );

    vi.mocked(getLeadActivities).mockReturnValue(
      mockResult({
        data: null,
        error: databaseError,
      }),
    );

    await expect(listLeadActivities(supabase, leadId)).rejects.toMatchObject({
      code: "LEAD_ACTIVITIES_FETCH_FAILED",
      status: 500,
    });
  });
});
