// "My week" (Malu's world, 1.9): every question is a row, every day a
// column, so what happened on the same day lines up by itself ("drank
// on Tuesday, migraine on Wednesday"). Pure counting, no statistics.
// Read by the Today map, the evening's filling strip and the recall
// ("fill in your week") flow.
import { Tracker, TrackerEntry } from "@/types/tracker";
import { DoorId, getDoorState, isoLocal } from "./doors";

/** "hit" = the side the person cares about (a fight happened, slept
 *  badly); "fine" = the other answer; "empty" = no answer that day. */
export type CellState = "hit" | "fine" | "empty";

export interface WeekCell {
  date: string;
  state: CellState;
  isToday: boolean;
  isFuture: boolean;
}

export interface WeekRow {
  tracker: Tracker;
  /** Set when the row is a door's main question (fights, migraine…). */
  door?: DoorId;
  cells: WeekCell[];
  hits: number;
}

/** Monday-first week that contains `day`, as 7 local ISO dates. */
export const weekDates = (day: Date, offsetWeeks = 0): string[] => {
  const d = new Date(day);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offsetWeeks * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return isoLocal(x);
  });
};

/** The last 7 days, today last. Used where the week should not jump
 *  on Monday (the evening strip, the recall flow). */
export const lastDates = (day: Date, n = 7): string[] =>
  Array.from({ length: n }, (_, i) => {
    const x = new Date(day);
    x.setHours(12, 0, 0, 0);
    x.setDate(x.getDate() - (n - 1 - i));
    return isoLocal(x);
  });

export const isHit = (tracker: Tracker, value: boolean): boolean =>
  tracker.problemWhen === "yes" ? value : !value;

/** Door main questions first (in door order), then the rest in the
 *  person's own order. Archived questions are left out. */
export const orderedTrackers = (trackers: Tracker[]): { tracker: Tracker; door?: DoorId }[] => {
  const state = getDoorState();
  const doorIds = new Map<string, DoorId>();
  if (state) {
    doorIds.set(state.trackerId, state.id);
    for (const x of state.extra ?? []) doorIds.set(x.trackerId, x.id);
  }
  const live = trackers.filter((t) => !t.archived && t.answerType === "boolean");
  const doors = [...doorIds.entries()]
    .map(([id, door]) => ({ tracker: live.find((t) => t.id === id), door }))
    .filter((x): x is { tracker: Tracker; door: DoorId } => !!x.tracker);
  const rest = live
    .filter((t) => !doorIds.has(t.id))
    .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
    .map((tracker) => ({ tracker }));
  return [...doors, ...rest];
};

export const weekRows = (
  trackers: Tracker[],
  entries: TrackerEntry[],
  dates: string[],
  now: Date = new Date(),
): WeekRow[] => {
  const today = isoLocal(now);
  const byKey = new Map(entries.map((e) => [`${e.trackerId}|${e.date}`, e.value]));
  return orderedTrackers(trackers).map(({ tracker, door }) => {
    const cells = dates.map((date) => {
      const v = byKey.get(`${tracker.id}|${date}`);
      const state: CellState = v === undefined ? "empty" : isHit(tracker, v) ? "hit" : "fine";
      return { date, state, isToday: date === today, isFuture: date > today };
    });
    return { tracker, door, cells, hits: cells.filter((c) => c.state === "hit").length };
  });
};

/** Days (any question) with at least one answer. */
export const answeredDays = (entries: TrackerEntry[]): string[] =>
  Array.from(new Set(entries.map((e) => e.date))).sort();

/** How many of the given days have no answer at all yet (past only). */
export const missingDays = (entries: TrackerEntry[], dates: string[], now: Date = new Date()): string[] => {
  const today = isoLocal(now);
  const have = new Set(entries.map((e) => e.date));
  return dates.filter((d) => d < today && !have.has(d));
};

/** Evenings to the first week report (Patterns opens on it; links
 *  need more shared days and come later, see correlations.ts). */
export const FINDINGS_AFTER = 7;
