import { format, subDays, addDays, isToday, isFuture } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ru as ruLocale } from "date-fns/locale";
import { getLanguage } from "@/lib/i18n";

interface DateSelectorProps {
  selectedDate: string; // YYYY-MM-DD
  onDateChange: (date: string) => void;
  highlightedDates?: string[]; // dates with entries
}

export const DateSelector = ({ selectedDate, onDateChange, highlightedDates = [] }: DateSelectorProps) => {
  const dateLocale = getLanguage() === "ru" ? ruLocale : undefined;
  const dateObj = new Date(selectedDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const canGoForward = !isToday(dateObj) && !isFuture(dateObj);

  const handlePrevious = () => {
    const prevDate = subDays(dateObj, 1);
    onDateChange(format(prevDate, "yyyy-MM-dd"));
  };

  const handleNext = () => {
    if (!canGoForward) return;
    const nextDate = addDays(dateObj, 1);
    if (!isFuture(nextDate)) {
      onDateChange(format(nextDate, "yyyy-MM-dd"));
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date && !isFuture(date)) {
      onDateChange(format(date, "yyyy-MM-dd"));
    }
  };

  const highlightedDatesSet = new Set(highlightedDates);

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePrevious}
        className="h-8 w-8 rounded-full"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "min-w-[180px] justify-center text-sm font-medium rounded-full gap-2",
              !isToday(dateObj) && "bg-muted/50"
            )}
          >
            <CalendarIcon className="h-4 w-4" />
            {format(dateObj, "d MMMM yyyy", { locale: dateLocale })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="center">
          <Calendar
            mode="single"
            selected={dateObj}
            onSelect={handleCalendarSelect}
            disabled={(date) => isFuture(date)}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
            modifiers={{
              hasEntry: (date) => highlightedDatesSet.has(format(date, "yyyy-MM-dd")),
            }}
            modifiersStyles={{
              hasEntry: {
                fontWeight: "bold",
                textDecoration: "underline",
                textUnderlineOffset: "3px",
              },
            }}
          />
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="icon"
        onClick={handleNext}
        disabled={!canGoForward}
        className="h-8 w-8 rounded-full"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};
