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
  kind: "auto" | "questions" | "task";
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

const ISLAND_ORDER: IslandId[] = ["me", "love", "kids", "health", "body", "pet", "parents", "world", "other"];

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
type TaskRecord = { shown?: string; done?: string; base?: number };
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
const taskForToday = (week: number, today: string): { task: TaskId; done: boolean } | null => {
  const s = readTasks();
  const list = week === 0 ? TASKS_WEEK1 : [...TASKS_WEEK1, ...TASKS_LATER];
  for (const task of list) {
    const done = s[task]?.done;
    if (!done) return { task, done: false };
    if (done === today) return { task, done: true };
  }
  return null;
};

// --- The model ----------------------------------------------------------------

export const pathModel = (trackers: Tracker[], entries: TrackerEntry[], now = new Date()): PathModel => {
  const today = isoLocal(now);
  const days = countedDays(trackers, entries, today);
  const todayCounted = days.includes(today);
  const before = days.filter((d) => d !== today);
  const week = Math.floor(before.length / DAYS_PER_WEEK);
  const k = before.length % DAYS_PER_WEEK;
  const pastInWeek = before.slice(week * DAYS_PER_WEEK, week * DAYS_PER_WEEK + k);

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
    steps.push({ id: `task:${task.task}`, kind: "task", task: task.task, trackerIds: [], answered: 0, done: task.done });
  }

  return {
    week,
    pastInWeek,
    todayCounted,
    weekComplete: todayCounted && k === DAYS_PER_WEEK - 1,
    totalDays: days.length,
    streak: eveningStreak(days, now),
    steps,
    current: steps.findIndex((s) => !s.done),
    leftToday,
  };
};
