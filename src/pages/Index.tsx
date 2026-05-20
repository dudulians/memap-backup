import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { TodayTab } from "@/components/TodayTab";
import { PatternsTab } from "@/components/PatternsTab";
import { NotesTab } from "@/components/NotesTab";
import { Layers, TrendingUp, Play, Settings, ArrowUp } from "lucide-react";
import { AddTrackerModal } from "@/components/AddTrackerModal";
import { SettingsModal } from "@/components/SettingsModal";
import { OnboardingTour, shouldShowTour } from "@/components/OnboardingTour";
import {
  CoachmarkTour,
  shouldShowCoachmark,
  hasSeenTourKey,
  type CoachmarkStep,
} from "@/components/CoachmarkTour";
import { applyTheme, getTheme } from "@/lib/theme";
import { haptics } from "@/lib/haptics";
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
  const [coachmarkOpen, setCoachmarkOpen] = useState(false);
  // Patterns sub-tab explainer — separate mini-tour that fires the
  // FIRST time the user navigates to the Patterns tab. Walks through
  // the four sections (Calendar / Trends / Signals / Links) and
  // explains what each one shows. Persisted under its own seenKey so
  // it doesn't share state with the main coachmark.
  const [patternsTourOpen, setPatternsTourOpen] = useState(false);
  const PATTERNS_TOUR_SEEN_KEY = "memap_patterns_tour_seen";

  // Add-tracker modal mini-tour — fires the FIRST time the user opens
  // the "+" modal. Two-step walk: spotlight the Templates tab, then
  // the Custom tab. Same independence model as patternsTour.
  const [addTrackerTourOpen, setAddTrackerTourOpen] = useState(false);
  const ADD_TRACKER_TOUR_SEEN_KEY = "memap_add_tracker_tour_seen";

  // Custom-question mini-tour — fires the FIRST time the user switches
  // to the "Custom" tab inside the Add-Tracker modal. Spotlights the
  // Period and Threshold inputs with brief plain-language explanations
  // since these two numeric fields are the most confusing part of the
  // custom flow for non-technical users.
  const [customTourOpen, setCustomTourOpen] = useState(false);
  const CUSTOM_TOUR_SEEN_KEY = "memap_custom_tour_seen";

  // Drives the soft halo pulse on the floating ▶ Play button when the
  // user has at least one un-answered tracker for today. Stops as soon
  // as the day's session is complete — keeps the button calm once the
  // user has done their daily check-in. Recomputed whenever entries or
  // trackers change so it reacts immediately on the last swipe.
  const [hasUnansweredToday, setHasUnansweredToday] = useState(false);
  useEffect(() => {
    const compute = async () => {
      try {
        const [trackersData, entriesData] = await Promise.all([
          getTrackers(),
          getEntries(),
        ]);
        const active = trackersData.filter((tr) => !tr.archived);
        const now = new Date();
        const today = `${now.getFullYear()}-${String(
          now.getMonth() + 1,
        ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const answeredIds = new Set(
          entriesData
            .filter((e) => e.date === today)
            .map((e) => e.trackerId),
        );
        setHasUnansweredToday(
          active.length > 0 && active.some((tr) => !answeredIds.has(tr.id)),
        );
      } catch (err) {
        // Storage layer can throw under quota / private-mode. The pulse
        // is a nudge, not critical — fail silent and treat as "all done"
        // (i.e. no pulse).
        console.error("[Index] unanswered check failed:", err);
        setHasUnansweredToday(false);
      }
    };
    compute();
    window.addEventListener("memap-entries-changed", compute);
    window.addEventListener("memap-trackers-changed", compute);
    return () => {
      window.removeEventListener("memap-entries-changed", compute);
      window.removeEventListener("memap-trackers-changed", compute);
    };
  }, []);

  // Coachmark steps — each highlights a real UI element by data-attribute.
  // Order is roughly "what you'll do every day" → "deeper features".
  // Coachmark tour reduced from 12 → 5 essential steps in 1.7.2.
  // The 7 deeper tooltips (shuffle, notes, overview-chips,
  // multi-select, signals-tab, trends-tab, links-tab) were
  // friction without payoff — most users dropped off before reaching
  // them. These features are now "discovered at point of use" —
  // the first time a user taps Patterns the sub-tabs are visible
  // and self-explanatory; the random-play 🎲 button is right next
  // to the visible Play; notes-link is next to Add. No tooltip
  // needed for things one tap away from where you already are.
  // Patterns sub-tab mini-tour. Each step targets one of the four
  // section-tab triggers inside PatternsTab (Calendar / Trends /
  // Signals / Links) and uses the existing `requirePatternsSection`
  // mechanism so the tour also activates the matching section as it
  // moves — the user sees the actual section content behind the
  // spotlight, which makes the explanation concrete instead of
  // abstract. Bubbles sit BELOW the tab strip so they don't cover
  // the sub-tab buttons themselves.
  const patternsTourSteps: CoachmarkStep[] = [
    {
      id: "patterns-sub-overview",
      targetSelector: "[data-coachmark='patterns-overview-tab']",
      titleKey: "coachmark.overviewTitle",
      bodyKey: "coachmark.overviewBody",
      requireTab: "patterns",
      requirePatternsSection: "overview",
      placement: "bottom",
      padding: 6,
    },
    {
      id: "patterns-sub-trends",
      targetSelector: "[data-coachmark='patterns-trends-tab']",
      titleKey: "coachmark.trendsTitle",
      bodyKey: "coachmark.trendsBody",
      requireTab: "patterns",
      requirePatternsSection: "trends",
      placement: "bottom",
      padding: 6,
    },
    {
      id: "patterns-sub-signals",
      targetSelector: "[data-coachmark='patterns-signals-tab']",
      titleKey: "coachmark.signalsTitle",
      bodyKey: "coachmark.signalsBody",
      requireTab: "patterns",
      requirePatternsSection: "signals",
      placement: "bottom",
      padding: 6,
    },
    {
      id: "patterns-sub-links",
      targetSelector: "[data-coachmark='patterns-links-tab']",
      titleKey: "coachmark.linksTitle",
      bodyKey: "coachmark.linksBody",
      requireTab: "patterns",
      requirePatternsSection: "links",
      placement: "bottom",
      padding: 6,
    },
  ];

  // Custom-question mini-tour steps. Targets the two numeric input
  // wrappers (Period + Threshold) inside the Custom tab of the
  // Add-Tracker modal. Same z-index pattern as the Add-Tracker tour.
  const customTourSteps: CoachmarkStep[] = [
    {
      id: "custom-tour-period",
      targetSelector: "[data-coachmark='custom-field-period']",
      titleKey: "coachmark.periodTitle",
      bodyKey: "coachmark.periodBody",
      placement: "bottom",
      padding: 6,
    },
    {
      id: "custom-tour-threshold",
      targetSelector: "[data-coachmark='custom-field-threshold']",
      titleKey: "coachmark.thresholdTitle",
      bodyKey: "coachmark.thresholdBody",
      placement: "bottom",
      padding: 6,
    },
  ];

  // Add-tracker mini-tour steps. Targets the two TabsTrigger buttons
  // at the top of AddTrackerModal. The CoachmarkTour overlay sits at
  // z-[200] which is above the modal's z-50 backdrop, so the spotlight
  // cleanly cuts through the modal and reveals the tab below.
  const addTrackerTourSteps: CoachmarkStep[] = [
    {
      id: "add-tour-templates",
      targetSelector: "[data-coachmark='add-tab-templates']",
      titleKey: "coachmark.addTemplatesTitle",
      bodyKey: "coachmark.addTemplatesBody",
      placement: "bottom",
      padding: 6,
    },
    {
      id: "add-tour-custom",
      targetSelector: "[data-coachmark='add-tab-custom']",
      titleKey: "coachmark.addCustomTitle",
      bodyKey: "coachmark.addCustomBody",
      placement: "bottom",
      padding: 6,
    },
  ];

  const coachmarkSteps: CoachmarkStep[] = [
    {
      id: "cards",
      targetSelector: "[data-coachmark='cards-list']",
      titleKey: "coachmark.cardsTitle",
      bodyKey: "coachmark.cardsBody",
      requireTab: "cards",
      placement: "top",
      padding: 4,
    },
    {
      id: "play",
      targetSelector: "[data-coachmark='play-button']",
      titleKey: "coachmark.playTitle",
      bodyKey: "coachmark.playBody",
      shape: "circle",
      placement: "top",
      padding: 8,
    },
    {
      id: "add",
      targetSelector: "[data-coachmark='add-button']",
      titleKey: "coachmark.addTitle",
      bodyKey: "coachmark.addBody",
      placement: "bottom",
      padding: 6,
      requireTab: "cards",
    },
    {
      id: "patterns",
      targetSelector: "[data-coachmark='patterns-tab']",
      titleKey: "coachmark.patternsTitle",
      bodyKey: "coachmark.patternsBody",
      placement: "top",
      padding: 6,
    },
    {
      id: "settings",
      targetSelector: "[data-coachmark='settings-button']",
      titleKey: "coachmark.settingsTitle",
      bodyKey: "coachmark.settingsBody",
      placement: "bottom",
      padding: 6,
    },
  ];

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
    // Cold-launch auto-open of the daily session was removed: it
    // surprised users by jumping into a swipe deck the moment they
    // opened the app. The big ▶ Play button at the bottom of the
    // Cards screen is enough — users tap it when they're ready.
  }, []);

  // First-time Patterns visit → launch the sub-tab mini-tour. Gated
  // so it never fights with the main coachmark or onboarding for
  // attention: tourOpen / coachmarkOpen must both be false. A short
  // delay gives PatternsTab time to mount its sub-tabs before the
  // tour tries to spotlight one.
  useEffect(() => {
    if (activeTab !== "patterns") return;
    if (tourOpen || coachmarkOpen || patternsTourOpen) return;
    if (hasSeenTourKey(PATTERNS_TOUR_SEEN_KEY)) return;
    const t = setTimeout(() => setPatternsTourOpen(true), 450);
    return () => clearTimeout(t);
  }, [activeTab, tourOpen, coachmarkOpen, patternsTourOpen]);

  // First-time "+" modal open → launch the Add-tracker mini-tour.
  // Listens for the rising-edge event TodayTab dispatches. Gated the
  // same way as the Patterns tour — never overlap with the
  // onboarding or other live tours. Slight delay lets the modal
  // mount and animate in before we spotlight its tabs.
  useEffect(() => {
    const handler = () => {
      if (hasSeenTourKey(ADD_TRACKER_TOUR_SEEN_KEY)) return;
      if (tourOpen || coachmarkOpen || patternsTourOpen) return;
      setTimeout(() => setAddTrackerTourOpen(true), 350);
    };
    window.addEventListener("memap-add-modal-opened", handler);
    return () =>
      window.removeEventListener("memap-add-modal-opened", handler);
  }, [tourOpen, coachmarkOpen, patternsTourOpen]);

  // First-time Custom-tab activation inside the "+" modal → launch
  // the Period/Threshold mini-tour. AddTrackerModal dispatches
  // memap-custom-mode-entered on every Custom-tab switch; we gate on
  // the seenKey so it fires AT MOST once. Slight delay lets the
  // form fields render after the tab switch animation.
  useEffect(() => {
    const handler = () => {
      if (hasSeenTourKey(CUSTOM_TOUR_SEEN_KEY)) return;
      if (
        tourOpen ||
        coachmarkOpen ||
        patternsTourOpen ||
        addTrackerTourOpen
      ) {
        return;
      }
      setTimeout(() => setCustomTourOpen(true), 400);
    };
    window.addEventListener("memap-custom-mode-entered", handler);
    return () =>
      window.removeEventListener("memap-custom-mode-entered", handler);
  }, [tourOpen, coachmarkOpen, patternsTourOpen, addTrackerTourOpen]);

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
  // Same treatment for sub-section switches inside Patterns — dispatched
  // by PatternsTab.handleSectionChange. Without this, scrolling deep
  // into Signals and then jumping to Overview leaves the user mid-page.
  useEffect(() => {
    const handler = () => {
      mainRef.current?.scrollTo({ top: 0 });
      setShowBackToTop(false);
    };
    window.addEventListener("memap-scroll-main-top", handler);
    return () => window.removeEventListener("memap-scroll-main-top", handler);
  }, []);
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
      {/* Header — slim, single-line. Brand tagline removed to free
          vertical space; the gear icon stays anchored top-right. */}
      <header className="sticky top-0 z-10 backdrop-blur-lg bg-background/60 border-b border-border/40 px-4 pb-2.5 pt-safe-plus-2">
        <h1 className="text-lg font-serif font-medium text-center tracking-tight text-foreground">
          <span className="italic">Me</span>Map
        </h1>
        <button
          data-coachmark="settings-button"
          onClick={() => setSettingsModalOpen(true)}
          aria-label={t("common.settings")}
          className="absolute right-2 bottom-1.5 h-10 w-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <Settings className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </header>

      {/* Main Content
          `pb` accounts for the floating nav bar at the bottom + the
          Play button which protrudes above it (`-top-6`) + iOS home
          indicator. Without enough padding, the last card on a long
          list got tucked under the Play button. We use a generous
          fixed value (10rem = 160px) plus the device's safe-area so
          devices with a tall home indicator still clear the nav. */}
      <main
        ref={mainRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain max-w-2xl w-full mx-auto px-4 py-4"
        style={{ paddingBottom: "calc(10rem + env(safe-area-inset-bottom, 0px))" }}
      >
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

      {/* Floating back-to-top — appears once the user has scrolled past
          ~300px in any tab. Stacked above the right-aligned "+" FAB
          (which sits at bottom 6.5rem + h-14, so its top is ~10rem)
          so they don't overlap. On tabs without a "+" FAB the arrow
          ends up a bit higher than strictly needed, which is fine. */}
      {showBackToTop && (
        <button
          onClick={scrollMainToTop}
          aria-label="Scroll to top"
          className="fixed right-4 z-20 h-11 w-11 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform animate-fade-in"
          style={{ bottom: "calc(10.5rem + env(safe-area-inset-bottom, 0px))" }}
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
              data-coachmark="play-button"
              onClick={() => {
                // Tactile confirmation that the round is starting.
                // primeHaptics (App.tsx) has already warmed up Core
                // Haptics by the time this runs, so this medium thump
                // fires without the first-tap dud.
                haptics.medium();
                if (activeTab !== "cards") setActiveTab("cards");
                // Defer so TodayTab mounts (when we just swapped tabs)
                // and registers its window listener before we dispatch.
                setTimeout(() => {
                  window.dispatchEvent(new Event("memap-open-session"));
                }, 0);
              }}
              className={`
                w-16 h-16 rounded-full
                bg-gradient-to-br from-primary to-primary/80
                text-primary-foreground
                shadow-lg shadow-primary/30
                flex items-center justify-center
                transition-all duration-300
                hover:scale-110 hover:shadow-xl hover:shadow-primary/40
                active:scale-95
                ${hasUnansweredToday ? "nudge-pulse-halo" : ""}
              `}
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
                flex flex-col items-center justify-center py-2.5 px-2 my-1 ml-1 rounded-[20px] transition-all duration-300
                ${activeTab === "cards" ? "text-foreground bg-muted shadow-sm" : "text-muted-foreground hover:text-foreground"}
              `}
            >
              <Layers className="h-5 w-5 mb-0.5" />
              <span className="text-[10px] font-medium">{t("common.cards")}</span>
            </button>

            {/* Center spacer — the ▶ button is positioned absolutely above. */}
            <div aria-hidden="true" />

            <button
              data-coachmark="patterns-tab"
              onClick={() => { setActiveTab("patterns"); setNotesSourceTab(null); }}
              className={`
                flex flex-col items-center justify-center py-2.5 px-2 my-1 mr-1 rounded-[20px] transition-all duration-300
                ${activeTab === "patterns" ? "text-foreground bg-muted shadow-sm" : "text-muted-foreground hover:text-foreground"}
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
          // After the interview-style onboarding ends, kick off the
          // interactive coachmark tour so the user gets a guided walk
          // through real UI rather than abstract demo screens.
          if (shouldShowCoachmark()) {
            // Land on Cards first so the cards-list target exists.
            setActiveTab("cards");
            setTimeout(() => setCoachmarkOpen(true), 400);
          }
        }}
      />

      {/* Coachmark interactive tour */}
      <CoachmarkTour
        open={coachmarkOpen}
        steps={coachmarkSteps}
        onClose={() => setCoachmarkOpen(false)}
        onRequestTab={(tab) => setActiveTab(tab)}
      />

      {/* Patterns sub-tab mini-tour. Reuses the same CoachmarkTour
          component as the main tour but records its completion under
          its own seenKey, so the two tours fire independently and
          neither one trampling the other's progress. */}
      <CoachmarkTour
        open={patternsTourOpen}
        steps={patternsTourSteps}
        onClose={() => setPatternsTourOpen(false)}
        onRequestTab={(tab) => setActiveTab(tab)}
        seenKey={PATTERNS_TOUR_SEEN_KEY}
      />

      {/* Add-tracker modal mini-tour. Targets are inside the modal;
          the coachmark overlay z-index (200) is above the modal's,
          so the spotlight cleanly cuts through the modal's backdrop
          and the user can read the bubble and tap the highlighted
          tab to switch. */}
      <CoachmarkTour
        open={addTrackerTourOpen}
        steps={addTrackerTourSteps}
        onClose={() => setAddTrackerTourOpen(false)}
        seenKey={ADD_TRACKER_TOUR_SEEN_KEY}
      />

      {/* Custom-question mini-tour. Fires the first time the user
          switches to the Custom tab and explains the Period /
          Threshold numeric inputs that most non-technical users
          can't intuitively decode. */}
      <CoachmarkTour
        open={customTourOpen}
        steps={customTourSteps}
        onClose={() => setCustomTourOpen(false)}
        seenKey={CUSTOM_TOUR_SEEN_KEY}
      />
    </div>
  );
};

export default Index;
