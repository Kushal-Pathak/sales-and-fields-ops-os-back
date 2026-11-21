import { AppError } from "../../core/errors/app-error";
import type { AppSupabaseClient } from "../../types/supabase";

import { findTaskById } from "./tasks.service";

import type {
  CreateTaskNoteInput,
  UpdateTaskNoteInput,
} from "./task-notes.schema";

import {
  createTaskNote,
  getTaskNotes,
  updateTaskNote,
  deleteTaskNote,
} from "./task-notes.repository";

export async function addTaskNote(
  supabase: AppSupabaseClient,
  organizationId: string,
  taskId: string,
  input: CreateTaskNoteInput,
) {
  await findTaskById(supabase, organizationId, taskId);

  const { data, error } = await createTaskNote(supabase, taskId, input);

  if (error || !data) {
    throw new AppError(
      "TASK_NOTE_CREATE_FAILED",
      500,
      "Failed to create task note",
    );
  }

  return data;
}

export async function listTaskNotes(
  supabase: AppSupabaseClient,
  organizationId: string,
  taskId: string,
) {
  await findTaskById(supabase, organizationId, taskId);

  const { data, error } = await getTaskNotes(supabase, taskId);

  if (error || data === null) {
    throw new AppError(
      "TASK_NOTES_FETCH_FAILED",
      500,
      "Failed to fetch task notes",
    );
  }

  return data;
}

export async function editTaskNote(
  supabase: AppSupabaseClient,
  organizationId: string,
  taskId: string,
  noteId: string,
  input: UpdateTaskNoteInput,
) {
  await findTaskById(supabase, organizationId, taskId);

  const { data, error } = await updateTaskNote(supabase, taskId, noteId, input);

  if (error) {
    throw new AppError(
      "TASK_NOTE_UPDATE_FAILED",
      500,
      "Failed to update task note",
    );
  }

  if (!data) {
    throw new AppError("TASK_NOTE_NOT_FOUND", 404, "Task note not found");
  }

  return data;
}

export async function removeTaskNote(
  supabase: AppSupabaseClient,
  organizationId: string,
  taskId: string,
  noteId: string,
) {
  await findTaskById(supabase, organizationId, taskId);

  const { data, error } = await deleteTaskNote(supabase, taskId, noteId);

  if (error) {
    throw new AppError(
      "TASK_NOTE_DELETE_FAILED",
      500,
      "Failed to delete task note",
    );
  }

  if (!data) {
    throw new AppError("TASK_NOTE_NOT_FOUND", 404, "Task note not found");
  }

  return data;
}
