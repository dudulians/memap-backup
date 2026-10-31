// "Findings": the first thing Patterns shows. Same engine as the old
// Links tab (computeCorrelations), one plain sentence per pair.
// Sticker Diary (1.9): before there is anything to say, it is never an
// empty "nothing yet" box. Up to 7 evenings: how far the first report
// is plus a labelled example of what a finding looks like. From 7
// evenings: the first week report (counts per topic as a sticker strip,
// the strongest "what came before"), until the engine has a real link.
import { useEffect, useMemo } from "react";
import { Explainer } from "./mw/Infographics";
import { moodOf } from "./mw/DayMark";
import { useTranslation } from "react-i18next";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { computeCorrelations, CorrelationResult } from "@/lib/correlations";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import { markCorrelationSeen } from "@/lib/appRating";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { DoorId, daysAgoIso, getDoorState, strongestContextFact } from "@/lib/doors";
import { factLine } from "@/lib/echo";
import { FINDINGS_AFTER, isHit, lastDates } from "@/lib/weekMap";
import { Malu } from "./mw/Malu";
import { PencilCurl, TopicIcon, TopicKind, tapeVar, topicKind } from "./mw/TopicIcon";
import { tilt } from "./mw/WeekMap";
import { eveningDates, RECALL_KEY } from "./mw/TodayTop";

const STRIP_DAYS = 14;

// "Seen K times out of N": for a "more often" pair, K = days B followed
// A out of the N days with A; for a "less often" pair, K = days B did
// NOT come.
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

/** A row of notebook squares: a sticker for "yes", a curl for "no",
 *  green / pink for good / bad (see DayMark). */
const Strip = ({
  label,
  kind,
  hits,
  problemWhen = "yes",
}: {
  label: string;
  kind: TopicKind;
  hits: (boolean | undefined)[];
  problemWhen?: "yes" | "no";
}) => (
  <div>
    <span
      className="mw-tape inline-flex items-center gap-1.5 pl-2 pr-3 py-0.5 text-[16px] font-semibold max-w-full"
      style={{ ["--tape" as string]: tapeVar(kind) }}
    >
      <TopicIcon kind={kind} size={20} />
      <span className="truncate">{label}</span>
    </span>
    <div className="mt-1.5 grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${hits.length}, minmax(0, 1fr))` }} aria-hidden="true">
      {hits.map((v, i) => (
        <span key={i} className="mw-cell !rounded-[4px]" data-mood={moodOf({ problemWhen }, v)}>
          {v === true && <TopicIcon kind={kind} size={hits.length > 7 ? 20 : 30} sticker className="absolute" style={{ transform: `rotate(${tilt(label + i)}deg)` }} />}
          {v === false && hits.length <= 7 && <PencilCurl size={16} />}
        </span>
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
  const door = getDoorState();
  const doorIdOf = (id: string): DoorId | undefined =>
    !door ? undefined : door.trackerId === id ? door.id : door.extra?.find((x) => x.trackerId === id)?.id;
  const kindOf = (tr: Tracker) => topicKind(tr.title, doorIdOf(tr.id));

  // People who came in through a door care about that question first, so
  // pairs that include it lead; otherwise the engine's own order stands.
  const findings = useMemo(() => {
    const all = computeCorrelations(trackers, entries, 5);
    const doorId = door?.trackerId;
    if (!doorId) return all;
    const hasDoor = (c: CorrelationResult) => c.trackerA.id === doorId || c.trackerB.id === doorId;
    return [...all.filter(hasDoor), ...all.filter((c) => !hasDoor(c))];
  }, [trackers, entries]); // eslint-disable-line react-hooks/exhaustive-deps

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
    let recalled = false;
    try {
      recalled = localStorage.getItem(RECALL_KEY) === "true";
    } catch {
      // no storage
    }
    const road = Math.min(FINDINGS_AFTER, eveningDates(trackers, entries).length + (recalled ? 1 : 0));

    // Before the first report: the road, and what a finding will look like.
    if (road < FINDINGS_AFTER) {
      const ex = (on: number[]) => Array.from({ length: 7 }, (_, i) => on.includes(i));
      return (
        <div className="space-y-5 animate-fade-in">
          <div className="flex items-end gap-2">
            <Malu pose="think" size={92} className="shrink-0 -ml-1" />
            <div className="mw-bubble mb-6 text-[18px] leading-snug">
              {t("mw.today.roadTitle", { count: FINDINGS_AFTER - road })}
            </div>
          </div>
          <div className="flex gap-1.5 px-1" aria-hidden="true">
            {Array.from({ length: FINDINGS_AFTER }, (_, i) => (
              <span key={i} className={cn("h-3.5 flex-1 rounded-[3px]", i < road ? "bg-[hsl(var(--mw-brand))]" : "bg-[hsl(var(--mw-grid))]")} />
            ))}
          </div>
          <Explainer id="findings" label={t("mw.explain.findLabel")}>
            <p className="text-[18px] leading-snug">{t("mw.explain.findLine")}</p>
          </Explainer>
          <div className="mw-taped p-[18px] pt-6 opacity-90" style={{ ["--tape" as string]: "var(--tape-other)" }}>
            <p className="mw-hand text-[18px] text-muted-foreground">{t("doors.exampleBadge")}</p>
            <p className="mt-1 mw-display text-[22px] leading-[1.2]">{t("mw.find.exampleSentence")}</p>
            <div className="mt-4 space-y-3">
              <Strip label={t("doors.curious.shortNight")} kind="sleep" hits={ex([0, 2, 3, 5])} />
              <Strip label={t("week.row.migraine")} kind="migraine" hits={ex([1, 3, 4, 6])} />
            </div>
            <p className="mt-3 text-[17px] font-semibold text-muted-foreground">{t("mw.find.seen", { k: 3, n: 4 })}</p>
          </div>
        </div>
      );
    }

    // The first week report.
    const dates = lastDates(new Date(), 7);
    const doorRows = trackers.filter((tr) => !tr.archived && doorIdOf(tr.id));
    const rows = (doorRows.length ? doorRows : trackers.filter((tr) => !tr.archived).slice(0, 3)).map((tr) => {
      const byDate = new Map(entries.filter((e) => e.trackerId === tr.id).map((e) => [e.date, e.value]));
      const hits = dates.map((d) => byDate.get(d));
      return { tr, hits, k: hits.filter((v) => v !== undefined && isHit(tr, v)).length };
    });
    const fact = door && trackers.some((tr) => tr.id === door.trackerId) ? strongestContextFact(door, trackers, entries) : null;
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="flex items-end gap-2">
          <Malu pose="wink" size={92} className="shrink-0 -ml-1" />
          <div className="mw-bubble mb-6 text-[18px] leading-snug">{t("mw.find.reportHi")}</div>
        </div>
        <div className="mw-taped p-[18px] pt-6" style={{ ["--tape" as string]: "var(--tape-fights)" }}>
          <p className="mw-display text-[24px]">{t("mw.find.reportTitle")}</p>
          <div className="mt-4 space-y-4">
            {rows.map(({ tr, hits, k }) => (
              <div key={tr.id}>
                <Strip label={doorIdOf(tr.id) ? t(`week.row.${doorIdOf(tr.id)}`) : localizeTrackerTitle(tr.title)} kind={kindOf(tr)} hits={hits} problemWhen={tr.problemWhen} />
                <p className="mt-1.5 text-[17px] font-semibold">{t("mw.find.rowCount", { k, n: 7 })}</p>
              </div>
            ))}
          </div>
          {fact && <p className="mt-4 mw-hand text-[19px] leading-snug">{factLine(t, fact)}</p>}
        </div>
        <p className="px-1 text-[17px] text-muted-foreground">{t("mw.find.linksLater")}</p>
      </div>
    );
  }

  const [top, ...rest] = findings;
  const { k, n } = holdCount(top);
  const yesOn = (tr: Tracker) => {
    const byDate = new Map(entries.filter((e) => e.trackerId === tr.id).map((e) => [e.date, e.value]));
    return Array.from({ length: STRIP_DAYS }, (_, i) => byDate.get(daysAgoIso(STRIP_DAYS - 1 - i)));
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="mw-taped p-[18px] pt-6" style={{ ["--tape" as string]: tapeVar(kindOf(top.trackerA)) }}>
        <p className="mw-hand text-[18px] text-muted-foreground">{t("patterns.findStrongest")}</p>
        <p className="mt-1 mw-display text-[23px] leading-[1.2]">{sentence(top)}</p>
        <div className="mt-4 space-y-3">
          <Strip label={localizeTrackerTitle(top.trackerA.title)} kind={kindOf(top.trackerA)} hits={yesOn(top.trackerA)} problemWhen={top.trackerA.problemWhen} />
          <Strip label={localizeTrackerTitle(top.trackerB.title)} kind={kindOf(top.trackerB)} hits={yesOn(top.trackerB)} problemWhen={top.trackerB.problemWhen} />
        </div>
        <p className="mt-3 text-[17px] font-semibold">{t("mw.find.seen", { k, n })}</p>
        <button type="button" onClick={onSeeDays} className="mw-link -ml-2 mt-1">
          {t("patterns.findSeeDays")}
        </button>
      </div>

      {rest.length > 0 && (
        <>
          <h2 className="px-1 mw-display text-[20px]">{t("patterns.findAlso")}</h2>
          <div className="mw-sheet divide-y divide-[hsl(var(--mw-grid))]">
            {rest.map((c, i) => {
              const h = holdCount(c);
              return (
                <div key={i} className="flex gap-3 items-center px-4 py-3.5">
                  <TopicIcon kind={kindOf(c.trackerA)} size={30} />
                  <p className="text-[17px] leading-snug">
                    {sentence(c)} <span className="text-muted-foreground whitespace-nowrap">{t("patterns.findKofN", { k: h.k, n: h.n })}</span>
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}

      <p className="px-1 text-[16px] leading-snug text-muted-foreground">{t("patterns.findDisclaimer")}</p>
    </div>
  );
};
