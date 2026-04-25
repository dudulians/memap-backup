import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { TodayTab } from "@/components/TodayTab";
import { PatternsTab } from "@/components/PatternsTab";
import { NotesTab } from "@/components/NotesTab";
import { Layers, TrendingUp, Play, Settings, ArrowUp } from "lucide-react";
import { AddTrackerModal } from "@/components/AddTrackerModal";
import { SettingsModal } from "@/components/SettingsModal";
import { OnboardingTour, shouldShowTour } from "@/components/OnboardingTour";
import { applyTheme, getTheme } from "@/lib/theme";
import { getTrackers, getEntries } from "@/lib/storage";

// "today" tab is renamed conceptually to "cards" — it's now the trackers
// management view, no Yes/No inputs (those live exclusively in the session).
// "notes" is no longer in bottom nav but still routable so Cards/Patterns
// can link into it.
type Tab = "cards" | "patterns" | "notes";

const Index = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>("cards");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    applyTheme(getTheme());
    if (shouldShowTour()) {
      setTourOpen(true);
      return;
    }
    // Cold-launch: if there are unanswered questions for today, auto-open
    // the daily session as the home screen. This is the new product
    // direction — the session is the core flow, the lists/patterns are
    // secondary surfaces. We dispatch an event after a tiny delay so
    // TodayTab is mounted and listening.
    (async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const [trackers, entries] = await Promise.all([
          getTrackers(),
          getEntries(),
        ]);
        const active = trackers.filter((tr) => !tr.archived);
        if (active.length === 0) return;
        const answeredIds = new Set(
          entries.filter((e) => e.date === today).map((e) => e.trackerId)
        );
        const hasUnanswered = active.some((tr) => !answeredIds.has(tr.id));
        if (!hasUnanswered) return;
        // Defer to next tick so TodayTab's mount-time event listener is up.
        setTimeout(() => {
          window.dispatchEvent(new Event("memap-open-session"));
        }, 0);
      } catch {
        // best-effort — never block app start
      }
    })();
  }, []);

  // Listen for tab-switch events dispatched by deep components (e.g. the
  // DailySession completion screen's "see my patterns" button).
  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent).detail?.tab as Tab | undefined;
      if (tab === "today" || tab === "patterns" || tab === "notes") {
        setActiveTab(tab);
      }
    };
    window.addEventListener("memap-switch-tab", handler);
    return () => window.removeEventListener("memap-switch-tab", handler);
  }, []);

  const [notesTargetDate, setNotesTargetDate] = useState<string | undefined>();
  const [notesSourceTab, setNotesSourceTab] = useState<Tab | null>(null);
  // When set, the user came to Notes from the play-round Done screen.
  // Notes back button should re-open the play session, not return to the
  // Cards tab. Cleared once the back is taken.
  const [notesFromPlay, setNotesFromPlay] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { date?: string; from?: string } | undefined;
      const date = detail?.date;
      setNotesTargetDate(date);
      setNotesSourceTab((prev) => prev ?? (activeTab !== "notes" ? activeTab : null));
      setNotesFromPlay(detail?.from === "play");
      setActiveTab("notes");
    };
    const cardsHandler = () => setActiveTab("cards");
    window.addEventListener("memap-open-notes", handler);
    window.addEventListener("memap-open-cards", cardsHandler);
    return () => {
      window.removeEventListener("memap-open-notes", handler);
      window.removeEventListener("memap-open-cards", cardsHandler);
    };
  }, [activeTab]);

  const handleNotesBack = () => {
    const target = notesSourceTab ?? "cards";
    const wasPlay = notesFromPlay;
    setNotesSourceTab(null);
    setNotesTargetDate(undefined);
    setNotesFromPlay(false);
    // If the user came from a play round, re-open the play session
    // instead of dropping them on the Cards tab.
    if (wasPlay) {
      setActiveTab("cards");
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("memap-open-session", { detail: { play: true } }));
      }, 0);
      return;
    }
    setActiveTab(target);
  };

  // Floating back-to-top button. One implementation on <main> covers
  // every tab (Today / Patterns / Notes) — each tab is a tall-scrolling
  // list and the user asked for a consistent return-to-top affordance.
  const mainRef = useRef<HTMLElement>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const handler = () => setShowBackToTop(el.scrollTop > 300);
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, []);
  // Reset scroll + hide the button whenever the active tab changes, so
  // switching tabs always lands the user at the top of the new one.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    setShowBackToTop(false);
  }, [activeTab]);
  const scrollMainToTop = () => {
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleTrackerAdded = () => {
    // Refresh the map, but keep the Add Tracker modal open so the user
    // can add multiple trackers in one go. They close it explicitly
    // via the X button, swipe-down, or backdrop tap.
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col relative">
      {/* Header - subtle and elegant. Settings cog moved to top-right
          since it's a rare-use destination — frees up bottom-nav for
          the three primary surfaces (Cards, Session, Patterns). */}
      <header className="sticky top-0 z-10 backdrop-blur-lg bg-background/60 border-b border-border/40 px-4 py-4">
        <h1 className="text-2xl font-serif font-medium text-center tracking-tight text-foreground">
          <span className="italic">Me</span>Map
        </h1>
        <p className="text-[10px] text-center text-muted-foreground tracking-[0.2em] uppercase mt-0.5">
          track · notice · act
        </p>
        <button
          onClick={() => setSettingsModalOpen(true)}
          aria-label={t("common.settings")}
          className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <Settings className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </header>

      {/* Main Content */}
      <main ref={mainRef} className="flex-1 min-h-0 overflow-y-auto max-w-2xl w-full mx-auto px-4 py-6 pb-40">
        {activeTab === "cards" && <TodayTab key={`cards-${refreshKey}`} />}
        {activeTab === "patterns" && <PatternsTab key={`patterns-${refreshKey}`} />}
        {activeTab === "notes" && (
          <NotesTab
            key={`notes-${refreshKey}`}
            targetDate={notesTargetDate}
            onBack={notesSourceTab ? handleNotesBack : undefined}
            backLabel={notesSourceTab === "patterns" ? t("notes.backToPatterns") : notesSourceTab === "today" ? t("notes.backToToday") : undefined}
          />
        )}
      </main>

      {/* Floating back-to-top — sits above the bottom nav, flush right so
          it never overlaps the center "+" button. Appears once the user
          has scrolled past ~300px in any tab. */}
      {showBackToTop && (
        <button
          onClick={scrollMainToTop}
          aria-label="Scroll to top"
          className="fixed right-4 z-20 h-11 w-11 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform animate-fade-in"
          style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}

      {/* Floating Bottom Navigation. New product direction: the daily
          session is the primary action, so the center button is a giant
          ▶ Play that opens the session. Cards & Patterns are the side
          surfaces. Settings moved to the header cog. */}
      <nav className="fixed bottom-0 left-0 right-0 z-10 pb-safe">
        <div className="max-w-2xl mx-auto px-4">
          {/* Center floating ▶ Play button — opens the session via event
              so TodayTab (which owns DailySession) can react. If the user
              is on Patterns/Notes the TodayTab is unmounted and won't hear
              the event, so first we swap to Cards then dispatch on the
              next tick once TodayTab's listener has attached. */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-6 z-20">
            <button
              onClick={() => {
                if (activeTab !== "cards") setActiveTab("cards");
                // Defer so TodayTab mounts (when we just swapped tabs)
                // and registers its window listener before we dispatch.
                setTimeout(() => {
                  window.dispatchEvent(new Event("memap-open-session"));
                }, 0);
              }}
              className="
                w-16 h-16 rounded-full
                bg-gradient-to-br from-primary to-primary/80
                text-primary-foreground
                shadow-lg shadow-primary/30
                flex items-center justify-center
                transition-all duration-300
                hover:scale-110 hover:shadow-xl hover:shadow-primary/40
                active:scale-95
              "
              aria-label={t("common.startSession")}
            >
              <Play className="h-7 w-7 ml-0.5" strokeWidth={2} fill="currentColor" />
            </button>
          </div>

          {/* 2 sides — Cards on the left, Patterns on the right. The
              center column is a placeholder for the floating ▶. */}
          <div className="nav-floating grid grid-cols-3 overflow-hidden">
            <button
              onClick={() => { setActiveTab("cards"); setNotesSourceTab(null); }}
              className={`
                flex flex-col items-center justify-center py-3 px-2 transition-all duration-300 rounded-xl mx-1
                ${activeTab === "cards" ? "text-foreground bg-muted" : "text-muted-foreground hover:text-foreground"}
              `}
            >
              <Layers className="h-5 w-5 mb-0.5" />
              <span className="text-[10px] font-medium">{t("common.cards")}</span>
            </button>

            {/* Center spacer — the ▶ button is positioned absolutely above. */}
            <div aria-hidden="true" />

            <button
              onClick={() => { setActiveTab("patterns"); setNotesSourceTab(null); }}
              className={`
                flex flex-col items-center justify-center py-3 px-2 transition-all duration-300 rounded-xl mx-1
                ${activeTab === "patterns" ? "text-foreground bg-muted" : "text-muted-foreground hover:text-foreground"}
              `}
            >
              <TrendingUp className="h-5 w-5 mb-0.5" />
              <span className="text-[10px] font-medium">{t("common.patterns")}</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Add Tracker Modal */}
      <AddTrackerModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onTrackerAdded={handleTrackerAdded}
      />

      {/* Settings Modal */}
      <SettingsModal
        open={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        onStartTour={() => {
          setSettingsModalOpen(false);
          setTourOpen(true);
        }}
      />

      {/* Onboarding Tour */}
      <OnboardingTour
        open={tourOpen}
        onClose={() => {
          setTourOpen(false);
          setRefreshKey((k) => k + 1);
        }}
      />
    </div>
  );
};

export default Index;
