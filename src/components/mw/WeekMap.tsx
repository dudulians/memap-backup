// "My week" (Sticker Diary, 1.9). Replaces the "last 7 days" card
// whose bare numbers nobody could read. One row per question under a
// strip of its washi tape, one notebook square per day: the topic's
// sticker where it happened, a pencil curl where it didn't, an empty
// square where there's no answer, a strawberry frame around today.
// Same days line up, so "drank on Tuesday, migraine on Wednesday" is
// visible without a single sentence.
import { useMemo, useState } from "react";
import { DayMark, MoodLegend, moodOf } from "./DayMark";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLanguage } from "@/lib/i18n";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { WeekRow, weekRows } from "@/lib/weekMap";
import { PencilCurl, TopicIcon, tapeVar, topicKind } from "./TopicIcon";

/** A stable little tilt per sticker, so the page looks hand-stuck. */
export const tilt = (seed: string): number => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 9) - 4) * 1.1;
};

export const rowName = (t: (k: string) => string, row: Pick<WeekRow, "tracker" | "door">): string =>
  row.door ? t(`week.row.${row.door}`) : localizeTrackerTitle(row.tracker.title);

export const WeekMap = ({
  trackers,
  entries,
  dates,
  onDayTap,
  maxRows = 4,
  onlyDoors,
  className,
  animate,
}: {
  trackers: Tracker[];
  entries: TrackerEntry[];
  /** 7 local ISO dates, oldest first. */
  dates: string[];
  onDayTap?: (date: string) => void;
  /** Rows shown before "Show all". */
  maxRows?: number;
  onlyDoors?: boolean;
  className?: string;
  /** Pop the stickers in one by one (onboarding reveal, end of evening). */
  animate?: boolean;
}) => {
  const { t } = useTranslation();
  const dateLocale = getLanguage() === "ru" ? ruLocale : undefined;
  const [all, setAll] = useState(false);
  const rows = useMemo(() => {
    const r = weekRows(trackers, entries, dates);
    return onlyDoors ? r.filter((x) => x.door) : r;
  }, [trackers, entries, dates, onlyDoors]);
  const shown = all ? rows : rows.slice(0, maxRows);

  if (rows.length === 0) return null;

  // Same grid for the day header and every row: the name column on
  // the left only holds the icon, the name sits above the stickers.
  const grid = "grid grid-cols-7 gap-1";

  return (
    <div className={cn("w-full", className)}>
      <div className="flex">
        <div className={cn(grid, "flex-1")}>
          {dates.map((d) => {
            const day = new Date(d + "T12:00:00");
            return (
              <button
                key={d}
                type="button"
                disabled={!onDayTap}
                onClick={() => onDayTap?.(d)}
                className="flex flex-col items-center leading-none py-1 rounded-xl disabled:cursor-default"
              >
                <span className="text-[13px] font-semibold text-muted-foreground">
                  {format(day, "EEEEEE", { locale: dateLocale })}
                </span>
                <span className="mt-0.5 text-[16px] font-semibold tabular-nums">{format(day, "d")}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-1 flex flex-col gap-3">
        {shown.map((row, ri) => {
          const kind = topicKind(row.tracker.title, row.door);
          return (
            <div key={row.tracker.id}>
              <div className="flex items-end gap-2 pr-1">
                <span
                  className="mw-tape inline-flex items-center gap-1.5 max-w-[75%] pl-2 pr-3 py-0.5 text-[16px] font-semibold"
                  style={{ ["--tape" as string]: tapeVar(kind), transform: `rotate(${tilt(row.tracker.id) / 4}deg)` }}
                >
                  <TopicIcon kind={kind} size={22} />
                  <span className="truncate">{rowName(t, row)}</span>
                </span>
                <span className="flex-1" />
                {row.door && (
                  <span className="shrink-0 text-[16px] font-semibold text-muted-foreground tabular-nums">
                    {t("week.days", { count: row.hits })}
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex items-center">
                <div className={cn(grid, "flex-1")}>
                  {row.cells.map((c, ci) => (
                    <button
                      key={c.date}
                      type="button"
                      disabled={!onDayTap || c.isFuture}
                      onClick={() => onDayTap?.(c.date)}
                      aria-label={`${format(new Date(c.date + "T12:00:00"), "EEEE d MMMM", { locale: dateLocale })}: ${t(`week.cell.${c.state}`)}`}
                      data-state={c.state}
                      data-mood={moodOf(row.tracker, c.value)}
                      data-today={c.isToday}
                      data-future={c.isFuture}
                      className="mw-cell"
                    >
                      <DayMark
                        value={c.value}
                        kind={kind}
                        size={34}
                        slap={animate}
                        style={{ ["--r" as string]: `${tilt(c.date + row.tracker.id)}deg`, transform: `rotate(${tilt(c.date + row.tracker.id)}deg)`, animationDelay: animate ? `${(ri * 7 + ci) * 60}ms` : undefined }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <MoodLegend className="mt-3" />

      {rows.length > maxRows && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-3 mx-auto flex items-center gap-1 h-10 px-4 rounded-full text-[15px] font-bold text-muted-foreground"
        >
          {all ? t("week.less") : t("week.all", { count: rows.length })}
          <ChevronDown className={cn("h-4 w-4 transition-transform", all && "rotate-180")} strokeWidth={2.6} />
        </button>
      )}
    </div>
  );
};
