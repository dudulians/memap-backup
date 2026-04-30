// Related-questions engine — surfaces templates likely correlated with
// what a user is already tracking. Replaces the old "pure random Play
// round" with intent: if you care about migraines, the app suggests
// what's KNOWN to influence migraines (sleep, alcohol, caffeine, screens,
// hormones) — not "did you sing in the shower today".
//
// The map below is a manually-curated graph: for each tracker template
// id, a list of 3-7 related template ids that medical / psychological
// research (or strong common sense) ties to it. Used by:
//   - DailySession playMode → builds 10-card play deck weighted toward
//     related-to-user templates
//   - AddTrackerModal → "Связанные с твоими" section
//
// Edges are intentionally one-directional in each entry; we union both
// directions at lookup time so e.g. "headache → sleep" and "sleep → ?"
// can independently grow without making this map symmetric.

import { LIFE_STREAMS, LifeStreamTemplate } from "./lifeStreams";

/**
 * For each template id, which other template ids are commonly
 * correlated. Curated by hand — not derived from user data.
 */
export const RELATED_QUESTIONS: Record<string, string[]> = {
  // ─── Партнёр ────────────────────────────────────────────────────
  "argued-with-partner": [
    "slept-enough",
    "drank-alcohol",
    "period-symptoms",
    "felt-anxious",
    "felt-fatigued",
    "had-energy",
  ],
  "felt-close-to-partner": [
    "had-energy",
    "slept-enough",
    "exercised",
    "good-time-together",
  ],
  "felt-lonely-with-partner": [
    "felt-anxious",
    "felt-depressed",
    "felt-lonely",
    "screen-time-long",
  ],
  "partner-irritated-me": [
    "slept-enough",
    "ran-out-of-patience",
    "period-symptoms",
    "felt-fatigued",
  ],
  "good-time-together": [
    "had-energy",
    "felt-happy",
    "felt-close-to-partner",
  ],
  "called-parent": [
    "felt-lonely",
    "felt-happy",
  ],
  "thought-about-leaving": [
    "argued-with-partner",
    "felt-lonely-with-partner",
    "felt-depressed",
    "thought-divorce",
  ],

  // ─── Родительство ──────────────────────────────────────────────
  "yelled-at-kid": [
    "slept-enough",
    "period-symptoms",
    "drank-alcohol",
    "ran-out-of-patience",
    "felt-fatigued",
    "had-energy",
  ],
  "felt-bad-parent": [
    "felt-anxious",
    "cried-today",
    "yelled-at-kid",
    "felt-overwhelmed-parenting",
  ],
  "quality-time-kid": [
    "had-energy",
    "felt-happy",
    "screen-time-long",
  ],
  "ran-out-of-patience": [
    "slept-enough",
    "felt-fatigued",
    "drank-alcohol",
    "period-symptoms",
  ],
  "felt-overwhelmed-parenting": [
    "felt-fatigued",
    "slept-enough",
    "drank-alcohol",
    "felt-anxious",
  ],

  // ─── Здоровье ──────────────────────────────────────────────────
  "headache": [
    "slept-enough",
    "drank-alcohol",
    "coffee-late",
    "ate-fast-food",
    "screen-time-long",
    "period-symptoms",
  ],
  "migraine": [
    "slept-enough",
    "drank-alcohol",
    "coffee-late",
    "period-symptoms",
    "screen-time-long",
    "ate-sweets",
    "felt-anxious",
  ],
  "back-or-neck-pain": [
    "exercised",
    "screen-time-long",
    "slept-enough",
  ],
  "stomach-issues": [
    "ate-fast-food",
    "ate-sweets",
    "drank-alcohol",
    "coffee-late",
    "felt-anxious",
  ],
  "joint-pain": [
    "exercised",
    "ate-sweets",
    "ate-fast-food",
  ],
  "slept-enough": [
    "coffee-late",
    "screen-time-long",
    "drank-alcohol",
    "felt-anxious",
    "had-energy",
  ],
  "felt-fatigued": [
    "slept-enough",
    "exercised",
    "ate-fast-food",
    "drank-alcohol",
    "coffee-late",
  ],
  "period-symptoms": [
    "felt-anxious",
    "felt-angry",
    "drank-alcohol",
    "ate-sweets",
    "had-energy",
    "cried-today",
  ],
  "exercised": [
    "slept-enough",
    "had-energy",
    "ate-fast-food",
    "felt-happy",
  ],

  // ─── Привычки ──────────────────────────────────────────────────
  "drank-alcohol": [
    "slept-enough",
    "headache",
    "felt-anxious",
    "felt-fatigued",
    "had-energy",
  ],
  "smoked": [
    "felt-anxious",
    "drank-alcohol",
    "coffee-late",
  ],
  "coffee-late": [
    "slept-enough",
    "felt-anxious",
    "headache",
  ],
  "ate-sweets": [
    "felt-fatigued",
    "period-symptoms",
    "stomach-issues",
    "had-energy",
  ],
  "screen-time-long": [
    "slept-enough",
    "felt-anxious",
    "headache",
    "back-or-neck-pain",
    "exercised",
  ],
  "ate-fast-food": [
    "felt-fatigued",
    "headache",
    "stomach-issues",
    "exercised",
  ],

  // ─── Состояние ─────────────────────────────────────────────────
  "felt-happy": [
    "had-energy",
    "slept-enough",
    "exercised",
    "good-time-together",
    "felt-close-to-partner",
  ],
  "felt-anxious": [
    "slept-enough",
    "drank-alcohol",
    "coffee-late",
    "screen-time-long",
    "period-symptoms",
  ],
  "felt-depressed": [
    "slept-enough",
    "exercised",
    "called-parent",
    "had-energy",
    "felt-lonely",
  ],
  "felt-angry": [
    "slept-enough",
    "drank-alcohol",
    "ran-out-of-patience",
    "period-symptoms",
  ],
  "felt-lonely": [
    "called-parent",
    "good-time-together",
    "screen-time-long",
    "felt-depressed",
  ],
  "had-energy": [
    "slept-enough",
    "exercised",
    "ate-fast-food",
    "drank-alcohol",
    "felt-happy",
  ],
  "cried-today": [
    "felt-anxious",
    "period-symptoms",
    "slept-enough",
    "called-parent",
    "felt-depressed",
  ],
  "burned-out-after-work": [
    "slept-enough",
    "exercised",
    "felt-fatigued",
    "drank-alcohol",
    "worked-overtime",
  ],
  "didnt-want-to-work": [
    "slept-enough",
    "felt-fatigued",
    "burned-out-after-work",
    "had-energy",
  ],
  "worked-overtime": [
    "felt-fatigued",
    "slept-enough",
    "burned-out-after-work",
    "had-energy",
  ],
  "felt-fulfilled-at-work": [
    "had-energy",
    "slept-enough",
    "felt-happy",
  ],

  // ─── Большие решения ──────────────────────────────────────────
  "wanted-child": [
    "felt-close-to-partner",
    "felt-happy",
    "had-energy",
    "good-time-together",
  ],
  "thought-about-emigrating": [
    "felt-anxious",
    "felt-fulfilled-at-work",
    "felt-happy",
    "didnt-want-to-work",
  ],
  "wanted-leave-job": [
    "burned-out-after-work",
    "didnt-want-to-work",
    "worked-overtime",
    "felt-fulfilled-at-work",
  ],
  "thought-divorce": [
    "argued-with-partner",
    "felt-lonely-with-partner",
    "partner-irritated-me",
    "thought-about-leaving",
  ],
  "wanted-life-change": [
    "felt-fulfilled-at-work",
    "felt-happy",
    "burned-out-after-work",
  ],
  "wanted-pet": [
    "felt-lonely",
    "felt-happy",
  ],
  "wanted-learn-new": [
    "felt-fulfilled-at-work",
    "had-energy",
    "felt-happy",
  ],
};

/**
 * Returns a flat `Set<string>` of template ids that are correlated with
 * any of the user's existing template ids. The set EXCLUDES the user's
 * current ids themselves (so we recommend NEW questions, not repeats).
 *
 * Bidirectional: if user has "headache" and the map has
 * `migraine: ["headache", ...]`, then "migraine" is also pulled in
 * (because someone tracking headaches is plausibly interested in
 * migraines too).
 */
export const getRelatedTemplateIds = (
  userTemplateIds: string[],
): Set<string> => {
  const userSet = new Set(userTemplateIds);
  const out = new Set<string>();

  // Forward edges: user has X → suggest things X relates to.
  for (const id of userTemplateIds) {
    const related = RELATED_QUESTIONS[id];
    if (related) {
      for (const r of related) {
        if (!userSet.has(r)) out.add(r);
      }
    }
  }

  // Reverse edges: user has Y, and some Z's RELATED list includes Y →
  // suggest Z. Catches "you have headache, so try the migraine question".
  for (const [sourceId, related] of Object.entries(RELATED_QUESTIONS)) {
    if (userSet.has(sourceId)) continue; // already in user's set
    if (related.some((r) => userSet.has(r))) {
      out.add(sourceId);
    }
  }

  return out;
};

/**
 * Walk LIFE_STREAMS and return the template objects matching given ids.
 * Order preserved as they appear in the streams (deterministic).
 */
export const getTemplatesByIds = (ids: Set<string>): LifeStreamTemplate[] => {
  const out: LifeStreamTemplate[] = [];
  for (const stream of LIFE_STREAMS) {
    for (const tpl of stream.templates) {
      if (ids.has(tpl.id)) out.push(tpl);
    }
  }
  return out;
};

/**
 * Try to extract a template id from a stored tracker. Trackers store
 * localised TITLE strings, not template ids — so we match by title
 * against LIFE_STREAMS (both EN and RU sides).
 *
 * Returns the id if matched, or null for custom user-typed trackers.
 */
export const matchTemplateIdByTitle = (title: string): string | null => {
  const norm = title.trim().toLowerCase();
  for (const stream of LIFE_STREAMS) {
    for (const tpl of stream.templates) {
      if (tpl.title.toLowerCase() === norm) return tpl.id;
      if (tpl.titleRu.toLowerCase() === norm) return tpl.id;
    }
  }
  return null;
};

/**
 * Top-level helper for callers: given a list of user trackers
 * (with stored titles), return template objects that are related but
 * not yet in the user's set.
 *
 * If the user has no trackers we can match (all custom or empty list),
 * returns an empty array — callers should fall back to "any random
 * template".
 */
export const getRelatedQuestions = (
  userTrackerTitles: string[],
): LifeStreamTemplate[] => {
  const userIds = userTrackerTitles
    .map(matchTemplateIdByTitle)
    .filter((id): id is string => id !== null);
  if (userIds.length === 0) return [];

  const relatedIds = getRelatedTemplateIds(userIds);
  return getTemplatesByIds(relatedIds);
};
