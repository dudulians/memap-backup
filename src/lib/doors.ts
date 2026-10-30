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
import { Heart, Activity, Wine, Smile } from "lucide-react";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { getTrackers, saveTrackers, getEntries, saveEntries } from "./storage";
import { LIFE_STREAMS, LifeStreamTemplate } from "./lifeStreams";
import {
  localizeTrackerTitleRaw,
  localizeTrackerQuestionRaw,
  localizeTrackerAdviceRaw,
} from "./trackerLocalize";
import { uuid } from "./uuid";

export type DoorId = "fights" | "migraine" | "drinking" | "kid";

export interface Door {
  id: DoorId;
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
}

export const DOORS: Door[] = [
  {
    id: "fights",
    mainTemplateId: "argued-with-partner",
    contextTemplateIds: ["slept-enough", "drank-alcohol", "felt-fatigued"],
    reasons: ["money", "chores", "kids", "tiredness", "family", "jealousy", "phones", "dontRemember"],
    icon: Heart,
    iconClass: "text-strong",
  },
  {
    id: "migraine",
    mainTemplateId: "migraine",
    contextTemplateIds: ["slept-enough", "felt-anxious", "ate-by-2pm"],
    reasons: ["shortSleep", "stress", "skippedMeal", "alcohol", "period", "brightLight", "fight", "dontKnow"],
    icon: Activity,
    iconClass: "text-primary",
  },
  {
    id: "drinking",
    mainTemplateId: "drank-alcohol",
    contextTemplateIds: ["slept-enough", "felt-anxious", "felt-lonely"],
    reasons: ["stress", "boredom", "company", "celebration", "loneliness", "habit", "tiredness"],
    icon: Wine,
    iconClass: "text-emerging",
  },
  {
    id: "kid",
    mainTemplateId: "yelled-at-kid",
    contextTemplateIds: ["slept-enough", "felt-fatigued", "felt-anxious"],
    reasons: ["tiredness", "rushing", "bedtime", "homework", "siblings", "screens", "notListening", "dontKnow"],
    icon: Smile,
    iconClass: "text-note",
  },
];

export const getDoor = (id: DoorId): Door | undefined => DOORS.find((d) => d.id === id);

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
 * Make sure the door's four trackers exist and return their ids. A
 * tracker the user already has (same localized title, e.g. on a
 * replayed tour) is reused instead of duplicated; an archived one is
 * brought back.
 */
export const ensureDoorTrackers = async (
  door: Door,
): Promise<{ trackerId: string; contextTrackerIds: string[] }> => {
  const existing = await getTrackers();
  const today = isoLocal(new Date());
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
      cycleStartDate: today,
    };
    next.push(tracker);
    changed = true;
    return tracker.id;
  };

  const trackerId = ensure(door.mainTemplateId, 0);
  const contextTrackerIds = door.contextTemplateIds.map((id, i) => ensure(id, i + 1));
  if (changed) await saveTrackers(next);
  return { trackerId, contextTrackerIds };
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

/** Log "it happened" for the main door question, with reason chips.
 *  Context answers are keyed by tracker id. */
export const logDoorEntry = async (args: {
  trackerId: string;
  date: string;
  tags: string[];
  context?: Record<string, boolean | undefined>;
}): Promise<void> => {
  let entries = await getEntries();
  entries = upsert(entries, args.trackerId, args.date, true, args.tags);
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
