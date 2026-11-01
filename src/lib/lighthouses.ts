// Lighthouses (Aurora, plan §3.5; her ask: "лимиты будут? с тем что типа
// если что-то чаще чего-то — пора делать то-то"). Each question's limit
// reads as a rule: IF it came N+ days in its window → THEN her plan. A rule
// that is crossed is "lit": gold, never red, no alarm.
import { Tracker, TrackerEntry } from "@/types/tracker";
import { isoLocal } from "@/lib/doors";

/** Days in the rule's window that count (YES for a problem question, NO
 *  for a "good" one), from the cycle start or the last periodDays days. */
export const ruleCount = (tracker: Tracker, entries: TrackerEntry[], now = new Date()): number => {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  from.setDate(from.getDate() - tracker.periodDays); // same window as the Limits tab
  let start = isoLocal(from);
  if (tracker.cycleStartDate && tracker.cycleStartDate > start) start = tracker.cycleStartDate;
  const today = isoLocal(now);
  const hit = tracker.problemWhen === "yes";
  return new Set(entries.filter((e) => e.trackerId === tracker.id && e.date >= start && e.date <= today && e.value === hit).map((e) => e.date)).size;
};

export const isLit = (tracker: Tracker, entries: TrackerEntry[]) => tracker.threshold > 0 && ruleCount(tracker, entries) >= tracker.threshold;

/** Ids of questions whose lighthouse is lit. */
export const litTrackers = (trackers: Tracker[], entries: TrackerEntry[]): Set<string> =>
  new Set(trackers.filter((t) => !t.archived && isLit(t, entries)).map((t) => t.id));
