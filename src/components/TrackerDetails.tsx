import { useState, useEffect, useRef } from "react";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { getEntries, saveEntries } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Lightbulb, ChevronLeft, ChevronRight, Check, X, Settings as SettingsIcon, Archive, Trash2 } from "lucide-react";
import { getCategoryColor, getTrackerIcon } from "@/lib/categoryHelpers";
import { MonthlyCalendar } from "@/components/MonthlyCalendar";
import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { uuid } from "@/lib/uuid";
import { useTranslation } from "react-i18next";
import { getLanguage } from "@/lib/i18n";
import { localizeTrackerTitle, localizeTrackerQuestion, localizeTrackerAdvice } from "@/lib/trackerLocalize";
import { haptics } from "@/lib/haptics";

interface TrackerDetailsProps {
  tracker: Tracker;
  trackers?: Tracker[];
  currentIndex?: number;
  onBack: () => void;
  onNavigateTracker?: (direction: "prev" | "next") => void;
  selectedDate?: string;
  onDateSelect?: (date: string) => void;
  // Optional management actions surfaced as a prominent button row at
  // the top of the details view. When omitted, the row is hidden —
  // useful for read-only contexts.
  onEdit?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
}

// Tabs were removed when Question + Calendar were merged into one
// scrollable layout — kept the type alias commented out for context.
// type TabType = "questions" | "calendar";

export const TrackerDetails = ({
  tracker,
  trackers,
  currentIndex,
  onBack,
  onNavigateTracker,
  selectedDate,
  onDateSelect,
  onEdit,
  onArchive,
  onDelete,
}: TrackerDetailsProps) => {
  const { t } = useTranslation();
  const dateLocale = getLanguage() === "ru" ? ruLocale : undefined;
  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const effectiveSelectedDate = selectedDate || new Date().toISOString().split("T")[0];

  useEffect(() => {
    loadEntries();
    // Re-pull entries when anything else in the app saves a change
    // (e.g. the user just answered the tracker via the Play swipe deck
    // while TrackerDetails was sitting open behind it). Without this,
    // significantCount stays frozen on the initial mount snapshot — so
    // the reflection block doesn't switch back from "Time to reflect"
    // to "If this becomes frequent" after the user corrects a wrong
    // tap.
    const refresh = () => { loadEntries(); };
    window.addEventListener("memap-entries-changed", refresh);
    return () => {
      window.removeEventListener("memap-entries-changed", refresh);
    };
  }, []);

  const loadEntries = async () => {
    const data = await getEntries();
    setEntries(data);
    setLoading(false);
  };

  const getCurrentEntry = () => {
    return entries.find(
      (e) => e.trackerId === tracker.id && e.date === effectiveSelectedDate
    );
  };

  const handleBulkAnswer = async (dates: string[], value: boolean | null) => {
    let updatedEntries = [...entries];
    for (const date of dates) {
      const existingIndex = updatedEntries.findIndex(
        (e) => e.trackerId === tracker.id && e.date === date
      );
      if (value === null) {
        if (existingIndex !== -1) updatedEntries.splice(existingIndex, 1);
      } else if (existingIndex !== -1) {
        updatedEntries[existingIndex] = { ...updatedEntries[existingIndex], value };
      } else {
        updatedEntries.push({ id: uuid(), trackerId: tracker.id, date, value });
      }
    }
    setEntries(updatedEntries);
    await saveEntries(updatedEntries);
  };

  const handleAnswer = async (value: boolean) => {
    const existingEntry = getCurrentEntry();

    if (existingEntry) {
      const updatedEntries = entries.map((e) =>
        e.id === existingEntry.id ? { ...e, value } : e
      );
      setEntries(updatedEntries);
      await saveEntries(updatedEntries);
    } else {
      const newEntry: TrackerEntry = {
        id: uuid(),
        trackerId: tracker.id,
        date: effectiveSelectedDate,
        value,
      };
      const updatedEntries = [...entries, newEntry];
      setEntries(updatedEntries);
      await saveEntries(updatedEntries);
    }
  };

  // "Un-answer" the selected date for this tracker — removes the
  // entry entirely so the day reads as untracked again. Lets the
  // user undo a reflex Yes/No without leaving a saved value behind
  // (which would otherwise still suppress today's notification and
  // colour the calendar dot).
  const handleClearCurrent = async () => {
    const existingEntry = getCurrentEntry();
    if (!existingEntry) return;
    const updatedEntries = entries.filter((e) => e.id !== existingEntry.id);
    setEntries(updatedEntries);
    await saveEntries(updatedEntries);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  // Calculate stats for warning
  const trackerEntries = entries.filter(e => e.trackerId === tracker.id);
  const significantCount = trackerEntries.filter(e => 
    tracker.problemWhen === "yes" ? e.value === true : e.value === false
  ).length;
  const showWarning = significantCount >= tracker.threshold;
  
  const categoryColor = getCategoryColor(tracker.category);
  const Icon = getTrackerIcon(tracker.title, tracker.category);

  const canGoPrev = trackers && currentIndex !== undefined && currentIndex > 0;
  const canGoNext = trackers && currentIndex !== undefined && currentIndex < trackers.length - 1;

  // Format selected date for display
  const selectedDateDisplay = effectiveSelectedDate
    ? format(new Date(effectiveSelectedDate + "T00:00:00"), "d MMMM yyyy", { locale: dateLocale })
    : format(new Date(), "d MMMM yyyy", { locale: dateLocale });

  const currentEntry = getCurrentEntry();
  const currentAnswer = currentEntry?.value;

  return (
    <div
      ref={containerRef}
      className="space-y-4 pb-20 animate-fade-in"
    >
      {/* Navigation header */}
      {onBack && (
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" onClick={onBack} className="rounded-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("trackerDetails.back")}
          </Button>
          
          {trackers && trackers.length > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onNavigateTracker?.("prev")}
                disabled={!canGoPrev}
                className="h-8 w-8 rounded-full"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                {(currentIndex ?? 0) + 1} / {trackers.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onNavigateTracker?.("next")}
                disabled={!canGoNext}
                className="h-8 w-8 rounded-full"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Slim header — just the category as a quiet uppercase label,
          tracker title sits in the answer card right below. The big
          title card was eating ~80px of vertical space without earning
          it; the answer card already carries the user's attention. */}
      <div className="flex items-center justify-center gap-1.5 -mb-1">
        <Icon
          className="h-3.5 w-3.5"
          style={{ color: `hsl(var(--${categoryColor}))` }}
          strokeWidth={1.75}
        />
        <span
          className="text-[10px] font-semibold tracking-[0.2em] uppercase"
          style={{ color: `hsl(var(--${categoryColor}))` }}
        >
          {t(`categories.${tracker.category}` as const)}
        </span>
      </div>
      <h2 className="text-base font-medium text-center -mt-0.5">
        {localizeTrackerTitle(tracker.title)}
      </h2>

      {/* Quick answer for the selected date. Shows the question once
          and the Yes/No buttons inline so answering doesn't require
          scrolling. */}
      <div className="space-y-2">
        <p className="text-xs text-center text-muted-foreground">
          {t("trackerDetails.fillingInFor")} <span className="font-medium">{selectedDateDisplay}</span>
        </p>
        <QuestionSwipeCard
          tracker={tracker}
          currentAnswer={currentAnswer}
          onAnswer={handleAnswer}
        />
        {/* Clear-answer link — only when there's an entry to clear.
            Undoes a reflex tap so the day counts as un-answered
            again (notifications fire later, calendar dot disappears). */}
        {currentEntry && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleClearCurrent}
              className="text-xs text-muted-foreground hover:text-destructive underline underline-offset-2 transition-colors"
            >
              {t("trackerDetails.clearAnswer")}
            </button>
          </div>
        )}
      </div>

      {/* Calendar removed — it's available on Patterns → Overview, and
          showing it here was forcing the user to scroll past it to get
          to actions / stats / reflection. The card detail view is now
          a quick "answer + stats + reflection" surface; deeper time-
          series belongs to the Patterns area. */}

      {/* Quick stats — significant-day progress + period summary. */}
      {(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const rollingStart = new Date(today);
        rollingStart.setDate(today.getDate() - tracker.periodDays);
        const cycleStart = tracker.cycleStartDate
          ? new Date(tracker.cycleStartDate + "T00:00:00")
          : null;
        const windowStart = cycleStart && cycleStart > rollingStart ? cycleStart : rollingStart;
        const inWindow = entries.filter((e) => {
          if (e.trackerId !== tracker.id) return false;
          const d = new Date(e.date + "T00:00:00");
          return d >= windowStart && d <= today;
        });
        const significantDays = inWindow.filter((e) =>
          tracker.problemWhen === "yes" ? e.value : !e.value
        ).length;
        const trackedDays = inWindow.length;
        const remaining = Math.max(0, tracker.threshold - significantDays);
        const pct = Math.min(100, (significantDays / tracker.threshold) * 100);
        return (
          <Card className="card-premium">
            <CardContent className="pt-4 pb-4 space-y-3">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">
                  <span className="font-serif text-xl font-medium tabular-nums text-foreground">
                    {significantDays}
                  </span>
                  <span className="mx-1 text-muted-foreground/60">/</span>
                  <span className="tabular-nums">{tracker.threshold}</span>
                  <span className="ml-1.5">{t("trackerDetails.statSignificantDays")}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {remaining > 0
                    ? t("trackerDetails.statMoreToAction", { count: remaining })
                    : t("trackerDetails.statActionReached")}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: pct >= 80
                      ? "hsl(var(--strong))"
                      : pct >= 40
                      ? "hsl(var(--emerging))"
                      : `hsl(var(--${categoryColor}))`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{t("trackerDetails.statPeriod", { days: tracker.periodDays })}</span>
                <span>{t("trackerDetails.statTrackedDays", { count: trackedDays })}</span>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Reflection text — single block, title and accent shift when
          the tracker has hit its threshold. Below threshold reads as
          "If this becomes frequent..."; above threshold becomes the
          stronger "Time to reflect" with the urgent strong-colour
          accent. We deliberately don't render two separate cards
          (used to be a duplicate at the bottom) — same advice text
          twice on one screen looked broken. */}
      {tracker.adviceAboveThreshold && tracker.adviceAboveThreshold.trim() && (
        <Card
          className={cn(
            "card-premium border-l-4",
            showWarning ? "border-l-strong" : "border-l-primary/60",
          )}
        >
          <CardContent className="pt-4 pb-4 flex items-start gap-3">
            <Lightbulb
              className={cn(
                "h-5 w-5 flex-shrink-0 mt-0.5",
                showWarning ? "text-strong" : "text-primary",
              )}
              strokeWidth={1.75}
            />
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-xs uppercase tracking-wider font-semibold mb-1",
                  showWarning ? "text-strong" : "text-primary",
                )}
              >
                {showWarning
                  ? t("trackerDetails.reflectionSuggested")
                  : t("trackerDetails.reflectionLabel")}
              </p>
              <p className="text-sm text-foreground leading-relaxed">
                {localizeTrackerAdvice(tracker.adviceAboveThreshold)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manage row at the bottom — Edit / Archive / Delete as
          full-width labelled buttons. Compact layout above keeps it
          reachable without scrolling on a typical screen. */}
      {(onEdit || onArchive || onDelete) && (
        <div className="grid grid-cols-3 gap-2">
          {onEdit && (
            <Button
              variant="outline"
              onClick={onEdit}
              className="rounded-xl flex flex-col items-center gap-1 h-auto py-2.5"
            >
              <SettingsIcon className="h-4 w-4" />
              <span className="text-[11px] font-medium">{t("trackerDetails.actionEdit")}</span>
            </Button>
          )}
          {onArchive && (
            <Button
              variant="outline"
              onClick={() => { haptics.warning(); onArchive(); }}
              className="rounded-xl flex flex-col items-center gap-1 h-auto py-2.5"
            >
              <Archive className="h-4 w-4" />
              <span className="text-[11px] font-medium">
                {tracker.archived ? t("trackerDetails.actionUnarchive") : t("trackerDetails.actionArchive")}
              </span>
            </Button>
          )}
          {onDelete && (
            <Button
              variant="outline"
              onClick={() => { haptics.warning(); onDelete(); }}
              className="rounded-xl flex flex-col items-center gap-1 h-auto py-2.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              <span className="text-[11px] font-medium">{t("trackerDetails.actionDelete")}</span>
            </Button>
          )}
        </div>
      )}

      {/* The threshold-reached callout used to live here as a second
          reflection block. Removed — the single block above already
          changes its title to "Time to reflect" and accent colour to
          strong when showWarning is true, so this duplicate just
          repeated the same advice text twice on one screen. */}
    </div>
  );
};

// Question card with swipe gesture and Yes/No buttons
interface QuestionSwipeCardProps {
  tracker: Tracker;
  currentAnswer: boolean | undefined;
  onAnswer: (value: boolean) => void;
}

const SWIPE_THRESHOLD = 100;

const QuestionSwipeCard = ({ tracker, currentAnswer, onAnswer }: QuestionSwipeCardProps) => {
  const { t } = useTranslation();
  // If "yes" is the significant/problematic answer, yes=red and no=green; otherwise inverted
  const yesIsSignificant = tracker.problemWhen === "yes";
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startX = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    startX.current = e.touches[0].clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;
    const diff = e.touches[0].clientX - startX.current;
    setSwipeX(diff);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (!isSwiping) return;
    setIsSwiping(false);

    if (swipeX > SWIPE_THRESHOLD) {
      onAnswer(true);
    } else if (swipeX < -SWIPE_THRESHOLD) {
      onAnswer(false);
    }

    setSwipeX(0);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    startX.current = e.clientX;
    setIsSwiping(true);
    
    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX.current;
      setSwipeX(diff);
    };

    const handleMouseUp = () => {
      setIsSwiping(false);
      
      if (swipeX > SWIPE_THRESHOLD) {
        onAnswer(true);
      } else if (swipeX < -SWIPE_THRESHOLD) {
        onAnswer(false);
      }
      
      setSwipeX(0);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const getSwipeOpacity = () => {
    return Math.min(Math.abs(swipeX) / SWIPE_THRESHOLD, 1);
  };

  return (
    <div className="relative">
      {/* Swipe indicators — color follows significance direction */}
      <div
        className={`absolute inset-y-0 left-0 w-24 flex items-center justify-start pl-4 rounded-l-2xl transition-opacity pointer-events-none ${yesIsSignificant ? "bg-balanced/20" : "bg-strong/20"}`}
        style={{ opacity: swipeX < 0 ? getSwipeOpacity() : 0 }}
      >
        <div className={`flex items-center gap-2 font-medium ${yesIsSignificant ? "text-balanced" : "text-strong"}`}>
          <X className="h-6 w-6" />
          <span>{t("common.no")}</span>
        </div>
      </div>
      <div
        className={`absolute inset-y-0 right-0 w-24 flex items-center justify-end pr-4 rounded-r-2xl transition-opacity pointer-events-none ${yesIsSignificant ? "bg-strong/20" : "bg-balanced/20"}`}
        style={{ opacity: swipeX > 0 ? getSwipeOpacity() : 0 }}
      >
        <div className={`flex items-center gap-2 font-medium ${yesIsSignificant ? "text-strong" : "text-balanced"}`}>
          <span>{t("common.yes")}</span>
          <Check className="h-6 w-6" />
        </div>
      </div>

      {/* Main card */}
      <Card
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        className={cn(
          "card-premium overflow-hidden cursor-pointer select-none transition-transform duration-200"
        )}
        style={{
          transform: `translateX(${swipeX}px)`,
        }}
      >
        <CardContent className="p-5">
          <p className="text-base leading-relaxed mb-5">
            {localizeTrackerQuestion(tracker.questionText)}
          </p>

          {/* Current answer indicator */}
          {currentAnswer !== undefined && (
            <div className="mb-4 flex items-center gap-2">
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium",
                  currentAnswer === true
                    ? yesIsSignificant ? "bg-strong/10 text-strong" : "bg-balanced/10 text-balanced"
                    : yesIsSignificant ? "bg-balanced/10 text-balanced" : "bg-strong/10 text-strong"
                )}
              >
                {currentAnswer === true ? (
                  <><Check className="h-3 w-3" />{t("common.yes")}</>
                ) : (
                  <><X className="h-3 w-3" />{t("common.no")}</>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{t("trackerDetails.currentAnswer")}</span>
            </div>
          )}

          {/* Yes/No Buttons */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="lg"
              onClick={(e) => { e.stopPropagation(); onAnswer(false); }}
              className={cn(
                "flex-1 rounded-full border transition-all",
                currentAnswer === false
                  ? yesIsSignificant
                    ? "bg-balanced text-balanced-foreground border-balanced hover:bg-balanced/90"
                    : "bg-strong text-strong-foreground border-strong hover:bg-strong/90"
                  : yesIsSignificant
                    ? "border-border hover:bg-balanced/10 hover:text-balanced hover:border-balanced"
                    : "border-border hover:bg-strong/10 hover:text-strong hover:border-strong"
              )}
            >
              <X className="h-5 w-5 mr-2" />
              {t("common.no")}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={(e) => { e.stopPropagation(); onAnswer(true); }}
              className={cn(
                "flex-1 rounded-full border transition-all",
                currentAnswer === true
                  ? yesIsSignificant
                    ? "bg-strong text-strong-foreground border-strong hover:bg-strong/90"
                    : "bg-balanced text-balanced-foreground border-balanced hover:bg-balanced/90"
                  : yesIsSignificant
                    ? "border-border hover:bg-strong/10 hover:text-strong hover:border-strong"
                    : "border-border hover:bg-balanced/10 hover:text-balanced hover:border-balanced"
              )}
            >
              <Check className="h-5 w-5 mr-2" />
              {t("common.yes")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
