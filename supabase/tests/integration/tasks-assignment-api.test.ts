import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  apiRequest,
  expectError,
  expectJson,
  getTestEnv,
  login,
  type Session,
} from "./helpers";

const PATH = "/api/v1/tasks";

const SUPABASE_URL = getTestEnv("SUPABASE_URL");
const PUBLISHABLE_KEY = getTestEnv("SUPABASE_PUBLISHABLE_KEY");

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";
const PRIVATE_LEAD_ID = "10000000-0000-4000-8000-000000000002";

type Task = {
  id: string;
  organization_id: string;
  assigned_to: string | null;
  lead_id: string | null;
  title: string;
  status: string;
};

const createdTasks: Array<{ id: string; owner: Session }> = [];

async function createFixture(
  owner: Session,
  input: {
    title: string;
    assigned_to?: string;
    lead_id?: string;
  },
): Promise<Task> {
  const result = await expectJson<{ data: Task }>(
    await apiRequest("POST", PATH, owner.token, input),
    201,
  );

  createdTasks.push({
    id: result.data.id,
    owner,
  });

  return result.data;
}

async function assignFixture(
  token: string,
  taskId: string,
  assignedTo: string | null,
): Promise<Task> {
  const result = await expectJson<{ data: Task }>(
    await apiRequest("PATCH", `${PATH}/${taskId}/assign`, token, {
      assigned_to: assignedTo,
    }),
    200,
  );

  return result.data;
}

async function fetchTask(token: string, taskId: string): Promise<Task> {
  const result = await expectJson<{ data: Task }>(
    await apiRequest("GET", `${PATH}/${taskId}`, token),
    200,
  );

  return result.data;
}

describe("Task Assignment API - Integration Tests", () => {
  let ram: Session;
  let hari: Session;
  let gita: Session;
  let bina: Session;
  let ajay: Session;

  beforeAll(async () => {
    [ram, hari, gita, bina, ajay] = await Promise.all([
      login("ram@gmail.com"),
      login("hari@gmail.com"),
      login("gita@gmail.com"),
      login("bina@gmail.com"),
      login("ajay@gmail.com"),
    ]);
  });

  afterAll(async () => {
    // Remove only the tasks created by this test file.
    for (const { id, owner } of createdTasks.reverse()) {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/tasks?id=eq.${id}`,
        {
          method: "DELETE",
          headers: {
            apikey: PUBLISHABLE_KEY,
            Authorization: `Bearer ${owner.token}`,
          },
        },
      );

      expect(response.ok, `Failed to clean up task ${id}`).toBe(true);
    }
  });

  // --------------------------------------------------
  // 1. AUTHENTICATION AND AUTHORIZATION
  // --------------------------------------------------

  it("rejects unauthenticated assignment requests", async () => {
    const response = await apiRequest(
      "PATCH",
      `${PATH}/${randomUUID()}/assign`,
      undefined,
      { assigned_to: null },
    );

    expect(response.status).toBe(401);
  });

  it("rejects users without organization membership", async () => {
    await expectError(
      await apiRequest("PATCH", `${PATH}/${randomUUID()}/assign`, ajay.token, {
        assigned_to: null,
      }),
      403,
      "ORGANIZATION_ACCESS_REQUIRED",
    );
  });

  it("prevents staff from assigning tasks through the API", async () => {
    const task = await createFixture(ram, {
      title: "Staff assignment restriction",
      assigned_to: hari.userId,
    });

    await expectError(
      await apiRequest("PATCH", `${PATH}/${task.id}/assign`, hari.token, {
        assigned_to: gita.userId,
      }),
      403,
      "FORBIDDEN",
    );

    const unchanged = await fetchTask(hari.token, task.id);
    expect(unchanged.assigned_to).toBe(hari.userId);
  });

  // --------------------------------------------------
  // 2. ADMIN ASSIGNMENT OPERATIONS
  // --------------------------------------------------

  it("allows an admin to assign an unassigned task", async () => {
    const task = await createFixture(ram, {
      title: "Task to assign",
    });

    expect(task.assigned_to).toBeNull();

    const assigned = await assignFixture(ram.token, task.id, hari.userId);

    expect(assigned).toMatchObject({
      id: task.id,
      organization_id: ORG_A,
      assigned_to: hari.userId,
    });

    const staffTask = await fetchTask(hari.token, task.id);
    expect(staffTask.id).toBe(task.id);
  });

  it("allows an admin to reassign a task", async () => {
    const task = await createFixture(ram, {
      title: "Task to reassign",
      assigned_to: hari.userId,
    });

    const reassigned = await assignFixture(ram.token, task.id, gita.userId);

    expect(reassigned.assigned_to).toBe(gita.userId);

    // The previous assignee loses access.
    await expectError(
      await apiRequest("GET", `${PATH}/${task.id}`, hari.token),
      404,
      "TASK_NOT_FOUND",
    );

    // The new assignee gains access.
    const staffTask = await fetchTask(gita.token, task.id);
    expect(staffTask.assigned_to).toBe(gita.userId);
  });

  it("allows an admin to unassign a task", async () => {
    const task = await createFixture(ram, {
      title: "Task to unassign",
      assigned_to: hari.userId,
    });

    const unassigned = await assignFixture(ram.token, task.id, null);

    expect(unassigned.assigned_to).toBeNull();

    await expectError(
      await apiRequest("GET", `${PATH}/${task.id}`, hari.token),
      404,
      "TASK_NOT_FOUND",
    );

    const adminTask = await fetchTask(ram.token, task.id);
    expect(adminTask.assigned_to).toBeNull();
  });

  it("allows assigning a task to its current assignee", async () => {
    const task = await createFixture(ram, {
      title: "Repeat assignment",
      assigned_to: hari.userId,
    });

    const result = await assignFixture(ram.token, task.id, hari.userId);

    expect(result.id).toBe(task.id);
    expect(result.assigned_to).toBe(hari.userId);
  });

  it("keeps task visibility independent of linked lead visibility", async () => {
    const task = await createFixture(ram, {
      title: "Task linked to another staff member's lead",
      assigned_to: gita.userId,
      lead_id: PRIVATE_LEAD_ID,
    });

    // Hari cannot normally view Gita's lead, but can see an
    // assigned task without exposing joined lead information.
    const assigned = await assignFixture(ram.token, task.id, hari.userId);

    expect(assigned.lead_id).toBe(PRIVATE_LEAD_ID);

    const result = await fetchTask(hari.token, task.id);

    expect(result.assigned_to).toBe(hari.userId);
    expect(result.lead_id).toBe(PRIVATE_LEAD_ID);
    expect(result).not.toHaveProperty("lead");
    expect(result).not.toHaveProperty("leads");
  });

  // --------------------------------------------------
  // 3. ORGANIZATION ISOLATION
  // --------------------------------------------------

  it("prevents an admin from reassigning another organization's task", async () => {
    const task = await createFixture(bina, {
      title: "Organization B task",
    });

    expect(task.organization_id).toBe(ORG_B);

    await expectError(
      await apiRequest("PATCH", `${PATH}/${task.id}/assign`, ram.token, {
        assigned_to: null,
      }),
      404,
      "TASK_NOT_FOUND",
    );

    const unchanged = await fetchTask(bina.token, task.id);
    expect(unchanged.assigned_to).toBeNull();
  });

  it("enforces organization isolation in both directions", async () => {
    const task = await createFixture(ram, {
      title: "Organization A task",
      assigned_to: hari.userId,
    });

    await expectError(
      await apiRequest("PATCH", `${PATH}/${task.id}/assign`, bina.token, {
        assigned_to: null,
      }),
      404,
      "TASK_NOT_FOUND",
    );

    const unchanged = await fetchTask(ram.token, task.id);
    expect(unchanged.assigned_to).toBe(hari.userId);
  });

  it("rejects an assignee from another organization", async () => {
    const task = await createFixture(ram, {
      title: "Cross-organization assignment",
    });

    await expectError(
      await apiRequest("PATCH", `${PATH}/${task.id}/assign`, ram.token, {
        assigned_to: bina.userId,
      }),
      400,
      "INVALID_ASSIGNEE",
    );

    const unchanged = await fetchTask(ram.token, task.id);
    expect(unchanged.assigned_to).toBeNull();
  });

  it("rejects a user who is not an organization member", async () => {
    const task = await createFixture(ram, {
      title: "Invalid assignee test",
    });

    await expectError(
      await apiRequest("PATCH", `${PATH}/${task.id}/assign`, ram.token, {
        assigned_to: randomUUID(),
      }),
      400,
      "INVALID_ASSIGNEE",
    );
  });

  // --------------------------------------------------
  // 4. DIRECT DATABASE SECURITY
  // --------------------------------------------------

  it("prevents staff from directly reassigning a task in Supabase", async () => {
    const task = await createFixture(ram, {
      title: "Direct RLS reassignment test",
      assigned_to: hari.userId,
    });

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/tasks?id=eq.${task.id}`,
      {
        method: "PATCH",
        headers: {
          apikey: PUBLISHABLE_KEY,
          Authorization: `Bearer ${hari.token}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          assigned_to: gita.userId,
        }),
      },
    );

    expect(response.status, await response.text()).toBe(403);

    const unchanged = await fetchTask(hari.token, task.id);
    expect(unchanged.assigned_to).toBe(hari.userId);
  });

  it("prevents staff from directly unassigning a task in Supabase", async () => {
    const task = await createFixture(ram, {
      title: "Direct RLS unassignment test",
      assigned_to: hari.userId,
    });

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/tasks?id=eq.${task.id}`,
      {
        method: "PATCH",
        headers: {
          apikey: PUBLISHABLE_KEY,
          Authorization: `Bearer ${hari.token}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          assigned_to: null,
        }),
      },
    );

    expect(response.status, await response.text()).toBe(403);

    const unchanged = await fetchTask(hari.token, task.id);
    expect(unchanged.assigned_to).toBe(hari.userId);
  });

  // --------------------------------------------------
  // 5. REQUEST VALIDATION
  // --------------------------------------------------

  it("returns 404 when the task does not exist", async () => {
    await expectError(
      await apiRequest("PATCH", `${PATH}/${randomUUID()}/assign`, ram.token, {
        assigned_to: null,
      }),
      404,
      "TASK_NOT_FOUND",
    );
  });

  it("returns 400 for an invalid task UUID", async () => {
    await expectError(
      await apiRequest("PATCH", `${PATH}/not-a-uuid/assign`, ram.token, {
        assigned_to: null,
      }),
      400,
      "INVALID_UUID",
    );
  });

  it.each([
    {},
    { assigned_to: "" },
    { assigned_to: "not-a-uuid" },
    { assigned_to: 123 },
    { assigned_to: null, title: "Unauthorized change" },
    { assigned_to: null, status: "completed" },
    { assigned_to: null, organization_id: ORG_B },
  ])("rejects invalid assignment bodies: %j", async (body) => {
    const task = await createFixture(ram, {
      title: "Assignment validation test",
    });

    await expectError(
      await apiRequest("PATCH", `${PATH}/${task.id}/assign`, ram.token, body),
      400,
      "VALIDATION_ERROR",
    );
  });

  it("rejects a missing request body", async () => {
    const task = await createFixture(ram, {
      title: "Missing body test",
    });

    await expectError(
      await apiRequest("PATCH", `${PATH}/${task.id}/assign`, ram.token),
      400,
      "VALIDATION_ERROR",
    );
  });
});
