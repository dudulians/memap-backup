// Lighthouses (Aurora, plan §3.5; her ask: "лимиты будут? с тем что типа
// если что-то чаще чего-то — пора делать то-то"). Each question's limit
// reads as a rule: IF it came N+ days in its window → THEN her plan. A rule
// that is crossed is "lit": gold, never red, no alarm.
import { Tracker, TrackerEntry } from "@/types/tracker";
import { getDoorState, isoLocal } from "@/lib/doors";
import { matchTemplateIdByTitle } from "@/lib/relatedQuestions";

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

/** A question onboarding added around her topic (not one she picked) stays quiet for its first 3 weeks
 *  (persona walk, Nov 9 2026: "Time to act — you often don't work out" was the first rule a man with
 *  insomnia saw, on day 5). Her own topics and questions she added light as usual. */
export const quietContext = (tracker: Tracker, now = new Date()): boolean => {
  const door = getDoorState();
  if (!door || !door.contextTrackerIds?.includes(tracker.id)) return false;
  if (tracker.id === door.trackerId || (door.extra ?? []).some((x) => x.trackerId === tracker.id)) return false;
  // a question she typed herself in onboarding is hers: it lights as usual
  if (!matchTemplateIdByTitle(tracker.title)) return false;
  const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 21);
  return door.startedAt > isoLocal(since);
};

export const isLit = (tracker: Tracker, entries: TrackerEntry[]) => tracker.threshold > 0 && !quietContext(tracker) && ruleCount(tracker, entries) >= tracker.threshold;

/** Ids of questions whose lighthouse is lit. */
export const litTrackers = (trackers: Tracker[], entries: TrackerEntry[]): Set<string> =>
  new Set(trackers.filter((t) => !t.archived && isLit(t, entries)).map((t) => t.id));
