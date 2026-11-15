// One question's four rows, in the app's order: My days, Links, When to act, What helps (the page of one thing, Nov 13
// 2026; her words: «мне нравится формат карточки от страницы одной вещи… визуально всё очень понятно»). Since Nov 15
// 2026 they stand on the island itself, under the question switcher (board C), and in the thing's own sheet. It only
// quotes what the four parts hold: every row opens its own place. No new counting here.
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, Check, ChevronRight, FlaskConical, Hourglass, Lightbulb, Link2, Sprout } from "lucide-react";
import { linkMark } from "@/lib/linkSeen";
import { doneActions } from "@/lib/actionLog";
import { countedDays, LINKS_AT } from "@/lib/pathSteps";
import type { Tracker, TrackerEntry } from "@/types/tracker";
import { computeCorrelations } from "@/lib/correlations";
import { isHardAnswer, isNeutralQuestion, islandOf, linkOf, linkWorthShowing, LINKS_TOP, type IslandId, type Route } from "@/lib/islands";
import { linkHeadSegs, linkNumbers, linkTimes, trackerLookup } from "@/lib/linkText";
import { litTrackers } from "@/lib/lighthouses";
import { EXPERIMENT_DAYS, experimentDay, experimentOver, runningExperiments } from "@/lib/experiments";
import { ideaOf, testNameOf } from "@/lib/testWords";
import { ideaTarget } from "@/lib/topicIdeas";
import { reasonLabel, reasonTally } from "@/lib/reasons";
import { cap } from "@/lib/answerPhrases";
import { daysAgoIso } from "@/lib/doors";
import { haptics } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export const THING_DAYS = 30;

export interface ThingActions {
  /** My days for this question */ onDays: (id: string) => void;
  /** Links of this question; the pair to show open */ onLinks: (id: string, pair: [string, string] | null) => void;
  /** When to act */ onAct: () => void;
  /** pick something to try for this question (its own changes) */ onTry: (island: IslandId, forId?: string) => void;
}

export const ThingBody = ({ tracker: tr, trackers, entries, onDays, onLinks, onAct, onTry }: { tracker: Tracker; trackers: Tracker[]; entries: TrackerEntry[] } & ThingActions) => {
  const { t } = useTranslation();
  const DAYS = THING_DAYS;
  const data = useMemo(() => {
    const mine = new Map(entries.filter((e) => e.trackerId === tr.id).map((e) => [e.date, e]));
    // the last 30 days, oldest first: hard, calm, or no answer
    const days = Array.from({ length: DAYS }, (_, i) => { const e = mine.get(daysAgoIso(DAYS - 1 - i)); return !e || typeof e.value !== "boolean" ? "none" : isHardAnswer(tr, e.value) ? "hard" : "calm"; });
    const neutral = isNeutralQuestion(tr);
    const yes = Array.from({ length: DAYS }, (_, i) => mine.get(daysAgoIso(DAYS - 1 - i))?.value === true).filter(Boolean).length;
    const links = computeCorrelations(trackers.filter((x) => !x.archived && x.source !== "play"), entries, LINKS_TOP).filter(linkWorthShowing)
      .filter((c) => c.trackerA.id === tr.id || c.trackerB.id === tr.id);
    const top = links[0];
    const routes: Route[] = links.map((c) => { const l = linkOf(c); return { ...l, a: "other", b: "other", first: l.first.id, second: l.second.id } as Route; });
    const route: Route | null = top ? routes[0] : null;
    // what the person said in "Why?" on the hard days of this question: the most common reason
    // (reasonTally, shared with the fights' task: "other" and "don't know" are never the most common reason)
    const tl = reasonTally(tr, entries), said = tl.said;
    const word = tl.top ? ([tl.top, tl.k] as [string, number]) : null;
    const lit = litTrackers(trackers, entries).has(tr.id);
    const pairKeys = new Set(links.map((c) => [c.trackerA.id, c.trackerB.id].sort().join("|")));
    // every try for this question: from it, from one of its links, on its days, or picked on its island for it
    const tries = runningExperiments().filter((x) => x.from === tr.id || (!!x.link && pairKeys.has(x.link)) || x.scope?.trackerId === tr.id
      || (!x.link && !x.from && ideaTarget(ideaOf(x.change), x.island, trackers, entries)?.id === tr.id));
    const trying = tries[0] ?? null;
    // what this question did lately: a once-off step marked Done in the last two weeks
    const twoWeeks = daysAgoIso(14);
    const doneOnce = [...doneActions()].reverse().find((x) => x.trackerId === tr.id && x.date >= twoWeeks) ?? null;
    // its links: one not looked at yet, or all seen and none tried
    const unseen = routes.find((rt) => !linkMark(rt.first, rt.second, !!rt.nextDay)) ?? null;
    const evenings = countedDays(trackers, entries).length;
    return { days, neutral, yes, hard: days.filter((d) => d === "hard").length, links, routes, route, word, said, lit, trying, tries, doneOnce, unseen, evenings };
  }, [tr, trackers, entries, DAYS]);
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
  // Now: where this question stands, one button for its next step (Nov 15 2026)
  const now = data.trying
    ? { kind: "trying", icon: FlaskConical, line: t("thingNow.trying", { what: testNameOf(data.trying.change) }), sub: t("world4.testDay", { k: Math.min(experimentDay(data.trying), EXPERIMENT_DAYS), count: EXPERIMENT_DAYS }), act: t("thingNow.see"), go: () => window.dispatchEvent(new CustomEvent("memap-open-helps", { detail: { id: data.trying?.id } })) }
    : data.doneOnce
    ? { kind: "done", icon: Check, line: t("thingNow.done", { what: data.doneOnce.kind === "home" ? t(data.doneOnce.plan) : testNameOf(data.doneOnce.plan) }), sub: t("thingNow.doneSub"), act: t("thingNow.see"), go: () => window.dispatchEvent(new CustomEvent("memap-open-helps")) }
    : data.lit
    ? { kind: "act", icon: Lightbulb, line: t("thingNow.act"), sub: t("thingNow.actSub"), act: t("thingNow.plan"), go: onAct }
    : data.unseen
    ? { kind: "new", icon: Link2, line: t("thingNow.newLink"), sub: undefined, act: t("thingNow.see"), go: () => onLinks(tr.id, [data.unseen!.first, data.unseen!.second]) }
    : data.route
    ? { kind: "seen", icon: Link2, line: t("thingNow.seenLink"), sub: t("thingNow.seenSub"), act: t("thingNow.choose"), go: () => onTry(islandOf(tr), tr.id) }
    : data.evenings < LINKS_AT
    ? { kind: "waiting", icon: Hourglass, line: t("thingNow.waiting", { count: LINKS_AT - data.evenings }), sub: undefined, act: undefined, go: undefined }
    : { kind: "calm", icon: Hourglass, line: t("thingNow.calm"), sub: undefined, act: undefined, go: undefined };
  const NowIcon = now.icon;
  return (
    <div data-thing={tr.id}>
      <div data-thing-now={now.kind} className="mb-4 flex items-center gap-3 rounded-[18px] bg-[hsl(var(--coin-teal)/0.1)] px-3.5 py-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[hsl(var(--coin-teal))] text-white"><NowIcon className="h-4 w-4" strokeWidth={2.6} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold leading-snug">{now.line}</span>
          {now.sub && <span className="block text-[13px] font-semibold text-muted-foreground">{now.sub}</span>}
        </span>
        {now.act && now.go && (
          <button type="button" data-thing-now-go onClick={go(now.go)} className="h-9 shrink-0 rounded-full bg-[hsl(var(--coin-teal))] px-3.5 text-[14px] font-bold text-white">{now.act}</button>
        )}
      </div>
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
          {icon(Link2)}
          <span>
            {part("world4.links")}
            {data.route && <span className="mt-1 block text-[13px] font-semibold text-muted-foreground">{t("thing.fromDays")}</span>}
            {/* every link of this thing, the strongest first, each one way to its card (Nov 14 2026: the link card no
                longer lists the others; this page holds them) */}
            {data.routes.slice(0, 4).map((route, i) => (
              <button key={`${route.first}|${route.second}`} type="button" data-thing-link onClick={go(() => onLinks(tr.id, [route.first, route.second]))}
                className={cn("flex w-full items-center justify-between gap-2 text-left", i > 0 ? "mt-2.5" : "mt-0.5")}>
                <span>
                  <span className={cn("block leading-snug", i === 0 ? "text-[16.5px] font-bold" : "text-[15.5px] font-semibold")}>{linkHeadSegs(t, route, of).map((x) => x.text).join("")}</span>
                  <span className={l2}>{cap(linkTimes(t, linkNumbers(route).k, linkNumbers(route).n))}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2.4} />
              </button>
            ))}
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
          {icon(Link2, false, true)}
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

      {data.tries.length > 0 ? (
        // every try for this question, each with its day and when its result comes; each opens in What helps
        <div data-thing-row="helps" className={cn(row, "pb-0")}>
          {icon(Sprout, true)}
          <span className="min-w-0 flex-1">
            {part("world4.whatHelps", false, true)}
            {data.tries.map((x) => {
              const k = Math.min(experimentDay(x), EXPERIMENT_DAYS), left = EXPERIMENT_DAYS - experimentDay(x) + 1;
              return (
                <button key={x.id} type="button" data-thing-trying onClick={go(() => window.dispatchEvent(new CustomEvent("memap-open-helps", { detail: { id: x.id } })))}
                  className="mt-1.5 flex w-full items-center gap-2 text-left">
                  <span className="min-w-0 flex-1">
                    <span className={l1}>{t("thing.trying", { what: testNameOf(x.change) })}</span>
                    <span className={l2}>{t("world4.testDay", { k, count: EXPERIMENT_DAYS })} · {experimentOver(x) ? t("thing.resultReady") : t("thing.resultIn", { count: Math.max(1, left) })}</span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={2.4} />
                </button>
              );
            })}
          </span>
        </div>
      ) : (
        <div data-thing-row="helps" className={cn(row, "pb-0")}>
          {icon(Sprout, true)}
          <span>
            {part("world4.whatHelps")}
            <span className={l1}>{t("thing.tryOne")}</span>
            <button type="button" data-thing-try onClick={go(() => (data.lit ? onAct() : onTry(islandOf(tr), tr.id)))} className="raised-btn mt-3 justify-center">{t("link.tryAsk")}</button>
          </span>
        </div>
      )}
    </div>
  );
};
