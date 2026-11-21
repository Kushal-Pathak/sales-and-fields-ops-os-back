import type { AppSupabaseClient } from "../../types/supabase";

import type {
  CreateTaskNoteInput,
  UpdateTaskNoteInput,
} from "./task-notes.schema";

export async function createTaskNote(
  supabase: AppSupabaseClient,
  taskId: string,
  input: CreateTaskNoteInput,
) {
  return supabase
    .from("task_notes")
    .insert({
      task_id: taskId,
      content: input.content,
    })
    .select()
    .single();
}

export async function getTaskNotes(
  supabase: AppSupabaseClient,
  taskId: string,
) {
  return supabase
    .from("task_notes")
    .select("id, task_id, author_user_id, content, created_at, updated_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
}

export async function updateTaskNote(
  supabase: AppSupabaseClient,
  taskId: string,
  noteId: string,
  input: UpdateTaskNoteInput,
) {
  return supabase
    .from("task_notes")
    .update({ content: input.content })
    .eq("task_id", taskId)
    .eq("id", noteId)
    .select()
    .maybeSingle();
}

export async function deleteTaskNote(
  supabase: AppSupabaseClient,
  taskId: string,
  noteId: string,
) {
  return supabase
    .from("task_notes")
    .delete()
    .eq("task_id", taskId)
    .eq("id", noteId)
    .select()
    .maybeSingle();
}
