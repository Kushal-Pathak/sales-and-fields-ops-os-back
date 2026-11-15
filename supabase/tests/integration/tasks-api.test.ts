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

type Task = {
  id: string;
  organization_id: string;
  assigned_to: string | null;
  lead_id: string | null;
  status: string;
  priority: string;
};

type TasksResponse = {
  data: Task[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
};

const TASKS_PATH = "/api/v1/tasks";
const SUPABASE_URL = getTestEnv("SUPABASE_URL");
const PUBLISHABLE_KEY = getTestEnv("SUPABASE_PUBLISHABLE_KEY");
const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";
const PRIVATE_LEAD_ID = "10000000-0000-4000-8000-000000000002";

const taskIds = {
  assignedToHari: randomUUID(),
  assignedToHariPrivateLead: randomUUID(),
  assignedToGita: randomUUID(),
  unassigned: randomUUID(),
  otherOrganization: randomUUID(),
};

const createdTasks: Array<{ id: string; owner: Session }> = [];

// Create only temporary fixtures, using real admin credentials and RLS.
async function createFixture(
  owner: Session,
  task: {
    id: string;
    organization_id: string;
    title: string;
    assigned_to: string | null;
    priority: "low" | "medium" | "high";
    lead_id?: string;
  },
) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/tasks`, {
    method: "POST",
    headers: {
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${owner.token}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(task),
  });

  expect(response.status, await response.text()).toBe(201);
  createdTasks.push({ id: task.id, owner });
}

async function fetchTasks(token: string, query = "") {
  const response = await apiRequest("GET", `${TASKS_PATH}${query}`, token);
  return expectJson<TasksResponse>(response, 200);
}

describe("Task Listing API - Integration Tests", () => {
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

    await createFixture(ram, {
      id: taskIds.assignedToHari,
      organization_id: ORG_A,
      title: "Task API test: Hari follow-up",
      assigned_to: hari.userId,
      priority: "high",
    });

    await createFixture(ram, {
      id: taskIds.assignedToHariPrivateLead,
      organization_id: ORG_A,
      title: "Task API test: assigned task with another staff's lead",
      assigned_to: hari.userId,
      lead_id: PRIVATE_LEAD_ID,
      priority: "high",
    });

    await createFixture(ram, {
      id: taskIds.assignedToGita,
      organization_id: ORG_A,
      title: "Task API test: Gita follow-up",
      assigned_to: gita.userId,
      priority: "low",
    });

    await createFixture(ram, {
      id: taskIds.unassigned,
      organization_id: ORG_A,
      title: "Task API test: unassigned",
      assigned_to: null,
      priority: "medium",
    });

    await createFixture(bina, {
      id: taskIds.otherOrganization,
      organization_id: ORG_B,
      title: "Task API test: other organization",
      assigned_to: null,
      priority: "high",
    });
  });

  afterAll(async () => {
    // Delete only the fixtures created by this file; never reset TEST data.
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

      expect(response.ok, `Could not delete task fixture ${id}`).toBe(true);
    }
  });

  it("rejects unauthenticated requests", async () => {
    const response = await apiRequest("GET", TASKS_PATH);
    expect(response.status).toBe(401);
  });

  it("rejects users without organization membership", async () => {
    await expectError(
      await apiRequest("GET", TASKS_PATH, ajay.token),
      403,
      "ORGANIZATION_ACCESS_REQUIRED",
    );
  });

  it("lets an admin list all tasks in their organization only", async () => {
    const result = await fetchTasks(ram.token, "?limit=100");
    const ids = new Set(result.data.map((task) => task.id));

    for (const id of [
      taskIds.assignedToHari,
      taskIds.assignedToHariPrivateLead,
      taskIds.assignedToGita,
      taskIds.unassigned,
    ]) {
      expect(ids.has(id)).toBe(true);
    }

    expect(ids.has(taskIds.otherOrganization)).toBe(false);
    expect(result.data.every((task) => task.organization_id === ORG_A)).toBe(
      true,
    );
    expect(result.pagination.total).toBeGreaterThanOrEqual(4);
  });

  it("lets staff view only their assigned tasks, even with an inaccessible linked lead", async () => {
    const result = await fetchTasks(hari.token, "?limit=100");
    const ids = new Set(result.data.map((task) => task.id));

    expect(ids.has(taskIds.assignedToHari)).toBe(true);
    expect(ids.has(taskIds.assignedToHariPrivateLead)).toBe(true);
    expect(ids.has(taskIds.assignedToGita)).toBe(false);
    expect(ids.has(taskIds.unassigned)).toBe(false);
    expect(result.data.every((task) => task.assigned_to === hari.userId)).toBe(
      true,
    );
  });

  it("isolates a different organization's admin", async () => {
    const result = await fetchTasks(bina.token, "?limit=100");
    const ids = new Set(result.data.map((task) => task.id));

    expect(ids.has(taskIds.otherOrganization)).toBe(true);
    expect(ids.has(taskIds.assignedToHari)).toBe(false);
    expect(result.data.every((task) => task.organization_id === ORG_B)).toBe(
      true,
    );
  });

  it("filters by status and priority", async () => {
    const result = await fetchTasks(
      ram.token,
      "?status=todo&priority=high&limit=100",
    );
    const ids = new Set(result.data.map((task) => task.id));

    expect(ids.has(taskIds.assignedToHari)).toBe(true);
    expect(ids.has(taskIds.assignedToHariPrivateLead)).toBe(true);
    expect(result.data.every((task) => task.status === "todo")).toBe(true);
    expect(result.data.every((task) => task.priority === "high")).toBe(true);
  });

  it("supports pagination without repeating rows", async () => {
    const first = await fetchTasks(ram.token, "?page=1&limit=1");
    const second = await fetchTasks(ram.token, "?page=2&limit=1");

    expect(first.data).toHaveLength(1);
    expect(second.data).toHaveLength(1);
    expect(first.data[0].id).not.toBe(second.data[0].id);
    expect(first.pagination).toMatchObject({ page: 1, limit: 1 });
    expect(first.pagination.total).toBeGreaterThanOrEqual(4);
  });

  it("returns an empty page when the page is out of range", async () => {
    const result = await fetchTasks(ram.token, "?page=999999&limit=20");
    expect(result.data).toEqual([]);
    expect(result.pagination.total).toBeGreaterThanOrEqual(4);
  });

  it.each([
    "?page=0",
    "?limit=101",
    "?status=pending",
    "?priority=urgent",
    "?sortOrder=random",
  ])("rejects invalid query parameters: %s", async (query) => {
    await expectError(
      await apiRequest("GET", `${TASKS_PATH}${query}`, ram.token),
      400,
      "VALIDATION_ERROR",
    );
  });
});
