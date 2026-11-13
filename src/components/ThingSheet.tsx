// The page of one thing (Nov 13 2026; her words on the mockup: «мне нравится формат карточки от страницы одной вещи…
// визуально всё очень понятно»). One question, the app's four parts in their order: My days, Links, When to act, What
// helps. It lives on the question's island (a tap on the question there) and only quotes what the four parts hold:
// every row opens its own place. No new counting here.
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, ChevronRight, Lightbulb, Spline, Sprout } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import type { Tracker, TrackerEntry } from "@/types/tracker";
import { computeCorrelations } from "@/lib/correlations";
import { isHardAnswer, isNeutralQuestion, islandName, islandOf, linkOf, linkWorthShowing, LINKS_TOP, type IslandId, type Route } from "@/lib/islands";
import { linkHeadSegs, linkNumbers, linkTimes, trackerLookup } from "@/lib/linkText";
import { litTrackers } from "@/lib/lighthouses";
import { EXPERIMENT_DAYS, experimentDay, runningExperiments } from "@/lib/experiments";
import { reasonChips, reasonLabel } from "@/lib/reasons";
import { cardQuestion } from "@/lib/cardText";
import { cap } from "@/lib/answerPhrases";
import { daysAgoIso } from "@/lib/doors";
import { haptics } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const DAYS = 30;

export const ThingSheet = ({ tracker, trackers, entries, onClose, onDays, onLinks, onAct, onTry }: {
  tracker: Tracker | null; trackers: Tracker[]; entries: TrackerEntry[]; onClose: () => void;
  /** My days for this question */ onDays: (id: string) => void;
  /** Links of this question; the pair to show open */ onLinks: (id: string, pair: [string, string] | null) => void;
  /** When to act */ onAct: () => void;
  /** pick something to try on its island */ onTry: (island: IslandId) => void;
}) => {
  const { t } = useTranslation();
  const tr = tracker;
  const data = useMemo(() => {
    if (!tr) return null;
    const mine = new Map(entries.filter((e) => e.trackerId === tr.id).map((e) => [e.date, e]));
    // the last 30 days, oldest first: hard, calm, or no answer
    const days = Array.from({ length: DAYS }, (_, i) => { const e = mine.get(daysAgoIso(DAYS - 1 - i)); return !e || typeof e.value !== "boolean" ? "none" : isHardAnswer(tr, e.value) ? "hard" : "calm"; });
    const neutral = isNeutralQuestion(tr);
    const yes = Array.from({ length: DAYS }, (_, i) => mine.get(daysAgoIso(DAYS - 1 - i))?.value === true).filter(Boolean).length;
    const links = computeCorrelations(trackers.filter((x) => !x.archived && x.source !== "play"), entries, LINKS_TOP).filter(linkWorthShowing)
      .filter((c) => c.trackerA.id === tr.id || c.trackerB.id === tr.id);
    const top = links[0];
    const route: Route | null = top ? (() => { const l = linkOf(top); return { ...l, a: "other", b: "other", first: l.first.id, second: l.second.id } as Route; })() : null;
    // what the person said in "Why?" on the hard days of this question: the most common reason
    const chips = new Set(reasonChips(tr));
    const tally = new Map<string, number>(); let said = 0;
    if (chips.size) for (const e of mine.values()) { const tags = (e.tags ?? []).filter((x) => chips.has(x)); if (tags.length) { said++; for (const x of tags) tally.set(x, (tally.get(x) ?? 0) + 1); } }
    const word = [...tally.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
    const lit = litTrackers(trackers, entries).has(tr.id);
    const pairKeys = new Set(links.map((c) => [c.trackerA.id, c.trackerB.id].sort().join("|")));
    const trying = runningExperiments().find((x) => x.from === tr.id || (!!x.link && pairKeys.has(x.link))) ?? null;
    return { days, neutral, yes, hard: days.filter((d) => d === "hard").length, links, route, word, said, lit, trying };
  }, [tr, trackers, entries]);
  const of = trackerLookup(trackers);
  const icon = (I: typeof CalendarDays, on = false, dim = false) => (
    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", on ? "bg-[hsl(var(--coin-teal))] text-white" : dim ? "bg-foreground/[0.06] text-muted-foreground" : "bg-[hsl(var(--coin-teal)/0.14)] text-[hsl(var(--coin-teal))]")}>
      <I className="h-[18px] w-[18px]" strokeWidth={2.4} />
    </span>
  );
  const part = (k: string, dim = false, arrow = false) => (
    <span className={cn("flex items-center justify-between text-[13px] font-bold", dim ? "text-muted-foreground" : "text-[hsl(var(--coin-teal))]")}>{t(k)}{arrow && <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={2.4} />}</span>
  );
  const l1 = "mt-0.5 block text-[17px] font-bold leading-snug";
  const l2 = "mt-0.5 block text-[14px] font-semibold text-muted-foreground";
  const row = "relative grid w-full grid-cols-[36px_minmax(0,1fr)] gap-x-3 pb-5 text-left";
  const rail = "before:absolute before:left-[17px] before:top-[40px] before:bottom-[2px] before:border-l-[2.5px] before:border-dotted before:border-foreground/15";
  const go = (f: () => void) => () => { haptics.tap(); f(); };
  return (
    <BottomSheet open={!!tr} onOpenChange={(o) => { if (!o) onClose(); }} className="h-auto max-h-[92vh]" ariaTitle={tr ? cardQuestion(tr) : ""}>
      {tr && data && (
        <div data-thing={tr.id} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-10">
          <p className="pr-10 pt-1 text-[12px] font-extrabold uppercase tracking-[0.1em] text-muted-foreground">{islandName(t, islandOf(tr))}</p>
          <h2 className="pb-4 pr-10 text-[23px] font-bold leading-tight tracking-tight">{cardQuestion(tr)}</h2>

          <button type="button" data-thing-row="days" onClick={go(() => onDays(tr.id))} className={cn(row, rail)}>
            {icon(CalendarDays)}
            <span>
              {part("world4.myDays", false, true)}
              <span className={l1}>{t("thing.days", { k: data.neutral ? data.yes : data.hard, n: DAYS })}</span>
              <span className="mt-2 grid w-max grid-cols-7 gap-[5px]" aria-hidden="true">
                {data.days.map((d, i) => <span key={i} className="h-[10px] w-[10px] rounded-full" style={{ background: d === "none" ? "hsl(var(--foreground) / 0.09)" : data.neutral ? "hsl(var(--data-a))" : d === "hard" ? "hsl(var(--strong))" : "hsl(var(--balanced))" }} />)}
              </span>
            </span>
          </button>

          {data.route || data.word ? (
            <div data-thing-row="links" className={cn(row, rail)}>
              {icon(Spline)}
              <span>
                {part("world4.links")}
                {data.route && (
                  <button type="button" data-thing-link onClick={go(() => onLinks(tr.id, [data.route!.first, data.route!.second]))} className="mt-1 flex w-full items-center justify-between gap-2 text-left">
                    <span>
                      <span className="block text-[13px] font-semibold text-muted-foreground">{t("thing.fromDays")}</span>
                      <span className="block text-[16.5px] font-bold leading-snug">{linkHeadSegs(t, data.route, of).map((x) => x.text).join("")}</span>
                      <span className={l2}>{cap(linkTimes(t, linkNumbers(data.route).k, linkNumbers(data.route).n))}{data.links.length > 1 ? ` · ${t("link.alsoMore", { count: data.links.length - 1 })}` : ""}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2.4} />
                  </button>
                )}
                {data.word && (
                  <span data-thing-words className={cn("block", data.route && "mt-3 border-t-[1.5px] border-dotted border-foreground/15 pt-3")}>
                    <span className="block text-[13px] font-semibold text-muted-foreground">{t("thing.inWords")}</span>
                    <span className="block text-[16.5px] font-bold leading-snug">{cap(reasonLabel(t, data.word[0]))}</span>
                    <span className={l2}>{t("thing.wordsCount", { k: data.word[1], n: data.said })}</span>
                  </span>
                )}
              </span>
            </div>
          ) : (
            <div data-thing-row="links" className={cn(row, rail)}>
              {icon(Spline, false, true)}
              <span>{part("world4.links", true)}<span className={cn(l1, "font-semibold text-muted-foreground")}>{t("thing.noLink")}</span></span>
            </div>
          )}

          {data.lit ? (
            <button type="button" data-thing-row="act" onClick={go(onAct)} className={cn(row, rail)}>
              {icon(Lightbulb)}
              <span>{part("world4.whenToAct", false, true)}<span className={l1}><span className="mr-2 inline-block h-[9px] w-[9px] rounded-full bg-[hsl(var(--coin-gold))] align-[1px] shadow-[0_0_0_4px_hsl(var(--coin-gold)/0.3)]" />{t("thing.often")}</span></span>
            </button>
          ) : (
            <div data-thing-row="act" className={cn(row, rail)}>
              {icon(Lightbulb, false, true)}
              <span>{part("world4.whenToAct", true)}<span className={cn(l1, "font-semibold text-muted-foreground")}>{t("thing.calm")}</span></span>
            </div>
          )}

          <div data-thing-row="helps" className={cn(row, "pb-0")}>
            {icon(Sprout, true)}
            <span>
              {part("world4.whatHelps")}
              {data.trying ? (
                <>
                  <span data-thing-trying className={l1}>{t("thing.trying", { what: data.trying.change })}</span>
                  <span className={l2}>{t("world4.testDay", { k: Math.min(experimentDay(data.trying), EXPERIMENT_DAYS), count: EXPERIMENT_DAYS })}</span>
                </>
              ) : (
                <>
                  <span className={l1}>{t("thing.tryOne")}</span>
                  <button type="button" data-thing-try onClick={go(() => (data.lit ? onAct() : onTry(islandOf(tr))))} className="raised-btn mt-3 justify-center">{t("link.tryAsk")}</button>
                </>
              )}
            </span>
          </div>
        </div>
      )}
    </BottomSheet>
  );
};
