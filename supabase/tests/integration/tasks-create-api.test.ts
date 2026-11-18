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
  title: string;
  description: string | null;
  organization_id: string;
  assigned_to: string | null;
  lead_id: string | null;
  created_by: string | null;
  priority: string;
  status: string;
  due_at: string | null;
  completed_at: string | null;
};

const createdTasks: Array<{ id: string; owner: Session }> = [];

async function createAndTrack(owner: Session, body: unknown): Promise<Task> {
  const result = await expectJson<{ data: Task }>(
    await apiRequest("POST", PATH, owner.token, body),
    201,
  );

  createdTasks.push({
    id: result.data.id,
    owner,
  });

  return result.data;
}

describe("Task Creation API - Integration Tests", () => {
  let ram: Session;
  let hari: Session;
  let gita: Session;
  let bina: Session;
  let nima: Session;
  let ajay: Session;

  beforeAll(async () => {
    [ram, hari, gita, bina, nima, ajay] = await Promise.all([
      login("ram@gmail.com"),
      login("hari@gmail.com"),
      login("gita@gmail.com"),
      login("bina@gmail.com"),
      login("nima@gmail.com"),
      login("ajay@gmail.com"),
    ]);
  });

  afterAll(async () => {
    // Delete only tasks created by this test suite.
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

      expect(response.ok, `Cleanup failed for task ${id}`).toBe(true);
    }
  });

  it("rejects unauthenticated creation", async () => {
    const response = await apiRequest("POST", PATH, undefined, {
      title: "No auth",
    });

    expect(response.status).toBe(401);
  });

  it("rejects a user with no organization", async () => {
    await expectError(
      await apiRequest("POST", PATH, ajay.token, {
        title: "Not allowed",
      }),
      403,
      "ORGANIZATION_ACCESS_REQUIRED",
    );
  });

  it("prevents staff from creating tasks", async () => {
    await expectError(
      await apiRequest("POST", PATH, hari.token, {
        title: "Not allowed",
      }),
      403,
      "FORBIDDEN",
    );
  });

  it("allows an admin to create a minimal task", async () => {
    const task = await createAndTrack(ram, {
      title: "  Visit customer  ",
    });

    expect(task).toMatchObject({
      title: "Visit customer",
      organization_id: ORG_A,
      created_by: ram.userId,
      assigned_to: null,
      lead_id: null,
      status: "todo",
      priority: "medium",
      completed_at: null,
    });

    expect(task.id).toMatch(/^[0-9a-f-]{36}$/);

    const detail = await expectJson<{ data: Task }>(
      await apiRequest("GET", `${PATH}/${task.id}`, ram.token),
      200,
    );

    expect(detail.data.id).toBe(task.id);
  });

  it("allows an admin to assign and link a same-org lead", async () => {
    const dueAt = "2026-12-15T09:30:00+05:45";

    const task = await createAndTrack(ram, {
      title: "  Schedule a demo  ",
      description: "  Confirm customer availability  ",
      assigned_to: hari.userId,
      lead_id: LEAD_IN_A,
      priority: "high",
      due_at: dueAt,
    });

    expect(task).toMatchObject({
      organization_id: ORG_A,
      created_by: ram.userId,
      title: "Schedule a demo",
      description: "Confirm customer availability",
      assigned_to: hari.userId,
      lead_id: LEAD_IN_A,
      priority: "high",
      status: "todo",
    });

    expect(Date.parse(task.due_at!)).toBe(Date.parse(dueAt));

    const detail = await expectJson<{ data: Task }>(
      await apiRequest("GET", `${PATH}/${task.id}`, hari.token),
      200,
    );

    expect(detail.data.id).toBe(task.id);
  });

  it("isolates creation by organization", async () => {
    const task = await createAndTrack(bina, {
      title: "Organization B task",
    });

    expect(task.organization_id).toBe(ORG_B);
    expect(task.created_by).toBe(bina.userId);

    await expectError(
      await apiRequest("GET", `${PATH}/${task.id}`, ram.token),
      404,
      "TASK_NOT_FOUND",
    );
  });

  it("supports assigned tasks with inaccessible linked leads", async () => {
    const task = await createAndTrack(ram, {
      title: "Call after handoff",
      assigned_to: hari.userId,
      lead_id: PRIVATE_LEAD_IN_A,
    });

    const detail = await expectJson<{ data: Task }>(
      await apiRequest("GET", `${PATH}/${task.id}`, hari.token),
      200,
    );

    expect(detail.data.lead_id).toBe(PRIVATE_LEAD_IN_A);
    expect(detail.data).not.toHaveProperty("lead");
    expect(detail.data).not.toHaveProperty("leads");
  });

  it.each([
    { title: "" },
    { title: "   " },
    { title: "x".repeat(201) },
    { title: "Invalid", priority: "urgent" },
    { title: "Invalid", assigned_to: "abc" },
    { title: "Invalid", lead_id: "abc" },
    { title: "Invalid", due_at: "2026-12-15" },
    { title: "Invalid", due_at: "2026-12-15T09:30:00" },
  ])("rejects invalid task bodies: %j", async (body) => {
    await expectError(
      await apiRequest("POST", PATH, ram.token, body),
      400,
      "VALIDATION_ERROR",
    );
  });

  it.each([
    { title: "Spoof", organization_id: ORG_B },
    { title: "Spoof", created_by: randomUUID() },
    { title: "Spoof", status: "completed" },
    { title: "Spoof", completed_at: "2026-12-15T09:30:00Z" },
    { title: "Spoof", created_at: "2026-12-15T09:30:00Z" },
    { title: "Spoof", id: randomUUID() },
  ])(
    "rejects client-controlled identity and lifecycle fields: %j",
    async (body) => {
      await expectError(
        await apiRequest("POST", PATH, ram.token, body),
        400,
        "VALIDATION_ERROR",
      );
    },
  );

  it.each([
    ["nonmember", randomUUID()],
    ["another org member", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2"],
  ])("rejects an %s assignee", async (_reason, assigned_to) => {
    await expectError(
      await apiRequest("POST", PATH, ram.token, {
        title: "Invalid assignee",
        assigned_to,
      }),
      400,
      "INVALID_ASSIGNEE",
    );
  });

  it.each([
    ["nonexistent", randomUUID()],
    ["another org", LEAD_IN_B],
  ])("rejects a %s lead", async (_reason, lead_id) => {
    await expectError(
      await apiRequest("POST", PATH, ram.token, {
        title: "Invalid lead",
        lead_id,
      }),
      400,
      "INVALID_LEAD",
    );
  });

  it("does not allow staff from either organization to create tasks", async () => {
    await expectError(
      await apiRequest("POST", PATH, nima.token, {
        title: "No permission",
      }),
      403,
      "FORBIDDEN",
    );

    await expectError(
      await apiRequest("POST", PATH, gita.token, {
        title: "No permission",
      }),
      403,
      "FORBIDDEN",
    );
  });
});
