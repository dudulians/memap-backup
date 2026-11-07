// "Findings" (1.8.0): the first thing Patterns shows. Same engine as the
// old Links tab (computeCorrelations), but one plain sentence per pair,
// two strips of the last 14 days so you can see it, and "Holds up · 6 of
// 8" instead of phi, co-occurrences and stage badges. Canvas "MeMap:
// новая версия", page 6, "Как надо: паттерны начинаются с находки".
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { computeCorrelations, CorrelationResult } from "@/lib/correlations";
import { linkOf, linkWorthShowing, type Route } from "@/lib/islands";
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

const Strip = ({ label, days, tone }: { label: string; days: (boolean | undefined)[]; tone: "a" | "b" }) => (
  <div>
    <p className="mb-1.5 text-xs font-semibold text-muted-foreground truncate">{label}</p>
    <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-[3px]" aria-hidden="true">
      {days.map((v, i) => (
        <span
          key={i}
          className={cn(
            "aspect-square rounded-[5px]",
            // Neutral colours: either question can be the good or the bad one.
            v === true ? (tone === "a" ? "bg-primary" : "bg-foreground/75") : "bg-foreground/[0.08]",
          )}
        />
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
    const all = focusIds
      ? computeCorrelations(trackers, entries, 15).filter(linkWorthShowing).filter((c) => focusIds.includes(c.trackerA.id) || focusIds.includes(c.trackerB.id)).slice(0, 5)
      : computeCorrelations(trackers, entries, 12).filter(linkWorthShowing).slice(0, 5);
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

  const [top, ...rest] = findings;
  const r = routeOf(top);
  const { k, n } = r;
  const solid = top.stage === "emerging" || top.stage === "stable";
  /** the days with that answer (a short night: the "no" days of "Slept 7+ hours") */
  const daysWith = (trackerId: string, yes: boolean) => {
    const byDate = new Map(entries.filter((e) => e.trackerId === trackerId).map((e) => [e.date, e.value]));
    return Array.from({ length: STRIP_DAYS }, (_, i) => { const v = byDate.get(daysAgoIso(STRIP_DAYS - 1 - i)); return typeof v === "boolean" ? v === yes : undefined; });
  };

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="rounded-[22px] border border-foreground/[0.12] bg-foreground/[0.07] p-[18px]">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{t("patterns.findStrongest")}</p>
        <p className="mt-2.5 text-[22px] font-bold leading-[1.2] tracking-tight">{sentence(top)}</p>
        <p className="mt-1 text-[15px] font-semibold text-muted-foreground">{linkOther(t, r)}</p>
        <div className="mt-3.5 space-y-2.5">
          <Strip label={cap(answerPhrase(t, of(r.first), r.firstYes))} days={daysWith(r.first, r.firstYes)} tone="a" />
          <Strip label={cap(answerPhrase(t, of(r.second), r.secondYes))} days={daysWith(r.second, r.secondYes)} tone="b" />
        </div>
        <div className="mt-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <span
            className={cn(
              "inline-flex items-center h-7 px-3 rounded-full text-[13px] font-semibold",
              solid ? "bg-balanced/25 text-balanced" : "bg-emerging/20 text-emerging",
            )}
          >
            {t(solid ? "patterns.findHolds" : "patterns.findEarly", { k, n })}
          </span>
          <span className="text-[13px] text-muted-foreground">{t("patterns.findDays", { count: top.sharedDays })}</span>
        </div>
        <button type="button" onClick={onSeeDays} className="mt-3 text-sm font-semibold text-primary">
          {t("patterns.findSeeDays")}
        </button>
      </div>

      {rest.length > 0 && (
        <>
          <p className="pt-2 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("patterns.findAlso")}</p>
          <div className="rounded-[22px] border border-foreground/[0.12] bg-foreground/[0.07] divide-y divide-foreground/[0.08]">
            {rest.map((c, i) => (
              <div key={i} className="px-4 py-3.5">
                <p className="text-[15px] leading-snug">{sentence(c)}</p>
              </div>
            ))}
          </div>
        </>
      )}

    </div>
  );
};
