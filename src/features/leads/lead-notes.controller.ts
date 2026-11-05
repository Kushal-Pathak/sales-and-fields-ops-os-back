import type { Context } from "hono";
import type { AppEnv } from "../../types/app";
import { AppError } from "../../core/errors/app-error";
import { validate } from "../../shared/validation/validate";
import { createLeadNoteSchema } from "./lead-note.schema";
import { addLeadNote } from "./lead-notes.service";
import { listLeadNotes } from "./lead-notes.service";
import { updateLeadNoteSchema } from "./lead-note.schema";
import { editLeadNote } from "./lead-notes.service";
import { removeLeadNote } from "./lead-notes.service";

export async function createLeadNoteController(c: Context<AppEnv>) {
  const leadId = c.req.param("id");

  if (!leadId) {
    throw new AppError("LEAD_ID_REQUIRED", 400, "Lead ID is required");
  }

  const body = await c.req.json();
  const input = validate(createLeadNoteSchema, body);

  const supabase = c.get("supabase");
  const authorUserId = c.get("userId");

  const data = await addLeadNote(supabase, leadId, authorUserId, input);

  return c.json({ data }, 201);
}

export async function listLeadNotesController(c: Context<AppEnv>) {
  const leadId = c.req.param("id");

  if (!leadId) {
    throw new AppError("LEAD_ID_REQUIRED", 400, "Lead ID is required");
  }

  const supabase = c.get("supabase");

  const data = await listLeadNotes(supabase, leadId);

  return c.json({ data });
}

export async function updateLeadNoteController(c: Context<AppEnv>) {
  const leadId = c.req.param("id");
  const noteId = c.req.param("noteId");

  if (!leadId || !noteId) {
    throw new AppError(
      "INVALID_ROUTE_PARAMS",
      400,
      "Lead ID and Note ID are required",
    );
  }

  const body = await c.req.json();
  const input = validate(updateLeadNoteSchema, body);

  const supabase = c.get("supabase");

  const data = await editLeadNote(supabase, leadId, noteId, input);

  return c.json({ data });
}

export async function deleteLeadNoteController(c: Context<AppEnv>) {
  const leadId = c.req.param("id");
  const noteId = c.req.param("noteId");

  if (!leadId || !noteId) {
    throw new AppError(
      "INVALID_ROUTE_PARAMS",
      400,
      "Lead ID and Note ID are required",
    );
  }

  const supabase = c.get("supabase");

  const data = await removeLeadNote(supabase, leadId, noteId);

  return c.json({ data });
}
