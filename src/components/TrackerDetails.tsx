// Question card (Today → My questions → tap a question), 1.8.0: the name,
// how many times this month, the month as dots, the limit, and Edit.
// Answering moved out: tonight's card answers today, Patterns → Calendar
// fixes past days. Canvas "MeMap: новая версия", page 12, RestQuestion.
import { useState, useEffect } from "react";
import { Glyph } from "./mw/Glyph";
import { PencilCurl, TopicIcon, topicKind } from "./mw/TopicIcon";
import { tilt } from "./mw/WeekMap";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { getEntries } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { getLanguage } from "@/lib/i18n";
import { localizeTrackerTitle, localizeTrackerAdvice } from "@/lib/trackerLocalize";
import { haptics } from "@/lib/haptics";
import { getDoorState, isoLocal } from "@/lib/doors";

interface TrackerDetailsProps {
  tracker: Tracker;
  trackers?: Tracker[];
  currentIndex?: number;
  onBack?: () => void;
  onNavigateTracker?: (direction: "prev" | "next") => void;
  selectedDate?: string;
  onDateSelect?: (date: string) => void;
  // Management actions. When omitted, the buttons are hidden — useful
  // for read-only contexts.
  onEdit?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
}

export const TrackerDetails = ({
  tracker,
  onEdit,
  onArchive,
  onDelete,
}: TrackerDetailsProps) => {
  const { t } = useTranslation();
  const dateLocale = getLanguage() === "ru" ? ruLocale : undefined;
  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setEntries(await getEntries());
      setLoading(false);
    };
    load();
    // Re-pull when anything else saves (the evening card, the calendar
    // editor) while this sheet sits open.
    window.addEventListener("memap-entries-changed", load);
    return () => window.removeEventListener("memap-entries-changed", load);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  const isBad = (e: TrackerEntry) => (tracker.problemWhen === "yes" ? e.value === true : e.value === false);
  const mine = new Map(entries.filter((e) => e.trackerId === tracker.id).map((e) => [e.date, e]));

  // This month, day by day.
  const now = new Date();
  const today = isoLocal(now);
  const month = eachDayOfInterval({ start: startOfMonth(now), end: endOfMonth(now) }).map((d) => {
    const date = isoLocal(d);
    const entry = mine.get(date);
    return {
      date,
      future: date > today,
      isToday: date === today,
      status: entry ? (isBad(entry) ? "bad" : "ok") : "none",
    } as const;
  });
  const monthCount = month.filter((d) => d.status === "bad").length;
  const monthName = (() => {
    const s = format(now, "LLLL", { locale: dateLocale });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();

  // The limit window: last periodDays, or since the cycle started.
  const rollingStart = new Date(now);
  rollingStart.setHours(0, 0, 0, 0);
  rollingStart.setDate(rollingStart.getDate() - tracker.periodDays);
  const windowStart = tracker.cycleStartDate && tracker.cycleStartDate > isoLocal(rollingStart)
    ? tracker.cycleStartDate
    : isoLocal(rollingStart);
  const limitCount = [...mine.values()].filter((e) => e.date >= windowStart && e.date <= today && isBad(e)).length;
  const crossed = limitCount >= tracker.threshold;
  const pct = Math.min(100, Math.round((limitCount / Math.max(1, tracker.threshold)) * 100));

  // Door questions go by their door name and count in their own words.
  const door = getDoorState();
  const doorId = door?.trackerId === tracker.id ? door.id : door?.extra?.find((x) => x.trackerId === tracker.id)?.id;
  const name = doorId ? t(`doors.${doorId}.name`) : localizeTrackerTitle(tracker.title);
  const countLabel = doorId
    ? t(`doors.${doorId}.noun`, { count: monthCount })
    : tracker.problemWhen === "yes"
      ? t("overview.daysYes", { count: monthCount })
      : t("overview.daysNo", { count: monthCount });

  const kind = topicKind(tracker.title, doorId);
  return (
    // Sticker Diary (1.9): the name on its tape, this month as a page of
    // stickers, the limit as squares, one sentence each.
    <div className="px-5 pb-20 animate-fade-in">
      <div className="flex items-center gap-3 pr-10">
        <TopicIcon kind={kind} size={46} sticker style={{ transform: "rotate(-5deg)" }} />
        <h2 className="mw-display text-[26px] leading-tight">{name}</h2>
      </div>

      <div className="mt-5 flex items-baseline justify-between">
        <p className="mw-display text-[20px]">{monthName}</p>
        <p className="mw-hand text-[19px]">{monthCount} {countLabel}</p>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1" aria-hidden="true">
        {month.map((d) => (
          <span key={d.date} className="mw-cell" data-today={d.isToday} data-future={d.future}>
            {d.status === "bad" && (
              <TopicIcon kind={kind} size={30} sticker className="absolute" style={{ transform: `rotate(${tilt(d.date + tracker.id)}deg)` }} />
            )}
            {d.status === "ok" && <PencilCurl size={16} />}
          </span>
        ))}
      </div>

      <div className="mw-sheet mt-6 px-4 py-4" style={crossed ? { boxShadow: "0 0 0 2px hsl(var(--tape-fights))" } : undefined}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="mw-display text-[19px]">{t("addTracker.limit")}</span>
          <span className="mw-hand text-[19px] tabular-nums">{t("mw.limits.of", { n: limitCount, max: tracker.threshold })}</span>
        </div>
        {tracker.threshold <= 14 ? (
          <div className="mt-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(tracker.threshold, 7)}, minmax(0, 1fr))` }} aria-hidden="true">
            {Array.from({ length: Math.max(tracker.threshold, 7) }, (_, i) => (
              <span key={i} className={cn("mw-cell !rounded-[4px]", i >= tracker.threshold && "opacity-0")}>
                {i < Math.min(limitCount, tracker.threshold) && (
                  <TopicIcon kind={kind} size={24} sticker className="absolute" style={{ transform: `rotate(${tilt(tracker.id + i)}deg)` }} />
                )}
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-3 h-3 rounded-[3px] bg-[hsl(var(--mw-grid))] overflow-hidden">
            <div className="h-full bg-[hsl(var(--mw-brand))]" style={{ width: `${pct}%` }} />
          </div>
        )}
        <p className="mt-2 text-[16px] text-muted-foreground">{t("patterns.limitsWindow", { count: tracker.periodDays })}</p>
        {crossed && tracker.adviceAboveThreshold?.trim() && (
          <p className="mt-3 mw-hand text-[19px] leading-snug">{localizeTrackerAdvice(tracker.adviceAboveThreshold)}</p>
        )}
      </div>

      {onEdit && (
        <button type="button" onClick={onEdit} className="mw-btn mt-7 w-full">
          <Glyph kind="pencil" size={20} />
          {t("trackerDetails.actionEdit")}
        </button>
      )}
      {(onArchive || onDelete) && (
        <div className="mt-2 flex justify-center gap-2">
          {onArchive && (
            <Button
              variant="ghost"
              onClick={() => { haptics.warning(); onArchive(); }}
              className="h-11 rounded-full px-4 text-[15px] text-muted-foreground"
            >
              {tracker.archived ? t("trackerDetails.actionUnarchive") : t("trackerDetails.actionArchive")}
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              onClick={() => { haptics.warning(); onDelete(); }}
              className="h-11 rounded-full px-4 text-[15px] text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {t("trackerDetails.actionDelete")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
