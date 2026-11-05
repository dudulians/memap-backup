// "What MeMap gives you" (her note, Nov 5 2026): after the first questions the
// path walks her through what the app will show — links, her days, her weeks —
// before there is data to show. Each one: a labelled EXAMPLE, one line, when hers
// starts (dots, a day is a dot), and "Next". "My …" opens the real screen only
// once there is something on it (her: "отжимаешь See Your Links, и там ничего не
// происходит, потому что ещё слишком мало вопросов").
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Link2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { getDoorState } from "@/lib/doors";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import type { DiscoverId } from "@/lib/pathSteps";
import type { Tracker } from "@/types/tracker";

/** Evenings until hers shows something (honest: links need about 10). */
export const DISCOVER_NEEDS: Record<DiscoverId, number> = { links: 10, calendar: 0, chart: 14 };

const Example = () => {
  const { t } = useTranslation();
  return (
    <span className="absolute left-3 top-3 rounded-full bg-foreground/[0.07] px-2.5 py-1 text-[13px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
      {t("discover.example")}
    </span>
  );
};

/** Two of her own questions, joined like a link on the map. */
const LinksExample = ({ trackers }: { trackers: Tracker[] }) => {
  const { t } = useTranslation();
  const pair = useMemo(() => {
    const door = getDoorState();
    const byId = new Map(trackers.map((x) => [x.id, x]));
    const main = door ? byId.get(door.trackerId) : undefined;
    // a context question that is hard the same way as the main one ("Felt anxious"
    // before "Migraine", "Slept enough" before "Had energy"), so the link reads right
    const ctx = main && door ? door.contextTrackerIds.map((id) => byId.get(id)).find((x) => x && x.problemWhen === main.problemWhen) : undefined;
    return main && ctx
      ? [localizeTrackerTitle(ctx.title), localizeTrackerTitle(main.title)]
      : [t("discover.links.a"), t("discover.links.b")];
  }, [trackers, t]);
  const chip = (text: string) => (
    <span className="surface max-w-[42%] rounded-[16px] px-3 py-2 text-center text-[15px] font-bold leading-tight">{text}</span>
  );
  return (
    <div className="relative flex items-center justify-between gap-1 px-3 pb-6 pt-14">
      <Example />
      {chip(pair[0])}
      <span className="relative flex flex-1 items-center justify-center" aria-hidden="true">
        <span className="absolute inset-x-1 top-1/2 border-t-[3px] border-dotted border-[hsl(var(--coin-teal))]" />
        <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--coin-teal))] text-white"><Link2 className="h-5 w-5" strokeWidth={2.4} /></span>
      </span>
      {chip(pair[1])}
      <span className="absolute bottom-2 left-0 right-0 text-center text-[15px] font-bold text-[hsl(var(--coin-teal))]">{t("discover.links.sample", { k: 4, n: 5 })}</span>
    </div>
  );
};

/** A month of dots: indigo = a hard day, lavender = a calm one (the calendar's own colours). */
const CalendarExample = () => {
  const HARD = new Set([2, 3, 9, 15, 16, 22, 29]);
  return (
    <div className="relative px-5 pb-5 pt-14">
      <Example />
      <div className="mx-auto grid w-fit grid-cols-7 gap-2" aria-hidden="true">
        {Array.from({ length: 30 }, (_, i) => (
          <span key={i} className="h-6 w-6 rounded-full"
            style={{ background: i > 25 ? "hsl(var(--foreground) / 0.1)" : HARD.has(i) ? "hsl(var(--strong))" : "hsl(var(--balanced) / 0.75)" }} />
        ))}
      </div>
    </div>
  );
};

/** Hard days a week, getting fewer. */
const ChartExample = () => {
  const { t } = useTranslation();
  const ys = [5, 4, 5, 3, 2, 2];
  const pts = ys.map((y, i) => [20 + i * 52, 100 - y * 16] as const);
  return (
    <div className="relative px-4 pb-4 pt-14">
      <Example />
      <svg viewBox="0 0 300 110" className="w-full" aria-hidden="true">
        <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="hsl(var(--strong))" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="6" fill="hsl(var(--strong))" />)}
      </svg>
      <p className="mt-1 text-center text-[15px] font-bold text-muted-foreground">{t("discover.chart.sample")}</p>
    </div>
  );
};

/** Hers so far: k of n evenings, as dots. */
const Progress = ({ k, n }: { k: number; n: number }) => {
  const { t } = useTranslation();
  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-1.5" aria-hidden="true">
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className="h-3.5 w-3.5 rounded-full" style={{ background: i < k ? "hsl(var(--coin-gold))" : "hsl(var(--foreground) / 0.12)" }} />
        ))}
      </div>
      <p className="mt-1.5 text-[15px] font-semibold text-muted-foreground">{t("discover.progress", { k: Math.min(k, n), n })}</p>
    </div>
  );
};

export const DiscoverSheet = ({ which, title, trackers, days, hasLinks, onNext, onOpenMine, onClose }: {
  which: DiscoverId | null;
  /** the step's name (the calendar's is hers: "Your migraine days") */
  title: string;
  trackers: Tracker[];
  /** evenings that count so far */
  days: number;
  hasLinks: boolean;
  onNext: () => void;
  onOpenMine: () => void;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const need = which ? DISCOVER_NEEDS[which] : 0;
  const mine = which === "links" ? hasLinks : which === "chart" ? days >= need : days > 0;
  return (
    <BottomSheet open={!!which} onOpenChange={(o) => !o && onClose()} ariaTitle={title}>
      {which && (
        <div className="flex flex-col px-5 pb-6">
          <h2 className="pr-10 text-[26px] font-bold leading-tight tracking-tight">{title}</h2>
          <p className="mt-1 text-[17px] font-semibold text-muted-foreground">{t(`discover.${which}.line`)}</p>
          <div className={cn("surface relative mt-4 overflow-hidden rounded-[22px]")}>
            {which === "links" ? <LinksExample trackers={trackers} /> : which === "calendar" ? <CalendarExample /> : <ChartExample />}
          </div>
          {need > 0 ? <Progress k={days} n={need} /> : <p className="mt-4 text-[15px] font-semibold text-muted-foreground">{t("discover.calendar.when")}</p>}
          <button type="button" onClick={() => { haptics.tap(); onNext(); }} className="raised-btn mt-5 w-full justify-center gap-1">
            {t("discover.next")} <ArrowRight className="h-5 w-5" strokeWidth={2.6} />
          </button>
          {mine && (
            <button type="button" onClick={() => { haptics.tap(); onOpenMine(); }} className="quiet-btn mt-2.5 h-12 w-full justify-center text-[16px]">
              {t(`discover.${which}.mine`)}
            </button>
          )}
        </div>
      )}
    </BottomSheet>
  );
};
