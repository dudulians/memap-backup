// "Findings" (1.8.0): the first thing Patterns shows. Same engine as the
// old Links tab (computeCorrelations), but one plain sentence per pair,
// two strips of the last 14 days so you can see it, and "Holds up · 6 of
// 8" instead of phi, co-occurrences and stage badges. Canvas "MeMap:
// новая версия", page 6, "Как надо: паттерны начинаются с находки".
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { computeCorrelations, CorrelationResult } from "@/lib/correlations";
import { isHardAnswer, isNeutralQuestion, isTestQuestion, islandOf, linkOf, linkWorthShowing, LINKS_TOP, mapPic, rankLinks, type IslandId, type Route } from "@/lib/islands";
import { ArrowRight, ChevronDown, Link2 } from "lucide-react";
import { chainText, linkCount, linkHeadSegs, linkNumbers, linkOtherDays, linkTimes, trackerLookup, type Seg, type TrackerOf } from "@/lib/linkText";
import { Chart, dayMarks, weekly, type Series } from "./ChartViews";
import { art, artOf } from "@/lib/globeArt";
import { LINK_ORDER_EVENT, getLinkOrder } from "@/lib/linkOrder";
import { tryOfLink } from "@/lib/experiments";
import { haptics } from "@/lib/haptics";
import { islandDays } from "@/lib/growth";
import { answerClause } from "@/lib/answerPhrases";
import { chainOf, notItFindings, pairOf, type NotIt } from "@/lib/findingForms";
import { ensureTemplates, findTemplate } from "@/lib/doors";
import { templateQuestion } from "@/lib/cardText";
import { answerPhrase, cap, templateIdOf, wordsIdOf } from "@/lib/answerPhrases";
import { markCorrelationSeen } from "@/lib/appRating";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { daysAgoIso, doorCounts, getDoor, getDoorState, strongestContextFact } from "@/lib/doors";
import { factLine } from "@/lib/echo";
import { LINKS_AT, countedDays } from "@/lib/pathSteps";
import { ExampleLink } from "./Examples";
import { OwnWordsPrompt } from "./AnswerWordsFields";
import { LinkTry, OrderAsk, PAIR_A, PAIR_B, trackedTemplates } from "./LinkParts";
import { reasonLabel, reasonTally, reasonTemplate, REASON_LINE_FROM } from "@/lib/reasons";

const STRIP_DAYS = 14;

// A finding is a link told in its real answers (linkOf; her note, Nov 6 2026: the old
// «В дни с «Приступ мигрени» реже было «Спал(а) достаточно (7+ часов)»» "выглядит
// жутко"): "Short night → migraine the next day", and under it "4 of 5 times · on other days 3 of 24".
const routeOf = (c: CorrelationResult): Route => { const l = linkOf(c); return { ...l, a: "other", b: "other", first: l.first.id, second: l.second.id }; };

/** A sentence with its two answers lit (her pick, Nov 12 2026). */
const Said = ({ segs }: { segs: Seg[] }) => (
  <>{segs.map((x, i) => (x.side ? <span key={i} className={x.side === "a" ? "hl-a" : "hl-b"}>{x.text}</span> : <span key={i}>{x.text}</span>))}</>
);
/** A day is a dot, coloured by what the answer means (the one look, Nov 6 2026). */
const toneOf = (tr: Tracker | undefined, v: boolean) =>
  !tr || isNeutralQuestion(tr) || isTestQuestion(tr) ? "hsl(var(--data-a))" : isHardAnswer(tr, v) ? "hsl(var(--strong))" : "hsl(var(--balanced))";
/** Short words for this answer: a library question, or a typed one she named short. Plates only then (her pick, Nov 12
 *  2026: «плашки для коротких»); a typed question as typed reads as a sentence. */
const short = (tr: Tracker | undefined, yes: boolean) => !!tr && (!!wordsIdOf(tr) || !!(yes ? tr.words?.yes : tr.words?.no));
/** Every day of the last weeks with that answer, 7 a week, oldest week first (a short night: the "no" days of
 *  "Slept 7+ hours"). */
type DaysWith = (id: string, yes: boolean) => (boolean | undefined)[][];
const BAR_WEEKS = 8;
/** The days of an answer over the last weeks, from these answers. */
export const makeDaysWith = (entries: TrackerEntry[]): DaysWith => (trackerId, yes) => {
  const byDate = new Map(entries.filter((e) => e.trackerId === trackerId).map((e) => [e.date, e.value]));
  return Array.from({ length: BAR_WEEKS }, (_, w) => Array.from({ length: 7 }, (_, i) => {
    const v = byDate.get(daysAgoIso((BAR_WEEKS - 1 - w) * 7 + 6 - i));
    return typeof v === "boolean" ? v === yes : undefined;
  }));
};
/** The link between these two questions as Links shows it (the same day, or the next day), if it is shown there. */
export const findLink = (trackers: Tracker[], entries: TrackerEntry[], a: string, b: string, nextDay: boolean): CorrelationResult | null =>
  computeCorrelations(trackers.filter((x) => !x.archived && x.source !== "play"), entries, LINKS_TOP).filter(linkWorthShowing)
    .find((c) => ((c.trackerA.id === a && c.trackerB.id === b) || (c.trackerA.id === b && c.trackerB.id === a)) && (c.lag !== 0) === nextDay) ?? null;

export const FindingsView = ({
  trackers,
  entries,
  onSeeDays,
  focusIds,
}: {
  trackers: Tracker[];
  entries: TrackerEntry[];
  onSeeDays: () => void;
  /** Map island: only pairs that include one of these questions (the other side can be anywhere). */
  focusIds?: string[];
}) => {
  const { t } = useTranslation();
  // People who came in through a door care about that question first, so
  // pairs that include it lead; otherwise the engine's own order stands.
  const { findings, pairs } = useMemo(() => {
    const every = computeCorrelations(trackers.filter((x) => !x.archived && x.source !== "play"), entries, LINKS_TOP).filter(linkWorthShowing);
    const all = focusIds ? every.filter((c) => focusIds.includes(c.trackerA.id) || focusIds.includes(c.trackerB.id)) : every;
    return { findings: rankLinks(all), pairs: new Set(every.map(pairOf)) };
  }, [trackers, entries, focusIds]);
  // the new kinds of findings, on the whole list only (her pick, Nov 11 2026; findingForms.ts): a chain and "two
  // things next to it" on top, "looks like it's something else" at the end
  // an answer to "What comes first?" re-tells the links in the person's order (linkOrder.ts)
  const [orderV, setOrderV] = useState(0);
  useEffect(() => { const on = () => setOrderV((v) => v + 1); window.addEventListener(LINK_ORDER_EVENT, on); return () => window.removeEventListener(LINK_ORDER_EVENT, on); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const routes = useMemo(() => findings.map(routeOf), [findings, orderV]);
  const isleDays = useMemo(() => Object.fromEntries(islandDays(trackers, entries)) as Record<string, number>, [trackers, entries]);
  const tracked = useMemo(() => trackedTemplates(trackers), [trackers]);
  const chain = useMemo(() => (focusIds ? null : chainOf(routes)), [routes, focusIds]);
  // links about the same thing sit on one card (Nov 13 2026, her note on the long "two things" sentences: «что это
  // за сочинения внизу?»): the strongest is the card's sentence, the others are short rows under it, "Also with it".
  // Grouped by what the sentence is about (the second answer), strongest first; the order of groups is the links' own.
  const groups = useMemo(() => {
    const m = new Map<string, CorrelationResult[]>();
    findings.forEach((c, i) => { const r = routes[i]; const k = `${r.second}|${r.secondYes}`; const g = m.get(k); if (g) g.push(c); else m.set(k, [c]); });
    return [...m.values()];
  }, [findings, routes]);
  const notIt = useMemo(() => (focusIds ? [] : notItFindings(trackers, entries, (id) => { const f = findTemplate(id); return !!f && !f.template.quiet && !f.template.sensitive && !f.template.askOnly; }, pairs)), [trackers, entries, pairs, focusIds]);
  const [allShown, setAllShown] = useState(false);
  // cards one by one, or the list (remembered)
  const [view] = useState<"deck" | "list">(() => { try { return localStorage.getItem("memap_links_view") === "deck" ? "deck" : "list"; } catch { return "list"; } });
  // the first card is open from the start, so the screen opens on a whole finding (not in the checks' plain list)
  const openFirst = useMemo(() => { try { return localStorage.getItem("memap_links_view") !== "list"; } catch { return true; } }, []);
  const deckRef = useRef<HTMLDivElement>(null);
  const [deckAt, setDeckAt] = useState(0);
  const onDeckScroll = () => { const el = deckRef.current; const first = el?.firstElementChild as HTMLElement | null; if (!el || !first) return; setDeckAt(Math.round(el.scrollLeft / (first.offsetWidth + 12))); };

  // Same "value moment" bookkeeping the old Links tab did: feeds the
  // rating prompt and the correlation_viewed funnel step.
  useEffect(() => {
    if (findings.length > 0) {
      markCorrelationSeen();
      track("correlation_viewed", { count: findings.length });
    }
  }, [findings.length]);

  const of = trackerLookup(trackers);

  if (findings.length === 0) {
    // answered evenings, the same count as the push and the week-2 chip (persona walk, Nov 9 2026)
    const daysWithAnswers = countedDays(trackers, entries).length;
    const past = daysWithAnswers >= LINKS_AT;
    const door = getDoorState();
    const doorDef = door ? getDoor(door.id) : undefined;
    const fact = door && trackers.some((tr) => tr.id === door.trackerId) ? strongestContextFact(door, trackers, entries) : null;
    const counts = door && doorDef ? doorCounts(door, entries) : null;
    return (
      <div className="space-y-3 animate-fade-in">
        <div className="rounded-[22px] border border-foreground/[0.12] bg-foreground/[0.07] p-[18px]">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{t("patterns.findEmptyLabel")}</p>
          <p className="mt-2.5 text-[21px] font-bold leading-tight tracking-tight">{t("patterns.findEmptyTitle")}</p>
          <p className="mt-2 text-[15px] leading-snug text-muted-foreground">
            {past ? t("path.next4.linksWait") : t("patterns.findEmptyBody", { count: LINKS_AT })}
          </p>
          {!past && <>
          <div className="mt-4 flex gap-1" aria-hidden="true">
            {Array.from({ length: LINKS_AT }, (_, i) => (
              <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < daysWithAnswers ? "bg-primary" : "bg-foreground/15")} />
            ))}
          </div>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {t("patterns.findEmptyProgress", { count: daysWithAnswers, total: LINKS_AT })}
          </p>
          </>}
        </div>
        {/* what a link will look like, marked as an example (her note, Nov 10 2026) */}
        <ExampleLink />
        {fact && counts && (
          <div className="rounded-[22px] border border-foreground/[0.12] bg-foreground/[0.07] p-[18px]">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("doors.echo.soFar")}</p>
            {/* with its subject, as the week report says it (new-user walk, Nov 14 2026: "4 of 4 came on a stressful day.") */}
            <p className="mt-2 text-[17px] leading-snug">{factLine(t, fact, doorDef ? t(`doors.${doorDef.id}.name`) : undefined)}</p>
            <p className="mt-2 text-[13px] text-emerging">{t("doors.echo.early")}</p>
          </div>
        )}
      </div>
    );
  }

  // eight cards, the rest under "More links" (every link worth showing is kept, her topics first); a card holds every
  // link about its thing
  const SHOWN = 8;
  // the strongest one first and large; then a chain, then the rest
  const shown = allShown ? groups : groups.slice(0, SHOWN);
  const card = (g: CorrelationResult[], hero: boolean, deck = false) => (
    <GroupCard key={`${routeOf(g[0]).second}-${routeOf(g[0]).secondYes}`} links={g} hero={hero} of={of} entries={entries} tracked={tracked} deck={deck} open={hero && openFirst} />
  );
  // one finding on the screen, the next one peeks in, swipe sideways (her idea, Nov 13 2026: «может, это будут как
  // карточки, которые можно перелистывать? или список давать как опцию»); the list stays one tap away
  if (view === "deck") {
    const items: React.ReactNode[] = [
      ...groups.map((g, i) => card(g, i === 0, true)),
      ...(chain ? [<StoryCard key="chain" kind="chain" text={chainText(t, chain[0], chain[1], of)} details={[linkCount(t, chain[0]), linkCount(t, chain[1])]} />] : []),
      ...notIt.map((x) => <NotItCard key={`notit-${x.outcome.id}`} x={x} />),
    ];
    return (
      <div className="animate-fade-in">
        <p data-deck-head className="mb-2 text-[14px] font-semibold text-muted-foreground">{t("link.deckHead", { count: items.length })}</p>
        <div ref={deckRef} data-links-deck onScroll={onDeckScroll} className="-mx-4 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto px-4 pb-3 scrollbar-hide">
          {items.map((x, i) => <div key={i} data-deck-item className={cn("shrink-0 snap-center", items.length > 1 ? "w-[88%]" : "w-full")}>{x}</div>)}
        </div>
        {items.length > 1 && (
          <div data-deck-pager className="mt-1 flex justify-center gap-1.5" aria-hidden="true">
            {items.map((_, i) => <span key={i} className={cn("h-2 rounded-full transition-all", i === deckAt ? "w-5 bg-[hsl(var(--coin-teal))]" : "w-2 bg-foreground/15")} />)}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-2.5 animate-fade-in">
      {shown.slice(0, 1).map((g) => card(g, true))}
      {chain && <StoryCard kind="chain" text={chainText(t, chain[0], chain[1], of)} details={[linkCount(t, chain[0]), linkCount(t, chain[1])]} />}
      {shown.slice(1).map((g) => card(g, false))}
      {!allShown && groups.length > SHOWN && (
        <button type="button" data-more-links onClick={() => setAllShown(true)} className="w-full rounded-[18px] py-3 text-[16px] font-bold text-[hsl(var(--coin-teal))]">
          {t("patterns.findAlso")} ({groups.length - SHOWN})
        </button>
      )}
      {notIt.map((x) => <NotItCard key={`notit-${x.outcome.id}`} x={x} />)}
    </div>
  );
};

/** A finding told in words; its numbers open on tap (her note, Nov 11 2026: «сначала более простую формулировку
 *  без цифр, а цифры только если нужно поподробнее»). */
const StoryCard = ({ kind, text, details, children }: { kind: string; text: string; details: string[]; children?: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <div data-story={kind} className="surface rounded-[22px]">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-2 px-[18px] pb-3 pt-4 text-left">
        <span className="min-w-0 flex-1 text-[17px] font-bold leading-snug tracking-tight">{text}</span>
        <ChevronDown className={cn("mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} strokeWidth={2.4} />
      </button>
      {open && (
        <div data-story-numbers className="space-y-1 px-[18px] pb-4 animate-fade-in">
          {details.map((d, i) => <p key={i} className="text-[15px] font-semibold text-muted-foreground">{d}</p>)}
          {children}
        </div>
      )}
    </div>
  );
};

/** "Looks like it's something else": a hard thing came as often with a likely cause as without it; the numbers and
 *  what else to watch open on tap (findingForms.notItFindings). */
const NotItCard = ({ x }: { x: NotIt }) => {
  const { t } = useTranslation();
  const result = answerClause(t, x.outcome, x.outcomeHardYes, "result");
  const without = answerClause(t, x.cause, !x.causeHardYes, "cause"), withIt = answerClause(t, x.cause, x.causeHardYes, "cause");
  const head = t("link.notItHead");
  const line = cap(t("link.notItLine", { result, without }));
  const body = cap(t("link.notItBody", { result, without, with: withIt, k1: x.k1, n1: x.n1, k2: x.k2, n2: x.n2 }));
  return (
    <StoryCard kind="notit" text={`${head}. ${line}`} details={[body]}>
      {x.watch.length > 0 && (
        <div className="pt-2">
          <p className="text-[14px] font-bold text-foreground">{t("link.notItWatch")}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {x.watch.map((id) => { const f = findTemplate(id); return f ? (
              <button key={id} type="button" data-watch={id} onClick={async () => { track("notit_watch_added"); await ensureTemplates([id]); }}
                className="rounded-full bg-[hsl(var(--coin-teal)/0.12)] px-3 py-1.5 text-[14px] font-bold text-foreground">+ {templateQuestion(f.template)}</button>
            ) : null; })}
          </div>
        </div>
      )}
    </StoryCard>
  );
};

/** The link whose "See the days" was tapped: open again, in view, when the chart goes back to the list (her note,
 *  Nov 10 2026: "когда перешла по ссылке посмотреть график, то обратно уже не смогла выйти на эту связь"). */
let reopen: string | null = null;
export const reopenLink = (ids: string[]) => { reopen = ids.join("|"); };

/** A tag: one answer in its own short words, tinted by what it means (hard rose, good green, neutral indigo). */
const tintOf = (tr: Tracker | undefined, v: boolean) =>
  !tr || isNeutralQuestion(tr) || isTestQuestion(tr) ? "hsl(var(--data-a) / 0.16)" : isHardAnswer(tr, v) ? "hsl(var(--strong) / 0.16)" : "hsl(var(--balanced) / 0.24)";
const Tag = ({ tr, yes }: { tr: Tracker | undefined; yes: boolean }) => {
  const { t } = useTranslation();
  return (
    <span data-tag className="flex h-full min-h-[44px] w-full items-center justify-center rounded-[12px] px-2.5 py-2 text-center text-[15px] font-bold leading-tight text-foreground" style={{ background: tintOf(tr, yes) }}>
      {/* "2 pm" never splits ("Coffee after 2 / pm") */}
      {cap(answerPhrase(t, tr, yes)).replace(/(\d) (pm|am)\b/gi, "$1\u00a0$2")}
    </span>
  );
};
/** One grid for every card (her note, Nov 12 2026: the same room left and right, like a consulting slide): two equal
 *  columns over the card's full width and a 64px middle for the link sign, "next day" or "or". */
const COLS = "grid grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)]";
/** The card's open/close arrow; it sits in a row of its own text so nothing pushes the grid off centre. */
const Chev = ({ open, className }: { open: boolean; className?: string }) => (
  <ChevronDown aria-hidden="true" className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180", className)} strokeWidth={2.4} />
);
/** The two tags of a link in the grid's two columns, a link sign between, or "next day" when it keeps its order
 *  ("Coffee after 2 pm · next day · Short night"). */
const Tags = ({ r, of }: { r: Route; of: TrackerOf }) => {
  const { t } = useTranslation();
  return (
    <span data-tags className={cn(COLS, "items-stretch")}>
      <Tag tr={of(r.first)} yes={r.firstYes} />
      <span className="flex items-center justify-center px-1">
        {r.nextDay
          ? <ArrowRight data-next-day aria-label={t("link.nextDayTag")} className="h-5 w-5 text-[hsl(var(--coin-teal))]" strokeWidth={2.6} />
          : <Link2 aria-hidden="true" className="h-4 w-4 text-[hsl(var(--coin-teal))]" strokeWidth={2.4} />}
      </span>
      <Tag tr={of(r.second)} yes={r.secondYes} />
    </span>
  );
};
/** An island as on the globe, at its stage (day and night pictures). */
const IslePic = ({ id, days }: { id: IslandId; days: number }) => {
  const name = artOf(id, days);
  return (
    <span aria-hidden="true" data-isle-pic className="flex h-[80px] w-[100px] max-w-full items-end justify-center">
      <img className="art-day block max-h-full max-w-full object-contain object-bottom" src={art(name, false)} alt="" />
      <img className="art-night block max-h-full max-w-full object-contain object-bottom" src={art(name, true)} alt="" />
    </span>
  );
};
/** The strongest link: its two islands with the route and the link sign between, each answer under its island (the
 *  store's screen 5; the App Store session's note 1, her yes Nov 12 2026). One island when both live on it. */
const Isles = ({ r, of, isleDays }: { r: Route; of: TrackerOf; isleDays: Record<string, number> }) => {
  const { t } = useTranslation();
  const a = of(r.first), b = of(r.second);
  if (!a || !b) return <Tags r={r} of={of} />;
  const ia = islandOf(a), ib = islandOf(b);
  if (ia === ib) return (
    <span className="flex flex-col items-center gap-2 pt-1">
      <IslePic id={ia} days={isleDays[ia] ?? 0} />
      <Tags r={r} of={of} />
    </span>
  );
  return (
    <span data-isles className={cn(COLS, "grid-rows-[80px_auto] items-stretch gap-y-2")}>
      <span className="flex min-w-0 justify-center"><IslePic id={ia} days={isleDays[ia] ?? 0} /></span>
      <span className="flex flex-col items-center justify-center pt-5 text-[hsl(var(--coin-teal))]" aria-hidden="true">
        <span className="flex items-center gap-1"><span className="w-2 border-t-2 border-dotted border-current opacity-60" /><span className="grid h-8 w-8 place-items-center rounded-full bg-white shadow-[0_2px_8px_rgba(16,42,56,0.16)]"><Link2 className="h-4 w-4" strokeWidth={2.4} /></span><span className="w-2 border-t-2 border-dotted border-current opacity-60" /></span>
      </span>
      <span className="flex min-w-0 justify-center"><IslePic id={ib} days={isleDays[ib] ?? 0} /></span>
      <span className="col-start-1 min-w-0"><Tag tr={a} yes={r.firstYes} /></span>
      <span className="col-start-2 flex items-center justify-center px-1">{r.nextDay && <ArrowRight data-next-day aria-label={t("link.nextDayTag")} className="h-5 w-5 text-[hsl(var(--coin-teal))]" strokeWidth={2.6} />}</span>
      <span className="col-start-3 min-w-0"><Tag tr={b} yes={r.secondYes} /></span>
    </span>
  );
};

/** Every link about one thing on one card (Nov 13 2026): the strongest is told as the card's sentence, the others are
 *  rows under it ("Also with it"); tapping a row makes that link the card's sentence, with its own chart, days,
 *  "What comes first?" and "What to try". Nothing is lost: each link keeps everything it had on a card of its own. */
const GroupCard = ({ links, hero, of, entries, tracked, deck, open }: { links: CorrelationResult[]; hero: boolean; of: TrackerOf; entries: TrackerEntry[]; tracked: Set<string>; deck?: boolean; open?: boolean }) => {
  const [focus, setFocus] = useState(0);
  const [picked, setPicked] = useState(false);
  const at = Math.min(focus, links.length - 1), c = links[at];
  const also = links.map((x, i) => ({ r: routeOf(x), onPick: () => { setFocus(i); setPicked(true); } })).filter((_, i) => i !== at);
  return <LinkCard key={pairOf(c)} c={c} hero={hero} of={of} entries={entries} tracked={tracked} also={also} startOpen={picked || deck || open} deck={deck} />;
};
/** One link (her pick on the prototype, Nov 12 2026): one sentence with its two answers lit in the pair's colours and
 *  how many times under it. Opening the card shows, on the same card, the week chart with the day bars under it, the
 *  other days, and on the same day "What comes first?", which says after an answer what it took and how the link
 *  reads now. No plates, no islands: the globe has those. */
export const LinkCard = ({ c, hero, of, entries, tracked, startOpen, kicker, also = [], deck }: {
  c: CorrelationResult; hero: boolean; of: TrackerOf; entries: TrackerEntry[]; tracked: Set<string>;
  /** in the deck: always open, no arrow */ deck?: boolean;
  /** the other links about the same thing: rows under this one; a tap makes that link the card's own */ also?: { r: Route; onPick: () => void }[];
  /** open from the start (the globe's link sheet) */ startOpen?: boolean;
  /** the small line over the strongest ("Strongest so far"); the globe's sheet says "A link" */ kicker?: string;
}) => {
  const { t } = useTranslation();
  const r = routeOf(c);
  const again = useRef(reopen === [r.first, r.second].join("|"));
  const [open, setOpen] = useState(again.current || !!startOpen);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!again.current) return; reopen = null; box.current?.scrollIntoView({ block: "center" }); }, []);
  const solid = c.stage === "emerging" || c.stage === "stable";
  const a = of(r.first), b = of(r.second);
  const segs = linkHeadSegs(t, r, of);
  const sentence = segs.map((x) => x.text).join("");
  const said = useRef(sentence);
  const [lit, setLit] = useState(false);
  useEffect(() => {
    if (said.current === sentence) return;
    said.current = sentence; setLit(true);
    const id = window.setTimeout(() => setLit(false), 1600);
    return () => window.clearTimeout(id);
  }, [sentence]);
  const { k, n } = linkNumbers(r);
  const other = linkOtherDays(t, r);
  // the second voice (agreed Nov 13, built Nov 14 2026): what the person said in "Why?" about one of the two things
  // (fights, headaches, migraines), the same block as on the page of one thing; shown beside the link from three
  // answers, never counted into it (reasons exist only on the "yes" days)
  const words = useMemo(() => {
    for (const x of [b, a]) {
      if (!x || !reasonTemplate(x)) continue;
      const tl = reasonTally(x, entries);
      if (tl.said >= REASON_LINE_FROM && tl.top) return { id: reasonTemplate(x) as string, top: tl.top, k: tl.k, said: tl.said };
    }
    return null;
  }, [a, b, entries]);
  const [at, setAt] = useState<number | null>(null);
  // The opened card goes in short steps with Next, not one long sheet to scroll (her note, Nov 14 2026: «слишком
  // длинное полотно… давай всё-таки делать next: вопрос, сообщение, дальше to try»): what was found, then
  // "What comes first?" (same-day links only), then what to try. A card with a try running opens on its last step.
  const asksOrder = c.lag === 0 && solid;
  const steps: ("found" | "order" | "try")[] = ["found", ...(asksOrder ? ["order" as const] : []), ...(c.lag !== 0 || solid ? ["try" as const] : [])];
  const [, orderSaid] = useState(0);
  useEffect(() => { const on = () => orderSaid((v) => v + 1); window.addEventListener(LINK_ORDER_EVENT, on); return () => window.removeEventListener(LINK_ORDER_EVENT, on); }, []);
  const orderKnown = !asksOrder || (!!a && !!b && !!getLinkOrder(a.id, b.id));
  const [stepAt, setStepAt] = useState(() => (again.current && a && b && tryOfLink(a.id, b.id) ? steps.length - 1 : 0));
  const step = steps[Math.min(stepAt, steps.length - 1)];
  const go = (d: number) => { haptics.tap(); setStepAt((v) => Math.max(0, Math.min(steps.length - 1, v + d))); window.setTimeout(() => box.current?.scrollIntoView({ block: "nearest" }), 60); };
  const canNext = stepAt < steps.length - 1 && (step !== "order" || orderKnown);
  // the two lines and their days, in the colours of the lit words
  const series: Series[] = a && b ? [
    { color: PAIR_A, values: weekly(a, entries, 8, r.firstYes), days: dayMarks(a, entries, 8, r.firstYes), label: cap(answerPhrase(t, a, r.firstYes)) },
    { color: PAIR_B, values: weekly(b, entries, 8, r.secondYes), days: dayMarks(b, entries, 8, r.secondYes), label: cap(answerPhrase(t, b, r.secondYes)) },
  ] : [];
  return (
    <div ref={box} data-link-card data-together={r.together ? "1" : undefined} className="surface rounded-[22px]">
      <button type="button" aria-expanded={open} onClick={() => { if (!deck) setOpen((o) => !o); }} className="block w-full px-[18px] pb-3.5 pt-4 text-left">
        {hero && (
          <span className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-[hsl(var(--coin-teal))]">{kicker ?? t("patterns.findStrongest")}</span>
            {!deck && <Chev open={open} />}
          </span>
        )}
        <span className="flex items-start gap-2">
          <span data-link-sentence className={cn("-mx-1.5 min-w-0 flex-1 rounded-lg px-1.5 py-0.5 font-bold leading-snug tracking-tight transition-colors duration-700",
            hero ? "text-[19px]" : "text-[16.5px]", lit && "bg-[hsl(var(--coin-teal)/0.16)]")}><Said segs={segs} /></span>
          {!hero && !deck && <Chev open={open} className="mt-1" />}
        </span>
        <span data-link-times className="mt-1.5 block text-[14px] font-semibold text-muted-foreground">{cap(linkTimes(t, k, n))}{!open && also.length > 0 && <span data-link-also-count>{" · "}{t("link.alsoMore", { count: also.length })}</span>}</span>
      </button>
      {open && (
        <div className="px-[18px] pb-4 animate-fade-in">
          {/* typed questions without short words: name them, right under the sentence */}
          {step === "found" && (<>
          <OwnWordsPrompt trackers={[a, b]} />
          {/* the week chart and every day under it, on the card (her note: «на раскрытии… как раньше выглядел график
              и палочки») */}
          {series.length === 2 && (
            <div data-link-chart-inline className="mt-1">
              <p className="text-[12.5px] font-medium text-muted-foreground">{t("charts.daysAWeekShort")}</p>
              <Chart series={series} height={150} big at={at} onAt={setAt} />
            </div>
          )}
          {other && <p data-link-other className="mt-3 text-[15px] font-semibold leading-snug">{cap(other)}</p>}
          {words && (
            <div data-link-words className="mt-3 border-t-[1.5px] border-dotted border-foreground/15 pt-3">
              <p className="text-[13px] font-semibold text-muted-foreground">{t("thing.inWords")}{" · "}{t(`why.many.${words.id}`)}</p>
              <p className="text-[16.5px] font-bold leading-snug">{cap(reasonLabel(t, words.top))}</p>
              <p className="mt-0.5 text-[14px] font-semibold text-muted-foreground">{t("thing.wordsCount", { k: words.k, n: words.said })}</p>
            </div>
          )}
          </>)}
          {/* the same day can't tell which came first: the person's guess orders it (her idea, Nov 12 2026); here on
              the card, and after an answer it says how the link reads now */}
          {step === "order" && <OrderAsk r={r} of={of} tracked={tracked} readsNow={<Said segs={segs} />} />}
          {/* the link's next step, once its order is known: what to try (her note, Nov 13 2026: a link was a dead end) */}
          {step === "try" && <LinkTry r={r} of={of} />}
          {steps.length > 1 && (
            <div data-link-steps={step} className="mt-4 flex items-center gap-3">
              {stepAt > 0 && <button type="button" data-link-back onClick={() => go(-1)} className="h-12 px-2 text-[16px] font-bold text-muted-foreground">{t("common.back")}</button>}
              <span className="flex flex-1 items-center justify-center gap-1.5" aria-hidden="true">
                {steps.map((x, i) => <i key={x} className={cn("h-2 rounded-full transition-all", i === stepAt ? "w-5 bg-[hsl(var(--coin-teal))]" : "w-2 bg-foreground/15")} />)}
              </span>
              {canNext && <button type="button" data-link-next onClick={() => go(1)} className="raised-btn h-12 px-7">{t("common.next")}</button>}
            </div>
          )}
              {/* below Next, so the first step's button shows without scrolling (Nov 14 2026) */}
          {/* the other links about the same thing, as short rows; a tap tells that one in full on this card */}
          {step === "found" && also.length > 0 && (
            <div data-link-also className="mt-4">
              <p className="text-[13px] font-bold text-[hsl(var(--coin-teal))]">{t("link.alsoHead")}</p>
              <div className="mt-1.5 space-y-1.5">
                {also.map((x) => { const n2 = linkNumbers(x.r); return (
                  <button key={`${x.r.first}-${x.r.firstYes}`} type="button" data-also-row onClick={x.onPick}
                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl bg-foreground/[0.05] px-4 py-2 text-left active:scale-[0.99]">
                    <span className="min-w-0 flex-1 text-[15.5px] font-bold leading-snug">{cap(answerPhrase(t, of(x.r.first), x.r.firstYes))}{x.r.nextDay && <span className="font-semibold text-muted-foreground">{" · "}{t("link.nextDayTag")}</span>}</span>
                    <span className="shrink-0 text-[13.5px] font-semibold tabular-nums text-muted-foreground">{linkTimes(t, n2.k, n2.n)}</span>
                  </button>
                ); })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
