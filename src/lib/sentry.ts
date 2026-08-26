/**
 * Sentry crash + error reporting setup.
 *
 * MeMap is a Capacitor app — JavaScript runs inside a WebView wrapped
 * by native iOS/Android shells. @sentry/capacitor handles both:
 *   - JS errors thrown in React code (component crashes, render errors,
 *     unhandled promise rejections, etc.)
 *   - Native crashes from Swift / Kotlin layers (rare but they happen
 *     under memory pressure or with malformed plugin bridges)
 *
 * Tuning for FREE TIER (5,000 events / month):
 *   - tracesSampleRate: 0 — no performance monitoring (each transaction
 *     would count toward the event quota; with even moderate usage that
 *     burns through 5K fast)
 *   - replaysSessionSampleRate: 0 — no session replay during normal use
 *   - replaysOnErrorSampleRate: 0 — no replay on errors either (free
 *     plan has only 50 replays/month; one buggy week could exhaust it)
 *   - Both can be ramped up later if we move to a paid plan or want
 *     occasional deep debugging
 *
 * Source maps are NOT uploaded yet — for the launch this means stack
 * traces show minified line numbers. Acceptable: we can correlate via
 * the Vite build output `dist/assets/index-*.js`. Source map upload
 * via the Sentry CLI is a 1-hour addition once we have a release
 * pipeline (post-launch task).
 */
import * as Sentry from "@sentry/capacitor";
import * as SentryReact from "@sentry/react";

/**
 * Initialise Sentry. Call once on app boot, BEFORE any React render so
 * errors thrown during the first paint are also captured.
 *
 * In dev (import.meta.env.DEV) we skip init entirely — local errors
 * already show in the console with full stack traces, and we don't
 * want Hot Module Reload churn to spam the production error feed.
 */
export const initSentry = (): void => {
  if (import.meta.env.DEV) return;

  try {
    Sentry.init(
      {
        dsn: "https://b0b751fec6b827cb32aa88ab8e220978@o4511370908860416.ingest.de.sentry.io/4511370930421840",

        // Environment tag — lets us filter prod errors from any future
        // staging / TestFlight builds in the Sentry dashboard.
        environment: "production",

        // Release version — pulls from the same source the app icon /
        // build uses (Android versionName, iOS MARKETING_VERSION).
        // BUMP THIS on every release alongside the iOS/Android version
        // numbers. Sentry groups errors by release, so this is what
        // makes the "this bug was introduced in v1.7.6" analytics work.
        release: "memap@1.7.6",

        // Free-tier-friendly sample rates (see file header for reasoning).
        tracesSampleRate: 0,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,

        // Drop noisy errors that aren't actionable:
        ignoreErrors: [
          // Browser extensions firing in WebView context (out of our control)
          /^Non-Error promise rejection captured/,
          // Network blip when navigating away mid-fetch — happens normally
          "TypeError: Load failed",
          "Failed to fetch",
          // ResizeObserver chatter — benign, Chrome devtools recommends
          // ignoring these
          "ResizeObserver loop limit exceeded",
          "ResizeObserver loop completed with undelivered notifications",
        ],

        // Strip stack trace frames originating from browser extensions /
        // injected scripts that aren't ours. Reduces noise in the Issues
        // feed.
        denyUrls: [
          /extensions\//i,
          /^chrome:\/\//i,
          /^moz-extension:\/\//i,
        ],
      },
      // @sentry/capacitor wraps the React SDK — pass it through so
      // ErrorBoundary, route tracking etc. all work as expected.
      SentryReact.init,
    );
  } catch (err) {
    // Sentry init itself failed — don't crash the app over that.
    // Log to console so dev still sees the issue if debugging.
    console.error("[Sentry] init failed:", err);
  }
};

/**
 * Manual error capture for cases where we catch + handle an error
 * but still want it logged (e.g. failed migration, corrupted storage).
 */
export const captureError = (
  error: unknown,
  context?: Record<string, unknown>,
): void => {
  if (import.meta.env.DEV) {
    console.error("[would-report]", error, context);
    return;
  }
  try {
    Sentry.captureException(error, { extra: context });
  } catch {
    // Best-effort — never let error reporting itself throw.
  }
};

/**
 * Send a one-time INFO-level event on first install. Lets us prove
 * the Sentry pipeline is wired up correctly even when no actual
 * errors happen (otherwise the Issues dashboard sits empty forever
 * showing the "Get Started" tutorial).
 *
 * Uses a localStorage flag so we only fire ONCE per install (and
 * once per re-install if the user wipes data). At 5K free-tier
 * events / month this costs ~30-50 events/month with our current
 * user base — well within budget.
 *
 * The event shows up in Sentry as "App installation verified"
 * (level: info) — does NOT appear in the Errors & Outages feed,
 * only in the broader Issues filter when info-level is included.
 */
const SENTRY_INSTALL_VERIFIED_KEY = "memap_sentry_install_verified";
export const sendInstallHeartbeat = (): void => {
  if (import.meta.env.DEV) return;
  try {
    if (localStorage.getItem(SENTRY_INSTALL_VERIFIED_KEY)) return;
    Sentry.captureMessage("App installation verified", "info");
    localStorage.setItem(SENTRY_INSTALL_VERIFIED_KEY, "true");
  } catch {
    // Best-effort.
  }
};
