import { useState, useMemo, useEffect } from "react";
import { Tracker, TrackerEntry, ReflectionCycle } from "@/types/tracker";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { format, parseISO, addDays, subDays } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { RefreshCw, ChevronDown, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { getLanguage } from "@/lib/i18n";
import { localizeTrackerTitle, localizeTrackerAdvice } from "@/lib/trackerLocalize";
import { getDoorState } from "@/lib/doors";

interface ReflectionSheetProps {
  open: boolean;
  onClose: () => void;
  tracker: Tracker;
  entries: TrackerEntry[];
  onStartNewCycle: (tracker: Tracker, stats: { significantDays: number; answerDays: number }) => void;
}

const fmtInput = (d: Date) => format(d, "yyyy-MM-dd");

const CycleCard = ({ cycle }: { cycle: ReflectionCycle }) => {
  const { t } = useTranslation();
  const dateLocale = getLanguage() === "ru" ? ruLocale : undefined;
  const fmtLocal = (d: Date) => format(d, "d MMM", { locale: dateLocale });
  const start = parseISO(cycle.startDate);
  const end = parseISO(cycle.endDate);
  const pct = Math.min(Math.round((cycle.significantDays / cycle.threshold) * 100), 100);

  return (
    <div className="p-3 rounded-2xl bg-muted/30 border border-border/40 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">
          {fmtLocal(start)} – {fmtLocal(end)} {format(end, "yyyy")}
        </p>
        <span className={cn(
          "text-[10px] font-medium px-2 py-0.5 rounded-full",
          pct >= 100 ? "bg-strong/20 text-strong" : "bg-muted text-muted-foreground"
        )}>
          {pct >= 100 ? t("reflection.reached") : t("reflection.closedEarly")}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <span><strong className="text-foreground">{cycle.significantDays}</strong> / {cycle.threshold} {t("reflection.significant")}</span>
        <span>·</span>
        <span>{cycle.totalTrackedDays} {t("reflection.loggedShort")}</span>
        <span>·</span>
        <span>{t("reflection.windowDays", { count: cycle.periodDays })}</span>
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
  const { t } = useTranslation();
  const dateLocale = getLanguage() === "ru" ? ruLocale : undefined;
  const fmt = (d: Date) => format(d, "d MMM", { locale: dateLocale });
  const [detailsOpen, setDetailsOpen] = useState(false);
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
    // the last periodDays days, today the last of them (the same span as the rules, lighthouses.ts)
    const rolling = subDays(today, tracker.periodDays - 1);
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
      setDetailsOpen(false);
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
  const crossed = stats.significantDays >= tracker.threshold;
  // Door questions go by their door name, same as on Limits.
  const title = (() => {
    const door = getDoorState();
    const id = door?.trackerId === tracker.id ? door.id : door?.extra?.find((x) => x.trackerId === tracker.id)?.id;
    return id ? t(`doors.${id}.name`) : localizeTrackerTitle(tracker.title);
  })();

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

  // 1.8.0: what you need first — the count, the advice, one button.
  // The observation window and past cycles moved under "Details".
  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => { if (!o) { setConfirming(false); onClose(); } }}
      className="h-[80vh]"
      ariaTitle={title}
    >
      <div className="px-6 pt-3 pb-2 flex-shrink-0">
        <h2 className="text-[21px] font-bold tracking-tight pr-10">{title}</h2>
      </div>

      {/* Body opts out of vaul drag so internal scroll is unimpeded.
          Dismiss-by-drag still works from the pill / top header. */}
      <div className="flex-1 overflow-y-auto px-6 space-y-5 pb-8">
        <div>
          <p className="tabular-nums">
            <span className={cn("text-[44px] leading-none font-bold tracking-tight", crossed && "text-strong")}>{stats.significantDays}</span>
            <span className="text-[22px] text-muted-foreground"> / {tracker.threshold}</span>
          </p>
          <div className="mt-3 h-2.5 rounded-full bg-foreground/10 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-300", crossed ? "bg-strong" : "bg-primary")}
              style={{ width: `${thresholdPct}%` }}
            />
          </div>
        </div>

        {/* The advice is the answer to "What now?" */}
        {crossed && tracker.adviceAboveThreshold && (
          <p className="rounded-2xl bg-strong/[0.1] border border-strong/25 p-4 text-[17px] leading-snug">
            {localizeTrackerAdvice(tracker.adviceAboveThreshold)}
          </p>
        )}

        {/* Start new cycle */}
        {confirming ? (
          <div className="space-y-2 p-4 rounded-2xl border border-border/60 bg-muted/20 animate-fade-in">
            <p className="text-base font-semibold">{t("reflection.confirmTitle")}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("reflection.confirmDesc", { count: stats.significantDays })}
            </p>
            <div className="flex gap-2 pt-1">
              <Button variant="ghost" className="flex-1 h-11 rounded-full" onClick={() => setConfirming(false)}>
                {t("common.cancel")}
              </Button>
              <Button className="flex-1 h-11 rounded-full bg-strong text-strong-foreground hover:bg-strong/90" onClick={handleStartNewCycle}>
                {t("reflection.yesStartFresh")}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" className="w-full h-12 rounded-full gap-2 text-base bg-transparent border-foreground/20" onClick={handleStartNewCycle}>
            <RefreshCw className="h-4 w-4" />
            {t("reflection.startNewCycle")}
          </Button>
        )}

        {/* Details: the window you count in, and past cycles */}
        <div>
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            aria-expanded={detailsOpen}
            className="w-full flex items-center justify-between py-2 text-base font-semibold text-muted-foreground"
          >
            {t("reflection.details")}
            <ChevronDown className={cn("h-5 w-5 transition-transform", detailsOpen && "rotate-180")} />
          </button>
          {detailsOpen && (
            <div className="mt-2 space-y-4 animate-fade-in">
              <div className="space-y-3 p-4 rounded-2xl bg-muted/30 border border-border/30">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("reflection.observationWindow")}</span>
                  {isCustom && (
                    <button
                      onClick={() => { setCustomStartStr(null); setCustomEndStr(null); }}
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      <RotateCcw className="h-3 w-3" />
                      {t("reflection.resetWindow")}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-10">{t("reflection.from")}</span>
                  <button onClick={() => shiftStart(-1)} className="p-1 rounded-full hover:bg-muted/60" aria-label={t("reflection.earlier")}>
                    <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => setOpenCalendar(openCalendar === "start" ? null : "start")}
                    className={cn(
                      "text-sm font-semibold px-2 py-0.5 rounded-full transition-colors hover:bg-muted/60",
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
                    className="p-1 rounded-full hover:bg-muted/60 disabled:opacity-30"
                    aria-label={t("reflection.later")}
                  >
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-10">{t("reflection.to")}</span>
                  <button
                    onClick={() => shiftEnd(-1)}
                    disabled={subDays(windowEnd, 1) <= windowStart}
                    className="p-1 rounded-full hover:bg-muted/60 disabled:opacity-30"
                    aria-label={t("reflection.earlier")}
                  >
                    <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => setOpenCalendar(openCalendar === "end" ? null : "end")}
                    className={cn(
                      "text-sm font-semibold px-2 py-0.5 rounded-full transition-colors hover:bg-muted/60",
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
                    className="p-1 rounded-full hover:bg-muted/60 disabled:opacity-30"
                    aria-label={t("reflection.later")}
                  >
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>

                {openCalendar === "start" && (
                  <Calendar
                    mode="single"
                    selected={windowStart}
                    defaultMonth={windowStart}
                    onSelect={(date) => {
                      if (date) setCustomStartStr(fmtInput(date));
                      setOpenCalendar(null);
                    }}
                    disabled={(date) => date >= windowEnd}
                    className="rounded-xl border border-border/30 bg-background animate-fade-in"
                  />
                )}
                {openCalendar === "end" && (
                  <Calendar
                    mode="single"
                    selected={windowEnd}
                    defaultMonth={windowEnd}
                    onSelect={(date) => {
                      if (date) setCustomEndStr(fmtInput(date));
                      setOpenCalendar(null);
                    }}
                    disabled={(date) => date <= windowStart || date > today}
                    className="rounded-xl border border-border/30 bg-background animate-fade-in"
                  />
                )}

                <p className="text-sm text-muted-foreground">{t("reflection.logged", { count: stats.answerDays })}</p>
              </div>

              {cycles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">{t("reflection.pastCycles", { count: cycles.length })}</p>
                  {[...cycles].reverse().map(c => <CycleCard key={c.id} cycle={c} />)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
};
