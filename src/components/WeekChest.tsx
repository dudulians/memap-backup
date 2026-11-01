// Opening a week's chest (Aurora step 6, plan §3.4; her ask: "сундук недели
// с картой внутри"). Ready → the lid opens on "A map of your week" with
// counts from her own days → "You earned: a bridge" → "Put it on my map".
// What it showed is saved when opened and reopens as is.
import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Clock, X } from "lucide-react";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { haptics } from "@/lib/haptics";
import { mapPic } from "@/lib/islands";
import { getDoor, getDoorState } from "@/lib/doors";
import { factLine } from "@/lib/echo";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import { chestContent, type ChestStat } from "@/lib/weekChest";
import { getChests, rewardFor, saveChest, type ChestRecord } from "@/lib/pathSteps";
import { isoLocal } from "@/lib/doors";
import { Pressable } from "@/components/ui/pressable";

export const WeekChest = ({
  week,
  dates,
  trackers,
  entries,
  onClose,
  onPlaced,
}: {
  week: number;
  dates: string[];
  trackers: Tracker[];
  entries: TrackerEntry[];
  onClose: () => void;
  /** After "Put it on my map": show it there. */
  onPlaced: () => void;
}) => {
  const { t } = useTranslation();
  const [rec, setRec] = useState<ChestRecord | null>(() => getChests()[week] ?? null);

  const label = (s: ChestStat) => {
    if (s.door) {
      const door = getDoorState();
      const d = door ? getDoor(door.id) : undefined;
      if (d) return t(`doors.${d.id}.name`);
    }
    const tr = trackers.find((x) => x.id === s.trackerId);
    return tr ? localizeTrackerTitle(tr.title) : "";
  };

  const open = () => {
    haptics.medium();
    const c = chestContent(trackers, entries, dates);
    const lines = [
      ...(c.main ? [{ label: label(c.main), k: c.main.k, n: c.main.n, main: true, calm: c.main.k === 0 }] : []),
      ...c.rows.map((r) => ({ label: label(r), k: r.k, n: r.n })),
    ];
    const next: ChestRecord = { openedAt: isoLocal(new Date()), lines, fact: c.fact ? factLine(t, c.fact) : undefined, reward: rewardFor(week) };
    saveChest(week, next);
    setRec(next);
  };

  const place = () => {
    if (!rec) return;
    haptics.success();
    const next = { ...rec, placed: true };
    saveChest(week, next);
    setRec(next);
    onPlaced();
  };

  return createPortal(
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex flex-col bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="flex justify-end px-3 pt-[max(env(safe-area-inset-top),12px)]">
        <button type="button" onClick={onClose} aria-label={t("common.close")} className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground">
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center overflow-y-auto px-6 pb-10 text-center">
        {!rec ? (
          <>
            <div className="flex flex-1 flex-col items-center justify-center">
              <img src={mapPic("chest_closed")} alt="" width={200} height={169} className="chest-drop" draggable={false} />
              <p className="mt-6 text-[30px] font-bold tracking-tight">{t("path.chest.ready")}</p>
              <p className="mt-1 text-[17px] font-medium text-muted-foreground">{t("path.weekN", { n: week + 1 })}</p>
            </div>
            <Pressable tone="gold" haptic="none" onClick={open} className="h-[58px] w-full max-w-sm rounded-2xl" faceClassName="text-[16px] font-extrabold uppercase tracking-[0.06em]">
              {t("path.chest.open")}
            </Pressable>
          </>
        ) : (
          <>
            <img src={mapPic("chest_open_map")} alt="" width={170} height={176} className="mt-2" draggable={false} />
            <p className="mt-3 text-[28px] font-bold tracking-tight">{t("path.chest.mapOfWeek")}</p>
            <div className="surface mt-5 w-full max-w-sm rounded-[20px] px-5 py-4 text-left">
              {rec.lines.length === 0 && <p className="text-[17px] font-semibold">{t("path.chest.calm")}</p>}
              {rec.lines.map((l, i) => (
                <div key={i} className={i > 0 ? "mt-3 border-t border-foreground/[0.06] pt-3" : ""}>
                  {l.calm && <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[hsl(var(--coin-teal))]">{t("path.chest.calm")}</p>}
                  <p className={l.main ? "text-[20px] font-bold leading-tight" : "text-[17px] font-semibold leading-tight"}>
                    {l.label} · {t("path.chest.kOfN", { k: l.k, count: l.n })}
                  </p>
                </div>
              ))}
              {rec.fact && (
                <div className="mt-3 border-t border-foreground/[0.06] pt-3">
                  <p className="text-[17px] leading-snug">{rec.fact}</p>
                  <span className="mt-2 inline-flex h-7 items-center gap-1.5 rounded-full border border-foreground/15 px-2.5 text-[13px] font-semibold text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" strokeWidth={2.4} />
                    {t("path.chest.early")}
                  </span>
                </div>
              )}
            </div>
            <div className="mt-6 flex items-center gap-3">
              <img src={mapPic(rec.reward)} alt="" width={64} height={64} className="object-contain" draggable={false} />
              <p className="text-left text-[17px] font-semibold">{t("path.chest.earned", { item: t(`path.reward.${rec.reward}`) })}</p>
            </div>
            <div className="mt-6 w-full max-w-sm">
              {rec.placed ? (
                <p className="text-[15px] font-semibold text-muted-foreground">{t("path.chest.placed")}</p>
              ) : (
                <Pressable tone="gold" haptic="none" onClick={place} className="h-[58px] w-full rounded-2xl" faceClassName="text-[16px] font-extrabold uppercase tracking-[0.06em]">
                  {t("path.chest.put")}
                </Pressable>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};
