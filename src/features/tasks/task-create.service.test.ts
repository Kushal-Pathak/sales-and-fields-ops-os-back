import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSupabaseClient } from "../../types/supabase";
import { getTaskAssignee, getTaskLead, insertTask } from "./tasks.repository";
import { createTask } from "./tasks.service";
import { createTaskSchema } from "./tasks.schema";

vi.mock("./tasks.repository", () => ({
  getTasks: vi.fn(),
  getTaskById: vi.fn(),
  getTaskAssignee: vi.fn(),
  getTaskLead: vi.fn(),
  insertTask: vi.fn(),
}));

const supabase = {} as AppSupabaseClient;
const organizationId = "11111111-1111-4111-8111-111111111111";
const assigneeId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";
const leadId = "10000000-0000-4000-8000-000000000001";

// Repository calls are mocked. Database permissions are tested separately.
function mockResult<T>(result: T): never {
  return Promise.resolve(result) as never;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Task Service - createTask", () => {
  it("creates an unassigned task and lets the DB supply defaults", async () => {
    const input = { title: "Call the customer" };
    const result = { id: "task-1", title: input.title };

    vi.mocked(insertTask).mockReturnValue(
      mockResult({ data: result, error: null }),
    );

    await expect(createTask(supabase, organizationId, input)).resolves.toEqual(
      result,
    );

    expect(insertTask).toHaveBeenCalledWith(supabase, organizationId, input);

    expect(getTaskAssignee).not.toHaveBeenCalled();
    expect(getTaskLead).not.toHaveBeenCalled();
  });

  it("checks assignee and lead before insertion", async () => {
    vi.mocked(getTaskAssignee).mockReturnValue(
      mockResult({ data: { user_id: assigneeId }, error: null }),
    );

    vi.mocked(getTaskLead).mockReturnValue(
      mockResult({ data: { id: leadId }, error: null }),
    );

    vi.mocked(insertTask).mockReturnValue(
      mockResult({ data: { id: "task-2" }, error: null }),
    );

    await expect(
      createTask(supabase, organizationId, {
        title: "Schedule a visit",
        assigned_to: assigneeId,
        lead_id: leadId,
      }),
    ).resolves.toMatchObject({ id: "task-2" });

    expect(getTaskAssignee).toHaveBeenCalledWith(
      supabase,
      organizationId,
      assigneeId,
    );

    expect(getTaskLead).toHaveBeenCalledWith(supabase, organizationId, leadId);
  });

  it("rejects an assignee outside the organization", async () => {
    vi.mocked(getTaskAssignee).mockReturnValue(
      mockResult({ data: null, error: null }),
    );

    await expect(
      createTask(supabase, organizationId, {
        title: "Follow up",
        assigned_to: assigneeId,
      }),
    ).rejects.toMatchObject({
      code: "INVALID_ASSIGNEE",
      status: 400,
    });

    expect(insertTask).not.toHaveBeenCalled();
  });

  it("does not expose database errors during membership validation", async () => {
    vi.mocked(getTaskAssignee).mockReturnValue(
      mockResult({
        data: null,
        error: { message: "internal details" },
      }),
    );

    await expect(
      createTask(supabase, organizationId, {
        title: "Follow up",
        assigned_to: assigneeId,
      }),
    ).rejects.toMatchObject({
      code: "TASK_CREATE_FAILED",
      status: 500,
    });

    expect(insertTask).not.toHaveBeenCalled();
  });

  it("rejects a missing or cross-organization lead", async () => {
    vi.mocked(getTaskLead).mockReturnValue(
      mockResult({ data: null, error: null }),
    );

    await expect(
      createTask(supabase, organizationId, {
        title: "Follow up",
        lead_id: leadId,
      }),
    ).rejects.toMatchObject({
      code: "INVALID_LEAD",
      status: 400,
    });

    expect(insertTask).not.toHaveBeenCalled();
  });

  it("does not expose database errors during lead validation", async () => {
    vi.mocked(getTaskLead).mockReturnValue(
      mockResult({
        data: null,
        error: { message: "internal details" },
      }),
    );

    await expect(
      createTask(supabase, organizationId, {
        title: "Follow up",
        lead_id: leadId,
      }),
    ).rejects.toMatchObject({
      code: "TASK_CREATE_FAILED",
      status: 500,
    });

    expect(insertTask).not.toHaveBeenCalled();
  });

  it.each([
    ["tasks_assignee_membership_fk", "INVALID_ASSIGNEE"],
    ["tasks_organization_lead_fk", "INVALID_LEAD"],
  ])("maps concurrent FK failure on %s to %s", async (constraint, code) => {
    vi.mocked(insertTask).mockReturnValue(
      mockResult({
        data: null,
        error: {
          code: "23503",
          message: `violates ${constraint}`,
        },
      }),
    );

    await expect(
      createTask(supabase, organizationId, {
        title: "Follow up",
      }),
    ).rejects.toMatchObject({ code, status: 409 });
  });

  it("masks unexpected database insert failures", async () => {
    vi.mocked(insertTask).mockReturnValue(
      mockResult({
        data: null,
        error: {
          code: "XX000",
          message: "Sensitive database details",
        },
      }),
    );

    await expect(
      createTask(supabase, organizationId, {
        title: "Follow up",
      }),
    ).rejects.toMatchObject({
      code: "TASK_CREATE_FAILED",
      status: 500,
      message: "Failed to create task",
    });
  });

  it("fails safely if insert returns no row", async () => {
    vi.mocked(insertTask).mockReturnValue(
      mockResult({ data: null, error: null }),
    );

    await expect(
      createTask(supabase, organizationId, {
        title: "Follow up",
      }),
    ).rejects.toMatchObject({
      code: "TASK_CREATE_FAILED",
      status: 500,
    });
  });
});

describe("Task creation input validation", () => {
  it("trims title and accepts valid optional fields", () => {
    expect(
      createTaskSchema.parse({
        title: "  Call the customer  ",
        assigned_to: assigneeId,
        lead_id: leadId,
        priority: "high",
        due_at: "2026-12-15T12:00:00+05:45",
        description: null,
      }),
    ).toMatchObject({
      title: "Call the customer",
      priority: "high",
    });
  });

  it("accepts a minimal task", () => {
    expect(createTaskSchema.parse({ title: "  New task  " })).toEqual({
      title: "New task",
    });
  });

  it.each([
    { title: "" },
    { title: "   " },
    { title: "x".repeat(201) },
    { title: "Valid", description: "x".repeat(5001) },
    { title: "Valid", priority: "urgent" },
    { title: "Valid", assigned_to: "not-a-uuid" },
    { title: "Valid", lead_id: "not-a-uuid" },
    { title: "Valid", due_at: "tomorrow" },
    { title: "Valid", due_at: "2026-12-15T12:00:00" },
    { title: "Valid", organization_id: organizationId },
    { title: "Valid", created_by: assigneeId },
    { title: "Valid", status: "completed" },
    { title: "Valid", completed_at: "2026-12-15T12:00:00Z" },
  ])("rejects invalid or privileged body: %j", (input) => {
    expect(createTaskSchema.safeParse(input).success).toBe(false);
  });
});
