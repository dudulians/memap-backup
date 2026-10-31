import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Tracker, TrackerEntry, ReflectionCycle } from "@/types/tracker";
import { getTrackers, getEntries, saveEntries, saveTrackers } from "@/lib/storage";
import { clearThresholdNotification } from "@/lib/notifications";
import { ChevronRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { OverviewCard } from "./OverviewCard";
import { FindingsView } from "./FindingsView";
import { TrendChart } from "./TrendChart";
import { CalendarAnswerEditor } from "./CalendarAnswerEditor";
import { ReflectionSheet } from "./ReflectionSheet";
import { uuid } from "@/lib/uuid";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import { getDoorState, isoLocal } from "@/lib/doors";

export const PatternsTab = () => {
  const { t } = useTranslation();
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  // Day picked on the calendar (its notes show under the month)
  const [selectedDate, setSelectedDate] = useState(() => 
    isoLocal(new Date())
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
  // 1.8.0: Findings first (plain-sentence links), then the calendar
  // ("overview") and limits ("signals"). Aurora UX (Oct 31 2026, her
  // ask: "мне нравились графики") brings the line charts back as a
  // fourth tab, "trends", so a stored "trends" opens it again. A stored
  // "links" (the old engineer-worded tab) still lands on Findings.
  const SECTIONS = ["findings", "overview", "trends", "signals"] as const;
  type Section = typeof SECTIONS[number];
  const [section, setSection] = useState<Section>(() => {
    try {
      const stored = localStorage.getItem("memap_patterns_section") as Section | null;
      if (stored && SECTIONS.includes(stored)) return stored;
    } catch { /* ignore */ }
    return "findings";
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
      if (next === "findings" || next === "overview" || next === "trends" || next === "signals") {
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

  // "Select several days" on the calendar: one answer for all picked
  // days at once (null = clear them). Back from 1.7.9.
  const handleBulkAnswer = async (trackerId: string, dates: string[], value: boolean | null) => {
    const picked = new Set(dates);
    let updatedEntries = entries.filter((e) => !(e.trackerId === trackerId && picked.has(e.date) && value === null));
    if (value !== null) {
      updatedEntries = updatedEntries.map((e) => (e.trackerId === trackerId && picked.has(e.date) ? { ...e, value } : e));
      for (const date of dates) {
        if (!updatedEntries.some((e) => e.trackerId === trackerId && e.date === date)) {
          updatedEntries.push({ id: uuid(), trackerId, date, value });
        }
      }
    }
    setEntries(updatedEntries);
    await saveEntries(updatedEntries);
  };

  const handleStartNewCycle = async (
    tracker: Tracker,
    stats: { significantDays: number; answerDays: number }
  ) => {
    const today = isoLocal(new Date());

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
              value="findings"
              className="relative rounded-none border-b-2 border-transparent h-[46px] px-1 text-[15px] font-semibold text-muted-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground"
            >
              {t("patterns.tabFindings")}
            </TabsTrigger>
            <TabsTrigger
              value="overview"
              className="relative rounded-none border-b-2 border-transparent h-[46px] px-1 text-[15px] font-semibold text-muted-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground"
            >
              {t("patterns.tabCalendar")}
            </TabsTrigger>
            <TabsTrigger
              value="trends"
              className="relative rounded-none border-b-2 border-transparent h-[46px] px-1 text-[15px] font-semibold text-muted-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground"
            >
              {t("patterns.tabCharts")}
            </TabsTrigger>
            <TabsTrigger
              value="signals"
              className="relative rounded-none border-b-2 border-transparent h-[46px] px-1 text-[15px] font-semibold text-muted-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground"
            >
              {t("patterns.tabLimits")}
              {strongCount > 0 && (
                <span className="absolute top-1 right-0 h-4 min-w-4 px-1 rounded-full text-[10px] font-semibold flex items-center justify-center bg-strong text-strong-foreground">
                  {strongCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>
      </Tabs>

      {/* Section content — only the active section mounts (no
          carousel mounting all four at once). Tap a tab above to
          switch. Each section gets its own animate-fade-in for a
          subtle entrance without the carousel-mounting cost. */}
      <div className="mt-4">
        {section === "findings" && (
          <FindingsView trackers={trackers} entries={entries} onSeeDays={() => handleSectionChange("overview")} />
        )}

        {section === "overview" && (
          <div className="animate-fade-in">
            <OverviewCard
              trackers={trackers}
              entries={entries}
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
              onDayEdit={handleDayEdit}
              onBulkAnswer={handleBulkAnswer}
            />
          </div>
        )}

        {/* --- CHARTS: the line chart over time, back from 1.7.9. */}
        {section === "trends" && (
          <div className="animate-fade-in">
            <TrendChart trackers={trackers} entries={entries} roomy />
          </div>
        )}

        {/* --- LIMITS (1.8.0): one row per question, "7 / 8" and a bar.
            The question text, theme, badges and advice paragraphs are
            gone; a crossed row turns rose and offers "What now?", which
            opens the same reflection sheet (advice + new cycle). */}
        {section === "signals" && (() => {
          const live = sortedTrackers.filter((tr) => !tr.archived);
          // Door questions go by their door name ("Fights with my partner").
          const door = getDoorState();
          const doorName = new Map<string, string>();
          if (door) {
            doorName.set(door.trackerId, t(`doors.${door.id}.name`));
            for (const x of door.extra ?? []) doorName.set(x.trackerId, t(`doors.${x.id}.name`));
          }
          const periods = live.map((tr) => tr.periodDays);
          const common = periods.sort((a, b) => periods.filter((p) => p === b).length - periods.filter((p) => p === a).length)[0];
          return (
            <div className="animate-fade-in">
              {common && <p className="mx-1 mb-3 text-[17px] text-muted-foreground">{t("patterns.limitsWindow", { count: common })}</p>}
              <div className="space-y-2.5">
                {live.map((tracker) => {
                  const stats = getTrackerStats(tracker);
                  const crossed = stats.significantDays >= tracker.threshold;
                  const pct = Math.min(100, Math.round((stats.significantDays / Math.max(1, tracker.threshold)) * 100));
                  const sub = [
                    tracker.problemWhen === "no" ? t("patterns.countsNo") : null,
                    tracker.periodDays !== common ? t("patterns.limitsWindowShort", { count: tracker.periodDays }) : null,
                  ].filter(Boolean).join(" · ");
                  return (
                    <button
                      key={tracker.id}
                      type="button"
                      onClick={() => setReflectionSheetTracker(tracker)}
                      className={cn(
                        "block w-full text-left rounded-[22px] border px-[18px] py-4 active:scale-[0.99] transition-transform",
                        crossed ? "border-strong/30 bg-strong/[0.12]" : "border-foreground/[0.12] bg-foreground/[0.07]",
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 text-lg font-semibold leading-snug">{doorName.get(tracker.id) ?? localizeTrackerTitle(tracker.title)}</span>
                        <span className="shrink-0 tabular-nums">
                          <span className={cn("text-[26px] font-bold", crossed && "text-strong")}>{stats.significantDays}</span>
                          <span className="text-[17px] text-muted-foreground"> / {tracker.threshold}</span>
                          <ChevronRight className="inline-block h-5 w-5 ml-1.5 -mt-1 text-muted-foreground/60" />
                        </span>
                      </div>
                      {sub && <p className="mt-0.5 text-sm text-muted-foreground">{sub}</p>}
                      <div className="mt-3 h-2 rounded-full bg-foreground/10 overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-700 ease-out", crossed ? "bg-strong" : "bg-primary")}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {crossed && (
                        <span className="mt-3 inline-flex items-center gap-1 text-base font-semibold text-strong">
                          {t("patterns.whatNow")}
                          <ChevronRight className="h-4 w-4" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Disclaimer removed from Patterns in 1.7.2 — was shown on
          EVERY sub-tab (Overview / Trends / Signals / Links) which
          made it visual noise that users stopped reading. The full
          disclaimer now lives once in Settings → Help, and the
          correlations-specific disclaimer remains inside the
          Correlation Insights "(i)" explainer modal. */}

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
