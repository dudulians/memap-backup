import { useState, useRef, useMemo, useEffect } from "react";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { Note, getNotes } from "@/lib/notes";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, CheckSquare, Square, FileText } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, isFuture, getYear } from "date-fns";
import { getTrackerIcon, getCategoryColor } from "@/lib/categoryHelpers";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { getLanguage } from "@/lib/i18n";
import { ru as ruLocale } from "date-fns/locale";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";

type CalendarView = "month" | "year";

interface OverviewCardProps {
  trackers: Tracker[];
  entries: TrackerEntry[];
  selectedDate: string;
  onDateSelect: (date: string) => void;
  onTrackerSelect: (tracker: Tracker) => void;
  onAddTracker?: () => void;
  onDayEdit?: (tracker: Tracker, date: string, existingEntry?: TrackerEntry) => void;
  onBulkAnswer?: (trackerId: string, dates: string[], value: boolean | null) => void;
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export const OverviewCard = ({
  trackers,
  entries,
  selectedDate,
  onDateSelect,
  onTrackerSelect,
  onAddTracker,
  onDayEdit,
  onBulkAnswer,
}: OverviewCardProps) => {
  const { t } = useTranslation();
  const dateLocale = getLanguage() === "ru" ? ruLocale : undefined;
  const [activeTrackerIndex, setActiveTrackerIndex] = useState(0);
  const [displayMonth, setDisplayMonth] = useState(() => new Date());
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [calendarView, setCalendarView] = useState<CalendarView>("month");
  const [notes, setNotes] = useState<Note[]>([]);

  const reloadNotes = () => getNotes().then(setNotes);

  useEffect(() => {
    reloadNotes();
    window.addEventListener("memap-notes-changed", reloadNotes);
    return () => window.removeEventListener("memap-notes-changed", reloadNotes);
  }, []);

  const noteDatesSet = useMemo(() => {
    const s = new Set<string>();
    notes.forEach(n => s.add(n.date));
    return s;
  }, [notes]);

  const notesForSelectedDate = useMemo(
    () => notes.filter(n => n.date === selectedDate),
    [notes, selectedDate]
  );
  const swipeStartX = useRef(0);
  const chipsContainerRef = useRef<HTMLDivElement>(null);

  const activeTracker = trackers[activeTrackerIndex];

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Build entry lookup map for active tracker
  const entryMap = useMemo(() => {
    if (!activeTracker) return new Map<string, TrackerEntry>();
    const map = new Map<string, TrackerEntry>();
    entries
      .filter((e) => e.trackerId === activeTracker.id)
      .forEach((e) => map.set(e.date, e));
    return map;
  }, [entries, activeTracker]);

  // Generate mini calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(displayMonth);
    const monthEnd = endOfMonth(displayMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days: {
      date: Date;
      dateStr: string;
      isCurrentMonth: boolean;
      isFutureDate: boolean;
      isSelected: boolean;
      isToday: boolean;
      status: "balanced" | "significant" | "untracked";
    }[] = [];
    
    let currentDay = calendarStart;

    while (currentDay <= calendarEnd) {
      const dateStr = format(currentDay, "yyyy-MM-dd");
      const entry = entryMap.get(dateStr);
      const isCurrentMonth = isSameMonth(currentDay, displayMonth);
      const isFutureDate = isFuture(currentDay);
      const isToday = isSameDay(currentDay, today);
      const isSelected = selectedDate === dateStr;

      let status: "balanced" | "significant" | "untracked" = "untracked";
      if (entry && activeTracker) {
        const isSignificant =
          activeTracker.problemWhen === "yes" ? entry.value === true : entry.value === false;
        status = isSignificant ? "significant" : "balanced";
      }

      days.push({
        date: new Date(currentDay),
        dateStr,
        isCurrentMonth,
        isFutureDate,
        isSelected,
        isToday,
        status,
      });

      currentDay = addDays(currentDay, 1);
    }

    return days;
  }, [displayMonth, entryMap, activeTracker, selectedDate, today]);

  // Year view: last 12 months of data
  const yearData = useMemo(() => {
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const monthDate = subMonths(today, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      const days: { dateStr: string; status: "significant" | "balanced" | "untracked" | "future" | "outside" }[] = [];
      let cur = calStart;
      while (cur <= calEnd) {
        const dateStr = format(cur, "yyyy-MM-dd");
        const inMonth = isSameMonth(cur, monthDate);
        const future = isFuture(cur);
        if (!inMonth) {
          days.push({ dateStr, status: "outside" });
        } else if (future) {
          days.push({ dateStr, status: "future" });
        } else {
          const entry = entryMap.get(dateStr);
          if (entry && activeTracker) {
            const sig = activeTracker.problemWhen === "yes" ? entry.value === true : entry.value === false;
            days.push({ dateStr, status: sig ? "significant" : "balanced" });
          } else {
            days.push({ dateStr, status: "untracked" });
          }
        }
        cur = addDays(cur, 1);
      }
      const lbl = format(monthDate, "MMM", { locale: dateLocale });
      months.push({ monthDate, label: lbl.charAt(0).toUpperCase() + lbl.slice(1), days });
    }
    return months;
  }, [entryMap, activeTracker, today, dateLocale]);

  // Calculate metrics for displayed month
  const monthStats = useMemo(() => {
    const monthDays = calendarDays.filter((d) => d.isCurrentMonth && !d.isFutureDate);
    const trackedDays = monthDays.filter((d) => d.status !== "untracked").length;
    const significantDays = monthDays.filter((d) => d.status === "significant").length;
    return { trackedDays, significantDays };
  }, [calendarDays]);

  // Auto-scroll chips to show active chip
  useEffect(() => {
    if (chipsContainerRef.current) {
      const container = chipsContainerRef.current;
      const activeChip = container.children[activeTrackerIndex] as HTMLElement;
      if (activeChip) {
        const containerRect = container.getBoundingClientRect();
        const chipRect = activeChip.getBoundingClientRect();
        
        if (chipRect.left < containerRect.left || chipRect.right > containerRect.right) {
          activeChip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }
    }
  }, [activeTrackerIndex]);

  // Clear selection when tracker changes
  useEffect(() => {
    setSelectedDates(new Set());
  }, [activeTrackerIndex]);

  const handlePrevTracker = () => {
    setActiveTrackerIndex((prev) => (prev > 0 ? prev - 1 : trackers.length - 1));
  };

  const handleNextTracker = () => {
    setActiveTrackerIndex((prev) => (prev < trackers.length - 1 ? prev + 1 : 0));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientX - swipeStartX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        handlePrevTracker();
      } else {
        handleNextTracker();
      }
    }
  };

  const handlePrevMonth = () => {
    setDisplayMonth((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    const nextMonth = addMonths(displayMonth, 1);
    if (startOfMonth(nextMonth) <= startOfMonth(today)) {
      setDisplayMonth(nextMonth);
    }
  };

  const canGoNextMonth = startOfMonth(addMonths(displayMonth, 1)) <= startOfMonth(today);

  const handleDayClick = (day: typeof calendarDays[0]) => {
    if (day.isFutureDate || !day.isCurrentMonth) return;
    
    if (multiSelectMode) {
      const newSelected = new Set(selectedDates);
      if (newSelected.has(day.dateStr)) {
        newSelected.delete(day.dateStr);
      } else {
        newSelected.add(day.dateStr);
      }
      setSelectedDates(newSelected);
    } else {
      onDateSelect(day.dateStr);
      if (onDayEdit && activeTracker) {
        const existingEntry = entryMap.get(day.dateStr);
        onDayEdit(activeTracker, day.dateStr, existingEntry);
      }
    }
  };

  const handleBulkAction = (value: boolean | null) => {
    if (selectedDates.size > 0 && onBulkAnswer && activeTracker) {
      onBulkAnswer(activeTracker.id, Array.from(selectedDates), value);
      setSelectedDates(new Set());
    }
  };

  const toggleMultiSelect = () => {
    setMultiSelectMode(!multiSelectMode);
    if (multiSelectMode) {
      setSelectedDates(new Set());
    }
  };

  const getStatusClass = (day: typeof calendarDays[0]) => {
    if (!day.isCurrentMonth) {
      return "bg-transparent text-transparent";
    }
    if (day.isFutureDate) {
      return "bg-transparent border border-dashed border-muted-foreground/25 text-muted-foreground/40";
    }

    if (day.status === "significant") {
      return "bg-strong/70 text-strong-foreground";
    } else if (day.status === "balanced") {
      return "bg-balanced/70 text-balanced-foreground";
    }
    return "bg-card border border-untracked text-untracked-foreground";
  };

  const isDateMultiSelected = (dateStr: string) => selectedDates.has(dateStr);

  // Empty state
  if (trackers.length === 0) {
    return (
      <Card className="card-premium overflow-hidden animate-fade-in">
        <CardContent className="p-6 text-center">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">{t("overview.heading")}</h2>
          <div className="py-8 space-y-4">
            <p className="text-lg font-medium text-foreground">{t("overview.noPatternsTitle")}</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              {t("overview.noPatternsDesc")}
            </p>
            {onAddTracker && (
              <Button
                onClick={onAddTracker}
                className="rounded-full mt-2"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("overview.startTracking")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!activeTracker) {
    return null;
  }

  const categoryColor = getCategoryColor(activeTracker.category);

  return (
    <Card className="card-premium overflow-hidden animate-fade-in">
      <CardContent className="p-3">
        {/* Header with title, view toggle and pattern navigation arrows */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("overview.heading")}</h2>
            <div className="flex items-center bg-muted/50 rounded-full p-0.5">
              <button
                onClick={() => setCalendarView("month")}
                className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-all",
                  calendarView === "month" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >{t("overview.month")}</button>
              <button
                onClick={() => setCalendarView("year")}
                className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-all",
                  calendarView === "year" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >{t("overview.year")}</button>
            </div>
          </div>

          {/* Pattern navigation arrows */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevTracker}
              className="h-7 w-7 rounded-full"
              aria-label={t("overview.prevPattern")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums min-w-[3ch] text-center">
              {activeTrackerIndex + 1}/{trackers.length}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextTracker}
              className="h-7 w-7 rounded-full"
              aria-label={t("overview.nextPattern")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Pattern chips — moved tight to the top so the calendar is
            visible above the fold. The previously-redundant
            "Календарь для:" label is dropped — the active chip already
            highlights the chosen tracker. */}
        <div className="mb-2">
          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-card to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-card to-transparent z-10 pointer-events-none" />

            <div
              ref={chipsContainerRef}
              className="flex gap-2 overflow-x-auto pb-1 px-1 scrollbar-hide scroll-smooth"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {trackers.map((tracker, index) => {
                const isActive = index === activeTrackerIndex;
                const Icon = getTrackerIcon(tracker.title, tracker.category);
                return (
                  <button
                    key={tracker.id}
                    onClick={() => setActiveTrackerIndex(index)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs whitespace-nowrap transition-all duration-200 flex-shrink-0",
                      isActive
                        ? "bg-foreground text-background font-semibold shadow-md scale-105"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted/70 font-medium"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={isActive ? 2.25 : 1.75} />
                    <span>{localizeTrackerTitle(tracker.title)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Compact stats row — single line, replaces the two big tiles
            so the calendar comes up immediately. */}
        <div
          className="flex items-center justify-between gap-3 px-1 mb-3 text-xs"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <span className="text-muted-foreground">
            <span className="font-serif text-base font-medium tabular-nums text-foreground mr-1">{monthStats.trackedDays}</span>
            {t("overview.daysTracked").toLowerCase()}
          </span>
          <span className="text-muted-foreground">
            <span className="font-serif text-base font-medium tabular-nums text-strong mr-1">{monthStats.significantDays}</span>
            {t("overview.significantDaysStat").toLowerCase()}
          </span>
        </div>

        {/* Year View */}
        {calendarView === "year" && (
          <div className="space-y-3 animate-fade-in">
            <div className="grid grid-cols-3 gap-3">
              {yearData.map(({ monthDate, label, days }) => (
                <div key={label + getYear(monthDate)} className="space-y-1">
                  <p className="text-[10px] font-medium text-center text-muted-foreground">{label}</p>
                  <div className="grid grid-cols-7 gap-px">
                    {days.map((day, i) => (
                      <button
                        key={i}
                        disabled={day.status === "outside" || day.status === "future"}
                        onClick={() => {
                          if (day.status === "outside" || day.status === "future") return;
                          onDateSelect(day.dateStr);
                          setDisplayMonth(new Date(day.dateStr + "T00:00:00"));
                          setCalendarView("month");
                        }}
                        className={cn(
                          "aspect-square rounded-sm transition-all relative",
                          day.status === "significant" && "bg-strong/70",
                          day.status === "balanced" && "bg-balanced/70",
                          day.status === "untracked" && "bg-muted/40 border border-border/30",
                          (day.status === "outside" || day.status === "future") && "bg-transparent",
                          day.status !== "outside" && day.status !== "future" && "hover:opacity-70 cursor-pointer"
                        )}
                      >
                        {day.status !== "outside" && day.status !== "future" && noteDatesSet.has(day.dateStr) && (
                          <div className="absolute bottom-[2px] left-1/2 -translate-x-1/2 w-1.5 h-[1px] bg-foreground/60 rounded-full" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {/* Legend */}
            <div className="flex items-center justify-center gap-4 text-[10px] pt-1 text-muted-foreground">
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-balanced" /><span>{t("overview.balanced")}</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-strong" /><span>{t("overview.significant")}</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-muted/40 border border-border/30" /><span>{t("overview.untracked")}</span></div>
            </div>
          </div>
        )}

        {/* Mini Calendar */}
        {calendarView === "month" && <div
          className="space-y-2"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Month navigation with multi-select toggle */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevMonth}
              className="h-7 w-7 rounded-full"
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-medium">
                {(() => {
                  const s = format(displayMonth, "LLLL yyyy", { locale: dateLocale });
                  return s.charAt(0).toUpperCase() + s.slice(1);
                })()}
              </h3>
              {onBulkAnswer && (
                <Button
                  variant={multiSelectMode ? "default" : "outline"}
                  size="sm"
                  onClick={toggleMultiSelect}
                  className="h-6 px-2 text-[10px] rounded-full"
                >
                  {multiSelectMode ? (
                    <><CheckSquare className="h-3 w-3 mr-1" /> {t("overview.multi")}</>
                  ) : (
                    <><Square className="h-3 w-3 mr-1" /> {t("overview.multi")}</>
                  )}
                </Button>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextMonth}
              disabled={!canGoNextMonth}
              className="h-7 w-7 rounded-full"
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>

          {/* Weekday headers — compact so the calendar grid sits higher */}
          <div className="grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map((day, i) => (
              <div
                key={i}
                className="text-center text-[10px] font-medium text-muted-foreground py-0.5"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid — fixed-height rows (~32px each) so the whole
              month fits above the bottom nav without scrolling. Was
              aspect-square (~50px), eating ~100px across 6 rows. */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => (
              <div key={day.dateStr} className="h-8 flex items-center justify-center">
              <button
                onClick={() => handleDayClick(day)}
                disabled={day.isFutureDate || !day.isCurrentMonth}
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center transition-all text-[10px] font-medium relative",
                  getStatusClass(day),
                  day.isCurrentMonth && !day.isFutureDate && "cursor-pointer",
                  !multiSelectMode && day.isSelected && day.isCurrentMonth && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                  day.isToday && day.isCurrentMonth && !day.isSelected && "ring-2 ring-foreground/50",
                  day.isToday && day.isCurrentMonth && "font-extrabold text-[11px]",
                  multiSelectMode && isDateMultiSelected(day.dateStr) && "ring-2 ring-primary ring-offset-1 ring-offset-background scale-90",
                )}
              >
                {day.isCurrentMonth ? format(day.date, "d") : ""}
                {!multiSelectMode && day.isCurrentMonth && noteDatesSet.has(day.dateStr) && (
                  <div className="absolute bottom-[18%] left-1/2 -translate-x-1/2 w-2.5 h-[1.5px] bg-foreground/60 rounded-full" />
                )}
                {multiSelectMode && isDateMultiSelected(day.dateStr) && (
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full" />
                )}
              </button>
              </div>
            ))}
          </div>

          {/* Bulk edit panel — compact one-line layout: count on the
              left, action buttons on the right. Saves vertical space so
              the calendar above stays visible without scrolling. */}
          {multiSelectMode && selectedDates.size > 0 && (
            <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2 animate-fade-in">
              <p className="text-[11px] font-medium text-muted-foreground flex-shrink-0">
                {selectedDates.size === 1 ? t("overview.datesSelectedOne") : t("overview.datesSelectedMany", { count: selectedDates.size })}
              </p>
              <div className="flex items-center gap-1.5 ml-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleBulkAction(false)}
                  className={cn(
                    "h-7 px-3 text-xs rounded-full text-white",
                    activeTracker.problemWhen === "yes"
                      ? "bg-balanced hover:bg-balanced/90"
                      : "bg-strong hover:bg-strong/90"
                  )}
                >
                  {t("common.no")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleBulkAction(true)}
                  className={cn(
                    "h-7 px-3 text-xs rounded-full text-white",
                    activeTracker.problemWhen === "yes"
                      ? "bg-strong hover:bg-strong/90"
                      : "bg-balanced hover:bg-balanced/90"
                  )}
                >
                  {t("common.yes")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleBulkAction(null)}
                  className="h-7 px-2 text-xs rounded-full text-muted-foreground hover:text-foreground"
                >
                  {t("common.clear")}
                </Button>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center justify-center flex-wrap gap-x-4 gap-y-1 text-[10px] pt-2 text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-balanced flex items-center justify-center text-[6px] text-balanced-foreground font-medium">7</div>
              <span>{t("overview.balanced")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-strong flex items-center justify-center text-[6px] text-strong-foreground font-medium">7</div>
              <span>{t("overview.significant")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-card border border-untracked flex items-center justify-center text-[6px] text-untracked-foreground font-medium">7</div>
              <span>{t("overview.untracked")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="relative w-3 h-3 rounded-full bg-muted flex items-center justify-center">
                <div className="w-2 h-[1.5px] rounded-full bg-foreground/60 absolute bottom-[15%] left-1/2 -translate-x-1/2" />
              </div>
              <span>{t("overview.noteLegend")}</span>
            </div>
          </div>
        </div>}

        {/* Note preview for selected date */}
        {notesForSelectedDate.length > 0 && (
          <div className="mt-4 space-y-2 animate-fade-in">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-3 w-3" />
                {notesForSelectedDate.length === 1 ? t("overview.noteOne") : t("overview.noteMany", { count: notesForSelectedDate.length })} · {format(new Date(selectedDate + "T00:00:00"), "d MMM", { locale: dateLocale })}
              </p>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("memap-open-notes", { detail: { date: selectedDate } }))}
                className="text-xs text-primary hover:underline font-medium"
              >
                {t("overview.openInNotes")}
              </button>
            </div>
            {notesForSelectedDate.slice(0, 2).map(note => (
              <div
                key={note.id}
                className="p-3 rounded-xl bg-muted/40 border border-border/60 cursor-pointer hover:bg-muted/60 transition-colors"
                onClick={() => window.dispatchEvent(new CustomEvent("memap-open-notes", { detail: { date: selectedDate } }))}
              >
                <p className="text-xs text-foreground/80 line-clamp-2">{note.text}</p>
              </div>
            ))}
          </div>
        )}

      </CardContent>
    </Card>
  );
};
