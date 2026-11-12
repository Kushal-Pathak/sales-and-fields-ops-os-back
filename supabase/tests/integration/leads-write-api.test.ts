import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  apiRequest,
  expectJson,
  login,
  type Activity,
  type DataResponse,
  type Lead,
  type Note,
  type Session,
} from "./helpers";

describe("Leads API - Write Integration Tests", () => {
  let ram: Session;
  let hari: Session;
  let gita: Session;
  let bina: Session;

  // Track only leads created by these tests.
  const createdLeadIds: string[] = [];

  beforeAll(async () => {
    [ram, hari, gita, bina] = await Promise.all([
      login("ram@gmail.com"),
      login("hari@gmail.com"),
      login("gita@gmail.com"),
      login("bina@gmail.com"),
    ]);
  });

  // Create a unique lead without depending on seed records.
  async function createTestLead(session: Session): Promise<Lead> {
    const response = await apiRequest("POST", "/api/v1/leads", session.token, {
      first_name: `Test-${randomUUID().slice(0, 8)}`,
    });

    const result = await expectJson<DataResponse<Lead>>(response, 201);

    createdLeadIds.push(result.data.id);

    return result.data;
  }

  // --------------------------------------------------
  // 1. LEAD CREATION
  // --------------------------------------------------

  it("admin creates an unassigned lead", async () => {
    const lead = await createTestLead(ram);

    expect(lead.id).toBeTruthy();
    expect(lead.assigned_to).toBeNull();
    expect(lead.status).toBe("new");
  });

  it("staff creates a lead assigned to themselves", async () => {
    const lead = await createTestLead(hari);

    expect(lead.assigned_to).toBe(hari.userId);
    expect(lead.status).toBe("new");
  });

  it("rejects invalid lead creation data", async () => {
    const response = await apiRequest("POST", "/api/v1/leads", ram.token, {
      first_name: "",
    });

    await expectJson(response, 400);
  });

  // --------------------------------------------------
  // 2. STAFF PERMISSIONS
  // --------------------------------------------------

  it("staff cannot update an unassigned lead", async () => {
    const lead = await createTestLead(ram);

    const response = await apiRequest(
      "PATCH",
      `/api/v1/leads/${lead.id}`,
      hari.token,
      { first_name: "Unauthorized" },
    );

    await expectJson(response, 404);
  });

  it("staff cannot delete leads", async () => {
    const lead = await createTestLead(hari);

    const response = await apiRequest(
      "DELETE",
      `/api/v1/leads/${lead.id}`,
      hari.token,
    );

    const result = await expectJson<{
      error: { code: string };
    }>(response, 403);

    expect(result.error.code).toBe("FORBIDDEN");
  });

  // --------------------------------------------------
  // 3. STATUS TRANSITIONS AND ACTIVITY HISTORY
  // --------------------------------------------------

  it("enforces status transitions and records activities", async () => {
    const lead = await createTestLead(ram);

    // Invalid transition: new -> converted.
    const invalid = await apiRequest(
      "PATCH",
      `/api/v1/leads/${lead.id}`,
      ram.token,
      { status: "converted" },
    );

    await expectJson(invalid, 409);

    // Valid transition: new -> contacted.
    const valid = await apiRequest(
      "PATCH",
      `/api/v1/leads/${lead.id}`,
      ram.token,
      { status: "contacted" },
    );

    const updated = await expectJson<DataResponse<Lead>>(valid, 200);

    expect(updated.data.status).toBe("contacted");

    // Verify automatically generated activity records.
    const response = await apiRequest(
      "GET",
      `/api/v1/leads/${lead.id}/activities`,
      ram.token,
    );

    const activities = await expectJson<DataResponse<Activity[]>>(
      response,
      200,
    );

    const eventTypes = activities.data.map((activity) => activity.event_type);

    expect(eventTypes).toContain("lead_created");
    expect(eventTypes).toContain("status_changed");
  });

  // --------------------------------------------------
  // 4. NOTE AUTHORSHIP
  // --------------------------------------------------

  it("only the note author can update their note", async () => {
    const lead = await createTestLead(hari);

    // Ram creates a note on Hari's assigned lead.
    const createResponse = await apiRequest(
      "POST",
      `/api/v1/leads/${lead.id}/notes`,
      ram.token,
      { content: "Follow up tomorrow" },
    );

    const created = await expectJson<DataResponse<Note>>(createResponse, 201);

    expect(created.data.author_user_id).toBe(ram.userId);

    // Hari can view the lead but cannot edit Ram's note.
    const forbiddenUpdate = await apiRequest(
      "PATCH",
      `/api/v1/leads/${lead.id}/notes/${created.data.id}`,
      hari.token,
      { content: "Changed without permission" },
    );

    await expectJson(forbiddenUpdate, 404);

    // Ram can update his own note.
    const allowedUpdate = await apiRequest(
      "PATCH",
      `/api/v1/leads/${lead.id}/notes/${created.data.id}`,
      ram.token,
      { content: "Updated by the author" },
    );

    const updated = await expectJson<DataResponse<Note>>(allowedUpdate, 200);

    expect(updated.data.content).toBe("Updated by the author");
  });

  // --------------------------------------------------
  // 5. ORGANIZATION ISOLATION
  // --------------------------------------------------

  it("another organization's admin cannot access the lead", async () => {
    const lead = await createTestLead(ram);

    const response = await apiRequest(
      "GET",
      `/api/v1/leads/${lead.id}`,
      bina.token,
    );

    await expectJson(response, 404);
  });

  // --------------------------------------------------
  // 6. ADMIN LEAD ASSIGNMENT
  // --------------------------------------------------

  it("admin can assign a lead only to organization members", async () => {
    const lead = await createTestLead(ram);

    // Bina belongs to another organization.
    const invalid = await apiRequest(
      "PATCH",
      `/api/v1/leads/${lead.id}/assign`,
      ram.token,
      { assigned_to: bina.userId },
    );

    await expectJson(invalid, 400);

    // Hari belongs to Ram's organization.
    const valid = await apiRequest(
      "PATCH",
      `/api/v1/leads/${lead.id}/assign`,
      ram.token,
      { assigned_to: hari.userId },
    );

    const assigned = await expectJson<DataResponse<Lead>>(valid, 200);

    expect(assigned.data.assigned_to).toBe(hari.userId);

    // Hari can now access the lead.
    const hariResponse = await apiRequest(
      "GET",
      `/api/v1/leads/${lead.id}`,
      hari.token,
    );

    await expectJson(hariResponse, 200);

    // Gita is in the same organization but is not assigned.
    const gitaResponse = await apiRequest(
      "GET",
      `/api/v1/leads/${lead.id}`,
      gita.token,
    );

    await expectJson(gitaResponse, 404);
  });

  // --------------------------------------------------
  // CLEANUP
  // --------------------------------------------------

  afterAll(async () => {
    if (!ram) return;

    const failures: string[] = [];

    // Ram is an admin and can remove these test leads.
    // Related notes and activities are deleted by cascades.
    for (const leadId of createdLeadIds) {
      try {
        const response = await apiRequest(
          "DELETE",
          `/api/v1/leads/${leadId}`,
          ram.token,
        );

        if (response.status !== 200) {
          failures.push(`${leadId}: HTTP ${response.status}`);
        }
      } catch (error) {
        failures.push(`${leadId}: ${String(error)}`);
      }
    }

    expect(failures).toEqual([]);
  });
});
