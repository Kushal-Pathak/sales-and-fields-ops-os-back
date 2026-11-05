import type { AppSupabaseClient } from "../../types/supabase";
import type {
  CreateLeadNoteInput,
  UpdateLeadNoteInput,
} from "./lead-note.schema";

export async function createLeadNote(
  supabase: AppSupabaseClient,
  leadId: string,
  authorUserId: string,
  input: CreateLeadNoteInput,
) {
  return supabase
    .from("lead_notes")
    .insert({
      lead_id: leadId,
      author_user_id: authorUserId,
      content: input.content,
    })
    .select()
    .single();
}

export async function getLeadNotes(
  supabase: AppSupabaseClient,
  leadId: string,
) {
  return supabase
    .from("lead_notes")
    .select("id, lead_id, author_user_id, content, created_at, updated_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
}

export async function updateLeadNote(
  supabase: AppSupabaseClient,
  leadId: string,
  noteId: string,
  input: UpdateLeadNoteInput,
) {
  return supabase
    .from("lead_notes")
    .update(input)
    .eq("id", noteId)
    .eq("lead_id", leadId)
    .select()
    .maybeSingle();
}

export async function deleteLeadNote(
  supabase: AppSupabaseClient,
  leadId: string,
  noteId: string,
) {
  return supabase
    .from("lead_notes")
    .delete()
    .eq("id", noteId)
    .eq("lead_id", leadId)
    .select()
    .maybeSingle();
}
