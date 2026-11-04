// Today's path. The rule since Nov 4 2026 (her note: "всё стало непонятно,
// сделай по каким-то правилам"): one light is one evening, seven lights and a
// chest make a week, the same in every week. Lit warm = an evening done;
// tonight's light is pale, ringed with one arc per part of the evening (its
// topics' questions, a task, the game), and a Start bubble over it starts the
// next part; tapping it lists tonight's parts. Dim = not yet. Her sea stands
// still behind. Before (Nov 2–4) today's parts were lights of their own.
// Earlier notes: (Aurora UX; steps not evenings, Nov 2 2026). Since her
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
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, BarChart3, CalendarDays, Check, ChevronDown, ChevronRight, ChevronUp, Compass, FlaskConical, Flame, Layers, Lightbulb, Wind, Map as MapIcon, PenLine, Plus, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { playWheelTick, preloadSounds } from "@/lib/feedback";
import { isoDay } from "@/lib/eveningPath";
import { DAYS_PER_WEEK, getChests, markActSeen, pathModel, skipTask, syncTasks, type Step, type TaskId } from "@/lib/pathSteps";
import { ExperimentSheet } from "@/components/ExperimentSheet";
import { UnloadGame } from "@/components/UnloadGame";
import { currentExperiment } from "@/lib/experiments";
import { islandDef, islandName, mapPicFor } from "@/lib/islands";
import { islandHsl } from "@/lib/islandColors";
import { NoteSheet, newDraft, type NoteDraft } from "@/components/NoteSheet";
import { getDoorState } from "@/lib/doors";
import { getNotes } from "@/lib/notes";
import { DAY_AHEAD, LightLabel, PartsRing, PathNode, R_CHEST, R_CURRENT, R_DAY, StartBubble, WEEK_TITLES, WeekStrip, islandIcon, weekStops, type NodeLook } from "@/components/PathParts";
import { WeekChest } from "@/components/WeekChest";
import { HunchGame } from "@/components/HunchGame";
import { hunchTarget, readyHunch } from "@/lib/hunches";
import { avatarUrl, getAvatar } from "@/lib/avatar";
import { Tracker, TrackerEntry } from "@/types/tracker";

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
  | { kind: "tonight" }
  | { kind: "future"; offset: number }
  | { kind: "chest" };
type Open = number | null;

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
    out.push({ kind: "tonight" });
    for (let o = 1; o <= DAYS_PER_WEEK - 1 - m.pastInWeek.length; o++) out.push({ kind: "future", offset: o });
    out.push({ kind: "chest" });
    return out;
  }, [m]);
  const tonightAt = m.pastInWeek.length;
  const chestIndex = nodes.length - 1;
  // Tonight's parts: what lights its light. The calm game (any time), a missed
  // day to fill in and a game that can't be played yet are there as extras.
  const counts = (s: Step) => s.kind !== "unload" && s.kind !== "fill" && (s.kind !== "game" || canPlay);
  const parts = m.steps.filter(counts);
  const partsDone = parts.filter((s) => s.done).length;
  const tonightLit = parts.length > 0 ? partsDone === parts.length : m.todayCounted;
  const isOpenStep = (s: Step) => !s.done && (s.kind !== "game" || canPlay);
  /** the part the Start bubble starts: the first one still to do, else a missed day */
  const next = m.steps.find((s) => isOpenStep(s) && counts(s)) ?? m.steps.find((s) => isOpenStep(s) && s.kind === "fill") ?? null;
  const currentNode = tonightLit ? -1 : tonightAt;
  // The light to bring into view: tonight's, else tomorrow's, else the reward.
  const focus = currentNode >= 0 ? currentNode : m.weekComplete ? chestIndex : Math.min(tonightAt + 1, chestIndex);

  const stops = useMemo(() => {
    // room above tonight's light for its Start bubble
    const out = weekStops(width, nodes.map((n, i) => (n.kind === "chest" ? R_CHEST : i === currentNode ? R_CURRENT : R_DAY)), 74);
    if (currentNode > 0) for (let k = currentNode; k < out.length; k++) out[k] = { ...out[k], y: out[k].y + 70 };
    return out;
  }, [nodes, width, currentNode]);
  const height = stops[chestIndex].y + R_CHEST + 52;

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

  /** A part's calm colour (in tonight's list): its island, else what kind it is. */
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
  const iconOf = (s: Step): LucideIcon =>
    s.kind === "task" ? TASK_ICON[s.task!] : s.kind === "game" ? Lightbulb : s.kind === "fill" ? CalendarDays
      : s.kind === "act" ? Lightbulb : s.kind === "test" ? FlaskConical : s.kind === "unload" ? Wind
      : s.kind === "questions" ? (s.island ? islandIcon(islandDef(s.island).icon) : Layers) : s.auto === "topic" ? Compass : Sparkles;
  /** One short line under a part's name. */
  const partSub = (s: Step): string | undefined => {
    const left = s.trackerIds.length - s.answered;
    if (s.kind === "questions" || s.kind === "fill") {
      if (s.done) return t("path.answers", { count: s.answered });
      return s.answered > 0 ? t("path.left", { count: left }) : s.added ? t("path.newQuestions", { count: left }) : t("path.questions", { count: left });
    }
    if (s.kind === "task") return s.done ? (s.skipped ? t("path.skipped") : t("path.done")) : t(`path.task.${s.task}.line`);
    if (s.kind === "game") return !canPlay ? t("hunch.needTwo") : hunchReady ? t("hunch.checkedSub") : s.done ? t("hunch.doneToday") : t("hunch.sub");
    if (s.kind === "act") return t("act.sub", { count: s.trackerIds.length });
    if (s.kind === "test") return t("experiment.stepSub");
    if (s.kind === "unload") return t("unload.sub");
    return s.done ? t("path.done") : undefined;
  };
  /** What a light is and how it looks: lit, tonight, or not yet. */
  const viewOf = (n: PNode): { look: NodeLook; title: string; hue?: string } => {
    if (n.kind === "past") return { look: "done", title: cap(weekdayName(n.date)) };
    if (n.kind === "future") return { look: "locked", hue: DAY_AHEAD, title: n.offset === 1 ? t("path.tomorrow") : cap(addDays(new Date(), n.offset).toLocaleDateString(lang, { weekday: "long" })) };
    if (n.kind === "chest") return m.weekComplete ? { look: "gold", title: t("path.chest.openReward") } : { look: "locked", hue: "var(--coin-gold)", title: reportLabel };
    return { look: tonightLit ? "done" : "current", title: t("path.tonight") };
  };

  const f = stops[focus];
  // Her avatar (optional) stands to the left of the step to do.
  // her boat (with her animal in it) waits beside the step to do
  const toRight = f.x <= width / 2, gap = f.r + 16;
  const avatar: Rect | null = toRight
    ? (f.x + gap + 58 <= width ? { x: f.x + gap, y: f.y - 40, w: 58, h: 58 } : null)
    : (f.x - gap - 58 >= 0 ? { x: f.x - gap - 58, y: f.y - 40, w: 58, h: 58 } : null);

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

  // --- Scrolling --------------------------------------------------------------
  // Her note, Nov 4 2026: "давай просто как у дуолинго и попроще". A plain page
  // that scrolls freely under her finger: no drum, no snapping. A light passing
  // the middle of the screen gives a light tap; her step far off shows the way
  // back; Today opens with her step in the middle.
  const focusRef = useRef<HTMLButtonElement>(null);
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
      const nowAway = Number.isNaN(fd) ? null : fd < -lim ? "up" : fd > lim ? "down" : null;
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
  // A light tapped low on the screen comes up, so its card isn't under the
  // tabs; tonight's card is long, so its light goes near the top.
  const bringUp = (i: number, high = false) => {
    const at = toMiddle(i);
    if (!at) return;
    const d = high ? at.d + mid.current - 150 : at.d;
    if (high ? Math.abs(d) < 24 : d < mid.current * 0.35) return;
    modeRef.current = "auto";
    at.main.scrollBy({ top: d, behavior: reduceQuery().matches ? "auto" : "smooth" });
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

  const openActionPoints = () =>
    window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "signals", back: true } }));
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
  // A light tapped opens its card (name, what's there, Start), as on
  // Duolingo; the Start bubble over her step starts it at once.
  const tap = (i: number) => {
    const n = nodes[i];
    if (n.kind === "chest" && m.weekComplete) { setOpen(null); openThisChest(); return; }
    const notYet = n.kind === "future" || (n.kind === "chest" && !m.weekComplete);
    if (notYet && open !== i) {
      setWiggle(i);
      window.setTimeout(() => setWiggle((w) => (w === i ? null : w)), 450);
    }
    if (open !== i) bringUp(i, n.kind === "tonight");
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
    // tonight: its parts, the next one ready to start
    return (
      <>
        {head(t("path.tonight"), parts.length > 1 ? t("path.partsDone", { done: partsDone, count: parts.length }) : undefined)}
        <div className="mt-2 -mx-1.5 flex flex-col">
          {m.steps.map((s) => partRow(s))}
        </div>
        {next && button(<>{partsDone > 0 ? t("path.continue") : t("path.start")} <ArrowRight className="h-4 w-4" /></>, () => startStep(next))}
      </>
    );
  };

  /** A row in tonight's card: its icon in its colour (a check once done), name, one line. */
  const partRow = (s: Step) => {
    const Icon = iconOf(s);
    const done = s.done && !s.skipped && s.kind !== "unload";
    const waits = s.kind === "game" && !canPlay;
    const hue = hueOf(s);
    // done questions: change the answers; a note written: write another; the rest: do it
    const go = waits || s.kind === "auto" ? undefined
      : done && s.kind === "questions" ? () => { setOpen(null); onStartStep(s, stepName(s), true); }
      : done && s.kind === "task" && s.task === "note" ? () => { setOpen(null); setNoteDraft(newDraft()); }
      : done ? undefined : () => startStep(s);
    return (
      <div key={s.id} className="flex items-center">
        <button type="button" disabled={!go} onClick={() => { haptics.tap(); go?.(); }}
          className="flex min-h-[54px] min-w-0 flex-1 items-center gap-3 rounded-2xl px-1.5 text-left transition-colors active:bg-foreground/[0.05] disabled:active:bg-transparent">
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", done && "path-part-done")}
            style={done ? undefined : { background: `hsl(${hue} / .16)`, color: waits ? "hsl(var(--muted-foreground))" : `hsl(${hue})` }}>
            {done ? <Check className="h-5 w-5" strokeWidth={3} /> : <Icon className="h-5 w-5" strokeWidth={2.2} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className={cn("block truncate text-[16px] font-bold leading-tight", (done || waits) && "text-foreground/60")}>{stepName(s)}</span>
            {partSub(s) && <span className="block truncate text-[14px] font-medium text-muted-foreground">{partSub(s)}</span>}
          </span>
          {go && !done && s.kind !== "task" && <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={2.4} />}
        </button>
        {s.kind === "task" && !s.done && (
          <button type="button" onClick={() => { haptics.tap(); skipTask(s.task!); setTick((k) => k + 1); }}
            className="h-10 shrink-0 px-2 text-[14px] font-semibold text-muted-foreground">{t("path.skip")}</button>
        )}
      </div>
    );
  };

  const bubble = (i: number) => {
    const p = stops[i];
    const w = Math.min(width - 16, nodes[i].kind === "tonight" ? 330 : 300);
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
        <div data-wheel>
          <p className="path-week-label">{t("path.weekN", { n: m.week + 1 })} · {title}</p>
        </div>
      </div>

      {/* The path. */}
      <section aria-label={title} className="animate-fade-in" style={{ marginTop: 14 }}>
        {/* overflow-x clip: the wheel's tilt must never widen the page (the
            review found a sideways pan); nothing visible is cut. */}
        <div ref={boxRef} className="path-box relative mx-auto [overflow-x:clip]" style={{ width, height }}>

          {nodes.map((n, i) => {
            const v = viewOf(n);
            const p = stops[i];
            return (
              <div key={i} data-wheel data-cy={p.y} className="relative" style={{ transformOrigin: `${p.x}px ${p.y}px`, zIndex: open === i ? 6 : undefined }}>
                {/* her animal stands beside her step, rolls with it, and opens You */}
                {i === focus && avatar && (
                  <button type="button" aria-label={t("map.you")} onClick={() => { haptics.tap(); window.dispatchEvent(new CustomEvent("memap-open-you")); }}
                    className="path-boat absolute z-[4] transition-transform duration-150 active:scale-95" style={{ left: avatar.x, top: avatar.y, width: avatar.w, height: avatar.h }}>
                    <span className="bob">
                      <img className="art-day" src={mapPicFor("sailboat", false)} alt="" />
                      <img className="art-night" src={mapPicFor("sailboat", true)} alt="" />
                      {avatarPic && <img className="who" src={avatarPic} alt="" />}
                    </span>
                  </button>
                )}
                {/* tonight: an arc per part around its light, and one short word over it
                    that starts the next part, pointing at its light */}
                {i === currentNode && parts.length > 1 && <PartsRing stop={p} total={parts.length} done={partsDone} />}
                {i === currentNode && open !== i && next && (
                  <StartBubble stop={p} label={partsDone > 0 ? t("path.continue") : t("path.start")}
                    aria={`${t("path.tonight")}: ${stepName(next)}`} onClick={() => startStep(next)} />
                )}
                <LightLabel stop={p} text={v.title} dim={v.look === "locked"} below={i === currentNode ? 10 : 0} />
                <PathNode stop={p} look={v.look} hue={v.hue} chest={n.kind === "chest"} label={v.title} onClick={() => tap(i)} dataStop={i}
                  refEl={i === focus ? focusRef : undefined} expanded={open === i} wiggle={wiggle === i} />
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


      {/* Away from her step: back to it, her avatar on the button. */}
      {away && createPortal(
        <button type="button" onClick={backToStep}
          className="fixed right-4 z-[30] flex h-12 items-center gap-2 rounded-full bg-white pl-1.5 pr-3.5 text-[15px] font-extrabold text-foreground shadow-lg animate-fade-in active:scale-95 transition-transform dark:bg-[hsl(var(--surface))]"
          style={{ bottom: "calc(7.5rem + env(safe-area-inset-bottom, 0px))" }}>
          {avatarPic
            ? <img src={avatarPic} alt="" className="h-9 w-9 rounded-full bg-sky-50 object-contain p-0.5 ring-2 ring-[hsl(var(--coin-teal))] dark:bg-[hsl(var(--surface))]" />
            : <span className="h-9 w-9 rounded-full bg-[hsl(var(--coin-teal)/0.12)]" />}
          {t("path.backToStep")}
          {away === "up" ? <ChevronUp className="h-5 w-5 text-[hsl(var(--coin-teal))]" strokeWidth={2.6} /> : <ChevronDown className="h-5 w-5 text-[hsl(var(--coin-teal))]" strokeWidth={2.6} />}
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
