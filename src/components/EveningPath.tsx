// Today's path: a light per step again (her note, Nov 4 2026: "вернуть ступени …
// кружочек посвящён какой-то ступени … слегка объёмные, как на Duolingo, с нашими
// иконками"). Each step is a raised disc with its icon and its name under it;
// over hers a Start bubble; the week ends in its report, not a chest ("это не
// подарок"). Her sea stands still behind; no line between the steps.
// Earlier: (Aurora UX; steps not evenings, Nov 2 2026). Since her
// reference picture ("вот так получше будет"): flat round nodes with a plain
// line icon, a white pill label growing out of each to the right, the
// current step's pill holding its "Start" button, a calm dashed road, a white
// week card with a progress bar; her day/night picture behind (Nov 3 2026).
// Past days of the week come first, then today's steps (a missed day, one
// per topic, a task, the "Guess" game), then the coming days and the reward.
// Nov 2 2026 (her: "при нажатии шага сразу делать действие"): tapping a step
// to do starts it at once; only a done step or day asks first (change
// answers). The note step opens the note sheet right here.
// Plan: marketing/aurora-light-ux/MASTERPIECE-PLAN.md (top notes).
import { ObserveTipSheet } from "@/components/ObserveTipSheet";
import { OBSERVE_TIPS } from "@/lib/observeTipsData";
import { TipCard, markTip as markTipSeen, maluPic, tipSeen, todayTourOver } from "./Tips";
import { PLAYFUL_ASK_AT, markPlayfulAsked, playfulAsked, setPlayful, usePlayful } from "@/lib/playful";
import { switchToOld } from "./UpgradeInvite";
import { SupportSheet } from "./SupportSheet";
import { HEAVY_MOOD_IDS, HOME_HARM_IDS } from "@/lib/supportLines";
import { templateIdOf as moodTemplateOf } from "@/lib/answerPhrases";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, BarChart3, CalendarDays, Check, ChevronDown, ChevronRight, ChevronUp, Compass, FileBarChart2, Flag, FlaskConical, Flame, Layers, Lightbulb, Link2, Wind, Map as MapIcon, MessageCircleQuestion, MoonStar, PenLine, Plus, Sparkles, Sprout, type LucideIcon, BookOpen } from "lucide-react";
import { ReasonSheet, type ReasonItem } from "@/components/ReasonSheet";
import { markAsked, pendingReasons, reasonKey, reasonName } from "@/lib/reasons";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { playWheelTick, preloadSounds } from "@/lib/feedback";
import { isoDay } from "@/lib/eveningPath";
import { DAYS_PER_WEEK, LINKS_AT, countedDays, getChests, markActSeen, markFillDay, pathModel, questionGroups, skipTask, unskipTask, syncTasks, unloadPlayedToday, type Step, type TaskId } from "@/lib/pathSteps";
import { tipFor, tipTopicOf } from "@/lib/observeTips";
import { answerPhrase } from "@/lib/answerPhrases";
import { cardQuestion } from "@/lib/cardText";
import { reasonTemplate } from "@/lib/reasons";
import { buildIslands, buildRoutes, LINKS_TOP } from "@/lib/islands";
import { ITEMS, itemProgress, owned, worldFacts, type ItemId } from "@/lib/growth";
import { ExperimentSheet } from "@/components/ExperimentSheet";
import { UnloadGame } from "@/components/UnloadGame";
import { currentExperiment, experimentDay, experimentOver, EXPERIMENT_DAYS, runningExperiments } from "@/lib/experiments";
import { testNameOf } from "@/lib/testWords";
import { computeCorrelations } from "@/lib/correlations";
import { linkWorthShowing } from "@/lib/islands";
import { litTrackers, needOf } from "@/lib/lighthouses";
import { isHardAnswer, isNeutralQuestion, islandDef, islandName, islandOf, mapPicFor, type IslandId } from "@/lib/islands";
import { art, artOf, islandEvenings, stageOf, toNextStage } from "@/lib/globeArt";
import { islandHsl } from "@/lib/islandColors";
import { NoteSheet, newDraft, type NoteDraft } from "@/components/NoteSheet";
import { getDoorState, isoLocal } from "@/lib/doors";
import { getNotificationSettings } from "@/lib/notifications";
import { getNotes } from "@/lib/notes";
import { DAY_AHEAD, LightLabel, PathNode, QuietLine, R_CHEST, R_CURRENT, R_DAY, R_STEP, StartBubble, WEEK_TITLES, WeekStrip, islandIcon, weekStops, type NodeLook } from "@/components/PathParts";
import { WeekChest } from "@/components/WeekChest";
import { HunchGame } from "@/components/HunchGame";
import { hunchTarget, readyHunch } from "@/lib/hunches";
import { avatarUrl, getAvatar } from "@/lib/avatar";
import { Tracker, TrackerEntry, askedOn } from "@/types/tracker";
import { track, onbVariant } from "@/lib/analytics";
import { markLinksSeen } from "@/lib/newLinks";
import { pairOf } from "@/lib/findingForms";
import { reopenLink } from "./FindingsView";

const PATH_MAX = 440;
type Rect = { x: number; y: number; w: number; h: number };

const TASK_ICON: Record<TaskId, LucideIcon> = {
  note: PenLine,
  calendar: CalendarDays,
  ownQuestion: Plus,
  chart: BarChart3,
  map: MapIcon,
  newIsland: Compass,
  experiment: FlaskConical,
};

const minutesFor = (questions: number) => Math.max(1, Math.round((questions * 4) / 60));

const addDays = (base: Date, n: number) => {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + n);
  return d;
};

type PNode =
  | { kind: "past"; date: string }
  /** a day of this week with no answered evening: a quiet empty dot (calendar weeks, Nov 9 2026) */
  | { kind: "missed"; date: string }
  | { kind: "step"; step: Step }
  /** "Done for today": the last light of today (her note, Nov 5 2026: the app
   *  should always say what's next, then "всё, можешь шарики полопать…") */
  | { kind: "end" }
  | { kind: "future"; offset: number }
  | { kind: "chest" };
type Open = number | null;

/** Day 1, she chose to start tonight (onboarding v7): no "fill in yesterday" that day. */
/** the onboarding day: no "Missed a few days?" card yet */
const firstDayTonight = () => {
  try { return localStorage.getItem("memap_first_day_at") === isoLocal(new Date()); } catch { return false; }
};

/** "Not now" on the missed-days card: the days it showed; it comes back only for a day not among them. */
const FILL_HIDDEN_KEY = "memap_fill_card_hidden";
const readFillHidden = (): string[] => {
  try { const v = JSON.parse(localStorage.getItem(FILL_HIDDEN_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
};

/** The evenings the doctor-report card was shown on Today (three, then it steps back). */
const REPORT_TIP_KEY = "memap_report_tip_days", REPORT_TIP_EVENINGS = 3;

export const EveningPath = ({
  trackers,
  entries,
  onStartStep,
  onTask,
  onOpenReport,
  onOpenMap,
  onFillDay,
  onOpenDay,
}: {
  trackers: Tracker[];
  entries: TrackerEntry[];
  /** Answer one step's questions (one topic); title names it in the deck;
   *  redo = go through answered ones again to change them. */
  onStartStep: (step: Step, title: string, redo?: boolean) => void;
  /** Do today's small task (write a note, see the calendar…). */
  onTask: (task: TaskId) => void;
  onOpenReport: () => void;
  /** After a chest's reward goes on the map: show the Map. */
  onOpenMap: () => void;
  /** Answer a missed day; redo = change a day's answers. */
  onFillDay: (date: string, redo?: boolean, ids?: string[]) => void;
  /** Look at a past day. */
  onOpenDay: (date: string) => void;
}) => {
  const { t, i18n } = useTranslation();

  // Note days for the "Write a note" task; task records settle before the model. Words typed in "Why?" are kept
  // as notes but aren't a note written (Nov 10 2026): they never tick the task or count toward note treasures.
  const [noteDays, setNoteDays] = useState<string[] | null>(null);
  const loadNotes = () =>
    getNotes()
      .then((ns) => setNoteDays(ns.filter((n) => !n.reasonFor).map((n) => isoDay(new Date(n.createdAt))).sort()))
      .catch(() => setNoteDays([]));
  useEffect(() => { loadNotes(); }, []);
  const [noteDraft, setNoteDraft] = useState<NoteDraft | null>(null);
  // Today's "Write a note": closing the note unwritten counts as "not today", so
  // the highlight moves on (her note, Nov 5 2026: "закрыла, не стала это делать.
  // И хочу, чтобы он дальше мне уже подсвечивал следующий шажочек").
  const noteFromTask = useRef(false);
  const noteSaved = useRef(false);
  const setNote = (d: NoteDraft | null) => {
    if (d === null && noteFromTask.current) {
      noteFromTask.current = false;
      // saving closes first and says "saved" right after
      window.setTimeout(() => {
        if (!noteSaved.current) { skipTask("note"); setTick((k) => k + 1); }
        noteSaved.current = false;
      }, 0);
    }
    setNoteDraft(d);
  };
  // Bumped when a task is skipped or the game is played (stored outside React).
  const [tick, setTick] = useState(0);
  // "Games and rewards" (Nov 9 2026): off = no bubbles, treasures, flame, "grew" lights or "Great work"
  const playful = usePlayful();
  // the one-time question was just answered
  const [askGone, setAskGone] = useState(false);
  const m = useMemo(() => {
    const draft = pathModel(trackers, entries);
    if (noteDays === null) return draft;
    syncTasks(trackers, noteDays, draft.week);
    return pathModel(trackers, entries);
  }, [trackers, entries, noteDays, tick, playful]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = useMemo(() => { const today = isoLocal(new Date()); return trackers.filter((tr) => !tr.archived && tr.source !== "play" && askedOn(tr, today)); }, [trackers]);
  // low mood or no interest on 12 of the last 14 days: a doctor or therapist (when-to-act.md). Days she
  // answered are what count (answered-days rule, Nov 9 2026: at 3–4 evenings a week this card never came;
  // now 6 of 6 or 7 of 8 answers, the same share)
  const heavyMood = useMemo(() => {
    const now = new Date();
    const end = isoLocal(now);
    return active.some((tr) => {
      if (!HEAVY_MOOD_IDS.has(moodTemplateOf(tr) ?? "")) return false;
      const all = entries.filter((e) => e.trackerId === tr.id && e.date <= end);
      // today counts once answered (as in ruleState); the window is exactly 14 days ending there
      const last = all.some((e) => e.date === end) ? end : isoLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
      const start = isoLocal(new Date(Number(last.slice(0, 4)), Number(last.slice(5, 7)) - 1, Number(last.slice(8, 10)) - 13));
      const mine = all.filter((e) => e.date >= start && e.date <= last);
      if (!mine.length) return false;
      // the window, or since her first answer to it when that's later
      const first = all.reduce((m, e) => (e.date < m ? e.date : m), end) > start ? all.reduce((m, e) => (e.date < m ? e.date : m), end) : start;
      const days = Math.max(1, Math.round((Date.parse(last + "T12:00:00") - Date.parse(first + "T12:00:00")) / 86_400_000) + 1);
      const k = new Set(mine.filter((e) => e.value === (tr.problemWhen === "yes")).map((e) => e.date)).size;
      return k >= needOf(12, 14, new Set(mine.map((e) => e.date)).size, days);
    });
  }, [active, entries]);
  // which "Need to talk?" sheet: low mood, or a partner who shouted or said hurtful things tonight
  const [support, setSupport] = useState<null | "mood" | "home">(null);
  // came from the old look: the first week, a card says how to go back (her ask, Nov 7 2026)
  const fromOld = useMemo(() => {
    try {
      if (localStorage.getItem("memap_upgrade_invite") !== "accepted" || tipSeen("old-look")) return false;
      const at = localStorage.getItem("memap_path_start");
      return !!at && (Date.now() - new Date(at + "T00:00:00").getTime()) / 864e5 < 7;
    } catch { return false; }
  }, []);
  // after the first moments of the screen (a "grew" toast uses the same spot)
  const [oldLookShown, setOldLookShown] = useState(false);
  // the old-look card's height: the missed-days card stands under it in the first week (old-user walk, Nov 14 2026:
  // the missed days had no card while "Miss the old look?" was up)
  const [oldH, setOldH] = useState(0);
  // while "Look around" runs, the old-look card steps aside: the tour's first spotlight landed on it (Nov 14 2026)
  const [touring, setTouring] = useState(false);
  useEffect(() => {
    const on = () => setTouring(true), off = () => setTouring(false);
    window.addEventListener("memap-start-tour", on); window.addEventListener("memap-tour-done", off);
    return () => { window.removeEventListener("memap-start-tour", on); window.removeEventListener("memap-tour-done", off); };
  }, []);
  // "A report for your doctor" on Today: three evenings, then it steps back on its own (her decision, Nov 14 2026: no
  // box that stays every evening); the report itself stays in World → Share
  const reportDay = isoLocal(new Date());
  const reportDays = (): string[] => { try { const v = JSON.parse(localStorage.getItem(REPORT_TIP_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
  const reportTipOn = m.totalDays >= 5 && !heavyMood && !(fromOld && oldLookShown) && (() => { const d = reportDays(); return d.includes(reportDay) || d.length < REPORT_TIP_EVENINGS; })();
  useEffect(() => {
    if (!reportTipOn) return;
    const d = reportDays();
    if (!d.includes(reportDay)) try { localStorage.setItem(REPORT_TIP_KEY, JSON.stringify([...d, reportDay].slice(-10))); } catch { /* shows again, harmless */ }
  }, [reportTipOn, reportDay]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!fromOld) return; const id = window.setTimeout(() => setOldLookShown(true), 3200); return () => window.clearTimeout(id); }, [fromOld]);
  // links on her map (the World's dotted lines): "See your links" waits for the first one
  const world = useMemo(() => { const islands = buildIslands(trackers, entries); return { islands, routes: buildRoutes(trackers, entries, islands) }; }, [trackers, entries]);
  const hasLinks = world.routes.length > 0;
  // The next treasure (Nov 6 2026, her pick from the hooks): the one she's closest to,
  // said on "Done for today" with how far she is and what tomorrow brings — a reason
  // to come back. Ties go to the shorter way.
  const nextUp = useMemo(() => {
    if (!playful) return null;
    const f = worldFacts(trackers, entries, world.islands, world.routes, noteDays?.length ?? 0);
    const left = ITEMS.filter((it) => !owned(it.id, f)).map((it) => { const [k, n] = itemProgress(it.id, f); return { id: it.id, pic: it.pic, k, n }; }).filter((x) => x.n > 0 && x.k < x.n);
    left.sort((a, b) => b.k / b.n - a.k / a.n || a.n - b.n);
    return left[0] ?? null;
  }, [trackers, entries, world, noteDays, playful]);
  // "Look around" finished or skipped (src/components/AppTour.tsx): the path moves on
  useEffect(() => {
    const done = () => setTick((k) => k + 1);
    const evs = ["memap-tour-done", "memap-path-refresh", "memap-first-link-seen"];
    // after the tour: her next step comes to the middle with its card open
    const focusStep = () => window.setTimeout(() => focusRef.current?.click(), 350);
    window.addEventListener("memap-path-focus", focusStep);
    evs.forEach((e) => window.addEventListener(e, done));
    return () => { evs.forEach((e) => window.removeEventListener(e, done)); window.removeEventListener("memap-path-focus", focusStep); };
  }, []);
  // the calendar opens on her main question, so it's named for it ("Your migraine days")
  const daysLabel = (() => { const door = getDoorState(); return t(door ? `path.daysLabel.${door.id}` : "path.daysLabel.any"); })();
  // evenings answered on each island: how far each has grown
  const evenings = useMemo(() => islandEvenings(trackers, entries), [trackers, entries]);

  const [avatarPic, setAvatarPic] = useState<string | null>(() => avatarUrl(getAvatar()));
  useEffect(() => {
    const sync = () => setAvatarPic(avatarUrl(getAvatar()));
    window.addEventListener("memap-avatar-changed", sync);
    return () => window.removeEventListener("memap-avatar-changed", sync);
  }, []);

  // Width of the path box: the screen minus its 16pt gutters.
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(358);
  useLayoutEffect(() => {
    const el = boxRef.current?.parentElement;
    if (!el) return;
    const measure = () => setWidth(Math.min(el.clientWidth, PATH_MAX));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // --- Nodes and where they sit --------------------------------------------
  // The game step always shows (her: "а где игра?"); until there are two questions
  // to play it waits, saying when it opens.
  // "Your hunch" works from day 1: any two questions will do.
  const canPlay = useMemo(() => hunchTarget(trackers, entries) !== null, [trackers, entries]);
  const hunchReady = useMemo(() => !!readyHunch(trackers, entries), [trackers, entries, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  // A missed day to fill in waits beside the path, not on it (WORLD-BIBLE,
  // Nov 5 2026): the path holds only today's steps.
  // the bubbles step is a game: not with "Games and rewards" off
  const steps = useMemo(() => m.steps.filter((s) => (s.kind !== "fill" || s.onPath) && (playful || s.kind !== "unload")), [m, playful]);
  // "Why?": the last days' fights or headaches with no reasons yet, and the sheet that asks about them
  const whyPending = useMemo(() => pendingReasons(trackers, entries, isoDay(new Date())), [trackers, entries, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const whySub = useMemo(() => [...new Set(whyPending.map((e) => reasonName(t, trackers.find((x) => x.id === e.trackerId))))].join(" · "), [whyPending, trackers, t]);
  const [whyItems, setWhyItems] = useState<ReasonItem[] | null>(null);
  // A missed day from its pale light or the missed-days card is one short step too, like the path's own fill step
  // (old-user walk, Nov 14 2026: both asked all 9 questions in a row): the first topic step of that day with
  // something unanswered; yesterday keeps offering its next part on the path.
  const fillMissed = (date: string) => {
    const got = new Set(entries.filter((e) => e.date === date).map((e) => e.trackerId));
    const ids = questionGroups(trackers).map((g) => g.ids).find((g) => g.some((id) => !got.has(id)));
    if (ids) markFillDay(date);
    onFillDay(date, false, ids);
  };
  // Days to fill in (her notes: Nov 6 2026 "дать возможность заполнять за прошлые дни", Nov 9 2026
  // "если чего-то не хватает, можно попросить их дозаполнить"): a calm card with a chip per missed day
  // of the last week (it replaced the "Answer for Thursday" pill, which covered the path's names).
  // Not on the onboarding day, not while yesterday waits on the path itself (day 1 morning), not before
  // any answers. "Not now" hides it until another day is missed.
  const [fillHidden, setFillHidden] = useState<string[]>(readFillHidden);
  const missedToFill = useMemo(() => {
    const door = getDoorState();
    if (entries.length === 0 || m.steps.some((s) => s.onPath) || firstDayTonight() || door?.startedAt === isoDay(new Date())) return [];
    // this week's missed days are on the week strip (hollow, "tap to fill in"): the card keeps only the days before it
    return m.missedDays.filter((d) => d < m.weekDates[0]);
  }, [m, entries]);
  const fillCardOn = missedToFill.length > 0 && missedToFill.some((d) => !fillHidden.includes(d));
  const nodes: PNode[] = useMemo(() => {
    // this calendar week's days before today: answered ones done, the others empty dots
    const answered = new Set(m.pastInWeek);
    const out: PNode[] = m.weekDates.slice(0, m.dayInWeek).map((date) => (answered.has(date) ? { kind: "past" as const, date } : { kind: "missed" as const, date }));
    for (const step of steps) out.push({ kind: "step", step });
    if (steps.length > 0) out.push({ kind: "end" });
    const coming = DAYS_PER_WEEK - 1 - m.dayInWeek;
    for (let o = 1; o <= coming; o++) out.push({ kind: "future", offset: o });
    out.push({ kind: "chest" });
    return out;
  }, [m, steps]);
  const firstStep = m.dayInWeek;
  // a report already opened for this week (one opened before calendar weeks moved here, Nov 10 2026):
  // it stands where the report would, gold, and opens; never "A quiet week." over it
  const chestHere = !!getChests()[m.week];
  // fewer than 3 evenings can still come this week: no report, "A quiet week." where it would stand
  const quietChest = m.quietWeek && !m.weekComplete && !chestHere;
  const isOpenStep = (s: Step) => !s.done && (s.kind !== "game" || canPlay);
  // The questions stay the main step; "Unload your mind" is there any time
  // without taking the highlight (it is the main step only when nothing else is left).
  const firstOpen = steps.findIndex((s) => isOpenStep(s) && s.kind !== "unload");
  // Tonight is done (her notes, Nov 5 2026: "ты сделал большую работу сегодня,
  // можешь ещё поизучать вопросы или поиграть в пузырики", and "всё время надо
  // человека навигировать по приложению"): when every step but "Unload your mind"
  // is done, the highlight moves to the last light, "Done for today", and its
  // card offers what's left, all optional — a card on tap, never one that stays
  // on the path ("не нравится эта табличка на постоянке").
  const eveningDone = steps.length > 0 && firstOpen < 0;
  // the first evening done (not before the tour, her pick Nov 15 2026): now ask for the evening reminder, once
  useEffect(() => {
    if (!eveningDone || touring || !todayTourOver()) return;
    const door = getDoorState();
    if (!door || door.startedAt !== isoDay(new Date()) || getNotificationSettings().enabled) return;
    try { if (localStorage.getItem("memap_remind_asked") === "1") return; } catch { return; }
    const id = window.setTimeout(() => {
      try { localStorage.setItem("memap_remind_asked", "1"); } catch { /* asked again, harmless */ }
      window.dispatchEvent(new Event("memap-ask-reminder"));
    }, 1500);
    return () => window.clearTimeout(id);
  }, [eveningDone, touring]);
  // a partner shouted or said something hurtful today
  const hardHome = useMemo(() => { const d = isoDay(new Date()); return entries.some((e) => e.date === d && e.value === true && HOME_HARM_IDS.has(moodTemplateOf(trackers.find((x) => x.id === e.trackerId) ?? ({ id: "", title: "" } as Tracker)) ?? "")); }, [entries, trackers]);
  const openLeft = steps.filter((s) => isOpenStep(s) && s.kind !== "unload").length;
  const endNode = steps.length > 0 ? firstStep + steps.length : -1;
  const cur = firstOpen;
  const currentNode = cur >= 0 ? firstStep + cur : eveningDone ? endNode : -1;
  const chestIndex = nodes.length - 1;
  // The node to bring into view: the current step (or "Done for today"), else
  // the reward, else tomorrow.
  const focus = currentNode >= 0 ? currentNode : m.weekComplete ? chestIndex : firstStep + steps.length;

  // --- Words ---------------------------------------------------------------
  // "Play" on the hunch is a game word: "Check" with "Games and rewards" off (Nov 9 2026)
  const playWord = playful ? t("game.play") : t("hunch.check");
  // someone with days from before the new look isn't on a "first week" (persona walk, Nov 9 2026)
  const firstWeek = m.week === 0 && m.prior === 0;
  const reportLabel = firstWeek ? t("path.firstReport") : t("path.weekReport");
  const lang = i18n.language?.startsWith("ru") ? "ru-RU" : "en-US";
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const dayTitle = (iso: string) => cap(new Date(iso + "T00:00:00").toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" }));
  const weekdayName = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString(lang, { weekday: "long" });
  /** "Thu 6" / «Чт 6»: a missed day on its chip */
  const shortDay = (iso: string) => { const d = new Date(iso + "T00:00:00"); return `${cap(d.toLocaleDateString(lang, { weekday: "short" }).replace(".", ""))} ${d.getDate()}`; };
  const answersOn = (date: string) => {
    const ids = new Set(active.map((tr) => tr.id));
    return new Set(entries.filter((e) => e.date === date && ids.has(e.trackerId)).map((e) => e.trackerId)).size;
  };
  // Step names say what the step is about (her notes collected Nov 15 2026, step-names page): the islands of the
  // questions, not "part 1 of 2"; the thing a hunch, a "Why?", a tip or a lit rule is about; one word, "try"
  const byIdTr = (id: string) => trackers.find((x) => x.id === id);
  const lowFirst = (s: string) => (s ? s.charAt(0).toLocaleLowerCase(lang) + s.slice(1) : s);
  const islandsLabel = (ids: string[]) => {
    const names = [...new Set(ids.map(byIdTr).filter((x): x is Tracker => !!x).map((tr) => islandName(t, islandOf(tr))))];
    // two steps never read the same (Nov 15 2026): the first two islands, then "and more" (never "+2")
    return names.length <= 2 ? names.join(" · ") : t("path.islandsMore", { names: names.slice(0, 2).join(" · ") });
  };
  /** the hard answer of a question in its own short words ("argument with partner") */
  const hardWords = (tr: Tracker | undefined) => (tr ? answerPhrase(t, tr, tr.problemWhen !== "no") : "");
  // the Russian weekday as it reads after «Заполнить» (пятницу, субботу, среду)
  const RU_ACC: Record<string, string> = { "среда": "среду", "пятница": "пятницу", "суббота": "субботу" };
  const dayToFill = (iso: string) => { const w = weekdayName(iso); return lang === "ru-RU" ? RU_ACC[w] ?? w : cap(w); };
  const tipTopic = (id?: string) => { const tr = id ? byIdTr(tipFor(id) ?? "") : undefined; return tr ? tipTopicOf(moodTemplateOf(tr) ?? "") : null; };
  const whyOf = (s: Step) => { const ids = [...new Set(s.trackerIds.map((id) => reasonTemplate(byIdTr(id))).filter(Boolean))]; return ids.length === 1 ? ids[0] as string : null; };
  const stepName = (s: Step) => {
    if (s.kind === "auto") return t(s.auto === "start" ? "path.auto.start" : s.auto === "topic" ? "path.auto.topic" : "path.auto.first");
    if (s.kind === "grew") return (s.grew?.length ?? 1) > 1 ? t("path.grewMany") : t("path.grew", { name: islandName(t, s.island!) });
    if (s.kind === "fill") {
      if (s.onPath) return t("path.fillYesterdayDay", { day: lang === "ru-RU" ? lowFirst(shortDay(s.date!)) : shortDay(s.date!) });
      return t("path.fillDayTitle", { day: dayToFill(s.date!) });
    }
    if (s.kind === "game") return t("hunch.stepName");
    if (s.kind === "act") {
      const things = s.trackerIds.map((id) => lowFirst(hardWords(byIdTr(id)))).filter(Boolean);
      return things.length === 1 ? t("act.stepOf", { things: things[0] }) : t("act.stepMany");
    }
    if (s.kind === "test") return t("experiment.stepOver");
    if (s.kind === "unload") return t("unload.step");
    if (s.kind === "task") return t(`path.task.${s.task}.title`);
    if (s.kind === "discover") return t("tour.step");
    if (s.id === "link:new") return t("firstLink.newStep");
    if (s.kind === "link") return t("firstLink.step");
    if (s.kind === "report") return t("path.weekNReport", { n: Math.max(1, m.week) });
    if (s.kind === "tip") { const k = tipTopic(s.tipId); return k ? t("tipDay.stepAbout", { topic: t(`tipDay.topic.${k}`) }) : t("tipDay.step"); }
    if (s.kind === "why") { const w = whyOf(s); return w ? t(`why.stepOf.${w}`) : t("why.step"); }
    if (s.added) return t("path.newQuestion", { count: s.trackerIds.length });
    return islandsLabel(s.trackerIds) || (s.island ? islandName(t, s.island) : t("path.allQuestions"));
  };

  /** What a node looks like and says. */
  /** A step's own calm colour: its island, else what kind of step it is. */
  const hueOf = (s: Step): string => {
    if ((s.kind === "questions" || s.kind === "grew") && s.island) return islandHsl(s.island);
    // a task: mauve, not rose (rose means a hard day; QA re-check, Nov 9 2026); gold is for what's done
    if (s.kind === "task") return "300 30% 62%";
    if (s.kind === "game") return "262 40% 64%";
    if (s.kind === "act") return "16 72% 62%";
    if (s.kind === "test") return "152 36% 46%";
    if (s.kind === "unload") return "198 55% 58%";
    if (s.kind === "fill") return "205 46% 58%";
    if (s.kind === "link") return "174 52% 42%";
    if (s.kind === "tip") return "215 55% 60%";
    // "Why?": a quiet slate blue, not rose (rose means a hard day)
    if (s.kind === "why") return "228 36% 60%";
    return "var(--coin-teal)";
  };
  const viewOf = (n: PNode, i: number): { look: NodeLook; icon: ReactNode; title: string; sub?: string; action?: string; hue?: string } => {
    const current = i === currentNode;
    if (n.kind === "past") return { look: "done", icon: <Check className="h-6 w-6" strokeWidth={3} />, title: cap(weekdayName(n.date)) };
    if (n.kind === "missed") return { look: "empty", icon: null, title: cap(weekdayName(n.date)), sub: t("path.notFilled") };
    if (n.kind === "future") {
      return { look: "locked", hue: DAY_AHEAD, icon: <MoonStar className="h-6 w-6" strokeWidth={2} />, title: n.offset === 1 ? t("path.tomorrow") : cap(addDays(new Date(), n.offset).toLocaleDateString(lang, { weekday: "long" })) };
    }
    if (n.kind === "chest") {
      // one name with its week (Nov 15 2026): "Week 1 report", ready or in N evenings under it
      const wr = t("path.weekNReport", { n: m.week + 1 });
      if (quietChest) return { look: "locked", icon: null, title: t("path.quietWeekN", { n: m.week + 1 }) };
      // gold only once it's been opened: gold is what's done (her note, Nov 10 2026: "Report ready сразу жёлтая — это
      // путает, жёлтые я вообще не хочу открывать"); ready and not opened looks like a step to do
      if (chestHere) return { look: "gold", icon: <FileBarChart2 className="h-7 w-7" strokeWidth={2.2} />, title: wr };
      return m.weekComplete
        ? { look: currentNode < 0 ? "current" : "todo", hue: "var(--coin-teal)", icon: <FileBarChart2 className="h-7 w-7" strokeWidth={2.2} />, title: wr, sub: t("path.reportReadySub"), action: currentNode < 0 ? t("path.openReport") : undefined }
        : { look: "locked", hue: "var(--coin-gold)", icon: <FileBarChart2 className="h-7 w-7" strokeWidth={2.2} />, title: wr, sub: m.reportIn ? t("path.reportIn", { count: m.reportIn }) : undefined };
    }
    if (n.kind === "end") {
      // the day is done: the last light is the bubbles (Nov 8 2026)
      // after the bubbles the day looks finished (QA: the light stayed lit); with "Games and rewards" off, no bubbles
      if (eveningDone && (unloadPlayedToday() || !playful)) return { look: "done", icon: <Check className="h-6 w-6" strokeWidth={3} />, title: t("path.end.title") };
      if (eveningDone) return { look: current ? "current" : "todo", hue: "198 55% 58%", icon: <Wind className={current ? "h-10 w-10" : "h-6 w-6"} strokeWidth={2.2} />, title: t("path.end.playTitle"), action: current ? t("path.end.playAction") : undefined };
      return {
        look: current ? "current" : "todo", icon: <Flag className={current ? "h-10 w-10" : "h-6 w-6"} strokeWidth={2.2} />,
        title: t("path.end.titleAhead"), action: current ? t("path.end.action") : undefined,
      };
    }
    const s = n.step;
    // an island grew today: done already, with a sprout
    if (s.kind === "grew") return { look: "done", icon: <Sprout className="h-6 w-6" strokeWidth={2.6} />, hue: hueOf(s), title: stepName(s) };
    const Icon = s.kind === "task" ? TASK_ICON[s.task!] : s.kind === "game" ? Lightbulb : s.kind === "fill" ? CalendarDays
      : s.kind === "act" ? Lightbulb : s.kind === "test" ? FlaskConical : s.kind === "unload" ? Wind : s.kind === "report" ? FileBarChart2
      : s.kind === "discover" ? MapIcon : s.kind === "link" ? Link2 : s.kind === "tip" ? BookOpen : s.kind === "why" ? MessageCircleQuestion
      : s.kind === "questions" ? (s.added ? Plus : s.island ? islandIcon(islandDef(s.island).icon) : Layers) : s.auto === "topic" ? Compass : Sparkles;
    // A skipped task can still be done today (her note), so it shows its icon, not a check.
    const replay = s.kind === "unload";
    const icon = s.done && !s.skipped && !replay ? <Check className="h-6 w-6" strokeWidth={3} /> : <Icon className={current ? "h-10 w-10" : "h-6 w-6"} strokeWidth={2} />;
    const look: NodeLook = s.done && !s.skipped ? "done" : current ? "current" : "todo";
    const hue = hueOf(s);
    if (s.tonight) {
      const moon = <MoonStar className={current ? "h-10 w-10" : "h-6 w-6"} strokeWidth={2} />;
      return { look, icon: moon, hue, title: stepName(s), sub: t("path.tonightSub"), action: current ? t("path.answerNow") : undefined };
    }
    // what each step is about, under its name (Nov 15 2026): the thing guessed at, the try that ended, the two answers
    // of a new link, the one question just added
    const hunchThing = hardWords(hunchTarget(trackers, entries) ?? undefined);
    const overTry = s.kind === "test" ? runningExperiments().find((x) => experimentOver(x)) : undefined;
    const linkSides = s.sides ? `${cap(answerPhrase(t, byIdTr(s.sides.first), s.sides.firstYes))} · ${cap(answerPhrase(t, byIdTr(s.sides.second), s.sides.secondYes))}` : null;
    const addedSub = s.added && !s.done ? (s.trackerIds.length - s.answered === 1 && s.trackerIds.length === 1 ? cardQuestion(byIdTr(s.trackerIds[0])!) : t("path.questions", { count: s.trackerIds.length - s.answered })) : undefined;
    if (!current) return { look, icon, hue, title: stepName(s), sub: s.skipped ? t("path.skipped") : s.kind === "why" && !s.done ? whySub : s.kind === "game" && hunchReady ? t("hunch.checkedSub") : s.kind === "unload" ? t("unload.sub") : addedSub ?? (s.fresh && !s.done ? t("path.newIsland") : undefined) };
    const left = s.trackerIds.length - s.answered;
    if (s.kind === "task") return { look, icon, hue, title: stepName(s), sub: t(`path.task.${s.task}.line`), action: t("act.open") };
    if (s.kind === "game") return { look, icon, hue, title: stepName(s), sub: hunchReady ? t("hunch.checkedSub") : cap(hunchThing) || t("hunch.sub"), action: hunchReady ? t("hunch.see") : t("hunch.guess") };
    if (s.kind === "act") return { look, icon, hue, title: stepName(s), sub: t("act.sub", { count: s.trackerIds.length }), action: t("act.open") };
    if (s.kind === "test") return { look, icon, hue, title: stepName(s), sub: overTry ? testNameOf(overTry.change) : t("experiment.stepSub"), action: t("experiment.seeResult") };
    if (s.kind === "unload") return { look, icon, hue, title: stepName(s), sub: t("unload.sub"), action: playWord };
    if (s.kind === "discover") return { look, icon, hue, title: stepName(s), sub: t("tour.stepSub"), action: t("tour.go") };
    if (s.kind === "tip") return { look, icon, hue, title: stepName(s), sub: tipTitle(s.tipId), action: t("tipDay.open") };
    if (s.kind === "why") return { look, icon, hue, title: stepName(s), sub: whySub, action: t("why.answer") };
    if (s.kind === "link") return { look, icon, hue, title: stepName(s), sub: linkSides ?? t(s.id === "link:new" ? "firstLink.newSub" : "firstLink.sub"), action: t("firstLink.see") };
    if (s.added) return { look, icon, hue, title: stepName(s), sub: addedSub, action: s.answered > 0 ? t("path.continue") : t("why.answer") };
    return {
      look, icon, hue, title: stepName(s),
      sub: s.answered > 0 ? t("path.left", { count: left }) : t("path.questions", { count: left }),
      action: s.answered > 0 ? t("path.continue") : t("path.start"),
    };
  };

  // Room under a light whose name takes two lines (her phone, Nov 15 2026: the next light covered the name): the
  // names are measured as the label draws them (14px bold, 156px wide) and the lights below move down.
  const measureCtx = useMemo(() => {
    try { const c = document.createElement("canvas").getContext("2d"); if (c) c.font = `700 14px ${getComputedStyle(document.body).fontFamily}`; return c; } catch { return null; }
  }, []);
  const linesOf = (text: string) => {
    if (!measureCtx) return Math.max(1, Math.ceil(text.length / 20));
    const space = measureCtx.measureText(" ").width;
    let lines = 1, w = 0;
    for (const word of text.split(/\s+/).filter(Boolean)) {
      const ww = measureCtx.measureText(word).width;
      if (w > 0 && w + space + ww > 156) { lines += 1; w = ww; } else w += (w > 0 ? space : 0) + ww;
    }
    return lines;
  };
  const labelKey = nodes.map((n, i) => (n.kind === "chest" && quietChest ? 1 : linesOf(viewOf(n, i).title))).join(",");
  const stops = useMemo(() => {
    // room above her step for its Start bubble (the first light included)
    const out = weekStops(width, nodes.map((n, i) => (n.kind === "chest" ? R_CHEST : n.kind === "step" || n.kind === "end" ? (i === currentNode ? R_CURRENT : R_STEP) : R_DAY)), 74);
    if (currentNode > 0) for (let k = currentNode; k < out.length; k++) out[k] = { ...out[k], y: out[k].y + 70 };
    return out;
  }, [nodes, width, currentNode]);
  const height = stops[chestIndex].y + R_CHEST + 56;


  const f = stops[focus];
  // Her avatar (optional) stands to the left of the step to do.
  // her boat (with her animal in it) waits beside the step to do
  const toRight = f.x <= width / 2;
  const avatar: Rect | null = toRight
    ? (f.x + f.r + 64 <= width ? { x: f.x + f.r + 6, y: f.y - 40, w: 58, h: 58 } : null)
    : (f.x - f.r - 64 >= 0 ? { x: f.x - f.r - 64, y: f.y - 40, w: 58, h: 58 } : null);

  // --- Bubbles ---------------------------------------------------------------
  const [open, setOpen] = useState<Open>(null);
  const [tipOpen, setTipOpen] = useState<string | null>(null);
  const [wiggle, setWiggle] = useState<number | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open === null) return;
    const close = (e: PointerEvent) => {
      const el = e.target as Element | null;
      if (bubbleRef.current?.contains(el as Node) || el?.closest?.("[data-path-stop]")) return;
      setOpen(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  // An island grew with today's answers: show it once, for a few seconds
  // (her note, Nov 5 2026: short, no taps needed).
  const [grewNow, setGrewNow] = useState<IslandId | null>(null);
  useEffect(() => {
    if (!playful) return;
    const today = isoDay(new Date());
    const grew = m.steps.filter((s) => s.kind === "grew").flatMap((s) => s.grew ?? [{ island: s.island!, stage: s.stage ?? 0 }]);
    let seen: string[] = [];
    try { seen = JSON.parse(localStorage.getItem("memap_grew_seen") || "[]"); } catch { /* shows again, harmless */ }
    const fresh = grew.find((s) => !seen.includes(`${today}:${s.island}:${s.stage}`));
    if (!fresh) return;
    try { localStorage.setItem("memap_grew_seen", JSON.stringify([...seen.slice(-40), `${today}:${fresh.island}:${fresh.stage}`])); } catch { /* ignore */ }
    haptics.sparkle();
    setGrewNow(fresh.island!);
  }, [m, playful]);
  // it goes away by itself (a re-render of the path must not keep it up)
  useEffect(() => {
    if (!grewNow) return;
    const id = window.setTimeout(() => setGrewNow(null), 3600);
    return () => window.clearTimeout(id);
  }, [grewNow]);

  // A week's chest, open in its own sheet; and how many finished weeks show.
  const [chestOpen, setChestOpen] = useState<{ week: number; dates: string[] } | null>(null);
  const [gameOpen, setGameOpen] = useState(false);
  const [testOpen, setTestOpen] = useState<"pick" | "result" | null>(null);
  const [unloadOpen, setUnloadOpen] = useState(false);
  const [pastShown, setPastShown] = useState(1);
  const chests = useMemo(() => getChests(), [chestOpen]); // eslint-disable-line react-hooks/exhaustive-deps


  // The flame lives in the header (Index renders an empty slot there).
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  useEffect(() => setHeaderSlot(document.getElementById("memap-header-start")), []);

  // --- Scrolling --------------------------------------------------------------
  // Her note, Nov 4 2026: "давай просто как у дуолинго и попроще". A plain page
  // that scrolls freely under her finger: no drum, no snapping. A light passing
  // the middle of the screen gives a light tap; her step far off shows the way
  // back; Today opens with her step in the middle.
  const focusRef = useRef<HTMLButtonElement>(null);
  // Malu's tip over the boat: which one (counts up across visits)
  const [maluTip, setMaluTip] = useState<number | null>(null);
  // the bright step is only a suggestion (her note, Nov 8 2026: "можно скипнуть яркий шар… но это
  // неочевидно"): Malu says so once, beside the boat, in the first days while two or more steps are open
  const [orderTipRaw, setOrderTip] = useState(() => !tipSeen("any-order"));
  const orderTip = orderTipRaw && !touring && todayTourOver();
  // variant C (no tour): the same tip says what the steps are
  const shortOnb = onbVariant() === "C";
  const closeOrderTip = () => { haptics.tap(); markTipSeen("any-order"); setOrderTip(false); };
  const nextMaluTip = () => setMaluTip((cur) => {
    if (cur !== null) return cur + 1;
    let k = 0; try { k = Number(localStorage.getItem("memap_malu_tip") || "0"); localStorage.setItem("memap_malu_tip", String(k + 1)); } catch { /* starts at the first */ }
    return k;
  });
  const openRef = useRef<Open>(null);
  openRef.current = open;
  // who is scrolling: her hand (taps; an open card closes) or the app (quiet)
  const modeRef = useRef<"hand" | "auto">("auto");
  /** the middle of the room between the header and the tab bar, from the scroller's top */
  const mid = useRef(300);
  const frameRef = useRef<() => void>(() => undefined);
  const reduceQuery = () => matchMedia("(prefers-reduced-motion: reduce)");
  const [away, setAway] = useState<"up" | "down" | null>(null);
  // the week strip on top: the day of the light in the middle of the screen, and the strip's height (the cards
  // that stand at the top go under it)
  const [inViewDate, setInViewDate] = useState<string | null>(null);
  const [stripH, setStripH] = useState(0);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const pinRef = useRef<string | null>(null);
  // the day the strip shows now (a tap sets it too, so the next scroll by hand moves it on)
  const lastDayRef = useRef("");
  const awayRef = useRef<"up" | "down" | null>(null);
  const hasPath = trackers.length > 0;
  const [headerTitle, setHeaderTitle] = useState<HTMLElement | null>(null);
  const [headerBelow, setHeaderBelow] = useState<HTMLElement | null>(null);
  useEffect(() => { setHeaderTitle(document.getElementById("memap-header-center")); setHeaderBelow(document.getElementById("memap-header-below")); }, []);

  // the "Missed a few days?" card at the top: her step comes to the middle of the room below it
  const fillCardRef = useRef<HTMLDivElement>(null);
  const measure = (main: HTMLElement) => {
    const cs = getComputedStyle(main);
    const bottom = main.clientHeight - (parseFloat(cs.scrollPaddingBottom) || 0);
    const mt = main.getBoundingClientRect().top;
    const top = Math.max(0, ...[fillCardRef.current, stripRef.current].map((el) => (el ? el.getBoundingClientRect().bottom - mt + 12 : 0)));
    mid.current = (top + bottom) / 2;
  };
  // the card came or went ("Not now", the last day filled): the middle moves with it
  const fillCardShown = fillCardOn;
  useEffect(() => {
    const main = document.querySelector("main");
    if (main && hasPath) { measure(main); frameRef.current(); }
  }, [fillCardShown, oldH, oldLookShown, stripH]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const main = document.querySelector("main");
    if (!main || !hasPath) return;
    let raf = 0, lastTick = 0;
    let lastBest: Element | null = null;
    const frame = () => {
      raf = 0;
      const midY = main.getBoundingClientRect().top + mid.current;
      const tops = new Map<Element, number>();
      // a light's centre on screen: its week's box and its place in it
      const yOf = (el: HTMLElement) => {
        const box = el.closest(".path-box");
        if (!box) return NaN;
        let t = tops.get(box);
        if (t === undefined) { t = box.getBoundingClientRect().top; tops.set(box, t); }
        return t + Number(el.dataset.cy);
      };
      let best: Element | null = null, bestD = Infinity;
      for (const el of main.querySelectorAll<HTMLElement>("[data-cy]")) {
        const d = Math.abs(yOf(el) - midY);
        if (d < bestD) { bestD = d; best = el; }
      }
      if (best !== lastBest) {
        const now = performance.now();
        if (lastBest && modeRef.current === "hand" && now - lastTick > 70) { haptics.tick(); lastTick = now; }
        if (lastBest && modeRef.current === "hand" && typeof openRef.current === "number") setOpen(null);
        lastBest = best;
      }
      // the strip's day: today while any of today's lights is on screen (the middle of a short page can fall on a coming
      // day, her phone, Nov 15 2026); else the day of the light in the middle (another week's lights leave it as it was)
      if (!pinRef.current) {
        const mr = main.getBoundingClientRect();
        const roomBottom = mr.bottom - (parseFloat(getComputedStyle(main).scrollPaddingBottom) || 0);
        const today = isoDay(new Date());
        const todayInSight = [...main.querySelectorAll<HTMLElement>(`[data-day="${today}"]`)].some((el) => { const y = yOf(el); return y > mr.top + 8 && y < roomBottom - 8; });
        const day = todayInSight ? today : (best as HTMLElement | null)?.dataset.day;
        if (day && day !== lastDayRef.current) { lastDayRef.current = day; setInViewDate(day); }
      }
      const fw = focusRef.current?.closest<HTMLElement>("[data-cy]");
      const fd = fw ? yOf(fw) - midY : NaN;
      const lim = mid.current - 120;
      // "down" only once the Start bubble over her step (about 90px above it) has gone behind the
      // tabs: the button covered a bubble still in sight (her phone test, Nov 7 2026)
      // and only once her step itself is below the screen (QA re-check, Nov 9 2026: the pill still covered "Start")
      const nowAway = Number.isNaN(fd) ? null : fd < -lim ? "up" : fd > mid.current - 20 ? "down" : null;
      if (nowAway !== awayRef.current) { awayRef.current = nowAway; setAway(nowAway); }
    };
    frameRef.current = frame;
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(frame); };
    const onResize = () => { measure(main); onScroll(); };
    const byHand = () => { modeRef.current = "hand"; pinRef.current = null; };
    const byKey = (e: KeyboardEvent) => { if (/^(Arrow|Page|Home$|End$| $)/.test(e.key)) { modeRef.current = "hand"; pinRef.current = null; } };
    main.addEventListener("scroll", onScroll, { passive: true });
    main.addEventListener("touchstart", byHand, { passive: true });
    main.addEventListener("wheel", byHand, { passive: true });
    main.addEventListener("keydown", byKey);
    window.addEventListener("resize", onResize);
    measure(main);
    frame();
    return () => {
      main.removeEventListener("scroll", onScroll);
      main.removeEventListener("touchstart", byHand);
      main.removeEventListener("wheel", byHand);
      main.removeEventListener("keydown", byKey);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
      frameRef.current = () => undefined;
    };
  }, [hasPath]);

  // Her step comes to the middle when Today opens, before the first paint:
  // a microtask, because Index's own layout effect (which runs after this
  // one) resets the scroll for the tab.
  const placedRef = useRef(false);
  useLayoutEffect(() => {
    if (!hasPath) return;
    const firstTime = !placedRef.current;
    if (!firstTime && modeRef.current === "hand") return;
    queueMicrotask(() => {
      const box = boxRef.current, main = box?.closest("main");
      if (!box || !main) return;
      placedRef.current = true;
      measure(main);
      const d = box.getBoundingClientRect().top + stops[focus].y - (main.getBoundingClientRect().top + mid.current);
      if (firstTime) { main.scrollTop += d; frameRef.current(); }
      else if (Math.abs(d) > 2) { modeRef.current = "auto"; main.scrollBy({ top: d, behavior: reduceQuery().matches ? "auto" : "smooth" }); }
      if (!firstTime) return;
      // On the phone what stands above the path (the week's card, pictures, the safe area) can still
      // settle after this first placement and push her step below the middle, its card under the tabs
      // (her note, Nov 10 2026: "делает не посередине, а чуть ниже… перекрывает нижняя плашка").
      // For the first moments, until she scrolls herself, her step comes back to the middle.
      const settle = () => {
        if (modeRef.current === "hand") return;
        const b2 = boxRef.current;
        if (!b2) return;
        measure(main);
        const d2 = b2.getBoundingClientRect().top + stopsRef.current[focusIdxRef.current].y - (main.getBoundingClientRect().top + mid.current);
        if (Math.abs(d2) > 6) { main.scrollTop += d2; frameRef.current(); }
      };
      const ro = new ResizeObserver(settle);
      if (main.firstElementChild) ro.observe(main.firstElementChild);
      ro.observe(main);
      const timers = [250, 700, 1500].map((ms) => window.setTimeout(settle, ms));
      window.setTimeout(() => { ro.disconnect(); timers.forEach(clearTimeout); }, 2500);
    });
  }, [hasPath, focus]); // eslint-disable-line react-hooks/exhaustive-deps
  const stopsRef = useRef(stops);
  stopsRef.current = stops;
  const focusIdxRef = useRef(focus);
  focusIdxRef.current = focus;

  // An opened card stands whole between the header and the tabs: it was cut by the tab bar
  // (her note, Nov 10 2026). Measured once it is drawn, its light included.
  useEffect(() => {
    if (typeof open !== "number") return;
    const raf = requestAnimationFrame(() => {
      const card = bubbleRef.current?.parentElement, main = boxRef.current?.closest("main");
      const light = boxRef.current?.querySelector(`[data-path-stop="${open}"]`);
      if (!card || !main) return;
      const r = card.getBoundingClientRect(), l = light?.getBoundingClientRect();
      const mr = main.getBoundingClientRect();
      const top = Math.min(r.top, l?.top ?? r.top), bottom = Math.max(r.bottom, l?.bottom ?? r.bottom);
      const roomTop = mr.top + 32;
      // above the tabs and clear of the fade at the bottom of the screen (its last 120px, Index.tsx)
      const roomBottom = mr.bottom - Math.max((parseFloat(getComputedStyle(main).scrollPaddingBottom) || 0) + 14, 124);
      let d = 0;
      if (bottom > roomBottom) d = bottom - roomBottom;
      if (top - d < roomTop) d = top - roomTop;
      if (Math.abs(d) > 4) { modeRef.current = "auto"; main.scrollBy({ top: d, behavior: reduceQuery().matches ? "auto" : "smooth" }); }
    });
    return () => cancelAnimationFrame(raf);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  /** How far a stop is from the middle of the screen. */
  const toMiddle = (i: number) => {
    const box = boxRef.current, main = box?.closest("main");
    if (!box || !main) return null;
    return { main, d: box.getBoundingClientRect().top + stops[i].y - (main.getBoundingClientRect().top + mid.current) };
  };
  // (a light tapped low on the screen comes up: the opened-card effect above scrolls it whole into view)
  const backToStep = () => {
    const el = focusRef.current, at = toMiddle(focus);
    if (!el || !at) return;
    haptics.tap();
    modeRef.current = "auto";
    at.main.scrollBy({ top: at.d, behavior: reduceQuery().matches ? "auto" : "smooth" });
    // focus goes to her step instead of being lost with the pill
    el.focus({ preventScroll: true });
  };

  // The week strip on top (her note, Nov 15 2026: «давай наверху сделаем какой-то движок, который будет переключаться в
  // зависимости от того, на какой ты кнопке, показывать, на каком ты дне»): the day of the light in the middle of the
  // screen (the wheel's focus), its seven days under it; a tap on a day brings its light to the middle, a missed day
  // opens to be filled in.
  const todayIso = isoDay(new Date());
  const dateOfNode = (i: number): string | null => {
    const n = nodes[i];
    if (!n) return null;
    if (n.kind === "past" || n.kind === "missed") return n.date;
    if (n.kind === "step" || n.kind === "end") return todayIso;
    if (n.kind === "future") return isoDay(addDays(new Date(), n.offset));
    return null;
  };
  const inView = inViewDate ?? dateOfNode(focus) ?? todayIso;
  // the report closes the week: its light reads as the week's last day
  const dayOfNode = (i: number) => dateOfNode(i) ?? m.weekDates[m.weekDates.length - 1];
  const goToDay = (date: string) => {
    haptics.tap();
    // a missed day already in view opens to be filled in ("Not filled · tap to fill in")
    if (date < todayIso && !m.pastInWeek.includes(date) && date === inView) { fillMissed(date); return; }
    const i = date === todayIso && dateOfNode(focus) === todayIso ? focus : nodes.findIndex((_, k) => dateOfNode(k) === date);
    const at = i >= 0 ? toMiddle(i) : null;
    if (!at) return;
    pinRef.current = date;
    lastDayRef.current = date;
    setInViewDate(date);
    modeRef.current = "auto";
    at.main.scrollBy({ top: at.d, behavior: reduceQuery().matches ? "auto" : "smooth" });
  };
  // "Today · Sun 15", "Fri 13 · Not filled": short, the header's width (her note: less text)
  const stripLine = (() => {
    const named = (iso: string) => `${cap(new Date(iso + "T00:00:00").toLocaleDateString(lang, { weekday: "short" }).replace(".", ""))} ${Number(iso.slice(8))}`;
    if (inView === todayIso) return { day: t("path.stripToday", { day: named(todayIso) }), today: true, missed: false };
    return { day: named(inView), today: false, missed: inView < todayIso && !m.pastInWeek.includes(inView) };
  })();

  if (trackers.length === 0) return null;

  const title = t(`path.title${m.week % WEEK_TITLES}`);
  // answered evenings of this calendar week ("k of 7")
  const daysDone = m.pastInWeek.length + (m.todayCounted ? 1 : 0);
  // evenings to the end of the week, when its report comes
  const toGo = m.reportIn ?? 0;
  const openThisChest = () => setChestOpen({ week: m.week, dates: m.weekDates });
  // what this week's part gives now, and where it lives (board 68)
  const part = m.week % WEEK_TITLES;
  const weekNext = (() => {
    // answered evenings, the same count as the push and the Links screen
    const evenings = countedDays(trackers, entries).length;
    // week 1's chip opens My days (a chip that looks tappable is tappable)
    if (part === 0) {
      const text = m.weekComplete ? t("path.reportReady") : quietChest ? t("path.quietWeek") : chestHere && !m.reportIn ? t("path.weekReport") : t(firstWeek ? "path.next4.report" : "path.next4.reportN", { count: toGo });
      return { text, open: "overview" as null | "overview" | "findings" | "signals" | "world" };
    }
    if (part === 1) {
      const n = computeCorrelations(trackers.filter((x) => !x.archived && x.source !== "play"), entries, LINKS_TOP).filter(linkWorthShowing).length;
      return n > 0 ? { text: t("path.next4.links", { count: n }), open: "findings" as const } : { text: evenings < LINKS_AT ? t("path.next4.linksSoon", { count: LINKS_AT - evenings }) : t("path.next4.linksWait"), open: null };
    }
    if (part === 2) { const lit = litTrackers(trackers, entries).size; return { text: lit > 0 ? t("path.next4.lit", { count: lit }) : t("path.next4.rule"), open: "signals" as const }; }
    const x = currentExperiment();
    return { text: x ? t("path.next4.trying", { change: testNameOf(x.change), k: Math.min(experimentDay(x), EXPERIMENT_DAYS), count: EXPERIMENT_DAYS }) : t("path.next4.try"), open: "world" as const };
  })();

  // "Games and rewards — keep them?": once, after the 10th answered evening (so on a day whose evening is
  // answered: the end of the evening, not while answering), never on a hard evening (low mood, a hurtful
  // partner); either answer ends it, and Settings can change it later. Not while the old-look card holds
  // the same spot (her first week after switching).
  // (Already off: nothing to keep, no question.)
  const askPlayful = playful && !askGone && !heavyMood && !hardHome && !fromOld && m.todayCounted && m.totalDays >= PLAYFUL_ASK_AT && !playfulAsked();
  const answerPlayful = (on: boolean) => {
    haptics.tap();
    markPlayfulAsked();
    setAskGone(true);
    if (!on) setPlayful(false);
    track("playful_choice", { on, from: "ask" });
  };

  const openActionPoints = () =>
    window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "signals", back: true } }));
  const tipTitle = (id?: string) => { const x = OBSERVE_TIPS.find((o) => o.id === id); return x ? (i18n.language?.startsWith("ru") ? x.ru.title : x.en.title) : ""; };
  const startStep = (s: Step) => {
    setOpen(null);
    track("path_step_started", { kind: s.kind, week: m.week + 1, ...(s.task ? { task: s.task } : {}) });
    if (s.kind === "game") { if (canPlay) setGameOpen(true); }
    else if (s.kind === "act") { markActSeen(s.trackerIds); setTick((k) => k + 1); openActionPoints(); }
    else if (s.kind === "fill") { markFillDay(s.date!); onFillDay(s.date!, false, s.trackerIds); }
    else if (s.kind === "task" && s.task === "note") { noteFromTask.current = true; noteSaved.current = false; setNoteDraft(newDraft()); }
    else if (s.kind === "task" && s.task === "experiment") setTestOpen("pick");
    else if (s.kind === "test") setTestOpen("result");
    else if (s.kind === "unload") setUnloadOpen(true);
    else if (s.kind === "discover") window.dispatchEvent(new CustomEvent("memap-start-tour"));
    else if (s.id === "link:new") {
      // a link found after the first: it opens in Links (the first card open), and counts as seen
      markLinksSeen(computeCorrelations(trackers.filter((x) => !x.archived && x.source !== "play"), entries, LINKS_TOP).filter(linkWorthShowing).map(pairOf));
      if (s.trackerIds.length === 2) reopenLink(s.trackerIds);
      setTick((k) => k + 1);
      window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "findings", back: true } }));
    }
    else if (s.kind === "link") window.dispatchEvent(new CustomEvent("memap-link-moment"));
    else if (s.kind === "tip") setTipOpen(s.tipId ?? null);
    else if (s.kind === "why") setWhyItems(whyPending.map((e) => ({ trackerId: e.trackerId, date: e.date })));
    else if (s.kind === "report") setChestOpen({ week: m.week - 1, dates: m.pastWeeks[m.week - 1]?.dates ?? [] });
    else if (s.kind === "task") onTask(s.task!);
    else onStartStep(s, stepName(s));
  };
  // A light tapped opens its card (name, what's there, Start), as on
  // Duolingo; the Start bubble over her step starts it at once.
  const tap = (i: number) => {
    const n = nodes[i];
    if (n.kind === "chest" && (m.weekComplete || chestHere)) { setOpen(null); openThisChest(); return; }
    if (n.kind === "chest" && quietChest) return;
    const notYet = n.kind === "future" || (n.kind === "end" && !eveningDone) || (n.kind === "chest" && !m.weekComplete) || (n.kind === "step" && n.step.kind === "game" && !canPlay);
    if (notYet && open !== i) {
      setWiggle(i);
      window.setTimeout(() => setWiggle((w) => (w === i ? null : w)), 450);
    }
    setOpen((o) => (o === i ? null : i));
  };

  // Plain render helpers (not components), so a re-render doesn't remount
  // an open bubble and replay its entrance.
  const button = (children: ReactNode, onClick: () => void, look: "teal" | "plain" | "gold" = "teal") => (
    <button type="button" onClick={onClick}
      className={cn("mt-3 w-full justify-center gap-1",
        look === "teal" && "raised-btn is-small",
        look === "gold" && "raised-btn is-small is-gold",
        look === "plain" && "quiet-btn h-12 text-[16px]")}>
      {children}
    </button>
  );
  const dots = (ids: string[], date: string) => {
    const byTracker = new Map(entries.filter((e) => e.date === date).map((e) => [e.trackerId, e.value]));
    const byId = new Map(trackers.map((tr) => [tr.id, tr]));
    return (
      // One dot per question, the same colours as the calendar (a day is a
      // dot, Nov 5 2026): indigo = a hard answer, lavender = a calm one,
      // grey = not answered yet.
      <div className="mt-2.5 flex flex-wrap gap-1.5" aria-hidden="true">
        {ids.slice(0, 40).map((id) => {
          const v = byTracker.get(id), tr = byId.get(id);
          const look = v === undefined || !tr ? "hsl(var(--foreground) / 0.12)" : isNeutralQuestion(tr) ? (v === true ? "hsl(var(--data-a))" : "hsl(var(--data-a) / 0.25)") : isHardAnswer(tr, v) ? "hsl(var(--strong))" : "hsl(var(--balanced) / 0.75)";
          return <span key={id} className="h-3 w-3 rounded-full" style={{ background: look }} />;
        })}
      </div>
    );
  };
  const head = (text: ReactNode, sub?: ReactNode) => (
    <>
      <p className="text-[17px] font-bold leading-tight">{text}</p>
      {sub && <p className="mt-0.5 text-[15px] font-medium text-muted-foreground">{sub}</p>}
    </>
  );

  /** An island's picture at its stage now, and how far the next one is. */
  const stageLine = (island: IslandId) => {
    const n = evenings.get(island) ?? 0, left = toNextStage(n);
    return left === null ? t("path.stageFull", { stage: t(`path.stage${stageOf(n)}`) }) : t("path.stageLine", { stage: t(`path.stage${stageOf(n)}`), count: left });
  };
  const islandPic = (island: IslandId, w: number) => {
    const name = artOf(island, evenings.get(island) ?? 0);
    return (
      <span aria-hidden="true" className="block" style={{ width: w }}>
        <img className="art-day block w-full" src={art(name, false)} alt="" />
        <img className="art-night block w-full" src={art(name, true)} alt="" />
      </span>
    );
  };
  const grewBody = (island: IslandId) => (
    <>
      <div className="flex items-center gap-3">
        {islandPic(island, 92)}
        <div className="min-w-0">{head(t("path.grew", { name: islandName(t, island) }), stageLine(island))}</div>
      </div>
      {button(t("path.seeGrow"), () => { setOpen(null); window.dispatchEvent(new CustomEvent("memap-grow-moment", { detail: { island, stage: stageOf(evenings.get(island) ?? 0) } })); })}
    </>
  );
  // several islands grew the same evening: one card, a row each
  const grewManyBody = (list: { island: IslandId }[]) => (
    <>
      <p className="text-[20px] font-bold leading-snug">{t("path.grewMany")}</p>
      {list.map(({ island }) => (
        <button key={island} type="button" onClick={() => { setOpen(null); window.dispatchEvent(new CustomEvent("memap-grow-moment", { detail: { island, stage: stageOf(evenings.get(island) ?? 0) } })); }}
          className="mt-2 flex w-full items-center gap-3 text-left">
          {islandPic(island, 56)}
          <span className="min-w-0">
            <span className="block text-[17px] font-bold leading-tight">{islandName(t, island)}</span>
            <span className="block text-[14px] font-semibold text-muted-foreground">{stageLine(island)}</span>
          </span>
        </button>
      ))}
    </>
  );

  /** Treasures that come with evenings: tomorrow brings the next dot. */
  const DAILY: ItemId[] = ["balloon", "airplane", "tent", "suitcase", "bicycle", "moon", "house"];
  const nextTreasure = (x: { id: ItemId; pic: string; k: number; n: number }, onOpen: () => void) => {
    const daily = DAILY.includes(x.id);
    return (
      <button type="button" onClick={onOpen} className="next-treasure mt-3 flex w-full items-center gap-3 rounded-[18px] px-3 py-2.5 text-left">
        <span className="tour-pop relative h-12 w-12 shrink-0" style={{ animationDelay: ".1s" }} aria-hidden="true">
          <img className="art-day h-12 w-12 object-contain" src={mapPicFor(x.pic, false)} alt="" />
          <img className="art-night h-12 w-12 object-contain" src={mapPicFor(x.pic, true)} alt="" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-bold leading-tight">{t(`items.${x.id}.name`)}</span>
          <span className="block text-[14px] font-semibold leading-snug text-muted-foreground">{t("items.toGet", { how: t(`items.${x.id}.how`), k: x.k, count: x.n })}</span>
          {x.n <= 14 && (
            <span className="mt-1.5 flex flex-wrap gap-1" aria-hidden="true">
              {Array.from({ length: x.n }, (_, i) => (
                <span key={i} className={cn("h-2.5 w-2.5 rounded-full", daily && m.todayCounted && i === x.k - 1 && "tour-pop next-treasure-today")}
                  style={{ background: i < x.k ? "hsl(var(--coin-gold))" : "hsl(var(--foreground) / 0.12)", animationDelay: ".45s" }} />
              ))}
            </span>
          )}
          {daily && <span className="mt-1 block text-[14px] font-bold text-[hsl(var(--coin-teal))]">{x.k + 1 >= x.n ? t("path.nextYours") : t("path.nextTomorrow", { k: x.k + 1, n: x.n })}</span>}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2.4} />
      </button>
    );
  };

  const bubbleBody = (i: number): ReactNode => {
    const n = nodes[i];
    // a day of this week with no answers: its name and one way to fill it in (no "you didn't…")
    if (n.kind === "missed") {
      return (
        <>
          {head(dayTitle(n.date))}
          {button(t("path.fillDay"), () => { setOpen(null); fillMissed(n.date); }, "plain")}
        </>
      );
    }
    if (n.kind === "past") {
      return (
        <>
          {head(dayTitle(n.date), t("path.answers", { count: answersOn(n.date) }))}
          {dots(active.map((tr) => tr.id), n.date)}
          {/* One way in: the day's answers, change just the ones she wants (her note, Nov 3 2026). */}
          {button(t("path.dayAnswers"), () => { setOpen(null); onOpenDay(n.date); }, "plain")}
        </>
      );
    }
    // whole sentences, the day by name (QA, Nov 8 2026: "Tomorrow's questions open tomorrow", "In 2 days")
    if (n.kind === "future") {
      const d = new Date(); d.setDate(d.getDate() + n.offset);
      return head(dayTitle(isoDay(d)), n.offset === 1 ? t("path.opensTomorrow") : t("path.opensIn", { count: n.offset }));
    }
    if (n.kind === "chest") {
      return m.weekComplete ? (
        <>
          {head(t("path.reportReady"))}
          {/* teal like any step to do: gold is for what's done (Nov 10 2026) */}
          {button(t("path.openReport"), () => { setOpen(null); openThisChest(); })}
        </>
      ) : (
        head(reportLabel, t("path.toGo", { count: toGo }))
      );
    }
    // "Done for today": what's left, all optional (the week's report first when it's ready)
    if (n.kind === "end") {
      // before today is answered: say plainly it comes later, and take her to her step (phone test, Nov 7 2026)
      // with "Games and rewards" off it promises no bubbles: just how many steps are left
      // the bubbles are open any time of day (her note, Nov 12 2026: «полопать пузыри должно открываться в любой момент
      // дня… а это надо ждать вечера»); the rest of the end comes after the last step
      if (!eveningDone) return (<>{head(t("path.end.titleAhead"), playful ? t(new Date().getHours() >= 17 ? "path.end.notYetEvening" : "path.end.notYet", { count: openLeft }) : t("path.end.left", { count: openLeft }))}{playful && button(<><Wind className="h-5 w-5" strokeWidth={2.4} /> {t("path.popBubbles")}</>, () => { setOpen(null); track("end_card_action", { action: "bubbles_early" }); setUnloadOpen(true); }, "teal")}{button(t("tour.toStep"), () => { setOpen(null); window.dispatchEvent(new CustomEvent("memap-path-focus")); }, playful ? "plain" : undefined)}</>);
      const go = (f: () => void, action = "") => () => { setOpen(null); if (action) track("end_card_action", { action }); f(); };
      const ic = "h-5 w-5";
      // Links and the calendar only once there's something on them (her note, Nov 5
      // 2026: on day 1 "See your links" showed nothing; the first days have the
      // "discover" steps instead). The calendar button is named for her question.
      return (
        <>
          {/* a hurtful evening with a partner ends gently, no "Great work!" and no game (persona walk, Nov 9 2026) */}
          {/* "Games and rewards" off (Nov 9 2026): a neutral line, no bubbles, no next treasure */}
          {hardHome ? head(t("path.eveningSoft"), t("path.eveningSoftSub")) : playful ? head(t("path.eveningDone"), t("path.eveningDoneSub")) : head(t("path.eveningAll"))}
          {/* come back tomorrow, and what is waiting (her note, Nov 15 2026) */}
          {(() => {
            const evenings = countedDays(trackers, entries).length;
            const why = evenings < LINKS_AT ? t("path.comeBackLinks", { count: LINKS_AT - evenings }) : (m.reportIn ?? 0) > 0 ? t("path.comeBackReport", { count: m.reportIn }) : t("path.comeBackDefault");
            return (
              <div data-come-back className="mb-3 mt-1 flex items-center gap-3 rounded-[16px] bg-[hsl(var(--coin-teal)/0.1)] px-3.5 py-2.5">
                <MoonStar className="h-5 w-5 shrink-0 text-[hsl(var(--coin-teal))]" strokeWidth={2.4} />
                <span className="min-w-0">
                  <span className="block text-[15px] font-bold leading-snug">{t("path.comeBack")}</span>
                  <span className="block text-[13.5px] font-semibold text-muted-foreground">{why}</span>
                </span>
              </div>
            );
          })()}
          {hardHome && button(t("support.chip"), go(() => setSupport("home"), "support"), "teal")}
          {!hardHome && playful && button(<><Wind className={ic} strokeWidth={2.4} /> {t("path.popBubbles")}</>, go(() => setUnloadOpen(true), "bubbles"), "teal")}
          {/* the next treasure ("Moon · 3 evenings in a row" → You) is out for now: it said nothing she could use */}
          {void nextUp}{void nextTreasure}
          {m.weekComplete && button(<><FileBarChart2 className={ic} strokeWidth={2.4} /> {t("path.openReport")}</>, go(openThisChest, "report"))}
          {button(<><Plus className={ic} strokeWidth={2.4} /> {t("path.exploreQuestions")}</>, go(() => onTask("ownQuestion"), "questions"), "plain")}
          {hasLinks && button(<><Link2 className={ic} strokeWidth={2.4} /> {t("path.seeLinks")}</>, go(onOpenMap, "links"), "plain")}
          {m.totalDays >= 7 && button(<><CalendarDays className={ic} strokeWidth={2.4} /> {daysLabel}</>, go(() => onTask("calendar"), "calendar"), "plain")}
        </>
      );
    }
    const s = n.step;
    if (s.kind === "grew") return (s.grew?.length ?? 1) > 1 ? grewManyBody(s.grew!) : grewBody(s.island!);
    if (s.kind === "auto") {
      const door = getDoorState();
      if (s.auto === "start") return head(t("path.auto.start"), t("path.auto.startLine"));
      return head(s.auto === "topic" ? t("path.auto.topicBubble", { name: door ? t(`doors.${door.id}.name`) : "" }) : t("path.auto.firstBubble"));
    }
    if (s.kind === "act") {
      return (
        <>
          {head(stepName(s), t("act.sub", { count: s.trackerIds.length }))}
          {button(t("act.open"), () => { setOpen(null); openActionPoints(); }, "plain")}
        </>
      );
    }
    if (s.kind === "game") {
      if (!canPlay) return head(stepName(s), t("hunch.needTwo"));
      return (
        <>
          {head(stepName(s), s.done ? t("hunch.doneToday") : t("hunch.sub"))}
          {!s.done && button(t("hunch.guess"), () => startStep(s))}
        </>
      );
    }
    // "Unload your mind" and the week's test have no questions: their own card,
    // not the questions card (her note, Nov 5 2026: it said "0 answers").
    if (s.kind === "unload") {
      return (
        <>
          {head(t("unload.step"), s.done ? t("unload.doneToday") : t("unload.sub"))}
          {button(s.done ? t("unload.again") : playWord, () => startStep(s), s.done ? "plain" : "teal")}
        </>
      );
    }
    if (s.kind === "report") {
      return (
        <>
          {head(stepName(s), s.done ? t("path.done") : t("path.lastReportLine"))}
          {button(t("path.openReport"), () => startStep(s), s.done ? "plain" : "teal")}
        </>
      );
    }
    if (s.kind === "link") {
      return (
        <>
          {head(stepName(s), s.done ? t("path.done") : t("firstLink.sub"))}
          {!s.done && button(t("firstLink.see"), () => startStep(s))}
          {s.done && button(t("path.seeLinks"), () => { setOpen(null); onOpenMap(); }, "plain")}
        </>
      );
    }
    if (s.kind === "tip") {
      return (
        <>
          {head(stepName(s), tipTitle(s.tipId))}
          {button(t("tipDay.open"), () => startStep(s), s.done ? "plain" : "teal")}
        </>
      );
    }
    // "Why?": the answers it asks about, Add, and Skip (never asked about again); once done, where they're kept
    if (s.kind === "why") {
      if (s.done) {
        return (
          <>
            {head(stepName(s), s.skipped ? t("path.skipped") : t("path.done"))}
            {button(t("why.inNotes"), () => { setOpen(null); window.dispatchEvent(new CustomEvent("memap-open-notes", { detail: {} })); }, "plain")}
          </>
        );
      }
      return (
        <>
          {head(stepName(s), whySub)}
          {button(t("why.answer"), () => startStep(s))}
          <button type="button" onClick={() => {
            setOpen(null);
            markAsked(whyPending.map(reasonKey), "skipped", isoDay(new Date()), true);
            track("reasons_skipped", { answers: whyPending.length, from: "path" });
            setTick((k) => k + 1);
          }} className="mt-1 h-10 w-full text-[15px] font-semibold text-muted-foreground">
            {t("common.skip")}
          </button>
        </>
      );
    }
    if (s.kind === "discover") {
      return (
        <>
          {head(stepName(s), t("tour.stepSub"))}
          {button(s.done ? t("tour.again") : t("tour.go"), () => startStep(s), s.done ? "plain" : "teal")}
        </>
      );
    }
    if (s.kind === "test") {
      return (
        <>
          {head(stepName(s), (() => { const x = runningExperiments().find((e) => experimentOver(e)); return x ? testNameOf(x.change) : t("experiment.stepSub"); })())}
          {button(t("experiment.seeResult"), () => startStep(s))}
        </>
      );
    }
    if (s.kind === "task" && s.task === "note" && s.done && !s.skipped) {
      return (
        <>
          {head(t("path.task.note.title"), t("path.done"))}
          {button(t("path.noteAnother"), () => { setOpen(null); setNoteDraft(newDraft()); }, "plain")}
          <button type="button" onClick={() => { setOpen(null); window.dispatchEvent(new CustomEvent("memap-open-notes", { detail: {} })); }}
            className="mt-1 h-10 w-full text-[15px] font-semibold text-muted-foreground">{t("path.allNotes")}</button>
        </>
      );
    }
    if (s.kind === "task") {
      return (
        <>
          {head(t(`path.task.${s.task}.title`), s.done ? (s.skipped ? t("path.skipped") : t("path.done")) : t(`path.task.${s.task}.line`))}
          {!s.done && button(t("act.open"), () => startStep(s))}
          {/* skipped today: it can still be done (her note, Nov 12 2026) */}
          {s.done && s.skipped && button(t("act.open"), () => { unskipTask(s.task!); setTick((k) => k + 1); track("path_step_unskipped", { task: s.task }); startStep(s); }, "plain")}
          {!s.done && (
            <button type="button" onClick={() => { setOpen(null); skipTask(s.task!); setTick((k) => k + 1); }} className="mt-1 h-10 w-full text-[15px] font-semibold text-muted-foreground">
              {t("path.skip")}
            </button>
          )}
        </>
      );
    }
    const left = s.trackerIds.length - s.answered;
    return (
      <>
        {head(
          stepName(s),
          s.done
            ? t("path.answers", { count: s.answered })
            : t(s.answered > 0 ? "path.leftLong" : "path.howLong", { count: left, min: minutesFor(left) }),
        )}
        {s.answered > 0 && dots(s.trackerIds, isoDay(new Date()))}
        {/* Early in the day: answer what already happened, the rest tonight. */}
        {!s.done && s.kind === "questions" && new Date().getHours() < 17 && (
          <p className="mt-2 text-[15px] font-medium leading-snug text-muted-foreground">{t(s.tonight ? "path.tonightLine" : "path.earlyHint")}</p>
        )}
        {!s.done && button(<>{s.tonight ? t("path.answerNow") : s.answered > 0 ? t("path.continue") : t("path.start")} <ArrowRight className="h-4 w-4" /></>, () => startStep(s), s.tonight ? "plain" : undefined)}
        {s.done && s.kind === "questions" && button(t("path.changeAnswers"), () => { setOpen(null); onStartStep(s, stepName(s), true); }, "plain")}
      </>
    );
  };

  const bubble = (i: number) => {
    const p = stops[i];
    const w = Math.min(width - 16, 300);
    const left = Math.max(8, Math.min(p.x - w / 2, width - w - 8));
    const above = p.y > height - 260;
    const caret = Math.max(18, Math.min(p.x - left, w - 18));
    return (
      <div className="absolute z-20" style={{ left, width: w, top: above ? p.y - p.r - 12 : p.y + p.r + 12, transform: above ? "translateY(-100%)" : undefined }}>
        <div ref={bubbleRef} role="dialog" className="path-bubble surface relative rounded-[20px] px-4 py-3.5" style={{ transformOrigin: `${caret}px ${above ? "100%" : "0"}` }}>
          <span
            aria-hidden="true"
            className="surface absolute h-4 w-4 rotate-45 rounded-[3px]"
            style={{ left: caret - 8, ...(above ? { bottom: -7, borderTop: 0, borderLeft: 0 } : { top: -7, borderBottom: 0, borderRight: 0 }), boxShadow: "none" }}
          />
          <div className="relative">{bubbleBody(i)}</div>
        </div>
      </div>
    );
  };

  // days from today to next week's first day
  const comingAfter = DAYS_PER_WEEK - m.dayInWeek;
  const pastFrom = Math.max(0, m.pastWeeks.length - pastShown);

  // Malu's tip (her note, Nov 7 2026: "нажимаешь на барашка — подсказка"): a tap on the
  // boat shows one tip from Malu, the next tap the next one; "You" opens You as before.
  const maluTips = [
    { id: "avatar", line: t("tips.maluAvatar", { you: t("map.you") }), go: t("tips.maluAvatarGo"), act: () => { window.dispatchEvent(new CustomEvent("memap-pick-avatar")); } },
    { id: "question", line: t("tips.maluQuestion"), go: t("tips.maluQuestionGo"), act: () => window.dispatchEvent(new CustomEvent("memap-add-question")) },
    { id: "how", line: t("tips.maluHow"), go: t("tips.maluHowGo"), act: () => window.dispatchEvent(new CustomEvent("memap-open-how")) },
    ...(m.totalDays >= 5 ? [{ id: "report", line: t("tips.maluReport"), go: t("tips.maluReportGo"), act: () => window.dispatchEvent(new CustomEvent("memap-doctor-report")) }] : []),
  ];
  const tipNow = maluTip === null ? null : maluTips[maluTip % maluTips.length];

  // A fragment, so the week card's sticky range is all of Today.
  return (
    <>
      {/* An old user's days before the path began: one chip, no empty weeks. */}
      {m.prior > 0 && (
        <div>
          <div data-wheel>
            <p className="surface mx-auto -mt-1 mb-2 w-fit rounded-full px-3.5 py-1.5 text-[14px] font-semibold text-muted-foreground">
              {t("path.priorDays", { count: m.prior })}
            </p>
          </div>
        </div>
      )}
      {pastFrom > 0 && (
        <div>
          <div data-wheel>
            <button type="button" onClick={() => setPastShown((n) => n + 4)} className="surface mx-auto block h-10 rounded-full px-4 text-[14px] font-semibold text-foreground">
              {t("path.earlierWeeks", { count: pastFrom })}
            </button>
          </div>
        </div>
      )}
      {m.pastWeeks.slice(pastFrom).map((pw, j) => {
        const w = pastFrom + j;
        return (
          <WeekStrip key={w} week={w} width={width} kind="past" dates={pw.dates} answered={pw.answered} quiet={pw.quiet} chest={chests[w] ?? null}
            onOpenDay={onOpenDay} onOpenChest={() => setChestOpen({ week: w, dates: pw.dates })} />
        );
      })}

      {/* a run of one only says "you missed yesterday" (persona walk, Nov 9 2026): from two evenings in a row */}
      {/* the flame is a game: not with "Games and rewards" off (Nov 9 2026) */}
      {headerSlot && playful && m.streak > 1 && createPortal(
        <span aria-label={t("path.streakAria", { count: m.streak })} className="surface inline-flex h-9 items-center gap-1 rounded-full pl-2 pr-3 text-[16px] font-bold tabular-nums text-foreground">
          <Flame className="h-[18px] w-[18px] fill-amber-400 text-amber-500" strokeWidth={2} />
          {m.streak}
        </span>,
        headerSlot,
      )}
      {/* the header's title is the day in view (the week strip under it, Nov 15 2026) */}
      {headerTitle && createPortal(
        <span data-strip-day-line aria-live="polite" className={cn("whitespace-nowrap text-[16px] font-bold leading-[1.5] tracking-tight", stripLine.today ? "text-[hsl(var(--coin-teal))]" : "text-foreground")}>
          {stripLine.day}
          {stripLine.missed && <span data-strip-sub className="font-semibold text-muted-foreground"> · {t("path.notFilled")}</span>}
        </span>,
        headerTitle,
      )}

      {/* The week starts with its name, plain (her note: the card that
          rolled with the path was "уродская плашка"). */}
      <div className="mt-2">
        <div data-wheel className="mx-auto w-fit max-w-[92%]">
          <p className="path-week-label">{t("path.weekTitle", { n: m.week + 1, title })}</p>
          <button type="button" disabled={!weekNext.open} onClick={() => { haptics.tap(); window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: weekNext.open === "world" ? { tab: "patterns" } : { tab: "patterns", open: "all", section: weekNext.open, back: true } })); }}
            className="surface mx-auto mt-2 flex h-9 max-w-full items-center gap-1.5 rounded-full px-3.5 text-[14px] font-bold">
            <span className="truncate">{weekNext.text}</span>
          </button>
        </div>
        {/* two weeks of hard mood: talk to someone (comes back weekly while it lasts) */}
        {heavyMood && (
          <div className="mx-auto mt-3 w-[92%] max-w-[420px]">
            <TipCard id={`mood14-${Math.floor(Date.now() / 6048e5)}`} title={t("tips.moodTitle")} line={t("tips.moodLine")} action={t("tips.moodGo")}
              onAction={() => setSupport("mood")} />
          </div>
        )}
        {/* a hurt evening opens the afraid-at-home version (review, Nov 9 2026) */}
        <SupportSheet open={!!support} onClose={() => setSupport(null)} about={support === "home" ? "partner-raised-voice" : null} />
        {/* came from the old look: the way back stays in sight above the tabs (the path
            scrolls to today, so a card in the path would be out of view); at the top, solid,
            away from the "grew" toasts at the bottom */}
        {fromOld && oldLookShown && !touring && (
          <div ref={(el) => { if (el && el.offsetHeight !== oldH) setOldH(el.offsetHeight); }} className="fixed inset-x-0 z-30 mx-auto w-[92%] max-w-[420px]" style={{ top: `calc(env(safe-area-inset-top) + ${64 + stripH}px)` }}>
            <TipCard id="old-look" title={t("tips.oldLookTitle")} line={t("tips.oldLookLine")} action={t("upgrade.oldLook")} onAction={() => switchToOld("card")}
              secondary={t("upgrade.keepNew")} onSecondary={() => track("ui_kept_new")} className="!bg-background shadow-[0_14px_30px_-12px_rgba(16,42,56,0.35)]" />
          </div>
        )}
        {/* after the 10th answered evening, once: keep the games and rewards? (Nov 9 2026). In sight
            like the old-look card (the path scrolls to today's step, so a card above it is out of view):
            at the top, solid, a tip's look with two answers */}
        {askPlayful && (
          <div className="fixed inset-x-0 z-30 mx-auto w-[92%] max-w-[420px]" style={{ top: `calc(env(safe-area-inset-top) + ${64 + stripH}px)` }}>
            <div data-playful-ask role="group" aria-label={t("playful.ask")} className="surface relative flex shrink-0 gap-3 rounded-[20px] !bg-background p-3 shadow-[0_14px_30px_-12px_rgba(16,42,56,0.35)] animate-fade-in">
              {maluPic() && <img src={maluPic()!} alt="" width={44} height={44} className="h-11 w-11 shrink-0 object-contain" />}
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-bold leading-snug">{t("playful.ask")}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => answerPlayful(true)} className="raised-btn is-small justify-center px-3">{t("playful.keep")}</button>
                  <button type="button" onClick={() => answerPlayful(false)} className="quiet-btn h-[50px] px-3 text-[16px]">{t("playful.off")}</button>
                </div>
                <p className="mt-2 text-[14px] font-semibold leading-snug text-muted-foreground">{t("playful.line")}</p>
              </div>
            </div>
          </div>
        )}
        {/* after a few evenings: there is a report for a doctor */}
        {/* not under the old-look card, which stands over this spot in the first week (old-user walk, Nov 14 2026);
            the report stays in World → Share */}
        {reportTipOn && (
          <div className="mx-auto mt-3 w-[92%] max-w-[420px]">
            <TipCard id="report" title={t("tips.reportTitle")} line={t("tips.reportLine")} action={t("tips.reportGo")}
              onAction={() => window.dispatchEvent(new CustomEvent("memap-doctor-report"))} />
          </div>
        )}
      </div>


      {/* The path. */}
      <section aria-label={title} className="animate-fade-in" style={{ marginTop: 14 }}>
        {/* overflow-x clip: the wheel's tilt must never widen the page (the
            review found a sideways pan); nothing visible is cut. */}
        <div ref={boxRef} className="path-box relative mx-auto [overflow-x:clip]" style={{ width, height }}>

          {nodes.map((n, i) => {
            const v = viewOf(n, i);
            const p = stops[i];
            const act = v.action
              ? n.kind === "step" ? () => startStep(n.step) : n.kind === "end" ? () => tap(i) : n.kind === "chest" ? openThisChest : undefined
              : undefined;
            const lockedGame = n.kind === "step" && n.step.kind === "game" && !canPlay && !n.step.done;
            // a quiet week: one line where the report would stand, nothing to tap
            if (n.kind === "chest" && quietChest) {
              return (
                <div key={i} data-wheel data-cy={p.y} data-day={dayOfNode(i)} className="relative" style={{ transformOrigin: `${p.x}px ${p.y}px` }}>
                  <QuietLine stop={p} text={t("path.quietWeek")} />
                </div>
              );
            }
            return (
              <div key={i} data-wheel data-cy={p.y} data-day={dayOfNode(i)} className="relative" style={{ transformOrigin: `${p.x}px ${p.y}px`, zIndex: open === i ? 6 : undefined }}>
                {/* her animal stands beside her step, rolls with it, and opens You */}
                {i === focus && avatar && (
                  <button type="button" aria-label={t("map.you")} onClick={() => { haptics.tap(); nextMaluTip(); }}
                    className="path-boat absolute z-[4] transition-transform duration-150 active:scale-95" style={{ left: avatar.x, top: avatar.y, width: avatar.w, height: avatar.h }}>
                    <span className="bob">
                      <img className="art-day" src={mapPicFor("sailboat", false)} alt="" />
                      <img className="art-night" src={mapPicFor("sailboat", true)} alt="" />
                      {avatarPic && <img className="who" src={avatarPic} alt="" />}
                    </span>
                  </button>
                )}
                {i === focus && avatar && !tipNow && orderTip && m.totalDays < 5 && (openLeft >= 2 || shortOnb) && (
                  <div className="malu-tip surface absolute z-[8] w-[270px] rounded-[18px] px-3.5 py-3 animate-fade-in" role="note"
                    style={{ left: Math.max(8, Math.min(f.x - 135, width - 278)), top: f.y - f.r - 86, transform: "translateY(-100%)" }}>{/* clear of the Start bubble (68px above the light, bobbing 4px): it covered "Start" (r65, Nov 9 2026) */}
                    <p className="text-[16px] font-bold leading-snug">{t(shortOnb ? "tips.stepsTitle" : "tips.anyOrderTitle")}</p>
                    <p className="mt-0.5 text-[15px] font-semibold leading-snug text-muted-foreground">{t(shortOnb ? "tips.stepsLine" : "tips.anyOrderLine")}</p>
                    <button type="button" onClick={closeOrderTip} className="raised-btn is-small mt-2 px-5">{t("tips.anyOrderOk")}</button>
                  </div>
                )}
                {i === focus && avatar && tipNow && (
                  <div className="malu-tip surface absolute z-[8] w-[248px] rounded-[18px] px-3.5 py-3 animate-fade-in" role="dialog"
                    style={{ left: Math.max(8, Math.min(avatar.x + avatar.w / 2 - 124, width - 256)), top: avatar.y - 12, transform: "translateY(-100%)" }}>
                    <p className="text-[15px] font-semibold leading-snug">{tipNow.line}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <button type="button" onClick={() => { haptics.tap(); setMaluTip(null); tipNow.act(); }} className="raised-btn is-small px-4">{tipNow.go}</button>
                      <button type="button" onClick={() => { haptics.tap(); setMaluTip(null); window.dispatchEvent(new CustomEvent("memap-open-you")); }} className="h-10 px-2 text-[15px] font-bold text-muted-foreground">{t("map.you")}</button>
                      <button type="button" onClick={() => { haptics.tap(); setMaluTip(null); }} aria-label={t("common.close")} className="ml-auto h-10 px-2 text-[15px] font-bold text-muted-foreground">×</button>
                    </div>
                  </div>
                )}
                {/* no names on the lights (her: "как у дуолинго и попроще"); over her
                    step one short word that starts it, pointing at its light */}
                {i === currentNode && open !== i && act && (
                  <StartBubble stop={p} label={v.action ?? t("path.start")} aria={`${v.title}: ${v.action ?? t("path.start")}`} onClick={act} />
                )}
                <LightLabel stop={p} text={v.title} dim={v.look === "locked" || v.look === "empty" || lockedGame} below={i === currentNode ? 10 : 0} boxW={width} />
                <PathNode stop={p} look={lockedGame ? "locked" : v.look} hue={v.hue} label={v.title} onClick={() => tap(i)} dataStop={i}
                  refEl={i === focus ? focusRef : undefined} expanded={open === i} wiggle={wiggle === i}>
                  {v.icon}
                </PathNode>
                {open === i && bubble(i)}
              </div>
            );
          })}
        </div>
      </section>

      {/* Two coming weeks, quiet, so the path never just ends. */}
      {[1, 2].map((n) => (
        <WeekStrip key={`c${n}`} week={m.week + n} width={width} kind="coming" firstOffset={comingAfter + (n - 1) * DAYS_PER_WEEK} />
      ))}

      <NoteSheet draft={noteDraft} setDraft={setNote} trackers={active} onSaved={() => { noteSaved.current = true; loadNotes(); }}
        footer={
          <div className="mt-2 flex items-center justify-between">
            <button type="button" onClick={() => { setNote(null); window.dispatchEvent(new CustomEvent("memap-open-notes", { detail: {} })); }}
              className="h-11 px-2 text-[15px] font-semibold text-[hsl(var(--coin-teal))]">{t("path.allNotes")}</button>
            {m.steps.some((st) => st.kind === "task" && st.task === "note" && !st.done) && (
              <button type="button" onClick={() => setNote(null)}
                className="h-11 px-2 text-[15px] font-semibold text-muted-foreground">{t("path.skip")}</button>
            )}
          </div>
        } />


      {/* missed days: a calm card at the top, in sight like the cards above (the path scrolls to today's
          step), solid; a chip per day opens that evening's questions; "Not now" hides it until another
          day is missed. Not while another card holds the spot, or Malu's first tip is up. */}
      {fillCardOn && !askPlayful && !(orderTip && m.totalDays < 5 && (openLeft >= 2 || shortOnb)) && (
        <div ref={fillCardRef} className="fixed inset-x-0 z-30 mx-auto w-[92%] max-w-[420px]" style={{ top: `calc(env(safe-area-inset-top) + ${64 + stripH + (fromOld && oldLookShown && !touring && oldH ? oldH + 8 : 0)}px)` }}>
          <div data-fill-card role="group" aria-label={t("path.fillCard", { count: missedToFill.length })}
            className="surface relative rounded-[20px] !bg-background p-3.5 shadow-[0_14px_30px_-12px_rgba(16,42,56,0.35)] animate-fade-in">
            <p className="text-[16px] font-bold leading-snug">{t("path.fillCard", { count: missedToFill.length })}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {missedToFill.map((d) => (
                <button key={d} type="button" data-fill-day={d} onClick={() => { haptics.tap(); track("fill_day_opened", { ago: Math.round((Date.parse(isoDay(new Date())) - Date.parse(d)) / 864e5), from: "card" }); fillMissed(d); }}
                  className="quiet-btn h-10 px-3.5 tabular-nums">{shortDay(d)}</button>
              ))}
              <button type="button" onClick={() => {
                haptics.tap();
                const all = [...new Set([...fillHidden, ...missedToFill])].sort().slice(-30);
                try { localStorage.setItem(FILL_HIDDEN_KEY, JSON.stringify(all)); } catch { /* it shows again, harmless */ }
                setFillHidden(all);
                track("fill_card_hidden", { days: missedToFill.length });
              }} className="ml-auto h-10 px-2 text-[15px] font-semibold text-muted-foreground">{t("path.fillNotNow")}</button>
            </div>
          </div>
        </div>
      )}

      {/* The week strip (her pick, board E; no card since her note, Nov 15 2026): seven days in a row of the header;
          gold = answered, pale = not filled, today teal; the day in view lights up (no ring around it) */}
      {headerBelow && createPortal(
        <div ref={(el) => { stripRef.current = el; if (el && el.offsetHeight !== stripH) setStripH(el.offsetHeight); }}
          data-week-strip data-tour="week" className="mx-auto grid max-w-[420px] grid-cols-7 justify-items-center pb-2">
          {m.weekDates.map((d) => {
            const done = m.pastInWeek.includes(d) || (d === todayIso && m.todayCounted);
            const isToday = d === todayIso;
            const ahead = d > todayIso;
            const on = d === inView;
            const letter = new Date(d + "T00:00:00").toLocaleDateString(lang, { weekday: "narrow" });
            const glow = done ? "shadow-[0_0_14px_5px_hsl(43_96%_58%/0.8)]" : isToday ? "shadow-[0_0_14px_5px_hsl(var(--coin-teal)/0.6)]" : "shadow-[0_0_14px_5px_rgba(255,255,255,0.95)]";
            return (
              <button key={d} type="button" data-strip-cell={d} aria-label={dayTitle(d)} aria-current={on ? "date" : undefined} onClick={() => goToDay(d)}
                className="grid h-10 w-10 place-items-center rounded-full">
                <span className={cn("grid h-7 w-7 place-items-center rounded-full text-[12px] font-extrabold transition-[transform,box-shadow] duration-300",
                  done ? "bg-[linear-gradient(180deg,#FFD866_0%,#F6B92B_100%)] text-white"
                    : isToday ? "bg-[hsl(var(--coin-teal)/0.16)] text-[hsl(var(--coin-teal))]"
                    : ahead ? "bg-white/40 text-foreground/55 dark:bg-white/10"
                    : "bg-white/55 text-foreground/50 dark:bg-white/15",
                  on && cn("scale-[1.18]", glow))}>{letter}</span>
              </button>
            );
          })}
        </div>,
        headerBelow,
      )}

      {/* Away from her step: back to it, her avatar on the button. */}
      {away && createPortal(
        <button type="button" onClick={backToStep}
          className="fixed right-4 z-[30] flex h-12 items-center gap-2 rounded-full bg-white pl-1.5 pr-3.5 text-[15px] font-extrabold text-foreground shadow-lg animate-fade-in active:scale-95 transition-transform dark:bg-[hsl(var(--surface))]"
          style={{ bottom: "calc(7.5rem + env(safe-area-inset-bottom, 0px))" }}>
          {avatarPic
            ? <img src={avatarPic} alt="" className="h-9 w-9 rounded-full bg-sky-50 object-contain p-0.5 ring-2 ring-[hsl(var(--coin-teal))] dark:bg-[hsl(var(--surface))]" />
            : <span className="h-9 w-9 rounded-full bg-foreground/[0.06]" />}
          {t("path.backToStep")}
          {away === "up" ? <ChevronUp className="h-5 w-5 text-[hsl(var(--coin-teal))]" strokeWidth={2.6} /> : <ChevronDown className="h-5 w-5 text-[hsl(var(--coin-teal))]" strokeWidth={2.6} />}
        </button>,
        document.body,
      )}

      {grewNow && createPortal(
        <button type="button" onClick={() => { const island = grewNow; setGrewNow(null); window.dispatchEvent(new CustomEvent("memap-grow-moment", { detail: { island, stage: stageOf(evenings.get(island) ?? 0) } })); }}
          className="grew-toast fixed left-4 right-4 z-[40] flex items-center gap-3 rounded-[22px] bg-white p-3 pr-4 text-left shadow-[0_14px_34px_-14px_rgba(20,40,90,.55)] dark:bg-[hsl(var(--surface))]"
          style={{ bottom: "calc(7.5rem + env(safe-area-inset-bottom, 0px))" }}>
          {islandPic(grewNow, 78)}
          <span className="min-w-0">
            <span className="block text-[18px] font-bold leading-tight">{t("path.grew", { name: islandName(t, grewNow) })}</span>
            <span className="mt-0.5 block text-[15px] font-medium text-muted-foreground">{stageLine(grewNow)}</span>
          </span>
        </button>,
        document.body,
      )}

      {unloadOpen && <UnloadGame onClose={() => { setUnloadOpen(false); setTick((k) => k + 1); }} />}

      {testOpen && (
        <ExperimentSheet mode={testOpen} experiment={testOpen === "result" ? runningExperiments().find((x) => experimentOver(x)) ?? null : currentExperiment()} trackers={trackers} entries={entries}
          onClose={() => { setTestOpen(null); setTick((k) => k + 1); }} />
      )}

      <ObserveTipSheet id={tipOpen} because={tipOpen ? trackers.find((tr) => tr.id === tipFor(tipOpen)) : undefined} onClose={() => { setTipOpen(null); setTick((k) => k + 1); }} />

      <ReasonSheet items={whyItems} mode="ask" trackers={trackers} entries={entries} onClose={() => { setWhyItems(null); setTick((k) => k + 1); }} />

      {gameOpen && (
        <HunchGame trackers={trackers} entries={entries} onClose={() => { setGameOpen(false); setTick((k) => k + 1); }} />
      )}

      {chestOpen && (
        <WeekChest week={chestOpen.week} dates={chestOpen.dates} trackers={trackers} entries={entries}
          // closing the report counts it as read on the path at once (new-user walk, Nov 14 2026: the step stayed lit
          // and opened the same report again until something else changed)
          onClose={() => { setChestOpen(null); setTick((k) => k + 1); }} onPlaced={() => { setChestOpen(null); setTick((k) => k + 1); onOpenMap(); }} />
      )}
    </>
  );
};
