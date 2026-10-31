// Today's path of evenings (Aurora UX, step 1, Oct 31 2026). Replaces
// the "Last 7 days" card and the lone "Answer tonight's N" button: one
// stop per evening, seven make a week, the seventh opens a report.
// Mechanics from Duolingo's lesson path; drawn in her Aurora Light.
// Mockup: marketing/aurora-light-ux/1-duolingo-mechanics-aurora-light.png
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check, Flame, Gift, Lock, MoonStar, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { calculateGlobalStreak } from "@/lib/globalStreak";
import { EVENINGS_PER_WEEK, pathState } from "@/lib/eveningPath";
import { Tracker, TrackerEntry } from "@/types/tracker";

// Stops sit on a gentle zigzag inside a 340-wide box (fits a 375pt phone).
const W = 340;
const STEP = 74;
const TOP = 34;
// Chosen so tonight's card (about 150 wide) always fits beside its stop.
const XS = [140, 220, 250, 200, 120, 90, 150];

const WEEK_TITLES = 4; // path.week0..week3; later weeks reuse the last one

export const EveningPath = ({
  trackers,
  entries,
  onStartTonight,
  onOpenReport,
}: {
  trackers: Tracker[];
  entries: TrackerEntry[];
  onStartTonight: () => void;
  onOpenReport: () => void;
}) => {
  const { t } = useTranslation();
  const s = useMemo(() => pathState(trackers, entries), [trackers, entries]);
  const streak = useMemo(() => calculateGlobalStreak(entries).currentStreak, [entries]);
  if (s.leftTonight === 0 && s.totalEvenings === 0 && trackers.length === 0) return null;

  const pts = XS.map((x, i) => [x, TOP + i * STEP] as const);
  const height = TOP + (EVENINGS_PER_WEEK - 1) * STEP + 46;
  let route = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const my = (ay + by) / 2;
    route += ` C${ax},${my} ${bx},${my} ${bx},${by}`;
  }

  const left = EVENINGS_PER_WEEK - s.doneInWeek;
  const reportLabel = s.week === 0 ? t("path.firstReport") : t("path.weekReport");
  const title = t(`path.week${Math.min(s.week, WEEK_TITLES - 1)}`);

  const start = () => {
    haptics.medium();
    onStartTonight();
  };

  return (
    <section aria-label={title} className="animate-fade-in">
      {/* Small facts first: the streak, and evenings so far. */}
      <div className="flex flex-wrap gap-2">
        {streak > 0 && <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-foreground/[0.10] bg-card/80 px-3 text-[14px] font-medium text-muted-foreground shadow-sm">
          <Flame className="h-4 w-4 text-amber-500" strokeWidth={2.2} />
          <b className="font-bold text-foreground">{streak}</b>
          {t("path.streak", { count: streak })}
        </span>}
        {s.totalEvenings > 0 && <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-foreground/[0.10] bg-card/80 px-3 text-[14px] font-medium text-muted-foreground shadow-sm">
          <MoonStar className="h-4 w-4 text-primary" strokeWidth={2.2} />
          <b className="font-bold text-foreground">{s.totalEvenings}</b>
          {t("path.evenings", { count: s.totalEvenings })}
        </span>}
      </div>

      {/* The week: number, title, progress. */}
      <div className="mt-3 rounded-[24px] bg-gradient-to-br from-primary to-[hsl(172_70%_33%)] px-[18px] py-4 text-primary-foreground shadow-[0_14px_30px_-14px_hsl(var(--primary)/0.8)]">
        <p className="text-[13px] font-medium opacity-85">
          {t("path.weekLabel", { n: s.week + 1, k: s.doneInWeek })}
        </p>
        <p className="mt-0.5 text-[21px] font-bold tracking-tight">{title}</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/30">
          <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${(s.doneInWeek / EVENINGS_PER_WEEK) * 100}%` }} />
        </div>
        {s.week > 0 && (
          <button type="button" onClick={onOpenReport} className="mt-3 inline-flex items-center gap-1 text-[14px] font-semibold opacity-90">
            {t("path.lastReport")} <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* The path. */}
      <div className="relative mx-auto mt-3" style={{ width: W, height }}>
        <svg width={W} height={height} className="absolute inset-0 overflow-visible" aria-hidden="true">
          <path d={route} fill="none" stroke="hsl(var(--foreground) / 0.16)" strokeWidth={3} strokeDasharray="1 9" strokeLinecap="round" />
        </svg>
        {pts.map(([x, y], i) => {
          const last = i === EVENINGS_PER_WEEK - 1;
          const done = i < s.doneInWeek;
          const tonight = !s.tonightDone && i === s.tonightIndex;
          const size = tonight ? 72 : last ? 64 : 56;
          // Put the card on whichever side has more room.
          const onRight = W - (x + size / 2 + 12) >= x - size / 2 - 12;
          return (
            <div key={i}>
              <button
                type="button"
                disabled={!tonight && !(last && s.weekComplete)}
                onClick={tonight ? start : last && s.weekComplete ? onOpenReport : undefined}
                aria-label={tonight ? t("path.tonight") : last ? reportLabel : undefined}
                className={cn(
                  "absolute flex items-center justify-center rounded-full transition-transform active:scale-95 disabled:active:scale-100",
                  done && !last && "bg-gradient-to-br from-primary to-[hsl(172_70%_33%)] text-primary-foreground shadow-[0_0_0_4px_hsl(var(--background)),0_10px_22px_-10px_hsl(var(--primary)/0.9)]",
                  tonight && "bg-gradient-to-br from-primary to-[hsl(172_70%_33%)] text-primary-foreground shadow-[0_0_0_4px_hsl(var(--background)),0_0_0_7px_hsl(var(--primary)),0_0_0_15px_hsl(var(--primary)/0.16),0_12px_26px_-10px_hsl(var(--primary)/0.9)]",
                  !done && !tonight && !last && "bg-card text-muted-foreground/70 shadow-[0_0_0_4px_hsl(var(--background)),0_6px_16px_-8px_rgba(20,60,80,0.35)]",
                  last && "bg-gradient-to-br from-amber-300 to-amber-500 text-white shadow-[0_0_0_4px_hsl(var(--background)),0_12px_24px_-10px_rgba(229,154,47,0.8)]",
                  last && !done && !tonight && "opacity-90",
                )}
                style={{ left: x - size / 2, top: y - size / 2, width: size, height: size }}
              >
                {last ? (
                  s.weekComplete ? <Sparkles className="h-7 w-7" strokeWidth={2.2} /> : <Gift className="h-7 w-7" strokeWidth={2.2} />
                ) : done ? (
                  <Check className="h-6 w-6" strokeWidth={3} />
                ) : tonight ? (
                  <MoonStar className="h-8 w-8" strokeWidth={2.1} />
                ) : (
                  <Lock className="h-5 w-5" strokeWidth={2.2} />
                )}
                {tonight && <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping [animation-duration:2.4s]" aria-hidden="true" />}
              </button>

              {/* Tonight's card: what's left, one tap to start. */}
              {tonight && !last && (
                <button
                  type="button"
                  onClick={start}
                  className={cn(
                    "absolute flex items-center gap-3 whitespace-nowrap rounded-2xl border border-foreground/[0.08] bg-card py-2.5 pl-3.5 pr-2.5 text-left shadow-[0_14px_32px_-14px_rgba(20,60,80,0.45)] active:scale-[0.98] transition-transform",
                  )}
                  style={onRight ? { left: x + size / 2 + 12, top: y - 28 } : { right: W - (x - size / 2 - 12), top: y - 28 }}
                >
                  <span>
                    <span className="block text-[12px] text-muted-foreground">{t("path.tonight")}</span>
                    <span className="block text-[15px] font-bold">{t("path.questions", { count: s.leftTonight })}</span>
                  </span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.4} />
                  </span>
                </button>
              )}

              {/* The report stop. */}
              {last && (
                <div
                  className="absolute whitespace-nowrap"
                  style={onRight ? { left: x + size / 2 + 12, top: y - 20 } : { right: W - (x - size / 2 - 12), top: y - 20, textAlign: "right" }}
                >
                  <p className="text-[15px] font-bold">{s.weekComplete ? t("path.reportReady") : reportLabel}</p>
                  {s.weekComplete ? (
                    <button type="button" onClick={onOpenReport} className="text-[14px] font-semibold text-primary">
                      {t("path.openReport")}
                    </button>
                  ) : tonight ? (
                    <button type="button" onClick={start} className="text-[14px] font-semibold text-primary">
                      {t("path.tonightUnlocks")}
                    </button>
                  ) : (
                    <p className="text-[13px] text-muted-foreground">{t("path.inEvenings", { count: left })}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {/* Done for tonight: a quiet line under the path instead of a button. */}
      </div>
      {s.tonightDone && !s.weekComplete && (
        <p className="-mt-1 text-center text-[15px] text-muted-foreground">{t("path.doneTonight")}</p>
      )}
    </section>
  );
};
