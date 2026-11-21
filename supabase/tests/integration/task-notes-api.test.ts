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

const prefix = `TaskNotes-${randomUUID()}`;

type Task = {
  id: string;
  assigned_to: string | null;
};

type TaskNote = {
  id: string;
  task_id: string;
  author_user_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
};

const createdTasks: Array<{
  id: string;
  owner: Session;
}> = [];

async function createFixture(
  owner: Session,
  title: string,
  assignedTo?: string,
): Promise<Task> {
  const result = await expectJson<{ data: Task }>(
    await apiRequest("POST", PATH, owner.token, {
      title,
      ...(assignedTo ? { assigned_to: assignedTo } : {}),
    }),
    201,
  );

  createdTasks.push({
    id: result.data.id,
    owner,
  });

  return result.data;
}

async function createNote(
  token: string,
  taskId: string,
  content: string,
): Promise<TaskNote> {
  const result = await expectJson<{ data: TaskNote }>(
    await apiRequest("POST", `${PATH}/${taskId}/notes`, token, { content }),
    201,
  );

  return result.data;
}

async function getNotes(token: string, taskId: string): Promise<TaskNote[]> {
  const result = await expectJson<{ data: TaskNote[] }>(
    await apiRequest("GET", `${PATH}/${taskId}/notes`, token),
    200,
  );

  return result.data;
}

describe("Task Notes API - Integration", () => {
  let ram: Session;
  let hari: Session;
  let gita: Session;
  let bina: Session;
  let ajay: Session;

  let assignedTask: Task;
  let unassignedTask: Task;
  let otherOrganizationTask: Task;

  let staffNote: TaskNote;
  let adminNote: TaskNote;

  beforeAll(async () => {
    [ram, hari, gita, bina, ajay] = await Promise.all([
      login("ram@gmail.com"),
      login("hari@gmail.com"),
      login("gita@gmail.com"),
      login("bina@gmail.com"),
      login("ajay@gmail.com"),
    ]);

    assignedTask = await createFixture(
      ram,
      `${prefix} Assigned Task`,
      hari.userId,
    );

    unassignedTask = await createFixture(ram, `${prefix} Unassigned Task`);

    otherOrganizationTask = await createFixture(
      bina,
      `${prefix} Organization B Task`,
    );

    staffNote = await createNote(
      hari.token,
      assignedTask.id,
      "Staff follow-up note",
    );

    adminNote = await createNote(
      ram.token,
      assignedTask.id,
      "Admin instruction",
    );
  });

  afterAll(async () => {
    // Deleting test tasks also deletes their notes (ON DELETE CASCADE).
    for (const { id, owner } of createdTasks.reverse()) {
      const response = await apiRequest("DELETE", `${PATH}/${id}`, owner.token);

      expect(response.status).toBe(200);
    }
  });

  it("records the authenticated note author", () => {
    expect(staffNote.task_id).toBe(assignedTask.id);
    expect(staffNote.author_user_id).toBe(hari.userId);

    expect(adminNote.author_user_id).toBe(ram.userId);
  });

  it("lets assigned staff list notes", async () => {
    const notes = await getNotes(hari.token, assignedTask.id);

    expect(notes.map((note) => note.id)).toContain(staffNote.id);

    expect(notes.map((note) => note.id)).toContain(adminNote.id);
  });

  it("lets admins view notes on organization tasks", async () => {
    const notes = await getNotes(ram.token, assignedTask.id);

    expect(notes).toHaveLength(2);
  });

  it("does not expose another staff member's task notes", async () => {
    await expectError(
      await apiRequest("GET", `${PATH}/${assignedTask.id}/notes`, gita.token),
      404,
      "TASK_NOT_FOUND",
    );
  });

  it("blocks staff from adding notes to unassigned tasks", async () => {
    await expectError(
      await apiRequest(
        "POST",
        `${PATH}/${unassignedTask.id}/notes`,
        hari.token,
        { content: "Unauthorized note" },
      ),
      404,
      "TASK_NOT_FOUND",
    );
  });

  it("blocks cross-organization note access", async () => {
    await expectError(
      await apiRequest(
        "GET",
        `${PATH}/${otherOrganizationTask.id}/notes`,
        ram.token,
      ),
      404,
      "TASK_NOT_FOUND",
    );
  });

  it("returns an empty list for tasks without notes", async () => {
    const notes = await getNotes(ram.token, unassignedTask.id);

    expect(notes).toEqual([]);
  });

  it("allows authors to edit their notes", async () => {
    const updated = await expectJson<{ data: TaskNote }>(
      await apiRequest(
        "PATCH",
        `${PATH}/${assignedTask.id}/notes/${staffNote.id}`,
        hari.token,
        { content: "Customer requested Monday follow-up" },
      ),
      200,
    );

    expect(updated.data.content).toBe("Customer requested Monday follow-up");

    expect(updated.data.author_user_id).toBe(hari.userId);
  });

  it("does not let staff edit an admin's note", async () => {
    await expectError(
      await apiRequest(
        "PATCH",
        `${PATH}/${assignedTask.id}/notes/${adminNote.id}`,
        hari.token,
        { content: "Unauthorized edit" },
      ),
      404,
      "TASK_NOTE_NOT_FOUND",
    );
  });

  it("does not let admins edit notes authored by staff", async () => {
    await expectError(
      await apiRequest(
        "PATCH",
        `${PATH}/${assignedTask.id}/notes/${staffNote.id}`,
        ram.token,
        { content: "Unauthorized admin edit" },
      ),
      404,
      "TASK_NOTE_NOT_FOUND",
    );
  });

  it("does not let staff delete an admin's note", async () => {
    await expectError(
      await apiRequest(
        "DELETE",
        `${PATH}/${assignedTask.id}/notes/${adminNote.id}`,
        hari.token,
      ),
      404,
      "TASK_NOTE_NOT_FOUND",
    );
  });

  it("lets authors delete their own notes", async () => {
    const disposable = await createNote(
      hari.token,
      assignedTask.id,
      "Temporary note",
    );

    await expectJson<{ data: TaskNote }>(
      await apiRequest(
        "DELETE",
        `${PATH}/${assignedTask.id}/notes/${disposable.id}`,
        hari.token,
      ),
      200,
    );

    const notes = await getNotes(hari.token, assignedTask.id);

    expect(notes.some((note) => note.id === disposable.id)).toBe(false);
  });

  it("rejects client-controlled author fields", async () => {
    await expectError(
      await apiRequest("POST", `${PATH}/${assignedTask.id}/notes`, hari.token, {
        content: "Spoofed author",
        author_user_id: ram.userId,
      }),
      400,
      "VALIDATION_ERROR",
    );
  });

  it("rejects invalid note content", async () => {
    for (const body of [
      {},
      { content: "" },
      { content: "   " },
      { content: "x".repeat(5001) },
    ]) {
      await expectError(
        await apiRequest(
          "POST",
          `${PATH}/${assignedTask.id}/notes`,
          hari.token,
          body,
        ),
        400,
        "VALIDATION_ERROR",
      );
    }
  });

  it("requires authentication", async () => {
    const response = await apiRequest(
      "GET",
      `${PATH}/${assignedTask.id}/notes`,
    );

    expect(response.status).toBe(401);
  });

  it("requires organization membership", async () => {
    await expectError(
      await apiRequest("GET", `${PATH}/${assignedTask.id}/notes`, ajay.token),
      403,
      "ORGANIZATION_ACCESS_REQUIRED",
    );
  });

  it("rejects invalid task and note IDs", async () => {
    await expectError(
      await apiRequest("GET", `${PATH}/invalid-uuid/notes`, ram.token),
      400,
      "INVALID_UUID",
    );

    await expectError(
      await apiRequest(
        "DELETE",
        `${PATH}/${assignedTask.id}/notes/invalid-uuid`,
        hari.token,
      ),
      400,
      "INVALID_UUID",
    );
  });

  it("prevents author impersonation through direct Supabase access", async () => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/task_notes`, {
      method: "POST",
      headers: {
        apikey: PUBLISHABLE_KEY,
        Authorization: `Bearer ${hari.token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        task_id: assignedTask.id,
        content: "Attempted impersonation",
        author_user_id: ram.userId,
      }),
    });

    expect(response.status, await response.text()).toBe(403);
  });

  // Keep this last: reassignment changes subsequent access.
  it("updates note visibility after task reassignment", async () => {
    await expectJson<{ data: Task }>(
      await apiRequest(
        "PATCH",
        `${PATH}/${assignedTask.id}/assign`,
        ram.token,
        { assigned_to: gita.userId },
      ),
      200,
    );

    // Previous assignee loses access.
    await expectError(
      await apiRequest("GET", `${PATH}/${assignedTask.id}/notes`, hari.token),
      404,
      "TASK_NOT_FOUND",
    );

    // New assignee can see existing notes.
    const notes = await getNotes(gita.token, assignedTask.id);

    expect(notes.map((note) => note.id)).toContain(staffNote.id);

    expect(notes.map((note) => note.id)).toContain(adminNote.id);

    // But the new assignee cannot edit the previous author's note.
    await expectError(
      await apiRequest(
        "PATCH",
        `${PATH}/${assignedTask.id}/notes/${staffNote.id}`,
        gita.token,
        { content: "Unauthorized edit" },
      ),
      404,
      "TASK_NOTE_NOT_FOUND",
    );
  });
});
