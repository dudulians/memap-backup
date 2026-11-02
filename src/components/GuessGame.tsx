// "Guess" (Aurora, Nov 2 2026; her ask: "практику какую-то или мини-игру на
// каком-то из шагов, чтоб было интересно быть в приложении весь день").
// One short round a day on her own data, counts only, never a loss:
// - with a link: "After a short night, does a headache come more often,
//   the same, or less often?" → the real counts;
// - before any link: "On how many of the last 7 days did X happen?" → the
//   real number.
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { computeCorrelations } from "@/lib/correlations";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import { isoLocal } from "@/lib/doors";
import { mapPic } from "@/lib/islands";
import { markGamePlayed } from "@/lib/pathSteps";
import { Pressable } from "@/components/ui/pressable";


type Round =
  | { kind: "link"; a: string; b: string; nextDay: boolean; withA: [number, number]; without: [number, number]; truth: "more" | "same" | "less" }
  | { kind: "week"; id: string; days: number; answered: number };

const dayNumber = () => Math.floor(Date.now() / 86_400_000);

const pickRound = (trackers: Tracker[], entries: TrackerEntry[]): Round | null => {
  const links = computeCorrelations(trackers, entries, 6).filter((c) => c.counts.bothYes + c.counts.aYesBNo >= 3 && c.counts.aNoBYes + c.counts.bothNo >= 3);
  if (links.length > 0) {
    const c = links[dayNumber() % links.length];
    const flip = c.lag === -1;
    const { bothYes, aYesBNo, aNoBYes, bothNo } = c.counts;
    // "first" leads, "second" follows: same reading as the map's links.
    const withA: [number, number] = flip ? [bothYes, bothYes + aNoBYes] : [bothYes, bothYes + aYesBNo];
    const without: [number, number] = flip ? [aYesBNo, aYesBNo + bothNo] : [aNoBYes, aNoBYes + bothNo];
    const p1 = withA[1] ? withA[0] / withA[1] : 0;
    const p0 = without[1] ? without[0] / without[1] : 0;
    const truth = p1 - p0 > 0.1 ? "more" : p0 - p1 > 0.1 ? "less" : "same";
    return { kind: "link", a: flip ? c.trackerB.id : c.trackerA.id, b: flip ? c.trackerA.id : c.trackerB.id, nextDay: c.lag !== 0, withA, without, truth };
  }
  const from = new Date();
  from.setDate(from.getDate() - 6);
  const since = isoLocal(from);
  const live = trackers.filter((t) => !t.archived && t.source !== "play");
  const scored = live.map((t) => {
    const es = entries.filter((e) => e.trackerId === t.id && e.date >= since);
    return { id: t.id, days: new Set(es.filter((e) => e.value).map((e) => e.date)).size, answered: new Set(es.map((e) => e.date)).size };
  }).filter((x) => x.answered >= 3);
  if (scored.length === 0) return null;
  const s = scored[dayNumber() % scored.length];
  return { kind: "week", ...s };
};

/** Can there be a round today? (at least 3 answered days of something) */
export const hasGame = (trackers: Tracker[], entries: TrackerEntry[]) => pickRound(trackers, entries) !== null;

export const GuessGame = ({ trackers, entries, onClose }: { trackers: Tracker[]; entries: TrackerEntry[]; onClose: (played: boolean) => void }) => {
  const { t } = useTranslation();
  const round = useMemo(() => pickRound(trackers, entries), [trackers, entries]);
  const [guess, setGuess] = useState<string | null>(null);
  if (!round) return null;
  const title = (id: string) => localizeTrackerTitle(trackers.find((x) => x.id === id)?.title ?? "");
  const choose = (g: string) => {
    haptics.medium();
    setGuess(g);
    markGamePlayed();
  };
  const right = round.kind === "link" ? guess === round.truth : guess !== null && Math.abs(Number(guess) - round.days) <= 1;

  return createPortal(
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex flex-col bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="flex justify-end px-3 pt-[max(env(safe-area-inset-top),12px)]">
        <button type="button" onClick={() => onClose(guess !== null)} aria-label={t("common.close")} className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground">
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto px-6 pb-10">
        <p className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">{t("game.title")}</p>
        {round.kind === "link" ? (
          <>
            <p className="mt-2 text-[26px] font-bold leading-tight tracking-tight">
              {t(round.nextDay ? "game.linkQNext" : "game.linkQ", { a: title(round.a), b: title(round.b) })}
            </p>
            <div className="mt-6 space-y-2.5">
              {(["more", "same", "less"] as const).map((g) => (
                <button key={g} type="button" disabled={guess !== null} onClick={() => choose(g)}
                  className={cn("surface flex h-14 w-full items-center rounded-2xl px-5 text-[17px] font-semibold transition-colors",
                    guess !== null && g === round.truth && "ring-2 ring-[hsl(var(--coin-teal))]",
                    guess === g && g !== round.truth && "opacity-60")}>
                  {t(`game.${g}`)}
                </button>
              ))}
            </div>
            {guess !== null && (
              <div className="surface mt-5 rounded-[20px] px-5 py-4 animate-fade-in">
                <p className="text-[19px] font-bold">{right ? t("game.right") : t("game.nowYouKnow")}</p>
                <p className="mt-2 text-[16px] leading-snug">{t(round.nextDay ? "game.afterA" : "game.withA", { a: title(round.a), b: title(round.b), k: round.withA[0], count: round.withA[1] })}</p>
                <p className="mt-1 text-[16px] leading-snug text-muted-foreground">{t("game.withoutA", { k: round.without[0], count: round.without[1] })}</p>
                <p className="mt-2 text-[13px] font-medium text-muted-foreground">{t("map.notCause")}</p>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="mt-2 text-[26px] font-bold leading-tight tracking-tight">{t("game.weekQ", { x: title(round.id) })}</p>
            <div className="mt-6 grid grid-cols-4 gap-2.5">
              {Array.from({ length: 8 }, (_, n) => String(n)).map((g) => (
                <button key={g} type="button" disabled={guess !== null} onClick={() => choose(g)}
                  className={cn("surface flex h-14 items-center justify-center rounded-2xl text-[20px] font-bold tabular-nums",
                    guess !== null && Number(g) === round.days && "ring-2 ring-[hsl(var(--coin-teal))]",
                    guess === g && Number(g) !== round.days && "opacity-60")}>
                  {g}
                </button>
              ))}
            </div>
            {guess !== null && (
              <div className="surface mt-5 rounded-[20px] px-5 py-4 animate-fade-in">
                <p className="text-[19px] font-bold">{right ? t("game.right") : t("game.nowYouKnow")}</p>
                <p className="mt-2 text-[16px] leading-snug">{t("game.weekA", { x: title(round.id), count: round.days, n: round.answered })}</p>
              </div>
            )}
          </>
        )}
        {guess !== null && (
          <div className="mt-auto flex flex-col items-center pt-8">
            <img src={mapPic("sparkles")} alt="" width={44} height={44} className="mb-3" />
            <Pressable tone="teal" haptic="none" onClick={() => { haptics.success(); onClose(true); }} className="h-[58px] w-full max-w-sm rounded-2xl" faceClassName="text-[16px] font-extrabold uppercase tracking-[0.06em]">
              {t("path.continue")}
            </Pressable>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};
