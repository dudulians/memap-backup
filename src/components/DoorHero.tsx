// Top of Today for people who came in through a door (1.8.0): the
// count for the last 7 days, a "Log a fight" button that records the
// event the moment it happens (with reason chips), the week as dots,
// and one echo line. Canvas "MeMap: новая версия", page 2, board 5.
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { Plus, Sparkles } from "lucide-react";
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
  strongestContextFact,
  DoorState,
} from "@/lib/doors";
import { echoLine, factLine } from "@/lib/echo";

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
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const sync = () => setState(getDoorState());
    window.addEventListener("memap-door-changed", sync);
    return () => window.removeEventListener("memap-door-changed", sync);
  }, []);

  const door = state ? getDoor(state.id) : undefined;
  // Hide when the main question was deleted or archived: the hero
  // only makes sense on top of a live tracker.
  const tracker = state ? trackers.find((tr) => tr.id === state.trackerId && !tr.archived) : undefined;

  const counts = useMemo(
    () => (state ? doorCounts(state, entries) : null),
    [state, entries],
  );
  const fact = useMemo(
    () => (state ? strongestContextFact(state, trackers, entries) : null),
    [state, trackers, entries],
  );

  if (!state || !door || !tracker || !counts) return null;

  return (
    <section
      aria-label={t(`doors.${door.id}.heroLabel`)}
      className="rounded-[22px] border-[1.5px] border-primary/45 bg-primary/[0.07] px-[18px] pt-[18px] pb-4 animate-fade-in"
    >
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {t(`doors.${door.id}.heroLabel`)}
      </p>
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <p className="min-w-0 flex items-baseline gap-2">
          <span className="text-[52px] leading-none font-bold tracking-tight tabular-nums">{counts.last7}</span>
          <span className="min-w-0 truncate text-base text-muted-foreground">
            {t(`doors.${door.id}.noun`, { count: counts.last7 })}
          </span>
        </p>
        <Button
          onClick={() => setSheetOpen(true)}
          className="h-12 shrink-0 rounded-full px-[18px] text-base font-semibold"
        >
          <Plus className="h-[18px] w-[18px] mr-1" strokeWidth={2.6} />
          {t(`doors.${door.id}.logButton`)}
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1" aria-hidden="true">
        {counts.week.map((d) => (
          <span key={`l${d.date}`} className="text-center text-[11px] font-semibold uppercase text-muted-foreground">
            {format(new Date(d.date + "T12:00:00"), "EEEEE", { locale: dateLocale })}
          </span>
        ))}
        {counts.week.map((d) => (
          <span
            key={d.date}
            className={cn(
              "mx-auto mt-1 h-[26px] w-[26px] rounded-full box-border",
              d.value === true && "bg-strong",
              d.value === false && "bg-balanced",
              d.value === undefined && !d.isToday && "bg-foreground/[0.08]",
              d.value === undefined && d.isToday && "border-2 border-dashed border-primary/70",
            )}
          />
        ))}
      </div>

      <div className="mt-3.5 pt-3 border-t border-foreground/10 flex gap-2.5 items-start">
        <Sparkles className="h-[18px] w-[18px] shrink-0 mt-0.5 text-primary" fill="currentColor" strokeWidth={1.5} />
        <div className="min-w-0 space-y-1">
          <p className="text-[15px] leading-snug">{echoLine(t, door, counts)}</p>
          {fact && (
            <p className="text-[15px] leading-snug">
              {factLine(t, fact)}{" "}
              <span className="text-emerging">{t("doors.echo.early")}</span>
            </p>
          )}
        </div>
      </div>

      <LogSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={t(`doors.${door.id}.logTitle`)}
        reasonsTitle={t(`doors.${door.id}.reasonsTitle`)}
        reasons={door.reasons}
        onSave={async (offset, tags) => {
          await logDoorEntry({ trackerId: state.trackerId, date: daysAgoIso(offset), tags });
          haptics.success();
          track("hero_logged", { door: door.id, offset, reasons: tags.length });
          setSheetOpen(false);
        }}
      />
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
