// Question card (Today → My questions → tap a question), 1.8.0: the name,
// how many times this month, the month as dots, the limit, and Edit.
// Answering moved out: tonight's card answers today, Patterns → Calendar
// fixes past days. Canvas "MeMap: новая версия", page 12, RestQuestion.
import { useState, useEffect } from "react";
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

  return (
    // Side padding keeps card borders off the BottomSheet's clipped edges.
    <div className="px-5 pb-20 animate-fade-in">
      <h2 className="text-[26px] font-bold tracking-tight leading-tight pr-10">{name}</h2>

      <p className="mt-3 flex items-baseline gap-2.5">
        <span className="text-[52px] leading-none font-bold tracking-tight tabular-nums">{monthCount}</span>
        <span className="text-xl font-semibold">{countLabel}</span>
      </p>
      <p className="mt-1 text-[15px] text-muted-foreground">{monthName}</p>

      <div className="mt-3 grid grid-cols-[repeat(16,minmax(0,1fr))] gap-[5px]" aria-hidden="true">
        {month.map((d) => (
          <span
            key={d.date}
            className={cn(
              "aspect-square rounded-full box-border",
              d.status === "bad" && "bg-strong",
              d.status === "ok" && "bg-balanced/40",
              d.status === "none" && !d.future && !d.isToday && "bg-foreground/[0.1]",
              d.status === "none" && d.isToday && "border-2 border-dashed border-primary/70",
              d.future && "border border-foreground/[0.12]",
            )}
          />
        ))}
      </div>

      <div className={cn(
        "mt-6 rounded-[22px] border px-[18px] py-4",
        crossed ? "border-strong/30 bg-strong/[0.1]" : "border-foreground/[0.12] bg-foreground/[0.07]",
      )}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-lg font-semibold">{t("addTracker.limit")}</span>
          <span className="tabular-nums">
            <span className={cn("text-[26px] font-bold", crossed && "text-strong")}>{limitCount}</span>
            <span className="text-[17px] text-muted-foreground"> / {tracker.threshold}</span>
          </span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-foreground/10 overflow-hidden">
          <div className={cn("h-full rounded-full", crossed ? "bg-strong" : "bg-primary")} style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{t("patterns.limitsWindow", { count: tracker.periodDays })}</p>
        {crossed && tracker.adviceAboveThreshold?.trim() && (
          <p className="mt-3 text-[17px] leading-snug">{localizeTrackerAdvice(tracker.adviceAboveThreshold)}</p>
        )}
      </div>

      {onEdit && (
        <Button
          variant="outline"
          onClick={onEdit}
          className="mt-6 w-full h-12 rounded-full gap-2 text-base bg-transparent border-foreground/20"
        >
          <Pencil className="h-4 w-4" />
          {t("trackerDetails.actionEdit")}
        </Button>
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
