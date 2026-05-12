// Curated demo data generator — used for screenshots / app-store
// previews / marketing recordings. Unlike devDataGenerator (which
// works on the user's existing trackers with broad random biases),
// this one:
//   1. REPLACES the entire tracker + entry state with a fixed set
//      of 8 curated questions. Same templates every run so the
//      screenshots stay reproducible.
//   2. Engineers per-day entries so a specific narrative of
//      correlations surfaces in Insights — strong stable patterns,
//      one moderate emerging pattern, plus one 🆕 "fresh" pattern
//      that only appears in the last 21 days (to demo the
//      recent-window detection).
//
// Layer 1 — Stable patterns (full 60 days):
//   - argued-with-partner ↔ headache (same day, ~85 % concordant)
//   - drank-alcohol → slept-enough (NEGATIVE, same day, ~80 % miss)
//   - drank-alcohol → headache  (lag +1, ~70 % hangover)
//   - exercised ↔ felt-happy   (same day, ~80 %)
//   - exercised ↔ slept-enough (same day, ~75 %)
//   - felt-anxious ↔ argued    (same day, ~60 %)
//
// Layer 2 — Fresh pattern (last 21 days only):
//   - outside-30min ↔ felt-happy (same day, ~85 %; first 39 days
//                                  this pair is random and won't
//                                  pass the full-history filter,
//                                  so it surfaces only via the
//                                  recent-window pass).
//
// Result on Patterns tab after running: 5-6 cards with mixed
// 🌳 Stable / 🌿 Emerging / 🆕 Fresh badges, "Expected" semantic
// verdicts, and graphs that read at a glance. Exactly the kind
// of frame an App Store preview wants.

import type { Tracker, TrackerEntry } from "@/types/tracker";
import { LIFE_STREAMS } from "./lifeStreams";
import {
  localizeTrackerTitleRaw,
  localizeTrackerQuestionRaw,
  localizeTrackerAdviceRaw,
} from "./trackerLocalize";
import { uuid } from "./uuid";

const NUM_DAYS = 60;
const FRESH_WINDOW = 21;

const DEMO_TEMPLATE_IDS = [
  "argued-with-partner",
  "headache",
  "drank-alcohol",
  "slept-enough",
  "exercised",
  "felt-anxious",
  "felt-happy",
  "outside-30min",
] as const;

type DemoId = (typeof DEMO_TEMPLATE_IDS)[number];

// Walks LIFE_STREAMS to find the template by id and builds a fresh
// Tracker object from it. Each demo run gets new UUIDs so we don't
// collide with anything already in storage.
const buildTrackerFromTemplate = (tplId: string): Tracker | null => {
  for (const stream of LIFE_STREAMS) {
    for (const tpl of stream.templates) {
      if (tpl.id === tplId) {
        // Store title / questionText / advice already localised to
        // the user's current language, the same way AddTrackerModal +
        // starterGenerator do. Without this the screenshots would
        // come out in English even when the UI is in Russian.
        return {
          id: uuid(),
          title: localizeTrackerTitleRaw(tpl.title),
          category: tpl.category,
          subcategory: tpl.subcategory,
          questionText: localizeTrackerQuestionRaw(tpl.questionText),
          answerType: tpl.answerType,
          periodDays: tpl.periodDays,
          threshold: tpl.threshold,
          problemWhen: tpl.problemWhen,
          adviceAboveThreshold: localizeTrackerAdviceRaw(tpl.adviceAboveThreshold),
          createdAt: new Date().toISOString(),
          cluster: stream.id,
        };
      }
    }
  }
  return null;
};

const isoLocal = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const dateNDaysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoLocal(d);
};

const clamp01 = (v: number) => Math.max(0.02, Math.min(0.98, v));

// Engineer each tracker's 60-day series from a small set of latent
// axes plus rule-based derivations. Returns a Map<templateId,
// boolean[]> with dates[0] = oldest, dates[N-1] = today.
const engineerScript = (): Map<DemoId, boolean[]> => {
  const N = NUM_DAYS;

  // Latent axes — independent per-day Bernoullis. Frequencies
  // chosen so the resulting correlations have enough concordant
  // days to clear the strict filter (chi-square, phi, occurrences).
  const argued: boolean[] = [];
  const drank: boolean[] = [];
  const exercised: boolean[] = [];
  const outside: boolean[] = [];
  for (let i = 0; i < N; i++) {
    argued.push(Math.random() < 14 / 60);    // ~14 argued days
    drank.push(Math.random() < 16 / 60);     // ~16 drinking days
    exercised.push(Math.random() < 26 / 60); // ~26 exercise days
    outside.push(Math.random() < 24 / 60);   // ~24 outside-walk days
  }

  // Derived: headache. Same-day boost from argued (85 %), next-day
  // boost from drinking the day before (70 %), small baseline (5 %).
  const headache: boolean[] = [];
  for (let i = 0; i < N; i++) {
    let p = 0.05;
    if (argued[i]) p += 0.85;
    if (i > 0 && drank[i - 1]) p += 0.65;
    headache.push(Math.random() < clamp01(p));
  }

  // Derived: slept-enough. Tanks when drinking same day (-0.6),
  // boosts when exercise (+0.25), baseline 0.65.
  const slept: boolean[] = [];
  for (let i = 0; i < N; i++) {
    let p = 0.65;
    if (drank[i]) p -= 0.6;
    if (exercised[i]) p += 0.25;
    slept.push(Math.random() < clamp01(p));
  }

  // Derived: felt-happy. Baseline 0.45. Tanks on argued (-0.35).
  // Boosts on exercise (+0.4). FRESH layer: in the last 21 days
  // ONLY, going outside boosts happy by +0.5 — that's the pair
  // we want surfacing as 🆕. In the first 39 days outside has no
  // effect on happy, so the pair stays uncorrelated on the full
  // window and only the recent-window pass picks it up.
  const happy: boolean[] = [];
  for (let i = 0; i < N; i++) {
    let p = 0.45;
    if (argued[i]) p -= 0.35;
    if (exercised[i]) p += 0.4;
    const inFreshWindow = i >= N - FRESH_WINDOW;
    if (inFreshWindow && outside[i]) p += 0.5;
    happy.push(Math.random() < clamp01(p));
  }

  // Derived: felt-anxious. Baseline 0.18, boost on argued (+0.55).
  const anxious: boolean[] = [];
  for (let i = 0; i < N; i++) {
    let p = 0.18;
    if (argued[i]) p += 0.55;
    anxious.push(Math.random() < clamp01(p));
  }

  return new Map<DemoId, boolean[]>([
    ["argued-with-partner", argued],
    ["headache", headache],
    ["drank-alcohol", drank],
    ["slept-enough", slept],
    ["exercised", exercised],
    ["felt-anxious", anxious],
    ["felt-happy", happy],
    ["outside-30min", outside],
  ]);
};

export interface DemoDataResult {
  newTrackers: Tracker[];
  newEntries: TrackerEntry[];
  trackerCount: number;
  daysCount: number;
  generatedCount: number;
}

/**
 * Build the demo state. REPLACES the entire trackers + entries
 * payload — callers should pass the result straight to
 * saveTrackers + saveEntries. Existing data is wiped.
 *
 * Returns trackers with `cycleStartDate` pulled back to the
 * oldest generated date so Signals counts the demo window.
 */
export const generateDemoData = (): DemoDataResult => {
  const trackers: Tracker[] = [];
  const idToTracker = new Map<DemoId, Tracker>();
  for (const tplId of DEMO_TEMPLATE_IDS) {
    const t = buildTrackerFromTemplate(tplId);
    if (!t) continue;
    trackers.push(t);
    idToTracker.set(tplId, t);
  }

  // dates[0] = oldest (60 days ago), dates[N-1] = today.
  const dates: string[] = [];
  for (let i = NUM_DAYS - 1; i >= 0; i--) dates.push(dateNDaysAgo(i));
  const oldestDate = dates[0];

  const script = engineerScript();
  const entries: TrackerEntry[] = [];
  for (const tplId of DEMO_TEMPLATE_IDS) {
    const tracker = idToTracker.get(tplId);
    const series = script.get(tplId);
    if (!tracker || !series) continue;
    for (let i = 0; i < NUM_DAYS; i++) {
      entries.push({
        id: uuid(),
        trackerId: tracker.id,
        date: dates[i],
        value: series[i],
      });
    }
  }

  const newTrackers = trackers.map((t, idx) => ({
    ...t,
    cycleStartDate: oldestDate,
    sortIndex: idx,
  }));

  return {
    newTrackers,
    newEntries: entries,
    trackerCount: newTrackers.length,
    daysCount: NUM_DAYS,
    generatedCount: entries.length,
  };
};
