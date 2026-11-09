import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppSupabaseClient } from "../../types/supabase";

import { AppError } from "../../core/errors/app-error";
import { findLeadById } from "./leads.service";

import {
  createLeadNote,
  getLeadNotes,
  updateLeadNote,
  deleteLeadNote,
} from "./lead-notes.repository";

import {
  addLeadNote,
  listLeadNotes,
  editLeadNote,
  removeLeadNote,
} from "./lead-notes.service";

// --------------------------------------------------
// MOCK DEPENDENCIES
// --------------------------------------------------

vi.mock("./leads.service", () => ({
  findLeadById: vi.fn(),
}));

vi.mock("./lead-notes.repository", () => ({
  createLeadNote: vi.fn(),
  getLeadNotes: vi.fn(),
  updateLeadNote: vi.fn(),
  deleteLeadNote: vi.fn(),
}));

// --------------------------------------------------
// TEST DATA
// --------------------------------------------------

const supabase = {} as AppSupabaseClient;

const leadId = "4e8cde38-856b-422e-8e2a-48b377457424";
const noteId = "5c0cba42-0a5d-43f5-bb0b-7fa92661ef5e";
const userId = "10a2d962-85a1-4cfb-b604-314a2b6e5712";

const note = {
  id: noteId,
  lead_id: leadId,
  author_user_id: userId,
  content: "Customer is interested in our service.",
  created_at: "2026-11-09T10:00:00Z",
  updated_at: "2026-11-09T10:00:00Z",
};

const databaseError = {
  code: "DATABASE_ERROR",
  message: "Database unavailable",
};

const leadNotFoundError = new AppError(
  "LEAD_NOT_FOUND",
  404,
  "Lead not found!",
);

// Mock Supabase query results without a real database.
function mockResult<T>(result: T): never {
  return Promise.resolve(result) as never;
}

beforeEach(() => {
  vi.resetAllMocks();

  // By default, assume the lead exists and is accessible.
  vi.mocked(findLeadById).mockResolvedValue({
    id: leadId,
  } as never);
});

// --------------------------------------------------
// 1. CREATE LEAD NOTE
// --------------------------------------------------

describe("Lead Notes Service - addLeadNote", () => {
  const input = {
    content: "Customer is interested in our service.",
  };

  it("should successfully create a lead note", async () => {
    vi.mocked(createLeadNote).mockReturnValue(
      mockResult({
        data: note,
        error: null,
      }),
    );

    const result = await addLeadNote(supabase, leadId, userId, input);

    expect(result).toEqual(note);

    expect(findLeadById).toHaveBeenCalledWith(supabase, leadId);

    expect(createLeadNote).toHaveBeenCalledWith(
      supabase,
      leadId,
      userId,
      input,
    );
  });

  it("should return 404 when the lead is inaccessible", async () => {
    vi.mocked(findLeadById).mockRejectedValue(leadNotFoundError);

    await expect(
      addLeadNote(supabase, leadId, userId, input),
    ).rejects.toMatchObject({
      code: "LEAD_NOT_FOUND",
      status: 404,
    });

    expect(createLeadNote).not.toHaveBeenCalled();
  });

  it("should propagate a lead lookup database failure", async () => {
    vi.mocked(findLeadById).mockRejectedValue(
      new AppError("LEAD_FETCH_FAILED", 500, "Failed to fetch lead!"),
    );

    await expect(
      addLeadNote(supabase, leadId, userId, input),
    ).rejects.toMatchObject({
      code: "LEAD_FETCH_FAILED",
      status: 500,
    });

    expect(createLeadNote).not.toHaveBeenCalled();
  });

  it("should return 500 when note creation fails", async () => {
    vi.mocked(createLeadNote).mockReturnValue(
      mockResult({
        data: null,
        error: databaseError,
      }),
    );

    await expect(
      addLeadNote(supabase, leadId, userId, input),
    ).rejects.toMatchObject({
      code: "LEAD_NOTE_CREATE_FAILED",
      status: 500,
    });
  });

  it("should return 500 when creation returns no data", async () => {
    vi.mocked(createLeadNote).mockReturnValue(
      mockResult({
        data: null,
        error: null,
      }),
    );

    await expect(
      addLeadNote(supabase, leadId, userId, input),
    ).rejects.toMatchObject({
      code: "LEAD_NOTE_CREATE_FAILED",
      status: 500,
    });
  });
});

// --------------------------------------------------
// 2. LIST LEAD NOTES
// --------------------------------------------------

describe("Lead Notes Service - listLeadNotes", () => {
  it("should return notes for an accessible lead", async () => {
    const notes = [note];

    vi.mocked(getLeadNotes).mockReturnValue(
      mockResult({
        data: notes,
        error: null,
      }),
    );

    const result = await listLeadNotes(supabase, leadId);

    expect(result).toEqual(notes);

    expect(findLeadById).toHaveBeenCalledWith(supabase, leadId);

    expect(getLeadNotes).toHaveBeenCalledWith(supabase, leadId);
  });

  it("should return an empty array when no notes exist", async () => {
    vi.mocked(getLeadNotes).mockReturnValue(
      mockResult({
        data: [],
        error: null,
      }),
    );

    const result = await listLeadNotes(supabase, leadId);

    expect(result).toEqual([]);
  });

  it("should return 404 when the lead is inaccessible", async () => {
    vi.mocked(findLeadById).mockRejectedValue(leadNotFoundError);

    await expect(listLeadNotes(supabase, leadId)).rejects.toMatchObject({
      code: "LEAD_NOT_FOUND",
      status: 404,
    });

    expect(getLeadNotes).not.toHaveBeenCalled();
  });

  it("should return 500 when fetching notes fails", async () => {
    vi.mocked(getLeadNotes).mockReturnValue(
      mockResult({
        data: null,
        error: databaseError,
      }),
    );

    await expect(listLeadNotes(supabase, leadId)).rejects.toMatchObject({
      code: "LEAD_NOTES_FETCH_FAILED",
      status: 500,
    });
  });
});

// --------------------------------------------------
// 3. UPDATE LEAD NOTE
// --------------------------------------------------

describe("Lead Notes Service - editLeadNote", () => {
  const input = {
    content: "Customer requested a follow-up call.",
  };

  it("should successfully update a lead note", async () => {
    const updatedNote = {
      ...note,
      content: input.content,
    };

    vi.mocked(updateLeadNote).mockReturnValue(
      mockResult({
        data: updatedNote,
        error: null,
      }),
    );

    const result = await editLeadNote(supabase, leadId, noteId, input);

    expect(result).toEqual(updatedNote);

    expect(findLeadById).toHaveBeenCalledWith(supabase, leadId);

    expect(updateLeadNote).toHaveBeenCalledWith(
      supabase,
      leadId,
      noteId,
      input,
    );
  });

  it("should return 404 when the note does not exist", async () => {
    vi.mocked(updateLeadNote).mockReturnValue(
      mockResult({
        data: null,
        error: null,
      }),
    );

    await expect(
      editLeadNote(supabase, leadId, noteId, input),
    ).rejects.toMatchObject({
      code: "LEAD_NOTE_NOT_FOUND",
      status: 404,
    });
  });

  it("should return 404 when the lead is inaccessible", async () => {
    vi.mocked(findLeadById).mockRejectedValue(leadNotFoundError);

    await expect(
      editLeadNote(supabase, leadId, noteId, input),
    ).rejects.toMatchObject({
      code: "LEAD_NOT_FOUND",
      status: 404,
    });

    expect(updateLeadNote).not.toHaveBeenCalled();
  });

  it("should return 500 when note update fails", async () => {
    vi.mocked(updateLeadNote).mockReturnValue(
      mockResult({
        data: null,
        error: databaseError,
      }),
    );

    await expect(
      editLeadNote(supabase, leadId, noteId, input),
    ).rejects.toMatchObject({
      code: "LEAD_NOTE_UPDATE_FAILED",
      status: 500,
    });
  });
});

// --------------------------------------------------
// 4. DELETE LEAD NOTE
// --------------------------------------------------

describe("Lead Notes Service - removeLeadNote", () => {
  it("should successfully delete a lead note", async () => {
    vi.mocked(deleteLeadNote).mockReturnValue(
      mockResult({
        data: note,
        error: null,
      }),
    );

    const result = await removeLeadNote(supabase, leadId, noteId);

    expect(result).toEqual(note);

    expect(findLeadById).toHaveBeenCalledWith(supabase, leadId);

    expect(deleteLeadNote).toHaveBeenCalledWith(supabase, leadId, noteId);
  });

  it("should return 404 when the note does not exist", async () => {
    vi.mocked(deleteLeadNote).mockReturnValue(
      mockResult({
        data: null,
        error: null,
      }),
    );

    await expect(
      removeLeadNote(supabase, leadId, noteId),
    ).rejects.toMatchObject({
      code: "LEAD_NOTE_NOT_FOUND",
      status: 404,
    });
  });

  it("should return 404 when the lead is inaccessible", async () => {
    vi.mocked(findLeadById).mockRejectedValue(leadNotFoundError);

    await expect(
      removeLeadNote(supabase, leadId, noteId),
    ).rejects.toMatchObject({
      code: "LEAD_NOT_FOUND",
      status: 404,
    });

    expect(deleteLeadNote).not.toHaveBeenCalled();
  });

  it("should return 500 when note deletion fails", async () => {
    vi.mocked(deleteLeadNote).mockReturnValue(
      mockResult({
        data: null,
        error: databaseError,
      }),
    );

    await expect(
      removeLeadNote(supabase, leadId, noteId),
    ).rejects.toMatchObject({
      code: "LEAD_NOTE_DELETE_FAILED",
      status: 500,
    });
  });
});
