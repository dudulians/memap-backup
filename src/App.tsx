import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { getNotificationSettings, scheduleNotification } from "@/lib/notifications";
import { primeAudio } from "@/lib/feedback";
import { runStartupMigrations } from "@/lib/storage";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { maybeRequestRating } from "@/lib/appRating";

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
        () => {
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

    // App Store / Play Store rating prompt — checks all gates (5+ tracked
    // days AND seen a correlation AND not asked in 120 days) and asks
    // only if eligible. Safe to call on every cold start: internal logic
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
      notifSubPromise?.then((sub) => sub?.remove()).catch(() => {});
      window.clearTimeout(ratingTimer);
    };
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
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
