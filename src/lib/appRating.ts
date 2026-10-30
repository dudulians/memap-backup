/**
 * App Store / Play Store rating prompt.
 *
 * Triggers the native iOS SKStoreReviewController / Android Play
 * In-App Review dialog at a *positive moment* in the user's journey
 * — never on first launch, never after an error, never repeatedly.
 *
 * Trigger conditions (ALL must be true):
 *   1. User has at least 5 distinct days of tracked entries, or 3
 *      days plus a seen correlation insight (opinion is formed)
 *   2. Called at a positive moment (see call sites below)
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
import { track } from "./analytics";

const ASKED_KEY = "memap_rating_asked_at";
const SEEN_CORRELATION_KEY = "memap_rating_seen_correlation";
const MIN_DAYS_TRACKED = 5;
const MIN_DAYS_WITH_CORRELATION = 3;
const COOLDOWN_DAYS = 120;

// Store page "write a review" deep link for the Settings row. Unlike
// requestReview() it always opens, so it is only ever user-initiated.
export const APP_STORE_REVIEW_URL =
  "https://apps.apple.com/app/id6764054148?action=write-review";

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
 * Call sites:
 *   - DailySession done screen (primary: the user just closed the
 *     evening and the echo card just told them a fact)
 *   - App.tsx cold start (fallback for people who answer from
 *     notifications and rarely see the done screen)
 */
export const maybeRequestRating = async (): Promise<boolean> => {
  try {
    // Condition 3 — cooldown
    const lastAsked = localStorage.getItem(ASKED_KEY);
    if (lastAsked && daysSince(lastAsked) < COOLDOWN_DAYS) return false;

    // Condition 1 — enough distinct days of entries. Counted as
    // unique dates (one user can have multiple trackers per day; we
    // count the DAY not the entry). A seen correlation lowers the bar
    // from 5 days to 3. Until 1.7.9 the correlation was REQUIRED, and
    // only 2 of 107 users ever saw one: 0 ratings at 116 downloads.
    const entries = await getEntries();
    const distinctDays = new Set(entries.map((e) => e.date)).size;
    const seenCorrelation = !!localStorage.getItem(SEEN_CORRELATION_KEY);
    const needed = seenCorrelation ? MIN_DAYS_WITH_CORRELATION : MIN_DAYS_TRACKED;
    if (distinctDays < needed) return false;

    // All conditions met — fire the native prompt. Wrapped in try
    // because the plugin can throw if the OS is in a weird state
    // (e.g. simulator without an App Store account).
    await InAppReview.requestReview();
    localStorage.setItem(ASKED_KEY, new Date().toISOString());
    track("rating_prompt_shown", { distinctDays, seenCorrelation });
    return true;
  } catch (err) {
    // Don't crash the app over a rating prompt. Log to Sentry so
    // we know if this is broken in the wild, but proceed.
    captureError(err, { source: "maybeRequestRating" });
    return false;
  }
};
