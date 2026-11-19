import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSupabaseClient } from "../../types/supabase";
import { deleteTask } from "./tasks.repository";
import { removeTask } from "./tasks.service";

vi.mock("./tasks.repository", () => ({
  deleteTask: vi.fn(),
}));

const supabase = {} as AppSupabaseClient;

const organizationId = "11111111-1111-4111-8111-111111111111";
const taskId = "91111111-1111-4111-8111-111111111111";

const task = {
  id: taskId,
  organization_id: organizationId,
  title: "Follow up with customer",
  status: "todo",
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

describe("Task Service - removeTask", () => {
  it("should return the deleted task", async () => {
    vi.mocked(deleteTask).mockReturnValue(
      mockResult({
        data: task,
        error: null,
      }),
    );

    const result = await removeTask(supabase, organizationId, taskId);

    expect(result).toEqual(task);

    expect(deleteTask).toHaveBeenCalledWith(supabase, organizationId, taskId);
  });

  it("should return 404 when the task does not exist", async () => {
    vi.mocked(deleteTask).mockReturnValue(
      mockResult({
        data: null,
        error: null,
      }),
    );

    await expect(
      removeTask(supabase, organizationId, taskId),
    ).rejects.toMatchObject({
      code: "TASK_NOT_FOUND",
      status: 404,
      message: "Task not found",
    });
  });

  it("should return 500 when task deletion fails", async () => {
    vi.mocked(deleteTask).mockReturnValue(
      mockResult({
        data: null,
        error: databaseError,
      }),
    );

    await expect(
      removeTask(supabase, organizationId, taskId),
    ).rejects.toMatchObject({
      code: "TASK_DELETE_FAILED",
      status: 500,
      message: "Failed to delete task",
    });
  });

  it("should not treat an error as a successful deletion", async () => {
    vi.mocked(deleteTask).mockReturnValue(
      mockResult({
        data: task,
        error: databaseError,
      }),
    );

    await expect(
      removeTask(supabase, organizationId, taskId),
    ).rejects.toMatchObject({
      code: "TASK_DELETE_FAILED",
      status: 500,
    });
  });
});
