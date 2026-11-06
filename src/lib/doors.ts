// "Doors" (1.8.0): the user starts from ONE concrete pain instead of a
// 5-screen interview. A door picks the main question, three context
// questions and the reason chips, and the first entry is made right
// inside onboarding so Today is never empty. See CONCEPT_DOORS.md.
//
// The engine underneath is unchanged: a door just creates ordinary
// library trackers and ordinary yes/no entries. The only new data is
// `TrackerEntry.tags` (reason chips) and the door state below, which
// the Today hero and the echo lines read.
import type { LucideIcon } from "lucide-react";
import { Heart, Activity, Wine, Smile, CloudRain, Moon, Zap, Leaf, BedDouble, HeartHandshake, Target, Footprints, Sparkles, Droplet, Wind, Briefcase, Plane } from "lucide-react";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { getTrackers, saveTrackers, getEntries, saveEntries } from "./storage";
import { LIFE_STREAMS, LifeStreamTemplate } from "./lifeStreams";
import {
  localizeTrackerTitleRaw,
  localizeTrackerQuestionRaw,
  localizeTrackerAdviceRaw,
} from "./trackerLocalize";
import { uuid } from "./uuid";

export type DoorId = "fights" | "mood" | "migraine" | "drinking" | "kid" | "sleep"
  // onboarding v2 (Nov 5 2026): "I want more good days"
  | "energy" | "calm" | "goodSleep" | "closeness" | "focus" | "movement" | "joy"
  // onboarding v7 (Nov 6 2026): health first; "a thought keeps coming back"
  | "period" | "stress" | "quit" | "move";

export interface Door {
  id: DoorId;
  /** "event" doors log a thing that happened (a fight, a migraine) and
   *  ask "when was the last one?". "state" doors (mood) are about how the
   *  whole day felt, so onboarding asks "how did today feel?" instead. */
  kind: "event" | "state";
  /** Library template for the main "did it happen" question. */
  mainTemplateId: string;
  /** Three library templates asked about the same day. Each must have
   *  a `doors.context.<id>` entry in the locales. */
  contextTemplateIds: [string, string, string];
  /** Reason chip ids, labels under `doors.reasons.<id>`. */
  reasons: string[];
  icon: LucideIcon;
  /** Tailwind text colour class for the door icon. */
  iconClass: string;
  /** Onboarding v2 (Nov 5 2026): "Something keeps happening" or "I want more good days". */
  branch: "pain" | "good" | "thought";
  /** The answer that means "it happened" (default yes). A bad night is a "no"
   *  to "Slept enough", so the Bad nights door logs no. */
  mainValue?: boolean;
}

export const DOORS: Door[] = [
  {
    id: "fights",
    branch: "pain",
    kind: "event",
    mainTemplateId: "argued-with-partner",
    contextTemplateIds: ["slept-enough", "drank-alcohol", "felt-fatigued"],
    reasons: ["money", "chores", "kids", "tiredness", "family", "people", "jealousy", "phones", "other", "dontRemember"],
    icon: Heart,
    iconClass: "text-strong",
  },
  {
    id: "mood",
    branch: "pain",
    kind: "state",
    // Main = a low day. Anxiety is the first context question and is
    // answered by the same "how did today feel?" tap (see FEELINGS).
    mainTemplateId: "felt-depressed",
    contextTemplateIds: ["felt-anxious", "slept-enough", "outside-30min"],
    reasons: ["work", "sleep", "someoneClose", "money", "health", "loneliness", "news", "nothingInParticular"],
    icon: CloudRain,
    iconClass: "text-[hsl(258_100%_86%)]",
  },
  {
    id: "migraine",
    branch: "pain",
    kind: "event",
    mainTemplateId: "migraine",
    contextTemplateIds: ["slept-enough", "felt-anxious", "ate-by-2pm"],
    reasons: ["shortSleep", "stress", "skippedMeal", "alcohol", "period", "brightLight", "fight", "other", "dontKnow"],
    icon: Activity,
    iconClass: "text-primary",
  },
  {
    id: "drinking",
    branch: "pain",
    kind: "event",
    mainTemplateId: "drank-alcohol",
    contextTemplateIds: ["slept-enough", "felt-anxious", "felt-lonely"],
    reasons: ["stress", "boredom", "company", "celebration", "loneliness", "habit", "tiredness", "other"],
    icon: Wine,
    iconClass: "text-emerging",
  },
  {
    id: "kid",
    branch: "pain",
    kind: "event",
    mainTemplateId: "yelled-at-kid",
    contextTemplateIds: ["slept-enough", "felt-fatigued", "felt-anxious"],
    reasons: ["tiredness", "rushing", "bedtime", "homework", "siblings", "screens", "notListening", "other", "dontKnow"],
    icon: Smile,
    iconClass: "text-note",
  },
  {
    id: "sleep",
    branch: "pain",
    kind: "event",
    mainTemplateId: "slept-enough",
    mainValue: false,
    contextTemplateIds: ["coffee-late", "screen-time-long", "ate-late"],
    reasons: ["caffeine", "screens", "thoughts", "lateFood", "noise", "kids", "pain", "dontKnow"],
    icon: Moon,
    iconClass: "text-[hsl(232_62%_62%)]",
  },
  // onboarding v7 (Nov 6 2026): cycle and stress among the first five; a thought
  // that keeps coming back (her original idea: "правда ли я этого хочу?") — no right answer
  { id: "period", branch: "pain", kind: "event", mainTemplateId: "period-symptoms", contextTemplateIds: ["slept-enough", "felt-stressed", "felt-fatigued"], reasons: ["dontKnow"], icon: Droplet, iconClass: "text-[hsl(340_62%_60%)]" },
  { id: "stress", branch: "pain", kind: "event", mainTemplateId: "felt-stressed", contextTemplateIds: ["slept-enough", "worked-overtime", "exercised"], reasons: ["dontKnow"], icon: Wind, iconClass: "text-[hsl(262_48%_62%)]" },
  { id: "quit", branch: "thought", kind: "event", mainTemplateId: "wanted-leave-job", contextTemplateIds: ["slept-enough", "burned-out-after-work", "argued-with-partner"], reasons: ["dontKnow"], icon: Briefcase, iconClass: "text-[hsl(212_60%_56%)]" },
  { id: "move", branch: "thought", kind: "event", mainTemplateId: "thought-about-emigrating", contextTemplateIds: ["slept-enough", "felt-lonely", "burned-out-after-work"], reasons: ["dontKnow"], icon: Plane, iconClass: "text-[hsl(36_86%_52%)]" },
  // "I want more good days" (onboarding v2): the good question is the main one
  ...([
    ["energy", "had-energy", ["slept-enough", "outside-30min", "exercised"], Zap, "text-[hsl(36_86%_52%)]"],
    ["calm", "felt-calm", ["slept-enough", "phone-free-morning", "time-for-myself"], Leaf, "text-[hsl(152_36%_44%)]"],
    ["goodSleep", "slept-enough", ["coffee-late", "screen-time-long", "felt-anxious"], BedDouble, "text-[hsl(232_62%_62%)]"],
    ["closeness", "felt-close-to-partner", ["slept-enough", "felt-fatigued", "saw-friends"], HeartHandshake, "text-[hsl(340_62%_60%)]"],
    ["focus", "main-thing-done", ["slept-enough", "focus-hour", "phone-free-morning"], Target, "text-[hsl(212_60%_56%)]"],
    ["movement", "exercised", ["slept-enough", "outside-30min", "had-energy"], Footprints, "text-[hsl(16_72%_58%)]"],
    ["joy", "felt-happy", ["saw-friends", "outside-30min", "did-creative-work"], Sparkles, "text-[hsl(290_40%_60%)]"],
  ] as const).map(([id, main, ctx, icon, iconClass]): Door => ({
    id, branch: "good", kind: "event", mainTemplateId: main, contextTemplateIds: [...ctx] as [string, string, string],
    reasons: ["sleptWell", "moved", "outside", "ateWell", "goodPeople", "rest", "sun", "dontKnow"], icon, iconClass,
  })),
];

export const getDoor = (id: DoorId): Door | undefined => DOORS.find((d) => d.id === id);

// "How did today feel?" for the mood door. Each answer sets the main
// question (a low day) and the anxiety context question in one tap.
export type Feeling = "good" | "okay" | "low" | "anxious";
export const FEELINGS: Feeling[] = ["good", "okay", "low", "anxious"];
export const feelingAnswers = (f: Feeling) => ({ low: f === "low", anxious: f === "anxious" });

/** Context questions for the "And around it?" screen when several doors
 *  were picked: union in door order, no repeats, at most four. Templates
 *  in `skip` were already answered on the first-entry screen. */
export const contextFor = (doors: Door[], skip: string[] = [], max = 4): string[] => {
  const out: string[] = [];
  for (const d of doors) {
    for (const id of d.contextTemplateIds) {
      if (!out.includes(id) && !skip.includes(id)) out.push(id);
    }
  }
  return out.slice(0, max);
};

// --- Dates (local, not UTC) ------------------------------------------

export const isoLocal = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const daysAgoIso = (n: number, from: Date = new Date()): string => {
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return isoLocal(d);
};

const dayDiff = (fromIso: string, toIso: string): number => {
  const a = new Date(fromIso + "T12:00:00").getTime();
  const b = new Date(toIso + "T12:00:00").getTime();
  return Math.round((b - a) / 86400000);
};

// --- Door state -------------------------------------------------------

const DOOR_KEY = "memap_door";

export interface DoorState {
  id: DoorId;
  trackerId: string;
  contextTrackerIds: string[];
  /** YYYY-MM-DD, the day onboarding finished. */
  startedAt: string;
  /** Other doors picked at the same time. They get their questions and
   *  a row with "+" on Today, but no first entry in onboarding. */
  extra?: { id: DoorId; trackerId: string }[];
}

export const getDoorState = (): DoorState | null => {
  try {
    const raw = localStorage.getItem(DOOR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DoorState;
    if (!parsed || !getDoor(parsed.id) || !parsed.trackerId) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const saveDoorState = (state: DoorState): void => {
  try {
    localStorage.setItem(DOOR_KEY, JSON.stringify(state));
    window.dispatchEvent(new Event("memap-door-changed"));
  } catch {
    // Not fatal: the trackers exist, only the hero won't show.
  }
};

// --- Trackers -----------------------------------------------------------

export const findTemplate = (
  id: string,
): { template: LifeStreamTemplate; clusterId: string } | null => {
  for (const stream of LIFE_STREAMS) {
    const found = stream.templates.find((tpl) => tpl.id === id);
    if (found) return { template: found, clusterId: stream.id };
  }
  return null;
};

/**
 * Make sure a tracker exists for each library template id and return
 * the ids in the same order. A tracker the user already has (same
 * localized title, e.g. on a replayed tour) is reused instead of
 * duplicated; an archived one is brought back.
 */
export const ensureTemplates = async (templateIds: string[]): Promise<string[]> => {
  const existing = await getTrackers();
  const now = new Date().toISOString();
  const next = [...existing];
  let changed = false;

  const ensure = (templateId: string, i: number): string => {
    const found = findTemplate(templateId);
    if (!found) throw new Error(`door template missing: ${templateId}`);
    const { template, clusterId } = found;
    const title = localizeTrackerTitleRaw(template.title);
    const match = next.find((tr) => tr.title.trim().toLowerCase() === title.trim().toLowerCase());
    if (match) {
      if (match.archived) {
        const idx = next.indexOf(match);
        next[idx] = { ...match, archived: false };
        changed = true;
      }
      return match.id;
    }
    const tracker: Tracker = {
      id: `${Date.now()}-${templateId}-${i}`,
      title,
      category: template.category,
      subcategory: template.subcategory,
      cluster: clusterId,
      questionText: localizeTrackerQuestionRaw(template.questionText),
      answerType: template.answerType,
      periodDays: template.periodDays,
      threshold: template.threshold,
      problemWhen: template.problemWhen,
      adviceAboveThreshold: localizeTrackerAdviceRaw(template.adviceAboveThreshold),
      createdAt: now,
      sortIndex: next.length,
      // No cycleStartDate: the limit counts the last periodDays, like
      // library questions, so a backdated first entry counts too.
    };
    next.push(tracker);
    changed = true;
    return tracker.id;
  };

  const ids = templateIds.map((id, i) => ensure(id, i));
  if (changed) await saveTrackers(next);
  return ids;
};

/** The door's main tracker plus its three context trackers. */
export const ensureDoorTrackers = async (
  door: Door,
): Promise<{ trackerId: string; contextTrackerIds: string[] }> => {
  const [trackerId, ...contextTrackerIds] = await ensureTemplates([door.mainTemplateId, ...door.contextTemplateIds]);
  return { trackerId, contextTrackerIds };
};

/** A question the user typed themselves ("Did my dog limp today?"). */
export const addOwnTracker = async (question: string): Promise<string> => {
  const existing = await getTrackers();
  const text = question.trim();
  const tracker: Tracker = {
    id: `${Date.now()}-own`,
    title: text.replace(/[?？]+$/, "").slice(0, 60),
    category: "Curious",
    questionText: text,
    answerType: "boolean",
    periodDays: 30,
    threshold: 10,
    problemWhen: "yes",
    adviceAboveThreshold: "",
    createdAt: new Date().toISOString(),
    sortIndex: existing.length,
  };
  await saveTrackers([...existing, tracker]);
  return tracker.id;
};

// --- Entries ------------------------------------------------------------

const upsert = (
  entries: TrackerEntry[],
  trackerId: string,
  date: string,
  value: boolean,
  tags?: string[],
): TrackerEntry[] => {
  const idx = entries.findIndex((e) => e.trackerId === trackerId && e.date === date);
  if (idx >= 0) {
    const prev = entries[idx];
    const merged = tags && tags.length > 0
      ? Array.from(new Set([...(prev.tags ?? []), ...tags]))
      : prev.tags;
    const copy = [...entries];
    copy[idx] = { ...prev, value, ...(merged ? { tags: merged } : {}) };
    return copy;
  }
  const entry: TrackerEntry = { id: uuid(), trackerId, date, value };
  if (tags && tags.length > 0) entry.tags = tags;
  return [...entries, entry];
};

/** Log the main door question (default "it happened"), with reason
 *  chips. The mood door passes `value: false` on a good day. Context
 *  answers are keyed by tracker id. */
export const logDoorEntry = async (args: {
  trackerId: string;
  date: string;
  tags: string[];
  value?: boolean;
  context?: Record<string, boolean | undefined>;
}): Promise<void> => {
  let entries = await getEntries();
  entries = upsert(entries, args.trackerId, args.date, args.value ?? true, args.tags);
  for (const [trackerId, value] of Object.entries(args.context ?? {})) {
    if (typeof value === "boolean") entries = upsert(entries, trackerId, args.date, value);
  }
  await saveEntries(entries);
};

// --- Counts for the hero and echo lines --------------------------------
// Plain counting only. No statistics, no verdicts: the correlation
// engine stays the only place that says "this holds".

export interface DoorCounts {
  /** Days with "yes" in the last 7 days, today included. */
  last7: number;
  /** Days with "yes" since counting started. */
  total: number;
  /** Days of counting so far, today included (>= 1). */
  daysCounting: number;
  todayValue: boolean | undefined;
  /** Oldest first, today last. */
  week: { date: string; value: boolean | undefined; isToday: boolean }[];
}

export const doorCounts = (
  state: DoorState,
  entries: TrackerEntry[],
  now: Date = new Date(),
): DoorCounts => {
  const today = isoLocal(now);
  const mine = entries.filter((e) => e.trackerId === state.trackerId);
  const byDate = new Map(mine.map((e) => [e.date, e.value]));
  // The first entry can predate onboarding ("the last fight was
  // yesterday"), so counting starts at whichever is earlier.
  const first = mine.reduce((min, e) => (e.date < min ? e.date : min), state.startedAt);
  const daysCounting = Math.max(1, dayDiff(first, today) + 1);
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = daysAgoIso(6 - i, now);
    return { date, value: byDate.get(date), isToday: date === today };
  });
  return {
    last7: week.filter((d) => d.value === true).length,
    total: mine.filter((e) => e.value && e.date >= first && e.date <= today).length,
    daysCounting,
    todayValue: byDate.get(today),
    week,
  };
};

export interface ContextFact {
  /** Library template id of the context question, for its copy. */
  templateId: string;
  /** Yes-days that had the "bad" context answer. */
  k: number;
  /** Yes-days with any answer to that context question. */
  n: number;
}

/**
 * The most common context among the days it happened, e.g. "2 of 3
 * came after a bad night". Only returned once there are at least two
 * matching days and they are at least half, so a single coincidence
 * never shows up as a "fact".
 */
export const strongestContextFact = (
  state: DoorState,
  trackers: Tracker[],
  entries: TrackerEntry[],
): ContextFact | null => {
  const door = getDoor(state.id);
  if (!door) return null;
  const yesDates = new Set(
    entries.filter((e) => e.trackerId === state.trackerId && e.value).map((e) => e.date),
  );
  if (yesDates.size < 2) return null;
  let best: ContextFact | null = null;
  state.contextTrackerIds.forEach((ctxId, i) => {
    const tracker = trackers.find((tr) => tr.id === ctxId && !tr.archived);
    if (!tracker) return;
    const bad = tracker.problemWhen === "yes";
    const answered = entries.filter((e) => e.trackerId === ctxId && yesDates.has(e.date));
    const k = answered.filter((e) => e.value === bad).length;
    const n = yesDates.size;
    if (k < 2 || k * 2 < n) return;
    if (!best || k > best.k) best = { templateId: door.contextTemplateIds[i], k, n };
  });
  return best;
};
