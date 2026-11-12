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
import { Check, ChevronDown, Link2, Plus } from "lucide-react";
import { chainText, linkCalmLine, linkCount, linkHead, linkNumbers, linkWhen, trackerLookup, twoThingsLine, twoThingsText, type TrackerOf } from "@/lib/linkText";
import { getLinkOrder, LINK_ORDER_EVENT, setLinkOrder } from "@/lib/linkOrder";
import { art, artOf } from "@/lib/globeArt";
import { islandDays } from "@/lib/growth";
import { RELATED_QUESTIONS } from "@/lib/relatedQuestions";
import { haptics } from "@/lib/haptics";
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
import { needsWords, OwnWordsPrompt } from "./AnswerWordsFields";

const STRIP_DAYS = 14;

// A finding is a link told in its real answers (linkOf; her note, Nov 6 2026: the old
// «В дни с «Приступ мигрени» реже было «Спал(а) достаточно (7+ часов)»» "выглядит
// жутко"): "Short night → migraine the next day", and under it "4 of 5 times · on other days 3 of 24".
const routeOf = (c: CorrelationResult): Route => { const l = linkOf(c); return { ...l, a: "other", b: "other", first: l.first.id, second: l.second.id }; };

/** A day is a dot, coloured by what the answer means (the one look, Nov 6 2026; her note Nov 8:
 *  "новые цвета и фигуры" — the teal and grey squares are gone). */
const toneOf = (tr: Tracker | undefined, v: boolean) =>
  !tr || isNeutralQuestion(tr) || isTestQuestion(tr) ? "hsl(var(--data-a))" : isHardAnswer(tr, v) ? "hsl(var(--strong))" : "hsl(var(--balanced))";
const Strip = ({ label, days, color }: { label: string; days: (boolean | undefined)[]; color: string }) => (
  <div>
    <p className="mb-1.5 truncate text-[14px] font-semibold text-muted-foreground">{label}</p>
    <div className="flex items-center justify-between" aria-hidden="true">
      {days.map((v, i) => (
        <span key={i} className="h-3.5 w-3.5 rounded-full" style={{ background: v === true ? color : v === false ? "hsl(var(--foreground) / 0.12)" : "hsl(var(--foreground) / 0.05)" }} />
      ))}
    </div>
  </div>
);

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
  const tracked = useMemo(() => new Set(trackers.filter((x) => !x.archived).map((x) => templateIdOf(x)).filter((x): x is string => !!x)), [trackers]);
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

  /** the days with that answer (a short night: the "no" days of "Slept 7+ hours") */
  const daysWith = (trackerId: string, yes: boolean) => {
    const byDate = new Map(entries.filter((e) => e.trackerId === trackerId).map((e) => [e.date, e.value]));
    return Array.from({ length: STRIP_DAYS }, (_, i) => { const v = byDate.get(daysAgoIso(STRIP_DAYS - 1 - i)); return typeof v === "boolean" ? v === yes : undefined; });
  };

  // eight links, the rest under "More links" (every link worth showing is kept, her topics first)
  const SHOWN = 8;
  // the strongest one first and large, with its islands (the store's screen 5, her yes Nov 12 2026); then a chain and
  // "two things", then the rest as two tags each
  const shown = allShown ? findings : findings.slice(0, SHOWN);
  const card = (c: CorrelationResult, hero: boolean) => (
    <LinkCard key={`${c.trackerA.id}-${c.trackerB.id}`} c={c} hero={hero} of={of} daysWith={daysWith} isleDays={isleDays} tracked={tracked} onSeeDays={onSeeDays} />
  );
  return (
    <div className="space-y-2.5 animate-fade-in">
      {shown.slice(0, 1).map((c) => card(c, true))}
      {chain && <StoryCard kind="chain" text={chainText(t, chain[0], chain[1], of)} details={[linkCount(t, chain[0]), linkCount(t, chain[1])]} />}
      {twos.map((g) => <TwoCard key={`two-${g[0].second}-${g[0].secondYes}`} g={g} of={of} />)}
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
const Tag = ({ tr, yes, big, fill }: { tr: Tracker | undefined; yes: boolean; big?: boolean; fill?: boolean }) => {
  const { t } = useTranslation();
  return (
    <span data-tag className={cn("rounded-[12px] font-bold leading-tight text-foreground", fill ? "flex h-full w-full items-center justify-center text-center" : "inline-block", big ? "px-2 py-2 text-[15px]" : "px-[11px] py-1.5 text-[16px]")} style={{ background: tintOf(tr, yes) }}>
      {cap(answerPhrase(t, tr, yes))}
    </span>
  );
};
/** The two tags of a link; the next day keeps its order ("Coffee after 2 pm · next day · Short night"). */
const Tags = ({ r, of }: { r: Route; of: TrackerOf }) => {
  const { t } = useTranslation();
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Tag tr={of(r.first)} yes={r.firstYes} />
      {r.nextDay && <span className="text-[14px] font-bold text-muted-foreground">{t("link.nextDayTag")}</span>}
      <Tag tr={of(r.second)} yes={r.secondYes} />
    </span>
  );
};
/** An island as on the globe, at its stage (day and night pictures). */
const IslePic = ({ id, days }: { id: IslandId; days: number }) => {
  const name = artOf(id, days);
  return (
    <span aria-hidden="true" data-isle-pic className="flex h-[88px] w-[104px] max-w-full items-end justify-center">
      <img className="art-day block max-h-full w-full object-contain object-bottom" src={art(name, false)} alt="" />
      <img className="art-night block max-h-full w-full object-contain object-bottom" src={art(name, true)} alt="" />
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
    <span data-isles className="-mx-1 grid grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)] grid-rows-[88px_auto] gap-x-1 gap-y-2 pt-1">
      <span className="flex min-w-0 justify-center"><IslePic id={ia} days={isleDays[ia] ?? 0} /></span>
      <span className="flex flex-col items-center justify-center pt-6 text-[hsl(var(--coin-teal))]" aria-hidden="true">
        <span className="flex items-center gap-1"><span className="w-2 border-t-2 border-dotted border-current opacity-60" /><span className="grid h-8 w-8 place-items-center rounded-full bg-white shadow-[0_2px_8px_rgba(16,42,56,0.16)]"><Link2 className="h-4 w-4" strokeWidth={2.4} /></span><span className="w-2 border-t-2 border-dotted border-current opacity-60" /></span>
        {r.nextDay && <span data-next-day className="mt-1 text-center text-[12px] font-bold leading-tight text-muted-foreground">{t("link.nextDayTag")}</span>}
      </span>
      <span className="flex min-w-0 justify-center"><IslePic id={ib} days={isleDays[ib] ?? 0} /></span>
      <span className="col-start-1 min-w-0"><Tag tr={a} yes={r.firstYes} big fill /></span>
      <span className="col-start-3 min-w-0"><Tag tr={b} yes={r.secondYes} big fill /></span>
    </span>
  );
};

/** More likely causes of both, not asked yet (for "Not sure"): first those both questions' lists name. */
const watchFor = (a: Tracker, b: Tracker, tracked: Set<string>): string[] => {
  const ta = templateIdOf(a), tb = templateIdOf(b);
  const la = (ta && RELATED_QUESTIONS[ta]) || [], lb = (tb && RELATED_QUESTIONS[tb]) || [];
  const ok = (id: string) => { if (tracked.has(id) || id === ta || id === tb) return false; const f = findTemplate(id); return !!f && !f.template.quiet && !f.template.sensitive && !f.template.askOnly; };
  const both = la.filter((id) => lb.includes(id) && ok(id));
  return [...new Set([...both, ...la.filter(ok), ...lb.filter(ok)])].slice(0, 2);
};
/** "What comes first, do you think?" (her idea, Nov 12 2026): the person's answer orders the link (linkOrder.ts);
 *  "Not sure" offers what else may bring both. */
const OrderAsk = ({ r, of, tracked }: { r: Route; of: TrackerOf; tracked: Set<string> }) => {
  const { t } = useTranslation();
  const a = of(r.first), b = of(r.second);
  const [chosen, setChosen] = useState(() => (a && b ? getLinkOrder(a.id, b.id) : null));
  const [editing, setEditing] = useState(false);
  const [watchKept, setWatchKept] = useState<string[]>([]);
  const [added, setAdded] = useState<string[]>([]);
  if (!a || !b) return null;
  const pick = (v: string, choice: "first" | "second" | "unsure") => { haptics.tap(); setChosen(v); setEditing(false); setLinkOrder(a.id, b.id, v); track("link_order_answered", { choice }); };
  const firstOf = (id: string) => (id === a.id ? answerPhrase(t, a, r.firstYes) : answerPhrase(t, b, r.secondYes));
  // the app's picked row (one look kit): a teal ring and a tick, never a tinted ground (her note, Nov 12 2026: the
  // first version, small grey chips under the dots, "я вообще не увидела этот вопрос")
  const row = (on: boolean) => cn("flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left text-[16px] outline-none active:scale-[0.99]", on ? "surface pick-on font-bold" : "bg-foreground/[0.05] font-semibold");
  const tick = (on: boolean) => <span aria-hidden="true" className={cn("tick", on && "is-on")}>{on && <Check className="h-4 w-4" strokeWidth={3} />}</span>;
  // the list stays as it was when "Not sure" was picked: an added question keeps its row, ticked
  const watch = chosen === "unsure" ? [...new Set([...watchKept, ...watchFor(a, b, tracked)])].slice(0, Math.max(2, watchKept.length)) : [];
  const addWatch = async (id: string) => {
    if (added.includes(id)) return;
    haptics.success();
    setWatchKept((k) => (k.includes(id) ? k : [...k, ...watch.filter((x) => !k.includes(x))]));
    setAdded((x) => [...x, id]);
    track("notit_watch_added");
    await ensureTemplates([id]);
  };
  const watchList = watch.length > 0 && (
    <div data-watch-list className="mt-4">
      <p className="text-[16px] font-bold leading-snug">{t("link.orderWatch")}</p>
      <div className="mt-2 space-y-2">
        {watch.map((id) => { const f = findTemplate(id); if (!f) return null; const on = added.includes(id); return (
          <button key={id} type="button" data-watch={id} aria-pressed={on} onClick={() => void addWatch(id)} className={row(on)}>
            <span className="min-w-0 flex-1">{templateQuestion(f.template)}</span>
            {on ? tick(true) : <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[hsl(var(--coin-teal))] text-white"><Plus className="h-4 w-4" strokeWidth={3} /></span>}
          </button>
        ); })}
      </div>
      {added.length > 0 && <p data-watch-added className="mt-2 text-[14px] font-semibold text-muted-foreground">{t("tipDay.added")}</p>}
    </div>
  );
  // answered: one picked row says what was chosen and what it did; "Change" opens the three rows again
  if (chosen && !editing) return (
    <div data-order-ask data-order-done className="mt-3 mb-1">
      <div className="surface pick-on flex min-h-12 items-center gap-3 rounded-2xl px-4 py-2.5">
        <span aria-hidden="true" className="tick is-on"><Check className="h-4 w-4" strokeWidth={3} /></span>
        <span data-order-mine className="min-w-0 flex-1 text-[16px] font-bold leading-snug">{chosen === "unsure" ? t("link.orderMineUnsure") : t("link.orderMine", { what: firstOf(chosen) })}</span>
        <button type="button" data-order-change onClick={() => { haptics.tap(); setEditing(true); }} className="shrink-0 text-[15px] font-bold text-[hsl(var(--coin-teal))]">{t("link.orderChange")}</button>
      </div>
      {chosen !== "unsure" && <p className="mt-1.5 text-[14px] font-semibold text-muted-foreground">{t("link.orderEffect")}</p>}
      {watchList}
    </div>
  );
  return (
    <div data-order-ask className="mt-4 mb-1">
      <p className="text-[19px] font-extrabold leading-snug tracking-tight">{t("link.orderAsk")}</p>
      <div className="mt-2.5 space-y-2">
        <button type="button" data-order="first" aria-pressed={chosen === a.id} onClick={() => pick(a.id, "first")} className={row(chosen === a.id)}><span className="min-w-0 flex-1">{cap(t("link.orderFirst", { what: answerPhrase(t, a, r.firstYes) }))}</span>{tick(chosen === a.id)}</button>
        <button type="button" data-order="second" aria-pressed={chosen === b.id} onClick={() => pick(b.id, "second")} className={row(chosen === b.id)}><span className="min-w-0 flex-1">{cap(t("link.orderFirst", { what: answerPhrase(t, b, r.secondYes) }))}</span>{tick(chosen === b.id)}</button>
        <button type="button" data-order="unsure" aria-pressed={chosen === "unsure"} onClick={() => pick("unsure", "unsure")} className={row(chosen === "unsure")}><span className="min-w-0 flex-1">{t("link.orderUnsure")}</span>{tick(chosen === "unsure")}</button>
      </div>
    </div>
  );
};

/** "Two things next to it" as tags: the answer, "Most often the same days as", the things (her note, Nov 12 2026:
 *  "сплошняком много текста"); the sentence and each one's numbers open on tap. */
const TwoCard = ({ g, of }: { g: Route[]; of: TrackerOf }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const l = g[0];
  return (
    <div data-story="two" className="surface rounded-[22px]">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-2 px-[18px] pb-3.5 pt-4 text-left">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap gap-1.5"><Tag tr={of(l.second)} yes={l.secondYes} /></span>
          <span className="mt-2 block text-[14px] font-bold text-muted-foreground">{t(l.nextDay ? "link.twoTagsNext" : "link.twoTagsSame")}</span>
          <span className="mt-2 flex flex-wrap gap-1.5">{g.map((x) => <Tag key={x.first} tr={of(x.first)} yes={x.firstYes} />)}</span>
        </span>
        <ChevronDown className={cn("mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} strokeWidth={2.4} />
      </button>
      {open && (
        <div data-story-numbers className="space-y-1 px-[18px] pb-4 animate-fade-in">
          <p data-link-sentence className="pb-1 text-[16px] font-semibold leading-snug text-foreground">{twoThingsText(t, g, of)}</p>
          {g.map((x) => <p key={x.first} className="text-[15px] font-semibold text-muted-foreground">{twoThingsLine(t, x, of)}</p>)}
        </div>
      )}
    </div>
  );
};

/** One link: two tags and when ("Mostly the same days"); the strongest one large with its islands and the calm
 *  other days in words. A tap opens the sentence, its last 14 days as dots, the numbers and, on the same day, "What
 *  comes first?" (her picks, Nov 12 2026: «пока плохо выглядит… сплошняком много текста», «Вариант 2 красиво… можно
 *  провалиться и в точки, и в это объясняющее предложение»). */
const LinkCard = ({ c, hero, of, daysWith, isleDays, tracked }: {
  c: CorrelationResult; hero: boolean; of: TrackerOf;
  daysWith: (id: string, yes: boolean) => (boolean | undefined)[]; isleDays: Record<string, number>; tracked: Set<string>; onSeeDays: () => void;
}) => {
  const { t } = useTranslation();
  const r = routeOf(c);
  const again = useRef(reopen === [r.first, r.second].join("|"));
  // words first: its sentence, numbers and days open on tap (her note, Nov 11 2026)
  const [open, setOpen] = useState(again.current);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!again.current) return; reopen = null; box.current?.scrollIntoView({ block: "center" }); }, []);
  const solid = c.stage === "emerging" || c.stage === "stable";
  const a = of(r.first), b = of(r.second);
  const calm = hero ? linkCalmLine(t, r) : "";
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
  return (
    <div ref={box} data-link-card data-together={r.together ? "1" : undefined} className="surface rounded-[22px]">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-2 px-[18px] pb-3.5 pt-4 text-left">
        <span className="min-w-0 flex-1">
          {hero && <span className="mb-2 block text-[12px] font-extrabold uppercase tracking-[0.12em] text-[hsl(var(--coin-teal))]">{t("patterns.findStrongest")}</span>}
          {hero ? <Isles r={r} of={of} isleDays={isleDays} /> : <Tags r={r} of={of} />}
          <span data-link-when className={cn("block font-bold", hero ? "mt-3 text-[21px] leading-tight tracking-tight" : "mt-2 text-[14px] text-muted-foreground")}>{linkWhen(t, r)}</span>
          {mine && <span data-link-mine className="mt-1 block text-[13.5px] font-bold text-[hsl(var(--coin-teal))]">{mine}</span>}
          {calm && (
            <span data-link-calm className="mt-1.5 flex items-center gap-2 text-[16px] font-bold text-muted-foreground">
              <img src={mapPic("sun")} alt="" aria-hidden="true" className="h-6 w-6" />{calm}
            </span>
          )}
        </span>
        <ChevronDown className={cn("mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} strokeWidth={2.4} />
      </button>
      {open && (
        <div className="px-[18px] pb-4 animate-fade-in">
          <p data-link-sentence className={cn("-mx-1.5 mb-1.5 rounded-lg px-1.5 py-0.5 text-[16px] font-semibold leading-snug transition-colors duration-700", lit && "bg-[hsl(var(--coin-teal)/0.16)]")}>{sentence}</p>
          {/* the same day can't tell which came first: the person's guess orders it (her idea, Nov 12 2026), right under
              the sentence it changes */}
          {c.lag === 0 && solid && <OrderAsk r={r} of={of} tracked={tracked} />}
          <p data-link-count className="mb-3 mt-3 text-[15px] font-semibold text-muted-foreground">{linkCount(t, r)}</p>
          <div className="space-y-3">
            <Strip label={cap(answerPhrase(t, a, r.firstYes))} days={daysWith(r.first, r.firstYes)} color={toneOf(a, r.firstYes)} />
            <Strip label={cap(answerPhrase(t, b, r.secondYes))} days={daysWith(r.second, r.secondYes)} color={toneOf(b, r.secondYes)} />
          </div>
          <div className="mt-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <span className={cn("inline-flex h-7 items-center rounded-full px-3 text-[13px] font-semibold", /* the text colour of the theme over a soft tint: readable at night too (QA, Nov 8 2026) */ solid ? "bg-balanced/25 text-foreground" : "bg-emerging/20 text-foreground")}>
              {t(solid ? "patterns.findHolds" : "patterns.findEarly", linkNumbers(r))}
            </span>
            <span className="text-[13px] font-medium text-muted-foreground">{t("patterns.findDays", { count: c.sharedDays })}</span>
          </div>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("memap-link-days", { detail: [r.first, r.second] }))} className="mt-3 text-[15px] font-bold text-[hsl(var(--coin-teal))]">{t("patterns.findSeeDays")}</button>
          {/* her own question without words: say it her way (Nov 11 2026) */}
          {[a, b].filter(needsWords).slice(0, 1).map((tr) => <OwnWordsPrompt key={tr.id} tracker={tr} />)}
        </div>
      )}
    </div>
  );
};
