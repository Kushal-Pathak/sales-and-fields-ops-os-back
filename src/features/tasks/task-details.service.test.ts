import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSupabaseClient } from "../../types/supabase";
import { getTaskLead, updateTaskDetails } from "./tasks.repository";
import { editTaskDetails } from "./tasks.service";
import { updateTaskDetailsSchema } from "./tasks.schema";
import { POSTGRES_ERROR_CODES } from "../../platform/database/postgres-errors";

vi.mock("./tasks.repository", () => ({
  getTaskLead: vi.fn(),
  updateTaskDetails: vi.fn(),
}));

const supabase = {} as AppSupabaseClient;
const organizationId = "11111111-1111-4111-8111-111111111111";
const taskId = "91111111-1111-4111-8111-111111111111";
const leadId = "10000000-0000-4000-8000-000000000001";

function mockResult<T>(result: T): never {
  return Promise.resolve(result) as never;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Task Service - editTaskDetails", () => {
  it("updates task details without a lead lookup", async () => {
    const input = {
      title: "Updated follow-up",
      priority: "high" as const,
    };

    const task = {
      id: taskId,
      ...input,
    };

    vi.mocked(updateTaskDetails).mockReturnValue(
      mockResult({ data: task, error: null }),
    );

    const result = await editTaskDetails(
      supabase,
      organizationId,
      taskId,
      input,
    );

    expect(result).toEqual(task);
    expect(getTaskLead).not.toHaveBeenCalled();

    expect(updateTaskDetails).toHaveBeenCalledWith(
      supabase,
      organizationId,
      taskId,
      input,
    );
  });

  it("validates a linked lead before updating", async () => {
    vi.mocked(getTaskLead).mockReturnValue(
      mockResult({ data: { id: leadId }, error: null }),
    );

    vi.mocked(updateTaskDetails).mockReturnValue(
      mockResult({
        data: { id: taskId, lead_id: leadId },
        error: null,
      }),
    );

    await expect(
      editTaskDetails(supabase, organizationId, taskId, {
        lead_id: leadId,
      }),
    ).resolves.toMatchObject({ lead_id: leadId });

    expect(getTaskLead).toHaveBeenCalledWith(supabase, organizationId, leadId);
  });

  it("allows unlinking a lead without looking it up", async () => {
    vi.mocked(updateTaskDetails).mockReturnValue(
      mockResult({
        data: { id: taskId, lead_id: null },
        error: null,
      }),
    );

    await expect(
      editTaskDetails(supabase, organizationId, taskId, {
        lead_id: null,
      }),
    ).resolves.toMatchObject({ lead_id: null });

    expect(getTaskLead).not.toHaveBeenCalled();
  });

  it("rejects a nonexistent or cross-organization lead", async () => {
    vi.mocked(getTaskLead).mockReturnValue(
      mockResult({ data: null, error: null }),
    );

    await expect(
      editTaskDetails(supabase, organizationId, taskId, {
        lead_id: leadId,
      }),
    ).rejects.toMatchObject({
      code: "INVALID_LEAD",
      status: 400,
    });

    expect(updateTaskDetails).not.toHaveBeenCalled();
  });

  it("handles lead lookup failures safely", async () => {
    vi.mocked(getTaskLead).mockReturnValue(
      mockResult({
        data: null,
        error: { message: "Private SQL details" },
      }),
    );

    await expect(
      editTaskDetails(supabase, organizationId, taskId, {
        lead_id: leadId,
      }),
    ).rejects.toMatchObject({
      code: "TASK_UPDATE_FAILED",
      status: 500,
    });

    expect(updateTaskDetails).not.toHaveBeenCalled();
  });

  it("handles a concurrent linked-lead deletion", async () => {
    vi.mocked(updateTaskDetails).mockReturnValue(
      mockResult({
        data: null,
        error: {
          code: POSTGRES_ERROR_CODES.FOREIGN_KEY_VIOLATION,
          message: 'violates "tasks_organization_lead_fk"',
        },
      }),
    );

    await expect(
      editTaskDetails(supabase, organizationId, taskId, {
        title: "Updated title",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_LEAD",
      status: 409,
    });
  });

  it("maps a database authorization rejection to 403", async () => {
    vi.mocked(updateTaskDetails).mockReturnValue(
      mockResult({
        data: null,
        error: {
          code: "42501",
          message: "Task details require organization admin",
        },
      }),
    );

    await expect(
      editTaskDetails(supabase, organizationId, taskId, {
        priority: "high",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
  });

  it("returns 404 for a missing or inaccessible task", async () => {
    vi.mocked(updateTaskDetails).mockReturnValue(
      mockResult({ data: null, error: null }),
    );

    await expect(
      editTaskDetails(supabase, organizationId, taskId, {
        title: "Updated title",
      }),
    ).rejects.toMatchObject({
      code: "TASK_NOT_FOUND",
      status: 404,
    });
  });

  it("returns a safe 500 for database errors", async () => {
    vi.mocked(updateTaskDetails).mockReturnValue(
      mockResult({
        data: null,
        error: {
          code: "XX000",
          message: "Sensitive database details",
        },
      }),
    );

    await expect(
      editTaskDetails(supabase, organizationId, taskId, {
        priority: "high",
      }),
    ).rejects.toMatchObject({
      code: "TASK_UPDATE_FAILED",
      status: 500,
      message: "Failed to update task",
    });
  });
});

describe("Task details validation", () => {
  it("accepts a partial update", () => {
    expect(
      updateTaskDetailsSchema.parse({
        title: "  Updated title  ",
      }),
    ).toEqual({ title: "Updated title" });
  });

  it("accepts clearing nullable fields", () => {
    expect(
      updateTaskDetailsSchema.parse({
        description: null,
        due_at: null,
        lead_id: null,
      }),
    ).toEqual({
      description: null,
      due_at: null,
      lead_id: null,
    });
  });

  it("accepts a valid priority and due date", () => {
    expect(
      updateTaskDetailsSchema.parse({
        priority: "high",
        due_at: "2026-12-15T10:00:00+05:45",
      }),
    ).toMatchObject({ priority: "high" });
  });

  it.each([
    {},
    { title: "" },
    { title: "   " },
    { title: "x".repeat(201) },
    { description: "x".repeat(5001) },
    { priority: "urgent" },
    { due_at: "tomorrow" },
    { lead_id: "invalid-uuid" },
    { title: null },
    { status: "completed" },
    { assigned_to: taskId },
    { completed_at: "2026-12-15T10:00:00Z" },
    { organization_id: organizationId },
  ])("rejects invalid task details: %j", (input) => {
    expect(updateTaskDetailsSchema.safeParse(input).success).toBe(false);
  });
});
