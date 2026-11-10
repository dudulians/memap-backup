import { useEffect } from "react";
// The pop-up toaster stays only for the old screens (src/classic); the new ones show
// feedback in place (her note, Nov 10 2026: no technical pop-up windows).
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import ClassicIndex from "./classic/ClassicIndex";
import { getUiMode } from "@/lib/uiMode";
import { UpgradeInvite } from "@/components/UpgradeInvite";
import NotFound from "./pages/NotFound";
import { getNotificationSettings, scheduleNotification } from "@/lib/notifications";
import { primeAudio } from "@/lib/feedback";
import { primeHaptics } from "@/lib/haptics";
import { runStartupMigrations } from "@/lib/storage";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { maybeRequestRating } from "@/lib/appRating";
import { track, setUserProperty, currentScreen, noteActive, registerProps, onbLabel } from "@/lib/analytics";
import { getTheme } from "@/lib/theme";
import { getLanguage } from "@/lib/i18n";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    // Initialize notifications on app load. Scheduler is idempotent —
    // it cancels any prior queue and rebuilds based on current state,
    // so re-running it on every cold start (and on language change)
    // is safe.
    const refreshSchedule = () => {
      const notificationSettings = getNotificationSettings();
      scheduleNotification(notificationSettings).catch(() => {});
    };
    refreshSchedule();

    // Run one-time data migrations on app boot. Currently: legacy
    // advice text auto-refresh — see storage.ts. Wrapped so failures
    // never block the rest of the boot.
    runStartupMigrations();

    // Re-schedule when the UI language changes — iOS stores the
    // localized title/body literally with each pending notification,
    // so without rescheduling a user who switches RU→EN would still
    // see Russian text on their lock screen for the next 7 days.
    window.addEventListener("memap-language-changed", refreshSchedule);

    // Re-schedule whenever entries change — this is what makes today's
    // reminder do the right thing in every code path:
    //   • Answer the LAST unfilled tracker → today's notification gets
    //     cancelled (isTodayFilled returns true → offset 0 is skipped).
    //   • Clear an answer (Undo, calendar editor, TrackerDetails clear)
    //     → today is no longer fully filled → today's notification is
    //     re-scheduled so the user gets reminded later in the day.
    // Centralising this here means any path that saves entries (Cards
    // swipe, Play swipe, calendar edit, bulk multi-select, undo, …)
    // refreshes the queue uniformly — no per-callsite plumbing.
    window.addEventListener("memap-entries-changed", refreshSchedule);
    // "Games and rewards" switched: the reminders stop (or start) naming treasures
    window.addEventListener("memap-settings-changed", refreshSchedule);

    // Tap-on-notification deep-link. Whenever the user taps the
    // daily reminder on the lock screen / notification center, we
    // want them to land directly on the Cards tab AND have the
    // swipe deck open ready to go — not just sit on the home screen
    // and force them to find Play themselves.
    //
    // The TodayTab listens for `memap-open-session`; Index listens
    // for `memap-switch-tab`. Dispatching both gives "switch tab,
    // then open the session" without coupling either component to
    // the notification API.
    let notifSubPromise: Promise<{ remove: () => Promise<void> } | null> | null = null;
    if (Capacitor.isNativePlatform()) {
      notifSubPromise = LocalNotifications.addListener(
        "localNotificationActionPerformed",
        (action) => {
          // which push brought her back (Nov 8 2026)
          const ex = ((action as { notification?: { extra?: Record<string, unknown> } })?.notification?.extra ?? {}) as Record<string, unknown>;
          track("notification_opened", { kind: String(ex.kind ?? "unknown"), variant: String(ex.variant ?? ""), hour: new Date().getHours() });
          // Switch active tab to Cards (Index owns the activeTab state).
          window.dispatchEvent(
            new CustomEvent("memap-switch-tab", { detail: { tab: "cards" } }),
          );
          // Open the daily session immediately. setTimeout(0) defers
          // until the tab change has propagated and TodayTab is mounted
          // and listening for the open-session event.
          setTimeout(() => {
            window.dispatchEvent(new Event("memap-open-session"));
          }, 50);
        },
      );
    }

    // Attach AudioContext unlock handlers so the first swipe-sound after
    // a cold app launch actually plays. Mobile browsers & Capacitor
    // WebView block audio until a user gesture.
    primeAudio();
    // Same gesture-gating story for iOS Core Haptics: the engine takes
    // ~10-50 ms to start, and a pattern submitted while it's still
    // starting silently no-ops. Fire a minimal haptic on the first
    // pointerdown so the *next* haptic (Play tap, swipe commit, etc.)
    // fires instantly without the first-tap dud.
    primeHaptics();

    // Analytics — single event per cold start. Includes the current
    // theme + language as event properties, so we can answer "is Pop
    // theme used more than Aurora?" / "are Russian users retaining
    // better?" without identifying anyone.
    noteActive();
    track("app_opened", {
      theme: getTheme(),
      language: getLanguage(),
    });
    // Also set theme + language as USER properties so future Mixpanel
    // funnels can segment by them without re-emitting on every event.
    setUserProperty("theme", getTheme());
    setUserProperty("ui", getUiMode());
    setUserProperty("language", getLanguage());
    // 2.0: where she is (counts and kinds only, never content)
    void (async () => {
      try {
        const [{ getTrackers, getEntries }, { countedDays, pathModel }, { buildIslands }, { getDoorState }] = await Promise.all([
          import("@/lib/storage"), import("@/lib/pathSteps"), import("@/lib/islands"), import("@/lib/doors"),
        ]);
        const [trackers, entries] = await Promise.all([getTrackers(), getEntries()]);
        setUserProperty("days_answered", countedDays(trackers, entries).length);
        setUserProperty("questions", trackers.filter((x) => !x.archived).length);
        setUserProperty("islands", buildIslands(trackers, entries).length);
        setUserProperty("week", pathModel(trackers, entries).week + 1);
        setUserProperty("topic", getDoorState()?.id ?? "none");
        setUserProperty("onb_variant", onbLabel());
        // on every later event: the path's week and the day since she started (Nov 8 2026)
        const start = localStorage.getItem("memap_path_start") ?? localStorage.getItem("memap_first_open")?.slice(0, 10);
        const day = start ? Math.round((Date.now() - Date.parse(start + "T00:00:00")) / 86_400_000) + 1 : 1;
        registerProps({ week: pathModel(trackers, entries).week + 1, day, days_answered: countedDays(trackers, entries).length });
      } catch { /* best effort */ }
    })();

    // Returns from background. iOS keeps the WebView alive for hours,
    // so most "I opened MeMap again" moments never hit app_opened.
    // visibilitychange fires in the Capacitor WebView on resume, no
    // extra native plugin needed. Throttled to one event per 10 min so
    // a quick switch to Messages and back doesn't count as a return.
    let lastForegroundAt = Date.now();
    let sessionStart = Date.now();
    const onVisibility = () => {
      // closed or switched away: where she was and how long (her note, Nov 8 2026: "на каком моменте закрыли")
      if (document.visibilityState === "hidden") {
        const seconds = Math.round((Date.now() - sessionStart) / 1000);
        if (seconds >= 2) track("app_left", { screen: currentScreen(), seconds }, true);
        return;
      }
      sessionStart = Date.now();
      noteActive();
      const now = Date.now();
      if (now - lastForegroundAt < 10 * 60 * 1000) return;
      lastForegroundAt = now;
      track("app_foregrounded");
    };
    document.addEventListener("visibilitychange", onVisibility);

    // App Store / Play Store rating prompt — checks all gates (5+ tracked
    // days, or 3 with a seen correlation, and not asked in 120 days) and
    // asks only if eligible. The main call site is the evening done
    // screen in DailySession; this one is the fallback. Safe to call on every cold start: internal logic
    // gates everything. Native OS itself further rate-limits to ~3/year.
    //
    // Defer by 2 seconds so the prompt doesn't pop up over the splash /
    // initial render — feels more "in context" if it appears once the
    // user is actually looking at content.
    const ratingTimer = window.setTimeout(() => {
      maybeRequestRating();
    }, 2000);

    return () => {
      window.removeEventListener("memap-language-changed", refreshSchedule);
      window.removeEventListener("memap-entries-changed", refreshSchedule);
      window.removeEventListener("memap-settings-changed", refreshSchedule);
      document.removeEventListener("visibilitychange", onVisibility);
      notifSubPromise?.then((sub) => sub?.remove()).catch(() => {});
      window.clearTimeout(ratingTimer);
    };
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <BrowserRouter>
            <Routes>
              {/* Old users keep the 1.7.9 screens (src/lib/uiMode.ts) */}
              {/* Classic users get the invite to the new screens once (Aurora, plan §3.8),
                  drawn from here so src/classic stays untouched. */}
              <Route path="/" element={getUiMode() === "classic" ? <><ClassicIndex /><UpgradeInvite /></> : <Index />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
