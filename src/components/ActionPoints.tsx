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
import { answerClause, answerPhrase, cap } from "@/lib/answerPhrases";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bell, Check, ChevronDown, ChevronRight, FlaskConical, RotateCcw } from "lucide-react";
import { cardQuestion } from "@/lib/cardText";
import { ideaOf, testNameOf, testQuestionOf, quotedTestName } from "@/lib/testWords";
import { getNotificationSettings, requestNotificationPermissionDetailed, scheduleNotification } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { ruleCount } from "@/lib/lighthouses";
import { ruleKeyOf } from "@/lib/rules";
import { isNeutralQuestion, isTestQuestion, islandOf, linkOf, linkWorthShowing, mapPic, type IslandId } from "@/lib/islands";
import { computeCorrelations } from "@/lib/correlations";
import { linkSentence, trackerLookup } from "@/lib/linkText";
import { getDoorState, isoLocal } from "@/lib/doors";
import { localizeTrackerAdvice, localizeTrackerTitle } from "@/lib/trackerLocalize";
import { answeredEvenings, countFromToday, patchTracker, planKindOf, SHAPING_EVENINGS } from "@/lib/actionPoints";
import { experimentDay, EXPERIMENT_DAYS, experimentOver, experimentResult, finishedExperiments, ideasFor, overlapping, runningExperiments, setExperimentRemind, smartRemindTime, keptExperiments, stopKept, testOnIsland, verdictOf, weekDone, type Experiment } from "@/lib/experiments";
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
  const { t, i18n } = useTranslation();
  const name = useName();
  const [sheet, setSheet] = useState<{ id: string; mode: "show" | "change" } | null>(null);
  // the cards opened to their details
  const [openCards, setOpenCards] = useState<string[]>([]);
  // her links, read the same way as the Links list: what comes before a lit question's hard answer
  const links = useMemo(() => computeCorrelations(trackers.filter((x) => !x.archived && x.source !== "play"), entries, 12).filter(linkWorthShowing).map(linkOf), [trackers, entries]);
  const of = useMemo(() => trackerLookup(trackers), [trackers]);
  const linksInto = (tr: Tracker) => links.filter((l) => l.second.id === tr.id && l.secondHard === true && !isTestQuestion(l.first)).slice(0, 2);
  /** a link's first question, when it's that question's hard answer and it has a plan: a cause to test */
  const causeOf = (tr: Tracker) => linksInto(tr).map((l) => l.first).find((c, i) => {
    const l = linksInto(tr)[i];
    return !isNeutralQuestion(c) && !c.archived && !!c.adviceAboveThreshold && l.firstYes === (c.problemWhen === "yes");
  }) ?? null;
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
        // kept going after its two weeks: says so instead of "I'll try" (Nov 8 2026)
        const keptOne = ownTest ? null : keptExperiments().find((x) => x.from === tr.id);
        const blocked = ownTest && !experimentOver(ownTest) ? t("rules.testing", { k: experimentDay(ownTest), count: EXPERIMENT_DAYS }) : ownTest ? "done"
          : keptOne?.reviewed ? t("experiment.keptSince", { date: new Date(keptOne.reviewed + "T12:00:00").toLocaleDateString(i18n.language, { day: "numeric", month: "long" }) }) : null;
        const once = planKindOf(tr) === "once";
        const opened = openCards.includes(tr.id);
        const hardYes = tr.problemWhen === "yes";
        return (
          <div key={tr.id} className="surface rounded-[22px]">
            {/* the advice and how often, in words; the whole top opens the details (her note, Nov 8 2026:
                "вместо вопроса — ты часто… судя по ответам… и можно посмотреть детали… клацнуть на весь блок") */}
            <button type="button" aria-expanded={opened} onClick={() => { haptics.tap(); setOpenCards((l) => (l.includes(tr.id) ? l.filter((x) => x !== tr.id) : [...l, tr.id])); }}
              className="flex w-full items-start gap-3 px-4 pb-4 pt-4 text-left">
              <img src={mapPic("lighthouse")} alt="" width={40} height={46} className="h-11 w-10 shrink-0 object-contain drop-shadow-[0_0_8px_hsl(44_96%_60%/0.7)]" />
              <span className="min-w-0 flex-1">
                <span className="block text-[20px] font-bold leading-snug">{plan || name(tr)}</span>
                <span className="mt-1 block text-[15px] font-semibold leading-snug text-muted-foreground">
                  {t("rules.oftenLine", { what: answerClause(t, tr, hardYes, "result", t("rules.often")), count: k, days: tr.periodDays })}
                </span>
                <span className="mt-2 inline-flex items-center gap-1 text-[15px] font-bold" style={{ color: TEAL }}>
                  {t(opened ? "rules.lessDetails" : "rules.details")}
                  <ChevronDown className={cn("h-4 w-4 transition-transform", opened && "rotate-180")} strokeWidth={2.6} />
                </span>
              </span>
            </button>
            {opened && (
            <div className="px-4 pb-4 animate-fade-in">
            <p className="text-[14px] font-semibold text-muted-foreground">{t("experiment.everyEvening")}</p>
            <p className="mt-0.5 text-[17px] font-bold leading-snug">{cardQuestion(tr)}</p>
            <RuleMeter k={k} n={tr.threshold} period={tr.periodDays} hardYes={hardYes} since={countedSince(tr)} className="mt-3" />
            {/* what MeMap suggests: a test with its evening question, or a one-off step */}
            {plan && (
              <>
                <p className="mt-4 text-[14px] font-semibold text-muted-foreground">{t("rules.suggests")}</p>
                <p className="mt-0.5 text-[16px] font-bold leading-snug">{once ? t("rules.suggestOnce") : t("rules.suggestDaily", { count: EXPERIMENT_DAYS, q: testQuestionOf(tr.adviceAboveThreshold) })}</p>
              </>
            )}
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
            {/* what comes with it in her days, and the possible cause to test (Nov 8 2026) */}
            {linksInto(tr).length > 0 && (() => {
              const cause = causeOf(tr);
              const causeTest = cause ? tests.find((x) => x.from === cause.id) : undefined;
              return (
                <div className="mt-4 border-t border-foreground/[0.07] pt-4">
                  <p className="text-[14px] font-semibold text-muted-foreground">{t("rules.linkedHead")}</p>
                  {linksInto(tr).map((l) => (
                    <p key={l.first.id} className="mt-1 text-[16px] font-bold leading-snug">
                      {linkSentence(t, { first: l.first.id, second: l.second.id, firstYes: l.firstYes, secondYes: l.secondYes, nextDay: l.nextDay, k: l.k, n: l.n }, of)}
                    </p>
                  ))}
                  {cause && (
                    <>
                      {/* not "test the cause" (her note, Nov 8 2026: "протестировать причину — поговорить с партнёром?"):
                          the possible cause by name, then what can be done about it; the button says once or daily */}
                      <p className="mt-3 text-[14px] font-semibold text-muted-foreground">{t("rules.causeHead")}</p>
                      <p className="mt-0.5 text-[17px] font-bold leading-snug">{cap(answerPhrase(t, cause, cause.problemWhen === "yes"))}</p>
                      <p className="mt-2 text-[14px] font-semibold text-muted-foreground">{t("rules.causeDo")}</p>
                      <p className="mt-0.5 text-[17px] font-bold leading-snug">{planOf(cause)}</p>
                      {causeTest && !experimentOver(causeTest) ? (
                        <p className="mt-2.5 flex items-center gap-2 rounded-2xl bg-foreground/[0.05] px-3.5 py-2.5 text-[14px] font-semibold leading-snug text-muted-foreground">
                          <FlaskConical className="h-4 w-4 shrink-0" strokeWidth={2.4} />{t("rules.testing", { k: experimentDay(causeTest), count: EXPERIMENT_DAYS })}
                        </p>
                      ) : planKindOf(cause) === "once" ? (
                        <button type="button" onClick={() => void didOnce(cause, ruleCount(cause, entries))} className="raised-btn is-small mt-3 w-full justify-center"><Check className="h-5 w-5" strokeWidth={2.6} /> {t("rules.doneOnce")}</button>
                      ) : (
                        <button type="button" onClick={() => tryIt(cause, ruleCount(cause, entries))} className="raised-btn is-small mt-3 w-full justify-center">{t("rules.tryDaily")}</button>
                      )}
                    </>
                  )}
                </div>
              );
            })()}
            </div>
            )}
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
const TestSheet = ({ test, trackers, entries, line, onClose, onStop }: { test: Experiment; trackers: Tracker[]; entries: TrackerEntry[]; line: string; onClose: () => void; onStop?: () => void }) => {
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
        {/* a kept one stops here: no more question and no more reminder */}
        {onStop && <button type="button" onClick={() => { haptics.tap(); onStop(); }} className="mt-1 h-12 w-full text-[16px] font-semibold text-muted-foreground">{t("experiment.stopKept")}</button>}
      </div>
    </BottomSheet>
  );
};

/** "What helps" (the World's 4th part; her note, Nov 8 2026: it opened an empty "Week summary"):
 *  the tests running now (each opens with its reminder), a finished one's result, the ones tried
 *  before with what they showed, and "Test one change". */
export const WhatHelps = ({ trackers, entries, onResult, onPick }: { trackers: Tracker[]; entries: TrackerEntry[]; onResult: (x: Experiment) => void; onPick: () => void }) => {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState<Experiment | null>(null);
  const [, setTick] = useState(0);
  const running = runningExperiments();
  const tried = [...finishedExperiments()].reverse();
  const since = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString(i18n.language, { day: "numeric", month: "long" });
  const lineOf = (x: Experiment) => (x.reviewed && x.kept ? t("experiment.keptSince", { date: since(x.reviewed) }) : t("rules.testing", { k: Math.min(experimentDay(x), EXPERIMENT_DAYS), count: EXPERIMENT_DAYS }));
  const stop = async (x: Experiment) => {
    await stopKept(x.id);
    try { await scheduleNotification(getNotificationSettings()); } catch { /* next start */ }
    setOpen(null); setTick((k) => k + 1);
  };
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
      {/* kept going first, under their own name; then the ones tried before */}
      {[["helps.keeping", tried.filter((x) => x.kept)], ["helps.tried", tried.filter((x) => !x.kept)]].filter(([, list]) => (list as Experiment[]).length > 0).map(([head, list]) => (
        <div key={head as string}>
          <p className="px-1 pb-2.5 pt-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t(head as string)}</p>
          <div className="surface divide-y divide-foreground/[0.06] rounded-[22px]">
            {(list as Experiment[]).map((x) => {
              const r = experimentResult(x, trackers, entries);
              return (
                <div key={x.id} className="px-4 py-3" {...(x.kept ? { role: "button", tabIndex: 0, onClick: () => { haptics.tap(); setOpen(x); } } : {})}>
                  <p className="text-[16px] font-bold leading-snug">{testNameOf(x.change)}</p>
                  {/* kept going: since when, and its reminder (opens to change or stop it) */}
                  {x.kept && (
                    <p className="mt-0.5 flex items-center gap-1 text-[14px] font-bold" style={{ color: TEAL }}>
                      {lineOf(x)}<span className="font-semibold text-muted-foreground">{" · "}</span><Bell className="h-3.5 w-3.5" strokeWidth={2.4} />{x.remind ?? t("experiment.noRemind")}
                    </p>
                  )}
                  <p className="mt-0.5 text-[14px] font-semibold leading-snug text-muted-foreground">
                    {r.withChange[1] && r.without[1] ? t("helps.resultLine", { a: r.withChange[0], b: r.withChange[1], c: r.without[0], d: r.without[1] })
                      : r.during[1] && r.before[1] ? t("helps.beforeLine", { a: r.during[0], b: r.during[1], c: r.before[0], d: r.before[1] }) : t("helps.noData")}
                  </p>
                  {verdictOf(r) !== "few" && <p className="mt-0.5 text-[14px] font-bold leading-snug" style={{ color: TEAL }}>{t(`experiment.verdict.${verdictOf(r)}`)}</p>}
                  {overlapping(x).length > 0 && <p className="mt-0.5 text-[13px] font-semibold leading-snug text-muted-foreground">{t("experiment.overlap", { list: overlapping(x).map((o) => quotedTestName(o.change)).join(", ") })}</p>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {open && <TestSheet test={open} trackers={trackers} entries={entries} line={lineOf(open)} onClose={() => setOpen(null)} onStop={open.reviewed && open.kept ? () => void stop(open) : undefined} />}
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
