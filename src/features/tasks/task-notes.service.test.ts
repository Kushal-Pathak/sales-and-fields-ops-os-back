import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppSupabaseClient } from "../../types/supabase";
import { AppError } from "../../core/errors/app-error";

import { findTaskById } from "./tasks.service";

import {
  createTaskNote,
  getTaskNotes,
  updateTaskNote,
  deleteTaskNote,
} from "./task-notes.repository";

import {
  addTaskNote,
  listTaskNotes,
  editTaskNote,
  removeTaskNote,
} from "./task-notes.service";

import {
  createTaskNoteSchema,
  updateTaskNoteSchema,
} from "./task-notes.schema";

vi.mock("./tasks.service", () => ({
  findTaskById: vi.fn(),
}));

vi.mock("./task-notes.repository", () => ({
  createTaskNote: vi.fn(),
  getTaskNotes: vi.fn(),
  updateTaskNote: vi.fn(),
  deleteTaskNote: vi.fn(),
}));

const supabase = {} as AppSupabaseClient;

const organizationId = "11111111-1111-4111-8111-111111111111";

const taskId = "22222222-2222-4222-8222-222222222222";

const noteId = "33333333-3333-4333-8333-333333333333";

const note = {
  id: noteId,
  task_id: taskId,
  author_user_id: "44444444-4444-4444-8444-444444444444",
  content: "Called customer",
};

function mockResult<T>(result: T): never {
  return Promise.resolve(result) as never;
}

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(findTaskById).mockResolvedValue({
    id: taskId,
  } as never);
});

describe("Task Notes - create", () => {
  it("creates a note on an accessible task", async () => {
    const input = { content: "Called customer" };

    vi.mocked(createTaskNote).mockReturnValue(
      mockResult({ data: note, error: null }),
    );

    const result = await addTaskNote(supabase, organizationId, taskId, input);

    expect(result).toEqual(note);

    expect(findTaskById).toHaveBeenCalledWith(supabase, organizationId, taskId);

    expect(createTaskNote).toHaveBeenCalledWith(supabase, taskId, input);
  });

  it("rejects notes on inaccessible tasks", async () => {
    vi.mocked(findTaskById).mockRejectedValue(
      new AppError("TASK_NOT_FOUND", 404, "Task not found"),
    );

    await expect(
      addTaskNote(supabase, organizationId, taskId, { content: "Test" }),
    ).rejects.toMatchObject({
      code: "TASK_NOT_FOUND",
      status: 404,
    });

    expect(createTaskNote).not.toHaveBeenCalled();
  });

  it("handles database failures", async () => {
    vi.mocked(createTaskNote).mockReturnValue(
      mockResult({
        data: null,
        error: { message: "Database failure" },
      }),
    );

    await expect(
      addTaskNote(supabase, organizationId, taskId, { content: "Test" }),
    ).rejects.toMatchObject({
      code: "TASK_NOTE_CREATE_FAILED",
      status: 500,
    });
  });
});

describe("Task Notes - list", () => {
  it("lists notes", async () => {
    vi.mocked(getTaskNotes).mockReturnValue(
      mockResult({
        data: [note],
        error: null,
      }),
    );

    await expect(
      listTaskNotes(supabase, organizationId, taskId),
    ).resolves.toEqual([note]);
  });

  it("returns an empty list", async () => {
    vi.mocked(getTaskNotes).mockReturnValue(
      mockResult({ data: [], error: null }),
    );

    await expect(
      listTaskNotes(supabase, organizationId, taskId),
    ).resolves.toEqual([]);
  });

  it("handles fetch failures", async () => {
    vi.mocked(getTaskNotes).mockReturnValue(
      mockResult({
        data: null,
        error: { message: "Database failure" },
      }),
    );

    await expect(
      listTaskNotes(supabase, organizationId, taskId),
    ).rejects.toMatchObject({
      code: "TASK_NOTES_FETCH_FAILED",
      status: 500,
    });
  });
});

describe("Task Notes - edit", () => {
  it("updates an accessible author's note", async () => {
    const input = {
      content: "Customer requested follow-up",
    };

    vi.mocked(updateTaskNote).mockReturnValue(
      mockResult({
        data: { ...note, ...input },
        error: null,
      }),
    );

    const result = await editTaskNote(
      supabase,
      organizationId,
      taskId,
      noteId,
      input,
    );

    expect(result.content).toBe(input.content);

    expect(updateTaskNote).toHaveBeenCalledWith(
      supabase,
      taskId,
      noteId,
      input,
    );
  });

  it("returns 404 for hidden or nonexistent notes", async () => {
    vi.mocked(updateTaskNote).mockReturnValue(
      mockResult({ data: null, error: null }),
    );

    await expect(
      editTaskNote(supabase, organizationId, taskId, noteId, {
        content: "Edited",
      }),
    ).rejects.toMatchObject({
      code: "TASK_NOTE_NOT_FOUND",
      status: 404,
    });
  });
});

describe("Task Notes - delete", () => {
  it("deletes an accessible author's note", async () => {
    vi.mocked(deleteTaskNote).mockReturnValue(
      mockResult({ data: note, error: null }),
    );

    await expect(
      removeTaskNote(supabase, organizationId, taskId, noteId),
    ).resolves.toEqual(note);
  });

  it("returns 404 for hidden or nonexistent notes", async () => {
    vi.mocked(deleteTaskNote).mockReturnValue(
      mockResult({ data: null, error: null }),
    );

    await expect(
      removeTaskNote(supabase, organizationId, taskId, noteId),
    ).rejects.toMatchObject({
      code: "TASK_NOTE_NOT_FOUND",
      status: 404,
    });
  });
});

describe("Task Notes - validation", () => {
  it("accepts and trims content", () => {
    expect(
      createTaskNoteSchema.parse({
        content: "  Called customer  ",
      }),
    ).toEqual({ content: "Called customer" });
  });

  it.each([
    {},
    { content: "" },
    { content: "   " },
    { content: "x".repeat(5001) },
    { content: 123 },
    { content: "Hello", author_user_id: note.author_user_id },
    { content: "Hello", task_id: taskId },
  ])("rejects invalid note input: %j", (input) => {
    expect(createTaskNoteSchema.safeParse(input).success).toBe(false);

    expect(updateTaskNoteSchema.safeParse(input).success).toBe(false);
  });
});
