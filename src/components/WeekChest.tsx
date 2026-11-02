// Opening a week's chest (Aurora step 6, plan §3.4; her ask: "сундук недели
// с картой внутри"). Ready → the lid opens on "A map of your week" with
// counts from her own days → "You earned: a bridge" → "Put it on my map".
// What it showed is saved when opened and reopens as is.
// Nov 2 2026 (her: "скучно, что награда — это репорт, надо инсайт + какие-то
// новые приколы"): it opens card by card — the insight, the week in
// numbers, how her guesses went — then two rewards: a piece for her map
// and a new title.
import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Clock, Crown, Lightbulb, Telescope, X } from "lucide-react";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { haptics } from "@/lib/haptics";
import { mapPic } from "@/lib/islands";
import { getDoor, getDoorState } from "@/lib/doors";
import { factLine } from "@/lib/echo";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import { chestContent, type ChestStat } from "@/lib/weekChest";
import { getChests, rewardFor, saveChest, titleFor, type ChestRecord } from "@/lib/pathSteps";
import { guessScore } from "@/lib/predict";
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
  // Cards shown so far; an already opened chest shows them all.
  const [shown, setShown] = useState(() => (getChests()[week] ? 99 : 1));

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
    const name = (id: string) => localizeTrackerTitle(trackers.find((x) => x.id === id)?.title ?? "");
    const insight = c.insight
      ? t(c.insight.nextDay ? "game.afterA" : "game.withA", { a: name(c.insight.a), b: name(c.insight.b), k: c.insight.k, count: c.insight.n })
      : undefined;
    const g = guessScore(entries, dates);
    const next: ChestRecord = {
      openedAt: isoLocal(new Date()),
      lines,
      fact: c.fact ? factLine(t, c.fact) : undefined,
      reward: rewardFor(week),
      insight,
      insightOther: c.insight ? t("game.withoutA", { k: c.insight.otherK, count: c.insight.otherN }) : undefined,
      insightEarly: !!c.insight && c.insight.n < 6,
      guesses: g.n > 0 ? g : undefined,
      title: titleFor(week),
    };
    saveChest(week, next);
    setRec(next);
    setShown(1);
  };

  const place = () => {
    if (!rec) return;
    haptics.success();
    const next = { ...rec, placed: true };
    saveChest(week, next);
    setRec(next);
    onPlaced();
  };

  const early = (
    <span className="mt-2 inline-flex h-7 items-center gap-1.5 rounded-full border border-foreground/15 px-2.5 text-[13px] font-semibold text-muted-foreground">
      <Clock className="h-3.5 w-3.5" strokeWidth={2.4} />
      {t("path.chest.early")}
    </span>
  );
  const kicker = (icon: ReactNode, text: string) => (
    <p className="flex items-center gap-1.5 text-[13px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">{icon}{text}</p>
  );

  /** The cards, in the order they open. */
  const cards = (r: ChestRecord): ReactNode[] => {
    const out: ReactNode[] = [];
    // 1. The insight: the strongest link so far, else the door's early clue,
    //    else her topic's count.
    const main = r.lines.find((l) => l.main);
    out.push(
      <div className="surface rounded-[22px] px-5 py-4 text-left">
        {kicker(<Lightbulb className="h-4 w-4 text-[hsl(var(--coin-gold))]" strokeWidth={2.4} />, t("path.chest.insight"))}
        <p className="mt-2 text-[20px] font-bold leading-snug">
          {r.insight ?? r.fact ?? (main ? `${main.label} · ${t("path.chest.kOfN", { k: main.k, count: main.n })}` : t("path.chest.calm"))}
        </p>
        {r.insight && r.insightOther && <p className="mt-1 text-[16px] font-medium leading-snug text-muted-foreground">{r.insightOther}</p>}
        {(r.insight ? r.insightEarly : !!r.fact) && early}
        {r.insight && <p className="mt-2 text-[13px] font-medium text-muted-foreground">{t("map.notCause")}</p>}
      </div>,
    );
    // 2. The week in numbers.
    out.push(
      <div className="surface rounded-[22px] px-5 py-4 text-left">
        {kicker(null, t("path.chest.inNumbers"))}
        {r.lines.length === 0 && <p className="mt-2 text-[17px] font-semibold">{t("path.chest.calm")}</p>}
        {r.lines.map((l, i) => (
          <div key={i} className={i > 0 ? "mt-3 border-t border-foreground/[0.06] pt-3" : "mt-2"}>
            {l.calm && <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[hsl(var(--coin-teal))]">{t("path.chest.calm")}</p>}
            <p className={l.main ? "text-[19px] font-bold leading-tight" : "text-[17px] font-semibold leading-tight"}>
              {l.label} · {t("path.chest.kOfN", { k: l.k, count: l.n })}
            </p>
          </div>
        ))}
      </div>,
    );
    // 3. How her guesses went ("Predict").
    if (r.guesses) {
      out.push(
        <div className="surface rounded-[22px] px-5 py-4 text-left">
          {kicker(<Telescope className="h-4 w-4 text-[hsl(322_30%_56%)]" strokeWidth={2.4} />, t("predict.title"))}
          <p className="mt-2 text-[20px] font-bold leading-snug">{t("path.chest.guessed", { k: r.guesses.hit, count: r.guesses.n })}</p>
          <p className="mt-1 text-[15px] font-medium text-muted-foreground">
            {r.guesses.hit / r.guesses.n >= 0.7 ? t("predict.allRight") : t("predict.someRight")}
          </p>
        </div>,
      );
    }
    // 4. The rewards: a piece for her map and a new title.
    out.push(
      <div className="surface rounded-[22px] px-5 py-4 text-left">
        {kicker(null, t("path.chest.rewards"))}
        <div className="mt-3 flex items-center gap-3">
          <img src={mapPic(r.reward)} alt="" width={56} height={56} className="h-14 w-14 object-contain" draggable={false} />
          <p className="text-[17px] font-semibold leading-snug">{t("path.chest.earned", { item: t(`path.reward.${r.reward}`) })}</p>
        </div>
        {r.title && (
          <div className="mt-3 flex items-center gap-3 border-t border-foreground/[0.06] pt-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--coin-gold)/0.18)] text-[hsl(var(--coin-gold))]">
              <Crown className="h-7 w-7" strokeWidth={2.2} />
            </span>
            <p className="text-[17px] font-semibold leading-snug">{t("path.chest.newTitle", { title: t(`path.titles.${r.title}`) })}</p>
          </div>
        )}
      </div>,
    );
    return out;
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
            <img src={mapPic("chest_open_map")} alt="" width={140} height={145} className="mt-1" draggable={false} />
            <p className="mt-2 text-[28px] font-bold tracking-tight">{t("path.chest.mapOfWeek")}</p>
            {cards(rec).slice(0, shown).map((card, i) => (
              <div key={i} className="chest-card mt-4 w-full max-w-sm">{card}</div>
            ))}
            <div className="mt-6 w-full max-w-sm">
              {shown < cards(rec).length ? (
                <Pressable tone="gold" haptic="none" onClick={() => { haptics.medium(); setShown((n) => n + 1); }} className="h-[58px] w-full rounded-2xl" faceClassName="text-[16px] font-extrabold uppercase tracking-[0.06em]">
                  {t("path.chest.next")}
                </Pressable>
              ) : rec.placed ? (
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
