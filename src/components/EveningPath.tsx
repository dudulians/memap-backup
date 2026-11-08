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
import { TipCard, tipSeen } from "./Tips";
import { switchToOld } from "./UpgradeInvite";
import { SupportSheet } from "./SupportSheet";
import { HEAVY_MOOD_IDS } from "@/lib/supportLines";
import { templateIdOf as moodTemplateOf } from "@/lib/answerPhrases";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, BarChart3, CalendarDays, Check, ChevronDown, ChevronRight, ChevronUp, Compass, FileBarChart2, Flag, FlaskConical, Flame, Layers, Lightbulb, Link2, Wind, Map as MapIcon, MoonStar, PenLine, Plus, Sparkles, Sprout, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { playWheelTick, preloadSounds } from "@/lib/feedback";
import { isoDay } from "@/lib/eveningPath";
import { DAYS_PER_WEEK, getChests, markActSeen, pastDays, pathModel, skipTask, syncTasks, type Step, type TaskId } from "@/lib/pathSteps";
import { buildIslands, buildRoutes } from "@/lib/islands";
import { ITEMS, itemProgress, owned, worldFacts, type ItemId } from "@/lib/growth";
import { ExperimentSheet } from "@/components/ExperimentSheet";
import { UnloadGame } from "@/components/UnloadGame";
import { currentExperiment, experimentDay, EXPERIMENT_DAYS } from "@/lib/experiments";
import { testNameOf } from "@/lib/testWords";
import { computeCorrelations } from "@/lib/correlations";
import { linkWorthShowing } from "@/lib/islands";
import { litTrackers } from "@/lib/lighthouses";
import { isHardAnswer, isNeutralQuestion, islandDef, islandName, mapPicFor, type IslandId } from "@/lib/islands";
import { art, artOf, islandEvenings, stageOf, toNextStage } from "@/lib/globeArt";
import { islandHsl } from "@/lib/islandColors";
import { NoteSheet, newDraft, type NoteDraft } from "@/components/NoteSheet";
import { getDoorState, isoLocal } from "@/lib/doors";
import { getNotes } from "@/lib/notes";
import { DAY_AHEAD, LightLabel, PathNode, R_CHEST, R_CURRENT, R_DAY, R_STEP, StartBubble, WEEK_TITLES, WeekStrip, islandIcon, weekStops, type NodeLook } from "@/components/PathParts";
import { WeekChest } from "@/components/WeekChest";
import { HunchGame } from "@/components/HunchGame";
import { hunchTarget, readyHunch } from "@/lib/hunches";
import { avatarUrl, getAvatar } from "@/lib/avatar";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { track } from "@/lib/analytics";

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
  | { kind: "step"; step: Step }
  /** "Done for today": the last light of today (her note, Nov 5 2026: the app
   *  should always say what's next, then "всё, можешь шарики полопать…") */
  | { kind: "end" }
  | { kind: "future"; offset: number }
  | { kind: "chest" };
type Open = number | null;

/** Day 1, she chose to start tonight (onboarding v7): no "fill in yesterday" that day. */
/** the onboarding day: no past-day pill yet */
const firstDayTonight = () => {
  try { return localStorage.getItem("memap_first_day_at") === isoLocal(new Date()); } catch { return false; }
};

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
  onFillDay: (date: string, redo?: boolean) => void;
  /** Look at a past day. */
  onOpenDay: (date: string) => void;
}) => {
  const { t, i18n } = useTranslation();

  // Note days for the "Write a note" task; task records settle before the model.
  const [noteDays, setNoteDays] = useState<string[] | null>(null);
  const loadNotes = () =>
    getNotes()
      .then((ns) => setNoteDays(ns.map((n) => isoDay(new Date(n.createdAt))).sort()))
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
  const m = useMemo(() => {
    const draft = pathModel(trackers, entries);
    if (noteDays === null) return draft;
    syncTasks(trackers, noteDays, draft.week);
    return pathModel(trackers, entries);
  }, [trackers, entries, noteDays, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = useMemo(() => trackers.filter((tr) => !tr.archived && tr.source !== "play"), [trackers]);
  // low mood or no interest on 12 of the last 14 days: a doctor or therapist (when-to-act.md)
  const heavyMood = useMemo(() => {
    const now = new Date();
    const start = isoLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13)), end = isoLocal(now);
    return active.some((tr) => HEAVY_MOOD_IDS.has(moodTemplateOf(tr) ?? "")
      && new Set(entries.filter((e) => e.trackerId === tr.id && e.date >= start && e.date <= end && e.value === (tr.problemWhen === "yes")).map((e) => e.date)).size >= 12);
  }, [active, entries]);
  const [support, setSupport] = useState(false);
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
  useEffect(() => { if (!fromOld) return; const id = window.setTimeout(() => setOldLookShown(true), 3200); return () => window.clearTimeout(id); }, [fromOld]);
  // links on her map (the World's dotted lines): "See your links" waits for the first one
  const world = useMemo(() => { const islands = buildIslands(trackers, entries); return { islands, routes: buildRoutes(trackers, entries, islands) }; }, [trackers, entries]);
  const hasLinks = world.routes.length > 0;
  // The next treasure (Nov 6 2026, her pick from the hooks): the one she's closest to,
  // said on "Done for today" with how far she is and what tomorrow brings — a reason
  // to come back. Ties go to the shorter way.
  const nextUp = useMemo(() => {
    const f = worldFacts(trackers, entries, world.islands, world.routes, noteDays?.length ?? 0);
    const left = ITEMS.filter((it) => !owned(it.id, f)).map((it) => { const [k, n] = itemProgress(it.id, f); return { id: it.id, pic: it.pic, k, n }; }).filter((x) => x.n > 0 && x.k < x.n);
    left.sort((a, b) => b.k / b.n - a.k / a.n || a.n - b.n);
    return left[0] ?? null;
  }, [trackers, entries, world, noteDays]);
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
  const steps = useMemo(() => m.steps.filter((s) => s.kind !== "fill" || s.onPath), [m]);
  // A past day to fill in (her note, Nov 6 2026: "дать возможность заполнять за
  // прошлые дни, как у меня было"): the latest of the last 3 days without its
  // answers, on a pill that stays in sight; the evening card then shows all 7 days.
  // Not while yesterday waits on the path itself (day 1 morning).
  const pastPick = useMemo(() => (m.steps.some((s) => s.onPath) || firstDayTonight() ? null : pastDays(trackers, entries).slice(-3).reverse().find((d) => d.state !== "done") ?? null), [m, trackers, entries]);
  const nodes: PNode[] = useMemo(() => {
    const out: PNode[] = m.pastInWeek.map((date) => ({ kind: "past" as const, date }));
    for (const step of steps) out.push({ kind: "step", step });
    if (steps.length > 0) out.push({ kind: "end" });
    const coming = m.weekComplete ? 0 : DAYS_PER_WEEK - 1 - m.pastInWeek.length;
    for (let o = 1; o <= coming; o++) out.push({ kind: "future", offset: o });
    out.push({ kind: "chest" });
    return out;
  }, [m, steps]);
  const firstStep = m.pastInWeek.length;
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
  const openLeft = steps.filter((s) => isOpenStep(s) && s.kind !== "unload").length;
  const endNode = steps.length > 0 ? firstStep + steps.length : -1;
  const cur = firstOpen;
  const currentNode = cur >= 0 ? firstStep + cur : eveningDone ? endNode : -1;
  const chestIndex = nodes.length - 1;
  // The node to bring into view: the current step (or "Done for today"), else
  // the reward, else tomorrow.
  const focus = currentNode >= 0 ? currentNode : m.weekComplete ? chestIndex : firstStep + steps.length;

  const stops = useMemo(() => {
    // room above her step for its Start bubble (the first light included)
    const out = weekStops(width, nodes.map((n, i) => (n.kind === "chest" ? R_CHEST : n.kind === "step" || n.kind === "end" ? (i === currentNode ? R_CURRENT : R_STEP) : R_DAY)), 74);
    if (currentNode > 0) for (let k = currentNode; k < out.length; k++) out[k] = { ...out[k], y: out[k].y + 70 };
    return out;
  }, [nodes, width, currentNode]);
  const height = stops[chestIndex].y + R_CHEST + 56;

  // --- Words ---------------------------------------------------------------
  const reportLabel = m.week === 0 ? t("path.firstReport") : t("path.weekReport");
  const lang = i18n.language?.startsWith("ru") ? "ru-RU" : "en-US";
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const dayTitle = (iso: string) => cap(new Date(iso + "T00:00:00").toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" }));
  const weekdayName = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString(lang, { weekday: "long" });
  const answersOn = (date: string) => {
    const ids = new Set(active.map((tr) => tr.id));
    return new Set(entries.filter((e) => e.date === date && ids.has(e.trackerId)).map((e) => e.trackerId)).size;
  };
  const stepName = (s: Step) => {
    if (s.kind === "auto") return t(s.auto === "topic" ? "path.auto.topic" : "path.auto.first");
    if (s.kind === "grew") return t("path.grew", { name: islandName(t, s.island!) });
    if (s.kind === "fill") return s.onPath ? t("path.fillYesterday") : t("path.fillTitle", { day: weekdayName(s.date!) });
    if (s.kind === "game") return t("hunch.step");
    if (s.kind === "act") return t("act.step");
    if (s.kind === "test") return t("experiment.stepDone");
    if (s.kind === "unload") return t("unload.step");
    if (s.kind === "task") return t(`path.task.${s.task}.title`);
    if (s.kind === "discover") return t("tour.step");
    if (s.kind === "link") return t("firstLink.step");
    if (s.added) return t("path.newQuestionsTitle");
    const name = s.island ? islandName(t, s.island) : t(s.mixed === "all" ? "path.allQuestions" : "path.mixed");
    return name + (s.part ? ` ${s.part[0]}/${s.part[1]}` : "");
  };

  /** What a node looks like and says. */
  /** A step's own calm colour: its island, else what kind of step it is. */
  const hueOf = (s: Step): string => {
    if ((s.kind === "questions" || s.kind === "grew") && s.island) return islandHsl(s.island);
    // a task: rose (gold is for what's done)
    if (s.kind === "task") return "350 60% 66%";
    if (s.kind === "game") return "262 40% 64%";
    if (s.kind === "act") return "16 72% 62%";
    if (s.kind === "test") return "152 36% 46%";
    if (s.kind === "unload") return "198 55% 58%";
    if (s.kind === "fill") return "205 46% 58%";
    if (s.kind === "link") return "174 52% 42%";
    return "var(--coin-teal)";
  };
  const viewOf = (n: PNode, i: number): { look: NodeLook; icon: ReactNode; title: string; sub?: string; action?: string; hue?: string } => {
    const current = i === currentNode;
    if (n.kind === "past") return { look: "done", icon: <Check className="h-6 w-6" strokeWidth={3} />, title: cap(weekdayName(n.date)) };
    if (n.kind === "future") {
      return { look: "locked", hue: DAY_AHEAD, icon: <MoonStar className="h-6 w-6" strokeWidth={2} />, title: n.offset === 1 ? t("path.tomorrow") : cap(addDays(new Date(), n.offset).toLocaleDateString(lang, { weekday: "long" })) };
    }
    if (n.kind === "chest") {
      return m.weekComplete
        ? { look: "gold", icon: <FileBarChart2 className="h-7 w-7" strokeWidth={2.2} />, title: t("path.reportReady"), action: currentNode < 0 ? t("path.openReport") : undefined }
        : { look: "locked", hue: "var(--coin-gold)", icon: <FileBarChart2 className="h-7 w-7" strokeWidth={2.2} />, title: reportLabel };
    }
    if (n.kind === "end") {
      // the day is done: the last light is the bubbles (Nov 8 2026)
      if (eveningDone) return { look: current ? "current" : "todo", hue: "198 55% 58%", icon: <Wind className={current ? "h-10 w-10" : "h-6 w-6"} strokeWidth={2.2} />, title: t("path.end.playTitle"), action: current ? t("path.end.playAction") : undefined };
      return {
        look: current ? "current" : "todo", icon: <Flag className={current ? "h-10 w-10" : "h-6 w-6"} strokeWidth={2.2} />,
        title: t("path.end.title"), action: current ? t("path.end.action") : undefined,
      };
    }
    const s = n.step;
    // an island grew today: done already, with a sprout
    if (s.kind === "grew") return { look: "done", icon: <Sprout className="h-6 w-6" strokeWidth={2.6} />, hue: hueOf(s), title: stepName(s) };
    const Icon = s.kind === "task" ? TASK_ICON[s.task!] : s.kind === "game" ? Lightbulb : s.kind === "fill" ? CalendarDays
      : s.kind === "act" ? Lightbulb : s.kind === "test" ? FlaskConical : s.kind === "unload" ? Wind
      : s.kind === "discover" ? MapIcon : s.kind === "link" ? Link2
      : s.kind === "questions" ? (s.added ? Plus : s.island ? islandIcon(islandDef(s.island).icon) : Layers) : s.auto === "topic" ? Compass : Sparkles;
    // A skipped task can still be done today (her note), so it shows its icon, not a check.
    const replay = s.kind === "unload";
    const icon = s.done && !s.skipped && !replay ? <Check className="h-6 w-6" strokeWidth={3} /> : <Icon className={current ? "h-10 w-10" : "h-6 w-6"} strokeWidth={2} />;
    const look: NodeLook = s.done && !s.skipped ? "done" : current ? "current" : "todo";
    const hue = hueOf(s);
    if (!current) return { look, icon, hue, title: stepName(s), sub: s.skipped ? t("path.skipped") : s.kind === "game" && hunchReady ? t("hunch.checkedSub") : s.kind === "unload" ? t("unload.sub") : s.added && !s.done ? t("path.questions", { count: s.trackerIds.length - s.answered }) : s.fresh && !s.done ? t("path.newIsland") : undefined };
    const left = s.trackerIds.length - s.answered;
    if (s.kind === "task") return { look, icon, hue, title: stepName(s), sub: t(`path.task.${s.task}.line`), action: t("path.go") };
    if (s.kind === "game") return { look, icon, hue, title: stepName(s), sub: hunchReady ? t("hunch.checkedSub") : t("hunch.sub"), action: hunchReady ? t("hunch.see") : t("hunch.go") };
    if (s.kind === "act") return { look, icon, hue, title: stepName(s), sub: t("act.sub", { count: s.trackerIds.length }), action: t("act.open") };
    if (s.kind === "test") return { look, icon, hue, title: stepName(s), sub: t("experiment.stepSub"), action: t("hunch.see") };
    if (s.kind === "unload") return { look, icon, hue, title: stepName(s), sub: t("unload.sub"), action: t("game.play") };
    if (s.kind === "discover") return { look, icon, hue, title: stepName(s), sub: t("tour.stepSub"), action: t("tour.go") };
    if (s.kind === "link") return { look, icon, hue, title: stepName(s), sub: t("firstLink.sub"), action: t("firstLink.see") };
    return {
      look, icon, hue, title: stepName(s),
      sub: s.answered > 0 ? t("path.left", { count: left }) : t("path.questions", { count: left }),
      action: s.answered > 0 ? t("path.continue") : t("path.start"),
    };
  };

  const f = stops[focus];
  // Her avatar (optional) stands to the left of the step to do.
  // her boat (with her animal in it) waits beside the step to do
  const toRight = f.x <= width / 2;
  const avatar: Rect | null = toRight
    ? (f.x + f.r + 64 <= width ? { x: f.x + f.r + 6, y: f.y - 40, w: 58, h: 58 } : null)
    : (f.x - f.r - 64 >= 0 ? { x: f.x - f.r - 64, y: f.y - 40, w: 58, h: 58 } : null);

  // --- Bubbles ---------------------------------------------------------------
  const [open, setOpen] = useState<Open>(null);
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
    const today = isoDay(new Date());
    const grew = m.steps.filter((s) => s.kind === "grew");
    let seen: string[] = [];
    try { seen = JSON.parse(localStorage.getItem("memap_grew_seen") || "[]"); } catch { /* shows again, harmless */ }
    const fresh = grew.find((s) => !seen.includes(`${today}:${s.island}:${s.stage}`));
    if (!fresh) return;
    try { localStorage.setItem("memap_grew_seen", JSON.stringify([...seen.slice(-40), `${today}:${fresh.island}:${fresh.stage}`])); } catch { /* ignore */ }
    haptics.sparkle();
    setGrewNow(fresh.island!);
  }, [m]);
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
  const awayRef = useRef<"up" | "down" | null>(null);
  const hasPath = trackers.length > 0;
  const [headerTitle, setHeaderTitle] = useState<HTMLElement | null>(null);
  useEffect(() => setHeaderTitle(document.getElementById("memap-header-center")), []);

  const measure = (main: HTMLElement) => {
    const cs = getComputedStyle(main);
    mid.current = (main.clientHeight - (parseFloat(cs.scrollPaddingBottom) || 0)) / 2;
  };

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
      const fw = focusRef.current?.closest<HTMLElement>("[data-cy]");
      const fd = fw ? yOf(fw) - midY : NaN;
      const lim = mid.current - 120;
      // "down" only once the Start bubble over her step (about 90px above it) has gone behind the
      // tabs: the button covered a bubble still in sight (her phone test, Nov 7 2026)
      const nowAway = Number.isNaN(fd) ? null : fd < -lim ? "up" : fd - 90 > mid.current - 110 ? "down" : null;
      if (nowAway !== awayRef.current) { awayRef.current = nowAway; setAway(nowAway); }
    };
    frameRef.current = frame;
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(frame); };
    const onResize = () => { measure(main); onScroll(); };
    const byHand = () => { modeRef.current = "hand"; };
    const byKey = (e: KeyboardEvent) => { if (/^(Arrow|Page|Home$|End$| $)/.test(e.key)) modeRef.current = "hand"; };
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
    });
  }, [hasPath, focus]); // eslint-disable-line react-hooks/exhaustive-deps

  /** How far a stop is from the middle of the screen. */
  const toMiddle = (i: number) => {
    const box = boxRef.current, main = box?.closest("main");
    if (!box || !main) return null;
    return { main, d: box.getBoundingClientRect().top + stops[i].y - (main.getBoundingClientRect().top + mid.current) };
  };
  // A light tapped low on the screen comes up, so its card isn't under the tabs.
  const bringUp = (i: number) => {
    const at = toMiddle(i);
    if (!at || at.d < mid.current * 0.35) return;
    modeRef.current = "auto";
    at.main.scrollBy({ top: at.d, behavior: reduceQuery().matches ? "auto" : "smooth" });
  };
  const backToStep = () => {
    const el = focusRef.current, at = toMiddle(focus);
    if (!el || !at) return;
    haptics.tap();
    modeRef.current = "auto";
    at.main.scrollBy({ top: at.d, behavior: reduceQuery().matches ? "auto" : "smooth" });
    // focus goes to her step instead of being lost with the pill
    el.focus({ preventScroll: true });
  };

  if (trackers.length === 0) return null;

  const title = t(`path.title${m.week % WEEK_TITLES}`);
  const daysDone = m.pastInWeek.length + (m.todayCounted ? 1 : 0);
  const toGo = DAYS_PER_WEEK - daysDone;
  const openThisChest = () => setChestOpen({ week: m.week, dates: [...m.pastInWeek, isoDay(new Date())] });
  // what this week's part gives now, and where it lives (board 68)
  const part = m.week % WEEK_TITLES;
  const weekNext = (() => {
    const evenings = m.week * DAYS_PER_WEEK + daysDone;
    // week 1's chip opens My days (a chip that looks tappable is tappable)
    if (part === 0) return { text: t(m.week === 0 ? "path.next4.report" : "path.next4.reportN", { count: toGo }), open: "overview" as null | "overview" | "findings" | "signals" | "world" };
    if (part === 1) {
      const n = computeCorrelations(trackers.filter((x) => !x.archived && x.source !== "play"), entries, 12).filter(linkWorthShowing).length;
      return n > 0 ? { text: t("path.next4.links", { count: n }), open: "findings" as const } : { text: t("path.next4.linksSoon", { count: Math.max(1, 10 - evenings) }), open: null };
    }
    if (part === 2) { const lit = litTrackers(trackers, entries).size; return { text: lit > 0 ? t("path.next4.lit", { count: lit }) : t("path.next4.rule"), open: "signals" as const }; }
    const x = currentExperiment();
    return { text: x ? t("path.next4.trying", { change: testNameOf(x.change), k: Math.min(experimentDay(x), EXPERIMENT_DAYS), count: EXPERIMENT_DAYS }) : t("path.next4.try"), open: "world" as const };
  })();

  const openActionPoints = () =>
    window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "signals", back: true } }));
  const startStep = (s: Step) => {
    setOpen(null);
    track("path_step_started", { kind: s.kind, week: m.week + 1, ...(s.task ? { task: s.task } : {}) });
    if (s.kind === "game") { if (canPlay) setGameOpen(true); }
    else if (s.kind === "act") { markActSeen(); setTick((k) => k + 1); openActionPoints(); }
    else if (s.kind === "fill") onFillDay(s.date!);
    else if (s.kind === "task" && s.task === "note") { noteFromTask.current = true; noteSaved.current = false; setNoteDraft(newDraft()); }
    else if (s.kind === "task" && s.task === "experiment") setTestOpen("pick");
    else if (s.kind === "test") setTestOpen("result");
    else if (s.kind === "unload") setUnloadOpen(true);
    else if (s.kind === "discover") window.dispatchEvent(new CustomEvent("memap-start-tour"));
    else if (s.kind === "link") window.dispatchEvent(new CustomEvent("memap-link-moment"));
    else if (s.kind === "task") onTask(s.task!);
    else onStartStep(s, stepName(s));
  };
  // A light tapped opens its card (name, what's there, Start), as on
  // Duolingo; the Start bubble over her step starts it at once.
  const tap = (i: number) => {
    const n = nodes[i];
    if (n.kind === "chest" && m.weekComplete) { setOpen(null); openThisChest(); return; }
    const notYet = n.kind === "future" || (n.kind === "end" && !eveningDone) || (n.kind === "chest" && !m.weekComplete) || (n.kind === "step" && n.step.kind === "game" && !canPlay);
    if (notYet && open !== i) {
      setWiggle(i);
      window.setTimeout(() => setWiggle((w) => (w === i ? null : w)), 450);
    }
    if (open !== i) bringUp(i);
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
    return `${t(`path.stage${stageOf(n)}`)} · ${left === null ? t("path.fullyGrown") : t("path.toNext", { count: left })}`;
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
    if (n.kind === "future") return head(n.offset === 1 ? t("path.opensTomorrow") : t("path.inDays", { count: n.offset }));
    if (n.kind === "chest") {
      return m.weekComplete ? (
        <>
          {head(t("path.reportReady"))}
          {button(t("path.openReport"), () => { setOpen(null); openThisChest(); }, "gold")}
        </>
      ) : (
        head(reportLabel, t("path.toGo", { count: toGo }))
      );
    }
    // "Done for today": what's left, all optional (the week's report first when it's ready)
    if (n.kind === "end") {
      // before today is answered: say plainly it comes later, and take her to her step (phone test, Nov 7 2026)
      if (!eveningDone) return (<>{head(t("path.end.title"), t("path.end.notYet", { count: openLeft }))}{button(t("tour.toStep"), () => { setOpen(null); window.dispatchEvent(new CustomEvent("memap-path-focus")); })}</>);
      const go = (f: () => void, action = "") => () => { setOpen(null); if (action) track("end_card_action", { action }); f(); };
      const ic = "h-5 w-5";
      // Links and the calendar only once there's something on them (her note, Nov 5
      // 2026: on day 1 "See your links" showed nothing; the first days have the
      // "discover" steps instead). The calendar button is named for her question.
      return (
        <>
          {head(t("path.eveningDone"), t("path.eveningDoneSub"))}
          {button(<><Wind className={ic} strokeWidth={2.4} /> {t("path.popBubbles")}</>, go(() => setUnloadOpen(true), "bubbles"), "teal")}
          {nextUp && nextTreasure(nextUp, go(() => window.dispatchEvent(new CustomEvent("memap-open-you")), "next_treasure"))}
          {m.weekComplete && button(<><FileBarChart2 className={ic} strokeWidth={2.4} /> {t("path.openReport")}</>, go(openThisChest, "report"), "gold")}
          {button(<><Plus className={ic} strokeWidth={2.4} /> {t("path.exploreQuestions")}</>, go(() => onTask("ownQuestion"), "questions"), "plain")}
          {hasLinks && button(<><Link2 className={ic} strokeWidth={2.4} /> {t("path.seeLinks")}</>, go(onOpenMap, "links"), "plain")}
          {m.totalDays >= 7 && button(<><CalendarDays className={ic} strokeWidth={2.4} /> {daysLabel}</>, go(() => onTask("calendar"), "calendar"), "plain")}
        </>
      );
    }
    const s = n.step;
    if (s.kind === "grew") return grewBody(s.island!);
    if (s.kind === "auto") {
      const door = getDoorState();
      return head(s.auto === "topic" ? t("path.auto.topicBubble", { name: door ? t(`doors.${door.id}.name`) : "" }) : t("path.auto.firstBubble"));
    }
    if (s.kind === "act") {
      return (
        <>
          {head(t("act.step"), t("act.sub", { count: s.trackerIds.length }))}
          {button(t("act.open"), () => { setOpen(null); openActionPoints(); }, "plain")}
        </>
      );
    }
    if (s.kind === "game") {
      if (!canPlay) return head(t("hunch.step"), t("hunch.needTwo"));
      return (
        <>
          {head(t("hunch.step"), s.done ? t("hunch.doneToday") : t("hunch.sub"))}
          {!s.done && button(t("game.play"), () => startStep(s))}
        </>
      );
    }
    // "Unload your mind" and the week's test have no questions: their own card,
    // not the questions card (her note, Nov 5 2026: it said "0 answers").
    if (s.kind === "unload") {
      return (
        <>
          {head(t("unload.step"), s.done ? t("unload.doneToday") : t("unload.sub"))}
          {button(s.done ? t("unload.again") : t("game.play"), () => startStep(s), s.done ? "plain" : "teal")}
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
          {head(t("experiment.stepDone"), t("experiment.stepSub"))}
          {button(t("hunch.see"), () => startStep(s))}
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
          {!s.done && button(t("path.go"), () => startStep(s))}
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
            : `${s.answered > 0 ? t("path.left", { count: left }) : t("path.questions", { count: left })} · ${t("path.minutes", { count: minutesFor(left) })}`,
        )}
        {s.answered > 0 && dots(s.trackerIds, isoDay(new Date()))}
        {/* Early in the day: answer what already happened, the rest tonight. */}
        {!s.done && s.kind === "questions" && new Date().getHours() < 17 && (
          <p className="mt-2 text-[15px] font-medium leading-snug text-muted-foreground">{t("path.earlyHint")}</p>
        )}
        {!s.done && button(<>{s.answered > 0 ? t("path.continue") : t("path.start")} <ArrowRight className="h-4 w-4" /></>, () => startStep(s))}
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

  const comingAfter = (m.weekComplete ? 0 : DAYS_PER_WEEK - 1 - m.pastInWeek.length) + 1;
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
      {m.pastWeeks.slice(pastFrom).map((dates, j) => {
        const w = pastFrom + j;
        return (
          <WeekStrip key={w} week={w} width={width} kind="past" dates={dates} chest={chests[w] ?? null}
            onOpenDay={onOpenDay} onOpenChest={() => setChestOpen({ week: w, dates })} />
        );
      })}

      {headerSlot && m.streak > 0 && createPortal(
        <span aria-label={t("path.streakAria", { count: m.streak })} className="surface inline-flex h-9 items-center gap-1 rounded-full pl-2 pr-3 text-[16px] font-bold tabular-nums text-foreground">
          <Flame className="h-[18px] w-[18px] fill-amber-400 text-amber-500" strokeWidth={2} />
          {m.streak}
        </span>,
        headerSlot,
      )}
      {headerTitle && createPortal(
        <span className="animate-fade-in whitespace-nowrap text-[16px] font-bold leading-[1.5] tracking-tight text-foreground">
          {t("path.weekN", { n: m.week + 1 })}
          <span className="font-semibold tabular-nums text-muted-foreground"> · {daysDone}/{DAYS_PER_WEEK}</span>
        </span>,
        headerTitle,
      )}

      {/* The week starts with its name, plain (her note: the card that
          rolled with the path was "уродская плашка"). */}
      <div className="mt-2">
        <div data-wheel data-tour="week" className="mx-auto w-fit max-w-[92%]">
          <p className="path-week-label">{t("path.weekN", { n: m.week + 1 })} · {title}</p>
          <button type="button" disabled={!weekNext.open} onClick={() => { haptics.tap(); window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: weekNext.open === "world" ? { tab: "patterns" } : { tab: "patterns", open: "all", section: weekNext.open, back: true } })); }}
            className="surface mx-auto mt-2 flex h-9 max-w-full items-center gap-1.5 rounded-full px-3.5 text-[14px] font-bold">
            <span className="truncate">{weekNext.text}</span>
          </button>
        </div>
        {/* two weeks of hard mood: talk to someone (comes back weekly while it lasts) */}
        {heavyMood && (
          <div className="mx-auto mt-3 w-[92%] max-w-[420px]">
            <TipCard id={`mood14-${Math.floor(Date.now() / 6048e5)}`} title={t("tips.moodTitle")} line={t("tips.moodLine")} action={t("tips.moodGo")}
              onAction={() => setSupport(true)} />
          </div>
        )}
        <SupportSheet open={support} onClose={() => setSupport(false)} />
        {/* came from the old look: the way back stays in sight above the tabs (the path
            scrolls to today, so a card in the path would be out of view); at the top, solid,
            away from the "grew" toasts at the bottom */}
        {fromOld && oldLookShown && (
          <div className="fixed inset-x-0 z-30 mx-auto w-[92%] max-w-[420px]" style={{ top: "calc(env(safe-area-inset-top) + 64px)" }}>
            <TipCard id="old-look" title={t("tips.oldLookTitle")} line={t("tips.oldLookLine")} action={t("upgrade.oldLook")} onAction={switchToOld} className="!bg-background shadow-[0_14px_30px_-12px_rgba(16,42,56,0.35)]" />
          </div>
        )}
        {/* after a few evenings: there is a report for a doctor */}
        {m.totalDays >= 5 && !heavyMood && (
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
            return (
              <div key={i} data-wheel data-cy={p.y} className="relative" style={{ transformOrigin: `${p.x}px ${p.y}px`, zIndex: open === i ? 6 : undefined }}>
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
                <LightLabel stop={p} text={v.title} dim={v.look === "locked" || lockedGame} below={i === currentNode ? 10 : 0} />
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


      {/* a past day to fill in: always in sight, bottom left (the "back" pill is right) */}
      {pastPick && createPortal(
        <button type="button" onClick={() => { haptics.tap(); onFillDay(pastPick.date); }}
          className="past-pill fixed left-4 z-[30] flex h-12 items-center gap-2 rounded-full bg-white pl-3 pr-4 text-[15px] font-extrabold text-foreground shadow-lg animate-fade-in active:scale-95 transition-transform dark:bg-[hsl(var(--surface))]"
          style={{ bottom: "calc(7.5rem + env(safe-area-inset-bottom, 0px))" }}>
          <CalendarDays className="h-5 w-5 text-[hsl(var(--coin-teal))]" strokeWidth={2.4} />
          {t("path.pastFill", { day: weekdayName(pastPick.date) })}
        </button>,
        document.body,
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
        <ExperimentSheet mode={testOpen} experiment={currentExperiment()} trackers={trackers} entries={entries}
          onClose={() => { setTestOpen(null); setTick((k) => k + 1); }} />
      )}

      {gameOpen && (
        <HunchGame trackers={trackers} entries={entries} onClose={() => { setGameOpen(false); setTick((k) => k + 1); }} />
      )}

      {chestOpen && (
        <WeekChest week={chestOpen.week} dates={chestOpen.dates} trackers={trackers} entries={entries}
          onClose={() => setChestOpen(null)} onPlaced={() => { setChestOpen(null); onOpenMap(); }} />
      )}
    </>
  );
};
