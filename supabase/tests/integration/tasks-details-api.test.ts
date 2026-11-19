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

const LEAD_IN_A = "10000000-0000-4000-8000-000000000001";
const PRIVATE_LEAD_IN_A = "10000000-0000-4000-8000-000000000002";
const LEAD_IN_B = "20000000-0000-4000-8000-000000000001";

type Task = {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  priority: string;
  due_at: string | null;
  lead_id: string | null;
  assigned_to: string | null;
  status: string;
  completed_at: string | null;
};

const createdTasks: Array<{ id: string; owner: Session }> = [];

async function createFixture(
  owner: Session,
  input: {
    title: string;
    assigned_to?: string;
    lead_id?: string;
    priority?: "low" | "medium" | "high";
    description?: string;
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

async function updateDetails(
  token: string,
  taskId: string,
  body: unknown,
): Promise<Task> {
  const result = await expectJson<{ data: Task }>(
    await apiRequest("PATCH", `${PATH}/${taskId}/details`, token, body),
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

describe("Task Details API - Integration Tests", () => {
  let ram: Session;
  let hari: Session;
  let bina: Session;
  let ajay: Session;

  beforeAll(async () => {
    [ram, hari, bina, ajay] = await Promise.all([
      login("ram@gmail.com"),
      login("hari@gmail.com"),
      login("bina@gmail.com"),
      login("ajay@gmail.com"),
    ]);
  });

  afterAll(async () => {
    // Clean up only fixtures created by this suite.
    for (const { id, owner } of createdTasks.reverse()) {
      const response = await apiRequest("DELETE", `${PATH}/${id}`, owner.token);

      expect(response.status, `Could not delete task fixture ${id}`).toBe(200);
    }
  });

  // --------------------------------------------------
  // 1. AUTHENTICATION AND AUTHORIZATION
  // --------------------------------------------------

  it("rejects unauthenticated requests", async () => {
    const response = await apiRequest(
      "PATCH",
      `${PATH}/${randomUUID()}/details`,
      undefined,
      { title: "Updated" },
    );

    expect(response.status).toBe(401);
  });

  it("rejects users without organization membership", async () => {
    await expectError(
      await apiRequest("PATCH", `${PATH}/${randomUUID()}/details`, ajay.token, {
        title: "Updated",
      }),
      403,
      "ORGANIZATION_ACCESS_REQUIRED",
    );
  });

  it("prevents staff from updating task details through the API", async () => {
    const task = await createFixture(ram, {
      title: "Original title",
      assigned_to: hari.userId,
    });

    await expectError(
      await apiRequest("PATCH", `${PATH}/${task.id}/details`, hari.token, {
        title: "Unauthorized title",
      }),
      403,
      "FORBIDDEN",
    );

    const unchanged = await fetchTask(ram.token, task.id);
    expect(unchanged.title).toBe("Original title");
  });

  // --------------------------------------------------
  // 2. ADMIN TASK DETAIL UPDATES
  // --------------------------------------------------

  it("allows an admin to update all supported detail fields", async () => {
    const task = await createFixture(ram, {
      title: "Original follow-up",
      assigned_to: hari.userId,
    });

    const dueAt = "2026-12-15T10:00:00+05:45";

    const updated = await updateDetails(ram.token, task.id, {
      title: "  Schedule a demonstration  ",
      description: "  Confirm appointment  ",
      priority: "high",
      due_at: dueAt,
      lead_id: LEAD_IN_A,
    });

    expect(updated).toMatchObject({
      id: task.id,
      organization_id: ORG_A,
      title: "Schedule a demonstration",
      description: "Confirm appointment",
      priority: "high",
      lead_id: LEAD_IN_A,
      assigned_to: hari.userId,
      status: "todo",
      completed_at: null,
    });

    expect(Date.parse(updated.due_at!)).toBe(Date.parse(dueAt));
  });

  it("supports partial updates without changing other fields", async () => {
    const task = await createFixture(ram, {
      title: "Existing task",
      description: "Existing description",
      priority: "low",
    });

    const updated = await updateDetails(ram.token, task.id, {
      priority: "high",
    });

    expect(updated.title).toBe("Existing task");
    expect(updated.description).toBe("Existing description");
    expect(updated.priority).toBe("high");
    expect(updated.status).toBe("todo");
  });

  it("allows clearing nullable fields", async () => {
    const task = await createFixture(ram, {
      title: "Linked task",
      description: "Previous description",
      lead_id: LEAD_IN_A,
    });

    const updated = await updateDetails(ram.token, task.id, {
      description: null,
      due_at: null,
      lead_id: null,
    });

    expect(updated.description).toBeNull();
    expect(updated.due_at).toBeNull();
    expect(updated.lead_id).toBeNull();
  });

  it("keeps linked lead details private from assigned staff", async () => {
    const task = await createFixture(ram, {
      title: "Staff follow-up",
      assigned_to: hari.userId,
    });

    await updateDetails(ram.token, task.id, {
      lead_id: PRIVATE_LEAD_IN_A,
    });

    const result = await fetchTask(hari.token, task.id);

    expect(result.lead_id).toBe(PRIVATE_LEAD_IN_A);
    expect(result).not.toHaveProperty("lead");
    expect(result).not.toHaveProperty("leads");
  });

  // --------------------------------------------------
  // 3. ORGANIZATION AND REFERENCE VALIDATION
  // --------------------------------------------------

  it("prevents cross-organization task updates", async () => {
    const task = await createFixture(bina, {
      title: "Organization B task",
    });

    expect(task.organization_id).toBe(ORG_B);

    await expectError(
      await apiRequest("PATCH", `${PATH}/${task.id}/details`, ram.token, {
        title: "Unauthorized update",
      }),
      404,
      "TASK_NOT_FOUND",
    );

    const unchanged = await fetchTask(bina.token, task.id);
    expect(unchanged.title).toBe("Organization B task");
  });

  it("rejects a lead from another organization", async () => {
    const task = await createFixture(ram, {
      title: "Lead validation",
    });

    await expectError(
      await apiRequest("PATCH", `${PATH}/${task.id}/details`, ram.token, {
        lead_id: LEAD_IN_B,
      }),
      400,
      "INVALID_LEAD",
    );

    const unchanged = await fetchTask(ram.token, task.id);
    expect(unchanged.lead_id).toBeNull();
  });

  it("rejects a nonexistent linked lead", async () => {
    const task = await createFixture(ram, {
      title: "Nonexistent lead test",
    });

    await expectError(
      await apiRequest("PATCH", `${PATH}/${task.id}/details`, ram.token, {
        lead_id: randomUUID(),
      }),
      400,
      "INVALID_LEAD",
    );
  });

  // --------------------------------------------------
  // 4. DIRECT DATABASE SECURITY
  // --------------------------------------------------

  it.each([
    ["title", { title: "Direct staff edit" }],
    ["priority", { priority: "high" }],
    ["lead", { lead_id: null }],
  ])("blocks direct staff modification of %s", async (_field, body) => {
    const task = await createFixture(ram, {
      title: "Protected task",
      priority: "low",
      assigned_to: hari.userId,
      lead_id: PRIVATE_LEAD_IN_A,
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
        body: JSON.stringify(body),
      },
    );

    expect(response.status, await response.text()).toBe(403);

    const unchanged = await fetchTask(ram.token, task.id);

    expect(unchanged.title).toBe("Protected task");
    expect(unchanged.priority).toBe("low");
    expect(unchanged.lead_id).toBe(PRIVATE_LEAD_IN_A);
  });

  it("still allows staff to update assigned-task progress", async () => {
    const task = await createFixture(ram, {
      title: "Progress remains available",
      assigned_to: hari.userId,
    });

    const result = await expectJson<{ data: Task }>(
      await apiRequest("PATCH", `${PATH}/${task.id}`, hari.token, {
        status: "in_progress",
      }),
      200,
    );

    expect(result.data.status).toBe("in_progress");
  });

  // --------------------------------------------------
  // 5. REQUEST VALIDATION
  // --------------------------------------------------

  it("returns 404 for nonexistent tasks", async () => {
    await expectError(
      await apiRequest("PATCH", `${PATH}/${randomUUID()}/details`, ram.token, {
        title: "Updated",
      }),
      404,
      "TASK_NOT_FOUND",
    );
  });

  it("rejects malformed task IDs", async () => {
    await expectError(
      await apiRequest("PATCH", `${PATH}/not-a-uuid/details`, ram.token, {
        title: "Updated",
      }),
      400,
      "INVALID_UUID",
    );
  });

  it.each([
    {},
    { title: "" },
    { title: "   " },
    { title: "x".repeat(201) },
    { description: "x".repeat(5001) },
    { priority: "urgent" },
    { due_at: "tomorrow" },
    { lead_id: "not-a-uuid" },
    { status: "completed" },
    { assigned_to: randomUUID() },
    { organization_id: ORG_B },
    { completed_at: "2026-12-15T10:00:00Z" },
  ])("rejects invalid detail updates: %j", async (body) => {
    const task = await createFixture(ram, {
      title: "Validation test",
    });

    await expectError(
      await apiRequest("PATCH", `${PATH}/${task.id}/details`, ram.token, body),
      400,
      "VALIDATION_ERROR",
    );
  });

  it("rejects a missing request body", async () => {
    const task = await createFixture(ram, {
      title: "Missing body test",
    });

    await expectError(
      await apiRequest("PATCH", `${PATH}/${task.id}/details`, ram.token),
      400,
      "VALIDATION_ERROR",
    );
  });
});
