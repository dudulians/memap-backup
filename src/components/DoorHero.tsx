// Top of Today for people who came in through a door (1.8.0). One door:
// "Fights · last 7 days", a small "+ Fight" chip, the count and the week
// as dots. Several doors: the main one the same way, the others as one
// line each with their count and a "+". The echo line moved to the end
// of the evening (DailySession), so this card has no sentences at all.
// Canvas "MeMap: новая версия", page 11 (OnbToday) and page 9 (MultiToday).
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { cn } from "@/lib/utils";
import { getLanguage } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { haptics } from "@/lib/haptics";
import { Tracker, TrackerEntry } from "@/types/tracker";
import {
  daysAgoIso,
  doorCounts,
  getDoor,
  getDoorState,
  logDoorEntry,
  Door,
  DoorCounts,
  DoorState,
} from "@/lib/doors";

interface Row {
  door: Door;
  trackerId: string;
  counts: DoorCounts;
}

export const DoorHero = ({
  trackers,
  entries,
}: {
  trackers: Tracker[];
  entries: TrackerEntry[];
}) => {
  const { t } = useTranslation();
  const dateLocale = getLanguage() === "ru" ? ruLocale : undefined;
  const [state, setState] = useState<DoorState | null>(() => getDoorState());
  const [logging, setLogging] = useState<Row | null>(null);

  useEffect(() => {
    const sync = () => setState(getDoorState());
    window.addEventListener("memap-door-changed", sync);
    return () => window.removeEventListener("memap-door-changed", sync);
  }, []);

  // Main door first, then the extras picked with it. A row disappears
  // when its question was deleted or archived: the count only makes
  // sense on top of a live tracker.
  const rows = useMemo<Row[]>(() => {
    if (!state) return [];
    const live = (id: string) => trackers.some((tr) => tr.id === id && !tr.archived);
    const all = [{ id: state.id, trackerId: state.trackerId }, ...(state.extra ?? [])];
    const out: Row[] = [];
    for (const item of all) {
      const door = getDoor(item.id);
      if (!door || !live(item.trackerId)) continue;
      const counts = doorCounts({ ...state, id: item.id, trackerId: item.trackerId }, entries);
      out.push({ door, trackerId: item.trackerId, counts });
    }
    return out;
  }, [state, trackers, entries]);

  if (rows.length === 0) return null;
  const [main, ...rest] = rows;

  const week = (counts: DoorCounts, size: "lg" | "sm") => (
    <div className={cn("grid grid-cols-7 gap-1", size === "lg" ? "mt-[18px]" : "mt-3")} aria-hidden="true">
      {size === "lg" &&
        counts.week.map((d) => (
          <span key={`l${d.date}`} className="text-center text-[11px] font-semibold uppercase text-muted-foreground">
            {format(new Date(d.date + "T12:00:00"), dateLocale ? "EEEEEE" : "EEEEE", { locale: dateLocale })}
          </span>
        ))}
      {counts.week.map((d) => (
        <span
          key={d.date}
          className={cn(
            "mx-auto rounded-full box-border",
            size === "lg" ? "mt-1.5 h-[26px] w-[26px]" : "h-[18px] w-[18px]",
            d.value === true && "bg-strong",
            d.value === false && "bg-balanced",
            d.value === undefined && !d.isToday && "bg-foreground/[0.08]",
            d.value === undefined && d.isToday && "border-2 border-dashed border-primary/70",
          )}
        />
      ))}
    </div>
  );

  const plus = (row: Row, label: boolean) => (
    <button
      type="button"
      onClick={() => setLogging(row)}
      aria-label={t(`doors.${row.door.id}.logTitle`)}
      className={cn(
        "shrink-0 inline-flex items-center justify-center rounded-full border border-foreground/[0.22] bg-foreground/[0.06] font-semibold active:scale-95 transition-transform",
        label ? "h-10 gap-1.5 px-4 text-[15px]" : "h-10 w-10",
      )}
    >
      <Plus className={label ? "h-4 w-4" : "h-[18px] w-[18px]"} strokeWidth={2.8} />
      {label && t(`doors.${row.door.id}.chip`)}
    </button>
  );

  return (
    <section
      aria-label={rest.length ? t("doors.last7") : t(`doors.${main.door.id}.heroLabel`)}
      className="rounded-[22px] border border-foreground/[0.12] bg-foreground/[0.07] animate-fade-in"
    >
      {rest.length === 0 ? (
        <div className="px-[18px] pt-5 pb-[18px]">
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
              {t(`doors.${main.door.id}.heroLabel`)}
            </p>
            {/* Mood is answered in the evening, so it has no "+" (phone
                testing: "+ Low day" with "When? / What weighed on you?" made
                no sense for a mood). Event doors keep their quick log. */}
            {main.door.kind === "event" && plus(main, true)}
          </div>
          <p className="mt-2.5 flex items-baseline gap-2">
            <span className="text-[56px] leading-none font-bold tracking-tight tabular-nums">{main.counts.last7}</span>
            <span className="min-w-0 truncate text-[17px] text-muted-foreground">
              {t(`doors.${main.door.id}.noun`, { count: main.counts.last7 })}
            </span>
          </p>
          {week(main.counts, "lg")}
        </div>
      ) : (
        <>
          <p className="px-[18px] pt-4 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {t("doors.last7")}
          </p>
          <div className="px-[18px] pt-2 pb-4">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold">{t(`doors.${main.door.id}.name`)}</p>
                <p className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="text-[34px] leading-none font-bold tabular-nums">{main.counts.last7}</span>
                  <span className="text-[15px] text-muted-foreground">{t("doors.thisWeek")}</span>
                </p>
              </div>
              {main.door.kind === "event" && plus(main, false)}
            </div>
            {week(main.counts, "sm")}
          </div>
          {rest.map((row) => (
            <div key={row.door.id} className="flex items-center gap-3 border-t border-foreground/[0.08] px-[18px] py-3">
              <p className="min-w-0 flex-1 truncate text-base font-semibold">{t(`doors.${row.door.id}.name`)}</p>
              {row.door.kind === "event" ? (
                <>
                  <span className="text-xl font-bold tabular-nums">{row.counts.last7}</span>
                  {plus(row, false)}
                </>
              ) : (
                <span className="flex gap-1" aria-hidden="true">
                  {row.counts.week.map((d) => (
                    <span
                      key={d.date}
                      className={cn(
                        "h-3.5 w-3.5 rounded-full box-border",
                        d.value === true && "bg-strong",
                        d.value === false && "bg-balanced",
                        d.value === undefined && !d.isToday && "bg-foreground/[0.1]",
                        d.value === undefined && d.isToday && "border-[1.5px] border-dashed border-primary/70",
                      )}
                    />
                  ))}
                </span>
              )}
            </div>
          ))}
        </>
      )}

      <LogSheet
        open={!!logging}
        onOpenChange={(open) => !open && setLogging(null)}
        title={logging ? t(`doors.${logging.door.id}.logTitle`) : ""}
        reasonsTitle={logging ? t(`doors.${logging.door.id}.reasonsTitle`) : ""}
        reasons={logging?.door.reasons ?? []}
        onSave={async (offset, tags) => {
          if (!logging) return;
          await logDoorEntry({ trackerId: logging.trackerId, date: daysAgoIso(offset), tags });
          haptics.success();
          track("hero_logged", { door: logging.door.id, offset, reasons: tags.length });
          setLogging(null);
        }}
      />
    </section>
  );
};

// Aurora UX step 1: the week card above is gone from Today (the path of
// evenings took its place), but logging a fight or a migraine the moment
// it happens stays: one "+" chip per event door, same sheet as before.
export const DoorQuickLog = ({ trackers }: { trackers: Tracker[] }) => {
  const { t } = useTranslation();
  const [state, setState] = useState<DoorState | null>(() => getDoorState());
  const [logging, setLogging] = useState<{ door: Door; trackerId: string } | null>(null);

  useEffect(() => {
    const sync = () => setState(getDoorState());
    window.addEventListener("memap-door-changed", sync);
    return () => window.removeEventListener("memap-door-changed", sync);
  }, []);

  const rows = useMemo(() => {
    if (!state) return [];
    const all = [{ id: state.id, trackerId: state.trackerId }, ...(state.extra ?? [])];
    return all
      .map((item) => ({ door: getDoor(item.id), trackerId: item.trackerId }))
      .filter((r): r is { door: Door; trackerId: string } => !!r.door && r.door.kind === "event" && trackers.some((tr) => tr.id === r.trackerId && !tr.archived));
  }, [state, trackers]);

  if (rows.length === 0) return null;
  return (
    <section aria-label={t("path.logNow")} className="animate-fade-in">
      <p className="mb-2 text-[15px] font-semibold text-muted-foreground">{t("path.logNow")}</p>
      <div className="flex flex-wrap gap-2">
        {rows.map((row) => (
          <button
            key={row.door.id}
            type="button"
            onClick={() => setLogging(row)}
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-foreground/[0.14] bg-card/80 px-4 text-[15px] font-semibold shadow-sm active:scale-95 transition-transform"
          >
            <Plus className="h-4 w-4" strokeWidth={2.8} />
            {t(`doors.${row.door.id}.chip`)}
          </button>
        ))}
      </div>
      <LogSheet
        open={!!logging}
        onOpenChange={(open) => !open && setLogging(null)}
        title={logging ? t(`doors.${logging.door.id}.logTitle`) : ""}
        reasonsTitle={logging ? t(`doors.${logging.door.id}.reasonsTitle`) : ""}
        reasons={logging?.door.reasons ?? []}
        onSave={async (offset, tags) => {
          if (!logging) return;
          await logDoorEntry({ trackerId: logging.trackerId, date: daysAgoIso(offset), tags });
          haptics.success();
          track("hero_logged", { door: logging.door.id, offset, reasons: tags.length, from: "quicklog" });
          setLogging(null);
        }}
      />
    </section>
  );
};

// "Just curious" path: a one-week try with three questions. The card
// counts the days (a box per day, filled once anything was answered)
// and on day 7 sends you to Patterns. Gone a week after that.
const TRIAL_KEY = "memap_trial_started";

export const TrialWeek = ({ entries }: { entries: TrackerEntry[] }) => {
  const { t } = useTranslation();
  const [started] = useState<string | null>(() => {
    try {
      return getDoorState() ? null : localStorage.getItem(TRIAL_KEY);
    } catch {
      return null;
    }
  });
  if (!started) return null;
  const today = daysAgoIso(0);
  const day = Math.round((new Date(today + "T12:00:00").getTime() - new Date(started + "T12:00:00").getTime()) / 86400000) + 1;
  if (day < 1 || day > 14) return null;
  const answered = new Set(entries.map((e) => e.date));
  const boxes = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(started + "T12:00:00");
    d.setDate(d.getDate() + i);
    const date = daysAgoIso(0, d);
    return { date, done: answered.has(date), isToday: date === today, future: date > today };
  });
  const ready = day >= 7;
  return (
    <section className="rounded-[22px] border border-foreground/[0.12] bg-foreground/[0.07] px-[18px] py-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <p className={cn("min-w-0", ready ? "text-[19px] font-bold" : "text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground")}>
          {ready ? t("doors.trial.ready") : t("doors.trial.label", { n: day })}
        </p>
        {ready && (
          <Button
            onClick={() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns" } }))}
            className="h-10 shrink-0 rounded-full px-4 text-[15px] font-semibold"
          >
            {t("doors.trial.see")}
          </Button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5" aria-hidden="true">
        {boxes.map((b, i) => (
          <span
            key={b.date}
            className={cn(
              "h-9 rounded-xl flex items-center justify-center text-[13px] font-semibold box-border",
              b.done && "bg-primary text-primary-foreground",
              !b.done && b.isToday && "border-2 border-dashed border-primary/70 text-primary",
              !b.done && !b.isToday && "border border-dashed border-foreground/25 text-muted-foreground",
            )}
          >
            {i + 1}
          </span>
        ))}
      </div>
    </section>
  );
};

const LogSheet = ({
  open,
  onOpenChange,
  title,
  reasonsTitle,
  reasons,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  reasonsTitle: string;
  reasons: string[];
  onSave: (daysAgo: number, tags: string[]) => Promise<void>;
}) => {
  const { t } = useTranslation();
  const [offset, setOffset] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setOffset(0);
      setTags([]);
    }
  }, [open]);

  const toggle = (id: string) =>
    setTags((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const pill = (on: boolean) =>
    cn(
      "inline-flex items-center justify-center h-[38px] px-4 rounded-full border text-[15px] transition-colors",
      on
        ? "border-primary bg-primary/15 text-primary font-semibold"
        : "border-foreground/[0.18] bg-foreground/[0.05] font-medium",
    );

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} ariaTitle={title}>
      <div className="px-5 pb-safe">
        <h2 className="text-[21px] font-bold tracking-tight pr-10">{title}</h2>
        <p className="mt-5 text-sm font-semibold text-muted-foreground">{t("doors.whenSheet")}</p>
        <div className="mt-2 flex gap-2">
          {[0, 1].map((n) => (
            <button key={n} type="button" onClick={() => setOffset(n)} aria-pressed={offset === n} className={pill(offset === n)}>
              {n === 0 ? t("doors.when.today") : t("doors.when.yesterday")}
            </button>
          ))}
        </div>
        <p className="mt-5 text-sm font-semibold text-muted-foreground">{reasonsTitle}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {reasons.map((r) => (
            <button key={r} type="button" onClick={() => toggle(r)} aria-pressed={tags.includes(r)} className={pill(tags.includes(r))}>
              {t(`doors.reasons.${r}`)}
            </button>
          ))}
        </div>
        <Button
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(offset, tags);
            } finally {
              setSaving(false);
            }
          }}
          className="mt-6 mb-5 w-full h-[54px] rounded-full text-[17px] font-semibold"
        >
          {t("doors.save")}
        </Button>
      </div>
    </BottomSheet>
  );
};
