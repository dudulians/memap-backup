import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { TodayTab } from "@/components/TodayTab";
import { PatternsTab } from "@/components/PatternsTab";
import { NotesTab } from "@/components/NotesTab";
import { Home, TrendingUp, Plus, BookOpen, Settings, ArrowUp } from "lucide-react";
import { AddTrackerModal } from "@/components/AddTrackerModal";
import { SettingsModal } from "@/components/SettingsModal";
import { OnboardingTour, shouldShowTour } from "@/components/OnboardingTour";
import { applyTheme, getTheme } from "@/lib/theme";

type Tab = "today" | "patterns" | "notes";

const Index = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>("today");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    applyTheme(getTheme());
    if (shouldShowTour()) {
      setTourOpen(true);
    }
  }, []);

  const [notesTargetDate, setNotesTargetDate] = useState<string | undefined>();
  const [notesSourceTab, setNotesSourceTab] = useState<Tab | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const date = (e as CustomEvent).detail?.date as string | undefined;
      setNotesTargetDate(date);
      setNotesSourceTab((prev) => prev ?? (activeTab !== "notes" ? activeTab : null));
      setActiveTab("notes");
    };
    window.addEventListener("memap-open-notes", handler);
    return () => window.removeEventListener("memap-open-notes", handler);
  }, [activeTab]);

  const handleNotesBack = () => {
    const target = notesSourceTab ?? "patterns";
    setNotesSourceTab(null);
    setNotesTargetDate(undefined);
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
      {/* Header - subtle and elegant */}
      <header className="sticky top-0 z-10 backdrop-blur-lg bg-background/60 border-b border-border/40 px-4 py-4">
        <h1 className="text-2xl font-serif font-medium text-center tracking-tight text-foreground">
          <span className="italic">Me</span>Map
        </h1>
        <p className="text-[10px] text-center text-muted-foreground tracking-[0.2em] uppercase mt-0.5">
          track · notice · act
        </p>
      </header>

      {/* Main Content */}
      <main ref={mainRef} className="flex-1 min-h-0 overflow-y-auto max-w-2xl w-full mx-auto px-4 py-6 pb-40">
        {activeTab === "today" && <TodayTab key={`today-${refreshKey}`} />}
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

      {/* Floating Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-10 pb-safe">
        <div className="max-w-2xl mx-auto px-4">
          {/* Center floating + button */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-6 z-20">
            <button
              onClick={() => setAddModalOpen(true)}
              className="
                w-14 h-14 rounded-full 
                bg-gradient-to-br from-primary to-primary/80
                text-primary-foreground
                shadow-lg shadow-primary/30
                flex items-center justify-center
                transition-all duration-300
                hover:scale-110 hover:shadow-xl hover:shadow-primary/40
                active:scale-95
              "
              aria-label="Add new pattern"
            >
              <Plus className="h-7 w-7" strokeWidth={2.5} />
            </button>
          </div>

          {/* Navigation bar - 4 items with space in middle for + button */}
          <div className="nav-floating grid grid-cols-4 overflow-hidden">
            {/* Today tab */}
            <button
              onClick={() => { setActiveTab("today"); setNotesSourceTab(null); }}
              className={`
                flex flex-col items-center justify-center py-3 px-2 transition-all duration-300 rounded-xl mx-1
                ${activeTab === "today" ? "text-foreground bg-muted" : "text-muted-foreground hover:text-foreground"}
              `}
            >
              <Home className="h-5 w-5 mb-0.5" />
              <span className="text-[10px] font-medium">{t("common.today")}</span>
            </button>

            {/* Patterns tab */}
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

            {/* Notes tab */}
            <button
              onClick={() => { setActiveTab("notes"); setNotesSourceTab(null); }}
              className={`
                flex flex-col items-center justify-center py-3 px-2 transition-all duration-300 rounded-xl mx-1
                ${activeTab === "notes" ? "text-foreground bg-muted" : "text-muted-foreground hover:text-foreground"}
              `}
            >
              <BookOpen className="h-5 w-5 mb-0.5" />
              <span className="text-[10px] font-medium">{t("common.notes")}</span>
            </button>

            {/* Settings — opens modal, not a tab */}
            <button
              onClick={() => setSettingsModalOpen(true)}
              className="flex flex-col items-center justify-center py-3 px-2 transition-all duration-300 text-muted-foreground/60 hover:text-muted-foreground border-l border-border/40"
            >
              <Settings className="h-4 w-4 mb-0.5" />
              <span className="text-[10px]">{t("common.settings")}</span>
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
