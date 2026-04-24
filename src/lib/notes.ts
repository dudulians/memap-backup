import { safeParse } from "@/lib/safeParse";
import { uuid } from "@/lib/uuid";

export interface Note {
  id: string;
  date: string; // YYYY-MM-DD
  text: string;
  linkedPatternId?: string;
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

export const addNote = async (note: Omit<Note, "id" | "createdAt" | "updatedAt">): Promise<Note> => {
  const notes = await getNotes();
  const newNote: Note = {
    ...note,
    id: uuid(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await saveNotes([...notes, newNote]);
  return newNote;
};

export const updateNote = async (id: string, updates: Partial<Pick<Note, "text" | "linkedPatternId" | "date">>): Promise<void> => {
  const notes = await getNotes();
  const updatedNotes = notes.map(note =>
    note.id === id
      ? { ...note, ...updates, updatedAt: new Date().toISOString() }
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
