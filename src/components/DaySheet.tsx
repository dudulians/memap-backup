// One day and its answers (her note, Nov 3 2026: "Open the day" took her to
// Notes, and "Change answers" made her go through every card to change one).
// Every question of that day with Yes and No right there: tap the one to
// change (tapping the one already chosen does nothing). The day's notes below. Opened
// from a past day on the path, or a done step (only its questions).
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { cardQuestion } from "@/lib/cardText";
import { getLanguage } from "@/lib/i18n";
import { getNotes, type Note } from "@/lib/notes";
import { haptics } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export const DaySheet = ({ date, ids, trackers, entries, onSet, onClose }: {
  /** the day (YYYY-MM-DD); null: closed */
  date: string | null;
  /** only these questions (a step's); all of hers when left out */
  ids?: string[];
  trackers: Tracker[];
  entries: TrackerEntry[];
  /** set (or clear, null) one answer on that day */
  onSet: (trackerId: string, date: string, value: boolean | null) => void;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const ru = getLanguage() === "ru";
  const [notes, setNotes] = useState<Note[]>([]);
  useEffect(() => {
    if (!date) return;
    getNotes().then((ns) => setNotes(ns.filter((n) => n.date === date))).catch(() => setNotes([]));
  }, [date]);
  const list = useMemo(() => trackers.filter((tr) => !tr.archived && tr.source !== "play" && (!ids || ids.includes(tr.id))), [trackers, ids]);
  const answer = (id: string) => entries.find((e) => e.trackerId === id && e.date === date)?.value;
  // the same way the path names a day
  const title = date ? (() => {
    const s = new Date(date + "T00:00:00").toLocaleDateString(ru ? "ru-RU" : "en-US", { weekday: "long", day: "numeric", month: "long" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })() : "";
  const set = (id: string, v: boolean) => {
    if (!date) return;
    if (answer(id) === v) return;
    haptics.tap();
    onSet(id, date, v);
  };

  return (
    <BottomSheet open={!!date} onOpenChange={(o) => { if (!o) onClose(); }} className="h-[88vh]" ariaTitle={title}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-10">
        <h2 className="pr-10 pt-1 text-[24px] font-bold tracking-tight">{title}</h2>
        <p className="pb-3 text-[15px] font-semibold text-muted-foreground">{t("day.tapToChange")}</p>
        <div className="space-y-2.5">
          {list.map((tr) => {
            const v = answer(tr.id);
            return (
              <div key={tr.id} className="surface rounded-[20px] px-4 py-3">
                <p className="text-[16px] font-semibold leading-snug">{cardQuestion(tr)}</p>
                <div className="mt-2.5 grid grid-cols-2 gap-2" role="group" aria-label={cardQuestion(tr)}>
                  {[true, false].map((val) => (
                    <button key={String(val)} type="button" aria-pressed={v === val} onClick={() => set(tr.id, val)}
                      className={cn("h-11 rounded-full border-2 text-[15px] font-bold transition-colors duration-150 active:scale-[0.98]",
                        v === val ? "border-[hsl(var(--coin-teal))] bg-[hsl(var(--coin-teal))] text-white" : "border-foreground/[0.12] text-foreground/75")}>
                      {val ? t("common.yes") : t("common.no")}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {notes.length > 0 && (
          <div className="mt-6">
            <p className="pb-2 text-[13px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">{t("common.notes")}</p>
            <div className="space-y-2">
              {notes.map((n) => (
                <div key={n.id} className="surface whitespace-pre-wrap rounded-[18px] px-4 py-3 text-[15px] leading-snug">{n.text}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
};
