import type { TaskStatus } from "./tasks.schema";

export const ALLOWED_TASK_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> =
  {
    todo: ["in_progress", "completed", "cancelled"],
    in_progress: ["todo", "completed", "cancelled"],
    completed: ["in_progress"],
    cancelled: ["todo"],
  };

export function isValidTaskStatusTransition(
  currentStatus: TaskStatus,
  nextStatus: TaskStatus,
): boolean {
  if (currentStatus === nextStatus) {
    return true;
  }

  return ALLOWED_TASK_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
}
