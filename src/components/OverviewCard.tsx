// Calendar (Patterns → Calendar), 1.8.0: question chips on top, one big
// count for the month ("7 fights", "12 days with No"), and the month as
// big day circles. Tap a day to change its answer. The Year view, the
// Multi bulk-select and the colour legend are gone (design rule: people
// who hate reading). Canvas "MeMap: новая версия", page 12, RestCalendar.
import { useState, useRef, useMemo, useEffect } from "react";
import { MoodLegend, moodOf } from "./mw/DayMark";
import { Glyph } from "./mw/Glyph";
import { PencilCurl, TopicIcon, topicKind } from "./mw/TopicIcon";
import { tilt } from "./mw/WeekMap";
import type { DoorId } from "@/lib/doors";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { Note, getNotes } from "@/lib/notes";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, isFuture } from "date-fns";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { getLanguage } from "@/lib/i18n";
import { ru as ruLocale } from "date-fns/locale";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import { haptics } from "@/lib/haptics";
import { getDoorState } from "@/lib/doors";

interface OverviewCardProps {
  trackers: Tracker[];
  entries: TrackerEntry[];
  selectedDate: string;
  onDateSelect: (date: string) => void;
  onDayEdit?: (tracker: Tracker, date: string, existingEntry?: TrackerEntry) => void;
}

// 2024-01-01 was a Monday: seven days from it give localized weekday
// letters in calendar order.
const MONDAY = new Date(2024, 0, 1);

export const OverviewCard = ({
  trackers: allTrackers,
  entries,
  selectedDate,
  onDateSelect,
  onDayEdit,
}: OverviewCardProps) => {
  const { t } = useTranslation();
  const dateLocale = getLanguage() === "ru" ? ruLocale : undefined;
  const trackers = useMemo(() => allTrackers.filter((tr) => !tr.archived), [allTrackers]);

  // Door questions count in their own words ("7 fights").
  const doorOf = useMemo(() => {
    const state = getDoorState();
    const map = new Map<string, string>();
    if (state) {
      map.set(state.trackerId, state.id);
      for (const x of state.extra ?? []) map.set(x.trackerId, x.id);
    }
    return map;
  }, []);

  // Start on the main door question when there is one.
  const [activeTrackerIndex, setActiveTrackerIndex] = useState(() => {
    const main = getDoorState()?.trackerId;
    const i = main ? trackers.findIndex((tr) => tr.id === main) : -1;
    return i >= 0 ? i : 0;
  });
  const [displayMonth, setDisplayMonth] = useState(() => new Date());
  const [notes, setNotes] = useState<Note[]>([]);

  const reloadNotes = () => getNotes().then(setNotes);

  useEffect(() => {
    reloadNotes();
    window.addEventListener("memap-notes-changed", reloadNotes);
    return () => window.removeEventListener("memap-notes-changed", reloadNotes);
  }, []);

  // Only surface notes that are linked to the currently-active tracker
  // on its calendar — otherwise a partner-conflict note bleeds into the
  // migraine calendar and confuses the per-tracker view.
  const activeTracker = trackers[activeTrackerIndex] ?? trackers[0];
  const activeTrackerId = activeTracker?.id;
  const notesForActiveTracker = useMemo(
    () => notes.filter(n => n.linkedPatternId === activeTrackerId),
    [notes, activeTrackerId]
  );

  const noteDatesSet = useMemo(() => {
    const s = new Set<string>();
    notesForActiveTracker.forEach(n => s.add(n.date));
    return s;
  }, [notesForActiveTracker]);

  const notesForSelectedDate = useMemo(
    () => notesForActiveTracker.filter(n => n.date === selectedDate),
    [notesForActiveTracker, selectedDate]
  );

  // Notes across ALL trackers for the selected date. Reserves a fixed
  // slot below the calendar so switching questions doesn't make the
  // page jump (see the slot itself).
  const anyNotesForSelectedDate = useMemo(
    () => notes.filter(n => n.date === selectedDate),
    [notes, selectedDate]
  );

  // Horizontal swipe on the month switches the question. Native,
  // non-passive touchmove so the page can't scroll vertically while
  // the swipe is ours (React's synthetic touch handlers are passive).
  const swipeAreaRef = useRef<HTMLDivElement>(null);
  const swipeStateRef = useRef<{ x: number; y: number; claim: "horizontal" | "vertical" | null }>({
    x: 0,
    y: 0,
    claim: null,
  });
  const chipsContainerRef = useRef<HTMLDivElement>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const entryMap = useMemo(() => {
    if (!activeTracker) return new Map<string, TrackerEntry>();
    const map = new Map<string, TrackerEntry>();
    entries
      .filter((e) => e.trackerId === activeTracker.id)
      .forEach((e) => map.set(e.date, e));
    return map;
  }, [entries, activeTracker]);

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
      let status: "balanced" | "significant" | "untracked" = "untracked";
      if (entry && activeTracker) {
        const isSignificant =
          activeTracker.problemWhen === "yes" ? entry.value === true : entry.value === false;
        status = isSignificant ? "significant" : "balanced";
      }
      days.push({
        date: new Date(currentDay),
        dateStr,
        isCurrentMonth: isSameMonth(currentDay, displayMonth),
        isFutureDate: isFuture(currentDay),
        isSelected: selectedDate === dateStr,
        isToday: isSameDay(currentDay, today),
        status,
      });
      currentDay = addDays(currentDay, 1);
    }
    return days;
  }, [displayMonth, entryMap, activeTracker, selectedDate, today]);

  const monthCount = useMemo(
    () => calendarDays.filter((d) => d.isCurrentMonth && !d.isFutureDate && d.status === "significant").length,
    [calendarDays],
  );

  // Keep the active chip in view.
  useEffect(() => {
    const container = chipsContainerRef.current;
    const activeChip = container?.children[activeTrackerIndex] as HTMLElement | undefined;
    if (!container || !activeChip) return;
    const containerRect = container.getBoundingClientRect();
    const chipRect = activeChip.getBoundingClientRect();
    if (chipRect.left < containerRect.left || chipRect.right > containerRect.right) {
      activeChip.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeTrackerIndex]);

  useEffect(() => {
    const node = swipeAreaRef.current;
    if (!node || trackers.length < 2) return;

    const onStart = (e: TouchEvent) => {
      swipeStateRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, claim: null };
    };
    const onMove = (e: TouchEvent) => {
      const s = swipeStateRef.current;
      const dx = e.touches[0].clientX - s.x;
      const dy = e.touches[0].clientY - s.y;
      if (s.claim === null) {
        const ax = Math.abs(dx);
        const ay = Math.abs(dy);
        if (ax < 8 && ay < 8) return;
        s.claim = ax > ay * 1.5 ? "horizontal" : "vertical";
      }
      if (s.claim === "horizontal") e.preventDefault();
    };
    const onEnd = (e: TouchEvent) => {
      const s = swipeStateRef.current;
      if (s.claim === "horizontal") {
        const dx = e.changedTouches[0].clientX - s.x;
        if (Math.abs(dx) > 50) {
          haptics.swipe();
          if (dx > 0) {
            setActiveTrackerIndex((prev) => (prev > 0 ? prev - 1 : trackers.length - 1));
          } else {
            setActiveTrackerIndex((prev) => (prev < trackers.length - 1 ? prev + 1 : 0));
          }
        }
      }
      swipeStateRef.current = { x: 0, y: 0, claim: null };
    };

    node.addEventListener("touchstart", onStart, { passive: true });
    node.addEventListener("touchmove", onMove, { passive: false });
    node.addEventListener("touchend", onEnd, { passive: true });
    node.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      node.removeEventListener("touchstart", onStart);
      node.removeEventListener("touchmove", onMove);
      node.removeEventListener("touchend", onEnd);
      node.removeEventListener("touchcancel", onEnd);
    };
  }, [trackers.length]);

  const canGoNextMonth = startOfMonth(addMonths(displayMonth, 1)) <= startOfMonth(today);

  const handleDayClick = (day: typeof calendarDays[0]) => {
    if (day.isFutureDate || !day.isCurrentMonth) return;
    // The answer editor has its own haptics on save.
    onDateSelect(day.dateStr);
    if (onDayEdit && activeTracker) onDayEdit(activeTracker, day.dateStr, entryMap.get(day.dateStr));
  };

  if (!activeTracker) return null;

  const doorId = doorOf.get(activeTracker.id);
  const activeKind = topicKind(activeTracker.title, doorId as DoorId | undefined);
  const countLabel = doorId
    ? t(`doors.${doorId}.noun`, { count: monthCount })
    : activeTracker.problemWhen === "yes"
      ? t("overview.daysYes", { count: monthCount })
      : t("overview.daysNo", { count: monthCount });
  const monthTitle = (() => {
    const s = format(displayMonth, "LLLL yyyy", { locale: dateLocale });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();

  return (
    <div className="animate-fade-in">
      {/* Question chips */}
      <div
        ref={chipsContainerRef}
        className="-mx-4 px-4 flex gap-2 overflow-x-auto scrollbar-hide"
        data-no-tabswipe
      >
        {trackers.map((tr, i) => {
          const on = i === activeTrackerIndex;
          return (
            <button
              key={tr.id}
              type="button"
              onClick={() => { haptics.tap(); setActiveTrackerIndex(i); }}
              aria-pressed={on}
              className="mw-chip shrink-0 max-w-[230px] truncate"
            >
              {doorOf.has(tr.id) ? t(`doors.${doorOf.get(tr.id)}.name`) : localizeTrackerTitle(tr.title)}
            </button>
          );
        })}
      </div>

      <div ref={swipeAreaRef} style={{ touchAction: "pan-y" }}>
        {/* Month + the one number that matters */}
        <div className="mt-5 flex items-center gap-1">
          <button
            type="button"
            onClick={() => { haptics.tap(); setDisplayMonth((prev) => subMonths(prev, 1)); }}
            aria-label={t("overview.prevMonth")}
            className="h-9 w-9 -ml-2 rounded-full flex items-center justify-center text-muted-foreground"
          >
            <Glyph kind="left" size={22} />
          </button>
          <p className="flex-1 text-center mw-display text-[21px]">{monthTitle}</p>
          <button
            type="button"
            onClick={() => { if (canGoNextMonth) { haptics.tap(); setDisplayMonth((prev) => addMonths(prev, 1)); } }}
            disabled={!canGoNextMonth}
            aria-label={t("overview.nextMonth")}
            className="h-9 w-9 -mr-2 rounded-full flex items-center justify-center text-muted-foreground disabled:opacity-30"
          >
            <Glyph kind="right" size={22} />
          </button>
        </div>
        {/* One short sentence, not a big number over a label. */}
        <p className="mt-1 text-center mw-hand text-[20px]">
          {monthCount} {countLabel}
        </p>

        <div className="mt-5 grid grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className="text-center text-[14px] font-semibold text-muted-foreground">
              {format(addDays(MONDAY, i), "EEEEEE", { locale: dateLocale })}
            </span>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {calendarDays.map((day) => (
            <div key={day.dateStr}>
              {day.isCurrentMonth ? (
                <button
                  type="button"
                  onClick={() => handleDayClick(day)}
                  disabled={day.isFutureDate}
                  data-today={day.isToday}
                  data-future={day.isFutureDate}
                  data-mood={day.isFutureDate ? undefined : moodOf(activeTracker, entryMap.get(day.dateStr)?.value)}
                  className={cn(
                    "mw-cell !items-start !justify-start p-1 tabular-nums",
                    day.isSelected && !day.isToday && "!shadow-[inset_0_0_0_2px_hsl(var(--foreground)/0.6)]",
                  )}
                >
                  <span className="relative z-[1] text-[13px] leading-none">{format(day.date, "d")}</span>
                  {!day.isFutureDate && entryMap.get(day.dateStr)?.value === true && (
                    <TopicIcon
                      kind={activeKind}
                      size={34}
                      sticker
                      className="absolute right-0 bottom-0"
                      style={{ transform: `rotate(${tilt(day.dateStr + activeTracker.id)}deg)` }}
                    />
                  )}
                  {!day.isFutureDate && entryMap.get(day.dateStr)?.value === false && (
                    <span className="absolute right-1.5 bottom-1.5"><PencilCurl size={18} /></span>
                  )}
                  {noteDatesSet.has(day.dateStr) && (
                    <span className="absolute left-1 bottom-1"><Glyph kind="pencil" size={13} strokeWidth={2.4} /></span>
                  )}
                </button>
              ) : (
                <span className="block aspect-square" />
              )}
            </div>
          ))}
        </div>
        <MoodLegend className="mt-3" />
      </div>

      {/* Notes slot for the selected date. Fixed height whenever ANY
          question has a note on this date, so switching questions can't
          shift the calendar:
            1. Active question has notes → first note + count
            2. Only other questions do → soft hint that opens Notes
            3. No notes on this date → no slot at all. */}
      {anyNotesForSelectedDate.length > 0 && (
        <div className="mt-5 h-[92px]">
          {notesForSelectedDate.length > 0 ? (
            <div key={`notes-${activeTracker.id}`} className="space-y-2 animate-fade-in">
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
              <div
                key={notesForSelectedDate[0].id}
                className="p-3 rounded-2xl bg-muted/40 border border-border/60 cursor-pointer hover:bg-muted/60 transition-colors"
                onClick={() => window.dispatchEvent(new CustomEvent("memap-open-notes", { detail: { date: selectedDate } }))}
              >
                <p className="text-xs text-foreground/80 line-clamp-2">{notesForSelectedDate[0].text}</p>
              </div>
            </div>
          ) : (
            <button
              key={`no-notes-${activeTracker.id}`}
              onClick={() => window.dispatchEvent(new CustomEvent("memap-open-notes", { detail: { date: selectedDate } }))}
              className="w-full h-full p-3 rounded-2xl bg-muted/15 border border-dashed border-border/40 text-left transition-colors hover:bg-muted/30 animate-fade-in flex items-center gap-2"
            >
              <FileText className="h-3 w-3 text-muted-foreground/70 shrink-0" />
              <p className="text-xs text-muted-foreground">
                {anyNotesForSelectedDate.length === 1
                  ? t("overview.noteOnOtherTrackerOne")
                  : t("overview.noteOnOtherTrackerMany", { count: anyNotesForSelectedDate.length })}
              </p>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
