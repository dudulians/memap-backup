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
import { chainText, linkCalmLine, linkCount, linkHead, linkWhen, trackerLookup, twoThingsLine, twoThingsText, type TrackerOf } from "@/lib/linkText";
import { art, artOf } from "@/lib/globeArt";
import { LINK_ORDER_EVENT } from "@/lib/linkOrder";
import { islandDays } from "@/lib/growth";
import { answerClause } from "@/lib/answerPhrases";
import { chainOf, notItFindings, pairOf, twoThingsOf, type NotIt } from "@/lib/findingForms";
import { ensureTemplates, findTemplate } from "@/lib/doors";
import { templateQuestion } from "@/lib/cardText";
import { answerPhrase, cap, templateIdOf } from "@/lib/answerPhrases";
import { markCorrelationSeen } from "@/lib/appRating";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { daysAgoIso, doorCounts, getDoor, getDoorState, strongestContextFact } from "@/lib/doors";
import { factLine } from "@/lib/echo";
import { LINKS_AT, countedDays } from "@/lib/pathSteps";
import { ExampleLink } from "./Examples";
import { OwnWordsPrompt } from "./AnswerWordsFields";
import { DayRows as DayRowsList, LinkIsles, LinkNumbers, OrderAsk, trackedTemplates, type DayRow } from "./LinkParts";

const STRIP_DAYS = 14;

// A finding is a link told in its real answers (linkOf; her note, Nov 6 2026: the old
// «В дни с «Приступ мигрени» реже было «Спал(а) достаточно (7+ часов)»» "выглядит
// жутко"): "Short night → migraine the next day", and under it "4 of 5 times · on other days 3 of 24".
const routeOf = (c: CorrelationResult): Route => { const l = linkOf(c); return { ...l, a: "other", b: "other", first: l.first.id, second: l.second.id }; };

/** A day is a dot, coloured by what the answer means (the one look, Nov 6 2026). */
const toneOf = (tr: Tracker | undefined, v: boolean) =>
  !tr || isNeutralQuestion(tr) || isTestQuestion(tr) ? "hsl(var(--data-a))" : isHardAnswer(tr, v) ? "hsl(var(--strong))" : "hsl(var(--balanced))";
/** Short words for this answer: a library question, or a typed one she named short. Plates only then (her pick, Nov 12
 *  2026: «плашки для коротких»); a typed question as typed reads as a sentence. */
const short = (tr: Tracker | undefined, yes: boolean) => !!tr && (!!templateIdOf(tr) || !!(yes ? tr.words?.yes : tr.words?.no));
/** The days with that answer over the last two weeks (a short night: the "no" days of "Slept 7+ hours"). */
type DaysWith = (id: string, yes: boolean) => (boolean | undefined)[];

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
  const twos = useMemo(() => (focusIds ? [] : twoThingsOf(routes)), [routes, focusIds]);
  const notIt = useMemo(() => (focusIds ? [] : notItFindings(trackers, entries, (id) => { const f = findTemplate(id); return !!f && !f.template.quiet && !f.template.sensitive && !f.template.askOnly; }, pairs)), [trackers, entries, pairs, focusIds]);
  const [allShown, setAllShown] = useState(false);

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
            <p className="mt-2 text-[17px] leading-snug">{factLine(t, fact)}</p>
            <p className="mt-2 text-[13px] text-emerging">{t("doors.echo.early")}</p>
          </div>
        )}
      </div>
    );
  }

  const daysWith: DaysWith = (trackerId, yes) => {
    const byDate = new Map(entries.filter((e) => e.trackerId === trackerId).map((e) => [e.date, e.value]));
    return Array.from({ length: STRIP_DAYS }, (_, i) => { const v = byDate.get(daysAgoIso(STRIP_DAYS - 1 - i)); return typeof v === "boolean" ? v === yes : undefined; });
  };

  // eight links, the rest under "More links" (every link worth showing is kept, her topics first)
  const SHOWN = 8;
  // the strongest one first and large, with its islands (the store's screen 5, her yes Nov 12 2026); then a chain and
  // "two things", then the rest as two tags each
  const shown = allShown ? findings : findings.slice(0, SHOWN);
  const card = (c: CorrelationResult, hero: boolean) => (
    <LinkCard key={`${c.trackerA.id}-${c.trackerB.id}`} c={c} hero={hero} of={of} daysWith={daysWith} isleDays={isleDays} tracked={tracked} />
  );
  return (
    <div className="space-y-2.5 animate-fade-in">
      {shown.slice(0, 1).map((c) => card(c, true))}
      {chain && <StoryCard kind="chain" text={chainText(t, chain[0], chain[1], of)} details={[linkCount(t, chain[0]), linkCount(t, chain[1])]} />}
      {twos.map((g) => <TwoCard key={`two-${g[0].second}-${g[0].secondYes}`} g={g} of={of} daysWith={daysWith} />)}
      {shown.slice(1).map((c) => card(c, false))}
      {!allShown && findings.length > SHOWN && (
        <button type="button" data-more-links onClick={() => setAllShown(true)} className="w-full rounded-[18px] py-3 text-[16px] font-bold text-[hsl(var(--coin-teal))]">
          {t("patterns.findAlso")} ({findings.length - SHOWN})
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

/** "Two things next to it": the answer, "Most often the same days as", the things, as plates when all have short words,
 *  else its sentence (her pick, Nov 12 2026); on tap the sentence, each one's numbers and their last 14 days in rows. */
const TwoCard = ({ g, of, daysWith }: { g: Route[]; of: TrackerOf; daysWith: DaysWith }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const l = g[0];
  const plates = short(of(l.second), l.secondYes) && g.every((x) => short(of(x.first), x.firstYes));
  const res = of(l.second);
  const rows: DayRow[] = [
    { label: cap(answerPhrase(t, res, l.secondYes)), days: daysWith(l.second, l.secondYes), color: toneOf(res, l.secondYes), main: true },
    ...g.map((x) => ({ label: cap(answerPhrase(t, of(x.first), x.firstYes)), days: daysWith(x.first, x.firstYes), color: toneOf(of(x.first), x.firstYes) })),
  ];
  return (
    <div data-story="two" className="surface rounded-[22px]">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="block w-full px-[18px] pb-3.5 pt-4 text-left">
        {plates ? (
          <>
            <span className={cn(COLS, "items-center")}><Tag tr={res} yes={l.secondYes} /><span /><span className="flex justify-end"><Chev open={open} /></span></span>
            <span className="mt-2.5 block text-[14px] font-bold text-muted-foreground">{t(l.nextDay ? "link.twoTagsNext" : "link.twoTagsSame")}</span>
            <span className={cn(COLS, "mt-2 items-stretch gap-y-2")}>
              {g.flatMap((x, i) => [
                ...(i % 2 === 1 ? [<span key={`or-${x.first}`} className="flex items-center justify-center text-[13px] font-bold text-muted-foreground">{t("link.or")}</span>] : []),
                <Tag key={x.first} tr={of(x.first)} yes={x.firstYes} />,
              ])}
            </span>
          </>
        ) : (
          <span className="flex items-start gap-2">
            <span data-link-sentence className="min-w-0 flex-1 text-[17px] font-bold leading-snug tracking-tight">{twoThingsText(t, g, of)}</span>
            <Chev open={open} className="mt-1" />
          </span>
        )}
      </button>
      {open && (
        <div data-story-numbers className="px-[18px] pb-4 animate-fade-in">
          {plates && <p data-link-sentence className="pb-1.5 text-[16px] font-semibold leading-snug text-foreground">{twoThingsText(t, g, of)}</p>}
          <div className="space-y-1">{g.map((x) => <p key={x.first} className="text-[15px] font-semibold text-muted-foreground">{twoThingsLine(t, x, of)}</p>)}</div>
          <DayRowsTwo rows={rows} />
        </div>
      )}
    </div>
  );
};
/** The last 14 days of "two things", one row under another. */
const DayRowsTwo = ({ rows }: { rows: DayRow[] }) => {
  const { t } = useTranslation();
  return (
    <div className="mt-3">
      <p className="text-[13px] font-bold uppercase tracking-[0.04em] text-muted-foreground">{t("link.lastDays", { count: STRIP_DAYS })}</p>
      <DayRowsList rows={rows} />
    </div>
  );
};

/** One link. Short answers (her pick, Nov 12 2026): two plates and when ("Mostly the same days"), the strongest large
 *  with its islands, a plate under each, and the calm other days in words. A typed question without short words: the
 *  sentence (the strongest with its islands and their names). A tap opens the sentence, the count large with a small
 *  "Chart", the two answers' last 14 days in rows, the other days, and on the same day "What comes first?". */
const LinkCard = ({ c, hero, of, daysWith, isleDays, tracked }: {
  c: CorrelationResult; hero: boolean; of: TrackerOf; daysWith: DaysWith; isleDays: Record<string, number>; tracked: Set<string>;
}) => {
  const { t } = useTranslation();
  const r = routeOf(c);
  const again = useRef(reopen === [r.first, r.second].join("|"));
  const [open, setOpen] = useState(again.current);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!again.current) return; reopen = null; box.current?.scrollIntoView({ block: "center" }); }, []);
  const solid = c.stage === "emerging" || c.stage === "stable";
  const a = of(r.first), b = of(r.second);
  const plates = short(a, r.firstYes) && short(b, r.secondYes);
  const calm = hero && plates ? linkCalmLine(t, r) : "";
  // the same day in the person's own order (they answered "What comes first?"): said on the closed card too
  const mine = !r.nextDay && !r.together && a ? t("link.orderMine", { what: answerPhrase(t, a, r.firstYes) }) : "";
  const sentence = linkHead(t, r, of);
  const said = useRef(sentence);
  const [lit, setLit] = useState(false);
  useEffect(() => {
    if (said.current === sentence) return;
    said.current = sentence; setLit(true);
    const id = window.setTimeout(() => setLit(false), 1600);
    return () => window.clearTimeout(id);
  }, [sentence]);
  const rows: DayRow[] = [
    { label: cap(answerPhrase(t, a, r.firstYes)), days: daysWith(r.first, r.firstYes), color: toneOf(a, r.firstYes) },
    { label: cap(answerPhrase(t, b, r.secondYes)), days: daysWith(r.second, r.secondYes), color: toneOf(b, r.secondYes) },
  ];
  const sentenceEl = (big: boolean) => (
    <span data-link-sentence className={cn("-mx-1.5 block rounded-lg px-1.5 py-0.5 leading-snug transition-colors duration-700", big ? "font-bold tracking-tight" : "font-semibold", lit && "bg-[hsl(var(--coin-teal)/0.16)]",
      big ? (hero ? "mt-3 text-[20px]" : "text-[17px]") : "text-[16px]")}>{sentence}</span>
  );
  return (
    <div ref={box} data-link-card data-together={r.together ? "1" : undefined} className="surface rounded-[22px]">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="block w-full px-[18px] pb-3.5 pt-4 text-left">
        <span className="block">
          {hero && (
            <span className="mb-2.5 flex items-center justify-between gap-2">
              <span className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-[hsl(var(--coin-teal))]">{t("patterns.findStrongest")}</span>
              <Chev open={open} />
            </span>
          )}
          {plates ? (
            <>
              {hero ? <Isles r={r} of={of} isleDays={isleDays} /> : <Tags r={r} of={of} />}
              <span className={cn("flex items-center justify-between gap-2", hero ? "mt-3" : "mt-2.5")}>
                <span data-link-when className={cn("font-bold", hero ? "text-[21px] leading-tight tracking-tight" : "text-[14px] text-muted-foreground")}>{r.nextDay ? t("link.whenNextDay", { often: linkWhen(t, r) }) : linkWhen(t, r)}</span>
                {!hero && <Chev open={open} />}
              </span>
            </>
          ) : hero ? (
            <>
              {a && b && <LinkIsles r={{ a: islandOf(a), b: islandOf(b) }} days={isleDays} />}
              {sentenceEl(true)}
            </>
          ) : (
            <span className="flex items-start gap-2"><span className="min-w-0 flex-1">{sentenceEl(true)}</span><Chev open={open} className="mt-1" /></span>
          )}
          {mine && <span data-link-mine className="mt-1 block text-[13.5px] font-bold text-[hsl(var(--coin-teal))]">{mine}</span>}
          {calm && (
            <span data-link-calm className="mt-1.5 flex items-center gap-2 text-[16px] font-bold text-muted-foreground">
              <img src={mapPic("sun")} alt="" aria-hidden="true" className="h-6 w-6" />{calm}
            </span>
          )}
        </span>
      </button>
      {open && (
        <div className="px-[18px] pb-4 animate-fade-in">
          {plates && <div className="mb-2">{sentenceEl(false)}</div>}
          {/* typed questions without short words: name them, right under the sentence */}
          <OwnWordsPrompt trackers={[a, b]} />
          <div className="mt-2"><LinkNumbers r={r} rows={rows} onChart={() => window.dispatchEvent(new CustomEvent("memap-link-days", { detail: [r.first, r.second] }))} /></div>
          {/* the same day can't tell which came first: the person's guess orders it (her idea, Nov 12 2026) */}
          {c.lag === 0 && solid && <OrderAsk r={r} of={of} tracked={tracked} />}
        </div>
      )}
    </div>
  );
};
