import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSupabaseClient } from "../../types/supabase";
import { getTaskById, getTasks } from "./tasks.repository";
import { findTaskById, listTasks } from "./tasks.service";
import { listTasksQuerySchema } from "./tasks.schema";

vi.mock("./tasks.repository", () => ({
  getTasks: vi.fn(),
  getTaskById: vi.fn(),
}));

const supabase = {} as AppSupabaseClient;
const organizationId = "11111111-1111-4111-8111-111111111111";
const query = listTasksQuerySchema.parse({});

// Keep the repository mocked; a real database is tested separately.
function mockResult<T>(result: T): never {
  return Promise.resolve(result) as never;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Task Service - listTasks", () => {
  it("returns tasks and total count", async () => {
    const tasks = [{ id: "task-1", title: "Follow up" }];

    vi.mocked(getTasks).mockReturnValue(
      mockResult({ data: tasks, count: 1, error: null }),
    );

    await expect(listTasks(supabase, organizationId, query)).resolves.toEqual({
      data: tasks,
      count: 1,
    });

    expect(getTasks).toHaveBeenCalledWith(supabase, organizationId, query);
  });

  it("returns an empty array when no tasks match", async () => {
    vi.mocked(getTasks).mockReturnValue(
      mockResult({ data: [], count: 0, error: null }),
    );

    await expect(listTasks(supabase, organizationId, query)).resolves.toEqual({
      data: [],
      count: 0,
    });
  });

  it("returns a safe error when the database fails", async () => {
    vi.mocked(getTasks).mockReturnValue(
      mockResult({
        data: null,
        count: null,
        error: { message: "Sensitive database error" },
      }),
    );

    await expect(
      listTasks(supabase, organizationId, query),
    ).rejects.toMatchObject({
      code: "TASKS_FETCH_FAILED",
      status: 500,
      message: "Failed to fetch tasks",
    });
  });

  it("rejects an unexpected null data response", async () => {
    vi.mocked(getTasks).mockReturnValue(
      mockResult({ data: null, count: 1, error: null }),
    );

    await expect(
      listTasks(supabase, organizationId, query),
    ).rejects.toMatchObject({
      code: "TASKS_FETCH_FAILED",
      status: 500,
    });
  });

  it("rejects an unexpected null count", async () => {
    vi.mocked(getTasks).mockReturnValue(
      mockResult({ data: [], count: null, error: null }),
    );

    await expect(
      listTasks(supabase, organizationId, query),
    ).rejects.toMatchObject({
      code: "TASKS_FETCH_FAILED",
      status: 500,
    });
  });
});

describe("Task listing query validation", () => {
  it("uses predictable defaults", () => {
    expect(listTasksQuerySchema.parse({})).toEqual({
      page: 1,
      limit: 20,
      sortOrder: "desc",
    });
  });

  it("accepts valid filters and pagination", () => {
    expect(
      listTasksQuerySchema.parse({
        page: "2",
        limit: "10",
        status: "in_progress",
        priority: "high",
        sortOrder: "asc",
      }),
    ).toEqual({
      page: 2,
      limit: 10,
      status: "in_progress",
      priority: "high",
      sortOrder: "asc",
    });
  });

  it.each([
    { page: "0" },
    { page: "1.5" },
    { limit: "101" },
    { status: "pending" },
    { priority: "urgent" },
    { sortOrder: "random" },
  ])("rejects invalid query parameters: %j", (input) => {
    expect(listTasksQuerySchema.safeParse(input).success).toBe(false);
  });
});

const taskId = "91111111-1111-4111-8111-111111111111";

describe("Task Service - findTaskById", () => {
  it("returns an RLS-visible task", async () => {
    const task = { id: taskId, title: "Follow up" };
    vi.mocked(getTaskById).mockReturnValue(
      mockResult({ data: task, error: null }),
    );

    await expect(
      findTaskById(supabase, organizationId, taskId),
    ).resolves.toEqual(task);

    expect(getTaskById).toHaveBeenCalledWith(supabase, organizationId, taskId);
  });

  it("returns 404 for a missing or RLS-hidden task", async () => {
    vi.mocked(getTaskById).mockReturnValue(
      mockResult({ data: null, error: null }),
    );

    await expect(
      findTaskById(supabase, organizationId, taskId),
    ).rejects.toMatchObject({
      code: "TASK_NOT_FOUND",
      status: 404,
      message: "Task not found",
    });
  });

  it("returns a safe 500 for database errors", async () => {
    vi.mocked(getTaskById).mockReturnValue(
      mockResult({ data: null, error: { message: "private SQL details" } }),
    );

    await expect(
      findTaskById(supabase, organizationId, taskId),
    ).rejects.toMatchObject({
      code: "TASK_FETCH_FAILED",
      status: 500,
      message: "Failed to fetch task",
    });
  });
});
