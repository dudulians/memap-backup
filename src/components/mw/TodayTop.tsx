// Top of Today in Malu's world (1.9). Replaces DoorHero, TrialWeek and
// the plain "Answer tonight's N" button, which together left people
// with "a couple of questions and that's it, see you tomorrow" and
// numbers nobody could read. In order:
//   Malu with one line that fits the moment
//   tonight's card (night-coloured, so it looks like the evening it opens)
//   this week as a map you can tap to fill any day
//   the road to the first findings, so there is a reason to come back
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { getNotificationSettings } from "@/lib/notifications";
import { getDoorState, isoLocal } from "@/lib/doors";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { FINDINGS_AFTER, isHit, missingDays, weekDates } from "@/lib/weekMap";
import { Malu, MaluPose } from "./Malu";
import { WeekMap } from "./WeekMap";

/** A date counts as an evening when at least half of the questions
 *  (and at least two, or the only one) were answered that day. Recall
 *  days ("fill in your week") hold one answer per topic, so they fill
 *  the map but not the road. */
export const eveningDates = (trackers: Tracker[], entries: TrackerEntry[]): string[] => {
  const active = new Set(trackers.filter((t) => !t.archived && t.source !== "play").map((t) => t.id));
  const need = active.size <= 1 ? 1 : Math.max(2, Math.ceil(active.size / 2));
  const per = new Map<string, number>();
  for (const e of entries) if (active.has(e.trackerId)) per.set(e.date, (per.get(e.date) ?? 0) + 1);
  return [...per.entries()].filter(([, n]) => n >= need).map(([d]) => d).sort();
};

/** One of Malu's own little evenings, a new one each day. */
export const maluStory = (t: TFunction, date: string): string => {
  const lines = t("mw.story", { returnObjects: true }) as unknown as string[];
  if (!Array.isArray(lines) || lines.length === 0) return "";
  const n = Math.round(new Date(date + "T12:00:00").getTime() / 86400000);
  return lines[((n % lines.length) + lines.length) % lines.length];
};

/** "Fill in your week" in onboarding counts as the first step of the
 *  road, so it never starts at zero. */
export const RECALL_KEY = "memap_recall_done";

export const TodayTop = ({
  trackers,
  entries,
  onOpenSession,
  onOpenPatterns,
}: {
  trackers: Tracker[];
  entries: TrackerEntry[];
  onOpenSession: (date: string) => void;
  onOpenPatterns: () => void;
}) => {
  const { t } = useTranslation();
  const [weekOffset, setWeekOffset] = useState(0);
  const now = new Date();
  const today = isoLocal(now);
  const active = trackers.filter((tr) => !tr.archived && tr.source !== "play");
  const left = active.filter((tr) => !entries.some((e) => e.trackerId === tr.id && e.date === today)).length;
  const evenings = useMemo(() => eveningDates(trackers, entries), [trackers, entries]);
  const dates = useMemo(() => weekDates(now, weekOffset), [weekOffset, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const missed = missingDays(entries, dates, now).filter((d) => d >= (entries.reduce((m, e) => (e.date < m ? e.date : m), today)));
  const time = getNotificationSettings().time;

  // Did a door's thing happen today? Then Malu doesn't cheer.
  const door = getDoorState();
  const doorIds = door ? [door.trackerId, ...(door.extra ?? []).map((x) => x.trackerId)] : [];
  const hardToday = doorIds.some((id) => {
    const tr = trackers.find((x) => x.id === id);
    const e = entries.find((x) => x.trackerId === id && x.date === today);
    return tr && e ? isHit(tr, e.value) : false;
  });

  const hour = now.getHours();
  let pose: MaluPose = "wave";
  let line = t("mw.today.hiFirst");
  if (left === 0) {
    pose = hardToday ? "hug" : "sleepy";
    line = hardToday ? t("mw.today.hard") : maluStory(t, today) || t("mw.today.done");
  } else if (evenings.length === 0) {
    pose = "wave";
    line = t("mw.today.hiFirst");
  } else if (hour >= 17) {
    pose = "happy";
    line = t("mw.today.evening");
  } else {
    pose = "sit";
    line = t("mw.today.later", { time });
  }

  let recalled = false;
  try {
    recalled = localStorage.getItem(RECALL_KEY) === "true";
  } catch {
    // no storage: the road just starts at zero
  }
  const progress = Math.min(FINDINGS_AFTER, evenings.length + (recalled ? 1 : 0));
  const toFindings = FINDINGS_AFTER - progress;

  return (
    <div className="flex flex-col gap-4">
      {/* Malu and her line */}
      <div className="flex items-end gap-1 -mb-1">
        <Malu pose={pose} size={pose === "hug" ? 84 : 96} bob={left > 0} className="shrink-0 -ml-2" />
        <div className="mw-bubble mb-6">
          {left === 0 && !hardToday && (
            <span className="mw-hand block text-[16px] text-muted-foreground">{t("mw.storyLabel")}</span>
          )}
          <p className="text-[18px] leading-snug">{line}</p>
        </div>
      </div>

      {/* Tonight: a little piece of night on the day screen */}
      {left > 0 && (
        <button
          type="button"
          onClick={() => {
            haptics.medium();
            onOpenSession(today);
          }}
          className="mw-night mw-card relative overflow-hidden text-left px-5 pt-5 pb-5 active:translate-y-[3px] active:shadow-none transition-transform"
          style={{ background: "linear-gradient(160deg, #3A3F6E 0%, #2B2F57 100%)", color: "#FFF6EA" }}
        >
          <span aria-hidden="true" className="absolute right-5 top-4 flex gap-2">
            <svg width="34" height="34" viewBox="0 0 32 32"><path d="M19.6 4.8c-5.9.9-9.6 5.6-9.1 11.3.5 5.8 5.6 10 11.4 9.4 2-.2 3.8-1 5.2-2.2-7.4-.6-11.9-10.1-7.5-18.5z" fill="#FFE49A" stroke="#1E2142" strokeWidth="1.9" strokeLinejoin="round" /></svg>
          </span>
          <span aria-hidden="true" className="absolute right-[70px] top-6 h-1.5 w-1.5 rounded-full bg-[#FFE49A]" />
          <span aria-hidden="true" className="absolute right-[96px] top-12 h-1 w-1 rounded-full bg-[#FFE49A]/80" />
          <span className="block text-[15px] font-bold opacity-80">{t("mw.today.tonightLabel")}</span>
          <span className="mw-display block mt-1 text-[28px] leading-tight">{t("mw.today.tonightCount", { count: left })}</span>
          <span className="mt-4 mw-btn mw-btn-butter w-full pointer-events-none">{t("mw.today.start")}</span>
        </button>
      )}

      {/* This week */}
      <section className="mw-sheet px-4 pt-3.5 pb-4" aria-label={t("week.title")}>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w - 1)}
            aria-label={t("overview.prevMonth")}
            className="h-10 w-10 rounded-full flex items-center justify-center active:bg-foreground/5"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2.6} />
          </button>
          <h2 className="mw-display text-[20px]">
            {weekOffset === 0 ? t("week.title") : weekOffset === -1 ? t("week.lastWeek") : `${dates[0].slice(8)}.${dates[0].slice(5, 7)} – ${dates[6].slice(8)}.${dates[6].slice(5, 7)}`}
          </h2>
          <button
            type="button"
            onClick={() => setWeekOffset((w) => Math.min(0, w + 1))}
            disabled={weekOffset === 0}
            aria-label={t("overview.nextMonth")}
            className="h-10 w-10 rounded-full flex items-center justify-center active:bg-foreground/5 disabled:opacity-25"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={2.6} />
          </button>
        </div>
        <WeekMap trackers={trackers} entries={entries} dates={dates} onDayTap={onOpenSession} className="mt-2" />
        {missed.length > 0 && (
          <button
            type="button"
            onClick={() => onOpenSession(missed[missed.length - 1])}
            className="mt-4 mw-btn mw-btn-paper mw-btn-sm w-full"
          >
            {t("mw.today.fillMissed", { count: missed.length })}
          </button>
        )}
      </section>

      {/* The road to the first findings */}
      <button
        type="button"
        onClick={onOpenPatterns}
        className="mw-sheet text-left px-4 py-4 flex items-center gap-3 active:translate-y-[2px] transition-transform"
      >
        <div className="flex-1 min-w-0">
          <p className="mw-display text-[18px] leading-tight">
            {toFindings > 0 ? t("mw.today.roadTitle", { count: toFindings }) : t("mw.today.roadReady")}
          </p>
          <div className="mt-2.5 flex gap-[3px]" aria-hidden="true">
            {Array.from({ length: FINDINGS_AFTER }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "h-2.5 flex-1 rounded-full",
                  i < progress ? "bg-[hsl(var(--mw-coral))]" : "bg-foreground/10",
                )}
              />
            ))}
          </div>
          <p className="mt-2 text-[15px] font-bold text-muted-foreground">
            {t("mw.today.roadCount", { n: progress, total: FINDINGS_AFTER })}
          </p>
        </div>
        <Malu pose={toFindings > 0 ? "think" : "wink"} size={64} tappable={false} className="shrink-0" />
      </button>
    </div>
  );
};
