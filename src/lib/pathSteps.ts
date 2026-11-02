// Steps, not evenings (Aurora UX, Nov 2 2026, her words: "меня утомляет 20
// вопросов делать… по топикам в течение дня или по приоритету", "каждый шаг
// разный — разные цвета", "за первый же день несколько шагов, какие-то станут
// зелёными автоматически"). Today's path is a row of different steps: one per
// island (topic, at most 7 questions), the main topic first; on day 1 two
// steps are already done; then one small task. Seven counted days make a
// week. Plan: marketing/aurora-light-ux/MASTERPIECE-PLAN.md (top note).
import { Tracker, TrackerEntry } from "@/types/tracker";
import { islandOf, type IslandId } from "@/lib/islands";
import { getDoorState, isoLocal } from "@/lib/doors";
import { eveningDates, eveningStreak } from "@/lib/eveningPath";
import { predictState, type PredictState } from "@/lib/predict";
import { litTrackers } from "@/lib/lighthouses";

export const DAYS_PER_WEEK = 7;
const MAX_PER_STEP = 7;
/** A topic with fewer questions joins the mixed step: no one-question steps. */
const MIN_PER_STEP = 3;

export type TaskId = "note" | "calendar" | "ownQuestion" | "chart" | "map" | "newIsland";
/** Week 1 teaches the app; later weeks open new islands, after her own. */
const TASKS_WEEK1: TaskId[] = ["note", "calendar", "ownQuestion", "chart", "map"];
const TASKS_LATER: TaskId[] = ["newIsland"];

export interface Step {
  id: string;
  /** "fill": a missed day (yesterday or the day before) to answer first */
  /** "game": the day's "Guess" round (src/components/GuessGame.tsx) */
  /** "predict": guess tonight's answers, then see (src/lib/predict.ts) */
  /** "act": a rule she set was reached: time for her plan (lighthouses) */
  kind: "auto" | "fill" | "questions" | "task" | "game" | "predict" | "act";
  predict?: PredictState;
  /** fill: the day */
  date?: string;
  /** task: skipped for today */
  skipped?: boolean;
  auto?: "topic" | "firstAnswer";
  /** the topic; none for a mixed step */
  island?: IslandId;
  /** "all" = every question fits one step; "rest" = the small topics together */
  mixed?: "all" | "rest";
  /** 1-based part and parts, when an island has more than 7 questions */
  part?: [number, number];
  trackerIds: string[];
  task?: TaskId;
  /** questions of this step answered today */
  answered: number;
  done: boolean;
}

export interface PathModel {
  /** counted days before the path started (an old user's history), folded into one chip */
  prior: number;
  /** finished weeks before this one, oldest first: their seven days */
  pastWeeks: string[][];
  /** 0-based week */
  week: number;
  /** counted days of this week before today, oldest first */
  pastInWeek: string[];
  todayCounted: boolean;
  /** today was the week's seventh counted day */
  weekComplete: boolean;
  totalDays: number;
  /** days in a row, ending today or yesterday */
  streak: number;
  steps: Step[];
  /** the step to do next (first not done), or -1 when today is all done */
  current: number;
  /** questions left today, all steps together */
  leftToday: number;
}

const ISLAND_ORDER: IslandId[] = ["me", "love", "kids", "health", "body", "pet", "parents", "work", "world", "mine", "other"];

export const activeQuestions = (trackers: Tracker[]) => trackers.filter((t) => !t.archived && t.source !== "play");

export interface QuestionGroup {
  island?: IslandId;
  mixed?: "all" | "rest";
  part: [number, number];
  ids: string[];
}

/** Questions in steps: one per island (split above 7), the door's island
 *  first with the door question on top, then the biggest islands. Islands
 *  under 3 questions share one mixed step; 7 or fewer questions in all make
 *  a single step. */
export const questionGroups = (trackers: Tracker[]): QuestionGroup[] => {
  const act = activeQuestions(trackers);
  const door = getDoorState();
  const byIsland = new Map<IslandId, Tracker[]>();
  for (const t of act) {
    const k = islandOf(t);
    if (!byIsland.has(k)) byIsland.set(k, []);
    byIsland.get(k)!.push(t);
  }
  const doorTracker = door ? act.find((t) => t.id === door.trackerId) : undefined;
  const first = doorTracker ? islandOf(doorTracker) : null;
  const order = [...byIsland.entries()].sort(([a, la], [b, lb]) =>
    a === first ? -1 : b === first ? 1 : lb.length - la.length || ISLAND_ORDER.indexOf(a) - ISLAND_ORDER.indexOf(b),
  );
  const doorFirst = (list: Tracker[]) =>
    [...list].sort((a, b) => (a.id === door?.trackerId ? -1 : b.id === door?.trackerId ? 1 : 0) || (a.sortIndex ?? 0) - (b.sortIndex ?? 0));

  if (act.length === 0) return [];
  if (act.length <= MAX_PER_STEP) {
    const one = order.length === 1;
    return [{ island: one ? order[0][0] : undefined, mixed: one ? undefined : "all", part: [1, 1], ids: doorFirst(order.flatMap(([, l]) => l)).map((t) => t.id) }];
  }

  const out: QuestionGroup[] = [];
  const small: Tracker[] = [];
  let restAt = -1; // the mixed step sits where its first (most important) topic was
  for (const [island, list] of order) {
    if (list.length < MIN_PER_STEP) {
      if (restAt < 0) restAt = out.length;
      small.push(...list);
      continue;
    }
    const sorted = doorFirst(list);
    const parts = Math.ceil(sorted.length / MAX_PER_STEP);
    const size = Math.ceil(sorted.length / parts);
    for (let p = 0; p < parts; p++) {
      out.push({ island, part: [p + 1, parts], ids: sorted.slice(p * size, (p + 1) * size).map((t) => t.id) });
    }
  }
  if (small.length > 0) {
    const rest = doorFirst(small);
    const parts = Math.ceil(rest.length / MAX_PER_STEP);
    const size = Math.ceil(rest.length / parts);
    const groups: QuestionGroup[] = [];
    for (let p = 0; p < parts; p++) groups.push({ mixed: "rest", part: [p + 1, parts], ids: rest.slice(p * size, (p + 1) * size).map((t) => t.id) });
    out.splice(restAt, 0, ...groups);
  }
  return out;
};

/** Days that count (ascending, up to today): a whole topic step answered
 *  with at least two answers that day (one answer logged in the moment
 *  isn't a day), or half of all questions (the old evening rule, so old
 *  days still count). */
export const countedDays = (trackers: Tracker[], entries: TrackerEntry[], today = isoLocal(new Date())): string[] => {
  const groups = questionGroups(trackers);
  const ids = new Set(activeQuestions(trackers).map((t) => t.id));
  const byDay = new Map<string, Set<string>>();
  for (const e of entries) {
    if (!ids.has(e.trackerId) || e.date > today) continue;
    if (!byDay.has(e.date)) byDay.set(e.date, new Set());
    byDay.get(e.date)!.add(e.trackerId);
  }
  const old = new Set(eveningDates(trackers, entries, today));
  return [...byDay.entries()]
    .filter(([d, got]) => old.has(d) || (got.size >= Math.min(2, ids.size) && groups.some((g) => g.ids.every((id) => got.has(id)))))
    .map(([d]) => d)
    .sort();
};

// --- Tasks ------------------------------------------------------------------
// What each task needs: a flag set when she opens the thing (calendar,
// chart, map), a note written, or one more question / island than when the
// task first showed up. Stored per install; nothing about answers.

const TASKS_KEY = "memap_path_tasks";
type TaskRecord = { shown?: string; done?: string; base?: number; skipped?: string };
type TaskStore = Partial<Record<TaskId, TaskRecord>>;

const readTasks = (): TaskStore => {
  try {
    return JSON.parse(localStorage.getItem(TASKS_KEY) || "{}") as TaskStore;
  } catch {
    return {};
  }
};
const writeTasks = (s: TaskStore) => {
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(s));
  } catch {
    /* not fatal: the task just shows again */
  }
};

/** Not today (her note: "нужно иметь возможность скипнуть"): today shows it
 *  as skipped; it comes back after the other tasks. */
export const skipTask = (task: TaskId) => {
  const s = readTasks();
  s[task] = { ...s[task], skipped: isoLocal(new Date()) };
  writeTasks(s);
};

const ACT_KEY = "memap_act_seen";
/** She looked at her lit rules today. */
export const markActSeen = () => {
  try { localStorage.setItem(ACT_KEY, isoLocal(new Date())); } catch { /* shows again, harmless */ }
};
const actSeenToday = () => {
  try { return localStorage.getItem(ACT_KEY) === isoLocal(new Date()); } catch { return false; }
};

const GAME_KEY = "memap_game_played";
/** The day's "Guess" round was played. */
export const gamePlayedToday = () => {
  try { return localStorage.getItem(GAME_KEY) === isoLocal(new Date()); } catch { return false; }
};
export const markGamePlayed = () => {
  try { localStorage.setItem(GAME_KEY, isoLocal(new Date())); } catch { /* plays again, harmless */ }
};

/** Mark a task done today (she opened the calendar, the chart, the map). */
export const markTaskDone = (task: TaskId) => {
  const s = readTasks();
  if (s[task]?.done) return;
  s[task] = { ...s[task], done: isoLocal(new Date()) };
  writeTasks(s);
};

const islandCount = (trackers: Tracker[]) => new Set(activeQuestions(trackers).map(islandOf)).size;

/** Settle task records against what's true now: count notes and new
 *  questions/islands as done, remember the baseline when a task first shows. */
export const syncTasks = (trackers: Tracker[], noteDays: string[], week: number): void => {
  const s = readTasks();
  const today = isoLocal(new Date());
  let changed = false;
  const list = week === 0 ? TASKS_WEEK1 : [...TASKS_WEEK1, ...TASKS_LATER];
  for (const task of list) {
    const r: TaskRecord = s[task] ?? {};
    if (r.done) continue;
    if (task === "note" && noteDays.length > 0) {
      r.done = noteDays[noteDays.length - 1];
    } else if (task === "ownQuestion" || task === "newIsland") {
      const now = task === "ownQuestion" ? activeQuestions(trackers).length : islandCount(trackers);
      if (r.base === undefined) r.base = now;
      else if (now > r.base) r.done = today;
    }
    if (!r.shown) r.shown = today;
    s[task] = r;
    changed = true;
  }
  if (changed) writeTasks(s);
};

/** Today's task: the first one not done before today (one done today stays
 *  visible as a done step). Week 1 teaches the app; later weeks add islands. */
const taskForToday = (week: number, today: string): { task: TaskId; done: boolean; skipped?: boolean } | null => {
  const s = readTasks();
  const list = week === 0 ? TASKS_WEEK1 : [...TASKS_WEEK1, ...TASKS_LATER];
  // Tasks skipped on an earlier day wait at the end.
  const later = (t: TaskId) => !!s[t]?.skipped && s[t]!.skipped !== today;
  const order = [...list.filter((t) => !later(t)), ...list.filter(later)];
  for (const task of order) {
    const r = s[task];
    if (r?.done) {
      if (r.done === today) return { task, done: true };
      continue;
    }
    if (r?.skipped === today) return { task, done: true, skipped: true };
    return { task, done: false };
  }
  return null;
};

// --- Where the path starts, and the week chests ----------------------------------

const START_KEY = "memap_path_start";

/** The day the path began: onboarding day for a new user, the first day on
 *  the new screens for an old one (their earlier days fold into a chip, so
 *  nobody starts at "Week 9" with eight empty weeks; plan §3.2.2). */
export const pathStart = (today: string): string => {
  try {
    const saved = localStorage.getItem(START_KEY);
    if (saved) return saved;
    const door = getDoorState();
    const start = door?.startedAt && door.startedAt <= today ? door.startedAt : today;
    localStorage.setItem(START_KEY, start);
    return start;
  } catch {
    return today;
  }
};

const CHESTS_KEY = "memap_week_chests";
/** What a week's chest showed when it was opened: saved once, reopened as is. */
export interface ChestLine { label: string; k: number; n: number; main?: boolean; calm?: boolean }
export interface ChestRecord {
  openedAt: string; lines: ChestLine[]; fact?: string; reward: string; placed?: boolean;
  /** the week's insight, said in words when opened */
  insight?: string; insightOther?: string; insightEarly?: boolean;
  /** "Predict" this week: guessed k of n */
  guesses?: { hit: number; n: number };
  /** a new title for her (CHEST_TITLES) */
  title?: string;
}

/** Things a chest gives, one per week in turn. They go on the Map, never on the path. */
export const CHEST_REWARDS = ["wooden_bridge", "hot_air_balloon", "marker_flag", "rainbow"];
export const rewardFor = (week: number) => CHEST_REWARDS[week % CHEST_REWARDS.length];
/** A new title each week, the last one kept. */
export const CHEST_TITLES = ["explorer", "pathfinder", "navigator", "cartographer", "captain", "keeper", "legend"];
export const titleFor = (week: number) => CHEST_TITLES[Math.min(week, CHEST_TITLES.length - 1)];

export const getChests = (): Record<number, ChestRecord> => {
  try {
    return JSON.parse(localStorage.getItem(CHESTS_KEY) || "{}");
  } catch {
    return {};
  }
};
export const saveChest = (week: number, rec: ChestRecord) => {
  const all = getChests();
  all[week] = rec;
  try {
    localStorage.setItem(CHESTS_KEY, JSON.stringify(all));
  } catch {
    /* the chest just opens fresh next time */
  }
};

// --- The model ----------------------------------------------------------------

export const pathModel = (trackers: Tracker[], entries: TrackerEntry[], now = new Date()): PathModel => {
  const today = isoLocal(now);
  const all = countedDays(trackers, entries, today);
  const start = pathStart(today);
  const days = all.filter((d) => d >= start);
  const prior = all.length - days.length;
  const todayCounted = days.includes(today);
  const before = days.filter((d) => d !== today);
  const week = Math.floor(before.length / DAYS_PER_WEEK);
  const k = before.length % DAYS_PER_WEEK;
  const pastInWeek = before.slice(week * DAYS_PER_WEEK, week * DAYS_PER_WEEK + k);
  const pastWeeks = Array.from({ length: week }, (_, w) => before.slice(w * DAYS_PER_WEEK, (w + 1) * DAYS_PER_WEEK));

  const answeredToday = new Set(entries.filter((e) => e.date === today).map((e) => e.trackerId));
  const steps: Step[] = [];

  // Day 1 after onboarding: steps already green. They are never "to do":
  // "First answer" shows only once onboarding saved one.
  const door = getDoorState();
  if (door && door.startedAt === today) {
    steps.push({ id: "auto:topic", kind: "auto", auto: "topic", trackerIds: [door.trackerId], answered: 0, done: true });
    if (entries.some((e) => e.date <= today)) {
      steps.push({ id: "auto:first", kind: "auto", auto: "firstAnswer", trackerIds: [], answered: 0, done: true });
    }
  }

  // A missed day first (her note: someone opening the app in the morning
  // should be able to fill in yesterday): yesterday, else the day before,
  // never before the path or onboarding began, only if answering already.
  const started = door?.startedAt ?? start;
  const firstEntry = entries.reduce<string | null>((min, e) => (min === null || e.date < min ? e.date : min), null);
  const counted = new Set(all);
  for (const back of [1, 2]) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    const iso = isoLocal(d);
    if (iso < started || !firstEntry || firstEntry >= iso || counted.has(iso)) continue;
    const ids = activeQuestions(trackers).map((t) => t.id);
    const got = new Set(entries.filter((e) => e.date === iso).map((e) => e.trackerId));
    steps.push({ id: `fill:${iso}`, kind: "fill", date: iso, trackerIds: ids, answered: ids.filter((id) => got.has(id)).length, done: false });
    break;
  }

  // "Predict" (works from day 1): in the morning, before anything is
  // answered, it comes first; otherwise after the day's task.
  const predict = activeQuestions(trackers).length > 0 ? predictState(trackers, entries, now) : null;
  const predictStep = (p: PredictState): Step => ({ id: "predict", kind: "predict", predict: p, trackerIds: [], answered: 0, done: p.stage === "done" });
  let predictFirst = false;
  if (predict?.stage === "guess" && predict.date === today && answeredToday.size === 0) {
    steps.push(predictStep(predict));
    predictFirst = true;
  }

  let leftToday = 0;
  for (const g of questionGroups(trackers)) {
    const answered = g.ids.filter((id) => answeredToday.has(id)).length;
    leftToday += g.ids.length - answered;
    steps.push({
      id: `q:${g.island ?? g.mixed}:${g.part[0]}`,
      kind: "questions",
      island: g.island,
      mixed: g.mixed,
      part: g.part[1] > 1 ? g.part : undefined,
      trackerIds: g.ids,
      answered,
      done: answered === g.ids.length,
    });
  }

  const task = taskForToday(week, today);
  if (task && steps.some((s) => s.kind === "questions")) {
    steps.push({ id: `task:${task.task}`, kind: "task", task: task.task, trackerIds: [], answered: 0, done: task.done, skipped: task.skipped });
  }
  // A rule she set was reached (a lit lighthouse): her plan, once a day.
  const lit = litTrackers(trackers, entries);
  if (lit.size > 0) {
    steps.push({ id: "act", kind: "act", trackerIds: [...lit], answered: 0, done: actSeenToday() });
  }
  if (predict && !predictFirst) steps.push(predictStep(predict));
  // One short game a day, after the questions (her ask: something to come
  // back for during the day). Shown only when there is a round to play.
  if (steps.some((s) => s.kind === "questions")) {
    steps.push({ id: "game", kind: "game", trackerIds: [], answered: 0, done: gamePlayedToday() });
  }

  return {
    prior,
    pastWeeks,
    week,
    pastInWeek,
    todayCounted,
    weekComplete: todayCounted && k === DAYS_PER_WEEK - 1,
    totalDays: all.length,
    streak: eveningStreak(all, now),
    steps,
    current: steps.findIndex((s) => !s.done),
    leftToday,
  };
};
