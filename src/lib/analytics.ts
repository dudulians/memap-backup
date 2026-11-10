/**
 * Mixpanel analytics — minimal anonymous event tracking.
 *
 * 2.0 adds the new screens' events (the list at the bottom, Nov 6 2026) and a few
 * user properties (days answered, questions, islands, topic, week).
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
 * - No topic names either (her yes, Nov 10 2026): which topics someone picked ("migraine", "sleep"), a tip's id or
 *   a first answer are health facts — the Flo case (FTC 2021, jury 2025) was "anonymous" analytics events like these.
 *   Counts and kinds of steps only; islands (life areas: health, love, work…) stay.
 *
 * This keeps Apple's Privacy Nutrition Label at "Data Not Linked to
 * You" — anonymous analytics, the lowest disclosure tier.
 *
 * NO-OP IN DEV
 * import.meta.env.DEV → no init, all track() calls become console
 * logs. Keeps the production event feed clean from HMR-driven noise.
 */
import mixpanel from "mixpanel-browser";
import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";

/** The version people run (keep with iOS MARKETING_VERSION). */
export const APP_VERSION = "2.0";

/** Old user (answers from before 2.0) or a new install: decided once, on the first launch of 2.0,
 *  so their numbers never mix (her note, Nov 8 2026). */
export const cohort = (): "old" | "new" => {
  try {
    const saved = localStorage.getItem("memap_cohort");
    if (saved === "old" || saved === "new") return saved;
    const had = localStorage.getItem("memap_tour_seen") === "true" || !!localStorage.getItem("memap_door") || (localStorage.getItem("memap_entries") ?? "[]").length > 2;
    const c = had ? "old" : "new";
    localStorage.setItem("memap_cohort", c);
    return c;
  } catch { return "new"; }
};

/** The onboarding test (her "Yes, build A/B/C", Nov 8 2026): every new install gets A, B or C at random, kept
 *  for good. A = "What brings you here?" first; B = all topics at once; C = all topics → the first answers →
 *  a reminder, with hints on the first taps. Old users are not in the test (their onboarding is A's). */
export type OnbVariant = "A" | "B" | "C";
const ONB_KEY = "memap_ab_onb";
const ONB_PREVIEW = "memap_ab_onb_preview";
const isOnb = (x: unknown): x is OnbVariant => x === "A" || x === "B" || x === "C";
export const onbVariant = (): OnbVariant => {
  try {
    const preview = localStorage.getItem(ONB_PREVIEW);
    if (isOnb(preview)) return preview;
    const saved = localStorage.getItem(ONB_KEY);
    if (isOnb(saved)) return saved;
    if (cohort() === "old") return "A";
    const v = (["A", "B", "C"] as const)[Math.floor(Math.random() * 3)];
    localStorage.setItem(ONB_KEY, v);
    return v;
  } catch { return "A"; }
};
/** For Mixpanel: the group; "none" for old users, "B-preview" while the owner looks at one. */
export const onbLabel = (): string => {
  try {
    const preview = localStorage.getItem(ONB_PREVIEW);
    if (isOnb(preview)) return `${preview}-preview`;
    const saved = localStorage.getItem(ONB_KEY);
    return isOnb(saved) ? saved : "none";
  } catch { return "none"; }
};
/** The owner's switch (Settings → Data & privacy, after 7 taps on the version): see A, B or C from the start. */
export const setOnbPreview = (v: OnbVariant | null) => {
  try { if (v) localStorage.setItem(ONB_PREVIEW, v); else localStorage.removeItem(ONB_PREVIEW); } catch { /* ignore */ }
  registerProps({ onb_variant: onbLabel() });
};

/** Where she heard about MeMap (the one-tap card on Today), once answered. */
export const getSource = (): string | null => { try { return localStorage.getItem("memap_source"); } catch { return null; } };

// ---- which screen is on top: the last one when the app is closed ("на каком моменте закрыли") ----
const screens: string[] = ["start"];
/** The tab underneath everything. */
export const setBaseScreen = (name: string) => { screens[0] = name; };
/** A screen over the tab (a sheet, the questions, onboarding); returns how to leave it. */
export const enterScreen = (name: string) => { screens.push(name); return () => { const i = screens.lastIndexOf(name); if (i > 0) screens.splice(i, 1); }; };
export const currentScreen = () => screens[screens.length - 1];
/** While it's on screen (and active), this is the screen she is on. */
export const useScreen = (name: string, active = true) => { useEffect(() => (active ? enterScreen(name) : undefined), [name, active]); };

const MIXPANEL_TOKEN = "60e2fb1904bc6c57d3438b0336c0f5c4";

let initialised = false;

export const initAnalytics = (): void => {
  cohort();
  onbVariant(); // a new install's onboarding group is drawn on its first launch
  if (import.meta.env.DEV) { registerProps({ onb_variant: onbLabel() }); return; }
  // Only the real app on a phone (Nov 8 2026: our own test builds opened on the computer,
  // http://127.0.0.1:4180 and file:///…, showed up in Mixpanel as dozens of users "(not set)")
  if (!Capacitor.isNativePlatform()) return;
  if (initialised) return;

  try {
    mixpanel.init(MIXPANEL_TOKEN, {
      // EU data residency. Our Mixpanel project lives on
      // eu.mixpanel.com, so events MUST be sent to the EU API
      // endpoint or they silently land in the wrong region and
      // never appear in the dashboard. The fact that the project
      // was created with EU residency from the start means there's
      // no migration path — we have to point the SDK explicitly.
      // Without this line, events go to the default api.mixpanel.com
      // (US) and disappear.
      api_host: "https://api-eu.mixpanel.com",
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
      // Country and city from the request IP, as in the live 1.7.9 (her note, Nov 8 2026:
      // "я в Mixpanel вижу страну"): Mixpanel works them out on its side; the app has no
      // location code. The App Store privacy label lists approximate location for this.
      // (1.8.0 had turned it off with `ip: false`, which would have lost the country in 2.0.)
      ip: true,
    });
    initialised = true;
    // on every event (her note, Nov 8 2026: "чтобы не путались со старыми пользователями"): the version,
    // old or new, the phone's language and region setting, where she heard about us when she said
    const source = getSource();
    mixpanel.register({ app_version: APP_VERSION, cohort: cohort(), onb_variant: onbLabel(), region: navigator.language || "", ...(source ? { source } : {}) });
    // the first launch of this install, once
    try {
      if (!localStorage.getItem("memap_first_open")) {
        localStorage.setItem("memap_first_open", new Date().toISOString());
        mixpanel.track("first_open", { region: navigator.language || "" });
      }
    } catch { /* counted next time */ }
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
  /** the app is closing: send at once, in a way that survives the close */
  closing = false,
): void => {
  if (import.meta.env.DEV) {
    console.log("[analytics:would-track]", event, props);
    return;
  }
  if (!initialised) return;
  try {
    if (closing) mixpanel.track(event, props, { transport: "sendBeacon", send_immediately: true });
    else mixpanel.track(event, props);
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

/** Take a property off the profile (the old "topic", Nov 10 2026). */
export const unsetUserProperty = (key: string): void => {
  if (import.meta.env.DEV || !initialised) return;
  try { mixpanel.people.unset(key); } catch { /* best effort */ }
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
  | "rating_prompt_shown"
  | "data_exported"
  | "data_imported"
  // 1.8.0 "doors" funnel. `door_selected` → `first_entry_logged` →
  // `hero_logged` / `echo_shown` answers "does the first minute work?"
  | "door_selected"
  | "first_entry_logged"
  | "hero_logged"
  | "echo_shown"
  // Return from background. app_opened only fires on a cold start,
  // so without this most real returns were invisible in retention.
  | "app_foregrounded"
  | "rate_app_tapped"
  // 2.0 (Nov 6 2026, her ask: "намного больше данных"). Same rule: the fact of an
  // action and its kind, never a question, an answer or a note.
  | "onboarding_screen" // screen: welcome, fork, pain, good, promise, door, own, curious, companion
  | "path_step_started" // kind of step, week number
  | "observe_tip_added" // a "Worth watching" tip added its question
  | "end_card_action" // what she chose on "Done for today"
  | "tour_started" | "tour_stop_viewed" | "tour_finished"
  | "first_link_seen" | "island_grew_seen" | "treasure_earned"
  | "unload_played" | "hunch_made" | "note_saved" | "experiment_started"
  | "report_opened" | "island_opened" | "link_opened" | "map_view_changed"
  | "ui_switched" | "reminders_changed" | "world_shared"
  // Nov 8 2026: where people come from and where they leave
  | "first_open" // the first launch of this install
  | "app_left" // the app went to the background: the screen she was on, seconds in the app
  | "screen_viewed" // a tab or a main screen opened
  | "source_answered" // "Where did you hear about MeMap?"
  | "old_tour_screen" // the old users' onboarding, screen by screen
  // Nov 8 2026 (her "add all"): what brings people back and how an evening goes
  | "notification_opened" // a push was tapped: which kind (evening, test…), which words
  | "returned_after_gap" // opened again after 2+ days away
  | "experiment_finished" // a test's result: kept or not, what it showed
  | "experiment_stopped" // a kept test stopped later
  | "observe_tip_later" // a "Worth watching" tip: not now
  | "doctor_report_made"
  // onboarding v7 (Nov 6 2026)
  | "onboarding_questions"
  | "onboarding_reminder"
  | "world_begun"
  | "world_waiting"
  | "experiment_remind"
  // "Games and rewards" kept or turned off: on, and where (the one-time question on Today, or Settings)
  | "playful_choice"
  // calendar weeks (Nov 9 2026): a missed day opened from the "Missed a few days?" card (how many days ago),
  // and the card put away with "Not now" (how many days it showed)
  | "fill_day_opened"
  | "fill_card_hidden"
  // "Why?" (Nov 10 2026): reasons saved (how many answers and chips, any words, from the path or Notes or the
  // calendar), or the step skipped (how many answers, from the sheet or the path's card)
  | "reasons_saved"
  | "reasons_skipped";

/** "Where did you hear about MeMap?" (one tap on Today): kept and put on every later event. */
export const setSource = (source: string) => {
  try { localStorage.setItem("memap_source", source); } catch { /* asked again next time */ }
  track("source_answered", { source });
  if (import.meta.env.DEV || !initialised) return;
  try { mixpanel.register({ source }); } catch { /* best effort */ }
};

/** Put these on every later event (the week, the day since she started). */
export const registerProps = (props: Record<string, string | number | boolean>) => {
  if (import.meta.env.DEV) { console.log("[analytics:would-register]", props); return; }
  if (!initialised) return;
  try { mixpanel.register(props); } catch { /* best effort */ }
};

/** On every start and return: when she was last here; 2+ days away is counted (what brings people back). */
export const noteActive = () => {
  try {
    const today = new Date(); const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const last = localStorage.getItem("memap_last_active");
    if (last && last !== iso) {
      const days = Math.round((Date.parse(iso + "T12:00:00") - Date.parse(last + "T12:00:00")) / 86_400_000);
      if (days >= 2) track("returned_after_gap", { days });
    }
    localStorage.setItem("memap_last_active", iso);
  } catch { /* counted next time */ }
};
