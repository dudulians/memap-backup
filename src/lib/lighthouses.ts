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

/** The day a window of `days` calendar days ending on `end` begins: 7 days ending Tuesday begin on Wednesday
 *  (Nov 10 2026: the window began a day earlier, so "3 of the last 7 days" counted a day 8 days back). */
const windowFrom = (end: string, days: number): string =>
  isoLocal(new Date(Number(end.slice(0, 4)), Number(end.slice(5, 7)) - 1, Number(end.slice(8, 10)) - Math.max(1, days) + 1));

/** Days in the rule's window that count (YES for a problem question, NO for a "good" one): the same
 *  periodDays days ruleState counts (ending today once today is answered, else yesterday), from the cycle
 *  start when later. The "Try it" baseline reads this, so it matches the card (Nov 10 2026). */
export const ruleCount = (tracker: Tracker, entries: TrackerEntry[], now = new Date()): number => {
  const today = isoLocal(now);
  const end = entries.some((e) => e.trackerId === tracker.id && e.date === today) ? today : isoLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  let start = windowFrom(end, tracker.periodDays);
  if (tracker.cycleStartDate && tracker.cycleStartDate > start) start = tracker.cycleStartDate;
  const hit = tracker.problemWhen === "yes";
  return new Set(entries.filter((e) => e.trackerId === tracker.id && e.date >= start && e.date <= end && e.value === hit).map((e) => e.date)).size;
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

/** Days she answered are what count (persona walk, Nov 9 2026: someone who answers 3–4 evenings a week never
 *  reached "5 of 7" or "8 of 30", since a day with no answer counted as an easy day). A rule needs its usual
 *  share of the answered days, at least half its usual count (and 2), and enough answers to say anything:
 *  max(3, a quarter of the window). Every evening answered → exactly the old rule; it never lights later
 *  than before. Simulation over all 233 library rules and 9 answer patterns (scratchpad
 *  answered-days-sim.mjs, Nov 9 2026): 3 evenings a week missed 29% of rules it should reach, now 1%; false
 *  alarms 1% → 7% (every evening: 6%). Known cost: answering mostly on bad days lights more (4% → 26%). */
export type RuleState = {
  /** days with the hard answer */ k: number;
  /** days with any answer to this question */ n: number;
  /** calendar days looked at: the window, or since the first answer / "I did it" when later */ days: number;
  /** hard days it takes now (the threshold, or less when days went unanswered) */ need: number;
  /** some days in the window have no answer */ gaps: boolean;
  /** the window started later than its full length (first answer or "I did it") */ soFar: boolean;
  /** enough answers for the answered-days rule to apply */ byAnswers: boolean;
};
export const ruleState = (tracker: Tracker, entries: TrackerEntry[], now = new Date()): RuleState => {
  const today = isoLocal(now);
  const mine = entries.filter((e) => e.trackerId === tracker.id && e.date <= today);
  // today counts once it's answered: an evening answer isn't a gap all day (review, Nov 9 2026: an every-evening
  // answerer read "7 of your 14 answers" until the evening, and a 5-of-7 rule lit a day early)
  const end = mine.some((e) => e.date === today) ? today : isoLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  // exactly periodDays calendar days, ending there (Nov 10 2026: one more day was counted before)
  const windowStart = windowFrom(end, tracker.periodDays);
  let start = windowStart;
  if (tracker.cycleStartDate && tracker.cycleStartDate > start) start = tracker.cycleStartDate;
  const first = mine.reduce<string | null>((m, e) => (m === null || e.date < m ? e.date : m), null);
  if (first && first > start) start = first;
  const inWindow = mine.filter((e) => e.date >= start && e.date <= end);
  const hit = tracker.problemWhen === "yes";
  const k = new Set(inWindow.filter((e) => e.value === hit).map((e) => e.date)).size;
  const n = new Set(inWindow.map((e) => e.date)).size;
  const days = Math.max(1, Math.round((Date.parse(end + "T12:00:00") - Date.parse(start + "T12:00:00")) / 86_400_000) + 1);
  const T = tracker.threshold;
  const byAnswers = n >= Math.max(3, Math.ceil((tracker.periodDays + 1) / 4));
  const need = T <= 0 ? 0 : !byAnswers ? T : Math.min(T, Math.max(2, Math.ceil(T / 2), Math.ceil((T * n) / days)));
  // no answers at all is not "0 of your 0 answers"
  return { k, n, days, need, gaps: n > 0 && n < days, soFar: start > windowStart, byAnswers };
};

/** The rule's window as days, oldest first (the dots under a rule): the same periodDays days ruleState counts,
 *  ending today once today is answered, else yesterday. */
export const ruleWindowDates = (tracker: Tracker, entries: TrackerEntry[], now = new Date()): string[] => {
  const today = isoLocal(now);
  const end = entries.some((e) => e.trackerId === tracker.id && e.date === today) ? today : isoLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const from = windowFrom(end, tracker.periodDays);
  return Array.from({ length: Math.max(1, tracker.periodDays) }, (_, i) =>
    isoLocal(new Date(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)) + i)));
};

/** The same answered-days rule for any count over a window (the "Need to talk?" card: 12 of 14). */
export const needOf = (threshold: number, periodDays: number, n: number, days: number): number => {
  if (threshold <= 0) return 0;
  if (n < Math.max(3, Math.ceil((periodDays + 1) / 4))) return threshold;
  return Math.min(threshold, Math.max(2, Math.ceil(threshold / 2), Math.ceil((threshold * n) / Math.max(1, days))));
};

export const isLit = (tracker: Tracker, entries: TrackerEntry[]) => {
  if (tracker.threshold <= 0 || quietContext(tracker)) return false;
  const s = ruleState(tracker, entries);
  return s.k >= s.need;
};

/** Ids of questions whose lighthouse is lit. */
export const litTrackers = (trackers: Tracker[], entries: TrackerEntry[]): Set<string> =>
  new Set(trackers.filter((t) => !t.archived && isLit(t, entries)).map((t) => t.id));
