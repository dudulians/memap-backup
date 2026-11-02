// "Predict" (Nov 2 2026; her note: "игру надо придумать другую или ещё одну —
// пока человеку нечего делать после ответов, пока нет статистики, ему надо
// что-то другое поделать"). Works from day 1, no data needed: during the day
// she guesses how up to three of tonight's questions will go (Yes or No);
// once she has answered them, she sees how many she guessed. Never a loss:
// a miss is "it surprised you". In the evening the guess is for tomorrow.
// Guesses stay on the phone (localStorage), like everything else.
import { Tracker, TrackerEntry } from "@/types/tracker";
import { getDoorState, isoLocal } from "@/lib/doors";

const KEY = "memap_predictions";
export const PREDICT_COUNT = 3;
/** From this hour, the guess is for tomorrow (tonight's answers are too close). */
const EVENING = 18;

export interface DayGuess { guesses: Record<string, boolean>; revealed?: boolean }
type Store = Record<string, DayGuess>;

const read = (): Store => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as Store;
  } catch {
    return {};
  }
};
const write = (s: Store) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* the game just asks again */
  }
};

const live = (trackers: Tracker[]) => trackers.filter((t) => !t.archived && t.source !== "play");
const answeredOn = (entries: TrackerEntry[], date: string) => new Set(entries.filter((e) => e.date === date).map((e) => e.trackerId));

/** Up to three questions not yet answered that day: her topic first, then a
 *  different few each day. */
export const predictQuestions = (trackers: Tracker[], entries: TrackerEntry[], date: string): string[] => {
  const got = answeredOn(entries, date);
  const door = getDoorState();
  const open = live(trackers).filter((t) => !got.has(t.id));
  const day = Math.floor(new Date(date + "T12:00:00").getTime() / 86_400_000);
  const rest = open.filter((t) => t.id !== door?.trackerId);
  const start = rest.length ? (day * 2) % rest.length : 0;
  const rotated = [...rest.slice(start), ...rest.slice(0, start)];
  const first = open.find((t) => t.id === door?.trackerId);
  return [...(first ? [first] : []), ...rotated].slice(0, PREDICT_COUNT).map((t) => t.id);
};

export type PredictState =
  /** guess now (for today, or for tomorrow in the evening) */
  | { stage: "guess"; date: string; ids: string[] }
  /** guessed; the answers aren't all in yet */
  | { stage: "waiting"; date: string; ids: string[] }
  /** all answered: see how it went */
  | { stage: "reveal"; date: string; ids: string[] }
  | { stage: "done"; date: string; hit: number; n: number };

const scoreOf = (g: DayGuess, entries: TrackerEntry[], date: string) => {
  const ids = Object.keys(g.guesses);
  const by = new Map(entries.filter((e) => e.date === date).map((e) => [e.trackerId, e.value]));
  return { hit: ids.filter((id) => by.get(id) === g.guesses[id]).length, n: ids.length };
};

export const predictState = (trackers: Tracker[], entries: TrackerEntry[], now = new Date()): PredictState | null => {
  const s = read();
  const today = isoLocal(now);
  const tomorrow = isoLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const g = s[today];
  if (g) {
    const ids = Object.keys(g.guesses);
    const got = answeredOn(entries, today);
    if (!ids.every((id) => got.has(id))) return { stage: "waiting", date: today, ids };
    if (!g.revealed) return { stage: "reveal", date: today, ids };
    return { stage: "done", date: today, ...scoreOf(g, entries, today) };
  }
  if (s[tomorrow]) return { stage: "waiting", date: tomorrow, ids: Object.keys(s[tomorrow].guesses) };
  if (now.getHours() < EVENING) {
    const ids = predictQuestions(trackers, entries, today);
    if (ids.length > 0) return { stage: "guess", date: today, ids };
  }
  const ids = predictQuestions(trackers, [], tomorrow);
  return ids.length > 0 ? { stage: "guess", date: tomorrow, ids } : null;
};

export const saveGuesses = (date: string, guesses: Record<string, boolean>) => {
  const s = read();
  s[date] = { guesses };
  write(s);
};
export const markRevealed = (date: string) => {
  const s = read();
  if (s[date]) s[date].revealed = true;
  write(s);
};
export const guessesFor = (date: string): DayGuess | null => read()[date] ?? null;

/** How her guesses went on these days (revealed ones), for the week's chest. */
export const guessScore = (entries: TrackerEntry[], dates: string[]): { hit: number; n: number } => {
  const s = read();
  let hit = 0;
  let n = 0;
  for (const d of dates) {
    const g = s[d];
    if (!g) continue;
    const r = scoreOf(g, entries, d);
    // Only questions she then answered count.
    const got = answeredOn(entries, d);
    const asked = Object.keys(g.guesses).filter((id) => got.has(id)).length;
    hit += r.hit;
    n += asked;
  }
  return { hit, n };
};
