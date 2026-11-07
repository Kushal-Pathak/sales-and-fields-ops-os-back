import type { Context } from "hono";
import type { AppEnv } from "../../types/app";
import { validate } from "../../shared/validation/validate";
import { validateUuid } from "../../shared/validation/validate-uuid";
import { createLeadNoteSchema, updateLeadNoteSchema } from "./lead-note.schema";
import {
  addLeadNote,
  listLeadNotes,
  editLeadNote,
  removeLeadNote,
} from "./lead-notes.service";

export async function createLeadNoteController(c: Context<AppEnv>) {
  const leadId = validateUuid(c.req.param("id"), "Lead ID");

  const body = await c.req.json();
  const input = validate(createLeadNoteSchema, body);

  const supabase = c.get("supabase");
  const authorUserId = c.get("userId");

  const data = await addLeadNote(supabase, leadId, authorUserId, input);

  return c.json({ data }, 201);
}

export async function listLeadNotesController(c: Context<AppEnv>) {
  const leadId = validateUuid(c.req.param("id"), "Lead ID");

  const supabase = c.get("supabase");

  const data = await listLeadNotes(supabase, leadId);

  return c.json({ data });
}

export async function updateLeadNoteController(c: Context<AppEnv>) {
  const leadId = validateUuid(c.req.param("id"), "Lead ID");
  const noteId = validateUuid(c.req.param("noteId"), "Note ID");

  const body = await c.req.json();
  const input = validate(updateLeadNoteSchema, body);

  const supabase = c.get("supabase");

  const data = await editLeadNote(supabase, leadId, noteId, input);

  return c.json({ data });
}

export async function deleteLeadNoteController(c: Context<AppEnv>) {
  const leadId = validateUuid(c.req.param("id"), "Lead ID");
  const noteId = validateUuid(c.req.param("noteId"), "Note ID");

  const supabase = c.get("supabase");

  const data = await removeLeadNote(supabase, leadId, noteId);

  return c.json({ data });
}
