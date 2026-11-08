// Action points (her note, Nov 3 2026: "слишком много всего написано, пока
// поймёшь, что делать, уже тяжело… первым делом писать action point, потом,
// возможно, объяснение почему, и можно нажать и посмотреть подробнее").
// Nov 5 2026 (WORLD-BIBLE "Решения 5 ноября" #5): a reached rule is a card
// with the action first, big; one quiet line says why; then three choices:
//   I'll try    — a week's test of it starts (ExperimentSheet), and the count
//                 starts again from today;
//   Show        — the days behind it, as dots, and her plan and rule to change;
//   Not for me  — another plan (her island's small daily ideas, or her own),
//                 or turn it off.
// No "all calm" before there is data: "Your world is still taking shape"
// until a week of evenings. Gold, never red; no alarms.
import { answerPhrase, cap } from "@/lib/answerPhrases";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bell, Check, ChevronRight, FlaskConical, RotateCcw } from "lucide-react";
import { cardQuestion } from "@/lib/cardText";
import { ideaOf, testNameOf, testQuestionOf } from "@/lib/testWords";
import { getNotificationSettings, requestNotificationPermissionDetailed, scheduleNotification } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { ruleCount } from "@/lib/lighthouses";
import { ruleKeyOf } from "@/lib/rules";
import { islandOf, mapPic, type IslandId } from "@/lib/islands";
import { getDoorState, isoLocal } from "@/lib/doors";
import { localizeTrackerAdvice, localizeTrackerTitle } from "@/lib/trackerLocalize";
import { answeredEvenings, countFromToday, patchTracker, planKindOf, SHAPING_EVENINGS } from "@/lib/actionPoints";
import { experimentDay, EXPERIMENT_DAYS, experimentOver, experimentResult, finishedExperiments, ideasFor, overlapping, runningExperiments, setExperimentRemind, smartRemindTime, testOnIsland, verdictOf, weekDone, type Experiment } from "@/lib/experiments";
import i18nInstance from "@/lib/i18n";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { RuleChips } from "@/components/RuleChips";
import { ExperimentSheet } from "@/components/ExperimentSheet";

/** "I'll try": the week's test to start, for the screen that holds the sheets. */
export interface TryAction { island: IslandId; plan: string; trackerId: string; k: number }

const TEAL = "hsl(var(--coin-teal))";
const quietBtn = "quiet-btn w-full";

/** Door questions go by their door name ("Fights with my partner"). */
const useName = () => {
  const { t } = useTranslation();
  const door = getDoorState();
  return (tr: Tracker) => {
    const id = door?.trackerId === tr.id ? door.id : door?.extra?.find((x) => x.trackerId === tr.id)?.id;
    return id ? t(`doors.${id}.name`) : localizeTrackerTitle(tr.title);
  };
};
const planOf = (tr: Tracker) => (tr.adviceAboveThreshold ? testNameOf(tr.adviceAboveThreshold) : "");

/** After "I did it": the window before it and the days since (from 7 days on). */
const beforeAfter = (tr: Tracker, entries: TrackerEntry[]): { k1: number; n1: number; k2: number; n2: number } | null => {
  const last = tr.cycles?.[tr.cycles.length - 1];
  if (!last || !tr.cycleStartDate) return null;
  const since = Math.round((new Date(isoLocal(new Date()) + "T12:00:00").getTime() - new Date(tr.cycleStartDate + "T12:00:00").getTime()) / 86_400_000) + 1;
  if (since < 7) return null;
  return { k1: last.significantDays, n1: last.periodDays, k2: ruleCount(tr, entries), n2: Math.min(since, tr.periodDays) };
};
/** A test on this question's island blocks a second one there; it says why. */
const blockedLine = (t: (k: string, o?: Record<string, unknown>) => string, x: Experiment | null) => {
  if (!x) return null;
  const d = experimentDay(x);
  // day 5 of 14 → 9 more days (QA: "day 5 of 14" and "ends in 10 days" didn't add up)
  return d > EXPERIMENT_DAYS ? t("rules.afterTestDone") : d === EXPERIMENT_DAYS ? t("rules.afterTestToday") : t("rules.afterTest", { count: EXPERIMENT_DAYS - d });
};

/** How far an action point is: one dot per day her rule needs, the days
 *  that came filled in the hard-day colour (her notes, Nov 5 2026: an orange
 *  bar in the list and purple dots inside didn't match, "не разобраться";
 *  then "то кружками, то квадратиками" — a day is always a dot). The same
 *  meter in the list, on the card and in Show; in Show its filled dots are
 *  the dark dots of the last days under it. */
/** The day the count started again, when it's inside the rule's window (after "I did it"). */
const countedSince = (tr: Tracker): string | null => {
  if (!tr.cycleStartDate) return null;
  const days = Math.round((new Date(isoLocal(new Date()) + "T12:00:00").getTime() - new Date(tr.cycleStartDate + "T12:00:00").getTime()) / 86_400_000);
  if (days >= tr.periodDays) return null;
  return new Date(tr.cycleStartDate + "T12:00:00").toLocaleDateString(i18nInstance.language?.startsWith("ru") ? "ru-RU" : "en-GB", { weekday: "short", day: "numeric", month: "short" });
};
const RuleMeter = ({ k, n, period, hardYes, since, className }: { k: number; n: number; period: number; hardYes: boolean; since?: string | null; className?: string }) => {
  const { t } = useTranslation();
  const done = k >= n;
  const ans = t(hardYes ? "rules.ansYes" : "rules.ansNo");
  return (
    <span className={cn("block", className)}>
      <span className="flex max-w-[240px] items-center gap-1" aria-hidden="true">
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className="aspect-square min-w-0 max-w-3 flex-1 rounded-full" style={{ background: i < k ? "hsl(var(--strong))" : "hsl(var(--foreground) / 0.1)" }} />
        ))}
      </span>
      {/* the answer that counts, how often, in how many days (Nov 8 2026) */}
      <span className={cn("mt-1.5 block text-[14px] font-bold leading-snug tabular-nums", done ? "text-[hsl(var(--strong))]" : "text-muted-foreground")}>
        {/* after "I did it" the count starts again: say so, never "0 of the last 30 days" (QA, Nov 8 2026) */}
        {since && !done ? t("rules.whySince", { ans, k, n, date: since }) : t(done ? "rules.why" : "rules.whySoFar", { ans, k, n, count: period })}
      </span>
    </span>
  );
};

export const ActionPoints = ({ trackers, entries, onTry }: {
  trackers: Tracker[];
  entries: TrackerEntry[];
  /** opens the week's test outside this sheet (the Map); else it opens here */
  onTry?: (x: TryAction) => void;
}) => {
  const { t } = useTranslation();
  const name = useName();
  const [sheet, setSheet] = useState<{ id: string; mode: "show" | "change" } | null>(null);
  const [trying, setTrying] = useState<TryAction | null>(null);
  const rows = trackers
    .filter((tr) => !tr.archived && tr.threshold > 0)
    .map((tr) => ({ tr, k: ruleCount(tr, entries) }))
    .map((r) => ({ ...r, lit: r.k >= r.tr.threshold }));
  const lit = rows.filter((r) => r.lit);
  const watching = rows.filter((r) => !r.lit).sort((a, b) => b.k / b.tr.threshold - a.k / a.tr.threshold);
  /** the question under the plan; a good one is counted when it's missing */
  // the hard answer in its own words (answerPhrases): "Short night", not «Без «Спал(а) 7+ часов»»
  const label = (tr: Tracker) => cap(answerPhrase(t, tr, tr.problemWhen === "yes"));
  const why = (tr: Tracker, k: number) => t("rules.why", { ans: t(tr.problemWhen === "yes" ? "rules.ansYes" : "rules.ansNo"), k, count: tr.periodDays });
  const evenings = answeredEvenings(trackers, entries);
  // The tests running now: one per island, side by side (Nov 7 2026).
  const tests = runningExperiments();
  const lineOf = (x: Experiment) => { const d = experimentDay(x); return d > EXPERIMENT_DAYS ? t("rules.testDone") : t("rules.testing", { k: d, count: EXPERIMENT_DAYS }); };
  const [testOpen, setTestOpen] = useState<Experiment | null>(null);
  // a finished test opens its result here (QA: "Your test is done: see it on Today" led nowhere)
  const [resultOf, setResultOf] = useState<Experiment | null>(null);
  const openTest = (x: Experiment) => { haptics.tap(); if (experimentOver(x)) setResultOf(x); else setTestOpen(x); };
  const didOnce = async (tr: Tracker, k: number) => { haptics.success(); await countFromToday(tr.id, k, { planKind: "once" }); };
  const current = rows.find((r) => r.tr.id === sheet?.id);
  const open = (id: string, mode: "show" | "change") => { haptics.tap(); setSheet({ id, mode }); };
  const tryIt = (tr: Tracker, k: number) => {
    haptics.tap();
    const x: TryAction = { island: islandOf(tr), plan: planOf(tr), trackerId: tr.id, k };
    if (onTry) onTry(x); else setTrying(x);
  };

  if (rows.length === 0) {
    return (
      <div className="surface rounded-[22px] px-5 py-5 animate-fade-in">
        <p className="text-[18px] font-bold leading-snug">{t("rules.noneTitle")}</p>
        <p className="mt-1 text-[15px] font-medium text-muted-foreground">{t("rules.noneLine")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 animate-fade-in">
      {/* The tests she is trying now. */}
      {tests.map((test) => (
        <button key={test.id} type="button" onClick={() => openTest(test)} className="surface flex w-full items-center gap-3 rounded-[22px] px-4 py-3.5 text-left">
          <span className="icon-dot h-11 w-11">
            <FlaskConical className="h-5 w-5" strokeWidth={2.4} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-bold leading-snug">{testNameOf(test.change)}</span>
            <span className="block text-[14px] font-semibold" style={{ color: TEAL }}>{lineOf(test)}</span>
            {test.perWeek && <span className="block text-[14px] font-semibold" style={{ color: TEAL }}>{t("experiment.weekOf", { k: weekDone(test, entries), n: test.perWeek })}</span>}
            <span className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-muted-foreground">
              <Bell className="h-3.5 w-3.5" strokeWidth={2.4} />{test.remind ? `${t("experiment.remindAt")} ${test.remind}` : t("experiment.noRemind")}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={2.4} />
        </button>
      ))}

      {lit.length === 0 && (evenings < SHAPING_EVENINGS ? (
        // Too early to say anything is calm (GPT review, Nov 5 2026).
        <div className="surface rounded-[22px] px-5 py-4">
          <p className="text-[19px] font-bold leading-snug">{t("rules.shaping")}</p>
          <div className="mt-3 flex gap-1.5" aria-hidden="true">
            {Array.from({ length: SHAPING_EVENINGS }, (_, i) => (
              <span key={i} className="h-3 w-3 rounded-full" style={{ background: i < evenings ? "hsl(var(--coin-gold))" : "hsl(var(--foreground) / 0.1)" }} />
            ))}
          </div>
          <p className="mt-2 text-[14px] font-semibold text-muted-foreground">{t("rules.evenings", { k: evenings, count: SHAPING_EVENINGS })}</p>
        </div>
      ) : (
        <p className="surface rounded-[22px] px-5 py-4 text-[18px] font-bold">{t("rules.nothingNow")}</p>
      ))}

      {lit.length > 0 && <p className="px-1 pt-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("rules.timeToAct")}</p>}
      {lit.map(({ tr, k }) => {
        const plan = planOf(tr);
        // several tests may run at once (Nov 8 2026); only this plan's own running test replaces the button
        const ownTest = tests.find((x) => x.from === tr.id);
        const blocked = ownTest && !experimentOver(ownTest) ? t("rules.testing", { k: experimentDay(ownTest), count: EXPERIMENT_DAYS }) : ownTest ? "done" : null;
        const once = planKindOf(tr) === "once";
        return (
          <div key={tr.id} className="surface rounded-[22px] px-4 pb-4 pt-4">
            <div className="flex items-start gap-3">
              <img src={mapPic("lighthouse")} alt="" width={40} height={46} className="h-11 w-10 shrink-0 object-contain drop-shadow-[0_0_8px_hsl(44_96%_60%/0.7)]" />
              <div className="min-w-0 flex-1">
                <p className="text-[20px] font-bold leading-snug">{plan || name(tr)}</p>
                <p className="mt-1 text-[15px] font-semibold leading-snug text-muted-foreground">{cardQuestion(tr)}</p>
                <RuleMeter k={k} n={tr.threshold} period={tr.periodDays} hardYes={tr.problemWhen === "yes"} since={countedSince(tr)} className="mt-2" />
              </div>
            </div>
            {!plan ? (
              <button type="button" onClick={() => open(tr.id, "change")} className="raised-btn is-small mt-4 w-full justify-center">{t("rules.noPlan")}</button>
            ) : once ? (
              // a one-off plan: mark it done; then MeMap compares before and after
              <button type="button" onClick={() => void didOnce(tr, k)} className="raised-btn is-small mt-4 w-full justify-center"><Check className="h-5 w-5" strokeWidth={2.6} /> {t("rules.doneOnce")}</button>
            ) : blocked ? (() => {
              // one test per island: this one waits, and says why; a finished one opens its result
              const isle = ownTest ?? null;
              return isle && experimentOver(isle) ? (
                <button type="button" onClick={() => openTest(isle)} className="raised-btn is-small mt-4 w-full justify-center gap-2"><FlaskConical className="h-5 w-5" strokeWidth={2.4} /> {t("rules.seeTest")}</button>
              ) : (
                <p className="mt-3.5 flex items-center gap-2 rounded-2xl bg-foreground/[0.05] px-3.5 py-2.5 text-[14px] font-semibold leading-snug text-muted-foreground">
                  <FlaskConical className="h-4 w-4 shrink-0" strokeWidth={2.4} />
                  {blocked}
                </p>
              );
            })() : (
              <button type="button" onClick={() => tryIt(tr, k)} className="raised-btn is-small mt-4 w-full justify-center">{t("rules.tryDaily")}</button>
            )}
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => open(tr.id, "show")} className={quietBtn}>{t("rules.show")}</button>
              <button type="button" onClick={() => open(tr.id, "change")} className={quietBtn}>{t("rules.notForMe")}</button>
            </div>
          </div>
        );
      })}

      {watching.length > 0 && (
        <>
          <p className="px-1 pt-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("rules.watching")}</p>
          <div className="surface divide-y divide-foreground/[0.06] rounded-[22px]">
            {watching.map(({ tr, k }) => {
              const mineTest = tests.find((x) => x.from === tr.id);
              const mine = !!mineTest;
              const ba = beforeAfter(tr, entries);
              return (
                <button key={tr.id} type="button" onClick={() => open(tr.id, "show")} className="block w-full px-4 py-3 text-left">
                  <span className="line-clamp-2 block text-[16px] font-semibold leading-snug">{planOf(tr) || name(tr)}</span>
                  <span className={cn("mt-0.5 flex items-center gap-1 text-[14px] font-medium leading-snug", !mine && "text-muted-foreground")} style={mine ? { color: TEAL } : undefined}>
                    {mine && <FlaskConical className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />}
                    {mineTest ? lineOf(mineTest) : planOf(tr) ? cardQuestion(tr) : ""}
                  </span>
                  {ba && <span className="mt-1 block text-[13px] font-bold" style={{ color: TEAL }}>{t("rules.beforeAfter", ba)}</span>}
                  <RuleMeter k={k} n={tr.threshold} period={tr.periodDays} hardYes={tr.problemWhen === "yes"} since={countedSince(tr)} className="mt-2" />
                </button>
              );
            })}
          </div>
        </>
      )}

      {current && sheet?.mode === "show" && (
        <ShowSheet key={current.tr.id} tracker={current.tr} k={current.k} entries={entries} name={cardQuestion(current.tr)} onClose={() => setSheet(null)}
          onTry={() => tryIt(current.tr, current.k)} blocked={(() => { const o = tests.find((x) => x.from === current.tr.id && !experimentOver(x)); return o ? t("rules.testing", { k: experimentDay(o), count: EXPERIMENT_DAYS }) : null; })()} />
      )}
      {current && sheet?.mode === "change" && (
        <ChangeSheet key={current.tr.id} tracker={current.tr} k={current.k} name={cardQuestion(current.tr)} why={why(current.tr, current.k)} onClose={() => setSheet(null)} />
      )}
      {testOpen && <TestSheet test={testOpen} trackers={trackers} entries={entries} line={lineOf(testOpen)} onClose={() => setTestOpen(null)} />}
      {resultOf && <ExperimentSheet mode="result" experiment={resultOf} trackers={trackers} entries={entries} onClose={() => setResultOf(null)} />}
      {trying && (
        <ExperimentSheet mode="pick" island={trying.island} plan={trying.plan} from={{ trackerId: trying.trackerId, k: trying.k }}
          trackers={trackers} entries={entries} onClose={() => setTrying(null)} />
      )}
    </div>
  );
};

/** "Show": the days behind an action point, then her plan and rule to change. */
const ShowSheet = ({ tracker, k, entries, name, onClose, onTry, blocked }: { tracker: Tracker; k: number; entries: TrackerEntry[]; name: string; onClose: () => void; onTry: () => void; blocked: string | null }) => {
  const { t } = useTranslation();
  const [plan, setPlan] = useState(planOf(tracker));
  const [kind, setKind] = useState<"once" | "daily">(planKindOf(tracker));
  const [limitOpen, setLimitOpen] = useState(false);
  const ba = beforeAfter(tracker, entries);
  const [rule, setRule] = useState({ threshold: tracker.threshold, periodDays: tracker.periodDays });
  // The rule's own window (ruleCount): the last periodDays days and today.
  // Filled = a day that counts (the hard-day colour, as on the calendar).
  const days = useMemo(() => {
    const now = new Date();
    const hit = tracker.problemWhen === "yes";
    const byDate = new Map(entries.filter((e) => e.trackerId === tracker.id).map((e) => [e.date, e.value]));
    return Array.from({ length: tracker.periodDays + 1 }, (_, i) => {
      const iso = isoLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() - tracker.periodDays + i));
      const v = byDate.get(iso);
      const before = !!tracker.cycleStartDate && iso < tracker.cycleStartDate;
      return { iso, look: v === undefined ? "none" : before ? "before" : v === hit ? "hit" : "other" };
    });
  }, [tracker, entries]);
  const changed = () => plan !== planOf(tracker) || rule.threshold !== tracker.threshold || rule.periodDays !== tracker.periodDays || kind !== planKindOf(tracker);
  const keep = (x: Tracker): Tracker => ({ ...x, ...rule, planKind: kind, adviceAboveThreshold: rule.threshold ? plan.trim() : x.adviceAboveThreshold });
  const tryNow = async () => { if (changed()) await patchTracker(tracker.id, keep); onClose(); onTry(); };
  const close = async () => {
    if (changed()) await patchTracker(tracker.id, keep);
    onClose();
  };
  // "Done": she did it; the count starts again from today.
  const did = async () => {
    haptics.success();
    await countFromToday(tracker.id, k, keep(tracker));
    onClose();
  };
  const lit = tracker.threshold > 0 && k >= tracker.threshold;
  return (
    <BottomSheet open onOpenChange={(o) => { if (!o) close(); }} className="h-auto max-h-[88vh]" ariaTitle={t("rules.title")}>
      <div className="flex min-h-0 flex-1 flex-col space-y-5 overflow-y-auto px-5 pb-8">
        <div className="pr-10 pt-1">
          {/* the question is the title (her note: "непонятно, к какому вопросу это действие") */}
          <p className="text-[24px] font-bold leading-tight tracking-tight">{name}</p>
          <p className="mt-1.5 text-[19px] font-bold tabular-nums">
            {k >= tracker.threshold
              ? t("rules.bigDone", { k, count: tracker.periodDays })
              : t("rules.bigOf", { k, count: tracker.threshold })}
          </p>
          <p className="mt-1 text-[15px] font-medium leading-snug text-muted-foreground">{t("rules.ruleLine", { n: tracker.threshold, count: tracker.periodDays })}</p>
          {ba && <p className="mt-2 text-[15px] font-bold" style={{ color: TEAL }}>{t("rules.beforeAfter", ba)}</p>}
          {/* one row of days, the colours in words */}
          <p className="mt-5 text-[13px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">{t("rules.lastDays", { count: tracker.periodDays })}</p>
          <div className="mt-2 flex flex-wrap gap-1.5" aria-hidden="true">
            {days.map((d) => (
              <span key={d.iso} className="h-3 w-3 rounded-full" style={{
                background: d.look === "hit" ? "hsl(var(--strong))" : d.look === "other" ? "hsl(var(--balanced) / 0.75)" : "hsl(var(--foreground) / 0.08)",
                opacity: d.look === "before" ? 0.45 : 1,
              }} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-semibold text-muted-foreground">
            <span className="flex items-center gap-1.5"><i className="block h-2.5 w-2.5 rounded-full" style={{ background: "hsl(var(--strong))" }} />{t(tracker.problemWhen === "yes" ? "rules.ansYes" : "rules.ansNo")}</span>
            <span className="flex items-center gap-1.5"><i className="block h-2.5 w-2.5 rounded-full" style={{ background: "hsl(var(--balanced) / 0.75)" }} />{t(tracker.problemWhen === "yes" ? "rules.ansNo" : "rules.ansYes")}</span>
            <span className="flex items-center gap-1.5"><i className="block h-2.5 w-2.5 rounded-full bg-foreground/[0.12]" />{t("rules.legendNone")}</span>
          </div>
          {tracker.cycleStartDate && days.some((d) => d.look === "before") && (
            <p className="mt-2 text-[13px] font-medium text-muted-foreground">{t("rules.countedFrom")}</p>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-[16px] font-bold">{t("rules.yourPlan")}</p>
          <textarea value={plan} onChange={(e) => setPlan(e.target.value)} rows={2} maxLength={120} placeholder={t("rules.planPh")}
            className="w-full resize-none rounded-2xl border border-foreground/[0.12] bg-foreground/[0.04] px-4 py-3 text-[18px] font-semibold leading-snug outline-none focus:ring-2 focus:ring-[hsl(var(--coin-teal))]" />
          {/* once (then before and after) or every day (a 2-week test) */}
          <div className="grid grid-cols-2 gap-2">
            {(["once", "daily"] as const).map((kd) => (
              <button key={kd} type="button" onClick={() => { haptics.tap(); setKind(kd); }} aria-pressed={kind === kd}
                className={cn("h-11 rounded-full text-[15px] font-bold", kind === kd ? "surface pick-on" : "bg-foreground/[0.05] text-muted-foreground")}>
                {t(kd === "once" ? "rules.kindOnce" : "rules.kindDaily")}
              </button>
            ))}
          </div>
          <p className="text-[13px] font-semibold leading-snug text-muted-foreground">{t(kind === "once" ? "rules.kindOnceLine" : "rules.kindDailyLine")}</p>
        </div>
        {limitOpen ? (
          <RuleChips hard={tracker.problemWhen !== "no"} value={ruleKeyOf(rule)} customLabel={t("rules.custom", { n: rule.threshold, count: rule.periodDays })}
            onChange={(_, r) => setRule(r)} plan={plan} onPlan={setPlan} showPlan={false} />
        ) : (
          <button type="button" onClick={() => { haptics.tap(); setLimitOpen(true); }} className="quiet-btn h-11 w-full text-[15px]">{t("rules.changeLimit")}</button>
        )}
        {lit && kind === "once" && (
          <button type="button" onClick={did} className="raised-btn w-full justify-center"><Check className="h-5 w-5" strokeWidth={2.6} /> {t("rules.doneOnce")}</button>
        )}
        {lit && kind === "daily" && (blocked
          ? <p className="flex items-center gap-2 rounded-2xl bg-foreground/[0.05] px-3.5 py-2.5 text-[14px] font-semibold leading-snug text-muted-foreground"><FlaskConical className="h-4 w-4 shrink-0" strokeWidth={2.4} />{blocked}</p>
          : <button type="button" onClick={() => void tryNow()} className="raised-btn w-full justify-center"><FlaskConical className="h-5 w-5" strokeWidth={2.4} /> {t("rules.tryDaily")}</button>)}
        <button type="button" onClick={close} className={lit ? "quiet-btn h-12 w-full text-[16px]" : "raised-btn w-full justify-center"}>{t("common.close")}</button>
      </div>
    </BottomSheet>
  );
};

/** A running test (Nov 8 2026, her note: "как поменять время уведомлений на тесты — непонятно, они
 *  нигде не отжимаются"): its name, its day, the evening question, the week's goal, the reminder. */
const TestSheet = ({ test, trackers, entries, line, onClose }: { test: Experiment; trackers: Tracker[]; entries: TrackerEntry[]; line: string; onClose: () => void }) => {
  const { t } = useTranslation();
  const tr = trackers.find((x) => x.id === test.trackerId);
  const [on, setOn] = useState(!!test.remind);
  const [at, setAt] = useState(test.remind ?? smartRemindTime(ideaOf(test.change), testNameOf(test.change)));
  const apply = async (nextOn: boolean, nextAt: string) => {
    setExperimentRemind(test.id, nextOn ? nextAt : null);
    try {
      if (nextOn) { const r = await requestNotificationPermissionDetailed(); if (!r.granted) return; }
      await scheduleNotification(getNotificationSettings());
    } catch { /* never blocks */ }
  };
  return (
    <BottomSheet open onOpenChange={(o) => { if (!o) onClose(); }} className="h-auto max-h-[88vh]" ariaTitle={t("experiment.title")}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-8">
        <p className="flex items-center gap-1.5 pr-10 pt-1 text-[13px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">
          <FlaskConical className="h-4 w-4" strokeWidth={2.4} style={{ color: TEAL }} />{t("experiment.title")}
        </p>
        <p className="mt-1 pr-10 text-[26px] font-bold leading-tight tracking-tight">{testNameOf(test.change)}</p>
        <p className="mt-1 text-[16px] font-bold" style={{ color: TEAL }}>{line}</p>
        {test.perWeek && <p className="mt-0.5 text-[16px] font-bold">{t("experiment.weekOf", { k: weekDone(test, entries), n: test.perWeek })}</p>}
        <p className="mt-5 text-[14px] font-semibold text-muted-foreground">{t("experiment.everyEvening")}</p>
        <p className="mt-0.5 text-[19px] font-bold leading-snug">{tr ? cardQuestion(tr) : testQuestionOf(test.change)}</p>
        <div className="surface mt-5 flex items-center gap-3 rounded-[18px] px-4 py-3">
          <Bell className="h-5 w-5 shrink-0" strokeWidth={2.4} style={{ color: TEAL }} />
          <span className="min-w-0 flex-1 text-[16px] font-bold">{t("experiment.remindMe")}</span>
          <input type="time" value={at} disabled={!on} aria-label={t("experiment.remindAt")}
            onChange={(e) => { const v = e.target.value || "09:00"; setAt(v); if (on) void apply(true, v); }}
            className="h-10 w-[124px] rounded-[12px] bg-foreground/[0.05] px-2 text-center text-[15px] font-bold tabular-nums outline-none disabled:opacity-40" />
          <button type="button" role="switch" aria-checked={on} aria-label={t("experiment.remindMe")} onClick={() => { haptics.tap(); const v = !on; setOn(v); void apply(v, at); }}
            className={`relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors ${on ? "bg-[hsl(var(--coin-teal))]" : "bg-foreground/20"}`}>
            <span className={`absolute top-[3px] h-6 w-6 rounded-full bg-white transition-all ${on ? "left-[23px]" : "left-[3px]"}`} />
          </button>
        </div>
        <button type="button" onClick={onClose} className="raised-btn mt-6 w-full justify-center">{t("common.close")}</button>
      </div>
    </BottomSheet>
  );
};

/** "What helps" (the World's 4th part; her note, Nov 8 2026: it opened an empty "Week summary"):
 *  the tests running now (each opens with its reminder), a finished one's result, the ones tried
 *  before with what they showed, and "Test one change". */
export const WhatHelps = ({ trackers, entries, onResult, onPick }: { trackers: Tracker[]; entries: TrackerEntry[]; onResult: (x: Experiment) => void; onPick: () => void }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState<Experiment | null>(null);
  const running = runningExperiments();
  const tried = [...finishedExperiments()].reverse();
  const lineOf = (x: Experiment) => t("rules.testing", { k: Math.min(experimentDay(x), EXPERIMENT_DAYS), count: EXPERIMENT_DAYS });
  return (
    <div className="space-y-2.5">
      {running.map((x) => experimentOver(x) ? (
        <button key={x.id} type="button" onClick={() => { haptics.tap(); onResult(x); }} className="surface flex w-full items-center gap-3 rounded-[22px] px-4 py-3.5 text-left">
          <span className="icon-dot h-11 w-11"><FlaskConical className="h-5 w-5" strokeWidth={2.4} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-bold leading-snug">{testNameOf(x.change)}</span>
            <span className="block text-[14px] font-bold" style={{ color: TEAL }}>{t("experiment.stepSub")}</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={2.4} />
        </button>
      ) : (
        <button key={x.id} type="button" onClick={() => { haptics.tap(); setOpen(x); }} className="surface flex w-full items-center gap-3 rounded-[22px] px-4 py-3.5 text-left">
          <span className="icon-dot h-11 w-11"><FlaskConical className="h-5 w-5" strokeWidth={2.4} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-bold leading-snug">{testNameOf(x.change)}</span>
            <span className="block text-[14px] font-semibold" style={{ color: TEAL }}>{lineOf(x)}</span>
            {x.perWeek && <span className="block text-[14px] font-semibold" style={{ color: TEAL }}>{t("experiment.weekOf", { k: weekDone(x, entries), n: x.perWeek })}</span>}
            <span className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-muted-foreground">
              <Bell className="h-3.5 w-3.5" strokeWidth={2.4} />{x.remind ? `${t("experiment.remindAt")} ${x.remind}` : t("experiment.noRemind")}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={2.4} />
        </button>
      ))}
      {running.length === 0 && tried.length === 0 && (
        <p className="surface rounded-[22px] px-5 py-4 text-[17px] font-semibold leading-snug">{t("helps.empty")}</p>
      )}
      <button type="button" onClick={() => { haptics.tap(); onPick(); }} className="raised-btn w-full justify-center gap-2">
        <FlaskConical className="h-5 w-5" strokeWidth={2.4} /> {t("experiment.title")}
      </button>
      {tried.length > 0 && (
        <>
          <p className="px-1 pt-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("helps.tried")}</p>
          <div className="surface divide-y divide-foreground/[0.06] rounded-[22px]">
            {tried.map((x) => {
              const r = experimentResult(x, trackers, entries);
              return (
                <div key={x.id} className="px-4 py-3">
                  <p className="text-[16px] font-bold leading-snug">{testNameOf(x.change)}</p>
                  <p className="mt-0.5 text-[14px] font-semibold leading-snug text-muted-foreground">
                    {r.withChange[1] && r.without[1] ? t("helps.resultLine", { a: r.withChange[0], b: r.withChange[1], c: r.without[0], d: r.without[1] }) : t("helps.noData")}
                  </p>
                  {r.withChange[1] > 0 && r.without[1] > 0 && <p className="mt-0.5 text-[14px] font-bold leading-snug" style={{ color: TEAL }}>{t(`experiment.verdict.${verdictOf(r)}`)}</p>}
                  {overlapping(x).length > 0 && <p className="mt-0.5 text-[13px] font-semibold leading-snug text-muted-foreground">{t("experiment.overlap", { list: overlapping(x).map((o) => `“${testNameOf(o.change)}”`).join(", ") })}</p>}
                </div>
              );
            })}
          </div>
        </>
      )}
      {open && <TestSheet test={open} trackers={trackers} entries={entries} line={lineOf(open)} onClose={() => setOpen(null)} />}
    </div>
  );
};

/** "Not for me" (or no plan yet): another plan, or turn it off. */
const ChangeSheet = ({ tracker, name, why, onClose }: { tracker: Tracker; k: number; name: string; why: string; onClose: () => void }) => {
  const { t } = useTranslation();
  const had = planOf(tracker);
  // Small everyday ideas from the question's island (the week's-test ideas).
  const ideas = ideasFor(islandOf(tracker)).map((id) => t(`experiment.idea.${id}.change`)).filter((s) => s !== had);
  const [pick, setPick] = useState<string | null>(null);
  const [own, setOwn] = useState("");
  const next = pick ?? own.trim();
  const save = async () => {
    if (!next) return;
    haptics.success();
    await patchTracker(tracker.id, (x) => ({ ...x, adviceAboveThreshold: next }));
    onClose();
  };
  const off = async () => {
    haptics.tap();
    await patchTracker(tracker.id, (x) => ({ ...x, threshold: 0 }));
    onClose();
  };
  return (
    <BottomSheet open onOpenChange={(o) => { if (!o) onClose(); }} className="h-auto max-h-[88vh]" ariaTitle={t(had ? "rules.instead" : "rules.plan")}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-8">
        <div className="pr-10 pt-1">
          <p className="text-[16px] font-bold leading-snug">{name}</p>
          <p className="mt-1 text-[15px] font-medium leading-snug text-muted-foreground">{why}</p>
          <p className="mt-3 text-[24px] font-bold leading-tight tracking-tight">{t(had ? "rules.instead" : "rules.plan")}</p>
        </div>
        <div className="mt-4 space-y-2.5">
          {ideas.map((s) => {
            const on = pick === s;
            return (
              <button key={s} type="button" onClick={() => { haptics.tap(); setPick(on ? null : s); setOwn(""); }} aria-pressed={on}
                className={cn("surface flex min-h-14 w-full items-center gap-3 rounded-2xl px-5 py-3 text-left text-[17px] outline-none transition-shadow duration-150 active:scale-[0.99]", on ? "pick-on font-bold" : "font-semibold")}>
                <span className="min-w-0 flex-1">{s}</span>
                <span aria-hidden="true" className={cn("tick", on && "is-on")}>
                  {on && <Check className="h-4 w-4" strokeWidth={3} />}
                </span>
              </button>
            );
          })}
          <input value={own} onChange={(e) => { setOwn(e.target.value); setPick(null); }} placeholder={t("experiment.own")} maxLength={90}
            aria-label={t("rules.plan")}
            className={cn("h-14 w-full rounded-2xl border border-foreground/[0.14] bg-foreground/[0.04] px-5 text-[17px] outline-none focus:ring-2 focus:ring-[hsl(var(--coin-teal))]", own.trim() && "pick-on")} />
        </div>
        <button type="button" onClick={save} disabled={!next} className="raised-btn mt-6 w-full justify-center">{t("common.save")}</button>
        <button type="button" onClick={off} className="mt-3 h-12 w-full text-[16px] font-semibold text-muted-foreground">{t("rules.turnOff")}</button>
      </div>
    </BottomSheet>
  );
};
