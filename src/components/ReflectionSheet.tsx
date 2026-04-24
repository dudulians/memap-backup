import { useState, useMemo, useEffect } from "react";
import { Tracker, TrackerEntry, ReflectionCycle } from "@/types/tracker";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { getTrackerIcon } from "@/lib/categoryHelpers";
import { format, parseISO, addDays, subDays } from "date-fns";
import { Lightbulb, RefreshCw, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReflectionSheetProps {
  open: boolean;
  onClose: () => void;
  tracker: Tracker;
  entries: TrackerEntry[];
  onStartNewCycle: (tracker: Tracker, stats: { significantDays: number; answerDays: number }) => void;
}

const fmt = (d: Date) => format(d, "d MMM");
const fmtInput = (d: Date) => format(d, "yyyy-MM-dd");

const CycleCard = ({ cycle }: { cycle: ReflectionCycle }) => {
  const start = parseISO(cycle.startDate);
  const end = parseISO(cycle.endDate);
  const pct = Math.min(Math.round((cycle.significantDays / cycle.threshold) * 100), 100);

  return (
    <div className="p-3 rounded-xl bg-muted/30 border border-border/40 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">
          {fmt(start)} – {fmt(end)} {format(end, "yyyy")}
        </p>
        <span className={cn(
          "text-[10px] font-medium px-2 py-0.5 rounded-full",
          pct >= 100 ? "bg-strong/20 text-strong" : "bg-muted text-muted-foreground"
        )}>
          {pct >= 100 ? "Reached" : "Closed early"}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <span><strong className="text-foreground">{cycle.significantDays}</strong> / {cycle.threshold} significant</span>
        <span>·</span>
        <span>{cycle.totalTrackedDays} logged</span>
        <span>·</span>
        <span>{cycle.periodDays}d window</span>
      </div>
      <div className="w-full h-1.5 bg-muted/50 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-strong/60" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

export const ReflectionSheet = ({
  open,
  onClose,
  tracker,
  entries,
  onStartNewCycle,
}: ReflectionSheetProps) => {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [customStartStr, setCustomStartStr] = useState<string | null>(null);
  const [customEndStr, setCustomEndStr] = useState<string | null>(null);
  const [openCalendar, setOpenCalendar] = useState<"start" | "end" | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Default window start (rolling or cycle-based)
  const defaultStart = useMemo(() => {
    const rolling = subDays(today, tracker.periodDays);
    const cycle = tracker.cycleStartDate
      ? new Date(tracker.cycleStartDate + "T00:00:00")
      : null;
    return cycle && cycle > rolling ? cycle : rolling;
  }, [tracker, today]);

  useEffect(() => {
    if (open) {
      setCustomStartStr(null);
      setCustomEndStr(null);
      setOpenCalendar(null);
      setConfirming(false);
      setHistoryOpen(false);
    }
  }, [open]);

  const windowStart = customStartStr
    ? new Date(customStartStr + "T00:00:00")
    : defaultStart;

  const windowEnd = customEndStr
    ? new Date(customEndStr + "T00:00:00")
    : today;

  const isCustom =
    (customStartStr !== null && customStartStr !== fmtInput(defaultStart)) ||
    (customEndStr !== null && customEndStr !== fmtInput(today));

  const stats = useMemo(() => {
    const relevant = entries.filter(e => {
      if (e.trackerId !== tracker.id) return false;
      const d = new Date(e.date + "T00:00:00");
      return d >= windowStart && d <= windowEnd;
    });
    const answerDays = relevant.length;
    const significantDays = relevant.filter(e =>
      tracker.problemWhen === "yes" ? e.value : !e.value
    ).length;
    let status: "balanced" | "emerging" | "strong" = "balanced";
    if (significantDays >= tracker.threshold) status = "strong";
    else if (significantDays >= tracker.threshold * 0.5) status = "emerging";
    return { answerDays, significantDays, status };
  }, [entries, tracker, windowStart, today]);

  const thresholdPct = Math.min(
    Math.round((stats.significantDays / tracker.threshold) * 100),
    100
  );
  const barGradient =
    thresholdPct >= 100
      ? "linear-gradient(90deg, hsl(var(--emerging)), hsl(var(--strong)))"
      : thresholdPct >= 50
      ? "linear-gradient(90deg, hsl(var(--balanced)), hsl(var(--emerging)))"
      : "linear-gradient(90deg, hsl(var(--balanced)), hsl(var(--balanced)))";

  const shiftStart = (days: number) => {
    const next = addDays(windowStart, days);
    if (next >= windowEnd) return;
    setCustomStartStr(fmtInput(next));
  };

  const shiftEnd = (days: number) => {
    const next = addDays(windowEnd, days);
    if (next <= windowStart) return;
    setCustomEndStr(fmtInput(next));
  };

  const cycles = tracker.cycles ?? [];

  const handleStartNewCycle = () => {
    if (!confirming) { setConfirming(true); return; }
    setConfirming(false);
    onStartNewCycle(tracker, stats);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) { setConfirming(false); onClose(); } }}>
      <SheetContent side="bottom" className="h-[82vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            {(() => {
              const RIcon = getTrackerIcon(tracker.title, tracker.category);
              return <RIcon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />;
            })()}
            {tracker.title}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 pb-8">

          {/* Observation window block */}
          <div className="space-y-3 p-4 rounded-2xl bg-muted/30 border border-border/30">

            {/* Sliding date header */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Observation window</span>
                {isCustom && (
                  <button
                    onClick={() => { setCustomStartStr(null); setCustomEndStr(null); }}
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </button>
                )}
              </div>

              {/* From row */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-8">From</span>
                <button
                  onClick={() => shiftStart(-1)}
                  className="p-1 rounded-full hover:bg-muted/60 transition-colors"
                  aria-label="1 day earlier"
                >
                  <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                </button>

                <button
                  onClick={() => setOpenCalendar(openCalendar === "start" ? null : "start")}
                  className={cn(
                    "text-sm font-semibold px-2 py-0.5 rounded-lg transition-colors hover:bg-muted/60",
                    customStartStr && customStartStr !== fmtInput(defaultStart)
                      ? "bg-primary/10 text-primary"
                      : openCalendar === "start" ? "bg-muted/60" : "text-foreground"
                  )}
                >
                  {fmt(windowStart)}
                </button>

                <button
                  onClick={() => shiftStart(1)}
                  disabled={addDays(windowStart, 1) >= windowEnd}
                  className="p-1 rounded-full hover:bg-muted/60 transition-colors disabled:opacity-30"
                  aria-label="1 day later"
                >
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              {/* To row */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-8">To</span>
                <button
                  onClick={() => shiftEnd(-1)}
                  disabled={subDays(windowEnd, 1) <= windowStart}
                  className="p-1 rounded-full hover:bg-muted/60 transition-colors disabled:opacity-30"
                  aria-label="1 day earlier"
                >
                  <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                </button>

                <button
                  onClick={() => setOpenCalendar(openCalendar === "end" ? null : "end")}
                  className={cn(
                    "text-sm font-semibold px-2 py-0.5 rounded-lg transition-colors hover:bg-muted/60",
                    customEndStr && customEndStr !== fmtInput(today)
                      ? "bg-primary/10 text-primary"
                      : openCalendar === "end" ? "bg-muted/60" : "text-foreground"
                  )}
                >
                  {fmt(windowEnd)} {format(windowEnd, "yyyy")}
                </button>

                <button
                  onClick={() => shiftEnd(1)}
                  disabled={windowEnd >= today}
                  className="p-1 rounded-full hover:bg-muted/60 transition-colors disabled:opacity-30"
                  aria-label="1 day later"
                >
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Inline calendar */}
            {openCalendar === "start" && (
              <div className="animate-fade-in">
                <Calendar
                  mode="single"
                  selected={windowStart}
                  defaultMonth={windowStart}
                  onSelect={(date) => {
                    if (date) setCustomStartStr(fmtInput(date));
                    setOpenCalendar(null);
                  }}
                  disabled={(date) => date >= windowEnd}
                  className="rounded-xl border border-border/30 bg-background"
                />
              </div>
            )}
            {openCalendar === "end" && (
              <div className="animate-fade-in">
                <Calendar
                  mode="single"
                  selected={windowEnd}
                  defaultMonth={windowEnd}
                  onSelect={(date) => {
                    if (date) setCustomEndStr(fmtInput(date));
                    setOpenCalendar(null);
                  }}
                  disabled={(date) => date <= windowStart || date > today}
                  className="rounded-xl border border-border/30 bg-background"
                />
              </div>
            )}

            {/* Progress */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  <strong className="text-foreground">{stats.significantDays}</strong>
                  {" / "}{tracker.threshold} significant days
                </span>
                <span>{stats.answerDays} logged</span>
              </div>
              <div className="w-full h-2.5 bg-muted/40 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${thresholdPct}%`, background: barGradient }}
                />
              </div>
              <p className={cn(
                "text-[11px] text-right font-medium",
                thresholdPct >= 100 ? "text-strong" : "text-muted-foreground"
              )}>
                {thresholdPct >= 100
                  ? "Action signal reached ✓"
                  : `${tracker.threshold - stats.significantDays} more to action signal`}
              </p>
            </div>
          </div>

          {/* Reflection text */}
          {stats.status === "strong" && (
            <div
              className="rounded-2xl p-4 space-y-2"
              style={{ background: "hsl(var(--strong) / 0.06)", border: "1px solid hsl(var(--strong) / 0.2)" }}
            >
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 flex-shrink-0" style={{ color: "hsl(var(--strong))" }} />
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "hsl(var(--strong))" }}>
                  Reflection
                </p>
              </div>
              <p className="text-sm leading-relaxed text-foreground/80">
                {tracker.adviceAboveThreshold}
              </p>
            </div>
          )}

          {/* Start new cycle */}
          <div className="space-y-2">
            {confirming ? (
              <div className="space-y-2 p-4 rounded-2xl border border-border/60 bg-muted/20 animate-fade-in">
                <p className="text-sm font-medium">Start a new observation cycle?</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The current cycle ({stats.significantDays} significant days) will be saved to history. Counter resets from today.
                </p>
                <div className="flex gap-2 pt-1">
                  <Button variant="ghost" size="sm" className="flex-1 rounded-full" onClick={() => setConfirming(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" className="flex-1 rounded-full bg-strong text-white hover:bg-strong/90" onClick={handleStartNewCycle}>
                    Yes, start fresh
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" className="w-full rounded-xl gap-2" onClick={handleStartNewCycle}>
                <RefreshCw className="h-4 w-4" />
                Start new cycle
              </Button>
            )}
            <p className="text-[10px] text-center text-muted-foreground">
              Saves progress to history and resets the counter from today
            </p>
          </div>

          {/* History */}
          {cycles.length > 0 && (
            <div className="space-y-3">
              <button
                onClick={() => setHistoryOpen(!historyOpen)}
                className="w-full flex items-center justify-between text-sm font-medium py-1"
              >
                <span>Past cycles ({cycles.length})</span>
                {historyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {historyOpen && (
                <div className="space-y-2 animate-fade-in">
                  {[...cycles].reverse().map(c => <CycleCard key={c.id} cycle={c} />)}
                </div>
              )}
            </div>
          )}

          {cycles.length === 0 && (
            <p className="text-xs text-center text-muted-foreground py-2">
              No past cycles yet · history appears after you start a new cycle
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
