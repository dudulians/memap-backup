// The path of evenings on Today (Aurora UX, step 1). Duolingo's lesson
// path, rebuilt for MeMap: every evening is a stop, seven evenings make
// a "week" (not a calendar week), and the seventh opens a report.
import { Tracker, TrackerEntry } from "@/types/tracker";

export const EVENINGS_PER_WEEK = 7;

export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const activeTrackers = (trackers: Tracker[]) =>
  trackers.filter((tr) => !tr.archived && tr.source !== "play");

/** Dates (ascending, up to today) that count as an evening: at least half
 *  of the active questions answered, and at least two when there are two
 *  or more. A single answer logged in the moment isn't an evening. */
export const eveningDates = (trackers: Tracker[], entries: TrackerEntry[], today = isoDay(new Date())): string[] => {
  const active = activeTrackers(trackers);
  if (active.length === 0) return [];
  const ids = new Set(active.map((tr) => tr.id));
  const need = Math.max(Math.ceil(active.length / 2), Math.min(2, active.length));
  const perDay = new Map<string, Set<string>>();
  for (const e of entries) {
    if (!ids.has(e.trackerId) || e.date > today) continue;
    if (!perDay.has(e.date)) perDay.set(e.date, new Set());
    perDay.get(e.date)!.add(e.trackerId);
  }
  return [...perDay.entries()].filter(([, s]) => s.size >= need).map(([d]) => d).sort();
};

export interface PathState {
  /** 0-based week number. */
  week: number;
  /** Evenings done in this week, tonight included when it's done. */
  doneInWeek: number;
  tonightDone: boolean;
  /** Index (0..6) of tonight's stop in this week. */
  tonightIndex: number;
  /** This week's seven evenings are all done (tonight finished it). */
  weekComplete: boolean;
  totalEvenings: number;
  /** Questions still unanswered tonight. */
  leftTonight: number;
}

export const pathState = (trackers: Tracker[], entries: TrackerEntry[], now = new Date()): PathState => {
  const today = isoDay(now);
  const dates = eveningDates(trackers, entries, today);
  const tonightDone = dates.includes(today);
  const before = dates.length - (tonightDone ? 1 : 0);
  const week = Math.floor(before / EVENINGS_PER_WEEK);
  const tonightIndex = before % EVENINGS_PER_WEEK;
  const doneInWeek = tonightIndex + (tonightDone ? 1 : 0);
  const active = activeTrackers(trackers);
  const leftTonight = active.filter((tr) => !entries.some((e) => e.trackerId === tr.id && e.date === today)).length;
  return {
    week,
    doneInWeek,
    tonightDone,
    tonightIndex,
    weekComplete: doneInWeek === EVENINGS_PER_WEEK,
    totalEvenings: dates.length,
    leftTonight,
  };
};
