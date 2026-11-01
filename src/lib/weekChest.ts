// What a week's chest holds (Aurora step 6, plan §3.4): counts only, never
// a verdict. The main line is her topic ("Fights · 2 of 7 days"), else the
// question that came up most; up to three more rows; one early clue from
// the door's context questions. A week where nothing came up is a "calm
// week", never "nothing to show".
import { Tracker, TrackerEntry } from "@/types/tracker";
import { getDoorState, strongestContextFact, type ContextFact } from "@/lib/doors";
import { activeQuestions } from "@/lib/pathSteps";

export interface ChestStat { trackerId: string; door: boolean; k: number; n: number }
export interface ChestContent { main: ChestStat | null; rows: ChestStat[]; fact: ContextFact | null }

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
  return { main, rows, fact };
};
