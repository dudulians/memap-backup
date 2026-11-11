// What a week's chest holds (Aurora step 6, plan §3.4): counts only, never
// a verdict. The main line is her topic ("Fights · 2 of 7 days"), else the
// question that came up most; up to three more rows; one early clue from
// the door's context questions. A week where nothing came up is a "calm
// week", never "nothing to show".
import { Tracker, TrackerEntry } from "@/types/tracker";
import { getDoor, getDoorState, strongestContextFact, type ContextFact } from "@/lib/doors";
import { activeQuestions } from "@/lib/pathSteps";
import { computeCorrelations } from "@/lib/correlations";
import { isNeutralQuestion, linkOf, linkWorthShowing, LINKS_TOP, rankLinks } from "@/lib/islands";

/** days: the week's answers in day order (true/false, null = no answer); hardWhen: which answer is hard */
export interface ChestStat { trackerId: string; door: boolean; k: number; n: number; days: (boolean | null)[]; hardWhen: "yes" | "no" | null }
export interface ChestInsight { a: string; b: string; nextDay: boolean; k: number; n: number; otherK: number; otherN: number; firstYes?: boolean; secondYes?: boolean }
export interface ChestContent { main: ChestStat | null; rows: ChestStat[]; fact: ContextFact | null; insight: ChestInsight | null }

/** The strongest link in her answers so far, read like the map's links
 *  ("After A, the next day B on k of n days"). */
// The same link as the top of the Links list, read the same way round (QA, Nov 8 2026: the week
// report said the opposite of the Links list about the same two questions).
const strongestLink = (trackers: Tracker[], entries: TrackerEntry[]): ChestInsight | null => {
  const c = rankLinks(computeCorrelations(trackers.filter((x) => !x.archived && x.source !== "play"), entries, LINKS_TOP).filter(linkWorthShowing))[0];
  if (!c) return null;
  const l = linkOf(c);
  return { a: l.first.id, b: l.second.id, firstYes: l.firstYes, secondYes: l.secondYes, nextDay: l.nextDay, k: l.k, n: l.n, otherK: l.other.k, otherN: l.other.n };
};

export const chestContent = (trackers: Tracker[], entries: TrackerEntry[], dates: string[]): ChestContent => {
  const inWeek = new Set(dates);
  const door = getDoorState();
  const stats: ChestStat[] = activeQuestions(trackers).map((t) => {
    const es = entries.filter((e) => e.trackerId === t.id && inWeek.has(e.date));
    // the days in their real order, for dots under weekday letters (QA, Nov 8 2026: sorted dots read as
    // "the first three days")
    const days = dates.map((d) => { const v = es.find((e) => e.date === d)?.value; return typeof v === "boolean" ? v : null; });
    const hardWhen = isNeutralQuestion(t) ? null : t.problemWhen;
    // k counts what the label says (persona walk, Nov 9 2026: "Bad nights: 2 of 7" counted the GOOD nights):
    // her topic by its own answer ("Bad nights" = a "no" to Slept 7+), any other question by its hard answer
    const isDoor = t.id === door?.trackerId;
    const counted = isDoor ? (getDoor(door!.id)?.mainValue ?? true) : hardWhen === null ? true : hardWhen === "yes";
    return { trackerId: t.id, door: isDoor, k: es.filter((e) => e.value === counted).length, n: es.length, days, hardWhen };
  }).filter((s) => s.n > 0);
  const problem = new Set(trackers.filter((t) => t.problemWhen === "yes").map((t) => t.id));
  const byCount = (a: ChestStat, b: ChestStat) => b.k - a.k || b.k / b.n - a.k / a.n;
  const main =
    stats.find((s) => s.door) ??
    [...stats].filter((s) => problem.has(s.trackerId)).sort(byCount)[0] ??
    [...stats].sort(byCount)[0] ??
    null;
  // her other picked topics first (persona walk: "Drank enough water", a main topic, was missing), then the rest
  const extra = new Set((door?.extra ?? []).map((x) => x.trackerId));
  const rows = [...stats.filter((s) => s !== main && extra.has(s.trackerId)), ...stats.filter((s) => s !== main && !extra.has(s.trackerId) && s.k > 0).sort(byCount)].slice(0, 3);
  const fact = door ? strongestContextFact(door, trackers, entries) : null;
  return { main, rows, fact, insight: strongestLink(trackers, entries) };
};
