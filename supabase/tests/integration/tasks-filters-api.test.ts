import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  apiRequest,
  expectError,
  expectJson,
  login,
  type Session,
} from "./helpers";

const PATH = "/api/v1/tasks";

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";
const LEAD_A = "10000000-0000-4000-8000-000000000001";

const prefix = `TaskFilter-${randomUUID().slice(0, 8)}`;

const DAY = 24 * 60 * 60 * 1000;
const pastDue = new Date(Date.now() - 7 * DAY).toISOString();
const futureDue = new Date(Date.now() + 7 * DAY).toISOString();

type Task = {
  id: string;
  organization_id: string;
  title: string;
  assigned_to: string | null;
  lead_id: string | null;
  priority: string;
  status: string;
  due_at: string | null;
};

type TasksResponse = {
  data: Task[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
};

const createdTasks: Array<{
  id: string;
  owner: Session;
}> = [];

async function createFixture(
  owner: Session,
  input: {
    title: string;
    assigned_to?: string;
    lead_id?: string;
    priority?: "low" | "medium" | "high";
    due_at?: string;
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

async function fetchTasks(
  token: string,
  params: Record<string, string>,
): Promise<TasksResponse> {
  const query = new URLSearchParams({
    limit: "100",
    ...params,
  });

  return expectJson<TasksResponse>(
    await apiRequest("GET", `${PATH}?${query}`, token),
    200,
  );
}

describe("Advanced Task Filtering API - Integration Tests", () => {
  let ram: Session;
  let hari: Session;
  let gita: Session;
  let bina: Session;

  let overdueHari: Task;
  let futureGita: Task;
  let completedPast: Task;
  let unassigned: Task;
  let linkedLead: Task;
  let otherOrganization: Task;

  beforeAll(async () => {
    [ram, hari, gita, bina] = await Promise.all([
      login("ram@gmail.com"),
      login("hari@gmail.com"),
      login("gita@gmail.com"),
      login("bina@gmail.com"),
    ]);

    overdueHari = await createFixture(ram, {
      title: `${prefix} Overdue Hari`,
      assigned_to: hari.userId,
      priority: "high",
      due_at: pastDue,
    });

    futureGita = await createFixture(ram, {
      title: `${prefix} Future Gita`,
      assigned_to: gita.userId,
      priority: "low",
      due_at: futureDue,
    });

    completedPast = await createFixture(ram, {
      title: `${prefix} Finished Past`,
      assigned_to: hari.userId,
      priority: "medium",
      due_at: pastDue,
    });

    await expectJson<{ data: Task }>(
      await apiRequest("PATCH", `${PATH}/${completedPast.id}`, ram.token, {
        status: "completed",
      }),
      200,
    );

    unassigned = await createFixture(ram, {
      title: `${prefix} Unassigned`,
      priority: "medium",
    });

    linkedLead = await createFixture(ram, {
      title: `${prefix} Linked Lead`,
      assigned_to: gita.userId,
      lead_id: LEAD_A,
    });

    otherOrganization = await createFixture(bina, {
      title: `${prefix} Other Organization`,
      assigned_to: bina.userId,
      priority: "high",
    });
  });

  afterAll(async () => {
    // Delete only fixtures created by this test file.
    for (const { id, owner } of createdTasks.reverse()) {
      const response = await apiRequest("DELETE", `${PATH}/${id}`, owner.token);

      expect(response.status).toBe(200);
    }
  });

  it("searches task titles case-insensitively", async () => {
    const result = await fetchTasks(ram.token, {
      search: `${prefix} OVERDUE HARI`.toUpperCase(),
    });

    expect(result.data.map((task) => task.id)).toEqual([overdueHari.id]);
    expect(result.pagination.total).toBe(1);
  });

  it("filters tasks by assignee", async () => {
    const result = await fetchTasks(ram.token, {
      search: prefix,
      assignedTo: hari.userId,
    });

    const ids = result.data.map((task) => task.id);

    expect(ids).toContain(overdueHari.id);
    expect(ids).toContain(completedPast.id);
    expect(ids).not.toContain(futureGita.id);

    expect(result.data.every((task) => task.assigned_to === hari.userId)).toBe(
      true,
    );
  });

  it("finds unassigned tasks", async () => {
    const result = await fetchTasks(ram.token, {
      search: prefix,
      assignedTo: "unassigned",
    });

    expect(result.data.map((task) => task.id)).toEqual([unassigned.id]);

    expect(result.data[0].assigned_to).toBeNull();
  });

  it("filters tasks by linked lead", async () => {
    const result = await fetchTasks(ram.token, {
      search: prefix,
      leadId: LEAD_A,
    });

    expect(result.data.map((task) => task.id)).toEqual([linkedLead.id]);

    expect(result.data[0].lead_id).toBe(LEAD_A);
  });

  it("filters tasks within a due-date range", async () => {
    const now = new Date().toISOString();
    const upperBound = new Date(Date.now() + 30 * DAY).toISOString();

    const result = await fetchTasks(ram.token, {
      search: prefix,
      dueAfter: now,
      dueBefore: upperBound,
    });

    expect(result.data.map((task) => task.id)).toEqual([futureGita.id]);

    expect(
      result.data.every((task) => {
        const due = new Date(task.due_at!).getTime();

        return due >= Date.parse(now) && due <= Date.parse(upperBound);
      }),
    ).toBe(true);
  });

  it("returns overdue tasks but excludes completed tasks", async () => {
    const result = await fetchTasks(ram.token, {
      search: prefix,
      overdue: "true",
    });

    const ids = result.data.map((task) => task.id);

    expect(ids).toContain(overdueHari.id);
    expect(ids).not.toContain(completedPast.id);
    expect(ids).not.toContain(futureGita.id);

    expect(
      result.data.every(
        (task) =>
          task.due_at !== null &&
          Date.parse(task.due_at) < Date.now() &&
          ["todo", "in_progress"].includes(task.status),
      ),
    ).toBe(true);
  });

  it("does not apply the overdue filter when false", async () => {
    const result = await fetchTasks(ram.token, {
      search: prefix,
      overdue: "false",
    });

    expect(result.data).toHaveLength(5);
    expect(result.pagination.total).toBe(5);
  });

  it("combines multiple filters correctly", async () => {
    const result = await fetchTasks(ram.token, {
      search: prefix,
      assignedTo: hari.userId,
      status: "todo",
      priority: "high",
      overdue: "true",
    });

    expect(result.data.map((task) => task.id)).toEqual([overdueHari.id]);

    expect(result.pagination.total).toBe(1);
  });

  it("preserves pagination with filtered results", async () => {
    const page1 = await fetchTasks(ram.token, {
      search: prefix,
      page: "1",
      limit: "2",
    });

    const page2 = await fetchTasks(ram.token, {
      search: prefix,
      page: "2",
      limit: "2",
    });

    expect(page1.data).toHaveLength(2);
    expect(page2.data).toHaveLength(2);

    expect(page1.pagination.total).toBe(5);
    expect(page2.pagination.total).toBe(5);

    expect(page1.data[0].id).not.toBe(page2.data[0].id);
  });

  it("keeps staff task visibility restricted by RLS", async () => {
    const result = await fetchTasks(hari.token, {
      search: prefix,
    });

    const ids = result.data.map((task) => task.id);

    expect(ids).toContain(overdueHari.id);
    expect(ids).toContain(completedPast.id);
    expect(ids).not.toContain(futureGita.id);
    expect(ids).not.toContain(unassigned.id);

    expect(result.data.every((task) => task.assigned_to === hari.userId)).toBe(
      true,
    );
  });

  it("does not reveal cross-organization tasks", async () => {
    const result = await fetchTasks(ram.token, {
      search: prefix,
    });

    expect(result.data).toHaveLength(5);

    expect(result.data.some((task) => task.id === otherOrganization.id)).toBe(
      false,
    );

    expect(result.data.every((task) => task.organization_id === ORG_A)).toBe(
      true,
    );

    const orgB = await fetchTasks(bina.token, {
      search: prefix,
    });

    expect(orgB.data.map((task) => task.id)).toEqual([otherOrganization.id]);

    expect(orgB.data[0].organization_id).toBe(ORG_B);
  });

  it("does not expose another organization's tasks through assignee filters", async () => {
    const result = await fetchTasks(ram.token, {
      search: prefix,
      assignedTo: bina.userId,
    });

    expect(result.data).toEqual([]);
    expect(result.pagination.total).toBe(0);
  });

  it.each([
    "assignedTo=invalid-id",
    "leadId=invalid-id",
    "overdue=yes",
    "dueAfter=tomorrow",
    "dueBefore=next-week",
    "search=",
    "search=%20%20%20",
    "dueAfter=2026-12-10T00%3A00%3A00Z&dueBefore=2026-12-01T00%3A00%3A00Z",
  ])("rejects invalid filters: %s", async (query) => {
    await expectError(
      await apiRequest("GET", `${PATH}?${query}`, ram.token),
      400,
      "VALIDATION_ERROR",
    );
  });
});
