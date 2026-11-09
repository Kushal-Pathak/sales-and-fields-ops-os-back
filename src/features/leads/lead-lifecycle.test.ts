import { describe, it, expect } from "vitest";
import { isValidStatusTransition } from "./lead-lifecycle";

describe("Lead Status Lifecycle", () => {
  describe("Valid transitions", () => {
    it.each([
      ["new", "contacted"],
      ["contacted", "qualified"],
      ["qualified", "converted"],
    ] as const)("should allow %s → %s", (from, to) => {
      expect(isValidStatusTransition(from, to)).toBe(true);
    });
  });

  describe("Invalid transitions", () => {
    it.each([
      ["converted", "new"],
      ["converted", "contacted"],
      ["converted", "qualified"],
      ["converted", "lost"],
    ] as const)("should reject %s → %s", (from, to) => {
      expect(isValidStatusTransition(from, to)).toBe(false);
    });
  });
});
