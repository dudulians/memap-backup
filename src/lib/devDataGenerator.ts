// Dev-only test data generator. Wires up to a Settings → Data button
// for the developer/owner to fill 60 days of tracker entries with
// realistic-looking biases so charts and correlation insights have
// something to render. Not exposed to end users (the button is
// labelled and warned).
//
// HOW REALISM WORKS
// We don't just toss coins per (tracker, day). Instead each day samples
// three hidden axes:
//   - bad_day      — generic bad-mood / low-energy day (≈30% of days)
//   - alcohol_day  — drinking happened (≈25% of days)
//   - pms_day      — 5 days every ~28, randomised cycle start
// Then each template's daily Yes-probability is shifted by these axes.
// Result: when you scan correlations after generation you should see
// alcohol↔headache-next-day, bad-mood↔less-sleep, pms↔period-symptoms,
// etc. — the same connections the curated graph predicts. Custom
// trackers (titles we can't match to a template id) get a flat 30%
// base with no correlation, so they show up in trends but won't
// dominate the correlation board.

import { Tracker, TrackerEntry } from "@/types/tracker";
import { matchTemplateIdByTitle } from "./relatedQuestions";
import { uuid } from "./uuid";

const NUM_DAYS = 60;

// Probability bias per template. Values are added/subtracted from
// `base` and the result clamped to [0.02, 0.98] so we never get a
// 0%/100% column (which would be useless for correlations).
//   base               — baseline daily Yes probability
//   badDay             — added when day's bad_day axis fires
//   alcoholDay         — added when day drinking happened
//   alcoholYesterday   — added when day BEFORE saw drinking (hangover-style lag)
//   pmsDay             — added when day falls in the 5-day PMS window
type Bias = {
  base: number;
  badDay?: number;
  alcoholDay?: number;
  alcoholYesterday?: number;
  pmsDay?: number;
};

// IMPORTANT calibration note. The signal goes through TWO random
// samples on its way from the latent axis (bad_day / alcohol_day /
// pms_day) to the correlation engine — first when sampling tracker
// A's daily Yes/No, then when sampling tracker B's. Each random
// sample dilutes the effect. To clear chi-square at p < 0.05 with
// |phi| > 0.25 (our adaptive threshold for n≥60), the conditional
// probabilities P(Yes|axis_on) vs P(Yes|axis_off) need to differ
// by at least ~0.5. Earlier (1.7-pre) bias values were closer to
// ~0.2-0.3 and the resulting phi came in at 0.10-0.15 — under
// threshold, no correlations rendered. Bumped to ≥0.5 effects on
// the headline pairs so the dev tool actually surfaces a
// detectable signal across one generation.
const BIAS: Record<string, Bias> = {
  // ─── Habits ─────────────────────────────────────────────────
  "drank-alcohol": { base: 0.05, alcoholDay: 0.85, badDay: 0.15 },
  "smoked": { base: 0.1, badDay: 0.3, alcoholDay: 0.4 },
  "smoked-hookah": { base: 0.05, alcoholDay: 0.55 },
  "coffee-late": { base: 0.4 },
  "ate-sweets": { base: 0.3, badDay: 0.3, pmsDay: 0.5 },
  "screen-time-long": { base: 0.4, badDay: 0.4 },
  "ate-fast-food": { base: 0.2, badDay: 0.4 },
  "phone-free-morning": { base: 0.55, badDay: -0.45 },
  "doomscrolled-news": { base: 0.2, badDay: 0.5 },
  "gaming-streams-2h": { base: 0.15, badDay: 0.35 },
  "impulse-spending": { base: 0.1, badDay: 0.35 },
  "stayed-on-budget": { base: 0.55, badDay: -0.35 },
  "stalked-ex": { base: 0.05, badDay: 0.3, alcoholDay: 0.25 },
  "compared-on-social": { base: 0.15, badDay: 0.5 },
  "ordered-delivery": { base: 0.15, badDay: 0.45 },
  "wore-same-shirt": { base: 0.1, badDay: 0.45 },
  "skipped-cleaning": { base: 0.3, badDay: 0.45 },
  "cooked-myself": { base: 0.55, badDay: -0.45 },
  "ate-by-fridge": { base: 0.1, badDay: 0.45 },

  // ─── Health ─────────────────────────────────────────────────
  "headache": { base: 0.05, alcoholYesterday: 0.6, pmsDay: 0.45, badDay: 0.2 },
  "migraine": { base: 0.03, alcoholYesterday: 0.45, pmsDay: 0.55 },
  "stomach-issues": { base: 0.05, alcoholDay: 0.45 },
  "felt-nauseous": { base: 0.03, pmsDay: 0.45, alcoholYesterday: 0.4 },
  "back-or-neck-pain": { base: 0.15, badDay: 0.25 },
  "joint-pain": { base: 0.08 },
  "slept-enough": { base: 0.8, badDay: -0.6, alcoholDay: -0.5 },
  "felt-fatigued": { base: 0.15, badDay: 0.55, alcoholYesterday: 0.45 },
  "period-symptoms": { base: 0.0, pmsDay: 0.9 },
  "exercised": { base: 0.55, badDay: -0.45 },
  "trained-hard": { base: 0.4, badDay: -0.35 },
  "stretched": { base: 0.4, badDay: -0.3 },
  "morning-libido": { base: 0.5, badDay: -0.35, alcoholYesterday: -0.35 },
  "felt-recovered": { base: 0.7, badDay: -0.5, alcoholYesterday: -0.45 },
  "outside-30min": { base: 0.65, badDay: -0.45 },
  "saw-daylight": { base: 0.7, badDay: -0.45 },
  "drank-water": { base: 0.6 },
  "ate-by-2pm": { base: 0.65, badDay: -0.35 },
  "bed-before-midnight": { base: 0.6, badDay: -0.45, alcoholDay: -0.45 },
  "skin-allergy": { base: 0.05, pmsDay: 0.35 },
  "heart-palpitations": { base: 0.04, alcoholDay: 0.3, badDay: 0.2 },
  "eye-strain": { base: 0.2, badDay: 0.3 },

  // ─── State ──────────────────────────────────────────────────
  "felt-happy": { base: 0.75, badDay: -0.65 },
  "felt-anxious": { base: 0.15, badDay: 0.55, pmsDay: 0.35 },
  "felt-depressed": { base: 0.05, badDay: 0.55 },
  "felt-angry": { base: 0.1, badDay: 0.5, pmsDay: 0.3, alcoholDay: 0.25 },
  "felt-lonely": { base: 0.1, badDay: 0.45 },
  "had-energy": { base: 0.7, badDay: -0.55, alcoholYesterday: -0.35 },
  "cried-today": { base: 0.05, badDay: 0.45, pmsDay: 0.4 },
  "burned-out-after-work": { base: 0.15, badDay: 0.5 },
  "didnt-want-to-work": { base: 0.1, badDay: 0.5 },
  "worked-overtime": { base: 0.25 },
  "felt-fulfilled-at-work": { base: 0.55, badDay: -0.45 },
  "snapped-at-loved-ones": { base: 0.05, badDay: 0.5, pmsDay: 0.3, alcoholDay: 0.25 },
  "calm-day": { base: 0.65, badDay: -0.55 },
  "isolated-at-home": { base: 0.2, badDay: 0.45 },
  "in-flow": { base: 0.45, badDay: -0.4 },
  "kept-morning-promise": { base: 0.6, badDay: -0.45 },
  "no-snooze": { base: 0.5, badDay: -0.4, alcoholYesterday: -0.35 },
  "procrastinated": { base: 0.15, badDay: 0.5 },
  "felt-proud-today": { base: 0.55, badDay: -0.5 },
  "felt-useless": { base: 0.05, badDay: 0.5 },
  "got-recognition": { base: 0.2 },
  "boss-was-difficult": { base: 0.1, badDay: 0.4 },
  "conflict-with-colleague": { base: 0.05, badDay: 0.35 },
  "drained-by-someone": { base: 0.15, badDay: 0.4 },
  "heard-bad-news": { base: 0.08, badDay: 0.4 },
  "home-was-tidy": { base: 0.55, badDay: -0.4 },
  "said-yes-when-meant-no": { base: 0.1, badDay: 0.4 },
  "cried-from-something-small": { base: 0.05, pmsDay: 0.35, badDay: 0.35 },
  "laughed-uncontrollably": { base: 0.3, badDay: -0.25 },
  "envied-on-social": { base: 0.1, badDay: 0.4 },
  "felt-not-like-others": { base: 0.1, badDay: 0.45 },
  "danced-or-sang-alone": { base: 0.25, badDay: -0.2 },
  "petted-an-animal": { base: 0.4 },
  "liked-my-selfie": { base: 0.1, badDay: -0.25 },
  "talked-to-pet": { base: 0.3 },

  // ─── Partner & friends ──────────────────────────────────────
  "argued-with-partner": { base: 0.05, badDay: 0.45, alcoholDay: 0.35, pmsDay: 0.3 },
  "felt-close-to-partner": { base: 0.55, badDay: -0.45 },
  "felt-lonely-with-partner": { base: 0.05, badDay: 0.45 },
  "partner-irritated-me": { base: 0.1, badDay: 0.45, pmsDay: 0.35 },
  "good-time-together": { base: 0.5, badDay: -0.45 },
  "had-sex": { base: 0.25, badDay: -0.2 },
  "saw-friends": { base: 0.3, badDay: -0.15 },
  "called-parent": { base: 0.2 },
  "thought-about-leaving": { base: 0.02, badDay: 0.4 },
  "apologized-first": { base: 0.15 },
  "complimented-stranger": { base: 0.15 },
  "flirted": { base: 0.1 },
  "thought-about-someone-else": { base: 0.05, badDay: 0.25 },
  "missed-ex": { base: 0.03, badDay: 0.3, alcoholDay: 0.2 },
  "didnt-like-friend-post": { base: 0.05, badDay: 0.25 },

  // ─── Parenting ──────────────────────────────────────────────
  "yelled-at-kid": { base: 0.05, badDay: 0.55, pmsDay: 0.3 },
  "felt-bad-parent": { base: 0.05, badDay: 0.55 },
  "quality-time-kid": { base: 0.6, badDay: -0.45 },
  "ran-out-of-patience": { base: 0.1, badDay: 0.55, pmsDay: 0.35 },
  "felt-overwhelmed-parenting": { base: 0.1, badDay: 0.55 },

  // ─── Big decisions ──────────────────────────────────────────
  "wanted-child": { base: 0.15 },
  "thought-about-emigrating": { base: 0.05, badDay: 0.3 },
  "wanted-leave-job": { base: 0.05, badDay: 0.4 },
  "thought-divorce": { base: 0.02, badDay: 0.4 },
  "wanted-life-change": { base: 0.05, badDay: 0.35 },
  "wanted-pet": { base: 0.1 },
  "wanted-learn-new": { base: 0.2 },
  "thought-career-change": { base: 0.05, badDay: 0.3 },

  // ─── Learning ──────────────────────────────────────────────
  "studied-language": { base: 0.5, badDay: -0.4 },
  "watched-course-lecture": { base: 0.35, badDay: -0.3 },
  "did-creative-work": { base: 0.45, badDay: -0.35 },
  "learned-something-new": { base: 0.55, badDay: -0.2 },
  "practiced-skill": { base: 0.4, badDay: -0.3 },
  "listened-podcast": { base: 0.4 },
  "read-book": { base: 0.5, badDay: -0.35 },

  // ─── External events ──────────────────────────────────────
  // Mostly external; we still pin a small badDay correlation on
  // interpersonal ones so the dev tester sees realistic clusters
  // ("toxic friend day" tending to coincide with bad-mood days).
  "noisy-neighbors": { base: 0.15 },
  "construction-nearby": { base: 0.1 },
  "long-commute": { base: 0.2, badDay: 0.15 },
  "transport-issue": { base: 0.1 },
  "internet-down": { base: 0.1 },
  "criticized-by-close": { base: 0.1, badDay: 0.35 },
  "parent-pressured": { base: 0.08, badDay: 0.3 },
  "toxic-friend": { base: 0.08, badDay: 0.3 },
  "kids-reached-out": { base: 0.4 },
  "financial-issue": { base: 0.05 },
};

const DEFAULT_BIAS: Bias = { base: 0.3 };

const clamp01 = (v: number, min = 0.02, max = 0.98) =>
  Math.max(min, Math.min(max, v));

// Local-date YYYY-MM-DD strings — match the rest of the app which
// stores dates in local time (not UTC) so the user in UTC+4 doesn't
// see entries shifting calendar days.
const isoLocal = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const dateNDaysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoLocal(d);
};

interface DayContext {
  badDay: boolean;
  alcoholDay: boolean;
  alcoholYesterday: boolean;
  pmsDay: boolean;
}

const buildDayContexts = (numDays: number): DayContext[] => {
  // Pre-roll the per-day axes so alcoholYesterday can look back at
  // alcoholDays[i-1] cleanly.
  const badDays: boolean[] = [];
  const alcoholDays: boolean[] = [];
  for (let i = 0; i < numDays; i++) {
    badDays.push(Math.random() < 0.3);
    alcoholDays.push(Math.random() < 0.25);
  }
  // PMS: random cycle start in [0,28), then 5 consecutive Yes days
  // every 28 days for the remainder.
  const pmsDays: boolean[] = new Array(numDays).fill(false);
  const cycleStart = Math.floor(Math.random() * 28);
  for (let i = cycleStart; i < numDays; i += 28) {
    for (let j = 0; j < 5 && i + j < numDays; j++) pmsDays[i + j] = true;
  }
  return Array.from({ length: numDays }, (_, i) => ({
    badDay: badDays[i],
    alcoholDay: alcoholDays[i],
    alcoholYesterday: i > 0 ? alcoholDays[i - 1] : false,
    pmsDay: pmsDays[i],
  }));
};

const sampleAnswer = (bias: Bias, ctx: DayContext): boolean => {
  let p = bias.base;
  if (ctx.badDay && bias.badDay !== undefined) p += bias.badDay;
  if (ctx.alcoholDay && bias.alcoholDay !== undefined) p += bias.alcoholDay;
  if (ctx.alcoholYesterday && bias.alcoholYesterday !== undefined)
    p += bias.alcoholYesterday;
  if (ctx.pmsDay && bias.pmsDay !== undefined) p += bias.pmsDay;
  return Math.random() < clamp01(p);
};

export interface DevDataGenerationResult {
  newEntries: TrackerEntry[];
  newTrackers: Tracker[];
  generatedCount: number;
  trackerCount: number;
  daysCount: number;
}

/**
 * Generate ~NUM_DAYS days of biased entries for every active tracker.
 * - Existing entries within the date range are OVERWRITTEN (the user
 *   just told us "regenerate" — we replace not append, otherwise
 *   running it twice would dupe entries per day).
 * - Entries outside the date range (older than NUM_DAYS, or future)
 *   are left untouched.
 * - Each active tracker's cycleStartDate is also pulled back to the
 *   oldest generated date. Without this, Signals (which gates on
 *   cycleStartDate) would only count from "today" forward and miss
 *   the 60 days of generated history — making the dev tool look
 *   broken when actually it's just the cycle window not seeing the
 *   fake past.
 *
 * Returns the new full entries list and the trackers list with shifted
 * cycleStartDate values, ready to pass to saveEntries / saveTrackers.
 */
export const generateDevData = (
  trackers: Tracker[],
  existingEntries: TrackerEntry[],
): DevDataGenerationResult => {
  const activeTrackers = trackers.filter((t) => !t.archived);
  if (activeTrackers.length === 0) {
    return {
      newEntries: existingEntries,
      newTrackers: trackers,
      generatedCount: 0,
      trackerCount: 0,
      daysCount: NUM_DAYS,
    };
  }

  const numDays = NUM_DAYS;
  const contexts = buildDayContexts(numDays);

  // dates[0] = oldest (60 days ago), dates[numDays-1] = today.
  const dates: string[] = [];
  for (let i = numDays - 1; i >= 0; i--) dates.push(dateNDaysAgo(i));
  const dateSet = new Set(dates);
  const oldestDate = dates[0];

  // Strip existing entries that fall within the date range — the
  // user explicitly asked to regenerate this window. Keep entries
  // outside (older history, anything in the future) intact so the
  // generator doesn't nuke real data accidentally entered earlier.
  const preservedEntries = existingEntries.filter((e) => !dateSet.has(e.date));

  const generatedEntries: TrackerEntry[] = [];
  const activeTrackerIds = new Set(activeTrackers.map((t) => t.id));

  for (const tracker of activeTrackers) {
    const tplId = matchTemplateIdByTitle(tracker.title);
    const bias = (tplId && BIAS[tplId]) || DEFAULT_BIAS;

    for (let i = 0; i < numDays; i++) {
      const value = sampleAnswer(bias, contexts[i]);
      generatedEntries.push({
        id: uuid(),
        trackerId: tracker.id,
        date: dates[i],
        value,
      });
    }
  }

  // Shift cycleStartDate on every active tracker so Signals counts
  // the freshly generated history. Archived trackers untouched.
  const newTrackers = trackers.map((t) =>
    activeTrackerIds.has(t.id) ? { ...t, cycleStartDate: oldestDate } : t,
  );

  return {
    newEntries: [...preservedEntries, ...generatedEntries],
    newTrackers,
    generatedCount: generatedEntries.length,
    trackerCount: activeTrackers.length,
    daysCount: numDays,
  };
};
