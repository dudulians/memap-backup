import { useState, useEffect } from "react";
import { Tracker, TrackerEntry, ReflectionCycle } from "@/types/tracker";
import { getTrackers, getEntries, saveEntries, saveTrackers } from "@/lib/storage";
import { clearThresholdNotification } from "@/lib/notifications";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCategoryColor, getTrackerIcon } from "@/lib/categoryHelpers";
import { Lightbulb, AlertTriangle, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { OverviewCard } from "./OverviewCard";
import { WeeklySummary } from "./WeeklySummary";
import { TrendChart } from "./TrendChart";
import { CorrelationInsights } from "./CorrelationInsights";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TrackerDetails } from "./TrackerDetails";
import { CalendarAnswerEditor } from "./CalendarAnswerEditor";
import { ReflectionSheet } from "./ReflectionSheet";
import { uuid } from "@/lib/uuid";

export const PatternsTab = () => {
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

  useEffect(() => {
    loadData();
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
        <p className="text-2xl font-medium">Patterns of Your Days</p>
        <p className="text-sm text-muted-foreground max-w-md">
          Add your first tracker to start building patterns over time.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="text-center space-y-1 animate-fade-in">
        <p className="text-lg font-medium tracking-wide">Patterns of Your Days</p>
        <p className="text-sm text-muted-foreground">
          {trackers.length === 1 ? "1 pattern tracked" : `${trackers.length} patterns tracked`}
        </p>
      </div>

      {/* Overview Card with Calendar */}
      <OverviewCard
        trackers={trackers}
        entries={entries}
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        onTrackerSelect={handleOpenTrackerDetails}
        onDayEdit={handleDayEdit}
        onBulkAnswer={handleBulkAnswer}
      />

      {/* Weekly Summary */}
      <WeeklySummary trackers={trackers} entries={entries} />

      {/* Pattern Cards */}
      <div className="space-y-4">
        {trackers.map((tracker) => {
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
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `hsl(var(--${categoryColor}) / 0.22)` }}
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.75} style={{ color: "hsl(var(--foreground))" }} />
                    </div>
                    <div>
                      <h3 className="font-medium text-base">{tracker.title}</h3>
                      <p className="text-xs uppercase tracking-wider mt-1" style={{ color: `hsl(var(--${categoryColor}))` }}>
                        {tracker.category}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant="secondary"
                      className={`
                        ${stats.status === "emerging" ? "bg-emerging/20 text-emerging border-emerging/30" : ""}
                        ${stats.status === "balanced" ? "bg-balanced/20 text-balanced border-balanced/30" : ""}
                        ${stats.status === "strong" ? "bg-strong/20 text-strong border-strong/30" : ""}
                        text-xs font-medium rounded-full px-3
                      `}
                    >
                      {stats.status === "strong" && "Strong pattern"}
                      {stats.status === "emerging" && "Emerging"}
                      {stats.status === "balanced" && "Stable"}
                    </Badge>
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
                      {" significant days"}
                    </span>
                    {daysLeft > 0
                      ? <span>{daysLeft} more to action signal</span>
                      : <span className="font-medium" style={{ color: "hsl(var(--strong))" }}>Action signal reached</span>
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
                        Reflection suggested
                      </p>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground/80">
                      {tracker.adviceAboveThreshold}
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
                      Pattern is building — {daysLeft} more significant day{daysLeft !== 1 ? "s" : ""} to the action signal
                    </p>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Trend & Correlation Chart */}
      <TrendChart trackers={trackers} entries={entries} />

      {/* Correlation Insights */}
      <CorrelationInsights trackers={trackers} entries={entries} />

      {/* Disclaimer */}
      <div className="pt-6 mt-8">
        <p className="text-xs text-muted-foreground text-center px-4 leading-relaxed font-playful">
          MeMap is a self-reflection tool – not a diagnostic app.
          <br />
          If your patterns feel overwhelming, consider talking to a professional.
        </p>
      </div>

      {/* Bottom Sheet for Tracker Details */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {selectedTrackerForDetails && (() => {
                const SheetIcon = getTrackerIcon(selectedTrackerForDetails.title, selectedTrackerForDetails.category);
                return <SheetIcon className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />;
              })()}
              {selectedTrackerForDetails?.title}
            </SheetTitle>
          </SheetHeader>
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
        </SheetContent>
      </Sheet>

      {/* Calendar Answer Editor */}
      {editingTracker && (
        <CalendarAnswerEditor
          open={answerEditorOpen}
          onClose={() => setAnswerEditorOpen(false)}
          tracker={editingTracker}
          date={editingDate}
          existingEntry={editingEntry}
          onSave={handleSaveAnswer}
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
