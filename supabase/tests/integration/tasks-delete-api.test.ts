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
  title: string;
  organization_id: string;
  assigned_to: string | null;
  lead_id: string | null;
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

async function deleteFixture(token: string, taskId: string): Promise<Task> {
  const result = await expectJson<{ data: Task }>(
    await apiRequest("DELETE", `${PATH}/${taskId}`, token),
    200,
  );

  return result.data;
}

describe("Task Deletion API - Integration Tests", () => {
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
    // Clean up only fixtures created by this test file.
    // Deleting an already deleted task is safe.
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

  it("rejects unauthenticated deletion requests", async () => {
    const response = await apiRequest("DELETE", `${PATH}/${randomUUID()}`);

    expect(response.status).toBe(401);
  });

  it("rejects users without organization membership", async () => {
    await expectError(
      await apiRequest("DELETE", `${PATH}/${randomUUID()}`, ajay.token),
      403,
      "ORGANIZATION_ACCESS_REQUIRED",
    );
  });

  it("prevents staff from deleting their assigned task", async () => {
    const task = await createFixture(ram, {
      title: "Staff assigned task",
      assigned_to: hari.userId,
    });

    await expectError(
      await apiRequest("DELETE", `${PATH}/${task.id}`, hari.token),
      403,
      "FORBIDDEN",
    );

    // Confirm the task still exists after the rejected deletion.
    const result = await expectJson<{ data: Task }>(
      await apiRequest("GET", `${PATH}/${task.id}`, hari.token),
      200,
    );

    expect(result.data.id).toBe(task.id);
  });

  it("prevents staff from deleting another staff member's task", async () => {
    const task = await createFixture(ram, {
      title: "Another staff task",
      assigned_to: gita.userId,
    });

    await expectError(
      await apiRequest("DELETE", `${PATH}/${task.id}`, hari.token),
      403,
      "FORBIDDEN",
    );
  });

  // --------------------------------------------------
  // 2. SUCCESSFUL TASK DELETION
  // --------------------------------------------------

  it("allows an admin to delete a task in their organization", async () => {
    const task = await createFixture(ram, {
      title: "Task to delete",
    });

    expect(task.organization_id).toBe(ORG_A);

    const deleted = await deleteFixture(ram.token, task.id);

    expect(deleted).toMatchObject({
      id: task.id,
      organization_id: ORG_A,
      title: "Task to delete",
    });

    // A deleted task must no longer be retrievable.
    await expectError(
      await apiRequest("GET", `${PATH}/${task.id}`, ram.token),
      404,
      "TASK_NOT_FOUND",
    );
  });

  it("allows an admin to delete a staff-assigned task", async () => {
    const task = await createFixture(ram, {
      title: "Assigned task to delete",
      assigned_to: hari.userId,
    });

    const deleted = await deleteFixture(ram.token, task.id);

    expect(deleted.id).toBe(task.id);
    expect(deleted.assigned_to).toBe(hari.userId);

    await expectError(
      await apiRequest("GET", `${PATH}/${task.id}`, hari.token),
      404,
      "TASK_NOT_FOUND",
    );
  });

  it("allows deletion of a task linked to a private lead", async () => {
    const task = await createFixture(ram, {
      title: "Private lead task",
      assigned_to: hari.userId,
      lead_id: PRIVATE_LEAD_ID,
    });

    const deleted = await deleteFixture(ram.token, task.id);

    expect(deleted.id).toBe(task.id);
    expect(deleted.lead_id).toBe(PRIVATE_LEAD_ID);
  });

  it("allows deletion of a completed task", async () => {
    const task = await createFixture(ram, {
      title: "Completed task to delete",
    });

    const updated = await expectJson<{ data: Task }>(
      await apiRequest("PATCH", `${PATH}/${task.id}`, ram.token, {
        status: "completed",
      }),
      200,
    );

    expect(updated.data.status).toBe("completed");

    const deleted = await deleteFixture(ram.token, task.id);

    expect(deleted.status).toBe("completed");
  });

  // --------------------------------------------------
  // 3. ORGANIZATION ISOLATION
  // --------------------------------------------------

  it("prevents an admin from deleting another organization's task", async () => {
    const task = await createFixture(bina, {
      title: "Organization B task",
    });

    expect(task.organization_id).toBe(ORG_B);

    await expectError(
      await apiRequest("DELETE", `${PATH}/${task.id}`, ram.token),
      404,
      "TASK_NOT_FOUND",
    );

    // Confirm the other organization's task still exists.
    const result = await expectJson<{ data: Task }>(
      await apiRequest("GET", `${PATH}/${task.id}`, bina.token),
      200,
    );

    expect(result.data.id).toBe(task.id);
  });

  it("enforces organization isolation in both directions", async () => {
    const task = await createFixture(ram, {
      title: "Organization A task",
    });

    await expectError(
      await apiRequest("DELETE", `${PATH}/${task.id}`, bina.token),
      404,
      "TASK_NOT_FOUND",
    );

    const result = await expectJson<{ data: Task }>(
      await apiRequest("GET", `${PATH}/${task.id}`, ram.token),
      200,
    );

    expect(result.data.id).toBe(task.id);
  });

  // --------------------------------------------------
  // 4. VALIDATION AND NOT FOUND
  // --------------------------------------------------

  it("returns 404 when deleting a nonexistent task", async () => {
    await expectError(
      await apiRequest("DELETE", `${PATH}/${randomUUID()}`, ram.token),
      404,
      "TASK_NOT_FOUND",
    );
  });

  it("returns 400 for an invalid task UUID", async () => {
    await expectError(
      await apiRequest("DELETE", `${PATH}/not-a-uuid`, ram.token),
      400,
      "INVALID_UUID",
    );
  });

  it("returns 404 when deleting the same task twice", async () => {
    const task = await createFixture(ram, {
      title: "Delete twice test",
    });

    await deleteFixture(ram.token, task.id);

    await expectError(
      await apiRequest("DELETE", `${PATH}/${task.id}`, ram.token),
      404,
      "TASK_NOT_FOUND",
    );
  });
});
