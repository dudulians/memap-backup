// What a week's chest holds (Aurora step 6, plan §3.4): counts only, never
// a verdict. The main line is her topic ("Fights · 2 of 7 days"), else the
// question that came up most; up to three more rows; one early clue from
// the door's context questions. A week where nothing came up is a "calm
// week", never "nothing to show".
import { Tracker, TrackerEntry } from "@/types/tracker";
import { getDoorState, strongestContextFact, type ContextFact } from "@/lib/doors";
import { activeQuestions } from "@/lib/pathSteps";
import { computeCorrelations } from "@/lib/correlations";

export interface ChestStat { trackerId: string; door: boolean; k: number; n: number }
export interface ChestInsight { a: string; b: string; nextDay: boolean; k: number; n: number; otherK: number; otherN: number }
export interface ChestContent { main: ChestStat | null; rows: ChestStat[]; fact: ContextFact | null; insight: ChestInsight | null }

/** The strongest link in her answers so far, read like the map's links
 *  ("After A, the next day B on k of n days"). */
const strongestLink = (trackers: Tracker[], entries: TrackerEntry[]): ChestInsight | null => {
  const c = computeCorrelations(trackers, entries, 6).find((x) => x.counts.bothYes + x.counts.aYesBNo >= 3);
  if (!c) return null;
  const flip = c.lag === -1;
  const { bothYes, aYesBNo, aNoBYes, bothNo } = c.counts;
  const n = flip ? bothYes + aNoBYes : bothYes + aYesBNo;
  const otherK = flip ? aYesBNo : aNoBYes;
  const otherN = flip ? aYesBNo + bothNo : aNoBYes + bothNo;
  return { a: flip ? c.trackerB.id : c.trackerA.id, b: flip ? c.trackerA.id : c.trackerB.id, nextDay: c.lag !== 0, k: bothYes, n, otherK, otherN };
};

export const chestContent = (trackers: Tracker[], entries: TrackerEntry[], dates: string[]): ChestContent => {
  const inWeek = new Set(dates);
  const door = getDoorState();
  const stats: ChestStat[] = activeQuestions(trackers).map((t) => {
    const es = entries.filter((e) => e.trackerId === t.id && inWeek.has(e.date));
    return { trackerId: t.id, door: t.id === door?.trackerId, k: es.filter((e) => e.value === true).length, n: es.length };
  }).filter((s) => s.n > 0);
  const problem = new Set(trackers.filter((t) => t.problemWhen === "yes").map((t) => t.id));
  const byCount = (a: ChestStat, b: ChestStat) => b.k - a.k || b.k / b.n - a.k / a.n;
  const main =
    stats.find((s) => s.door) ??
    [...stats].filter((s) => problem.has(s.trackerId)).sort(byCount)[0] ??
    [...stats].sort(byCount)[0] ??
    null;
  const rows = stats.filter((s) => s !== main && s.k > 0).sort(byCount).slice(0, 3);
  const fact = door ? strongestContextFact(door, trackers, entries) : null;
  return { main, rows, fact, insight: strongestLink(trackers, entries) };
};
