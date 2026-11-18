import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSupabaseClient } from "../../types/supabase";
import { getTaskById, updateTaskStatus } from "./tasks.repository";
import { editTaskStatus } from "./tasks.service";
import { updateTaskStatusSchema } from "./tasks.schema";

vi.mock("./tasks.repository", () => ({
  getTasks: vi.fn(),
  getTaskById: vi.fn(),
  getTaskAssignee: vi.fn(),
  getTaskLead: vi.fn(),
  insertTask: vi.fn(),
  updateTaskStatus: vi.fn(),
}));

const supabase = {} as AppSupabaseClient;
const organizationId = "11111111-1111-4111-8111-111111111111";
const taskId = "91111111-1111-4111-8111-111111111111";

const task = {
  id: taskId,
  status: "todo",
  completed_at: null,
};

// Mock the repository without connecting to a real database.
function mockResult<T>(result: T): never {
  return Promise.resolve(result) as never;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Task Service - editTaskStatus", () => {
  it("should allow a valid status transition", async () => {
    vi.mocked(getTaskById).mockReturnValue(
      mockResult({ data: task, error: null }),
    );

    const updatedTask = {
      ...task,
      status: "in_progress",
    };

    vi.mocked(updateTaskStatus).mockReturnValue(
      mockResult({ data: updatedTask, error: null }),
    );

    const result = await editTaskStatus(supabase, organizationId, taskId, {
      status: "in_progress",
    });

    expect(result).toEqual(updatedTask);

    expect(updateTaskStatus).toHaveBeenCalledWith(
      supabase,
      organizationId,
      taskId,
      {
        status: "in_progress",
        completed_at: null,
      },
      "todo",
    );
  });

  it("should automatically set completed_at when completing a task", async () => {
    vi.mocked(getTaskById).mockReturnValue(
      mockResult({ data: task, error: null }),
    );

    vi.mocked(updateTaskStatus).mockReturnValue(
      mockResult({
        data: {
          ...task,
          status: "completed",
          completed_at: "2026-11-18T10:00:00Z",
        },
        error: null,
      }),
    );

    await editTaskStatus(supabase, organizationId, taskId, {
      status: "completed",
    });

    const update = vi.mocked(updateTaskStatus).mock.calls[0][3];

    expect(update.status).toBe("completed");
    expect(update.completed_at).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(update.completed_at!))).toBe(false);
  });

  it("should clear completed_at when reopening a task", async () => {
    const completedTask = {
      ...task,
      status: "completed",
      completed_at: "2026-11-18T10:00:00Z",
    };

    vi.mocked(getTaskById).mockReturnValue(
      mockResult({ data: completedTask, error: null }),
    );

    vi.mocked(updateTaskStatus).mockReturnValue(
      mockResult({
        data: {
          ...completedTask,
          status: "in_progress",
          completed_at: null,
        },
        error: null,
      }),
    );

    await editTaskStatus(supabase, organizationId, taskId, {
      status: "in_progress",
    });

    expect(updateTaskStatus).toHaveBeenCalledWith(
      supabase,
      organizationId,
      taskId,
      {
        status: "in_progress",
        completed_at: null,
      },
      "completed",
    );
  });

  it("should return the task without updating an unchanged status", async () => {
    vi.mocked(getTaskById).mockReturnValue(
      mockResult({ data: task, error: null }),
    );

    const result = await editTaskStatus(supabase, organizationId, taskId, {
      status: "todo",
    });

    expect(result).toEqual(task);
    expect(updateTaskStatus).not.toHaveBeenCalled();
  });

  it("should reject an invalid status transition", async () => {
    vi.mocked(getTaskById).mockReturnValue(
      mockResult({
        data: {
          ...task,
          status: "completed",
        },
        error: null,
      }),
    );

    await expect(
      editTaskStatus(supabase, organizationId, taskId, { status: "cancelled" }),
    ).rejects.toMatchObject({
      code: "INVALID_STATUS_TRANSITION",
      status: 409,
    });

    expect(updateTaskStatus).not.toHaveBeenCalled();
  });

  it("should return 404 when the task is missing or inaccessible", async () => {
    vi.mocked(getTaskById).mockReturnValue(
      mockResult({ data: null, error: null }),
    );

    await expect(
      editTaskStatus(supabase, organizationId, taskId, { status: "completed" }),
    ).rejects.toMatchObject({
      code: "TASK_NOT_FOUND",
      status: 404,
    });
  });

  it("should return 409 when another request changes the status", async () => {
    vi.mocked(getTaskById).mockReturnValue(
      mockResult({ data: task, error: null }),
    );

    vi.mocked(updateTaskStatus).mockReturnValue(
      mockResult({ data: null, error: null }),
    );

    await expect(
      editTaskStatus(supabase, organizationId, taskId, { status: "completed" }),
    ).rejects.toMatchObject({
      code: "TASK_STATUS_CONFLICT",
      status: 409,
    });
  });

  it("should handle database status transition violations", async () => {
    vi.mocked(getTaskById).mockReturnValue(
      mockResult({ data: task, error: null }),
    );

    vi.mocked(updateTaskStatus).mockReturnValue(
      mockResult({
        data: null,
        error: {
          code: "23514",
          message: "Invalid task status transition: todo -> completed",
        },
      }),
    );

    await expect(
      editTaskStatus(supabase, organizationId, taskId, { status: "completed" }),
    ).rejects.toMatchObject({
      code: "INVALID_STATUS_TRANSITION",
      status: 409,
    });
  });

  it("should handle completion timestamp constraint violations", async () => {
    vi.mocked(getTaskById).mockReturnValue(
      mockResult({ data: task, error: null }),
    );

    vi.mocked(updateTaskStatus).mockReturnValue(
      mockResult({
        data: null,
        error: {
          code: "23514",
          message: "violates check constraint tasks_completion_consistency",
        },
      }),
    );

    await expect(
      editTaskStatus(supabase, organizationId, taskId, { status: "completed" }),
    ).rejects.toMatchObject({
      code: "TASK_STATUS_CONFLICT",
      status: 409,
    });
  });

  it("should return a safe 500 when the database update fails", async () => {
    vi.mocked(getTaskById).mockReturnValue(
      mockResult({ data: task, error: null }),
    );

    vi.mocked(updateTaskStatus).mockReturnValue(
      mockResult({
        data: null,
        error: {
          code: "XX000",
          message: "Sensitive database information",
        },
      }),
    );

    await expect(
      editTaskStatus(supabase, organizationId, taskId, { status: "completed" }),
    ).rejects.toMatchObject({
      code: "TASK_UPDATE_FAILED",
      status: 500,
      message: "Failed to update task",
    });
  });
});

describe("Task update validation", () => {
  it("accepts a valid status", () => {
    expect(updateTaskStatusSchema.parse({ status: "completed" })).toEqual({
      status: "completed",
    });
  });

  it.each([
    {},
    { status: "pending" },
    { status: null },
    { status: 123 },
    { status: "completed", completed_at: "2026-11-18T10:00:00Z" },
    { status: "todo", assigned_to: taskId },
    { status: "todo", title: "Changed title" },
    { status: "todo", organization_id: organizationId },
  ])("rejects invalid task updates: %j", (input) => {
    expect(updateTaskStatusSchema.safeParse(input).success).toBe(false);
  });
});
