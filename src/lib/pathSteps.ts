// Steps, not evenings (Aurora UX, Nov 2 2026, her words: "меня утомляет 20
// вопросов делать… по топикам в течение дня или по приоритету", "каждый шаг
// разный — разные цвета", "за первый же день несколько шагов, какие-то станут
// зелёными автоматически"). Today's path is a row of different steps: one per
// island (topic, at most 7 questions), the main topic first; on day 1 two
// steps are already done; then one small task. Seven counted days make a
// week. Plan: marketing/aurora-light-ux/MASTERPIECE-PLAN.md (top note).
import { FOLLOW_UPS } from "./bodyTemplates";
import { templateIdOf } from "./answerPhrases";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { buildIslands, buildRoutes, islandOf, type IslandId } from "@/lib/islands";
import { firstLinkState } from "@/lib/firstLink";
import { grewToday } from "@/lib/globeArt";
import { getDoorState, isoLocal } from "@/lib/doors";
import { eveningDates, eveningStreak } from "@/lib/eveningPath";
import { litTrackers } from "@/lib/lighthouses";
import { experimentOver, getExperiments, runningExperiments } from "@/lib/experiments";
import { hunchDoneToday, readyHunch } from "@/lib/hunches";
import { track, onbVariant } from "@/lib/analytics";
import { tipForToday } from "@/lib/observeTips";

export const DAYS_PER_WEEK = 7;
const MAX_PER_STEP = 7;
/** Up to this many questions stay one step on the path (Nov 8 2026). */
const ONE_STEP_UP_TO = 10;
/** Steps besides the questions, a day, most important first (Nov 8 2026). */
const MAX_EXTRAS = 3;
const EXTRA_ORDER: Step["kind"][] = ["report", "test", "act", "link", "task", "game", "tip"];
/** From this hour today's questions are for now; before it they wait for the evening. */
export const EVENING_AT = 17;
/** A topic with fewer questions joins the mixed step: no one-question steps. */
const MIN_PER_STEP = 3;

export type TaskId = "note" | "calendar" | "ownQuestion" | "chart" | "map" | "newIsland" | "experiment";
/** Week 1 teaches the app; later weeks open new islands, after her own. The
 *  calendar and the chart are shown by the "discover" steps now (Nov 5 2026). */
const TASKS_WEEK1: TaskId[] = ["note", "ownQuestion", "map"];

/** "Look around" after the first questions: a tour of the real pages
 *  (src/components/AppTour.tsx). It replaced three pop-up cards (links, days,
 *  weeks), her note Nov 5 2026: "надо показать, где конкретно это лежит". */
export type DiscoverId = "tour";
const DISCOVER: DiscoverId[] = ["tour"];
const DISCOVER_KEY = "memap_discover_seen";
const readDiscover = (): Partial<Record<DiscoverId, string>> => {
  try { return JSON.parse(localStorage.getItem(DISCOVER_KEY) || "{}"); } catch { return {}; }
};
/** She went through one (its "Next"): done today, gone from tomorrow. */
export const markDiscovered = (d: DiscoverId) => {
  const s = readDiscover();
  if (s[d]) return;
  try { localStorage.setItem(DISCOVER_KEY, JSON.stringify({ ...s, [d]: isoLocal(new Date()) })); } catch { /* shows again, harmless */ }
};
// Week 2 on: test one change (her "провёл эксперимент — сад"), then a new island.
const TASKS_LATER: TaskId[] = ["experiment", "newIsland"];

export interface Step {
  id: string;
  /** "fill": a missed day (yesterday or the day before) to answer first */
  /** a fill drawn on the path itself (day 1 before the evening: yesterday's questions) */
  onPath?: boolean;
  /** "game": the day's hunch (src/components/HunchGame.tsx; was "Guess") */
  /** "act": a rule she set was reached: time for her plan (lighthouses) */
  /** "test": her week of trying one change is over: see how it went */
  /** "unload": the calm bubble game, any time (src/components/UnloadGame.tsx) */
  /** "discover": what the app will show her, with an example (src/components/DiscoverSheet.tsx) */
  /** "link": her first link was found today: see it happen on her map (src/components/LinkMoment.tsx) */
  kind: "auto" | "fill" | "questions" | "task" | "game" | "act" | "test" | "unload" | "grew" | "discover" | "link" | "report" | "tip";
  /** today's questions before the evening: they wait at the end of the path (Nov 8 2026) */
  tonight?: boolean;
  /** "Worth watching": today's tip */
  tipId?: string;
  discover?: DiscoverId;
  /** grew: the stage the island reached today */
  stage?: number;
  /** grew: every island that grew today (one light for all of them) */
  grew?: { island: IslandId; stage: number }[];
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
  /** questions of a newly added island */
  fresh?: boolean;
  /** "New questions": the ones added today after the day's own set, one step at the boat */
  added?: boolean;
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
  /** a newly added island: its own step even when small (her: "когда отвечать — не пойму") */
  fresh?: boolean;
  mixed?: "all" | "rest";
  part: [number, number];
  ids: string[];
}

/** Questions in steps: one per island (split above 7), the door's island
 *  first with the door question on top, then the biggest islands. Islands
 *  under 3 questions share one mixed step; 7 or fewer questions in all make
 *  a single step. */
export const questionGroups = (trackers: Tracker[], opts: { together?: boolean; upTo?: number } = {}): QuestionGroup[] => {
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

  // The first week: all her questions in one step (her note, Nov 5 2026: "слишком
  // много нажимать… по одному вопросу на тему"; topics come once she's settled in).
  // Up to 14 in one go, more in two halves.
  if (opts.together) {
    const all = doorFirst(act).map((t) => t.id);
    const parts = all.length > 14 ? 2 : 1, size = Math.ceil(all.length / parts);
    return Array.from({ length: parts }, (_, p) => ({ mixed: "all" as const, part: [p + 1, parts] as [number, number], ids: all.slice(p * size, (p + 1) * size) }));
  }

  // An island added after the first days (all its questions newer than the
  // first ones, within two weeks) keeps its own step, so its questions are
  // easy to find on the path (her note: "когда на них отвечать — не пойму").
  const day = (t: Tracker) => (t.createdAt ?? "").slice(0, 10);
  const firstDay = act.map(day).filter(Boolean).sort()[0] ?? "";
  const twoWeeks = isoLocal(new Date(Date.now() - 14 * 86_400_000));
  const isFresh = (list: Tracker[]) => list.every((t) => day(t) > firstDay && day(t) >= twoWeeks);

  // the path keeps up to 10 questions in one step (Nov 8 2026); counting days keeps the old groups
  if (act.length <= (opts.upTo ?? MAX_PER_STEP)) {
    const fresh = order.filter(([, l]) => isFresh(l));
    const rest = order.filter(([, l]) => !isFresh(l));
    const groups: QuestionGroup[] = [];
    if (rest.length > 0) {
      const one = rest.length === 1;
      groups.push({ island: one ? rest[0][0] : undefined, mixed: one ? undefined : "all", part: [1, 1], ids: doorFirst(rest.flatMap(([, l]) => l)).map((t) => t.id) });
    }
    for (const [island, l] of fresh) groups.push({ island, part: [1, 1], ids: doorFirst(l).map((t) => t.id), fresh: true });
    return groups;
  }

  const out: QuestionGroup[] = [];
  const small: Tracker[] = [];
  let restAt = -1; // the mixed step sits where its first (most important) topic was
  for (const [island, list] of order) {
    if (list.length < MIN_PER_STEP && !isFresh(list)) {
      if (restAt < 0) restAt = out.length;
      small.push(...list);
      continue;
    }
    const sorted = doorFirst(list);
    const parts = Math.ceil(sorted.length / MAX_PER_STEP);
    const size = Math.ceil(sorted.length / parts);
    for (let p = 0; p < parts; p++) {
      out.push({ island, part: [p + 1, parts], ids: sorted.slice(p * size, (p + 1) * size).map((t) => t.id), fresh: isFresh(list) || undefined });
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

const UNLOAD_KEY = "memap_unload_played";
/** "Unload your mind" was played today (it stays open to play again). */
export const unloadPlayedToday = () => {
  try { return localStorage.getItem(UNLOAD_KEY) === isoLocal(new Date()); } catch { return false; }
};
export const markUnloadPlayed = () => {
  const today = isoLocal(new Date());
  try {
    localStorage.setItem(UNLOAD_KEY, today);
    // the days she played, for the lavender treasure (7 days)
    const days = JSON.parse(localStorage.getItem(UNLOAD_DAYS) || "[]") as string[];
    if (!days.includes(today)) { localStorage.setItem(UNLOAD_DAYS, JSON.stringify([...days, today].slice(-60))); track("unload_played", { days: days.length + 1 }); }
  } catch { /* plays again, harmless */ }
};
const UNLOAD_DAYS = "memap_unload_days";
/** Days she popped bubbles ("Unload your mind"). */
export const unloadDays = (): number => {
  try { return (JSON.parse(localStorage.getItem(UNLOAD_DAYS) || "[]") as string[]).length; } catch { return 0; }
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
    } else if (task === "experiment" && getExperiments().length > 0) {
      r.done = getExperiments()[0].start;
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
    // A note skipped once doesn't come back (her note, Nov 5 2026: "я сама
    // знаю, что если что, я напишу note"): notes stay one tap away on Today.
    // Adding questions or islands the same: skipped once, it doesn't come back every evening (persona walks,
    // Nov 9 2026: "Open a new island" was the Start step every evening from day 13; it stays in You)
    if ((task === "note" || task === "newIsland" || task === "ownQuestion") && r?.skipped) continue;
    return { task, done: false };
  }
  return null;
};

// --- "New questions" ------------------------------------------------------------

const ONBOARDED_KEY = "memap_onboarded_at";
/** Which of today's added questions joined today's step, and which got their own (decided once). */
const MERGE_KEY = "memap_added_merge";
const readMerge = (today: string): { in: string[]; out: string[] } => {
  try { const s = JSON.parse(localStorage.getItem(MERGE_KEY) ?? "null"); if (s?.day === today) return { in: s.in ?? [], out: s.out ?? [] }; } catch { /* a new day */ }
  return { in: [], out: [] };
};
const saveMerge = (today: string, m: { in: string[]; out: string[] }) => {
  try { localStorage.setItem(MERGE_KEY, JSON.stringify({ day: today, ...m })); } catch { /* decided again next time */ }
};
/** Onboarding just finished: the questions it made are the day's own set. */
export const markOnboarded = () => {
  try { localStorage.setItem(ONBOARDED_KEY, new Date().toISOString()); } catch { /* they show as new today, harmless */ }
};
/** Questions made after this moment today are "New questions". */
const addedBaseline = (trackers: Tracker[], now: Date): number => {
  const today = isoLocal(now);
  try {
    const onb = localStorage.getItem(ONBOARDED_KEY);
    if (onb && isoLocal(new Date(onb)) === today) return Date.parse(onb);
  } catch { /* fall through */ }
  const qs = activeQuestions(trackers);
  // questions from before today: everything made today is new
  if (qs.length === 0 || qs.some((t) => !t.createdAt || isoLocal(new Date(t.createdAt)) < today)) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }
  // all made today, no onboarding record (a seeded install): the first batch is the day's own
  return Math.min(...qs.map((t) => Date.parse(t.createdAt))) + 60_000;
};
const ADDED_KEY = "memap_path_added";
/** Where today's "New questions" step sits once answered: before this step. */
const readAddedAnchor = (today: string): string | null => {
  try {
    const v = JSON.parse(localStorage.getItem(ADDED_KEY) || "null") as { date: string; before: string } | null;
    return v && v.date === today ? v.before : null;
  } catch { return null; }
};
const saveAddedAnchor = (today: string, before: string) => {
  try { localStorage.setItem(ADDED_KEY, JSON.stringify({ date: today, before })); } catch { /* it sits at the boat */ }
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

/** A past day she fills in counts on a young path (her note, Nov 6 2026: "дать
 *  возможность заполнять за прошлые дни"): a path that began in the last 7 days
 *  moves its start back to that day, so the day is an evening of week 1. An older
 *  path stays as it is (its weeks don't shift). */
export const extendPathStart = (date: string, now = new Date()) => {
  try {
    const today = isoLocal(now);
    const start = pathStart(today);
    const weekAgo = isoLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7));
    if (date < start && date >= weekAgo && start >= weekAgo) localStorage.setItem(START_KEY, date);
  } catch { /* the day is saved; it just won't count on the path */ }
};

/** The last 7 days before today, oldest first: answered (counted), started (some answers) or empty. */
export const pastDays = (trackers: Tracker[], entries: TrackerEntry[], now = new Date()): { date: string; state: "done" | "some" | "empty" }[] => {
  const today = isoLocal(now);
  const counted = new Set(countedDays(trackers, entries, today));
  const ids = new Set(activeQuestions(trackers).map((t) => t.id));
  const some = new Set(entries.filter((e) => ids.has(e.trackerId)).map((e) => e.date));
  return Array.from({ length: 7 }, (_, i) => {
    const date = isoLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (7 - i)));
    return { date, state: counted.has(date) ? "done" : some.has(date) ? "some" : "empty" };
  });
};

const CHESTS_KEY = "memap_week_chests";
/** What a week's chest showed when it was opened: saved once, reopened as is. */
export interface ChestLine { label: string; k: number; n: number; main?: boolean; calm?: boolean; days?: (boolean | null)[]; hardWhen?: "yes" | "no" | null }
export interface ChestRecord {
  openedAt: string; lines: ChestLine[]; fact?: string; reward: string; placed?: boolean;
  /** the week's insight, said in words when opened */
  insight?: string; insightOther?: string; insightEarly?: boolean;
  /** "Predict" this week: guessed k of n */
  guesses?: { hit: number; n: number };
  /** a new title for her (CHEST_TITLES) */
  title?: string;
  /** her world when opened (growth "island:stageN" since Nov 5 2026, before "island:kind"; items; links "a|b"), to tell what's new next time */
  world?: { growth: string[]; items: string[]; bridges: string[] };
  /** next week's mission (src/lib/growth.ts) */
  mission?: { id: string; n?: number };
  /** what grew since the last chest, and the items she's closest to ("id:k/n") */
  fresh?: { growth: string[]; items: string[]; bridges: string[]; itemIslands?: Record<string, string> };
  nextUp?: string[];
}

/** The picture a chest shows for the week, one per week in turn (a keepsake
 *  of the week, not placed on the map; the milestone treasures are kept on
 *  her shelf in You, src/lib/growth.ts). */
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

/** A follow-up question whose question wasn't answered "yes" that day: not asked, not counted. */
export const followUpNotNeeded = (tr: Tracker, trackers: Tracker[], valueOf: (trackerId: string) => unknown): boolean => {
  const id = templateIdOf(tr), pid = id ? FOLLOW_UPS[id] : undefined;
  if (!pid) return false;
  const parent = trackers.find((x) => !x.archived && templateIdOf(x) === pid);
  if (!parent) return false;
  const v = valueOf(parent.id);
  return v !== undefined && v !== true;
};

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
  // a follow-up ("heavy period?", "did it hurt?") isn't needed when its question wasn't "yes" today
  const todayVal = new Map(entries.filter((e) => e.date === today).map((e) => [e.trackerId, e.value]));
  const notNeeded = (id: string) => { const tr = trackers.find((x) => x.id === id); return !!tr && followUpNotNeeded(tr, trackers, (pid) => todayVal.get(pid)); };
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
  // Day 1 before the evening (her note, Nov 6 2026: "если онбординг проходит днём
  // или утром, предлагать вопросы за вчера"): today isn't over yet, so yesterday's
  // questions come first, on the path itself; tonight is today's.
  let pickedTonight = false;
  try { pickedTonight = localStorage.getItem("memap_first_day_pick") === "tonight"; } catch { /* ignore */ }
  const dayOneMorning = started === today && now.getHours() < 17 && !pickedTonight;
  for (const back of [1, 2]) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    const iso = isoLocal(d);
    const onPath = back === 1 && dayOneMorning;
    if (counted.has(iso) || (!onPath && (iso < started || !firstEntry || firstEntry >= iso))) continue;
    const ids = activeQuestions(trackers).map((t) => t.id);
    const got = new Set(entries.filter((e) => e.date === iso).map((e) => e.trackerId));
    steps.push({ id: `fill:${iso}`, kind: "fill", date: iso, trackerIds: ids, answered: ids.filter((id) => got.has(id)).length, done: false, onPath });
    break;
  }

  // Questions added today, after the day's own set (her notes, Nov 4 and 5
  // 2026: adding questions sent the boat back to an island already done, "меня
  // перекинуло на лав"): one step of their own, "New questions", where the boat
  // is, never back on an earlier step. Tomorrow they join their islands.
  const byId = new Map(trackers.map((t) => [t.id, t]));
  const baseline = addedBaseline(trackers, now);
  const addedIds = activeQuestions(trackers)
    .filter((t) => !!t.createdAt && isoLocal(new Date(t.createdAt)) === today && Date.parse(t.createdAt) > baseline)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((t) => t.id);
  // Added before today's answering began (a tip, a hunch, the morning after onboarding): they just
  // join today's questions, one step (Nov 8 2026: two question steps for one evening looked like a
  // to-do list). Added once answering began: a step of their own, as before. Decided once a day.
  const mainStarted = activeQuestions(trackers).some((t) => !addedIds.includes(t.id) && answeredToday.has(t.id));
  const mergeState = readMerge(today);
  for (const id of addedIds) if (!mergeState.in.includes(id) && !mergeState.out.includes(id)) (mainStarted ? mergeState.out : mergeState.in).push(id);
  saveMerge(today, mergeState);
  const ownStep = addedIds.filter((id) => !mergeState.in.includes(id));
  const addedSet = new Set(ownStep);
  let leftToday = ownStep.filter((id) => !answeredToday.has(id)).length;
  for (const g of questionGroups(trackers.filter((t) => !addedSet.has(t.id)), { together: week === 0, upTo: ONE_STEP_UP_TO })) {
    leftToday += g.ids.filter((id) => !answeredToday.has(id) && !notNeeded(id)).length;
    const ids = g.ids;
    const answered = ids.filter((id) => answeredToday.has(id) || notNeeded(id)).length;
    steps.push({
      id: `q:${g.island ?? g.mixed}:${g.part[0]}`,
      kind: "questions",
      island: g.island,
      mixed: g.mixed,
      part: g.part[1] > 1 ? g.part : undefined,
      fresh: g.fresh,
      trackerIds: ids,
      answered,
      done: answered === ids.length,
    });
  }

  const hasQuestions = addedIds.length > 0 || steps.some((s) => s.kind === "questions");
  // What MeMap gives her (her note, Nov 5 2026: after the first questions "дальше
  // должно быть так, что ты переходишь по шагам, и он объясняет, что приложение
  // готово тебе предложить"): right after the questions, until seen; seen today
  // stays as done. On a day with them, no task (day 1 isn't longer).
  const seen = readDiscover();
  // variant C (Nov 8 2026) has no tour: the pages explain themselves on the first tap (Tips.tsx)
  const discover = hasQuestions && onbVariant() !== "C" ? DISCOVER.filter((d) => !seen[d] || seen[d] === today) : [];
  for (const d of discover) steps.push({ id: `discover:${d}`, kind: "discover", discover: d, trackerIds: [], answered: 0, done: seen[d] === today });
  const discovering = discover.length > 0;
  const task = discovering ? null : taskForToday(week, today);
  if (task && hasQuestions) {
    steps.push({ id: `task:${task.task}`, kind: "task", task: task.task, trackerIds: [], answered: 0, done: task.done, skipped: task.skipped });
  }
  // Last week's report waits (QA, Nov 8 2026: on day 8 the Start bubble skipped it): the first step
  // of the new week until it's opened.
  if (week > 0 && !getChests()[week - 1]) steps.unshift({ id: "report", kind: "report", trackerIds: [], answered: 0, done: false });
  // A rule she set was reached (a lit lighthouse): her plan, once a day.
  const lit = litTrackers(trackers, entries);
  if (lit.size > 0) {
    steps.push({ id: "act", kind: "act", trackerIds: [...lit], answered: 0, done: actSeenToday() });
  }
  // Her test week is over: see how it went (it grows a garden).
  const test = runningExperiments().find((x) => experimentOver(x));
  if (test) steps.push({ id: "test", kind: "test", trackerIds: [test.trackerId], answered: 0, done: false });
  // One short game a day, after the questions (her ask: something to come
  // back for during the day). Shown only when there is a round to play.
  if (hasQuestions) {
    // The day's hunch: done once made (or "not now"), unless a checked one waits.
    steps.push({ id: "game", kind: "game", trackerIds: [], answered: 0, done: hunchDoneToday() && !readyHunch(trackers, entries) });
    // One thing worth watching (Nov 8 2026), from day 2; the last of the day's extras.
    if (!(door && door.startedAt === today)) {
      const tip = tipForToday(trackers, today);
      if (tip) steps.push({ id: `tip:${tip.tip.id}`, kind: "tip", tipId: tip.tip.id, trackerIds: [], answered: 0, done: tip.done });
    }
    // Her "разгрузи свой мозг" is the reward after the day now (Nov 8 2026: "не понимаю, где шарики
    // пулять, они должны быть как когда всё закончено — поиграй"): on "Done for today", not a step.
  }
  // "New questions" go where the boat is: before the first step still to do
  // (the calm game doesn't count), else at the end; once answered the step
  // stays where it was, so the path doesn't reshuffle.
  if (ownStep.length > 0) {
    const answered = ownStep.filter((id) => answeredToday.has(id)).length;
    const islands = new Set(ownStep.map((id) => islandOf(byId.get(id)!)));
    const step: Step = {
      id: "q:added", kind: "questions", added: true,
      island: islands.size === 1 ? [...islands][0] : undefined,
      trackerIds: ownStep, answered, done: answered === ownStep.length,
    };
    const boat = steps.findIndex((s) => !s.done && s.kind !== "unload");
    const anchor = step.done ? readAddedAnchor(today) : null;
    const kept = anchor === "end" ? steps.length : anchor ? steps.findIndex((s) => s.id === anchor) : -1;
    const at = kept >= 0 ? kept : boat >= 0 ? boat : steps.length;
    if (!step.done || kept < 0) saveAddedAnchor(today, steps[at]?.id ?? "end");
    steps.splice(at, 0, step);
  }
  // Day 1 with "yesterday" picked (her question, Nov 8 2026: "если я заполнила вопросы за yesterday,
  // а потом ханч дал мне заполнить два-три новых вопроса — за вчера или за сегодня?"): questions
  // added that morning are asked for yesterday too, so yesterday stays one whole day; tonight they
  // come with the rest of today's.
  let pickedYesterday = false;
  try { pickedYesterday = localStorage.getItem("memap_first_day_pick") === "yesterday"; } catch { /* ignore */ }
  if (dayOneMorning && pickedYesterday && addedIds.length > 0) {
    const y = isoLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    if (!steps.some((s) => s.id === `fill:${y}`)) {
      const gotY = new Set(entries.filter((e) => e.date === y).map((e) => e.trackerId));
      const answeredY = addedIds.filter((id) => gotY.has(id)).length;
      const at = steps.findIndex((s) => s.id === "q:added" || s.kind === "questions");
      const fill: Step = { id: `fill:${y}`, kind: "fill", date: y, trackerIds: addedIds, answered: answeredY, done: answeredY === addedIds.length, onPath: true };
      steps.splice(at >= 0 ? at : steps.length, 0, fill);
    }
  }
  // Her first link (Nov 6 2026): where the boat is, the day it's found; seen = done.
  const fl = entries.length > 0 ? firstLinkState(buildRoutes(trackers, entries, buildIslands(trackers, entries)), true) : { route: null, seenToday: false };
  if (fl.route || fl.seenToday) {
    const step: Step = { id: "link", kind: "link", trackerIds: [], answered: 0, done: !fl.route };
    // last week's report stays first (QA re-check, Nov 9 2026: the link went in front of it on day 8)
    let boat = steps.findIndex((s) => !s.done && s.kind !== "unload");
    if (boat >= 0 && steps[boat].kind === "report") boat += 1;
    let lastQ = -1; steps.forEach((s, i) => { if (s.kind === "questions") lastQ = i; });
    steps.splice(step.done ? lastQ + 1 : boat >= 0 ? boat : steps.length, 0, step);
  }
  // An island that reached a new stage with today's answers: a step already
  // done, right after the questions that grew it (her note, Nov 5 2026: one
  // evening of answers should show progress by itself, no extra taps).
  // Several islands growing the same evening are one light (QA, Nov 8 2026: four stacked lights
  // "Your … island grew" for one event), after the last questions step that grew one of them.
  const grown = grewToday(trackers, entries, today);
  if (grown.length > 0) {
    const isl = new Set(grown.map((g) => g.island));
    let at = -1;
    steps.forEach((s, i) => {
      if (s.kind === "questions" && s.trackerIds.some((id) => { const t = byId.get(id); return !!t && isl.has(islandOf(t)); })) at = i;
    });
    const first = grown[0];
    steps.splice(at >= 0 ? at + 1 : steps.length, 0, { id: grown.length === 1 ? `grew:${first.island}` : "grew:many", kind: "grew", island: first.island, stage: first.stage, grew: grown, trackerIds: [], answered: 0, done: true });
  }

  // A calm day (her "а что ты предлагаешь", Nov 8 2026; QA C16: the morning after week 1 jumped to
  // 8 steps): besides the questions, at most three things a day, the most important first. The rest
  // wait for another day; what was done today stays.
  const extras = steps.filter((s) => EXTRA_ORDER.includes(s.kind));
  const room = Math.max(0, MAX_EXTRAS - extras.filter((s) => s.done).length);
  const keep = new Set(extras.filter((s) => !s.done).sort((a, b) => EXTRA_ORDER.indexOf(a.kind) - EXTRA_ORDER.indexOf(b.kind)).slice(0, room));
  for (let i = steps.length - 1; i >= 0; i--) if (EXTRA_ORDER.includes(steps[i].kind) && !steps[i].done && !keep.has(steps[i])) steps.splice(i, 1);

  // Before the evening (her note, Nov 8 2026: after yesterday's answers "предложить что-то поделать
  // и потом написать: заполни сегодня"): today's questions not started yet wait for the evening, at the
  // end of the path, and the boat goes to something to do now. They can still be answered any time.
  if (now.getHours() < EVENING_AT) {
    const waits = steps.filter((s) => s.kind === "questions" && !s.done && s.answered === 0);
    for (const s of waits) s.tonight = true;
    if (waits.length > 0) steps.splice(0, steps.length, ...steps.filter((s) => !waits.includes(s)), ...waits);
  }

  // The path only goes forward (her note, Nov 7 2026: "то вперёд, то назад… пусть лучше
  // добавляются новые кнопки"): a step done out of turn (the tour before the questions,
  // a game before the last island) moves behind the boat, so nothing done ever stands
  // after the step to do now.
  const cur = steps.findIndex((s) => !s.done);
  if (cur >= 0) {
    const ahead = steps.slice(cur);
    if (ahead.some((s) => s.done)) steps.splice(cur, ahead.length, ...ahead.filter((s) => s.done), ...ahead.filter((s) => !s.done));
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
