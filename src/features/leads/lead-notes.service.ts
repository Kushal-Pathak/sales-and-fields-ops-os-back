import type { AppSupabaseClient } from "../../types/supabase";
import type { CreateLeadNoteInput } from "./lead-note.schema";
import { AppError } from "../../core/errors/app-error";
import { findLeadById } from "./leads.service";
import { createLeadNote } from "./lead-notes.repository";
import { getLeadNotes } from "./lead-notes.repository";
import type { UpdateLeadNoteInput } from "./lead-note.schema";
import { updateLeadNote } from "./lead-notes.repository";
import { deleteLeadNote } from "./lead-notes.repository";

export async function addLeadNote(
  supabase: AppSupabaseClient,
  leadId: string,
  authorUserId: string,
  input: CreateLeadNoteInput,
) {
  await findLeadById(supabase, leadId);

  const { data, error } = await createLeadNote(
    supabase,
    leadId,
    authorUserId,
    input,
  );

  if (error || !data) {
    throw new AppError(
      "LEAD_NOTE_CREATE_FAILED",
      500,
      "Failed to create lead note",
    );
  }

  return data;
}

export async function listLeadNotes(
  supabase: AppSupabaseClient,
  leadId: string,
) {
  // Verify that the lead exists and is accessible
  await findLeadById(supabase, leadId);

  const { data, error } = await getLeadNotes(supabase, leadId);

  if (error) {
    throw new AppError(
      "LEAD_NOTES_FETCH_FAILED",
      500,
      "Failed to fetch lead notes",
    );
  }

  return data;
}

export async function editLeadNote(
  supabase: AppSupabaseClient,
  leadId: string,
  noteId: string,
  input: UpdateLeadNoteInput,
) {
  // Check whether the lead exists and is accessible
  await findLeadById(supabase, leadId);

  const { data, error } = await updateLeadNote(supabase, leadId, noteId, input);

  if (error) {
    throw new AppError(
      "LEAD_NOTE_UPDATE_FAILED",
      500,
      "Failed to update lead note",
    );
  }

  if (!data) {
    throw new AppError("LEAD_NOTE_NOT_FOUND", 404, "Lead note not found");
  }

  return data;
}

export async function removeLeadNote(
  supabase: AppSupabaseClient,
  leadId: string,
  noteId: string,
) {
  // Verify the lead exists and is accessible
  await findLeadById(supabase, leadId);

  const { data, error } = await deleteLeadNote(supabase, leadId, noteId);

  if (error) {
    throw new AppError(
      "LEAD_NOTE_DELETE_FAILED",
      500,
      "Failed to delete lead note",
    );
  }

  if (!data) {
    throw new AppError("LEAD_NOTE_NOT_FOUND", 404, "Lead note not found");
  }

  return data;
}
