/**
 * Mixpanel analytics — minimal anonymous event tracking.
 *
 * Track 8 key events that answer "is the product working?":
 *   1. app_opened — every session start (powers DAU / retention)
 *   2. onboarding_step_completed — funnel step granularity
 *   3. onboarding_completed — finished setup
 *   4. tracker_added — added a tracker (template vs custom)
 *   5. daily_session_completed — finished all today's swipes
 *   6. correlation_viewed — saw a correlation (value moment)
 *   7. theme_changed — switched theme (which are popular)
 *   8. rating_prompt_shown — App Store prompt fired
 *
 * PRIVACY-FIRST DESIGN
 * - We do NOT identify users (no .identify() call) — they remain
 *   anonymous device-id strings in Mixpanel.
 * - We do NOT log tracker titles, question text, answers, or notes
 *   content — those are private user data.
 * - We log the FACT of actions, never the CONTENT.
 *
 * This keeps Apple's Privacy Nutrition Label at "Data Not Linked to
 * You" — anonymous analytics, the lowest disclosure tier.
 *
 * NO-OP IN DEV
 * import.meta.env.DEV → no init, all track() calls become console
 * logs. Keeps the production event feed clean from HMR-driven noise.
 */
import mixpanel from "mixpanel-browser";

const MIXPANEL_TOKEN = "60e2fb1904bc6c57d3438b0336c0f5c4";

let initialised = false;

export const initAnalytics = (): void => {
  if (import.meta.env.DEV) return;
  if (initialised) return;

  try {
    mixpanel.init(MIXPANEL_TOKEN, {
      // Don't auto-track pageviews — SPA, single page, would just
      // double-count app_opened
      track_pageview: false,
      // Persist anonymous ID across sessions so retention math works.
      // localStorage = stays through reinstall on iOS (via iCloud KV)
      // / Android (via Auto Backup), so we can see "this is a
      // returning user".
      persistence: "localStorage",
      // Respect Do Not Track from the user's browser/OS
      ignore_dnt: false,
      // We don't use Mixpanel autocapture (form fills, clicks etc.)
      // — those could capture PII. We only track named events.
      autocapture: false,
      // Don't log to console in prod (would spam DevTools when user
      // opens it for any reason)
      debug: false,
    });
    initialised = true;
  } catch (err) {
    // Init failure (network blip, blocked by ad blocker, etc.) is
    // not fatal — analytics is best-effort, never a hard dep.
    console.warn("[analytics] init failed:", err);
  }
};

/**
 * Track a named event with optional properties. Properties should be
 * scalar values (string / number / boolean) — never user content.
 *
 * Safe to call any time: gated on init success + DEV mode.
 */
export const track = (
  event: AnalyticsEvent,
  props?: Record<string, string | number | boolean>,
): void => {
  if (import.meta.env.DEV) {
    console.log("[analytics:would-track]", event, props);
    return;
  }
  if (!initialised) return;
  try {
    mixpanel.track(event, props);
  } catch {
    // Best-effort — never let analytics throw.
  }
};

/**
 * Set a user property (not an event). Use for stable attributes
 * like preferred language, current theme, etc. Same privacy rule:
 * no PII, no user content.
 */
export const setUserProperty = (
  key: string,
  value: string | number | boolean,
): void => {
  if (import.meta.env.DEV) {
    console.log("[analytics:would-set]", key, value);
    return;
  }
  if (!initialised) return;
  try {
    mixpanel.people.set({ [key]: value });
  } catch {
    // Best-effort.
  }
};

// Centralised event name registry — keeps autocomplete + typo-proofs
// the rest of the codebase. Adding a new event = add to this union.
export type AnalyticsEvent =
  | "app_opened"
  | "onboarding_step_completed"
  | "onboarding_completed"
  | "tracker_added"
  | "daily_session_completed"
  | "correlation_viewed"
  | "theme_changed"
  | "rating_prompt_shown";
