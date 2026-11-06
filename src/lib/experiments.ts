// "Test one change" (Nov 2 2026; her ideas for progress: "провёл эксперимент —
// появился сад"). She picks one small change for an island and tries it for
// a week; MeMap asks "Did you…?" with that island's questions, then shows how
// her hard days went on days with the change and without. Counts only,
// never a promise that the change works. A finished test grows a garden on
// that island (src/lib/growth.ts). Stored on the phone like everything else.
import { Tracker, TrackerEntry } from "@/types/tracker";
import { getTrackers, saveTrackers } from "@/lib/storage";
import { isoLocal } from "@/lib/doors";
import { isHardAnswer, isTestQuestion, islandOf } from "@/lib/islands";
import { track } from "@/lib/analytics";

/** Two weeks (Nov 6 2026, board 68: week 4 "what helps" compares before and during). */
export const EXPERIMENT_DAYS = 14;
const KEY = "memap_experiments";

export interface Experiment {
  id: string;
  /** the island it is for */
  island: string;
  /** the "Did you…?" question it added */
  trackerId: string;
  /** what she tries, in her words */
  change: string;
  /** first day */
  start: string;
  /** when she looked at the result (then it is over) */
  reviewed?: string;
  /** keep asking the question after the week */
  kept?: boolean;
  /** the action point it came from ("I'll try", Nov 5 2026): that question's id */
  from?: string;
  /** "HH:MM": a daily reminder until the try ends (board 65, Nov 6 2026) */
  remind?: string;
}

/** A time that fits the change (board 65): bedtime ones in the evening, morning ones early. */
export const smartRemindTime = (idea: string | null): string => {
  const at: Record<string, string> = { bed23: "22:00", phoneAway: "21:30", noNewsEvening: "20:30", noMailEvening: "19:00", stop19: "18:30", noSweetsEvening: "19:30",
    noCoffee14: "13:30", water: "12:00", lunchBreak: "12:30", walk20: "08:00", outsideMorning: "08:00", stretch: "08:00", screenFreeHour: "18:00", bedtimeSame: "20:00" };
  return (idea && at[idea]) || "09:00";
};
/** Turn the try's daily reminder on (a time) or off (null). */
export const setExperimentRemind = (id: string, time: string | null) => {
  save(getExperiments().map((x) => (x.id === id ? (time ? { ...x, remind: time } : (({ remind: _r, ...rest }) => rest)(x)) : x)));
};

/** Ready ideas per island (keys into experiment.idea.*): everyday changes,
 *  hers to choose; MeMap only counts what happens. */
export const IDEAS: Record<string, string[]> = {
  me: ["outsideMorning", "phoneAway", "threeLines"],
  love: ["talkNoPhones", "thankYou", "walkTogether"],
  kids: ["screenFreeHour", "playTogether", "bedtimeSame"],
  health: ["bed23", "noCoffee14", "water"],
  body: ["walk20", "stretch", "noSweetsEvening"],
  pet: ["extraWalk", "playTime", "sameFoodTime"],
  parents: ["callParents", "visitWeekend", "shortMessage"],
  work: ["stop19", "lunchBreak", "noMailEvening"],
  world: ["noNewsEvening", "outsideMorning", "walk20"],
  mine: ["walk20", "bed23", "phoneAway"],
  other: ["walk20", "bed23", "phoneAway"],
};
export const ideasFor = (island: string): string[] => IDEAS[island] ?? IDEAS.other;

export const getExperiments = (): Experiment[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as Experiment[];
  } catch {
    return [];
  }
};
const save = (list: Experiment[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* not saved: she can start it again */
  }
  window.dispatchEvent(new Event("memap-islands-changed"));
};

const daysFrom = (from: string, to: string) =>
  Math.round((new Date(to + "T12:00:00").getTime() - new Date(from + "T12:00:00").getTime()) / 86_400_000);

/** The test running now (started, not yet looked at), if any. */
export const currentExperiment = (): Experiment | null => getExperiments().find((x) => !x.reviewed) ?? null;
/** 1-based day of the test today (8+ = the week is over). */
export const experimentDay = (x: Experiment, today = isoLocal(new Date())) => daysFrom(x.start, today) + 1;
export const experimentOver = (x: Experiment, today = isoLocal(new Date())) => experimentDay(x, today) > EXPERIMENT_DAYS;
/** Finished tests (looked at), the islands they grew a garden on. */
export const finishedExperiments = () => getExperiments().filter((x) => !!x.reviewed);

/** Start a test: adds "Did you…?" to the island, from today. */
export const startExperiment = async (island: string, change: string, question: string, from?: string): Promise<Experiment> => {
  track("experiment_started", { from: from ? "action_point" : "pick" });
  const existing = await getTrackers();
  const tracker: Tracker = {
    id: `${Date.now()}-test`,
    title: change.slice(0, 60),
    category: "Curious",
    questionText: question,
    answerType: "boolean",
    periodDays: 30,
    // No rule on a test question: it never lights a lighthouse.
    threshold: 0,
    problemWhen: "no",
    adviceAboveThreshold: "",
    createdAt: new Date().toISOString(),
    sortIndex: -1,
    island,
  };
  await saveTrackers([...existing, tracker]);
  const x: Experiment = { id: tracker.id, island, trackerId: tracker.id, change, start: isoLocal(new Date()), ...(from ? { from } : {}) };
  save([...getExperiments().filter((e) => e.reviewed), x]);
  window.dispatchEvent(new Event("memap-settings-changed"));
  return x;
};

export interface ExperimentResult {
  /** days she answered the test question */
  answered: number;
  /** days she did the change */
  did: number;
  /** hard days on the island: with the change [k, n] and without [k, n] */
  withChange: [number, number];
  without: [number, number];
}

/** How the island's hard days went on days with the change and without. */
export const experimentResult = (x: Experiment, trackers: Tracker[], entries: TrackerEntry[]): ExperimentResult => {
  const days = new Set(Array.from({ length: EXPERIMENT_DAYS }, (_, i) => {
    const d = new Date(x.start + "T12:00:00");
    d.setDate(d.getDate() + i);
    return isoLocal(d);
  }));
  // The island's questions (not test questions), hard days by the one rule
  // (isHardAnswer: YES to a hard question, NO to a good one).
  const own = new Map(trackers.filter((t) => !t.archived && !isTestQuestion(t) && islandOf(t) === x.island).map((t) => [t.id, t]));
  const did = new Map<string, boolean>();
  for (const e of entries) if (e.trackerId === x.trackerId && days.has(e.date)) did.set(e.date, e.value === true);
  const hard = new Set(entries.filter((e) => days.has(e.date) && own.has(e.trackerId) && isHardAnswer(own.get(e.trackerId)!, e.value)).map((e) => e.date));
  const answeredHard = new Set(entries.filter((e) => days.has(e.date) && own.has(e.trackerId)).map((e) => e.date));
  const withDays = [...did.entries()].filter(([d, v]) => v && answeredHard.has(d)).map(([d]) => d);
  const withoutDays = [...did.entries()].filter(([d, v]) => !v && answeredHard.has(d)).map(([d]) => d);
  return {
    answered: did.size,
    did: [...did.values()].filter(Boolean).length,
    withChange: [withDays.filter((d) => hard.has(d)).length, withDays.length],
    without: [withoutDays.filter((d) => hard.has(d)).length, withoutDays.length],
  };
};

/** She looked at the result: the test is over; keep the question or stop it. */
export const finishExperiment = async (id: string, keep: boolean) => {
  const list = getExperiments().map((x) => (x.id === id ? { ...x, reviewed: isoLocal(new Date()), kept: keep } : x));
  save(list);
  if (!keep) {
    const x = list.find((e) => e.id === id);
    const ts = await getTrackers();
    await saveTrackers(ts.map((t) => (t.id === x?.trackerId ? { ...t, archived: true } : t)));
    window.dispatchEvent(new Event("memap-settings-changed"));
  }
};
