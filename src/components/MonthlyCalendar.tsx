import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, isFuture } from "date-fns";
import { TrackerEntry } from "@/types/tracker";
import { cn } from "@/lib/utils";

interface MonthlyCalendarProps {
  trackerId: string;
  entries: TrackerEntry[];
  problemWhen: "yes" | "no";
  selectedDate?: string;
  onDateSelect?: (date: string) => void;
  onBulkAnswer?: (dates: string[], value: boolean | null) => void;
}

interface DayData {
  date: Date;
  dateStr: string;
  isCurrentMonth: boolean;
  isFutureDate: boolean;
  isSelected: boolean;
  isToday: boolean;
  status: "balanced" | "significant" | "untracked";
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const MonthlyCalendar = ({
  trackerId,
  entries,
  problemWhen,
  selectedDate,
  onDateSelect,
  onBulkAnswer,
}: MonthlyCalendarProps) => {
  const [displayMonth, setDisplayMonth] = useState(() => {
    if (selectedDate) {
      return new Date(selectedDate + "T00:00:00");
    }
    return new Date();
  });

  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Build entry lookup map for this tracker
  const entryMap = useMemo(() => {
    const map = new Map<string, TrackerEntry>();
    entries
      .filter((e) => e.trackerId === trackerId)
      .forEach((e) => map.set(e.date, e));
    return map;
  }, [entries, trackerId]);

  // Generate calendar grid
  const calendarDays = useMemo((): DayData[] => {
    const monthStart = startOfMonth(displayMonth);
    const monthEnd = endOfMonth(displayMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days: DayData[] = [];
    let currentDay = calendarStart;

    while (currentDay <= calendarEnd) {
      const dateStr = format(currentDay, "yyyy-MM-dd");
      const entry = entryMap.get(dateStr);
      const isCurrentMonth = isSameMonth(currentDay, displayMonth);
      const isFutureDate = isFuture(currentDay);
      const isToday = isSameDay(currentDay, today);
      const isSelected = selectedDate === dateStr;

      let status: "balanced" | "significant" | "untracked" = "untracked";
      if (entry) {
        const isSignificant =
          problemWhen === "yes" ? entry.value === true : entry.value === false;
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
  }, [displayMonth, entryMap, problemWhen, selectedDate, today]);

  // Calculate metrics for the displayed month
  const monthStats = useMemo(() => {
    const monthDays = calendarDays.filter((d) => d.isCurrentMonth && !d.isFutureDate);
    const trackedDays = monthDays.filter((d) => d.status !== "untracked").length;
    const significantDays = monthDays.filter((d) => d.status === "significant").length;
    return { trackedDays, significantDays };
  }, [calendarDays]);

  const handlePrevMonth = () => {
    setDisplayMonth((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    const nextMonth = addMonths(displayMonth, 1);
    if (startOfMonth(nextMonth) <= startOfMonth(today)) {
      setDisplayMonth(nextMonth);
    }
  };

  const canGoNext = startOfMonth(addMonths(displayMonth, 1)) <= startOfMonth(today);

  const handleDayClick = (day: DayData) => {
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
      onDateSelect?.(day.dateStr);
    }
  };

  const handleBulkAction = (value: boolean | null) => {
    if (selectedDates.size > 0 && onBulkAnswer) {
      onBulkAnswer(Array.from(selectedDates), value);
      setSelectedDates(new Set());
    }
  };

  const toggleMultiSelect = () => {
    setMultiSelectMode(!multiSelectMode);
    if (multiSelectMode) {
      setSelectedDates(new Set());
    }
  };

  const getStatusClass = (day: DayData) => {
    if (!day.isCurrentMonth || day.isFutureDate) {
      return "bg-transparent text-muted-foreground/30";
    }
    
    if (day.status === "significant") {
      return "bg-strong text-strong-foreground";
    } else if (day.status === "balanced") {
      return "bg-balanced text-balanced-foreground";
    }
    return "bg-card border border-untracked text-untracked-foreground";
  };

  const isDateMultiSelected = (dateStr: string) => selectedDates.has(dateStr);

  return (
    <div className="space-y-4">
      {/* Month navigation and multi-select toggle */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrevMonth}
          className="h-8 w-8 rounded-full"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">
            {format(displayMonth, "MMMM yyyy")}
          </h3>
          {onBulkAnswer && (
            <Button
              variant={multiSelectMode ? "default" : "outline"}
              size="sm"
              onClick={toggleMultiSelect}
              className="h-7 px-2 text-xs rounded-full"
            >
              {multiSelectMode ? (
                <><CheckSquare className="h-3 w-3 mr-1" /> Multi</>
              ) : (
                <><Square className="h-3 w-3 mr-1" /> Multi</>
              )}
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNextMonth}
          disabled={!canGoNext}
          className="h-8 w-8 rounded-full"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Month stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-muted/50 text-center">
          <p className="text-xl font-bold">{monthStats.trackedDays}</p>
          <p className="text-xs text-muted-foreground">Days tracked</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/50 text-center">
          <p className="text-xl font-bold">{monthStats.significantDays}</p>
          <p className="text-xs text-muted-foreground">Significant days</p>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-muted-foreground py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day) => (
          <button
            key={day.dateStr}
            onClick={() => handleDayClick(day)}
            disabled={day.isFutureDate || !day.isCurrentMonth}
            className={cn(
              "aspect-square rounded-full flex items-center justify-center text-xs font-medium transition-all relative",
              getStatusClass(day),
              day.isCurrentMonth && !day.isFutureDate && "cursor-pointer hover:ring-2 hover:ring-primary/50",
              !multiSelectMode && day.isSelected && day.isCurrentMonth && "ring-2 ring-primary ring-offset-2 ring-offset-background",
              day.isToday && day.isCurrentMonth && "font-bold",
              multiSelectMode && isDateMultiSelected(day.dateStr) && "ring-2 ring-primary ring-offset-1 ring-offset-background scale-95"
            )}
          >
            {day.isCurrentMonth ? format(day.date, "d") : ""}
            {multiSelectMode && isDateMultiSelected(day.dateStr) && (
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Bulk edit panel */}
      {multiSelectMode && selectedDates.size > 0 && (
        <div className="fixed bottom-20 left-4 right-4 bg-background border rounded-xl shadow-lg p-4 space-y-3 z-40 animate-fade-in">
          <p className="text-sm font-medium text-center">
            {selectedDates.size} date{selectedDates.size !== 1 ? 's' : ''} selected
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Button
              size="sm"
              onClick={() => handleBulkAction(false)}
              className={`rounded-full ${problemWhen === "yes" ? "bg-balanced hover:bg-balanced/90 text-balanced-foreground" : "bg-strong hover:bg-strong/90 text-strong-foreground"}`}
            >
              Set No
            </Button>
            <Button
              size="sm"
              onClick={() => handleBulkAction(true)}
              className={`rounded-full ${problemWhen === "yes" ? "bg-strong hover:bg-strong/90 text-strong-foreground" : "bg-balanced hover:bg-balanced/90 text-balanced-foreground"}`}
            >
              Set Yes
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkAction(null)}
              className="rounded-full"
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs pt-2">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-balanced flex items-center justify-center text-[8px] text-balanced-foreground font-medium">7</div>
          <span className="text-muted-foreground">Balanced</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-strong flex items-center justify-center text-[8px] text-strong-foreground font-medium">7</div>
          <span className="text-muted-foreground">Significant</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-card border border-untracked flex items-center justify-center text-[8px] text-untracked-foreground font-medium">7</div>
          <span className="text-muted-foreground">Untracked</span>
        </div>
      </div>
    </div>
  );
};
