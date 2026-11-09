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
import { homeHarmLit, ideasForQuestion } from "@/lib/topicIdeas";
import { KindTag } from "./KindTag";
import { track } from "@/lib/analytics";
import { answerClause, answerPhrase, cap, templateIdOf } from "@/lib/answerPhrases";
import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Bell, Check, ChevronDown, ChevronRight, FlaskConical, RotateCcw } from "lucide-react";
import { cardQuestion } from "@/lib/cardText";
import { busyIdeas, clockTime, ideaOf, testNameOf, testQuestionOf, quotedTestName } from "@/lib/testWords";
import { getNotificationSettings, requestNotificationPermissionDetailed, scheduleNotification } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { ruleCount, ruleState, quietContext, type RuleState } from "@/lib/lighthouses";
import { ruleKeyOf } from "@/lib/rules";
import { isNeutralQuestion, isTestQuestion, islandName, islandOf, linkOf, linkWorthShowing, mapPic, type IslandId } from "@/lib/islands";
import { computeCorrelations } from "@/lib/correlations";
import { linkSentence, trackerLookup } from "@/lib/linkText";
import { getDoorState, isoLocal } from "@/lib/doors";
import { toast } from "@/hooks/use-toast";
import { HOME_HARM_IDS } from "@/lib/supportLines";
import { markActSeen } from "@/lib/pathSteps";
import { localizeTrackerAdvice, localizeTrackerTitle } from "@/lib/trackerLocalize";
import { answeredEvenings, countFromToday, patchTracker, planKindOf, SHAPING_EVENINGS } from "@/lib/actionPoints";
import { experimentDay, EXPERIMENT_DAYS, experimentOver, experimentResult, finishedExperiments, ideasFor, overlapping, runningExperiments, setExperimentRemind, smartRemindTime, keptExperiments, stopKept, testOnIsland, verdictOf, weekDone, type Experiment } from "@/lib/experiments";
import i18nInstance from "@/lib/i18n";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { RuleChips } from "@/components/RuleChips";
import { ExperimentSheet } from "@/components/ExperimentSheet";
import { SupportSheet } from "@/components/SupportSheet";

/** "I'll try": the week's test to start, for the screen that holds the sheets. */
export interface TryAction { island: IslandId; plan: string; trackerId: string; k: number }

const TEAL = "hsl(var(--coin-teal))";
// one line, never a two-line pill (RU «Посмотреть дни», Nov 9 2026)
const quietBtn = "quiet-btn w-full whitespace-nowrap px-3 text-[15px]";

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

/** A partner shouting or saying hurtful things (her question, Nov 9 2026: "что безопасно, но при этом разумно?";
 *  workflow with 19 sources): steps for the person, never a 2-week test, no before/after, the count doesn't
 *  start again (a step done is not "it got better"). The next step comes after one is done; telling the
 *  partner stays the last choice under "Not for me" (loveisrespect: it may not be safe). */
const HOME_STEPS: Record<string, string[]> = {
  "partner-raised-voice": ["rules.home.voicePlace", "rules.home.voiceTell"],
  "partner-said-hurtful": ["rules.home.hurtTell", "rules.home.hurtPartner"],
};
/** The step key of a plan text in either language (her plan text when it isn't one of the steps). */
const homeStepOf = (tid: string, plan: string): string =>
  (HOME_STEPS[tid] ?? []).find((key) => ["en", "ru"].some((lng) => i18nInstance.t(key, { lng }) === plan)) ?? plan;
/** Opens the afraid-at-home help sheet from a paused partner card. */
const HOME_STEPS_FIRST = "partner-raised-voice";
const HOME_DONE_KEY = "memap_home_steps";
const homeDone = (): Record<string, string[]> => { try { return JSON.parse(localStorage.getItem(HOME_DONE_KEY) ?? "{}"); } catch { return {}; } };
const markHomeDone = (id: string, plan: string) => {
  const all = homeDone();
  all[id] = [...new Set([...(all[id] ?? []), plan])];
  try { localStorage.setItem(HOME_DONE_KEY, JSON.stringify(all)); } catch { /* the card just won't say "done" */ }
};

/** After "I did it": the window before it and the days since (from 7 days on). */
const beforeAfter = (tr: Tracker, entries: TrackerEntry[]): { k1: number; n1: number; k2: number; n2: number } | null => {
  const last = tr.cycles?.[tr.cycles.length - 1];
  if (!last || !tr.cycleStartDate) return null;
  const since = Math.round((new Date(isoLocal(new Date()) + "T12:00:00").getTime() - new Date(tr.cycleStartDate + "T12:00:00").getTime()) / 86_400_000) + 1;
  if (since < 7) return null;
  // a partner's shouting is not "better or worse since you did it" (Nov 9 2026)
  if (HOME_HARM_IDS.has(templateIdOf(tr) ?? "")) return null;
  // both sides in her answers, not the calendar (review, Nov 9 2026: "before: 4 of 30 days, since then: 2 of your
  // 10 answers" read as worse when it was better)
  const s = ruleState(tr, entries);
  const b = ruleState({ ...tr, cycleStartDate: last.startDate }, entries, new Date(last.endDate + "T12:00:00"));
  if (s.n === 0 || b.n === 0) return null;
  return { k1: b.k, n1: b.n, k2: s.k, n2: s.n };
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
  /** a link's first question, when it's that question's hard answer and it has a plan: a cause to test.
   *  Only an everyday habit to try for 2 weeks (persona walks, Nov 9 2026: "Possible cause: anxiety — Talk to a
   *  therapist — I did it" read like a therapy checkbox, "feeling drained — See a GP" sat on a sleep card), and
   *  never one whose test she already finished and dropped ("it told me this isn't mine, and offers it again"). */
  const dropped = new Set(finishedExperiments().filter((x) => !x.kept && x.from).map((x) => x.from as string));
  const causeOf = (tr: Tracker) => linksInto(tr).map((l) => l.first).find((c, i) => {
    const l = linksInto(tr)[i];
    return !isNeutralQuestion(c) && !c.archived && !!c.adviceAboveThreshold && l.firstYes === (c.problemWhen === "yes")
      && planKindOf(c) === "daily" && !dropped.has(c.id);
  }) ?? null;
  const [trying, setTrying] = useState<TryAction | null>(null);
  // "Need to talk?" from a partner-harm card
  const [supportFor, setSupportFor] = useState<string | null>(null);
  const [homeTick, setHomeTick] = useState(0);
  const couplesOff = homeHarmLit(trackers, entries);
  const door = getDoorState();
  const rows = trackers
    .filter((tr) => !tr.archived && tr.threshold > 0)
    .map((tr) => { const st = ruleState(tr, entries); return { tr, k: st.k, st }; })
    .map((r) => ({ ...r, lit: r.k >= r.st.need && !quietContext(r.tr) }));
  const stateOf = new Map<string, RuleState>(rows.map((r) => [r.tr.id, r.st]));
  // her topics first, then the most crossed (persona walks, Nov 9 2026)
  const leadRank = (id: string) => (id === door?.trackerId ? 0 : (door?.extra ?? []).some((x) => x.trackerId === id) ? 1 : 2);
  const lit = rows.filter((r) => r.lit).sort((a, b) => leadRank(a.tr.id) - leadRank(b.tr.id) || b.k / b.st.need - a.k / a.st.need);
  const evenings = answeredEvenings(trackers, entries);
  const allWatching = rows.filter((r) => !r.lit).sort((a, b) => b.k / b.st.need - a.k / a.st.need);
  // the first week: only her topic's rules, not a wall of "0 of the last 30 days" (QA, Nov 8 2026)
  const mainIds = new Set(door ? [door.trackerId, ...(door.extra ?? []).map((x) => x.trackerId)] : []);
  const watching = evenings < SHAPING_EVENINGS && allWatching.length > 1
    ? (allWatching.some((r) => mainIds.has(r.tr.id)) ? allWatching.filter((r) => mainIds.has(r.tr.id)) : allWatching.slice(0, 1))
    : allWatching;
  // three lit cards at most, the rest behind "more"; the calm rules folded into one line
  // opening this sheet counts as seeing what is lit: the Today step won't ask again for the same rules
  const litKey = lit.map((r) => r.tr.id).join(",");
  useEffect(() => { if (litKey) markActSeen(litKey.split(",")); }, [litKey]);
  const [allLit, setAllLit] = useState(false);
  const [calmOpen, setCalmOpen] = useState(false);
  const litShown = allLit ? lit : lit.slice(0, 3);
  const litMore = Math.max(0, lit.length - 3);
  /** One number for one fact, the same on the card and in the list: "6 of the last 14 days." The headline or
   *  the row's name says what (persona walks, Nov 9 2026: "“No” on 8 of 14" under "You often sleep under 7 hours"
   *  was a No that meant yes; "of your first 22 days" — first since when?). Her days so far when she began
   *  later or after "I did it"; with days not answered, her answers ("4 of your 6 answers in the last 14 days"):
   *  the days she answered are what count (answered-days rule, lighthouses.ts). */
  const evidence = (tr: Tracker, k: number) => {
    const s = stateOf.get(tr.id) ?? ruleState(tr, entries);
    if (!s.gaps) return t(s.soFar ? "rules.evidenceSoFar" : "rules.evidence", { k, count: s.soFar ? s.days : tr.periodDays });
    return s.soFar ? t("rules.answersSoFar", { k, count: s.n }) : `${t("rules.answersOf", { k, count: s.n })} ${t("rules.inLast", { count: tr.periodDays })}.`;
  };
  // a question onboarding added (not hers) never says "time to act at…" over a count it has passed
  const watchLine = (tr: Tracker, k: number) => {
    const s = stateOf.get(tr.id) ?? ruleState(tr, entries);
    const at = quietContext(tr) ? t("rules.notYourTopic")
      : s.gaps && s.byAnswers && s.need <= s.n ? t("rules.actAtAnswers", { n: s.need, count: s.n })
      : t("rules.actAt", { n: tr.threshold, count: tr.periodDays });
    return `${evidence(tr, k)} ${at}`;
  };
  /** the question under the plan; a good one is counted when it's missing */
  // the hard answer in its own words (answerPhrases): "Short night", not «Без «Спал(а) 7+ часов»»
  const label = (tr: Tracker) => cap(answerPhrase(t, tr, tr.problemWhen === "yes"));
  const why = (tr: Tracker, k: number) => {
    const s = stateOf.get(tr.id);
    // with days not answered: the card's own words (review, Nov 9 2026)
    if (s?.gaps) return `${evidence(tr, k)} ${k >= s.need ? t("rules.whyEnough") : ""}`.trim();
    return t("rules.why", { ans: t(tr.problemWhen === "yes" ? "rules.ansYes" : "rules.ansNo"), k, n: tr.threshold, count: tr.periodDays });
  };
  // The tests running now, side by side (Nov 7 2026); with one island picked, only that island's
  // (QA, Nov 8 2026: tests from other islands stayed on top of the Health filter)
  const islandsHere = new Set(trackers.map((tr) => islandOf(tr) as string));
  const tests = runningExperiments().filter((x) => islandsHere.has(x.island) || trackers.some((tr) => tr.id === x.trackerId));
  const lineOf = (x: Experiment) => { const d = experimentDay(x); return d > EXPERIMENT_DAYS ? t("rules.testDone") : t("rules.testing", { k: d, count: EXPERIMENT_DAYS }); };
  const [testOpen, setTestOpen] = useState<Experiment | null>(null);
  // a finished test opens its result here (QA: "Your test is done: see it on Today" led nowhere)
  const [resultOf, setResultOf] = useState<Experiment | null>(null);
  const openTest = (x: Experiment) => { haptics.tap(); if (experimentOver(x)) setResultOf(x); else setTestOpen(x); };
  // a word that it worked, and what happens next (QA, Nov 8 2026: the card just moved away)
  const didOnce = async (tr: Tracker, k: number) => { haptics.success(); await countFromToday(tr.id, k, { planKind: "once" }); toast({ title: t("rules.didToast"), description: t("rules.didToastLine") }); };
  // a partner-harm step: noted, no praise; on "partner raised their voice" the next step becomes the task
  // (telling the partner, the last choice on "hurtful words", is never offered as a next step)
  const didHome = async (tr: Tracker, tid: string) => {
    haptics.tap();
    const step = homeStepOf(tid, planOf(tr));
    markHomeDone(tr.id, step);
    const done = homeDone()[tr.id] ?? [];
    const nextKey = tid === "partner-raised-voice" ? (HOME_STEPS[tid] ?? []).find((key) => key !== step && !done.includes(key)) : undefined;
    if (nextKey) await patchTracker(tr.id, (x) => ({ ...x, adviceAboveThreshold: t(nextKey), planKind: "once" }));
    setHomeTick((n) => n + 1);
    toast({ title: t("rules.homeToast") });
  };
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
        // never "Nothing to do now" over a partner who shouted or said hurtful things (persona walk, Nov 9 2026)
        // with calm rules, the folded line below says it ("Nothing to act on now. 5 rules are calm")
        watching.length === 0 && <p className="surface rounded-[22px] px-5 py-4 text-[18px] font-bold">{t("rules.nothingNow")}</p>
      ))}

      {/* What needs her now, folded (her ask + the GPT brief, Nov 9 2026: "непонятное и слишком много
          всего"): a card shows the island, what MeMap noticed in one line and the days behind it; a tap
          opens the small step, how it goes and one button. One card open at a time; her main topic first;
          three at most, the rest behind "more". */}
      {lit.length > 0 && <p className="px-1 pt-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("rules.timeToAct")}</p>}
      {litShown.map(({ tr, k }) => {
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
        const tid = templateIdOf(tr) ?? "";
        const home = HOME_HARM_IDS.has(tid);
        const homeDid = home && homeTick >= 0 && (homeDone()[tr.id] ?? []).includes(homeStepOf(tid, plan));
        // while a partner shouts or says hurtful things, no partner card asks for something together (review, Nov 9
        // 2026: "Book a couples therapist" stayed on; the Hotline and Gottman: not where there may be abuse)
        const partnerPaused = couplesOff && !home && tr.subcategory === "Partner";
        return (
          <div key={tr.id} className="surface scroll-mt-4 rounded-[22px] px-4 pb-4 pt-3.5">
            {/* where it is and what MeMap noticed, small; a tap opens the details (her note, Nov 9 2026: "главная
                мысль у нас в действии, а сейчас бОльшими буквами написан вывод") */}
            <button type="button" aria-expanded={opened} onClick={(e) => {
              haptics.tap();
              const card = e.currentTarget.parentElement;
              setOpenCards((l) => (l.includes(tr.id) ? [] : [tr.id]));
              // the opened card comes into view (persona walk: opening the migraine card left it below the fold)
              if (!opened) window.setTimeout(() => card?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
            }}
              className="flex w-full items-start gap-2.5 text-left">
              <img src={mapPic("lighthouse")} alt="" width={24} height={29} className="mt-0.5 h-[29px] w-6 shrink-0 object-contain drop-shadow-[0_0_6px_hsl(44_96%_60%/0.7)]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{islandName(t, islandOf(tr))}</span>
                {/* what MeMap noticed, in her answer's words, then the days behind it (one number for one fact) */}
                <span className="mt-0.5 block text-[15px] font-semibold leading-snug text-foreground/80">{cap(answerClause(t, tr, hardYes, "result", t("rules.often")))}</span>
                <span className="block text-[13px] font-semibold leading-snug text-muted-foreground">{evidence(tr, k)}</span>
              </span>
              <ChevronDown className={cn("mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform", opened && "rotate-180")} strokeWidth={2.4} />
            </button>
            {/* the action is the main thing: the task big, its button right under it, without opening the card */}
            {partnerPaused ? (
              <p className="mt-3 text-[17px] font-bold leading-snug">{t("rules.partnerPaused")}</p>
            ) : plan ? (
              <div className="mt-3">
                <KindTag kind="task" />
                <p className="mt-0.5 text-[21px] font-bold leading-snug tracking-tight">{plan}</p>
              </div>
            ) : null}
            {partnerPaused ? (
              <button type="button" onClick={() => { haptics.tap(); setSupportFor(HOME_STEPS_FIRST); }} className="raised-btn is-small mt-3.5 w-full justify-center">{t("support.chip")}</button>
            ) : home && plan ? (
              homeDid ? (
                <p className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-foreground/[0.05] px-3.5 py-2.5 text-[15px] font-bold text-muted-foreground">
                  <Check className="h-5 w-5" strokeWidth={2.6} />{t("rules.homeDone")}
                </p>
              ) : (
                <button type="button" onClick={() => void didHome(tr, tid)} className="raised-btn is-small mt-3.5 w-full justify-center"><Check className="h-5 w-5" strokeWidth={2.6} /> {t("rules.doneOnce")}</button>
              )
            ) : !plan ? (
              <button type="button" onClick={() => open(tr.id, "change")} className="raised-btn is-small mt-3.5 w-full justify-center">{t("rules.noPlan")}</button>
            ) : once ? (
              // a one-off plan: mark it done; then MeMap compares before and after
              <button type="button" onClick={() => void didOnce(tr, k)} className="raised-btn is-small mt-3.5 w-full justify-center"><Check className="h-5 w-5" strokeWidth={2.6} /> {t("rules.doneOnce")}</button>
            ) : blocked ? (() => {
              // one test per island: this one waits, and says why; a finished one opens its result
              const isle = ownTest ?? null;
              return isle && experimentOver(isle) ? (
                <button type="button" onClick={() => openTest(isle)} className="raised-btn is-small mt-3.5 w-full justify-center gap-2"><FlaskConical className="h-5 w-5" strokeWidth={2.4} /> {t("rules.seeTest")}</button>
              ) : (
                <p className="mt-3 flex items-center gap-2 rounded-2xl bg-foreground/[0.05] px-3.5 py-2.5 text-[14px] font-semibold leading-snug text-muted-foreground">
                  <FlaskConical className="h-4 w-4 shrink-0" strokeWidth={2.4} />
                  {blocked}
                </p>
              );
            })() : (
              <button type="button" onClick={() => tryIt(tr, k)} className="raised-btn is-small mt-3.5 w-full justify-center">{t("rules.tryDaily")}</button>
            )}
            {/* a free helpline and the emergency words, one tap away on these two cards */}
            {home && <button type="button" onClick={() => { haptics.tap(); setSupportFor(tid); }} className={cn(quietBtn, "mt-2")}>{t("support.chip")}</button>}
            {opened && (
            <div className="animate-fade-in">
            {/* how it goes */}
            {plan && !partnerPaused && <p className="mt-3 text-[15px] font-semibold leading-snug text-muted-foreground">{home ? t("rules.suggestHome") : once ? t("rules.suggestOnce") : t("rules.suggestDaily", { count: EXPERIMENT_DAYS, q: testQuestionOf(tr.adviceAboveThreshold) })}</p>}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => open(tr.id, "show")} className={quietBtn}>{t("rules.show")}</button>
              <button type="button" onClick={() => open(tr.id, "change")} className={quietBtn}>{t("rules.notForMe")}</button>
            </div>
            {/* what comes with it in her days, and the possible cause (Nov 8 2026): one quiet block, its button
                plain so it doesn't compete with the main one. Never on a partner-harm card: her own habits are
                not the cause of being shouted at (Refuge; Nov 9 2026) */}
            {!home && linksInto(tr).length > 0 && (() => {
              const cause = causeOf(tr);
              const causeTest = cause ? tests.find((x) => x.from === cause.id) : undefined;
              return (
                <div className="mt-4 border-t border-foreground/[0.07] pt-3.5">
                  <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("rules.comesWith")}</p>
                  {linksInto(tr).map((l) => (
                    <p key={l.first.id} className="mt-1 text-[15px] font-semibold leading-snug">
                      {linkSentence(t, { first: l.first.id, second: l.second.id, firstYes: l.firstYes, secondYes: l.secondYes, nextDay: l.nextDay, k: l.k, n: l.n }, of)}
                    </p>
                  ))}
                  {cause && (
                    <>
                      <p className="mt-3 text-[14px] font-semibold text-muted-foreground">{t("rules.causeHead")} <span className="font-bold text-foreground">{answerPhrase(t, cause, cause.problemWhen === "yes")}</span></p>
                      <p className="mt-0.5 text-[16px] font-semibold leading-snug">{planOf(cause)}</p>
                      {causeTest && !experimentOver(causeTest) ? (
                        <p className="mt-2 flex items-center gap-2 text-[14px] font-semibold leading-snug text-muted-foreground">
                          <FlaskConical className="h-4 w-4 shrink-0" strokeWidth={2.4} />{t("rules.testing", { k: experimentDay(causeTest), count: EXPERIMENT_DAYS })}
                        </p>
                      ) : (
                        <button type="button" onClick={() => tryIt(cause, ruleCount(cause, entries))} className={cn(quietBtn, "mt-2.5 w-full")}>{t("rules.tryDaily")}</button>
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
      {litMore > 0 && (
        <button type="button" onClick={() => { haptics.tap(); setAllLit((v) => !v); }} className={cn(quietBtn, "w-full")}>
          {allLit ? t("rules.fewer") : t("rules.moreLit", { count: litMore })}
        </button>
      )}

      {/* The tests she is trying now: one quiet list under what needs her (her note, Nov 9 2026: three big
          test cards pushed "Time to act" off the first screen) */}
      {tests.length > 0 && <p className="px-1 pt-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("rules.testsNow")}</p>}
      {tests.length > 0 && (
        <div className="surface divide-y divide-foreground/[0.06] rounded-[22px]">
          {tests.map((test) => (
            <button key={test.id} type="button" onClick={() => openTest(test)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
              <FlaskConical className="h-5 w-5 shrink-0" style={{ color: TEAL }} strokeWidth={2.4} />
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-bold leading-snug">{testNameOf(test.change)}</span>
                <span className="block text-[14px] font-semibold" style={{ color: TEAL }}>{lineOf(test)}{test.perWeek ? ` · ${t("experiment.weekOf", { k: weekDone(test, entries), n: test.perWeek })}` : ""}</span>
                {!experimentOver(test) && <span className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-muted-foreground"><Bell className="h-3.5 w-3.5" strokeWidth={2.4} />{test.remind ? `${t("experiment.remindAt")} ${clockTime(test.remind)}` : t("experiment.noRemind")}</span>}
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={2.4} />
            </button>
          ))}
        </div>
      )}
      {/* the rules not reached yet: one line, opened on tap (persona walks, Nov 9 2026: a wall of
          "0 of the last 30 days" under "Nothing to act on now") */}
      {watching.length > 0 && (
        <>
          <button type="button" aria-expanded={calmOpen} onClick={() => { haptics.tap(); setCalmOpen((v) => !v); }}
            className="surface flex w-full items-center gap-3 rounded-[22px] px-4 py-3.5 text-left">
            <span className="min-w-0 flex-1 text-[16px] font-semibold leading-snug">{t(lit.length || watching.some((r) => r.k > 0 && HOME_HARM_IDS.has(templateIdOf(r.tr) ?? "")) ? "rules.calmMore" : "rules.calmAll", { count: watching.length })}</span>
            <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", calmOpen && "rotate-180")} strokeWidth={2.4} />
          </button>
          {calmOpen && (
          <div className="surface divide-y divide-foreground/[0.06] rounded-[22px] animate-fade-in">
            {watching.map(({ tr, k }) => {
              const mineTest = tests.find((x) => x.from === tr.id);
              const ba = beforeAfter(tr, entries);
              return (
                <button key={tr.id} type="button" onClick={() => open(tr.id, "show")} className="block w-full px-4 py-3 text-left">
                  <span className="line-clamp-2 block text-[16px] font-semibold leading-snug">{label(tr)}</span>
                  {mineTest ? (
                    <span className="mt-0.5 flex items-center gap-1 text-[14px] font-medium leading-snug" style={{ color: TEAL }}>
                      <FlaskConical className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />{lineOf(mineTest)}
                    </span>
                  ) : (
                    <span className="mt-0.5 block text-[14px] font-medium leading-snug text-muted-foreground">{watchLine(tr, k)}</span>
                  )}
                  {ba && <span className="mt-1 block text-[13px] font-bold" style={{ color: TEAL }}>{t("rules.beforeAfter", { ...ba, count: ba.n2 })}</span>}
                </button>
              );
            })}
          </div>
          )}
        </>
      )}

      {current && sheet?.mode === "show" && (
        <ShowSheet key={current.tr.id} tracker={current.tr} k={current.k} st={current.st} entries={entries} name={cardQuestion(current.tr)} onClose={() => setSheet(null)}
          onTry={() => tryIt(current.tr, current.k)} blocked={(() => { const o = tests.find((x) => x.from === current.tr.id && !experimentOver(x)); return o ? t("rules.testing", { k: experimentDay(o), count: EXPERIMENT_DAYS }) : null; })()} />
      )}
      {current && sheet?.mode === "change" && (
        <ChangeSheet key={current.tr.id} tracker={current.tr} k={current.k} couplesOff={couplesOff} name={cardQuestion(current.tr)} why={why(current.tr, current.k)} onClose={() => setSheet(null)} />
      )}
      {testOpen && <TestSheet test={testOpen} trackers={trackers} entries={entries} line={lineOf(testOpen)} onClose={() => setTestOpen(null)} />}
      <SupportSheet open={!!supportFor} onClose={() => setSupportFor(null)} about={supportFor} />
      {resultOf && <ExperimentSheet mode="result" experiment={resultOf} trackers={trackers} entries={entries} onClose={() => setResultOf(null)} />}
      {trying && (
        <ExperimentSheet mode="pick" island={trying.island} plan={trying.plan} from={{ trackerId: trying.trackerId, k: trying.k }}
          trackers={trackers} entries={entries} onClose={() => setTrying(null)} />
      )}
    </div>
  );
};

/** "Show": the days behind an action point, then her plan and rule to change. */
const ShowSheet = ({ tracker, k, st, entries, name, onClose, onTry, blocked }: { tracker: Tracker; k: number; st: RuleState; entries: TrackerEntry[]; name: string; onClose: () => void; onTry: () => void; blocked: string | null }) => {
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
  const lit = tracker.threshold > 0 && k >= st.need;
  // a partner shouting or saying hurtful things: the card's own "I did it" (review, Nov 9 2026: this sheet still
  // offered "Try it for 2 weeks" and a count restart)
  const home = HOME_HARM_IDS.has(templateIdOf(tracker) ?? "");
  return (
    <BottomSheet open onOpenChange={(o) => { if (!o) close(); }} className="h-auto max-h-[88vh]" ariaTitle={t("rules.title")}>
      <div className="flex min-h-0 flex-1 flex-col space-y-5 overflow-y-auto px-5 pb-8">
        <div className="pr-10 pt-1">
          {/* the question is the title (her note: "непонятно, к какому вопросу это действие") */}
          <KindTag kind="question" />
          <p className="mt-0.5 text-[24px] font-bold leading-tight tracking-tight">{name}</p>
          <KindTag kind="finding" className="mt-3" />
          <p className="mt-0.5 text-[19px] font-bold tabular-nums">
            {lit
              ? t("rules.bigDone", { k, count: tracker.periodDays, ans: t(tracker.problemWhen === "yes" ? "rules.ansYes" : "rules.ansNo") })
              : t("rules.bigOf", { k, count: st.need, ans: t(tracker.problemWhen === "yes" ? "rules.ansYes" : "rules.ansNo") })}
          </p>
          <p className="mt-1 text-[15px] font-medium leading-snug text-muted-foreground">{t("rules.ruleLine", { n: tracker.threshold, count: tracker.periodDays })}</p>
          {/* days with no answer don't count: what it takes now (answered-days rule, Nov 9 2026) */}
          {st.gaps && st.byAnswers && st.need < tracker.threshold && st.need <= st.n && (
            <p className="mt-1 text-[15px] font-medium leading-snug text-muted-foreground">{t("rules.gapsLine", { n: st.need, count: st.n })}</p>
          )}
          {ba && <p className="mt-2 text-[15px] font-bold" style={{ color: TEAL }}>{t("rules.beforeAfter", { ...ba, count: ba.n2 })}</p>}
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
          <KindTag kind="task" />
          <textarea value={plan} onChange={(e) => setPlan(e.target.value)} rows={2} maxLength={120} placeholder={t("rules.planPh")}
            className="w-full resize-none rounded-2xl border border-foreground/[0.12] bg-foreground/[0.04] px-4 py-3 text-[18px] font-semibold leading-snug outline-none focus:ring-2 focus:ring-[hsl(var(--coin-teal))]" />
          {/* once (then before and after) or every day (a 2-week test) */}
          {!home && <>
          <div className="grid grid-cols-2 gap-2">
            {(["once", "daily"] as const).map((kd) => (
              <button key={kd} type="button" onClick={() => { haptics.tap(); setKind(kd); }} aria-pressed={kind === kd}
                className={cn("h-11 rounded-full text-[15px] font-bold", kind === kd ? "surface pick-on" : "bg-foreground/[0.05] text-muted-foreground")}>
                {t(kd === "once" ? "rules.kindOnce" : "rules.kindDaily")}
              </button>
            ))}
          </div>
          <p className="text-[13px] font-semibold leading-snug text-muted-foreground">{t(kind === "once" ? "rules.kindOnceLine" : "rules.kindDailyLine")}</p>
          </>}
        </div>
        {limitOpen ? (
          <RuleChips hard={tracker.problemWhen !== "no"} value={ruleKeyOf(rule)} customLabel={t("rules.custom", { n: rule.threshold, count: rule.periodDays })}
            onChange={(_, r) => setRule(r)} plan={plan} onPlan={setPlan} showPlan={false} />
        ) : (
          <button type="button" onClick={() => { haptics.tap(); setLimitOpen(true); }} className="quiet-btn h-11 w-full text-[15px]">{t("rules.changeLimit")}</button>
        )}
        {lit && !home && kind === "once" && (
          <button type="button" onClick={did} className="raised-btn w-full justify-center"><Check className="h-5 w-5" strokeWidth={2.6} /> {t("rules.doneOnce")}</button>
        )}
        {lit && !home && kind === "daily" && (blocked
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
        <KindTag kind="task" className="mt-3" />
        <p className="mt-0.5 pr-10 text-[26px] font-bold leading-tight tracking-tight">{testNameOf(test.change)}</p>
        <p className="mt-1 text-[16px] font-bold" style={{ color: TEAL }}>{line}</p>
        {test.perWeek && <p className="mt-0.5 text-[16px] font-bold">{t("experiment.weekOf", { k: weekDone(test, entries), n: test.perWeek })}</p>}
        <KindTag kind="question" extra={t("kind.everyEvening")} className="mt-5" />
        <p className="mt-0.5 text-[19px] font-bold leading-snug">{tr ? cardQuestion(tr) : testQuestionOf(test.change)}</p>
        <div className="surface mt-5 flex items-center gap-3 rounded-[18px] px-4 py-3">
          <Bell className="h-5 w-5 shrink-0" strokeWidth={2.4} style={{ color: TEAL }} />
          <span className="min-w-0 flex-1 whitespace-nowrap text-[16px] font-bold">{t("experiment.remindMe")}</span>
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
    track("experiment_stopped", { goal: !!x.same });
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
            {/* a finished test has no reminder to speak of (QA, Nov 8 2026) */}
            {!experimentOver(x) && <span className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-muted-foreground">
              <Bell className="h-3.5 w-3.5" strokeWidth={2.4} />{x.remind ? `${t("experiment.remindAt")} ${clockTime(x.remind)}` : t("experiment.noRemind")}
            </span>}
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
              // every row opens: a kept one to change or stop it, one tried before to its result (QA, Nov 8 2026)
              return (
                <div key={x.id} className="px-4 py-3" role="button" tabIndex={0} onClick={() => { haptics.tap(); if (x.kept) setOpen(x); else onResult(x); }}>
                  <p className="text-[16px] font-bold leading-snug">{testNameOf(x.change)}</p>
                  {/* kept going: since when, and its reminder (opens to change or stop it) */}
                  {x.kept && (
                    <p className="mt-0.5 flex items-center gap-1 text-[14px] font-bold" style={{ color: TEAL }}>
                      {lineOf(x)}<span className="font-semibold text-muted-foreground">{" · "}</span><Bell className="h-3.5 w-3.5" strokeWidth={2.4} />{x.remind ? clockTime(x.remind) : t("experiment.noRemind")}
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
const ChangeSheet = ({ tracker, name, why, onClose, couplesOff }: { tracker: Tracker; k: number; name: string; why: string; onClose: () => void; couplesOff?: boolean }) => {
  const { t } = useTranslation();
  const had = planOf(tracker);
  // changes on this question's own topic (her note, Nov 9 2026: the island's ones were about other things);
  // a partner shouting or saying hurtful things: its own steps, telling the partner last
  const busy = busyIdeas();
  const homeSteps = HOME_STEPS[templateIdOf(tracker) ?? ""];
  const ideas = (homeSteps ? homeSteps.map((key) => t(key)) : ideasForQuestion(tracker, couplesOff).filter((id) => !busy.has(id)).map((id) => t(`experiment.idea.${id}.change`))).filter((s) => s !== had);
  const [pick, setPick] = useState<string | null>(null);
  const [own, setOwn] = useState("");
  const next = pick ?? own.trim();
  const save = async () => {
    if (!next) return;
    haptics.success();
    await patchTracker(tracker.id, (x) => ({ ...x, adviceAboveThreshold: next, ...(homeSteps ? { planKind: "once" as const } : {}) }));
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
          <KindTag kind="question" />
          <p className="mt-0.5 text-[16px] font-bold leading-snug">{name}</p>
          <KindTag kind="finding" className="mt-3" />
          <p className="mt-0.5 text-[15px] font-semibold leading-snug">{why}</p>
          <KindTag kind="task" className="mt-5" />
          <p className="mt-0.5 text-[24px] font-bold leading-tight tracking-tight">{t(had ? "rules.instead" : "rules.plan")}</p>
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
