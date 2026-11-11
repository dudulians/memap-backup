// "Findings" (1.8.0): the first thing Patterns shows. Same engine as the
// old Links tab (computeCorrelations), but one plain sentence per pair,
// two strips of the last 14 days so you can see it, and "Holds up · 6 of
// 8" instead of phi, co-occurrences and stage badges. Canvas "MeMap:
// новая версия", page 6, "Как надо: паттерны начинаются с находки".
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { computeCorrelations, CorrelationResult } from "@/lib/correlations";
import { isHardAnswer, isNeutralQuestion, isTestQuestion, linkOf, linkWorthShowing, LINKS_TOP, rankLinks, type Route } from "@/lib/islands";
import { ChevronDown } from "lucide-react";
import { chainText, linkCount, linkHead, linkNumbers, trackerLookup, twoThingsLine, twoThingsText } from "@/lib/linkText";
import { answerClause } from "@/lib/answerPhrases";
import { chainOf, notItFindings, pairOf, twoThingsOf, type NotIt } from "@/lib/findingForms";
import { ensureTemplates, findTemplate } from "@/lib/doors";
import { templateQuestion } from "@/lib/cardText";
import { answerPhrase, cap } from "@/lib/answerPhrases";
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
  const routes = useMemo(() => findings.map(routeOf), [findings]);
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
  const sentence = (c: CorrelationResult) => linkHead(t, routeOf(c), of);

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
  return (
    <div className="space-y-2.5 animate-fade-in">
      {chain && <StoryCard kind="chain" text={chainText(t, chain[0], chain[1], of)} details={[linkCount(t, chain[0]), linkCount(t, chain[1])]} />}
      {twos.map((g) => <StoryCard key={`two-${g[0].second}-${g[0].secondYes}`} kind="two" text={twoThingsText(t, g, of)} details={g.map((l) => twoThingsLine(t, l, of))} />)}
      {(allShown ? findings : findings.slice(0, SHOWN)).map((c, i) => (
        <LinkCard key={`${c.trackerA.id}-${c.trackerB.id}`} c={c} first={i === 0} sentence={sentence(c)} of={of} daysWith={daysWith} onSeeDays={onSeeDays} />
      ))}
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

/** One link: its sentence and the other days; a tap opens its last 14 days as dots (her note, Nov 8
 *  2026: "есть «ещё», там не клацается"). The strongest one is open from the start. */
const LinkCard = ({ c, first, sentence, of, daysWith, onSeeDays }: {
  c: CorrelationResult; first: boolean; sentence: string; of: ReturnType<typeof trackerLookup>;
  daysWith: (id: string, yes: boolean) => (boolean | undefined)[]; onSeeDays: () => void;
}) => {
  const { t } = useTranslation();
  const r = routeOf(c);
  const again = useRef(reopen === [r.first, r.second].join("|"));
  // words first: its numbers and days open on tap (her note, Nov 11 2026)
  const [open, setOpen] = useState(again.current);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!again.current) return; reopen = null; box.current?.scrollIntoView({ block: "center" }); }, []);
  const solid = c.stage === "emerging" || c.stage === "stable";
  const a = of(r.first), b = of(r.second);
  return (
    <div ref={box} data-link-card className="surface rounded-[22px]">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-2 px-[18px] pb-3 pt-4 text-left">
        <span className="min-w-0 flex-1">
          {first && <span className="mb-1.5 block text-[12px] font-extrabold uppercase tracking-[0.12em] text-[hsl(var(--coin-teal))]">{t("patterns.findStrongest")}</span>}
          <span className={cn("block font-bold leading-snug tracking-tight", first ? "text-[21px]" : "text-[17px]")}>{sentence}</span>
        </span>
        <ChevronDown className={cn("mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} strokeWidth={2.4} />
      </button>
      {open && (
        <div className="px-[18px] pb-4 animate-fade-in">
          <p data-link-count className="mb-3 text-[15px] font-semibold text-muted-foreground">{linkCount(t, r)}</p>
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
