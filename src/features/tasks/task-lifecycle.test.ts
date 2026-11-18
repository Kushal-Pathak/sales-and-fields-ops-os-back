import { describe, expect, it } from "vitest";
import { isValidTaskStatusTransition } from "./task-lifecycle";

describe("Task Status Lifecycle", () => {
  describe("Valid transitions", () => {
    it.each([
      ["todo", "in_progress"],
      ["todo", "completed"],
      ["todo", "cancelled"],
      ["in_progress", "todo"],
      ["in_progress", "completed"],
      ["in_progress", "cancelled"],
      ["completed", "in_progress"],
      ["cancelled", "todo"],
    ] as const)("should allow %s → %s", (from, to) => {
      expect(isValidTaskStatusTransition(from, to)).toBe(true);
    });

    it.each(["todo", "in_progress", "completed", "cancelled"] as const)(
      "allows an unchanged %s status",
      (status) => {
        expect(isValidTaskStatusTransition(status, status)).toBe(true);
      },
    );
  });

  describe("Invalid transitions", () => {
    it.each([
      ["completed", "todo"],
      ["completed", "cancelled"],
      ["cancelled", "in_progress"],
      ["cancelled", "completed"],
    ] as const)("should reject %s → %s", (from, to) => {
      expect(isValidTaskStatusTransition(from, to)).toBe(false);
    });
  });
});
