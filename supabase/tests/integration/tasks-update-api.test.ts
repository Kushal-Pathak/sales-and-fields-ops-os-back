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
  status: string;
  completed_at: string | null;
  updated_at: string;
};

const createdTasks: Array<{ id: string; owner: Session }> = [];

// Create temporary tasks directly through Supabase using a real admin token.
async function createFixture(
  owner: Session,
  organizationId: string,
  assignedTo: string | null,
  leadId?: string,
): Promise<string> {
  const id = randomUUID();

  const response = await fetch(`${SUPABASE_URL}/rest/v1/tasks`, {
    method: "POST",
    headers: {
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${owner.token}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      id,
      organization_id: organizationId,
      assigned_to: assignedTo,
      title: "Task progress API test",
      ...(leadId ? { lead_id: leadId } : {}),
    }),
  });

  expect(response.status, await response.text()).toBe(201);

  createdTasks.push({ id, owner });

  return id;
}

async function updateStatus(
  token: string,
  taskId: string,
  status: string,
): Promise<Task> {
  const response = await apiRequest("PATCH", `${PATH}/${taskId}`, token, {
    status,
  });

  const result = await expectJson<{ data: Task }>(response, 200);

  return result.data;
}

describe("Task Progress API - Integration Tests", () => {
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
    // Delete only the tasks created by this test file.
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

      expect(response.ok, `Failed to delete task fixture ${id}`).toBe(true);
    }
  });

  // --------------------------------------------------
  // 1. AUTHENTICATION AND AUTHORIZATION
  // --------------------------------------------------

  it("rejects unauthenticated requests", async () => {
    const response = await apiRequest(
      "PATCH",
      `${PATH}/${randomUUID()}`,
      undefined,
      { status: "in_progress" },
    );

    expect(response.status).toBe(401);
  });

  it("rejects users without an organization", async () => {
    await expectError(
      await apiRequest("PATCH", `${PATH}/${randomUUID()}`, ajay.token, {
        status: "in_progress",
      }),
      403,
      "ORGANIZATION_ACCESS_REQUIRED",
    );
  });

  it("allows an admin to update an unassigned organization task", async () => {
    const id = await createFixture(ram, ORG_A, null);

    const task = await updateStatus(ram.token, id, "in_progress");

    expect(task).toMatchObject({
      id,
      organization_id: ORG_A,
      status: "in_progress",
      completed_at: null,
    });
  });

  it("allows staff to update their assigned task", async () => {
    const id = await createFixture(ram, ORG_A, hari.userId);

    const task = await updateStatus(hari.token, id, "in_progress");

    expect(task.status).toBe("in_progress");
    expect(task.assigned_to).toBe(hari.userId);
  });

  it("prevents staff from updating another staff member's task", async () => {
    const id = await createFixture(ram, ORG_A, gita.userId);

    await expectError(
      await apiRequest("PATCH", `${PATH}/${id}`, hari.token, {
        status: "completed",
      }),
      404,
      "TASK_NOT_FOUND",
    );
  });

  it("prevents staff from updating unassigned tasks", async () => {
    const id = await createFixture(ram, ORG_A, null);

    await expectError(
      await apiRequest("PATCH", `${PATH}/${id}`, hari.token, {
        status: "completed",
      }),
      404,
      "TASK_NOT_FOUND",
    );
  });

  it("prevents cross-organization task updates", async () => {
    const id = await createFixture(bina, ORG_B, null);

    await expectError(
      await apiRequest("PATCH", `${PATH}/${id}`, ram.token, {
        status: "completed",
      }),
      404,
      "TASK_NOT_FOUND",
    );
  });

  it("allows updating an assigned task with an inaccessible linked lead", async () => {
    const id = await createFixture(ram, ORG_A, hari.userId, PRIVATE_LEAD_ID);

    const task = await updateStatus(hari.token, id, "completed");

    expect(task.status).toBe("completed");
    expect(task.completed_at).not.toBeNull();
  });

  // --------------------------------------------------
  // 2. TASK LIFECYCLE
  // --------------------------------------------------

  it("sets completed_at when a task is completed", async () => {
    const id = await createFixture(ram, ORG_A, hari.userId);

    const task = await updateStatus(hari.token, id, "completed");

    expect(task.status).toBe("completed");
    expect(task.completed_at).not.toBeNull();
    expect(Number.isNaN(Date.parse(task.completed_at!))).toBe(false);
  });

  it("clears completed_at when a completed task is reopened", async () => {
    const id = await createFixture(ram, ORG_A, hari.userId);

    const completed = await updateStatus(hari.token, id, "completed");
    expect(completed.completed_at).not.toBeNull();

    const reopened = await updateStatus(hari.token, id, "in_progress");

    expect(reopened.status).toBe("in_progress");
    expect(reopened.completed_at).toBeNull();
  });

  it("supports cancellation and reopening a cancelled task", async () => {
    const id = await createFixture(ram, ORG_A, hari.userId);

    const cancelled = await updateStatus(hari.token, id, "cancelled");

    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.completed_at).toBeNull();

    const reopened = await updateStatus(hari.token, id, "todo");

    expect(reopened.status).toBe("todo");
  });

  it("rejects invalid transitions without changing the task", async () => {
    const id = await createFixture(ram, ORG_A, hari.userId);

    const completed = await updateStatus(hari.token, id, "completed");

    await expectError(
      await apiRequest("PATCH", `${PATH}/${id}`, hari.token, {
        status: "todo",
      }),
      409,
      "INVALID_STATUS_TRANSITION",
    );

    const response = await apiRequest("GET", `${PATH}/${id}`, hari.token);

    const result = await expectJson<{ data: Task }>(response, 200);

    expect(result.data.status).toBe("completed");
    expect(result.data.completed_at).toBe(completed.completed_at);
  });

  it("treats an unchanged status as a no-op", async () => {
    const id = await createFixture(ram, ORG_A, hari.userId);

    const completed = await updateStatus(hari.token, id, "completed");

    const repeated = await updateStatus(hari.token, id, "completed");

    expect(repeated.status).toBe("completed");
    expect(repeated.completed_at).toBe(completed.completed_at);
    expect(repeated.updated_at).toBe(completed.updated_at);
  });

  // --------------------------------------------------
  // 3. REQUEST VALIDATION
  // --------------------------------------------------

  it("returns 404 for a nonexistent task", async () => {
    await expectError(
      await apiRequest("PATCH", `${PATH}/${randomUUID()}`, ram.token, {
        status: "completed",
      }),
      404,
      "TASK_NOT_FOUND",
    );
  });

  it("returns 400 for an invalid task UUID", async () => {
    await expectError(
      await apiRequest("PATCH", `${PATH}/not-a-uuid`, ram.token, {
        status: "completed",
      }),
      400,
      "INVALID_UUID",
    );
  });

  it.each([
    {},
    { status: "pending" },
    { status: null },
    { status: 123 },
    { status: "completed", completed_at: "2026-11-18T10:00:00Z" },
    { status: "todo", assigned_to: randomUUID() },
    { status: "todo", title: "Changed task title" },
    { status: "todo", organization_id: ORG_B },
  ])("rejects invalid update bodies: %j", async (body) => {
    const id = await createFixture(ram, ORG_A, null);

    await expectError(
      await apiRequest("PATCH", `${PATH}/${id}`, ram.token, body),
      400,
      "VALIDATION_ERROR",
    );
  });

  it("rejects a missing JSON request body", async () => {
    const id = await createFixture(ram, ORG_A, null);

    await expectError(
      await apiRequest("PATCH", `${PATH}/${id}`, ram.token),
      400,
      "VALIDATION_ERROR",
    );
  });
});
