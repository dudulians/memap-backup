// "Test one change" (Nov 2 2026; her ideas for progress: "провёл эксперимент —
// появился сад"). She picks one small change for an island and tries it for
// a week; MeMap asks "Did you…?" with that island's questions, then shows how
// her hard days went on days with the change and without. Counts only,
// never a promise that the change works. A finished test grows a garden on
// that island (src/lib/growth.ts). Stored on the phone like everything else.
import { Tracker, TrackerEntry } from "@/types/tracker";
import { getTrackers, saveTrackers } from "@/lib/storage";
import { isoLocal } from "@/lib/doors";
import { isHardAnswer, isNeutralQuestion, isTestQuestion, islandOf } from "@/lib/islands";
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
  /** a weekly goal for the question itself ("3 workouts a week", Nov 8 2026): no new
   *  question, the test watches the one she has (trackerId) */
  same?: boolean;
  /** the goal a week, for "This week: 2 of 3" */
  perWeek?: number;
}

/** A time that fits the change (board 65): bedtime ones in the evening, morning ones early. Her own
 *  plan too, by its words (Nov 8 2026: "Go to bed by 23:00" came at 9:00 in the morning). */
export const smartRemindTime = (idea: string | null, text = ""): string => {
  const at: Record<string, string> = { bed23: "22:00", phoneAway: "21:30", noNewsEvening: "20:30", noMailEvening: "19:00", stop19: "18:30", noSweetsEvening: "19:30",
    noCoffee14: "13:30", water: "10:00", lunchBreak: "12:30", walk20: "08:00", outsideMorning: "08:00", stretch: "08:00", screenFreeHour: "18:00", bedtimeSame: "20:00",
    threeLines: "20:30", talkNoPhones: "19:00", thankYou: "18:00", walkTogether: "17:30", playTogether: "17:30", extraWalk: "17:00", playTime: "18:00",
    sameFoodTime: "08:00", callParents: "18:00", visitWeekend: "18:00", shortMessage: "12:00", nauseaLog: "12:00",
    socialLimit: "12:00", noSocialMorning: "07:30", noSocialBed: "21:30", gladLine: "20:30", noPhoneMorning: "07:30", screenBreaks: "10:00", newsOnce: "09:00", sameWake: "21:30", worryList: "21:00", coffeeTwo: "11:00", regularMeals: "08:00", dinnerEarly: "18:30", vegOne: "12:00", noAlcohol: "18:00", drinkLimit: "17:30", urgeNote: "12:00", delayTen: "10:00", waitDay: "12:00", spendLog: "20:30", noShopApps: "19:30", moveBreak: "10:00", symptomNote: "20:00", foodLog: "20:00", breathe: "13:00", smallJoy: "17:00", angerNote: "12:00", myTime: "17:00", doneList: "20:30", textFriend: "13:00", callOne: "18:00", outAmongPeople: "16:00", noPhoneMeal: "18:30", focusFirst: "08:30", oneThing: "20:00", learn15: "18:00", read10: "21:00", hobby20: "18:00", pauseYes: "09:00", tidy10: "18:00", askLocal: "11:00" };
  if (idea && at[idea]) return at[idea];
  const s = text.toLowerCase();
  // eating or drinking hours before bed: early evening; anything else about bed: an hour before it
  if (/(d|two|three) hours before bed|за [2-9] час|finish eating|dinner|drinks|ужин|заканчивать есть|ничего не пить/.test(s)) return "18:30";
  if (/bed|sleep|night|asleep|сна|спать|сон|ночь|кроват|отбой|wind(ing)? down|укладыв/.test(s)) return "21:00";
  if (/morning|breakfast|wake|утр|завтрак|подъ[её]м/.test(s)) return "08:00";
  if (/lunch|обед/.test(s)) return "12:00";
  if (/coffee|caffeine|кофе/.test(s)) return "13:30";
  if (/evening|вечер/.test(s)) return "19:00";
  if (/work|работ/.test(s)) return "17:30";
  return "10:00";
};
/** Once (Nov 8 2026): tests that got the old 9:00 default move to a time that fits them. */
export const fixDefaultReminders = (fit: (x: Experiment) => string) => {
  try {
    if (localStorage.getItem("memap_try_time_fixed")) return;
    localStorage.setItem("memap_try_time_fixed", "1");
    const list = getExperiments();
    if (!list.some((x) => !x.reviewed && x.remind === "09:00")) return;
    save(list.map((x) => (!x.reviewed && x.remind === "09:00" ? { ...x, remind: fit(x) } : x)));
  } catch { /* stays as it was */ }
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
/** Plans with their own test words (a question and today's line) that aren't island ideas (Nov 8 2026). */
export const PLAN_IDEAS = ["nauseaLog"];
/** Changes on a question's own topic (her note, Nov 9 2026: "Not for me" on comparing oneself online
 *  offered sweets and stretching). Which question has which topic: src/lib/topicIdeas.ts. */
export const TOPIC_IDEAS: Record<string, string[]> = {
  social: ["socialLimit", "noSocialMorning", "noSocialBed", "gladLine"],
  screens: ["phoneAway", "noPhoneMorning", "socialLimit", "screenBreaks"],
  news: ["newsOnce", "noNewsEvening", "noPhoneMorning"],
  sleep: ["bed23", "phoneAway", "sameWake", "worryList", "noCoffee14"],
  caffeine: ["noCoffee14", "coffeeTwo", "water"],
  food: ["regularMeals", "dinnerEarly", "vegOne", "noSweetsEvening", "water"],
  alcohol: ["noAlcohol", "drinkLimit", "urgeNote"],
  smoking: ["delayTen", "urgeNote", "walk20"],
  money: ["waitDay", "spendLog", "noShopApps"],
  movement: ["walk20", "stretch", "outsideMorning", "moveBreak"],
  pain: ["stretch", "moveBreak", "symptomNote"],
  headache: ["symptomNote", "water", "bed23", "regularMeals"],
  digestion: ["foodLog", "regularMeals", "dinnerEarly", "water"],
  nausea: ["nauseaLog", "foodLog", "regularMeals"],
  body: ["symptomNote", "water", "bed23"],
  eyes: ["screenBreaks", "phoneAway"],
  energy: ["bed23", "outsideMorning", "regularMeals", "walk20"],
  calm: ["breathe", "walk20", "outsideMorning", "threeLines"],
  mood: ["smallJoy", "outsideMorning", "textFriend", "threeLines"],
  joy: ["smallJoy", "gladLine", "outsideMorning"],
  anger: ["breathe", "angerNote", "myTime"],
  selfworth: ["doneList", "gladLine", "smallJoy"],
  rest: ["myTime", "smallJoy", "hobby20"],
  lonely: ["textFriend", "callOne", "outAmongPeople"],
  partner: ["talkNoPhones", "thankYou", "walkTogether", "noPhoneMeal"],
  past: ["threeLines", "textFriend", "noSocialBed"],
  kids: ["playTogether", "screenFreeHour", "bedtimeSame"],
  parenting: ["myTime", "breathe", "playTogether"],
  pet: ["extraWalk", "playTime", "sameFoodTime"],
  parents: ["callParents", "visitWeekend", "shortMessage"],
  work: ["stop19", "lunchBreak", "noMailEvening", "oneThing"],
  focus: ["focusFirst", "oneThing", "screenBreaks"],
  workpeople: ["lunchBreak", "breathe", "threeLines"],
  boundaries: ["pauseYes", "myTime", "threeLines"],
  habits: ["sameWake", "oneThing", "noPhoneMorning"],
  growth: ["learn15", "read10", "hobby20"],
  decisions: ["threeLines", "callOne"],
  home: ["tidy10"],
  expat: ["callOne", "outAmongPeople", "threeLines"],
  language: ["askLocal", "learn15"],
};

export const getExperiments = (): Experiment[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as Experiment[];
  } catch {
    return [];
  }
};
/** Replace the list (a one-time move, src/lib/testWords.ts migrateGoalTests). */
export const replaceExperiments = (list: Experiment[]) => save(list);
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

/** The test running now (started, not yet looked at), if any: the first of them. */
export const currentExperiment = (): Experiment | null => getExperiments().find((x) => !x.reviewed) ?? null;
/** Every test running now: one per island (Nov 7 2026: two changes for the same island at once and
 *  you couldn't tell which helped; different islands run side by side). */
export const runningExperiments = (): Experiment[] => getExperiments().filter((x) => !x.reviewed);
export const testOnIsland = (island: string): Experiment | null => runningExperiments().find((x) => x.island === island) ?? null;
/** 1-based day of the test today (8+ = the week is over). */
export const experimentDay = (x: Experiment, today = isoLocal(new Date())) => daysFrom(x.start, today) + 1;
export const experimentOver = (x: Experiment, today = isoLocal(new Date())) => experimentDay(x, today) > EXPERIMENT_DAYS;
/** Finished tests (looked at), the islands they grew a garden on. */
export const finishedExperiments = () => getExperiments().filter((x) => !!x.reviewed);

const sameChange = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
/** The other tests whose two weeks overlapped this one's: their effects mix into its result. */
export const overlapping = (x: Experiment): Experiment[] => {
  const end = (e: Experiment) => { const d = new Date(e.start + "T12:00:00"); d.setDate(d.getDate() + EXPERIMENT_DAYS - 1); return isoLocal(d); };
  return getExperiments().filter((e) => e.id !== x.id && e.start <= end(x) && end(e) >= x.start);
};
/** Start a test: adds "Did you…?" to the island, from today (a weekly goal adds nothing:
 *  it watches the question she has). */
export const startExperiment = async (island: string, change: string, question: string, from?: string, opts: { same?: boolean; perWeek?: number } = {}): Promise<Experiment> => {
  track("experiment_started", { from: from ? "action_point" : "pick", goal: !!opts.same });
  if (opts.same && from) {
    const g: Experiment = { id: `${Date.now()}-goal`, island, trackerId: from, change, start: isoLocal(new Date()), from, same: true, ...(opts.perWeek ? { perWeek: opts.perWeek } : {}) };
    save([...getExperiments().filter((e) => e.reviewed || !sameChange(e.change, change)), g]);
    window.dispatchEvent(new Event("memap-settings-changed"));
    return g;
  }
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
  // several at once, even on one island (Nov 8 2026); the same change twice restarts it
  save([...getExperiments().filter((e) => e.reviewed || !sameChange(e.change, change)), x]);
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
  /** hard days on the island in the two weeks before and during the test: the comparison when every
   *  day was "yes" (or "no") and there is nothing to compare inside (Nov 8 2026) */
  before: [number, number];
  during: [number, number];
  /** a goal a week: "yes" days in week 1 and week 2 */
  weeks?: [number, number];
  /** the question, on any island, whose hard days differ most: with/without, else during/before */
  most?: { trackerId: string; hardYes: boolean; by: "with" | "before"; a: [number, number]; b: [number, number] };
}

/** What the counts say, in one line (QA, Nov 8 2026: "8 of 10 · 3 of 4" said nothing): fewer hard
 *  days with it, more, or about the same; when one side is too small (every day "yes"), the two weeks
 *  during against the two before; too few days either way. Never a promise. */
export type Verdict = "few" | "better" | "worse" | "same" | "betterBefore" | "worseBefore" | "sameBefore";
export const verdictOf = (r: ExperimentResult): Verdict => {
  const cmp = ([a, b]: [number, number], [c, d]: [number, number]) => { const diff = a / b - c / d; return diff <= -0.15 ? "better" : diff >= 0.15 ? "worse" : "same"; };
  if (r.withChange[1] >= 3 && r.without[1] >= 3) return cmp(r.withChange, r.without);
  if (r.during[1] >= 3 && r.before[1] >= 3) return `${cmp(r.during, r.before)}Before` as Verdict;
  return "few";
};
/** Compare the two sides inside the test (days with it and without), or else during and before. */
export const comparedBy = (r: ExperimentResult): "with" | "before" | null =>
  r.withChange[1] >= 3 && r.without[1] >= 3 ? "with" : r.during[1] >= 3 && r.before[1] >= 3 ? "before" : null;

/** How the island's hard days went on days with the change and without (and before it began). */
export const experimentResult = (x: Experiment, trackers: Tracker[], entries: TrackerEntry[]): ExperimentResult => {
  const span = (from: number) => Array.from({ length: EXPERIMENT_DAYS }, (_, i) => {
    const d = new Date(x.start + "T12:00:00");
    d.setDate(d.getDate() + from + i);
    return isoLocal(d);
  });
  const dayList = span(0);
  const days = new Set(dayList);
  const beforeDays = new Set(span(-EXPERIMENT_DAYS));
  // The island's questions (not test questions), hard days by the one rule
  // (isHardAnswer: YES to a hard question, NO to a good one).
  const own = new Map(trackers.filter((t) => !t.archived && !isTestQuestion(t) && t.id !== x.trackerId && islandOf(t) === x.island).map((t) => [t.id, t]));
  const did = new Map<string, boolean>();
  for (const e of entries) if (e.trackerId === x.trackerId && days.has(e.date)) did.set(e.date, e.value === true);
  const hard = new Set(entries.filter((e) => days.has(e.date) && own.has(e.trackerId) && isHardAnswer(own.get(e.trackerId)!, e.value)).map((e) => e.date));
  const answeredHard = new Set(entries.filter((e) => days.has(e.date) && own.has(e.trackerId)).map((e) => e.date));
  const withDays = [...did.entries()].filter(([d, v]) => v && answeredHard.has(d)).map(([d]) => d);
  const withoutDays = [...did.entries()].filter(([d, v]) => !v && answeredHard.has(d)).map(([d]) => d);
  // the two weeks before, the same island's questions
  const beforeAnswered = new Set(entries.filter((e) => beforeDays.has(e.date) && own.has(e.trackerId)).map((e) => e.date));
  const beforeHard = new Set(entries.filter((e) => beforeDays.has(e.date) && own.has(e.trackerId) && isHardAnswer(own.get(e.trackerId)!, e.value)).map((e) => e.date));
  const r: ExperimentResult = {
    answered: did.size,
    did: [...did.values()].filter(Boolean).length,
    withChange: [withDays.filter((d) => hard.has(d)).length, withDays.length],
    without: [withoutDays.filter((d) => hard.has(d)).length, withoutDays.length],
    before: [beforeHard.size, beforeAnswered.size],
    during: [hard.size, answeredHard.size],
  };
  if (x.perWeek) {
    const yes = (list: string[]) => list.filter((d) => did.get(d) === true).length;
    r.weeks = [yes(dayList.slice(0, 7)), yes(dayList.slice(7))];
  }
  // every question she asks (not the test's, not wishes): where do hard days differ most?
  const by = comparedBy(r);
  if (by) {
    const [setA, setB] = by === "with" ? [new Set(withDays.length ? [...did.entries()].filter(([, v]) => v).map(([d]) => d) : []), new Set([...did.entries()].filter(([, v]) => !v).map(([d]) => d))] : [days, beforeDays];
    const all = trackers.filter((t) => !t.archived && t.source !== "play" && !isTestQuestion(t) && !isNeutralQuestion(t) && t.id !== x.trackerId);
    let best: ExperimentResult["most"] | undefined, bestDiff = 0.2;
    for (const t of all) {
      const es = entries.filter((e) => e.trackerId === t.id);
      const side = (set: Set<string>): [number, number] => { const on = es.filter((e) => set.has(e.date)); return [on.filter((e) => isHardAnswer(t, e.value)).length, on.length]; };
      const a = side(setA), b = side(setB);
      if (a[1] < 3 || b[1] < 3) continue;
      const diff = Math.abs(a[0] / a[1] - b[0] / b[1]);
      if (diff >= bestDiff) { bestDiff = diff; best = { trackerId: t.id, hardYes: t.problemWhen === "yes", by, a, b }; }
    }
    if (best) r.most = best;
  }
  return r;
};

/** "This week: 2 of 3": the days with "yes" since Monday. */
export const weekDone = (x: Experiment, entries: TrackerEntry[], today = new Date()): number => {
  const mon = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const from = isoLocal(mon), to = isoLocal(today);
  return entries.filter((e) => e.trackerId === x.trackerId && e.value === true && e.date >= from && e.date <= to).length;
};

/** Its own test question goes to the archive (answers stay); a weekly goal's question is hers and stays. */
const archiveTestQuestion = async (x?: Experiment) => {
  if (!x || x.same) return;
  const ts = await getTrackers();
  await saveTrackers(ts.map((t) => (t.id === x.trackerId ? { ...t, archived: true } : t)));
  window.dispatchEvent(new Event("memap-settings-changed"));
};

/** She looked at the result and answered "Keep going like this?" (Nov 8 2026): yes keeps the question
 *  and the reminder going; no ends both. */
export const finishExperiment = async (id: string, keep: boolean) => {
  const list = getExperiments().map((x) => {
    if (x.id !== id) return x;
    const { remind, ...rest } = x;
    return { ...rest, reviewed: isoLocal(new Date()), kept: keep, ...(keep && remind ? { remind } : {}) };
  });
  save(list);
  if (!keep) await archiveTestQuestion(list.find((e) => e.id === id));
};

/** The ones she kept going after the two weeks. */
export const keptExperiments = (): Experiment[] => getExperiments().filter((x) => !!x.reviewed && !!x.kept);

/** Stop a kept one later: no more question (unless it's hers) and no more reminder. */
export const stopKept = async (id: string) => {
  const list = getExperiments().map((x) => { if (x.id !== id) return x; const { remind: _r, ...rest } = x; return { ...rest, kept: false }; });
  save(list);
  await archiveTestQuestion(list.find((e) => e.id === id));
};
