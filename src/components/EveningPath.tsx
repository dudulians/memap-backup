// Today's path (Aurora UX; steps not evenings, Nov 2 2026). Since her
// reference picture ("вот так получше будет"): flat round nodes with a plain
// line icon, a white pill label growing out of each to the right, the
// current step's pill holding its "Start" button, a calm dashed road, a white
// week card with a progress bar, and only a few quiet pieces of scenery.
// Past days of the week come first, then today's steps (a missed day, one
// per topic, a task, the "Guess" game), then the coming days and the reward.
// Nov 2 2026 (her: "при нажатии шага сразу делать действие"): tapping a step
// to do starts it at once; only a done step or day asks first (change
// answers). The note step opens the note sheet right here.
// Plan: marketing/aurora-light-ux/MASTERPIECE-PLAN.md (top notes).
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, BarChart3, CalendarDays, Check, Compass, FlaskConical, Flame, Gift, Layers, Lightbulb, Wind, Map as MapIcon, MoonStar, PenLine, Plus, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isoDay } from "@/lib/eveningPath";
import { DAYS_PER_WEEK, getChests, markActSeen, pathModel, skipTask, syncTasks, type Step, type TaskId } from "@/lib/pathSteps";
import { ExperimentSheet } from "@/components/ExperimentSheet";
import { UnloadGame } from "@/components/UnloadGame";
import { currentExperiment } from "@/lib/experiments";
import { placeScenery, type Rect } from "@/lib/pathScenery";
import { islandDef, islandName } from "@/lib/islands";
import { islandHsl } from "@/lib/islandColors";
import { NoteSheet, newDraft, type NoteDraft } from "@/components/NoteSheet";
import { getDoorState } from "@/lib/doors";
import { getNotes } from "@/lib/notes";
import { DAY_AHEAD, NodePill, PathNode, type NodeShape, R_CHEST, R_CURRENT, R_DAY, R_STEP, Road, Scenery, WEEK_TITLES, WeekBanner, WeekStrip, islandIcon, weekStops, type NodeLook } from "@/components/PathParts";
import { WeekChest } from "@/components/WeekChest";
import { HunchGame } from "@/components/HunchGame";
import { hunchTarget, readyHunch } from "@/lib/hunches";
import { avatarUrl, getAvatar } from "@/lib/avatar";
import { Tracker, TrackerEntry } from "@/types/tracker";

const PATH_MAX = 440;

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
  | { kind: "future"; offset: number }
  | { kind: "chest" };
type Open = number | "banner" | null;

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
  // Bumped when a task is skipped or the game is played (stored outside React).
  const [tick, setTick] = useState(0);
  const m = useMemo(() => {
    const draft = pathModel(trackers, entries);
    if (noteDays === null) return draft;
    syncTasks(trackers, noteDays, draft.week);
    return pathModel(trackers, entries);
  }, [trackers, entries, noteDays, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = useMemo(() => trackers.filter((tr) => !tr.archived && tr.source !== "play"), [trackers]);

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
  const nodes: PNode[] = useMemo(() => {
    const out: PNode[] = m.pastInWeek.map((date) => ({ kind: "past" as const, date }));
    for (const step of m.steps) out.push({ kind: "step", step });
    const coming = m.weekComplete ? 0 : DAYS_PER_WEEK - 1 - m.pastInWeek.length;
    for (let o = 1; o <= coming; o++) out.push({ kind: "future", offset: o });
    out.push({ kind: "chest" });
    return out;
  }, [m]);
  const firstStep = m.pastInWeek.length;
  const isOpenStep = (s: Step) => !s.done && (s.kind !== "game" || canPlay);
  // The questions stay the main step; "Unload your mind" is there any time
  // without taking the highlight (it is the main step only when nothing else is left).
  const firstOpen = m.steps.findIndex((s) => isOpenStep(s) && s.kind !== "unload");
  const cur = firstOpen >= 0 ? firstOpen : m.steps.findIndex(isOpenStep);
  const currentNode = cur >= 0 ? firstStep + cur : -1;
  const chestIndex = nodes.length - 1;
  // The node to bring into view: the current step, else tomorrow, else the reward.
  const focus = currentNode >= 0 ? currentNode : m.weekComplete ? chestIndex : firstStep + m.steps.length;

  const stops = useMemo(() => {
    const out = weekStops(width, nodes.map((n, i) => (n.kind === "chest" ? R_CHEST : n.kind === "step" ? (i === currentNode ? R_CURRENT : R_STEP) : R_DAY)), 26);
    // The current step sits further left, so its pill has room for the name
    // and "Start"; with an avatar, a little right of it so she stands beside it.
    if (currentNode >= 0) out[currentNode] = { ...out[currentNode], x: Math.round(Math.max(R_CURRENT + 14 + (avatarPic ? 48 : 0), width * 0.2)) };
    return out;
  }, [nodes, width, currentNode, avatarPic]);
  const height = stops[chestIndex].y + R_CHEST + 30;

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
    if (s.kind === "fill") return t("path.fillTitle", { day: weekdayName(s.date!) });
    if (s.kind === "game") return t("hunch.step");
    if (s.kind === "act") return t("act.step");
    if (s.kind === "test") return t("experiment.stepDone");
    if (s.kind === "unload") return t("unload.step");
    if (s.kind === "task") return t(`path.task.${s.task}.title`);
    const name = s.island ? islandName(t, s.island) : t(s.mixed === "all" ? "path.allQuestions" : "path.mixed");
    return name + (s.part ? ` ${s.part[0]}/${s.part[1]}` : "");
  };

  /** What a node looks like and says. */
  /** A step's own calm colour: its island, else what kind of step it is. */
  const hueOf = (s: Step): string => {
    if (s.kind === "questions" && s.island) return islandHsl(s.island);
    if (s.kind === "task") return "var(--coin-gold)";
    if (s.kind === "game") return "262 40% 64%";
    if (s.kind === "act") return "34 68% 56%";
    if (s.kind === "test") return "152 36% 46%";
    if (s.kind === "unload") return "198 55% 58%";
    if (s.kind === "fill") return "205 46% 58%";
    return "var(--coin-teal)";
  };
  /** Games wear a wavy badge, practices and tasks a rounded square, the rest is round. */
  const shapeOf = (n: PNode): NodeShape => {
    if (n.kind !== "step") return "circle";
    const k = n.step.kind;
    if (k === "game" || k === "unload") return "badge";
    if (k === "task" || k === "test" || k === "act") return "square";
    return "circle";
  };
  const viewOf = (n: PNode, i: number): { look: NodeLook; icon: ReactNode; title: string; sub?: string; action?: string; hue?: string } => {
    const current = i === currentNode;
    if (n.kind === "past") return { look: "done", icon: <Check className="h-5 w-5" strokeWidth={3} />, title: cap(weekdayName(n.date)) };
    if (n.kind === "future") {
      return { look: "locked", hue: DAY_AHEAD, icon: <MoonStar className="h-5 w-5" strokeWidth={2} />, title: n.offset === 1 ? t("path.tomorrow") : cap(addDays(new Date(), n.offset).toLocaleDateString(lang, { weekday: "long" })) };
    }
    if (n.kind === "chest") {
      return m.weekComplete
        ? { look: "gold", icon: <Gift className="h-6 w-6" strokeWidth={2.2} />, title: t("path.chest.openReward"), action: currentNode < 0 ? t("path.openReport") : undefined }
        : { look: "locked", hue: "var(--coin-gold)", icon: <Gift className="h-6 w-6" strokeWidth={2.2} />, title: reportLabel };
    }
    const s = n.step;
    const Icon = s.kind === "task" ? TASK_ICON[s.task!] : s.kind === "game" ? Lightbulb : s.kind === "fill" ? CalendarDays
      : s.kind === "act" ? Lightbulb : s.kind === "test" ? FlaskConical : s.kind === "unload" ? Wind
      : s.kind === "questions" ? (s.island ? islandIcon(islandDef(s.island).icon) : Layers) : s.auto === "topic" ? Compass : Sparkles;
    // A skipped task can still be done today (her note), so it shows its icon, not a check.
    const replay = s.kind === "unload";
    const icon = s.done && !s.skipped && !replay ? <Check className="h-5 w-5" strokeWidth={3} /> : <Icon className={current ? "h-8 w-8" : "h-5 w-5"} strokeWidth={2} />;
    const look: NodeLook = s.done && !s.skipped ? "done" : current ? "current" : "todo";
    const hue = hueOf(s);
    if (!current) return { look, icon, hue, title: stepName(s), sub: s.skipped ? t("path.skipped") : s.kind === "game" && hunchReady ? t("hunch.checkedSub") : s.kind === "unload" ? t("unload.sub") : s.fresh && !s.done ? t("path.newIsland") : undefined };
    const left = s.trackerIds.length - s.answered;
    if (s.kind === "task") return { look, icon, hue, title: stepName(s), sub: t(`path.task.${s.task}.line`), action: t("path.go") };
    if (s.kind === "game") return { look, icon, hue, title: stepName(s), sub: hunchReady ? t("hunch.checkedSub") : t("hunch.sub"), action: hunchReady ? t("hunch.see") : t("hunch.go") };
    if (s.kind === "act") return { look, icon, hue, title: stepName(s), sub: t("act.sub", { count: s.trackerIds.length }), action: t("act.open") };
    if (s.kind === "test") return { look, icon, hue, title: stepName(s), sub: t("experiment.stepSub"), action: t("hunch.see") };
    if (s.kind === "unload") return { look, icon, hue, title: stepName(s), sub: t("unload.sub"), action: t("game.play") };
    return {
      look, icon, hue, title: stepName(s),
      sub: s.answered > 0 ? t("path.left", { count: left }) : t("path.questions", { count: left }),
      action: s.answered > 0 ? t("path.continue") : t("path.start"),
    };
  };

  // Pills reach to the right edge; scenery stays out of their way.
  const pillRect = (i: number): Rect => {
    const p = stops[i];
    const h = i === currentNode ? 70 + 40 : 42;
    return { x: p.x - p.r - 6, y: p.y - (i === currentNode ? 35 : 21) - 4, w: width - p.x + p.r + 6, h: h + 8 };
  };
  const f = stops[focus];
  // Her avatar (optional) stands to the left of the step to do.
  const avatar: Rect | null = f.x - f.r - 50 >= 0 ? { x: f.x - f.r - 50, y: f.y - 22, w: 48, h: 48 } : null;

  const scenery = useMemo(() => {
    const blocked: Rect[] = stops.map((_, i) => pillRect(i));
    if (avatar) blocked.push(avatar);
    return placeScenery(m.week, stops, width, blocked, []);
  }, [stops, m.week, width]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Bring the focus node to 42% of the screen once laid out, after Index
  // has reset the scroll for the tab.
  const focusRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const id = window.setTimeout(() => {
      const el = focusRef.current;
      const main = el?.closest("main");
      if (!el || !main) return;
      const r = el.getBoundingClientRect();
      const delta = r.top + r.height / 2 - window.innerHeight * 0.42;
      if (delta > 0) main.scrollTop += delta;
    }, 90);
    return () => window.clearTimeout(id);
  }, []);

  if (trackers.length === 0) return null;

  const title = t(`path.title${m.week % WEEK_TITLES}`);
  const daysDone = m.pastInWeek.length + (m.todayCounted ? 1 : 0);
  const toGo = DAYS_PER_WEEK - daysDone;
  const openThisChest = () => setChestOpen({ week: m.week, dates: [...m.pastInWeek, isoDay(new Date())] });
  const thisChest = chests[m.week];

  const openActionPoints = () =>
    window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "signals" } }));
  const startStep = (s: Step) => {
    setOpen(null);
    if (s.kind === "game") { if (canPlay) setGameOpen(true); }
    else if (s.kind === "act") { markActSeen(); setTick((k) => k + 1); openActionPoints(); }
    else if (s.kind === "fill") onFillDay(s.date!);
    else if (s.kind === "task" && s.task === "note") setNoteDraft(newDraft());
    else if (s.kind === "task" && s.task === "experiment") setTestOpen("pick");
    else if (s.kind === "test") setTestOpen("result");
    else if (s.kind === "unload") setUnloadOpen(true);
    else if (s.kind === "task") onTask(s.task!);
    else onStartStep(s, stepName(s));
  };
  /** A step with something to do right now (a skipped task still counts). */
  const doable = (n: PNode) =>
    n.kind === "step" && n.step.kind !== "auto" && (
      n.step.kind === "game" ? canPlay && !n.step.done
        : n.step.kind === "unload" ? true
        : !n.step.done || !!n.step.skipped);
  const tap = (i: number) => {
    const n = nodes[i];
    if (doable(n) && n.kind === "step") { startStep(n.step); return; }
    if (n.kind === "chest" && m.weekComplete) { setOpen(null); openThisChest(); return; }
    const notYet = n.kind === "future" || (n.kind === "chest" && !m.weekComplete) || (n.kind === "step" && n.step.kind === "game" && !canPlay);
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
      className={cn("mt-3 flex h-12 w-full items-center justify-center gap-1 rounded-full text-[16px] font-bold active:scale-[0.98] transition-transform",
        look === "teal" && "bg-[hsl(var(--coin-teal))] text-white",
        look === "gold" && "bg-[hsl(var(--coin-gold))] text-white",
        look === "plain" && "bg-foreground/[0.06] text-foreground")}>
      {children}
    </button>
  );
  const dots = (ids: string[], date: string) => {
    const byTracker = new Map(entries.filter((e) => e.date === date).map((e) => [e.trackerId, e.value]));
    return (
      // Filled = yes, ring = no, grey = not answered. Never red or green.
      <div className="mt-2.5 flex flex-wrap gap-1.5" aria-hidden="true">
        {ids.slice(0, 40).map((id) => {
          const v = byTracker.get(id);
          return <span key={id} className={cn("h-2.5 w-2.5 rounded-full", v === true && "bg-[hsl(var(--coin-teal))]", v === false && "border-2 border-[hsl(var(--coin-teal))]", v === undefined && "bg-foreground/15")} />;
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

  const bubbleBody = (i: number): ReactNode => {
    const n = nodes[i];
    if (n.kind === "past") {
      return (
        <>
          {head(dayTitle(n.date), t("path.answers", { count: answersOn(n.date) }))}
          {dots(active.map((tr) => tr.id), n.date)}
          {button(t("path.changeAnswers"), () => { setOpen(null); onFillDay(n.date, true); }, "plain")}
          <button type="button" onClick={() => { setOpen(null); onOpenDay(n.date); }} className="mt-1 h-10 w-full text-[15px] font-semibold text-muted-foreground">{t("path.openDay")}</button>
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
    const s = n.step;
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

  // A fragment, so the week card's sticky range is all of Today.
  return (
    <>
      {/* An old user's days before the path began: one chip, no empty weeks. */}
      {m.prior > 0 && (
        <p className="surface mx-auto -mt-1 mb-2 w-fit rounded-full px-3.5 py-1.5 text-[14px] font-semibold text-muted-foreground">
          {t("path.priorDays", { count: m.prior })}
        </p>
      )}
      {pastFrom > 0 && (
        <button type="button" onClick={() => setPastShown((n) => n + 4)} className="surface mx-auto block h-10 rounded-full px-4 text-[14px] font-semibold text-foreground">
          {t("path.earlierWeeks", { count: pastFrom })}
        </button>
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

      {/* The week card. Tap: how far along, and last week's report. */}
      <div className="sticky -top-4 z-[5] mt-2 animate-fade-in">
        <WeekBanner week={m.week} done={daysDone} opened={!!thisChest} expanded={open === "banner"} data-path-stop="banner"
          onClick={() => setOpen((o) => (o === "banner" ? null : "banner"))} />
        {open === "banner" && (
          <div ref={bubbleRef} role="dialog" className="path-bubble surface absolute left-0 right-0 top-full z-20 mt-2 rounded-[20px] px-4 py-3.5" style={{ transformOrigin: "50% 0" }}>
            {head(t("path.weekProgress", { k: daysDone }), m.weekComplete ? t("path.reportReady") : `${reportLabel} · ${t("path.toGo", { count: toGo })}`)}
            {m.week > 0 && (
              <button type="button" onClick={() => { setOpen(null); onOpenReport(); }} className="mt-2 inline-flex h-10 items-center gap-1 text-[15px] font-semibold text-[hsl(var(--coin-teal))]">
                {t("path.lastReport")} <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* The path. */}
      <section aria-label={title} className="animate-fade-in" style={{ marginTop: 14 }}>
        <div ref={boxRef} className="relative mx-auto" style={{ width, height }}>
          <Road stops={stops} width={width} height={height} walked={focus} />
          <Scenery pieces={scenery} />

          {avatarPic && avatar && (
            <div aria-hidden="true" className="path-avatar pointer-events-none absolute z-[4]" style={{ left: avatar.x, top: avatar.y, width: avatar.w, height: avatar.h }}>
              <span className="absolute bottom-0 left-2 right-2 h-2.5 rounded-[50%] blur-[2px]" style={{ background: "var(--scenery-shadow)" }} />
              <img src={avatarPic} alt="" width={48} height={48} className="relative h-[48px] w-[48px] object-contain" />
            </div>
          )}

          {nodes.map((n, i) => {
            const v = viewOf(n, i);
            const p = stops[i];
            const act = v.action
              ? n.kind === "step" ? () => startStep(n.step) : n.kind === "chest" ? openThisChest : undefined
              : undefined;
            const lockedGame = n.kind === "step" && n.step.kind === "game" && !canPlay && !n.step.done;
            return (
              <div key={i}>
                {!(i === currentNode && open === currentNode) && (
                  <NodePill stop={p} title={v.title} sub={lockedGame ? t("hunch.needTwo") : v.sub} action={v.action} onAction={act}
                    maxRight={width} big={i === currentNode} muted={v.look === "done"}
                    open={v.look === "todo" && !lockedGame} dim={v.look === "locked" || lockedGame}
                    second={i === currentNode && n.kind === "step" && n.step.kind === "task" ? t("path.skip") : undefined}
                    onSecond={() => { if (n.kind === "step" && n.step.task) { skipTask(n.step.task); setTick((k) => k + 1); } }} />
                )}
                <PathNode stop={p} look={lockedGame ? "locked" : v.look} hue={v.hue} shape={shapeOf(n)} label={v.title} onClick={() => tap(i)} dataStop={i}
                  refEl={i === focus ? focusRef : undefined} expanded={open === i} wiggle={wiggle === i}>
                  {v.icon}
                </PathNode>
              </div>
            );
          })}
          {typeof open === "number" && bubble(open)}
        </div>
      </section>

      {/* Two coming weeks, quiet, so the path never just ends. */}
      {[1, 2].map((n) => (
        <WeekStrip key={`c${n}`} week={m.week + n} width={width} kind="coming" firstOffset={comingAfter + (n - 1) * DAYS_PER_WEEK} />
      ))}

      <NoteSheet draft={noteDraft} setDraft={setNoteDraft} trackers={active} onSaved={loadNotes}
        footer={
          <div className="mt-2 flex items-center justify-between">
            <button type="button" onClick={() => { setNoteDraft(null); window.dispatchEvent(new CustomEvent("memap-open-notes", { detail: {} })); }}
              className="h-11 px-2 text-[15px] font-semibold text-[hsl(var(--coin-teal))]">{t("path.allNotes")}</button>
            {m.steps.some((st) => st.kind === "task" && st.task === "note" && !st.done) && (
              <button type="button" onClick={() => { setNoteDraft(null); skipTask("note"); setTick((k) => k + 1); }}
                className="h-11 px-2 text-[15px] font-semibold text-muted-foreground">{t("path.skip")}</button>
            )}
          </div>
        } />


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
