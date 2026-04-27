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
import { ErrorBoundary } from "@/components/ErrorBoundary";

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

    // Re-schedule when the UI language changes — iOS stores the
    // localized title/body literally with each pending notification,
    // so without rescheduling a user who switches RU→EN would still
    // see Russian text on their lock screen for the next 7 days.
    window.addEventListener("memap-language-changed", refreshSchedule);

    // Attach AudioContext unlock handlers so the first swipe-sound after
    // a cold app launch actually plays. Mobile browsers & Capacitor
    // WebView block audio until a user gesture.
    primeAudio();

    return () => {
      window.removeEventListener("memap-language-changed", refreshSchedule);
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
