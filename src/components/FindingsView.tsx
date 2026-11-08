// "Findings" (1.8.0): the first thing Patterns shows. Same engine as the
// old Links tab (computeCorrelations), but one plain sentence per pair,
// two strips of the last 14 days so you can see it, and "Holds up · 6 of
// 8" instead of phi, co-occurrences and stage badges. Canvas "MeMap:
// новая версия", page 6, "Как надо: паттерны начинаются с находки".
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { computeCorrelations, CorrelationResult } from "@/lib/correlations";
import { isHardAnswer, isNeutralQuestion, isTestQuestion, linkOf, linkWorthShowing, type Route } from "@/lib/islands";
import { ChevronDown } from "lucide-react";
import { linkOther, linkSentence, trackerLookup } from "@/lib/linkText";
import { answerPhrase, cap } from "@/lib/answerPhrases";
import { markCorrelationSeen } from "@/lib/appRating";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { daysAgoIso, doorCounts, getDoor, getDoorState, strongestContextFact } from "@/lib/doors";
import { factLine } from "@/lib/echo";

const STRIP_DAYS = 14;
const FIRST_FINDINGS_AT = 14;

// A finding is a link told in its real answers (linkOf; her note, Nov 6 2026: the old
// «В дни с «Приступ мигрени» реже было «Спал(а) достаточно (7+ часов)»» "выглядит
// жутко"): "Short night → migraine the same day — 4 of 5 times", the other days beside it.
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
  const findings = useMemo(() => {
    const every = computeCorrelations(trackers.filter((x) => !x.archived && x.source !== "play"), entries, 12).filter(linkWorthShowing);
    const all = focusIds ? every.filter((c) => focusIds.includes(c.trackerA.id) || focusIds.includes(c.trackerB.id)) : every;
    const doorId = getDoorState()?.trackerId;
    if (!doorId) return all;
    const hasDoor = (c: CorrelationResult) => c.trackerA.id === doorId || c.trackerB.id === doorId;
    return [...all.filter(hasDoor), ...all.filter((c) => !hasDoor(c))];
  }, [trackers, entries, focusIds]);

  // Same "value moment" bookkeeping the old Links tab did: feeds the
  // rating prompt and the correlation_viewed funnel step.
  useEffect(() => {
    if (findings.length > 0) {
      markCorrelationSeen();
      track("correlation_viewed", { count: findings.length });
    }
  }, [findings.length]);

  const of = trackerLookup(trackers);
  const sentence = (c: CorrelationResult) => linkSentence(t, routeOf(c), of);

  if (findings.length === 0) {
    const daysWithAnswers = new Set(entries.map((e) => e.date)).size;
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
            {t("patterns.findEmptyBody", { count: FIRST_FINDINGS_AT })}
          </p>
          <div className="mt-4 flex gap-1" aria-hidden="true">
            {Array.from({ length: FIRST_FINDINGS_AT }, (_, i) => (
              <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < daysWithAnswers ? "bg-primary" : "bg-foreground/15")} />
            ))}
          </div>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {t("patterns.findEmptyProgress", { count: Math.min(daysWithAnswers, FIRST_FINDINGS_AT), total: FIRST_FINDINGS_AT })}
          </p>
        </div>
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

  return (
    <div className="space-y-2.5 animate-fade-in">
      {findings.map((c, i) => (
        <LinkCard key={`${c.trackerA.id}-${c.trackerB.id}`} c={c} first={i === 0} sentence={sentence(c)} of={of} daysWith={daysWith} onSeeDays={onSeeDays} />
      ))}
    </div>
  );
};

/** One link: its sentence and the other days; a tap opens its last 14 days as dots (her note, Nov 8
 *  2026: "есть «ещё», там не клацается"). The strongest one is open from the start. */
const LinkCard = ({ c, first, sentence, of, daysWith, onSeeDays }: {
  c: CorrelationResult; first: boolean; sentence: string; of: ReturnType<typeof trackerLookup>;
  daysWith: (id: string, yes: boolean) => (boolean | undefined)[]; onSeeDays: () => void;
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(first);
  const r = routeOf(c);
  const solid = c.stage === "emerging" || c.stage === "stable";
  const a = of(r.first), b = of(r.second);
  return (
    <div className="surface rounded-[22px]">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-2 px-[18px] pb-3 pt-4 text-left">
        <span className="min-w-0 flex-1">
          {first && <span className="mb-1.5 block text-[12px] font-extrabold uppercase tracking-[0.12em] text-[hsl(var(--coin-teal))]">{t("patterns.findStrongest")}</span>}
          <span className={cn("block font-bold leading-snug tracking-tight", first ? "text-[21px]" : "text-[17px]")}>{sentence}</span>
          <span className="mt-1 block text-[15px] font-semibold text-muted-foreground">{linkOther(t, r)}</span>
        </span>
        <ChevronDown className={cn("mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} strokeWidth={2.4} />
      </button>
      {open && (
        <div className="px-[18px] pb-4 animate-fade-in">
          <div className="space-y-3">
            <Strip label={cap(answerPhrase(t, a, r.firstYes))} days={daysWith(r.first, r.firstYes)} color={toneOf(a, r.firstYes)} />
            <Strip label={cap(answerPhrase(t, b, r.secondYes))} days={daysWith(r.second, r.secondYes)} color={toneOf(b, r.secondYes)} />
          </div>
          <div className="mt-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <span className={cn("inline-flex h-7 items-center rounded-full px-3 text-[13px] font-semibold", solid ? "bg-balanced/25 text-balanced-foreground" : "bg-emerging/20 text-emerging-foreground")}>
              {t(solid ? "patterns.findHolds" : "patterns.findEarly", { k: r.k, n: r.n })}
            </span>
            <span className="text-[13px] font-medium text-muted-foreground">{t("patterns.findDays", { count: c.sharedDays })}</span>
          </div>
          <button type="button" onClick={onSeeDays} className="mt-3 text-[15px] font-bold text-[hsl(var(--coin-teal))]">{t("patterns.findSeeDays")}</button>
        </div>
      )}
    </div>
  );
};
