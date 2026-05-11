/**
 * App Store / Play Store rating prompt.
 *
 * Triggers the native iOS SKStoreReviewController / Android Play
 * In-App Review dialog at a *positive moment* in the user's journey
 * — never on first launch, never after an error, never repeatedly.
 *
 * Trigger conditions (ALL must be true):
 *   1. User has at least 5 distinct days of tracked entries
 *      (they've built a habit — opinion is formed)
 *   2. User has seen at least one correlation insight
 *      (positive value moment — "oh, the app actually shows me
 *       something interesting")
 *   3. We haven't asked them in the past 120 days
 *      (Apple soft-limits to ~3 prompts/year per user; spacing
 *       4 months gives breathing room)
 *
 * Why these conditions:
 *   - Asking too early → user has no opinion → blank-mind ★3
 *   - Asking after an error → ★1 with "broken app" review
 *   - Asking after a correlation insight → user JUST saw value
 *     → ★5 with "this app told me alcohol affects my sleep"
 *
 * Apple actually rate-limits this prompt: even if we call
 * requestReview() the OS may silently skip if we've shown it 3
 * times already this year. We don't fight that — just shape our
 * trigger so the prompt fires at the best moment when it does
 * appear.
 */
import { InAppReview } from "@capacitor-community/in-app-review";
import { getEntries } from "./storage";
import { captureError } from "./sentry";

const ASKED_KEY = "memap_rating_asked_at";
const SEEN_CORRELATION_KEY = "memap_rating_seen_correlation";
const MIN_DAYS_TRACKED = 5;
const COOLDOWN_DAYS = 120;

/**
 * Mark that the user has seen a correlation insight. Called from
 * CorrelationInsights when it actually renders a correlation card.
 * Cheap to call repeatedly — first call wins, subsequent are no-ops.
 */
export const markCorrelationSeen = (): void => {
  try {
    if (localStorage.getItem(SEEN_CORRELATION_KEY)) return;
    localStorage.setItem(SEEN_CORRELATION_KEY, new Date().toISOString());
  } catch {
    // localStorage write failed — corrupted / quota. Not fatal,
    // user just won't get the rating prompt this session.
  }
};

const daysSince = (iso: string): number => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return Infinity;
  return (Date.now() - then) / (1000 * 60 * 60 * 24);
};

/**
 * Check all trigger conditions and request the native rating
 * dialog if eligible. Safe to call at any time — internal logic
 * gates it. Returns true if we asked, false if conditions weren't
 * met.
 *
 * Recommended call sites:
 *   - App.tsx on resume after the user just answered today's
 *     last tracker (positive value moment)
 *   - PatternsTab when user lands on Signals with strongCount >= 1
 */
export const maybeRequestRating = async (): Promise<boolean> => {
  try {
    // Condition 3 — cooldown
    const lastAsked = localStorage.getItem(ASKED_KEY);
    if (lastAsked && daysSince(lastAsked) < COOLDOWN_DAYS) return false;

    // Condition 2 — seen at least one correlation
    if (!localStorage.getItem(SEEN_CORRELATION_KEY)) return false;

    // Condition 1 — at least MIN_DAYS_TRACKED distinct days of
    // entries. Counted as unique dates (one user can have multiple
    // trackers per day; we count the DAY not the entry).
    const entries = await getEntries();
    const distinctDays = new Set(entries.map((e) => e.date)).size;
    if (distinctDays < MIN_DAYS_TRACKED) return false;

    // All conditions met — fire the native prompt. Wrapped in try
    // because the plugin can throw if the OS is in a weird state
    // (e.g. simulator without an App Store account).
    await InAppReview.requestReview();
    localStorage.setItem(ASKED_KEY, new Date().toISOString());
    return true;
  } catch (err) {
    // Don't crash the app over a rating prompt. Log to Sentry so
    // we know if this is broken in the wild, but proceed.
    captureError(err, { source: "maybeRequestRating" });
    return false;
  }
};
