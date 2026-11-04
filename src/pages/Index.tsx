import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { TodayTab } from "@/components/TodayTab";
import { MapTab } from "@/components/MapTab";
import { avatarUrl, getAvatar } from "@/lib/avatar";
import { NotesTab } from "@/components/NotesTab";
import { CalendarDays, CircleUser, ListChecks, Map as MapIcon, Moon, NotebookPen, Sun, ArrowUp } from "lucide-react";
import { AddTrackerModal } from "@/components/AddTrackerModal";
import { SettingsModal } from "@/components/SettingsModal";
import { YouSheet } from "@/components/YouSheet";
import { OnboardingTour, shouldShowTour } from "@/components/OnboardingTour";
import { applyTheme, getTheme, isNight, toggleNight } from "@/lib/theme";
import { haptics } from "@/lib/haptics";
import seaDawn from "@/assets/bg/sea-dawn.webp";
import seaNight from "@/assets/bg/sea-night.webp";
import todaySeaDay from "@/assets/bg/today-sea-day-tile.webp";
import todaySeaNight from "@/assets/bg/today-sea-night-tile.webp";
import skyDay from "@/assets/globe/sky-day.webp";
import skyNight from "@/assets/globe/sky-night.webp";

// "cards" is the Today tab (door hero, tonight's button, the question
// list); Yes/No answers live only in the evening session. Since 1.8.0 the
// bottom bar is Today / Patterns / Notes. Aurora UX (Nov 1 2026): the
// "patterns" tab is now the Map (islands); Patterns open inside an island.
type Tab = "cards" | "patterns" | "questions" | "notes";

const Index = () => {
  const { t } = useTranslation();
  // After "Open my map" (old-user upgrade) the first tab is the Map, once.
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    try {
      const first = localStorage.getItem("memap_open_tab");
      if (first === "patterns") {
        localStorage.removeItem("memap_open_tab");
        return "patterns";
      }
    } catch { /* Today */ }
    return "cards";
  });
  const tabRef = useRef(activeTab);
  tabRef.current = activeTab;
  // Her questions open from the Map (her note, Nov 3 2026: in the tab bar
  // they looked like a place she must visit); Back returns there.
  const [questionsFrom, setQuestionsFrom] = useState<Tab>("patterns");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  // "You": her animal, her questions, Settings, her week and treasures. Opened
  // from a side trip (the session's "See patterns", last week's report), its
  // close takes her back.
  const [youOpen, setYouOpen] = useState(false);
  const youTrip = useRef(false);
  useEffect(() => {
    const open = (e: Event) => { youTrip.current = !!(e as CustomEvent).detail?.trip; setYouOpen(true); };
    window.addEventListener("memap-open-you", open);
    return () => window.removeEventListener("memap-open-you", open);
  }, []);
  const closeYou = (back: boolean) => {
    setYouOpen(false);
    const trip = youTrip.current;
    youTrip.current = false;
    if (trip && back) window.dispatchEvent(new Event("memap-trip-done"));
  };
  const [refreshKey, setRefreshKey] = useState(0);
  const [tourOpen, setTourOpen] = useState(false);
  // Report buttons ask the Map to open a sheet straight away (Findings for
  // all questions) instead of landing on the bare globe.
  const [mapOpen, setMapOpen] = useState<"all" | "overview" | "trends" | "signals" | null>(null);
  // A side trip (her note, Nov 3 2026: "приложение не всегда возвращает туда,
  // откуда пришла"): a step on Today opens the calendar on the Map, or an
  // island's "Answer now" opens its questions on Today. When that sheet or
  // deck closes ("memap-trip-done"), she goes back, to the same island.
  const [trip, setTrip] = useState<{ back: Tab; to: Tab; island?: string } | null>(null);
  const [mapIsland, setMapIsland] = useState<string | null>(null);
  const tripRef = useRef(trip);
  tripRef.current = trip;
  // Night or day (her night pack, Nov 2 2026): a moon/sun in the header.
  // Pictures are picked per theme as the tabs draw, so this re-render is
  // enough; the tabs are not rebuilt, so she stays where she was (her note,
  // Nov 3 2026: the switch threw the globe back to the flat map).
  const [night, setNight] = useState(() => isNight());
  // the Map tab's Map | Globe switch: on the globe her sky runs behind the header too
  const [mapView, setMapView] = useState(() => { try { return localStorage.getItem("memap_map_view") === "globe" ? "globe" : "map"; } catch { return "map"; } });
  useEffect(() => {
    const sync = (e: Event) => setMapView((e as CustomEvent<string>).detail === "globe" ? "globe" : "map");
    window.addEventListener("memap-map-view", sync);
    return () => window.removeEventListener("memap-map-view", sync);
  }, []);
  const onGlobe = activeTab === "patterns" && mapView === "globe";
  // the other theme's backgrounds load ahead, so a switch has them at once
  useEffect(() => {
    const id = window.setTimeout(() => {
      (night ? [todaySeaDay, seaDawn] : [todaySeaNight, seaNight]).forEach((src) => { new Image().src = src; });
    }, 2000);
    return () => window.clearTimeout(id);
  }, [night]);
  useEffect(() => {
    const sync = () => setNight(isNight());
    window.addEventListener("memap-theme-changed", sync);
    return () => window.removeEventListener("memap-theme-changed", sync);
  }, []);
  useEffect(() => {
    applyTheme(getTheme());
    if (shouldShowTour()) {
      setTourOpen(true);
      return;
    }
    // No auto-open of the evening session on cold launch: it surprised
    // people. Today shows one "Answer tonight's N" button instead.
  }, []);

  // Listen for tab-switch events dispatched by deep components (e.g. the
  // DailySession completion screen's "see my patterns" button).
  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent).detail?.tab as Tab | undefined;
      if (tab === "cards" || tab === "patterns" || tab === "questions" || tab === "notes") {
        if (tab === "patterns" && (e as CustomEvent).detail?.open === "all") {
          const section = (e as CustomEvent).detail?.section ?? "findings";
          // her week and treasures live in You: it opens right here
          if (section !== "overview" && section !== "trends" && section !== "signals") {
            youTrip.current = false;
            setYouOpen(true);
            return;
          }
          try { localStorage.setItem("memap_patterns_section", section); } catch { /* ignore */ }
          setMapOpen(section === "overview" || section === "trends" || section === "signals" ? section : "all");
        }
        const from = tabRef.current;
        setTrip((e as CustomEvent).detail?.back && from !== tab ? { back: from, to: tab } : null);
        setActiveTab(tab);
      }
    };
    window.addEventListener("memap-switch-tab", handler);
    // An island's "Answer now": Today opens its questions (TodayTab reads it on mount).
    const answer = (e: Event) => {
      try { sessionStorage.setItem("memap_answer_now", JSON.stringify((e as CustomEvent).detail ?? {})); } catch { /* Today just opens */ }
      const from = tabRef.current;
      setTrip(from !== "cards" ? { back: from, to: "cards", island: (e as CustomEvent).detail?.island } : null);
      setActiveTab("cards");
    };
    window.addEventListener("memap-answer-now", answer);
    // The sheet or deck of a side trip closed: back to where she was.
    const done = () => {
      const tr = tripRef.current;
      if (!tr) return;
      setTrip(null);
      if (tr.back === "patterns" && tr.island) setMapIsland(tr.island);
      setActiveTab(tr.back);
    };
    window.addEventListener("memap-trip-done", done);
    const questions = () => {
      const from = tabRef.current;
      if (from !== "questions") setQuestionsFrom(from);
      setActiveTab("questions");
    };
    window.addEventListener("memap-open-questions", questions);
    return () => {
      window.removeEventListener("memap-open-questions", questions);
      window.removeEventListener("memap-switch-tab", handler);
      window.removeEventListener("memap-answer-now", answer);
      window.removeEventListener("memap-trip-done", done);
    };
  }, []);
  // Anywhere else she goes, the trip is over.
  useEffect(() => {
    if (trip && activeTab !== trip.to && activeTab !== trip.back) setTrip(null);
  }, [activeTab, trip]);

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
  const seaRollRef = useRef<HTMLDivElement>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  // Today's picture scrolls with the path and continues the one behind the
  // header; once she scrolls, the header turns frosted over it.
  const headerRef = useRef<HTMLElement>(null);
  const [headerH, setHeaderH] = useState(56);
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const measure = () => setHeaderH(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const handler = () => { setShowBackToTop(el.scrollTop > 300); };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, []);
  // Today's sea rolls with the path: a transform only (no repaint), within one
  // repeat of the tile (both tiles are 941 × 1538, make-today-sea.mjs).
  useLayoutEffect(() => {
    const el = mainRef.current;
    if (!el || activeTab !== "cards") return;
    let raf = 0;
    const roll = () => {
      raf = 0;
      const sea = seaRollRef.current;
      if (!sea) return;
      const tile = sea.clientWidth * (1538 / 941);
      sea.style.transform = `translate3d(0,${(-(el.scrollTop % tile)).toFixed(1)}px,0)`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(roll); };
    roll();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { el.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(raf); };
  }, [activeTab, night]);
  // Reset scroll + hide the button whenever the active tab changes, so
  // switching tabs always lands the user at the top of the new one. A layout
  // effect, before the first paint; Today then brings her step to the middle
  // (EveningPath, right after this).
  useLayoutEffect(() => {
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

  // Her animal stands in the gear's place and opens You (Settings is inside).
  const [avatar, setAvatarPic] = useState<string | null>(() => avatarUrl(getAvatar()));
  useEffect(() => {
    const sync = () => setAvatarPic(avatarUrl(getAvatar()));
    window.addEventListener("memap-avatar-changed", sync);
    return () => window.removeEventListener("memap-avatar-changed", sync);
  }, []);

  // Content fades in under the header and out behind the floating tab bar.
  // On Today the week banner sticks to the top and covers what scrolls.
  const CONTENT_MASK = activeTab === "cards" || activeTab === "notes" || activeTab === "questions"
    ? "linear-gradient(to bottom, transparent 0, #000 28px, #000 calc(100% - 120px), transparent calc(100% - 24px))"
    : "linear-gradient(to bottom, transparent 0, #000 18px, #000 calc(100% - 120px), transparent calc(100% - 24px))";

  return (
    <div className="h-screen overflow-hidden flex flex-col relative">
      {/* Her sea at dawn behind Today and Notes (Nov 1 2026). Light Aurora
          only (index.css); the Map tab draws its own sea. Fixed: the tab
          content scrolls over it. */}
      {/* Today: her own day/night picture with islands at the edges (Nov 3
          2026), so nothing needs to be scattered on the path. */}
      {onGlobe && <div aria-hidden="true" className={`planet-sky ${night ? "night" : "day"} -z-10`} style={{ backgroundImage: `url(${night ? skyNight : skyDay})` }} />}
      {activeTab !== "patterns" && (
        <div aria-hidden="true" className={`memap-sea-bg pointer-events-none absolute inset-0 -z-10${activeTab === "cards" ? " memap-path-bg" : ""}`}
          style={activeTab === "cards" ? undefined : { backgroundImage: `url(${night ? seaNight : seaDawn})` }}>
          {/* Today: one sea, behind the header too, rolling with the path at
              exactly its speed (her note, Nov 4 2026: a second, still copy
              showed through where the path fades, and the islands doubled). */}
          {activeTab === "cards" && <div ref={seaRollRef} className="memap-sea-roll" style={{ backgroundImage: `url(${night ? todaySeaNight : todaySeaDay})` }} />}
        </div>
      )}
      {/* Header — slim, single-line. Brand tagline removed to free
          vertical space; the gear icon stays anchored top-right. */}
      <header ref={headerRef} className={`sticky top-0 z-10 px-4 pb-2.5 pt-safe-plus-2${activeTab === "patterns" ? " app-head-map" : ""}${onGlobe ? " app-head-clear" : ""}`}>
        {/* Left of the title: Today's flame chip (EveningPath portals it in). */}
        <div id="memap-header-start" className="absolute left-3 bottom-1.5 flex items-center" />
        {/* Today puts "Week N · k/7" here once its week card has rolled away;
            the title gives way (index.css). */}
        <div id="memap-header-center" className="pointer-events-none absolute inset-x-24 bottom-2.5 flex justify-center" />
        <h1 className="text-[17px] font-bold text-center tracking-tight text-foreground">MeMap</h1>
        <button
          type="button"
          onClick={() => { haptics.soft(); toggleNight(); }}
          aria-label={night ? t("common.dayMode") : t("common.nightMode")}
          className="absolute right-12 bottom-1.5 h-10 w-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          {night ? <Sun className="h-5 w-5" strokeWidth={2} /> : <Moon className="h-5 w-5" strokeWidth={2} />}
        </button>
        <button
          data-coachmark="settings-button"
          onClick={() => { haptics.tap(); setYouOpen(true); }}
          aria-label={t("map.you")}
          className="absolute right-2 bottom-1.5 h-10 w-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          {avatar ? <img src={avatar} alt="" className="h-8 w-8 rounded-full object-contain" /> : <CircleUser className="h-6 w-6" strokeWidth={1.75} />}
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
        className={activeTab === "patterns" ? "flex-1 min-h-0 overflow-hidden max-w-2xl w-full mx-auto" : `flex-1 min-h-0 overflow-y-auto overscroll-contain max-w-2xl w-full mx-auto px-4 py-4${activeTab === "cards" ? " snap-y snap-mandatory overflow-x-hidden" : ""}`}
        style={activeTab === "patterns" ? undefined : {
          paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 0px))", maskImage: CONTENT_MASK, WebkitMaskImage: CONTENT_MASK,
          // Today's drum: its middle is between the header and the tab bar
          scrollPaddingBottom: activeTab === "cards" ? "calc(5.25rem + env(safe-area-inset-bottom, 0px))" : undefined,
        }}
      >
        {activeTab === "cards" && (
          <div className="relative">
            {/* her sea is behind main now, rolled by Index (memap-sea-roll) */}
            <TodayTab key={`cards-${refreshKey}`} />
          </div>
        )}
        {activeTab === "questions" && <TodayTab key={`questions-${refreshKey}`} view="questions" onBack={() => setActiveTab(questionsFrom)} />}
        {activeTab === "patterns" && <MapTab key={`patterns-${refreshKey}`} initialOpen={mapOpen} initialIsland={mapIsland} onOpened={() => { setMapOpen(null); setMapIsland(null); }} />}
        {activeTab === "notes" && (
          <NotesTab
            key={`notes-${refreshKey}`}
            targetDate={notesTargetDate}
            onBack={notesSourceTab ? handleNotesBack : undefined}
            backLabel={notesSourceTab === "patterns" ? t("notes.backToPatterns") : notesSourceTab === "cards" ? t("notes.backToToday") : undefined}
          />
        )}
      </main>

      {/* Floating back-to-top — appears once the user has scrolled past
          ~300px in any tab. Stacked above the right-aligned "+" FAB
          (which sits at bottom 6.5rem + h-14, so its top is ~10rem)
          so they don't overlap. On tabs without a "+" FAB the arrow
          ends up a bit higher than strictly needed, which is fine. */}
      {showBackToTop && activeTab !== "cards" && (
        <button
          onClick={scrollMainToTop}
          aria-label="Scroll to top"
          className="fixed right-4 z-20 h-11 w-11 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform animate-fade-in"
          style={{ bottom: "calc(6.5rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}

      {/* Floating Bottom Navigation. New product direction: the daily
          session is the primary action, so the center button is a giant
          ▶ Play that opens the session. Cards & Patterns are the side
          surfaces. Settings moved to the header cog. */}
      {/* Bottom navigation (1.8.0): three plain labelled tabs. The big
          unlabeled ▶ in the middle is gone; the evening session now
          starts from the "Answer tonight's N" button on Today, and
          notification taps still open it directly (App.tsx). */}
      <nav className="fixed bottom-0 left-0 right-0 z-10 pb-safe">
        <div className="max-w-2xl mx-auto px-4">
          <div className="nav-floating grid grid-cols-3 overflow-hidden">
            {([
              { tab: "cards", icon: CalendarDays, label: t("common.today") },
              { tab: "patterns", icon: MapIcon, label: t("common.map") },
              { tab: "notes", icon: NotebookPen, label: t("common.notes") },
            ] as const).map(({ tab, icon: Icon, label }) => (
              <button
                key={tab}
                data-coachmark={tab === "patterns" ? "patterns-tab" : undefined}
                onClick={() => {
                  haptics.tap();
                  setTrip(null);
                  setActiveTab(tab);
                  setNotesSourceTab(null);
                  setNotesTargetDate(undefined);
                }}
                aria-current={(activeTab === "questions" ? questionsFrom : activeTab) === tab ? "page" : undefined}
                className={`
                  flex flex-col items-center justify-center py-2.5 px-2 m-1 rounded-[20px] transition-all duration-300 active:scale-90
                  ${(activeTab === "questions" ? questionsFrom : activeTab) === tab ? "text-foreground bg-muted shadow-sm" : "text-muted-foreground hover:text-foreground"}
                `}
              >
                <Icon className="h-5 w-5 mb-0.5" />
                <span className="text-[11px] font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Add Tracker Modal */}
      <AddTrackerModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onTrackerAdded={handleTrackerAdded}
      />

      <YouSheet open={youOpen} onClose={() => closeYou(true)}
        onQuestions={() => { closeYou(false); window.dispatchEvent(new Event("memap-open-questions")); }}
        onSettings={() => { closeYou(false); window.setTimeout(() => setSettingsModalOpen(true), 250); }} />

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
          // No coach tour after onboarding (1.8.0): the door path makes a
          // first real entry instead, and the screens explain themselves.
          setActiveTab("cards");
        }}
      />

    </div>
  );
};

export default Index;
