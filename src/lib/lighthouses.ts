// Lighthouses (Aurora, plan §3.5; her ask: "лимиты будут? с тем что типа
// если что-то чаще чего-то — пора делать то-то"). Each question's limit
// reads as a rule: IF it came N+ days in its window → THEN her plan. A rule
// that is crossed is "lit": gold, never red, no alarm.
import { Tracker, TrackerEntry } from "@/types/tracker";
import { getDoorState, isoLocal } from "@/lib/doors";
import { matchTemplateIdByTitle } from "@/lib/relatedQuestions";
import { RED_FLAG_IDS } from "@/lib/bodyTemplates";
import { HOME_HARM_IDS } from "@/lib/supportLines";

/** Onboarding-added questions that still light: the body and red-flag ones (a doctor rule), harm at home,
 *  an older parent's falls or medicines, a pet that stops eating or limps. */
const ALWAYS_LIGHT = new Set([...RED_FLAG_IDS, ...HOME_HARM_IDS, "parent-took-meds", "pet-skipped-food", "pet-limped"]);

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

/** A question onboarding added around her topic (not one she picked) stays quiet: no lighthouse, no task
 *  (persona walks, Nov 9 2026: "Time to act — you often don't work out" was the first rule a man with
 *  insomnia saw, on day 5, and again on day 23 after three quiet weeks: "no rules on questions I didn't
 *  choose"). It still shows in links and as a possible cause on her own topic's card. Her own topics,
 *  questions she added and the safety ones (ALWAYS_LIGHT) light as usual. */
export const quietContext = (tracker: Tracker, now = new Date()): boolean => {
  const door = getDoorState();
  if (!door || !door.contextTrackerIds?.includes(tracker.id)) return false;
  if (tracker.id === door.trackerId || (door.extra ?? []).some((x) => x.trackerId === tracker.id)) return false;
  // a question she typed herself in onboarding is hers: it lights as usual
  const tpl = matchTemplateIdByTitle(tracker.title);
  if (!tpl) return false;
  return !ALWAYS_LIGHT.has(tpl);
};

export const isLit = (tracker: Tracker, entries: TrackerEntry[]) => tracker.threshold > 0 && !quietContext(tracker) && ruleCount(tracker, entries) >= tracker.threshold;

/** Ids of questions whose lighthouse is lit. */
export const litTrackers = (trackers: Tracker[], entries: TrackerEntry[]): Set<string> =>
  new Set(trackers.filter((t) => !t.archived && isLit(t, entries)).map((t) => t.id));
