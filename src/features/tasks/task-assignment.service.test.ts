import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSupabaseClient } from "../../types/supabase";
import { assignTask, getTaskAssignee } from "./tasks.repository";
import { assignTaskToUser } from "./tasks.service";
import { assignTaskSchema } from "./tasks.schema";
import { POSTGRES_ERROR_CODES } from "../../platform/database/postgres-errors";

vi.mock("./tasks.repository", () => ({
  assignTask: vi.fn(),
  getTaskAssignee: vi.fn(),
}));

const supabase = {} as AppSupabaseClient;

const organizationId = "11111111-1111-4111-8111-111111111111";
const taskId = "91111111-1111-4111-8111-111111111111";
const assigneeId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";

const task = {
  id: taskId,
  organization_id: organizationId,
  assigned_to: assigneeId,
};

const databaseError = {
  code: "DATABASE_ERROR",
  message: "Sensitive database information",
};

function mockResult<T>(result: T): never {
  return Promise.resolve(result) as never;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Task Service - assignTaskToUser", () => {
  it("should assign a task to an organization member", async () => {
    vi.mocked(getTaskAssignee).mockReturnValue(
      mockResult({
        data: { user_id: assigneeId },
        error: null,
      }),
    );

    vi.mocked(assignTask).mockReturnValue(
      mockResult({ data: task, error: null }),
    );

    const result = await assignTaskToUser(
      supabase,
      organizationId,
      taskId,
      assigneeId,
    );

    expect(result).toEqual(task);

    expect(getTaskAssignee).toHaveBeenCalledWith(
      supabase,
      organizationId,
      assigneeId,
    );

    expect(assignTask).toHaveBeenCalledWith(
      supabase,
      organizationId,
      taskId,
      assigneeId,
    );
  });

  it("should allow unassigning a task", async () => {
    const unassignedTask = {
      ...task,
      assigned_to: null,
    };

    vi.mocked(assignTask).mockReturnValue(
      mockResult({
        data: unassignedTask,
        error: null,
      }),
    );

    const result = await assignTaskToUser(
      supabase,
      organizationId,
      taskId,
      null,
    );

    expect(result.assigned_to).toBeNull();
    expect(getTaskAssignee).not.toHaveBeenCalled();

    expect(assignTask).toHaveBeenCalledWith(
      supabase,
      organizationId,
      taskId,
      null,
    );
  });

  it("should reject an assignee outside the organization", async () => {
    vi.mocked(getTaskAssignee).mockReturnValue(
      mockResult({ data: null, error: null }),
    );

    await expect(
      assignTaskToUser(supabase, organizationId, taskId, assigneeId),
    ).rejects.toMatchObject({
      code: "INVALID_ASSIGNEE",
      status: 400,
    });

    expect(assignTask).not.toHaveBeenCalled();
  });

  it("should handle membership lookup errors safely", async () => {
    vi.mocked(getTaskAssignee).mockReturnValue(
      mockResult({
        data: null,
        error: databaseError,
      }),
    );

    await expect(
      assignTaskToUser(supabase, organizationId, taskId, assigneeId),
    ).rejects.toMatchObject({
      code: "TASK_ASSIGNMENT_FAILED",
      status: 500,
      message: "Failed to assign task",
    });

    expect(assignTask).not.toHaveBeenCalled();
  });

  it("should return 404 when the task does not exist", async () => {
    vi.mocked(getTaskAssignee).mockReturnValue(
      mockResult({
        data: { user_id: assigneeId },
        error: null,
      }),
    );

    vi.mocked(assignTask).mockReturnValue(
      mockResult({
        data: null,
        error: null,
      }),
    );

    await expect(
      assignTaskToUser(supabase, organizationId, taskId, assigneeId),
    ).rejects.toMatchObject({
      code: "TASK_NOT_FOUND",
      status: 404,
    });
  });

  it("should handle concurrent membership changes", async () => {
    vi.mocked(getTaskAssignee).mockReturnValue(
      mockResult({
        data: { user_id: assigneeId },
        error: null,
      }),
    );

    vi.mocked(assignTask).mockReturnValue(
      mockResult({
        data: null,
        error: {
          code: POSTGRES_ERROR_CODES.FOREIGN_KEY_VIOLATION,
          message:
            'violates foreign key constraint "tasks_assignee_membership_fk"',
        },
      }),
    );

    await expect(
      assignTaskToUser(supabase, organizationId, taskId, assigneeId),
    ).rejects.toMatchObject({
      code: "INVALID_ASSIGNEE",
      status: 409,
    });
  });

  it("should not confuse another foreign-key error with invalid assignment", async () => {
    vi.mocked(getTaskAssignee).mockReturnValue(
      mockResult({
        data: { user_id: assigneeId },
        error: null,
      }),
    );

    vi.mocked(assignTask).mockReturnValue(
      mockResult({
        data: null,
        error: {
          code: POSTGRES_ERROR_CODES.FOREIGN_KEY_VIOLATION,
          message: 'violates foreign key constraint "tasks_other_fk"',
        },
      }),
    );

    await expect(
      assignTaskToUser(supabase, organizationId, taskId, assigneeId),
    ).rejects.toMatchObject({
      code: "TASK_ASSIGNMENT_FAILED",
      status: 500,
    });
  });

  it("should return a safe error when updating fails", async () => {
    vi.mocked(assignTask).mockReturnValue(
      mockResult({
        data: null,
        error: databaseError,
      }),
    );

    await expect(
      assignTaskToUser(supabase, organizationId, taskId, null),
    ).rejects.toMatchObject({
      code: "TASK_ASSIGNMENT_FAILED",
      status: 500,
      message: "Failed to assign task",
    });
  });

  it("should prioritize database errors even if data is returned", async () => {
    vi.mocked(assignTask).mockReturnValue(
      mockResult({
        data: task,
        error: databaseError,
      }),
    );

    await expect(
      assignTaskToUser(supabase, organizationId, taskId, null),
    ).rejects.toMatchObject({
      code: "TASK_ASSIGNMENT_FAILED",
      status: 500,
    });
  });
});

describe("Task Assignment Input Validation", () => {
  it("accepts a valid assignee", () => {
    expect(assignTaskSchema.parse({ assigned_to: assigneeId })).toEqual({
      assigned_to: assigneeId,
    });
  });

  it("accepts null for unassignment", () => {
    expect(assignTaskSchema.parse({ assigned_to: null })).toEqual({
      assigned_to: null,
    });
  });

  it.each([
    {},
    { assigned_to: "invalid-uuid" },
    { assigned_to: 123 },
    { assigned_to: "" },
    { assigned_to: assigneeId, title: "Unauthorized change" },
    { assigned_to: null, organization_id: organizationId },
  ])("rejects invalid assignment bodies: %j", (input) => {
    expect(assignTaskSchema.safeParse(input).success).toBe(false);
  });
});
