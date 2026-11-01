// Day helpers for Today's path (Aurora UX). Since Nov 2 2026 the path is
// made of steps (src/lib/pathSteps.ts); the old "evening" rule stays here
// because old evenings must keep counting.
import { Tracker, TrackerEntry } from "@/types/tracker";

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

/** Consecutive evening dates ending today, or yesterday while tonight
 *  is still open, so the flame never disagrees with the path. */
export const eveningStreak = (dates: string[], now = new Date()): number => {
  const set = new Set(dates);
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!set.has(isoDay(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(isoDay(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
};
