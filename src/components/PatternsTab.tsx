import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Tracker, TrackerEntry, ReflectionCycle } from "@/types/tracker";
import { getTrackers, getEntries, saveEntries, saveTrackers } from "@/lib/storage";
import { clearThresholdNotification } from "@/lib/notifications";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCategoryColor, getTrackerIcon } from "@/lib/categoryHelpers";
import { Lightbulb, AlertTriangle, ChevronRight, CalendarDays, Target, LineChart, GitCompare } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { OverviewCard } from "./OverviewCard";
import { TrendChart } from "./TrendChart";
import { CorrelationInsights } from "./CorrelationInsights";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { TrackerDetails } from "./TrackerDetails";
import { CalendarAnswerEditor } from "./CalendarAnswerEditor";
import { ReflectionSheet } from "./ReflectionSheet";
import { uuid } from "@/lib/uuid";
import { localizeTrackerTitle, localizeTrackerAdvice, localizeTrackerQuestion, localizeTrackerTheme } from "@/lib/trackerLocalize";

export const PatternsTab = () => {
  const { t } = useTranslation();
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  // For tracker details sheet
  const [selectedTrackerForDetails, setSelectedTrackerForDetails] = useState<Tracker | null>(null);
  const [selectedTrackerIndex, setSelectedTrackerIndex] = useState<number>(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => 
    new Date().toISOString().split("T")[0]
  );

  // For reflection sheet
  const [reflectionSheetTracker, setReflectionSheetTracker] = useState<Tracker | null>(null);

  // For calendar answer editor
  const [answerEditorOpen, setAnswerEditorOpen] = useState(false);
  const [editingTracker, setEditingTracker] = useState<Tracker | null>(null);
  const [editingDate, setEditingDate] = useState<string>("");
  const [editingEntry, setEditingEntry] = useState<TrackerEntry | undefined>(undefined);

  // Section tab: persisted across session reloads so the user lands back where
  // they were, not on the first tab every time.
  const SECTIONS = ["overview", "signals", "trends", "links"] as const;
  type Section = typeof SECTIONS[number];
  const [section, setSection] = useState<Section>(() => {
    try {
      const stored = localStorage.getItem("memap_patterns_section") as Section | null;
      if (stored && SECTIONS.includes(stored)) return stored;
    } catch { /* ignore */ }
    return "overview";
  });
  const handleSectionChange = (value: string) => {
    if (!SECTIONS.includes(value as Section)) return;
    setSection(value as Section);
    try { localStorage.setItem("memap_patterns_section", value); } catch { /* ignore */ }
    // Tell the parent <main> scroller to jump back to the top — without
    // this, switching from a deep-scrolled Signals to Overview drops the
    // user mid-calendar instead of showing the new section's top.
    window.dispatchEvent(new Event("memap-scroll-main-top"));
  };

  // When user taps a correlation card on the Connections tab, we hop to
  // the Trends tab with the pair pre-selected. The array reference is
  // fresh every tap (never reused) so TrendChart's useEffect-based
  // pre-filter re-applies even when the same pair is tapped again after
  // the user manually fiddled with the legend.
  const [trendsPrefilter, setTrendsPrefilter] = useState<string[] | undefined>(undefined);
  const handleSelectCorrelationPair = (ids: [string, string]) => {
    setTrendsPrefilter([...ids]);
    handleSectionChange("trends");
  };

  // Embla swipe-between-sections was removed. With all four heavy
  // sections (Calendar, tracker list, chart, correlations) mounted
  // simultaneously, iOS WebView under Capacitor couldn't keep up
  // with finger-driven translation — the swipe felt jerky no matter
  // how many tweaks we tried. The sections are now back to
  // tap-only navigation via Radix Tabs (only the active tab mounts),
  // which is rock-solid: zero jank, instant section change.
  // Re-attempt swipe later via lazy-mounted slides if the gesture
  // turns out to matter that much.

  useEffect(() => {
    loadData();
  }, []);

  // Re-pull when storage changes elsewhere (Settings → restore backup,
  // dev data generator, calendar editor, undo, Today tab swipes...).
  // Without this listener, the dev data generator would write 60×N
  // new entries while Patterns sits with its stale snapshot — no
  // trends, no correlations, no signs anything happened. Same event
  // other write paths dispatch.
  useEffect(() => {
    const sync = () => { loadData(); };
    window.addEventListener("memap-settings-changed", sync);
    return () => window.removeEventListener("memap-settings-changed", sync);
  }, []);

  // Listen for external section-switch requests (e.g. from the
  // coachmark tour driving a step that lives on a specific sub-tab).
  useEffect(() => {
    const handler = (e: Event) => {
      const next = (e as CustomEvent).detail?.section as string | undefined;
      if (next === "overview" || next === "signals" || next === "trends" || next === "links") {
        setSection(next);
        try { localStorage.setItem("memap_patterns_section", next); } catch { /* ignore */ }
      }
    };
    window.addEventListener("memap-patterns-section", handler);
    return () => window.removeEventListener("memap-patterns-section", handler);
  }, []);

  const loadData = async () => {
    const [trackersData, entriesData] = await Promise.all([
      getTrackers(),
      getEntries(),
    ]);
    setTrackers(trackersData);
    setEntries(entriesData);
    setLoading(false);
  };

  const getTrackerStats = (tracker: Tracker) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rollingStart = new Date(today);
    rollingStart.setDate(today.getDate() - tracker.periodDays);

    const cycleStart = tracker.cycleStartDate
      ? new Date(tracker.cycleStartDate + "T00:00:00")
      : null;

    const windowStart = cycleStart && cycleStart > rollingStart ? cycleStart : rollingStart;

    const relevantEntries = entries.filter((e) => {
      if (e.trackerId !== tracker.id) return false;
      const entryDate = new Date(e.date + "T00:00:00");
      return entryDate >= windowStart && entryDate <= today;
    });

    const answerDays = relevantEntries.length;
    const significantDays = relevantEntries.filter((e) =>
      tracker.problemWhen === "yes" ? e.value : !e.value
    ).length;

    let status: "balanced" | "emerging" | "strong" = "balanced";
    if (significantDays >= tracker.threshold) {
      status = "strong";
    } else if (significantDays >= tracker.threshold * 0.5) {
      status = "emerging";
    }

    return { answerDays, significantDays, status, windowStart, windowEnd: today };
  };

  const handleOpenTrackerDetails = (tracker: Tracker) => {
    const index = trackers.findIndex(t => t.id === tracker.id);
    setSelectedTrackerForDetails(tracker);
    setSelectedTrackerIndex(index >= 0 ? index : 0);
    setSheetOpen(true);
  };

  const handleNavigateTracker = (direction: "prev" | "next") => {
    let newIndex = selectedTrackerIndex;
    if (direction === "prev" && selectedTrackerIndex > 0) {
      newIndex = selectedTrackerIndex - 1;
    } else if (direction === "next" && selectedTrackerIndex < trackers.length - 1) {
      newIndex = selectedTrackerIndex + 1;
    }
    setSelectedTrackerIndex(newIndex);
    setSelectedTrackerForDetails(trackers[newIndex]);
  };

  // Handle day click to open answer editor
  const handleDayEdit = (tracker: Tracker, date: string, existingEntry?: TrackerEntry) => {
    setEditingTracker(tracker);
    setEditingDate(date);
    setEditingEntry(existingEntry);
    setAnswerEditorOpen(true);
  };

  // Clear an answer for a specific tracker on a specific date.
  // Used by the calendar editor's "Clear answer" button — turns an
  // accidentally-marked day back into "untracked" so notifications
  // and calendar dots reflect reality.
  const handleClearAnswer = async (trackerId: string, date: string) => {
    const updatedEntries = entries.filter(
      (e) => !(e.trackerId === trackerId && e.date === date),
    );
    setEntries(updatedEntries);
    await saveEntries(updatedEntries);
  };

  // Save answer from calendar editor
  const handleSaveAnswer = async (trackerId: string, date: string, value: boolean) => {
    const existingEntry = entries.find(
      (e) => e.trackerId === trackerId && e.date === date
    );

    if (existingEntry) {
      const updatedEntries = entries.map((e) =>
        e.id === existingEntry.id ? { ...e, value } : e
      );
      setEntries(updatedEntries);
      await saveEntries(updatedEntries);
    } else {
      const newEntry: TrackerEntry = {
        id: uuid(),
        trackerId,
        date,
        value,
      };
      const updatedEntries = [...entries, newEntry];
      setEntries(updatedEntries);
      await saveEntries(updatedEntries);
    }
  };

  // Handle bulk answer for multiple dates
  const handleBulkAnswer = async (trackerId: string, dates: string[], value: boolean | null) => {
    let updatedEntries = [...entries];
    
    for (const date of dates) {
      const existingIndex = updatedEntries.findIndex(
        (e) => e.trackerId === trackerId && e.date === date
      );

      if (value === null) {
        // Clear the answer
        if (existingIndex !== -1) {
          updatedEntries = updatedEntries.filter((_, i) => i !== existingIndex);
        }
      } else if (existingIndex !== -1) {
        // Update existing
        updatedEntries[existingIndex] = { ...updatedEntries[existingIndex], value };
      } else {
        // Add new
        updatedEntries.push({
          id: uuid(),
          trackerId,
          date,
          value,
        });
      }
    }
    
    setEntries(updatedEntries);
    await saveEntries(updatedEntries);
  };

  const handleStartNewCycle = async (
    tracker: Tracker,
    stats: { significantDays: number; answerDays: number }
  ) => {
    const today = new Date().toISOString().split("T")[0];

    const cycleStart = tracker.cycleStartDate
      ?? tracker.createdAt.split("T")[0];

    const newCycle: ReflectionCycle = {
      id: uuid(),
      startDate: cycleStart,
      endDate: today,
      periodDays: tracker.periodDays,
      threshold: tracker.threshold,
      significantDays: stats.significantDays,
      totalTrackedDays: stats.answerDays,
    };

    const updatedTracker: Tracker = {
      ...tracker,
      cycleStartDate: today,
      cycles: [...(tracker.cycles ?? []), newCycle],
    };

    const updatedTrackers = trackers.map((t) =>
      t.id === tracker.id ? updatedTracker : t
    );
    setTrackers(updatedTrackers);
    await saveTrackers(updatedTrackers);
    clearThresholdNotification(tracker.id);
    setReflectionSheetTracker(updatedTracker);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (trackers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center space-y-2">
        <p className="text-2xl font-medium">{t("patterns.title")}</p>
        <p className="text-sm text-muted-foreground max-w-md">
          {t("patterns.emptyHint")}
        </p>
      </div>
    );
  }

  // Rank so strong/action-signal patterns float to the top when the user
  // opens the Signals tab. Within each tier, preserve the user's tracker
  // order (which reflects their own sortIndex).
  const statusRank: Record<"strong" | "emerging" | "balanced", number> = {
    strong: 0,
    emerging: 1,
    balanced: 2,
  };
  const sortedTrackers = [...trackers].sort((a, b) => {
    const sa = getTrackerStats(a).status;
    const sb = getTrackerStats(b).status;
    return statusRank[sa] - statusRank[sb];
  });

  const strongCount = trackers.filter((t) => getTrackerStats(t).status === "strong").length;

  return (
    <div className="space-y-3">
      {/* No title row here — the tab bar is the heading. Tracker count
          shown subtly inside the tabs strip (right side) so there's no
          dedicated header row eating vertical space. */}

      {/* Section tabs — turns the old long scroll into 4 destinations,
          each one screen-sized. The tab list stays sticky under the app
          header so long tracker lists don't hide the nav. */}
      <Tabs value={section} onValueChange={handleSectionChange} className="w-full">
        <div className="sticky top-0 z-30 -mx-4 px-4 py-1.5 bg-background/95 backdrop-blur-md border-b border-border/40 shadow-sm">
          {/* Underline-style tabs — no outer container pill, no inner
              pill. Active state is just bolder text + a thin
              underline. Eliminates the "pill in pill" geometry problem
              entirely (no curves to mismatch). Apple uses this style on
              iOS Settings, App Store category headers, etc. */}
          {/* Tab order: Overview → Trends → Signals → Links.
              Trends moved up to 2nd position per user request — for
              her, the day-by-day visual story is more frequently
              checked than the at-a-time signals snapshot. */}
          <TabsList className="w-full grid grid-cols-4 h-auto p-0 bg-transparent rounded-none gap-0">
            <TabsTrigger
              value="overview"
              data-coachmark="patterns-overview-tab"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:font-semibold flex flex-col gap-0.5 py-2 h-auto text-muted-foreground data-[state=active]:text-foreground"
            >
              <CalendarDays className="h-4 w-4" strokeWidth={1.75} />
              <span className="text-[10px] font-medium">{t("patterns.tabOverview")}</span>
            </TabsTrigger>
            <TabsTrigger
              value="trends"
              data-coachmark="patterns-trends-tab"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:font-semibold flex flex-col gap-0.5 py-2 h-auto text-muted-foreground data-[state=active]:text-foreground"
            >
              <LineChart className="h-4 w-4" strokeWidth={1.75} />
              <span className="text-[10px] font-medium">{t("patterns.tabTrends")}</span>
            </TabsTrigger>
            <TabsTrigger
              value="signals"
              data-coachmark="patterns-signals-tab"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:font-semibold flex flex-col gap-0.5 py-2 h-auto text-muted-foreground data-[state=active]:text-foreground relative"
            >
              <Target className="h-4 w-4" strokeWidth={1.75} />
              <span className="text-[10px] font-medium">{t("patterns.tabSignals")}</span>
              {strongCount > 0 && (
                <span className={cn(
                  "absolute top-0 right-1 h-4 min-w-4 px-1 rounded-full text-[9px] font-semibold flex items-center justify-center",
                  "bg-strong text-strong-foreground"
                )}>
                  {strongCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="links"
              data-coachmark="patterns-links-tab"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:font-semibold flex flex-col gap-0.5 py-2 h-auto text-muted-foreground data-[state=active]:text-foreground"
            >
              <GitCompare className="h-4 w-4" strokeWidth={1.75} />
              <span className="text-[10px] font-medium">{t("patterns.tabLinks")}</span>
            </TabsTrigger>
          </TabsList>
        </div>
      </Tabs>

      {/* Section content — only the active section mounts (no
          carousel mounting all four at once). Tap a tab above to
          switch. Each section gets its own animate-fade-in for a
          subtle entrance without the carousel-mounting cost. */}
      <div className="mt-4">
        {section === "overview" && (
          <div className="animate-fade-in">
            <OverviewCard
              trackers={trackers}
              entries={entries}
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
              onTrackerSelect={handleOpenTrackerDetails}
              onDayEdit={handleDayEdit}
              onBulkAnswer={handleBulkAnswer}
            />
          </div>
        )}

        {/* --- SIGNALS: the pattern/action cards, strong first ------ */}
        {section === "signals" && (
          <div className="animate-fade-in">
            <div className="space-y-4">
        {sortedTrackers.map((tracker) => {
          const stats = getTrackerStats(tracker);
          const categoryColor = getCategoryColor(tracker.category);
          const Icon = getTrackerIcon(tracker.title, tracker.category);

          const thresholdPct = Math.min(
            Math.round((stats.significantDays / tracker.threshold) * 100),
            100
          );
          const daysLeft = Math.max(tracker.threshold - stats.significantDays, 0);
          const barGradient =
            thresholdPct >= 80
              ? "linear-gradient(90deg, hsl(var(--emerging)), hsl(var(--strong)))"
              : thresholdPct >= 50
              ? "linear-gradient(90deg, hsl(var(--balanced)), hsl(var(--emerging)))"
              : `linear-gradient(90deg, hsl(var(--${categoryColor})), hsl(var(--${categoryColor}-secondary)))`;

          return (
            <Card
              key={tracker.id}
              className="card-premium breathing-space animate-fade-in cursor-pointer active:scale-[0.99] transition-transform"
              onClick={() => setReflectionSheetTracker(tracker)}
            >
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div
                      data-tracker-icon
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `hsl(var(--${categoryColor}) / 0.22)` }}
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.75} style={{ color: "hsl(var(--foreground))" }} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-base">{localizeTrackerTitle(tracker.title)}</h3>
                      {tracker.questionText && (
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                          {localizeTrackerQuestion(tracker.questionText, tracker.title)}
                        </p>
                      )}
                      <p className="text-xs uppercase tracking-wider mt-1.5" style={{ color: `hsl(var(--${categoryColor}))` }}>
                        {localizeTrackerTheme(tracker)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* "Stable" badge dropped in 1.7.2 — without
                        context it read as "is stable good or bad?".
                        Strong-pattern and emerging stay because
                        those have actionable meaning. The
                        progress-bar below still color-codes the
                        balanced state for at-a-glance scanning. */}
                    {stats.status !== "balanced" && (
                      <Badge
                        variant="secondary"
                        className={`
                          ${stats.status === "emerging" ? "bg-emerging/20 text-emerging border-emerging/30" : ""}
                          ${stats.status === "strong" ? "bg-strong/20 text-strong border-strong/30" : ""}
                          text-xs font-medium rounded-full px-3
                        `}
                      >
                        {stats.status === "strong" && t("patterns.strongPattern")}
                        {stats.status === "emerging" && t("patterns.emerging")}
                      </Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                  </div>
                </div>

                {/* Threshold meter */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      <span className="font-serif text-base font-medium tabular-nums text-foreground">{stats.significantDays}</span>
                      <span className="mx-1 text-muted-foreground/60">/</span>
                      <span className="tabular-nums">{tracker.threshold}</span>
                      {" "}{t("patterns.significantDays")}
                    </span>
                    {daysLeft > 0
                      ? <span>{t("patterns.moreToAction", { count: daysLeft })}</span>
                      : <span className="font-medium" style={{ color: "hsl(var(--strong))" }}>{t("patterns.actionReached")}</span>
                    }
                  </div>
                  <div className="w-full h-2.5 bg-muted/30 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-700 ease-out rounded-full"
                      style={{ width: `${thresholdPct}%`, background: barGradient }}
                    />
                  </div>
                </div>

                {/* Reflection block */}
                {stats.status === "strong" && (
                  <div
                    className="rounded-2xl p-4 space-y-2"
                    style={{
                      background: "hsl(var(--strong) / 0.06)",
                      border: "1px solid hsl(var(--strong) / 0.2)",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 flex-shrink-0" style={{ color: "hsl(var(--strong))" }} />
                      <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: "hsl(var(--strong))" }}>
                        {t("patterns.reflectionSuggested")}
                      </p>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground/80">
                      {localizeTrackerAdvice(tracker.adviceAboveThreshold)}
                    </p>
                  </div>
                )}

                {stats.status === "emerging" && (
                  <div
                    className="rounded-2xl p-3 flex items-center gap-2"
                    style={{
                      background: "hsl(var(--emerging) / 0.06)",
                      border: "1px solid hsl(var(--emerging) / 0.2)",
                    }}
                  >
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" style={{ color: "hsl(var(--emerging))" }} />
                    <p className="text-xs" style={{ color: "hsl(var(--emerging))" }}>
                      {daysLeft === 1
                        ? t("patterns.patternBuildingOne")
                        : t("patterns.patternBuildingMany", { count: daysLeft })}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
            </div>
          </div>
        )}

        {/* --- TRENDS: dual-series chart over time ------------------- */}
        {section === "trends" && (
          <div className="animate-fade-in">
            <TrendChart
              trackers={trackers}
              entries={entries}
              prefilterIds={trendsPrefilter}
            />
          </div>
        )}

        {/* --- LINKS: dependency / correlation insights ------------- */}
        {section === "links" && (
          <div className="animate-fade-in">
            <CorrelationInsights
              trackers={trackers}
              entries={entries}
              onSelectPair={handleSelectCorrelationPair}
            />
          </div>
        )}
      </div>

      {/* Disclaimer removed from Patterns in 1.7.2 — was shown on
          EVERY sub-tab (Overview / Trends / Signals / Links) which
          made it visual noise that users stopped reading. The full
          disclaimer now lives once in Settings → Help, and the
          correlations-specific disclaimer remains inside the
          Correlation Insights "(i)" explainer modal. */}

      {/* Bottom Sheet for Tracker Details. Header is hidden visually
          (sr-only) since TrackerDetails already renders its own
          title + stats + actions inside the body. */}
      <BottomSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        className="h-[80vh]"
        ariaTitle={selectedTrackerForDetails ? localizeTrackerTitle(selectedTrackerForDetails.title) : "Tracker details"}
      >
        {/* Body opts out of vaul drag so internal scroll is unimpeded.
            Dismiss-by-drag still works from the pill / top region. */}
        <div className="flex-1 overflow-y-auto">
          {selectedTrackerForDetails && (
            <TrackerDetails
              tracker={selectedTrackerForDetails}
              trackers={trackers}
              currentIndex={selectedTrackerIndex}
              onNavigateTracker={handleNavigateTracker}
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
            />
          )}
        </div>
      </BottomSheet>

      {/* Calendar Answer Editor */}
      {editingTracker && (
        <CalendarAnswerEditor
          open={answerEditorOpen}
          onClose={() => setAnswerEditorOpen(false)}
          tracker={editingTracker}
          date={editingDate}
          existingEntry={editingEntry}
          onSave={handleSaveAnswer}
          onClear={handleClearAnswer}
        />
      )}

      {/* Reflection Detail Sheet */}
      {reflectionSheetTracker && (
        <ReflectionSheet
          open={!!reflectionSheetTracker}
          onClose={() => setReflectionSheetTracker(null)}
          tracker={reflectionSheetTracker}
          entries={entries}
          onStartNewCycle={handleStartNewCycle}
        />
      )}
    </div>
  );
};
