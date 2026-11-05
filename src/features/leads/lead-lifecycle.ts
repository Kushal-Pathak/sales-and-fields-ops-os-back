import z from "zod";
import { leadStatusSchema } from "./lead.schema";

type LeadStatus = z.infer<typeof leadStatusSchema>;

export const ALLOWED_STATUS_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new: ["contacted", "lost"],
  contacted: ["qualified", "lost"],
  qualified: ["converted", "lost"],
  converted: [],
  lost: ["new"],
};

export function isValidStatusTransition(
  currentStatus: LeadStatus,
  nextStatus: LeadStatus,
): boolean {
  if (currentStatus === nextStatus) {
    return true;
  }

  return ALLOWED_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
}
