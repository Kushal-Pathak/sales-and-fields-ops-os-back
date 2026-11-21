import type { Context } from "hono";
import type { AppEnv } from "../../types/app";

import { AppError } from "../../core/errors/app-error";
import { validate } from "../../shared/validation/validate";
import { validateUuid } from "../../shared/validation/validate-uuid";

import {
  createTaskNoteSchema,
  updateTaskNoteSchema,
} from "./task-notes.schema";

import {
  addTaskNote,
  listTaskNotes,
  editTaskNote,
  removeTaskNote,
} from "./task-notes.service";

async function parseBody(c: Context<AppEnv>) {
  return c.req.json().catch(() => {
    throw new AppError("VALIDATION_ERROR", 400, "Invalid JSON request body");
  });
}

export async function createTaskNoteController(c: Context<AppEnv>) {
  const taskId = validateUuid(c.req.param("id"), "Task ID");

  const input = validate(createTaskNoteSchema, await parseBody(c));

  const data = await addTaskNote(
    c.get("supabase"),
    c.get("organizationId"),
    taskId,
    input,
  );

  return c.json({ data }, 201);
}

export async function listTaskNotesController(c: Context<AppEnv>) {
  const taskId = validateUuid(c.req.param("id"), "Task ID");

  const data = await listTaskNotes(
    c.get("supabase"),
    c.get("organizationId"),
    taskId,
  );

  return c.json({ data });
}

export async function updateTaskNoteController(c: Context<AppEnv>) {
  const taskId = validateUuid(c.req.param("id"), "Task ID");
  const noteId = validateUuid(c.req.param("noteId"), "Note ID");

  const input = validate(updateTaskNoteSchema, await parseBody(c));

  const data = await editTaskNote(
    c.get("supabase"),
    c.get("organizationId"),
    taskId,
    noteId,
    input,
  );

  return c.json({ data });
}

export async function deleteTaskNoteController(c: Context<AppEnv>) {
  const taskId = validateUuid(c.req.param("id"), "Task ID");
  const noteId = validateUuid(c.req.param("noteId"), "Note ID");

  const data = await removeTaskNote(
    c.get("supabase"),
    c.get("organizationId"),
    taskId,
    noteId,
  );

  return c.json({ data });
}
