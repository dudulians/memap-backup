// "Findings" (1.8.0): the first thing Patterns shows. Same engine as the
// old Links tab (computeCorrelations), but one plain sentence per pair,
// two strips of the last 14 days so you can see it, and "Holds up · 6 of
// 8" instead of phi, co-occurrences and stage badges. Canvas "MeMap:
// новая версия", page 6, "Как надо: паттерны начинаются с находки".
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { computeCorrelations, CorrelationResult } from "@/lib/correlations";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import { markCorrelationSeen } from "@/lib/appRating";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { daysAgoIso, doorCounts, getDoor, getDoorState, strongestContextFact } from "@/lib/doors";
import { factLine } from "@/lib/echo";

const STRIP_DAYS = 14;
const FIRST_FINDINGS_AT = 14;

// "Holds up · K of N": for a "more often" pair, K = days B followed A out
// of the N days with A; for a "less often" pair, K = days B did NOT come.
const holdCount = (c: CorrelationResult) => {
  const n = c.counts.bothYes + c.counts.aYesBNo;
  const k = c.phi > 0 ? c.counts.bothYes : c.counts.aYesBNo;
  return { k, n };
};

const sentenceKey = (c: CorrelationResult): string => {
  const more = c.phi > 0;
  if (c.lag === 1) return more ? "patterns.findAfter" : "patterns.findAfterLess";
  if (c.lag === -1) return more ? "patterns.findBefore" : "patterns.findBeforeLess";
  return more ? "patterns.findSameDay" : "patterns.findSameDayLess";
};

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
}: {
  trackers: Tracker[];
  entries: TrackerEntry[];
  onSeeDays: () => void;
}) => {
  const { t } = useTranslation();
  // People who came in through a door care about that question first, so
  // pairs that include it lead; otherwise the engine's own order stands.
  const findings = useMemo(() => {
    const all = computeCorrelations(trackers, entries, 5);
    const doorId = getDoorState()?.trackerId;
    if (!doorId) return all;
    const hasDoor = (c: CorrelationResult) => c.trackerA.id === doorId || c.trackerB.id === doorId;
    return [...all.filter(hasDoor), ...all.filter((c) => !hasDoor(c))];
  }, [trackers, entries]);

  // Same "value moment" bookkeeping the old Links tab did: feeds the
  // rating prompt and the correlation_viewed funnel step.
  useEffect(() => {
    if (findings.length > 0) {
      markCorrelationSeen();
      track("correlation_viewed", { count: findings.length });
    }
  }, [findings.length]);

  const sentence = (c: CorrelationResult) =>
    t(sentenceKey(c), {
      a: localizeTrackerTitle(c.trackerA.title),
      b: localizeTrackerTitle(c.trackerB.title),
    });

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
  const { k, n } = holdCount(top);
  const solid = top.stage === "emerging" || top.stage === "stable";
  const yesOn = (trackerId: string) => {
    const byDate = new Map(entries.filter((e) => e.trackerId === trackerId).map((e) => [e.date, e.value]));
    return Array.from({ length: STRIP_DAYS }, (_, i) => byDate.get(daysAgoIso(STRIP_DAYS - 1 - i)));
  };

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="rounded-[22px] border border-foreground/[0.12] bg-foreground/[0.07] p-[18px]">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{t("patterns.findStrongest")}</p>
        <p className="mt-2.5 text-[22px] font-bold leading-[1.2] tracking-tight">{sentence(top)}</p>
        <div className="mt-3.5 space-y-2.5">
          <Strip label={localizeTrackerTitle(top.trackerA.title)} days={yesOn(top.trackerA.id)} tone="a" />
          <Strip label={localizeTrackerTitle(top.trackerB.title)} days={yesOn(top.trackerB.id)} tone="b" />
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
            {rest.map((c, i) => {
              const h = holdCount(c);
              return (
                <div key={i} className="flex gap-3 items-start px-4 py-3.5">
                  <span className="text-primary font-bold" aria-hidden="true">→</span>
                  <p className="text-[15px] leading-snug">
                    {sentence(c)} <span className="text-muted-foreground whitespace-nowrap">{t("patterns.findKofN", { k: h.k, n: h.n })}</span>
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}

      <p className="px-1 pt-1 text-xs leading-snug text-muted-foreground">{t("patterns.findDisclaimer")}</p>
    </div>
  );
};
