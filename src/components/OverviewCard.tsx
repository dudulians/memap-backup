// Calendar (Patterns → Calendar), 1.8.0: question chips on top, one big
// count for the month ("7 fights", "12 days with No"), and the month as
// big day circles. Tap a day to change its answer. Canvas "MeMap: новая
// версия", page 12, RestCalendar. Aurora UX (Oct 31 2026, her call) brings
// two things back from 1.7.9: the Year view and "Select several days"
// (one answer for many days at once).
import { useState, useRef, useMemo, useEffect } from "react";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { Note, getNotes } from "@/lib/notes";
import { Check, ChevronDown, ChevronLeft, ChevronRight, FileText, ListChecks } from "lucide-react";
import { cardQuestion } from "@/lib/cardText";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, isFuture, getYear } from "date-fns";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { getLanguage } from "@/lib/i18n";
import { ru as ruLocale } from "date-fns/locale";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import { haptics } from "@/lib/haptics";
import { isNeutralQuestion } from "@/lib/islands";
import { getDoorState } from "@/lib/doors";
import { answerPhrase, cap } from "@/lib/answerPhrases";

interface OverviewCardProps {
  trackers: Tracker[];
  entries: TrackerEntry[];
  selectedDate: string;
  onDateSelect: (date: string) => void;
  onDayEdit?: (tracker: Tracker, date: string, existingEntry?: TrackerEntry) => void;
  /** "Select several days": one answer (null = clear) for all picked days. */
  onBulkAnswer?: (trackerId: string, dates: string[], value: boolean | null) => void;
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
  onBulkAnswer,
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
  const [view, setView] = useState<"month" | "year">("month");
  const [multi, setMulti] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
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
  // a wish or decision: yes / no in neutral indigo, not hard / calm
  const neutral = !!activeTracker && isNeutralQuestion(activeTracker);
  const activeTrackerId = activeTracker?.id;
  const notesForActiveTracker = useMemo(
    () => notes.filter(n => n.linkedPatternId === activeTrackerId),
    [notes, activeTrackerId]
  );

  // Every day with a note gets a dot, whatever the note is about (her
  // note: you should see on the calendar which days have notes).
  const noteDatesSet = useMemo(() => new Set(notes.map((n) => n.date)), [notes]);

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

  // Year view: the last 12 months as small squares, oldest first.
  const yearData = useMemo(() => {
    if (!activeTracker) return [];
    // from her first answered month, at most 12 (QA, Nov 8 2026: it opened on 9 empty months)
    const firstIso = [...entryMap.keys()].sort()[0];
    const first = firstIso ? new Date(firstIso + "T12:00:00") : today;
    const span = Math.max(1, Math.min(12, (getYear(today) - getYear(first)) * 12 + today.getMonth() - first.getMonth() + 1));
    return Array.from({ length: span }, (_, k) => {
      const monthDate = subMonths(today, span - 1 - k);
      const calStart = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
      const calEnd = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });
      const days: { dateStr: string; show: boolean; status: "balanced" | "significant" | "untracked" }[] = [];
      for (let cur = calStart; cur <= calEnd; cur = addDays(cur, 1)) {
        const dateStr = format(cur, "yyyy-MM-dd");
        const entry = entryMap.get(dateStr);
        const sig = entry ? (activeTracker.problemWhen === "yes" ? entry.value === true : entry.value === false) : false;
        days.push({ dateStr, show: isSameMonth(cur, monthDate) && !isFuture(cur), status: !entry ? "untracked" : sig ? "significant" : "balanced" });
      }
      const label = format(monthDate, "LLL", { locale: dateLocale });
      return { monthDate, label: label.charAt(0).toUpperCase() + label.slice(1), days };
    });
  }, [today, entryMap, activeTracker, dateLocale]);

  // A new question starts with nothing picked.
  useEffect(() => {
    setPicked(new Set());
  }, [activeTrackerIndex]);

  // The first picked day brings the Yes/No panel into view (it sits
  // under the month, often behind the tab bar).
  const panelRef = useRef<HTMLDivElement>(null);
  const hasPicked = picked.size > 0;
  useEffect(() => {
    if (hasPicked) panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [hasPicked]);

  // the list of questions under the picker (Nov 8 2026: chips cut the questions off at the edges)
  const [listOpen, setListOpen] = useState(false);
  const stepQ = (d: number) => { haptics.tap(); setListOpen(false); setActiveTrackerIndex((i) => (i + d + trackers.length) % trackers.length); };

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
  }, [trackers.length, view]);

  const canGoNextMonth = startOfMonth(addMonths(displayMonth, 1)) <= startOfMonth(today);

  const handleDayClick = (day: typeof calendarDays[0]) => {
    if (day.isFutureDate || !day.isCurrentMonth) return;
    if (multi) {
      haptics.tap();
      setPicked((prev) => {
        const next = new Set(prev);
        if (next.has(day.dateStr)) next.delete(day.dateStr);
        else next.add(day.dateStr);
        return next;
      });
      return;
    }
    // The answer editor has its own haptics on save.
    onDateSelect(day.dateStr);
    if (onDayEdit && activeTracker) onDayEdit(activeTracker, day.dateStr, entryMap.get(day.dateStr));
  };

  const answerPicked = (value: boolean | null) => {
    if (!picked.size || !onBulkAnswer || !activeTracker) return;
    if (value === true) haptics.success();
    else if (value === false) haptics.medium();
    else haptics.tap();
    onBulkAnswer(activeTracker.id, Array.from(picked), value);
    setPicked(new Set());
  };

  const toggleMulti = () => {
    haptics.tap();
    setMulti((on) => !on);
    setPicked(new Set());
  };

  if (!activeTracker) return null;

  // "2 days" and what they were, in the answer's own words (QA, Nov 8 2026: "2 migraines" over a headache
  // question, "14 days with Yes")
  const countLabel = t("overview.daysN", { count: monthCount });
  const countWhat = cap(answerPhrase(t, activeTracker, neutral || activeTracker.problemWhen === "yes"));
  const yesWord = cap(answerPhrase(t, activeTracker, activeTracker.problemWhen === "yes"));
  const noWord = cap(answerPhrase(t, activeTracker, activeTracker.problemWhen !== "yes"));
  const monthTitle = (() => {
    const s = format(displayMonth, "LLLL yyyy", { locale: dateLocale });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();

  return (
    <div className="animate-fade-in">
      {/* The question, whole (her note, Nov 8 2026: "в календаре иногда плохо читаются вопросы" —
          a row of chips cut them off at both edges): ‹ the question › and the list on a tap. */}
      <div ref={chipsContainerRef} className="surface flex items-center gap-1 rounded-[20px] px-1.5 py-1.5" data-no-tabswipe>
        {trackers.length > 1 && (
          <button type="button" onClick={() => stepQ(-1)} aria-label={t("overview.prevQ")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground">
            <ChevronLeft className="h-6 w-6" strokeWidth={2.4} />
          </button>
        )}
        <button type="button" onClick={() => { haptics.tap(); setListOpen((o) => !o); }} aria-expanded={listOpen} className="min-w-0 flex-1 px-1 py-1.5 text-center">
          <span className="block text-[18px] font-bold leading-snug">{cardQuestion(activeTracker)}</span>
          <span className="mt-0.5 flex items-center justify-center gap-1 text-[13px] font-semibold text-muted-foreground">
            {t("overview.qOf", { k: activeTrackerIndex + 1, n: trackers.length })}
            <ChevronDown className={cn("h-4 w-4 transition-transform", listOpen && "rotate-180")} strokeWidth={2.4} />
          </span>
        </button>
        {trackers.length > 1 && (
          <button type="button" onClick={() => stepQ(1)} aria-label={t("overview.nextQ")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground">
            <ChevronRight className="h-6 w-6" strokeWidth={2.4} />
          </button>
        )}
      </div>
      {listOpen && (
        <div className="surface mt-2 max-h-[46vh] overflow-y-auto rounded-[20px] py-1.5 animate-fade-in">
          {trackers.map((tr, i) => {
            const on = i === activeTrackerIndex;
            return (
              <button key={tr.id} type="button" aria-pressed={on} onClick={() => { haptics.tap(); setActiveTrackerIndex(i); setListOpen(false); }}
                className="flex min-h-[48px] w-full items-center gap-3 px-4 py-2 text-left">
                <span className={cn("min-w-0 flex-1 text-[16px] leading-snug", on ? "font-bold" : "font-semibold")}>{cardQuestion(tr)}</span>
                {on && <Check className="h-5 w-5 shrink-0 text-[hsl(var(--coin-teal))]" strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      )}

      {/* Month or year. */}
      <div className="mt-4 flex justify-center">
        <div className="seg">
          {(["month", "year"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => { haptics.tap(); setView(v); setMulti(false); setPicked(new Set()); }}
              className={cn("chip min-w-[96px]", view === v && "is-on")}
            >
              {t(`overview.${v}`)}
            </button>
          ))}
        </div>
      </div>

      {view === "year" && (
        <div className="animate-fade-in">
          <p className="mt-5 text-center text-[15px] font-semibold text-muted-foreground">
            {getYear(yearData[0]?.monthDate ?? today) === getYear(today)
              ? getYear(today)
              : `${getYear(yearData[0].monthDate)}–${getYear(today)}`}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-4">
            {yearData.map(({ monthDate, label, days }) => (
              <button
                key={label + getYear(monthDate)}
                type="button"
                onClick={() => { haptics.tap(); setDisplayMonth(monthDate); setView("month"); }}
                className="block self-start rounded-2xl p-1.5 text-left active:scale-[0.98] transition-transform"
              >
                <span className="block text-center text-[15px] font-semibold">{label}</span>
                <span className="mt-1.5 grid grid-cols-7 gap-[2px]">
                  {days.map((d) => (
                    <span
                      key={d.dateStr}
                      className={cn(
                        "block aspect-square rounded-full",
                        !d.show && "bg-transparent",
                        d.show && d.status === "significant" && (neutral ? "bg-[hsl(var(--data-a))]" : "bg-strong"),
                        d.show && d.status === "balanced" && (neutral ? "bg-[hsl(var(--data-a)/0.22)]" : "bg-balanced/60"),
                        d.show && d.status === "untracked" && "bg-foreground/[0.08]",
                      )}
                    />
                  ))}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-center gap-5 text-[15px] text-muted-foreground">
            <span className="flex items-center gap-2"><span className={cn("h-3 w-3 rounded-full", neutral ? "bg-[hsl(var(--data-a))]" : "bg-strong")} />{neutral ? t("common.yes") : yesWord}</span>
            <span className="flex items-center gap-2"><span className={cn("h-3 w-3 rounded-full", neutral ? "bg-[hsl(var(--data-a)/0.22)]" : "bg-balanced/60")} />{neutral ? t("common.no") : noWord}</span>
          </div>
        </div>
      )}

      {view === "month" && (
      <div ref={swipeAreaRef} style={{ touchAction: "pan-y" }}>
        {/* Month + the one number that matters */}
        <div className="mt-4 flex items-center gap-1">
          <button
            type="button"
            onClick={() => { haptics.tap(); setDisplayMonth((prev) => subMonths(prev, 1)); }}
            aria-label={t("overview.prevMonth")}
            className="h-9 w-9 -ml-2 rounded-full flex items-center justify-center text-muted-foreground"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="flex-1 text-center text-[15px] font-semibold text-muted-foreground">{monthTitle}</p>
          <button
            type="button"
            onClick={() => { if (canGoNextMonth) { haptics.tap(); setDisplayMonth((prev) => addMonths(prev, 1)); } }}
            disabled={!canGoNextMonth}
            aria-label={t("overview.nextMonth")}
            className="h-9 w-9 -mr-2 rounded-full flex items-center justify-center text-muted-foreground disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 flex items-baseline gap-2.5">
          <span className="text-[56px] leading-none font-bold tracking-tight tabular-nums">{monthCount}</span>
          <span className="text-xl font-semibold">{countLabel}</span>
        </p>
        <p className="mt-1 text-[17px] font-semibold leading-snug text-muted-foreground">{countWhat}</p>

        <div className="mt-5 grid grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className="text-center text-[13px] font-semibold uppercase text-muted-foreground">
              {/* RU two letters: «В» and «С» were each two days (QA, Nov 8 2026) */}{format(addDays(MONDAY, i), dateLocale ? "EEEEEE" : "EEEEE", { locale: dateLocale })}
            </span>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-y-2">
          {calendarDays.map((day) => (
            <div key={day.dateStr} className="flex items-center justify-center">
              {day.isCurrentMonth ? (
                <button
                  type="button"
                  onClick={() => handleDayClick(day)}
                  disabled={day.isFutureDate}
                  aria-pressed={multi ? picked.has(day.dateStr) : undefined}
                  className={cn(
                    "relative h-[38px] w-[38px] rounded-full flex items-center justify-center text-sm font-semibold tabular-nums box-border transition-all",
                    day.isFutureDate && "text-muted-foreground/40",
                    !day.isFutureDate && day.status === "significant" && (neutral ? "bg-[hsl(var(--data-a))] text-white" : "bg-strong text-strong-foreground"),
                    !day.isFutureDate && day.status === "balanced" && (neutral ? "bg-[hsl(var(--data-a)/0.22)]" : "bg-balanced/35"),
                    !day.isFutureDate && day.status === "untracked" && !day.isToday && "text-muted-foreground",
                    day.isToday && day.status === "untracked" && "border-2 border-dashed border-foreground/35",
                    !multi && day.isSelected && !day.isToday && "ring-2 ring-foreground/70",
                    multi && picked.has(day.dateStr) && "ring-[2.5px] ring-foreground ring-offset-2 ring-offset-background scale-90",
                  )}
                >
                  {format(day.date, "d")}
                  {multi && picked.has(day.dateStr) && (
                    <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-foreground text-background flex items-center justify-center">
                      <Check className="h-3 w-3" strokeWidth={3.5} />
                    </span>
                  )}
                  {/* the tick wins while picking: the note mark hid it (QA, Nov 8 2026) */}
                  {noteDatesSet.has(day.dateStr) && !(multi && picked.has(day.dateStr)) && (
                    <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm"><FileText className="h-[11px] w-[11px]" strokeWidth={2.6} /></span>
                  )}
                </button>
              ) : (
                <span className="h-[38px] w-[38px]" />
              )}
            </div>
          ))}
        </div>

        {calendarDays.some((d) => d.isCurrentMonth && noteDatesSet.has(d.dateStr)) && (
          <p className="mt-3 flex items-center justify-center gap-2 text-[15px] font-medium text-muted-foreground">
            <span aria-hidden="true" className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm"><FileText className="h-[11px] w-[11px]" strokeWidth={2.6} /></span>
            {t("overview.noteDayKey")}
          </p>
        )}

        {/* Select several days: one answer for many days at once. */}
        {onBulkAnswer && !multi && (
          <div className="mt-4 flex justify-center">
            <button type="button" onClick={toggleMulti} className="quiet-btn">
              <ListChecks className="h-[18px] w-[18px]" strokeWidth={2.2} />
              {t("overview.pickSeveral")}
            </button>
          </div>
        )}
        {multi && (
          <div
            ref={panelRef}
            className="mt-4 scroll-mb-28 rounded-[22px] border border-foreground/[0.12] bg-foreground/[0.07] px-4 py-4 animate-fade-in"
          >
            <p className="text-center text-[17px] font-semibold">
              {picked.size === 0
                ? t("overview.multiHint")
                : picked.size === 1
                  ? t("overview.datesSelectedOne")
                  : t("overview.datesSelectedMany", { count: picked.size })}
            </p>
            {picked.size > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <button type="button" onClick={() => answerPicked(false)} className="quiet-btn h-[50px] text-[17px]">
                  {t("common.no")}
                </button>
                {/* both plain: a teal "Yes" read as "good" on a hard question (QA, Nov 8 2026) */}
                <button type="button" onClick={() => answerPicked(true)} className="quiet-btn h-[50px] text-[17px]">
                  {t("common.yes")}
                </button>
              </div>
            )}
            <div className="mt-2 flex justify-center gap-2">
              {picked.size > 0 && (
                <button type="button" onClick={() => answerPicked(null)} className="h-11 px-4 text-[15px] font-semibold text-muted-foreground">
                  {t("common.clear")}
                </button>
              )}
              <button type="button" onClick={toggleMulti} className="h-11 px-4 text-[15px] font-bold text-[hsl(var(--coin-teal))]">
                {t("common.done")}
              </button>
            </div>
          </div>
        )}
      </div>
      )}

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
