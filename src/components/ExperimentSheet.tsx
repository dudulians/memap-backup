// "Test one change" (src/lib/experiments.ts): pick an island and one small
// change, try it for 7 days; then see how that island's hard days went on
// days with the change and without. Counts only, never a verdict. Same
// full-screen frame as the games. From an action point ("I'll try", Nov 5
// 2026) her plan is the first choice, the island is the question's own, and
// starting the test counts that action point again from today.
import { ideasForIsland, ideasForQuestion, homeHarmLit } from "@/lib/topicIdeas";
import { KindTag } from "./KindTag";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Check, FlaskConical, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { track, useScreen  } from "@/lib/analytics";
import { playSparkle } from "@/lib/feedback";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { buildIslands, islandName, mapPic, type IslandId } from "@/lib/islands";
import { HOME_HARM_IDS } from "@/lib/supportLines";
import { praiseFor, resultWords } from "@/lib/testResult";
import { BED_FROM_WAKE, NIGHT_IDEAS, WATCH_IDEAS, answeredToday, beforeBed, bedtimeFrom, comparedBy, EXPERIMENT_DAYS, experimentResult, finishExperiment, ideasFor, overlapping, runningExperiments, setExperimentRemind, smartRemindTime, startExperiment, verdictOf, type Experiment } from "@/lib/experiments";
import { templateIdOf } from "@/lib/answerPhrases";
import { getNotificationSettings, requestNotificationPermissionDetailed, scheduleNotification } from "@/lib/notifications";
import { Bell } from "lucide-react";
import { countFromToday } from "@/lib/actionPoints";
import { art, artOf, islandEvenings } from "@/lib/globeArt";
import { Pressable } from "@/components/ui/pressable";
import { cardQuestion } from "@/lib/cardText";
import { busyIdeas, clockTime, goalOf, ideaOf, morningStep, testNameOf, testQuestionOf, quotedTestName } from "@/lib/testWords";
import { alreadyDoing } from "@/lib/alreadyDoing";
import { EVENING_AT } from "@/lib/pathSteps";

/* Chosen: a teal ring and a teal tick (the Aurora kit, Nov 5 2026: no
   tinted backgrounds, one accent colour). */

const PLAN = "__plan";

export const ExperimentSheet = ({ mode, experiment, trackers, entries, island: startIsland, plan, from, link, onClose }: {
  mode: "pick" | "result";
  experiment?: Experiment | null;
  trackers: Tracker[];
  entries: TrackerEntry[];
  /** island to suggest first (from an island's sheet) */
  island?: IslandId;
  /** her plan from an action point: the first choice, on that island only */
  plan?: string;
  /** the action point it came from: its count starts again when the test starts */
  from?: { trackerId: string; k: number };
  /** the link it was opened from ("What to try" under a link): the try remembers it, so the link shows it running */
  link?: string;
  onClose: () => void;
}) => {
  useScreen(`test:${mode}`);
  const { t } = useTranslation();
  const islands = useMemo(() => buildIslands(trackers, entries).filter((i) => i.trackerIds.length > 0), [trackers, entries]);
  // The stormiest island first: that's where a change can show.
  const first = startIsland ?? [...islands].sort((a, b) => b.hardDays - a.hardDays)[0]?.id;
  const [island, setIsland] = useState<IslandId | undefined>(first);
  // a plan her answers say she already does isn't picked for her (Nov 10 2026: "я же отмечал, что сплю хорошо")
  const planDoing = plan ? alreadyDoing(ideaOf(plan), trackers, entries) : null;
  const [idea, setIdea] = useState<string | null>(plan && !planDoing ? PLAN : null);
  const [own, setOwn] = useState("");
  const [started, setStarted] = useState<Experiment | null>(null);
  // "Remind me?" (board 65): on, at a time that fits the change
  const [remindOn, setRemindOn] = useState(true);
  const [remindAt, setRemindAt] = useState("09:00");
  const finishStart = async () => {
    if (started && remindOn) {
      setExperimentRemind(started.id, remindAt);
      try { const r = await requestNotificationPermissionDetailed(); if (r.granted) await scheduleNotification(getNotificationSettings()); } catch { /* never blocks */ }
    }
    track("experiment_remind", { on: remindOn, time: remindOn ? remindAt : null });
    onClose();
  };

  // a whole evening question (Nov 8 2026: "In bed by 23:00?" was no question); a plan that is a
  // weekly goal for her own question ("3 workouts a week") asks that question, with the goal
  const source = from ? trackers.find((x) => x.id === from.trackerId) : undefined;
  const goal = idea === PLAN && source ? goalOf(source) : null;
  const change = idea === PLAN ? plan!.trim() : idea ? t(`experiment.idea.${idea}.change`) : own.trim();
  // her note (Nov 10 2026, a bedtime test asked "Did you set a reminder…?" every evening): a night step is asked the
  // next evening about last night; a plan that is just the good answer of its own question watches that question
  // (no second one); a bedtime counts back from when she gets up ("во сколько надо лечь?")
  const ideaKey = idea === PLAN ? ideaOf(plan!) : idea;
  const night = !!ideaKey && NIGHT_IDEAS.has(ideaKey);
  // the plan or idea is just the good answer of this very question (from its plan or from its own list of ideas)
  const watch = !!source && !!ideaKey && (WATCH_IDEAS[ideaKey] ?? []).includes(templateIdOf(source) ?? "");
  const bedHours = ideaKey ? BED_FROM_WAKE[ideaKey] : undefined;
  const [wake, setWake] = useState("07:00");
  const startedAfterAnswers = new Date().getHours() >= EVENING_AT && answeredToday(trackers, entries);
  const question = (goal || watch) && source ? cardQuestion(source) : idea === PLAN ? testQuestionOf(plan!) : idea ? t(`experiment.idea.${idea}.q`) : own.trim() ? testQuestionOf(own) : "";
  const start = async () => {
    if (!island || !change) return;
    haptics.rise();
    // its first evening is tomorrow: a morning step started in the afternoon (this morning is gone), or any step
    // started in the evening once today's answers are in (her yes, Nov 10 2026: "Walk 20 minutes" started at 21:00
    // asked about a day it couldn't be done)
    const later = !night && !watch && !goal && (startedAfterAnswers || (!!ideaKey && morningStep(ideaKey) && new Date().getHours() >= 12));
    const more = { ...(night ? { night: true } : {}), ...(later ? { later: true } : {}), ...(bedHours ? { wake } : {}) };
    // a hard question watched ("Smoked hookah?"): its "no" is the step done
    const watched = watch && source ? { same: true, ...(source.problemWhen === "yes" ? { doneWhen: false } : {}) } : null;
    const opts = goal ? { same: true, perWeek: goal } : watched ? { ...watched, ...more } : more;
    const x = await startExperiment(island, change, question, from?.trackerId, link ? { ...opts, link } : opts);
    if (from) await countFromToday(from.trackerId, from.k);
    setRemindAt(bedHours ? beforeBed(bedtimeFrom(wake, bedHours)) : smartRemindTime(ideaKey, change));
    setStarted(x);
  };
  // what already runs on this island keeps running (Nov 8 2026), and isn't offered twice
  const runningHere = island && !started ? runningExperiments().filter((x) => x.island === island) : [];
  // the changes on the question's own topic (from a plan), or for what is hardest on the island lately (Nov 9 2026)
  // ideas two people do together are off while a partner-harm card is lit (Nov 9 2026)
  const pool = plan ? (source ? ideasForQuestion(source, homeHarmLit(trackers, entries)) : island ? ideasFor(island) : []) : island ? ideasForIsland(island, trackers, entries) : [];
  const planIdea = plan ? ideaOf(plan) : null;
  const busy = busyIdeas();
  // never a change her own answers say she already does (alreadyDoing.ts)
  const choices = [...(plan ? [PLAN] : []), ...pool.filter((k) => k !== planIdea && !busy.has(k) && !alreadyDoing(k, trackers, entries))];
  const label = (k: string) => (k === PLAN ? testNameOf(plan!) : t(`experiment.idea.${k}.change`));

  const result = useMemo(() => (mode === "result" && experiment ? experimentResult(experiment, trackers, entries) : null), [mode, experiment, trackers, entries]);
  const fromHome = (() => { const fr = trackers.find((x) => x.id === experiment?.from); return !!fr && HOME_HARM_IDS.has(templateIdOf(fr) ?? ""); })();
  // The result screen: a garden grew.
  useEffect(() => { if (result) { haptics.sparkle(); playSparkle(); } }, [result]);
  const finish = async (keep: boolean) => {
    if (!experiment) return;
    haptics.success();
    if (result) track("experiment_finished", { kept: keep, verdict: verdictOf(result), goal: !!experiment.same, did: result.did, overlap: overlapping(experiment).length > 0 });
    await finishExperiment(experiment.id, keep);
    // the reminder goes on, or stops, right away
    try { await scheduleNotification(getNotificationSettings()); } catch { /* next start */ }
    onClose();
  };

  return createPortal(
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex flex-col bg-background animate-fade-in">
      <div className="flex justify-end px-3 pt-[max(env(safe-area-inset-top),12px)]">
        <button type="button" onClick={onClose} aria-label={t("common.close")} className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground">
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto px-6 pb-10">
        <p className="flex items-center gap-1.5 text-[13px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">
          <FlaskConical className="h-4 w-4 text-[hsl(var(--coin-teal))]" strokeWidth={2.4} />{t("experiment.eyebrow")}
        </p>

        {mode === "pick" && !started && (
          <>
            <p className="mt-2 text-[26px] font-bold leading-tight tracking-tight">{t("experiment.ask", { count: EXPERIMENT_DAYS })}</p>
            {/* Which island (from an action point: that question's island only) */}
            <div className="-mx-6 mt-5 flex gap-2 overflow-x-auto px-6 scrollbar-hide">
              {islands.filter((isl) => !plan || isl.id === island).map((isl) => (
                <button key={isl.id} type="button" disabled={!!plan} onClick={() => { haptics.tap(); setIsland(isl.id); setIdea(null); }} aria-pressed={island === isl.id}
                  className={cn("chip has-icon", island === isl.id && "is-on")}>
                  <img src={mapPic("icon_" + isl.def.icon)} alt="" width={28} height={28} />
                  {islandName(t, isl.id)}
                </button>
              ))}
            </div>
            {/* Which change */}
            {island && (
              <div className="mt-4 space-y-2.5">
                {choices.map((k) => {
                  const on = idea === k;
                  return (
                    <button key={k} type="button" onClick={() => { haptics.tap(); setIdea(k); setOwn(""); }} aria-pressed={on}
                      className={cn("surface flex min-h-14 w-full items-center gap-3 rounded-2xl px-5 py-3 text-left text-[17px] outline-none transition-shadow duration-150 active:scale-[0.99]", on ? "pick-on font-bold" : "font-semibold")}>
                      <span className="min-w-0 flex-1">{label(k)}{k === PLAN && planDoing && <span data-already className="mt-0.5 block text-[14px] font-semibold text-muted-foreground">{t("rules.alreadyDoing", { k: planDoing.k, count: planDoing.n })}</span>}</span>
                      <span aria-hidden="true" className={cn("tick", on && "is-on")}>
                        {on && <Check className="h-4 w-4" strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })}
                <input value={own} onChange={(e) => { setOwn(e.target.value); setIdea(null); }} placeholder={t("experiment.own")} maxLength={60}
                  className={cn("h-14 w-full rounded-2xl border border-foreground/[0.14] bg-foreground/[0.04] px-5 text-[17px] outline-none", own.trim() && "pick-on")} />
              </div>
            )}
            <div className="mt-auto pt-8">
              {question ? (
                // what MeMap will ask every evening, before it starts
                <div className="mb-4 text-center">
                  <KindTag kind="question" extra={t(night && !watch ? "kind.nextEvening" : !watch && !goal && startedAfterAnswers ? "kind.fromTomorrow" : "kind.everyEvening")} className="justify-center" />
                  <p className="mt-0.5 text-[18px] font-bold leading-snug">{question}</p>
                  {goal && <p className="mt-1 text-[15px] font-bold text-[hsl(var(--coin-teal))]">{t("experiment.goal", { count: goal })}</p>}
                  {bedHours && (
                    <div data-wake className="surface mx-auto mt-4 flex w-full max-w-sm items-center gap-3 rounded-[18px] px-4 py-3 text-left">
                      <span className="min-w-0 flex-1 text-[16px] font-bold">{t("experiment.wakeAsk")}</span>
                      <input type="time" value={wake} onChange={(e) => setWake(e.target.value || "07:00")} aria-label={t("experiment.wakeAsk")}
                        className="h-10 w-[124px] rounded-[12px] bg-foreground/[0.05] px-2 text-center text-[15px] font-bold tabular-nums outline-none" />
                    </div>
                  )}
                  {bedHours && <p data-bed-at className="mt-2 text-[16px] font-bold text-[hsl(var(--coin-teal))]">{t("experiment.bedAt", { time: clockTime(bedtimeFrom(wake, bedHours)), hours: bedHours })}</p>}
                </div>
              ) : (
                <p className="mb-3 text-center text-[15px] font-medium text-muted-foreground">{t("experiment.how")}</p>
              )}
              {runningHere.length > 0 && (
                <p className="mb-3 rounded-2xl bg-foreground/[0.05] px-4 py-3 text-center text-[15px] font-semibold leading-snug text-muted-foreground">
                  {t("experiment.alsoRunning", { list: runningHere.map((x) => quotedTestName(x.change)).join(", ") })}
                </p>
              )}
              <Pressable tone="teal" haptic="none" onClick={start} disabled={!island || !change} className="h-[58px] w-full rounded-2xl" faceClassName="text-[16px] font-extrabold uppercase tracking-[0.06em]">
                {t("experiment.start")}
              </Pressable>
            </div>
          </>
        )}

        {mode === "pick" && started && (
          <div className="flex flex-1 flex-col items-center justify-center text-center animate-fade-in">
            {/* the island as it looks on her Map now (not the old flat picture) */}
            <span aria-hidden="true" className="block w-[180px]">
              <img className="art-day block w-full" src={art(artOf(started.island as IslandId, islandEvenings(trackers, entries).get(started.island as IslandId) ?? 0), false)} alt="" />
              <img className="art-night block w-full" src={art(artOf(started.island as IslandId, islandEvenings(trackers, entries).get(started.island as IslandId) ?? 0), true)} alt="" />
            </span>
            <p className="mt-4 text-[26px] font-bold leading-tight tracking-tight">{t("experiment.started")}</p>
            <p className="mt-2 text-[17px] font-medium text-muted-foreground">{t("experiment.startedLine", { island: islandName(t, started.island as IslandId), count: EXPERIMENT_DAYS })}</p>
            {/* Remind me? (board 65): a time that fits the change; one kind line a day */}
            <div className="surface mt-6 flex w-full max-w-sm items-center gap-3 rounded-[18px] px-4 py-3 text-left">
              <Bell className="h-5 w-5 shrink-0 text-[hsl(var(--coin-teal))]" strokeWidth={2.4} />
              <span className="min-w-0 flex-1 text-[16px] font-bold">{t("experiment.remindMe")}</span>
              <input type="time" value={remindAt} disabled={!remindOn} onChange={(e) => setRemindAt(e.target.value || "09:00")} aria-label={t("experiment.remindMe")}
                className="h-10 w-[124px] rounded-[12px] bg-foreground/[0.05] px-2 text-center text-[15px] font-bold tabular-nums outline-none disabled:opacity-40" />
              <button type="button" role="switch" aria-checked={remindOn} aria-label={t("experiment.remindMe")} onClick={() => { haptics.tap(); setRemindOn((v) => !v); }}
                className={`relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors ${remindOn ? "bg-[hsl(var(--coin-teal))]" : "bg-foreground/20"}`}>
                <span className={`absolute top-[3px] h-6 w-6 rounded-full bg-white transition-all ${remindOn ? "left-[23px]" : "left-[3px]"}`} />
              </button>
            </div>
            <Pressable tone="teal" haptic="none" onClick={() => void finishStart()} className="mt-6 h-[58px] w-full max-w-sm rounded-2xl" faceClassName="text-[16px] font-extrabold uppercase tracking-[0.06em]">
              {t("path.continue")}
            </Pressable>
          </div>
        )}

        {mode === "result" && experiment && result && (
          <>
            <KindTag kind="task" className="mt-3" />
            <p className="mt-0.5 text-[26px] font-bold leading-tight tracking-tight">{testNameOf(experiment.change)}</p>
            {/* a weekly goal: each week, and praise when it was met (Nov 8 2026); else the days, all 14 praised */}
            {experiment.perWeek && result.weeks ? (
              <>
                <p className="mt-1 text-[17px] font-medium text-muted-foreground">{t("experiment.weeksLine", { a: result.weeks[0], b: result.weeks[1], n: experiment.perWeek })}</p>
                {result.weeks.filter((k) => k >= experiment.perWeek!).length > 0 && (
                  <p className="mt-1 text-[17px] font-bold" style={{ color: "hsl(var(--balanced))" }}>{t(result.weeks.every((k) => k >= experiment.perWeek!) ? "experiment.goalBoth" : "experiment.goalOne")}</p>
                )}
              </>
            ) : (
              <p className="mt-1 text-[17px] font-medium text-muted-foreground">
                {result.did === EXPERIMENT_DAYS ? t("experiment.didAll", { count: EXPERIMENT_DAYS }) : t("experiment.didDays", { k: result.did, count: EXPERIMENT_DAYS })}
                {/* praise for the effort, never for the result (her pick A, Nov 11 2026) */}
                {result.did < EXPERIMENT_DAYS && praiseFor(t, result.did) && <>. <span data-praise className="praise-text font-bold">{praiseFor(t, result.did)}</span></>}
              </p>
            )}
            <div className="surface mt-5 rounded-[22px] px-5 py-4">
              <KindTag kind="finding" />
              {/* one human line first (her note, Nov 11 2026: "кажется прогулки помогают, вы стали меньше ссориться"),
                  its count under it; never "better / worse with it" about a partner shouting (Nov 9 2026) */}
              {(() => {
                const w = resultWords(t, experiment, result, trackers);
                return (
                  <>
                    {!fromHome && <p data-result-head className={w.human ? "mt-1.5 text-[20px] font-bold leading-snug" : "mt-1.5 text-[17px] font-bold leading-snug text-[hsl(var(--coin-teal))]"}>{w.head}</p>}
                    {!fromHome && w.count && <p data-result-count className="mt-1 text-[14px] font-semibold leading-snug text-muted-foreground">{w.count}</p>}
                    {(fromHome || !w.human) && w.most && <p data-result-most className="mt-2 text-[16px] font-semibold leading-snug">{w.most}</p>}
                  </>
                );
              })()}
              <div className="mt-3 border-t border-foreground/[0.07] pt-3">
                <p className="text-[14px] font-semibold text-muted-foreground">{t("experiment.hardOn", { island: islandName(t, experiment.island as IslandId) })}</p>
                {comparedBy(result) === "before" ? (
                  <>
                    <p className="mt-1 text-[17px] font-bold leading-snug">{t("experiment.duringIt", { k: result.during[0], count: result.during[1] })}</p>
                    <p className="mt-0.5 text-[15px] font-semibold leading-snug text-muted-foreground">{t("experiment.beforeIt", { k: result.before[0], count: result.before[1] })}</p>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-[17px] font-bold leading-snug">{t("experiment.withIt", { k: result.withChange[0], count: result.withChange[1] })}</p>
                    <p className="mt-0.5 text-[15px] font-semibold leading-snug text-muted-foreground">{t("experiment.withoutIt", { k: result.without[0], count: result.without[1] })}</p>
                  </>
                )}
              </div>
              {/* other changes at the same time: their effects mix into this one (Nov 8 2026) */}
              {experiment && overlapping(experiment).length > 0 && (
                <p className="mt-1.5 text-[14px] font-semibold leading-snug text-muted-foreground">{t("experiment.overlap", { list: overlapping(experiment).map((x) => quotedTestName(x.change)).join(", ") })}</p>
              )}
            </div>
            <div className="mt-5 flex items-center gap-4">
              <img src={mapPic("orange_tree")} alt="" width={64} height={56} className="object-contain" />
              <p className="text-[17px] font-semibold leading-snug">{t("experiment.garden", { island: islandName(t, experiment.island as IslandId) })}</p>
            </div>
            {/* "Keep going like this?" (her note, Nov 8 2026): yes keeps the question and the reminder;
                a test looked at again later only shows its result */}
            {!experiment.reviewed && <div className="mt-auto pt-8">
              <p className="text-[22px] font-bold leading-tight">{t("experiment.keepAsk")}</p>
              <p className="mt-1 text-[16px] font-semibold leading-snug text-muted-foreground">
                {experiment.perWeek
                  ? t(experiment.remind ? "experiment.keepGoalLine" : "experiment.keepGoalLineNoRemind", { n: experiment.perWeek, time: experiment.remind })
                  : t(experiment.remind ? "experiment.keepLine" : "experiment.keepLineNoRemind", { time: experiment.remind })}
              </p>
              <Pressable tone="teal" haptic="none" onClick={() => finish(true)} className="mt-4 h-[58px] w-full rounded-2xl" faceClassName="text-[16px] font-extrabold uppercase tracking-[0.06em]">
                {t("experiment.keepYes")}
              </Pressable>
              <button type="button" onClick={() => finish(false)} className="mt-1 h-12 w-full text-[16px] font-semibold text-muted-foreground">{t("experiment.keepNo")}</button>
            </div>}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};
