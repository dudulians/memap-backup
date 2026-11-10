import { safeParse } from "@/lib/safeParse";
import { uuid } from "@/lib/uuid";

export interface Note {
  id: string;
  date: string; // YYYY-MM-DD
  text: string;
  /** the first question it is about (kept for older screens and builds) */
  linkedPatternId?: string;
  /** every question it is about (her note, Nov 10 2026: "я бы разрешила множественный выбор"); the first is linkedPatternId */
  linkedPatternIds?: string[];
  /** the words of a "Why?" reason: the answer they belong to ("trackerId|date", src/lib/reasons.ts); Notes shows
   *  them under "Reasons", not again in the list */
  reasonFor?: string;
  createdAt: string;
  updatedAt: string;
}

const NOTES_KEY = "memap_notes";

export const getNotes = (): Promise<Note[]> => {
  return Promise.resolve().then(() => {
    const data = localStorage.getItem(NOTES_KEY);
    return safeParse<Note[]>(data, []);
  });
};

export const saveNotes = (notes: Note[]): Promise<void> => {
  return Promise.resolve().then(() => {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  });
};

/** The questions a note is about: all of them, or the one an older note has. */
export const noteQuestionIds = (n: Pick<Note, "linkedPatternId" | "linkedPatternIds">): string[] =>
  n.linkedPatternIds?.length ? n.linkedPatternIds : n.linkedPatternId ? [n.linkedPatternId] : [];

/** The two fields agree: linkedPatternId is always the first of linkedPatternIds. */
const linked = (x: Partial<Pick<Note, "linkedPatternId" | "linkedPatternIds">>): Partial<Pick<Note, "linkedPatternId" | "linkedPatternIds">> => {
  if (x.linkedPatternIds !== undefined) { const ids = [...new Set(x.linkedPatternIds.filter(Boolean))]; return { linkedPatternIds: ids, linkedPatternId: ids[0] }; }
  if ("linkedPatternId" in x) return { linkedPatternId: x.linkedPatternId || undefined, linkedPatternIds: x.linkedPatternId ? [x.linkedPatternId] : [] };
  return {};
};

export const addNote = async (note: Omit<Note, "id" | "createdAt" | "updatedAt">): Promise<Note> => {
  const notes = await getNotes();
  const newNote: Note = {
    ...note,
    ...linked(note),
    id: uuid(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await saveNotes([...notes, newNote]);
  return newNote;
};

export const updateNote = async (id: string, updates: Partial<Pick<Note, "text" | "linkedPatternId" | "linkedPatternIds" | "date">>): Promise<void> => {
  const notes = await getNotes();
  const updatedNotes = notes.map(note =>
    note.id === id
      ? { ...note, ...updates, ...linked(updates), updatedAt: new Date().toISOString() }
      : note
  );
  await saveNotes(updatedNotes);
};

export const deleteNote = async (id: string): Promise<void> => {
  const notes = await getNotes();
  await saveNotes(notes.filter(note => note.id !== id));
};

export const getNotesForDate = async (date: string): Promise<Note[]> => {
  const notes = await getNotes();
  return notes.filter(note => note.date === date);
};
