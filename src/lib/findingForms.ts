// New kinds of findings (her brief, Nov 11 2026, via the App Store session; her pick "Да, A и числа" on
// https://claude.ai/artifact/8Pvpztq7ozayvMg2XfTfnx). Her words: «ценность… сказать, что ты выжат на самом деле
// только в дни, когда ты не поспал… а в остальные дни ты чувствуешь себя отлично… Либо наоборот: ты чувствуешь
// себя так, даже несмотря на то, что спал хорошо… значит, дело в другом». Plan and her questions:
// memory project_memap_findings_forms.md.
//
// All of it reads the same counts as every link (with / without × came / didn't); nothing new is counted:
//   1. "Mostly on such days": the sentence starts from what hurts ("You mostly argue with your partner on days you
//      feel drained after work"), counted from the hard days ("12 of 14 times").
//   2. The other days in words when they are calm ("on other days almost never: 2 of 44").
//   3. "Looks like it's something else": a hard question came as often with a likely cause as without it.
//   4. A chain: one link leading into the next, told as one story.
// A link is days that came together, never a proven cause; the numbers below are hers (approved Nov 11 2026).
import type { CorrelationResult } from "@/lib/correlations";
import { trackerPolarity } from "@/lib/correlations";
import { getDoorState } from "@/lib/doors";
import { RELATED_QUESTIONS } from "@/lib/relatedQuestions";
import { templateIdOf } from "@/lib/answerPhrases";
import type { Tracker, TrackerEntry } from "@/types/tracker";

// --- 1. "Mostly on such days" -------------------------------------------------------------------------------
/** Her numbers (rule a): at least 6 hard days, at least 3 of every 4 on such days ("almost only" from 9 of 10),
 *  at least 10 other days to compare, and on those other days it's rare (at most 1 in 4). So a thing that comes
 *  almost every day never gets "mostly" (the App Store session's caution, Nov 11 2026). */
export const MOSTLY = { minHard: 6, share: 0.75, almostOnly: 0.9, minOther: 10, otherMax: 0.25 } as const;
export type Mostly = "mostly" | "almostOnly";

type LinkLike = {
  first: string; second: string; firstYes: boolean; secondYes: boolean; nextDay: boolean; k: number; n: number;
  other?: { k: number; n: number }; secondHard?: boolean | null;
};

/** The second side is what the sentence starts from only when that is clear: the next day (time says it), her own
 *  topic (onboarding), or the app's list of what may lead to what says the first may lead to the second. Otherwise
 *  the link keeps the plain form (her question, Nov 11 2026: how does the app know which one is "what hurts"). */
const outcomeIsClear = (r: LinkLike, first: Tracker, second: Tracker): boolean => {
  if (r.nextDay) return true;
  const door = getDoorState();
  const topics = new Set(door ? [door.trackerId, ...(door.extra ?? []).map((x) => x.trackerId)] : []);
  if (topics.has(second.id) && !topics.has(first.id)) return true;
  const ta = templateIdOf(first), tb = templateIdOf(second);
  return !!ta && !!tb && (RELATED_QUESTIONS[tb] ?? []).includes(ta);
};

/** "mostly" / "almost only" when this link passes her numbers, else null (the plain form). For a hard thing ("You
 *  mostly argue with your partner on days you feel drained after work") and, since her "Делай" (Nov 11 2026), for a
 *  good one too ("You mostly feel calm on days you walk 7,000+ steps"); never for a wish or a marker (neutral). */
export const mostlyOf = (r: LinkLike, first: Tracker, second: Tracker): Mostly | null => {
  if (r.secondHard === null || r.secondHard === undefined || !r.other) return null;
  const hard = r.k + r.other.k;
  if (hard < MOSTLY.minHard || r.other.n < MOSTLY.minOther) return null;
  if (r.other.k / r.other.n > MOSTLY.otherMax) return null;
  if ((isCycle(first) || isCycle(second)) && r.n + r.other.n < CYCLE_DAYS) return null;
  const share = r.k / hard;
  if (share < MOSTLY.share || !outcomeIsClear(r, first, second)) return null;
  return share >= MOSTLY.almostOnly ? "almostOnly" : "mostly";
};
/** The numbers a "mostly" link counts: of all the hard days, how many were such days ("12 of 14 times"). */
export const mostlyCount = (r: LinkLike): { k: number; n: number } => ({ k: r.k, n: r.k + (r.other?.k ?? 0) });

// --- 2. The other days in words -----------------------------------------------------------------------------
/** Her numbers (rule b): "never" at 0, "almost never" up to 1 in 10, "rarely" up to 1 in 4; more: numbers only. */
export type Calm = "never" | "almostNever" | "rarely";
export const calmOf = (k: number, n: number): Calm | null =>
  n <= 0 ? null : k === 0 ? "never" : k / n <= 0.1 ? "almostNever" : k / n <= 0.25 ? "rarely" : null;

// --- 3. "Looks like it's something else" --------------------------------------------------------------------
/** Her numbers (rule c), stricter than a link: at least 4 weeks of answers to both, at least 10 days with the
 *  likely cause and 10 without (a thing that hardly ever changes can't rule anything out), the hard thing at least
 *  5 times, and the two differ by less than 1 in 10. Only a hard question's likely causes (the app's own list of
 *  what may lead to what) that she also answers, on any island. */
// The hard thing at least 10 times, not 5 (Nov 11 2026, her "ты лучше меня понимаешь" on whether the numbers should
// change by topic): saying "it isn't this" is riskier than saying "it is", and from 5 migraines nothing can be ruled
// out. One set of numbers for every topic; they follow how often things happen instead of a table per topic.
export const NOT_IT = { minDays: 28, minSide: 10, minHard: 10, maxDiff: 0.1, max: 3 } as const;
/** The cycle comes a few days a month: anything with it needs two cycles of answers (8 weeks), or one month's
 *  coincidence would read as "mostly on period days" (Nov 11 2026). */
export const CYCLE = new Set(["period-day", "pms-signs", "heavy-flow-day", "period-symptoms", "breast-tender"]);
export const CYCLE_DAYS = 56;
export const isCycle = (tr: Tracker | undefined) => !!tr && CYCLE.has(templateIdOf(tr) ?? "");
export interface NotIt {
  outcome: Tracker; cause: Tracker;
  /** the cause's hard answer (a short night: "no" to "Slept 7+ hours") */
  causeHardYes: boolean;
  /** the outcome's hard answer */
  outcomeHardYes: boolean;
  /** with the cause: k1 of n1 days had the hard thing; without: k2 of n2 */
  k1: number; n1: number; k2: number; n2: number;
  /** more likely causes to watch, not asked yet (template ids) */
  watch: string[];
}
const hardYesOf = (tr: Tracker): boolean | null => {
  const p = trackerPolarity(tr);
  return p === "neutral" ? null : p === "bad";
};
export const notItFindings = (trackers: Tracker[], entries: TrackerEntry[], offered: (id: string) => boolean, linked: Set<string>): NotIt[] => {
  const live = trackers.filter((x) => !x.archived && x.source !== "play");
  const byTpl = new Map<string, Tracker>();
  for (const tr of live) { const id = templateIdOf(tr); if (id && !byTpl.has(id)) byTpl.set(id, tr); }
  const answers = new Map<string, Map<string, boolean>>();
  for (const e of entries) if (typeof e.value === "boolean") {
    if (!answers.has(e.trackerId)) answers.set(e.trackerId, new Map());
    answers.get(e.trackerId)!.set(e.date, e.value);
  }
  const out: (NotIt & { days: number })[] = [];
  for (const [tplB, b] of byTpl) {
    const bHard = hardYesOf(b);
    if (bHard === null) continue;
    const bAns = answers.get(b.id);
    if (!bAns) continue;
    const causes = RELATED_QUESTIONS[tplB] ?? [];
    for (const tplA of causes) {
      const a = byTpl.get(tplA);
      if (!a || a.id === b.id) continue;
      const aHard = hardYesOf(a);
      if (aHard === null) continue;
      if (linked.has([a.id, b.id].sort().join("|"))) continue;
      const aAns = answers.get(a.id);
      if (!aAns) continue;
      let n1 = 0, k1 = 0, n2 = 0, k2 = 0;
      for (const [date, av] of aAns) {
        const bv = bAns.get(date);
        if (bv === undefined) continue;
        const came = bv === bHard;
        if (av === aHard) { n1++; if (came) k1++; } else { n2++; if (came) k2++; }
      }
      if (n1 + n2 < NOT_IT.minDays || n1 < NOT_IT.minSide || n2 < NOT_IT.minSide || k1 + k2 < NOT_IT.minHard) continue;
      if ((isCycle(a) || isCycle(b)) && n1 + n2 < CYCLE_DAYS) continue;
      if (Math.abs(k1 / n1 - k2 / n2) >= NOT_IT.maxDiff) continue;
      const watch = causes.filter((id) => !byTpl.has(id) && offered(id)).slice(0, 3);
      out.push({ outcome: b, cause: a, causeHardYes: aHard, outcomeHardYes: bHard, k1, n1, k2, n2, watch, days: n1 + n2 });
    }
  }
  // her own topics first, then the most days; one card per hard question
  const door = getDoorState();
  const topics = new Set(door ? [door.trackerId, ...(door.extra ?? []).map((x) => x.trackerId)] : []);
  const seen = new Set<string>();
  return out
    .sort((x, y) => Number(topics.has(y.outcome.id)) - Number(topics.has(x.outcome.id)) || y.days - x.days)
    .filter((x) => (seen.has(x.outcome.id) ? false : (seen.add(x.outcome.id), true)))
    .slice(0, NOT_IT.max)
    .map(({ days: _days, ...x }) => x);
};

// --- 4. A chain -----------------------------------------------------------------------------------------------
/** Two shown links where the first one's result is the next one's cause, the same answer: "short night → drained
 *  after work", "drained after work → arguments". The best one (in the list's own order). */
export const chainOf = <T extends LinkLike>(links: T[]): [T, T] | null => {
  for (const l1 of links) for (const l2 of links) {
    if (l1 === l2) continue;
    if (l1.second === l2.first && l1.secondYes === l2.firstYes && l1.first !== l2.second) return [l1, l2];
  }
  return null;
};

// --- 5. Two things next to it -------------------------------------------------------------------------------
/** Two or three shown links that lead to the same answer of one question ("Headache most often comes with: period
 *  day 7 of 10 times, stress 6 of 9"; "Calm most often comes with: 7,000+ steps, friends"). Each line is a link already
 *  found, with its own numbers; nothing is said about the two together (that needs months of days: later, her
 *  "Делай", Nov 11 2026). Hard and good alike; at most two such cards. */
export const twoThingsOf = <T extends LinkLike>(links: T[]): T[][] => {
  const by = new Map<string, T[]>();
  for (const l of links) {
    if (l.secondHard === null || l.secondHard === undefined) continue;
    // one sentence fits the group: "most often on days A or B" / "the day after A or B"
    const key = `${l.second}|${l.secondYes}|${l.nextDay}`;
    by.set(key, [...(by.get(key) ?? []), l]);
  }
  return [...by.values()].filter((g) => new Set(g.map((x) => x.first)).size >= 2).map((g) => g.slice(0, 3)).slice(0, 2);
};

/** A key for a pair of questions, either way round. */
export const pairOf = (c: CorrelationResult) => [c.trackerA.id, c.trackerB.id].sort().join("|");
