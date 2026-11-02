// Today's path (Aurora UX; step 1 Oct 31, step 2 + "steps, not evenings"
// Nov 2 2026). Past days of the week fold into one coin each with a note;
// today is a row of different steps (one per topic in its island's colour,
// day-1 steps already done, one gold task); coming days and the week's chest
// follow. Raised coins press in, every coin has a bubble, her art sits beside.
// Plan: marketing/aurora-light-ux/MASTERPIECE-PLAN.md (top note, §3.2, §6).
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, BarChart3, CalendarDays, Check, Compass, Dices, Flame, Layers, Map as MapIcon, PenLine, Plus, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isoDay } from "@/lib/eveningPath";
import { DAYS_PER_WEEK, getChests, pathModel, skipTask, syncTasks, type Step, type TaskId } from "@/lib/pathSteps";
import { placeScenery, type Rect } from "@/lib/pathScenery";
import { islandDef, islandName, mapPic } from "@/lib/islands";
import { islandStyle } from "@/lib/islandColors";
import { getDoorState } from "@/lib/doors";
import { getNotes } from "@/lib/notes";
import { Pressable, type PressTone } from "@/components/ui/pressable";
import { DESIGN_W, GAP, LIP, NodeLabel, NodeTile, R_CHEST, R_DAY, Road, Scenery, WEEK_TITLES, WEEK_TONES, WeekBanner, WeekRing, WeekStrip, XS } from "@/components/PathParts";
import { WeekChest } from "@/components/WeekChest";
import { GuessGame, hasGame } from "@/components/GuessGame";
import { avatarUrl, getAvatar } from "@/lib/avatar";
import { Tracker, TrackerEntry } from "@/types/tracker";

// Coins zigzag on a rhythm from a 340-wide design (XS in PathParts), scaled
// to the screen.
const PATH_MAX = 440;
const TOP = 34;
const R_STEP = 30;
const R_CURRENT = 34;
const LABEL_W = 140;

const TASK_ICON: Record<TaskId, LucideIcon> = {
  note: PenLine,
  calendar: CalendarDays,
  ownQuestion: Plus,
  chart: BarChart3,
  map: MapIcon,
  newIsland: Compass,
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


/** A small white badge with a check, on a done coin's corner. */
const DoneBadge = () => (
  <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[hsl(var(--coin-teal))] shadow-[0_2px_6px_rgba(16,42,56,0.25)]">
    <Check className="h-4 w-4" strokeWidth={3.4} />
  </span>
);

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
  useEffect(() => {
    getNotes()
      .then((ns) => setNoteDays(ns.map((n) => isoDay(new Date(n.createdAt))).sort()))
      .catch(() => setNoteDays([]));
  }, []);
  // Bumped when a task is skipped (stored outside React).
  const [tick, setTick] = useState(0);
  const m = useMemo(() => {
    const draft = pathModel(trackers, entries);
    if (noteDays === null) return draft;
    syncTasks(trackers, noteDays, draft.week);
    return pathModel(trackers, entries);
  }, [trackers, entries, noteDays, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = useMemo(() => trackers.filter((tr) => !tr.archived && tr.source !== "play"), [trackers]);

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
  const canPlay = useMemo(() => hasGame(trackers, entries), [trackers, entries]);
  const nodes: PNode[] = useMemo(() => {
    const out: PNode[] = m.pastInWeek.map((date) => ({ kind: "past" as const, date }));
    for (const step of m.steps) if (step.kind !== "game" || canPlay) out.push({ kind: "step", step });
    const coming = m.weekComplete ? 0 : DAYS_PER_WEEK - 1 - m.pastInWeek.length;
    for (let o = 1; o <= coming; o++) out.push({ kind: "future", offset: o });
    out.push({ kind: "chest" });
    return out;
  }, [m, canPlay]);
  const firstStep = m.pastInWeek.length;
  const shownSteps = m.steps.filter((s) => s.kind !== "game" || canPlay);
  const cur = shownSteps.findIndex((s) => !s.done);
  const currentNode = cur >= 0 ? firstStep + cur : -1;
  const chestIndex = nodes.length - 1;
  // The coin to bring into view and label: the current step, else tomorrow, else the chest.
  const focus = currentNode >= 0 ? currentNode : m.weekComplete ? chestIndex : firstStep + shownSteps.length;

  const stops = useMemo(() => {
    const out: { x: number; y: number; r: number }[] = [];
    nodes.forEach((n, i) => {
      const r = n.kind === "chest" ? R_CHEST : n.kind === "step" ? (i === currentNode ? R_CURRENT : R_STEP) : R_DAY;
      const y = i === 0 ? TOP + R_CURRENT : out[i - 1].y + out[i - 1].r + r + GAP;
      out.push({ x: Math.round((XS[i % XS.length] / DESIGN_W) * width), y, r });
    });
    return out;
  }, [nodes, width, currentNode]);
  const height = stops[chestIndex].y + R_CHEST + LIP + 28;

  // --- Words ---------------------------------------------------------------
  const reportLabel = m.week === 0 ? t("path.firstReport") : t("path.weekReport");
  const lang = i18n.language?.startsWith("ru") ? "ru-RU" : "en-US";
  const weekdayShort = (d: Date) => {
    const w = d.toLocaleDateString(lang, { weekday: "short" }).replace(".", "").slice(0, 3);
    return w.charAt(0).toUpperCase() + w.slice(1);
  };
  const dayTitle = (iso: string) => {
    const txt = new Date(iso + "T00:00:00").toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" });
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  };
  const weekdayName = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString(lang, { weekday: "long" });
  const answersOn = (date: string) => {
    const ids = new Set(active.map((tr) => tr.id));
    return new Set(entries.filter((e) => e.date === date && ids.has(e.trackerId)).map((e) => e.trackerId)).size;
  };
  const stepName = (s: Step) => {
    if (s.kind === "auto") return t(s.auto === "topic" ? "path.auto.topic" : "path.auto.first");
    if (s.kind === "fill") return t("path.fillTitle", { day: weekdayName(s.date!) });
    if (s.kind === "game") return t("game.step");
    if (s.kind === "task") return t(`path.task.${s.task}.title`);
    const name = s.island ? islandName(t, s.island) : t(s.mixed === "all" ? "path.allQuestions" : "path.mixed");
    return name + (s.part ? ` ${s.part[0]}/${s.part[1]}` : "");
  };

  // One label per node, one style (her notes: "ставить ноутсы что было
  // сделано", "неочевидно что означают числа"): a name, and under it what
  // it means in words. The current step's second line is its action.
  const labelOf = (n: PNode, i: number): { title: string; sub?: string; action?: boolean; muted?: boolean } | null => {
    if (n.kind === "past") return { title: weekdayShort(new Date(n.date + "T00:00:00")), sub: t("path.answers", { count: answersOn(n.date) }), muted: true };
    if (n.kind === "future") return i === focus ? { title: t("path.tomorrow") } : null;
    if (n.kind === "chest") return m.weekComplete ? { title: reportLabel, sub: t("path.openReport"), action: true } : null;
    const s = n.step;
    const left = s.trackerIds.length - s.answered;
    if (s.done) return { title: stepName(s), sub: s.kind === "questions" ? t("path.answers", { count: s.answered }) : s.skipped ? t("path.skipped") : t("path.done"), muted: true };
    if (s.kind === "task") return { title: stepName(s), sub: i === currentNode ? t("path.go") : t("path.taskLabel"), action: i === currentNode };
    if (s.kind === "game") return { title: stepName(s), sub: i === currentNode ? t("game.play") : t("game.stepSub"), action: i === currentNode };
    const what = s.answered > 0 ? t("path.left", { count: left }) : t("path.questions", { count: left });
    return { title: stepName(s), sub: i === currentNode ? `${s.answered > 0 ? t("path.continue") : t("path.start")} · ${what}` : what, action: i === currentNode };
  };
  const noteFor = (n: PNode, i: number) => labelOf(n, i);

  // Labels go on the side with more room; the focus coin's other side stays
  // free for the avatar (plan §3.2.7).
  const labels = useMemo(() => stops.map((p) => {
    const roomRight = width - p.x - p.r - 14;
    const right = roomRight >= 96 || roomRight >= p.x - p.r - 14;
    const w = Math.max(84, Math.min(LABEL_W, right ? roomRight : p.x - p.r - 14));
    const x = right ? p.x + p.r + 14 : p.x - p.r - 14 - w;
    return { right, rect: { x, y: p.y - 22, w, h: 46 } as Rect };
  }), [stops, width]);
  const f = stops[focus];
  const avatar: Rect = { x: labels[focus].right ? f.x - f.r - 66 : f.x + f.r + 8, y: f.y - 30, w: 56, h: 56 };

  const scenery = useMemo(() => {
    const blocked: Rect[] = stops.map((p) => ({ x: p.x - p.r - 4, y: p.y - p.r - 4, w: p.r * 2 + 8, h: p.r * 2 + LIP + 10 }));
    nodes.forEach((n, i) => {
      if (i === focus || noteFor(n, i) !== null) blocked.push(labels[i].rect);
    });
    blocked.push(avatar);
    const done = nodes.map((n, i) => (n.kind === "past" || (n.kind === "step" && n.step.done) ? i : -1)).filter((i) => i >= 0);
    return placeScenery(m.week, stops, width, blocked, done);
  }, [stops, labels, nodes, focus, m.week, width]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const [pastShown, setPastShown] = useState(1);
  const chests = useMemo(() => getChests(), [chestOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Her avatar (optional) stands in the slot kept free beside the focus coin.
  const [avatarPic, setAvatarPic] = useState<string | null>(() => avatarUrl(getAvatar()));
  useEffect(() => {
    const sync = () => setAvatarPic(avatarUrl(getAvatar()));
    window.addEventListener("memap-avatar-changed", sync);
    return () => window.removeEventListener("memap-avatar-changed", sync);
  }, []);

  // The flame lives in the header (Index renders an empty slot there).
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  useEffect(() => setHeaderSlot(document.getElementById("memap-header-start")), []);

  // Bring the focus coin to 42% of the screen once laid out, after Index
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


  const tone = WEEK_TONES[m.week % WEEK_TONES.length];
  const title = t(`path.title${m.week % WEEK_TITLES}`);
  const daysDone = m.pastInWeek.length + (m.todayCounted ? 1 : 0);
  const toGo = DAYS_PER_WEEK - daysDone;

  const openThisChest = () => setChestOpen({ week: m.week, dates: [...m.pastInWeek, isoDay(new Date())] });
  const thisChest = chests[m.week];

  const startStep = (s: Step) => {
    setOpen(null);
    if (s.kind === "game") setGameOpen(true);
    else if (s.kind === "fill") onFillDay(s.date!);
    else onStartStep(s, stepName(s));
  };
  const doTask = (task: TaskId) => {
    setOpen(null);
    onTask(task);
  };
  const tap = (i: number) => {
    const n = nodes[i];
    const notYet = n.kind === "future" || (n.kind === "chest" && !m.weekComplete);
    if (notYet && open !== i) {
      setWiggle(i);
      window.setTimeout(() => setWiggle((w) => (w === i ? null : w)), 450);
    }
    setOpen((o) => (o === i ? null : i));
  };

  // Plain render helpers (not components), so a re-render doesn't remount
  // an open bubble and replay its entrance.
  const bigButton = (children: ReactNode, onClick: () => void, bt: PressTone = "teal", haptic: "tap" | "medium" = "tap", style?: CSSProperties) => (
    <Pressable tone={bt} haptic={haptic} onClick={onClick} style={style} className="mt-3 h-[56px] w-full rounded-2xl" faceClassName="text-[15px] font-extrabold uppercase tracking-[0.06em]">
      {children}
    </Pressable>
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
          {bigButton(t("path.changeAnswers"), () => { setOpen(null); onFillDay(n.date, true); }, "slate")}
          <button type="button" onClick={() => { setOpen(null); onOpenDay(n.date); }} className="mt-2 h-10 w-full text-[15px] font-semibold text-muted-foreground">{t("path.openDay")}</button>
        </>
      );
    }
    if (n.kind === "future") return head(n.offset === 1 ? t("path.opensTomorrow") : t("path.inDays", { count: n.offset }));
    if (n.kind === "chest") {
      return m.weekComplete ? (
        <>
          {head(t("path.reportReady"))}
          {bigButton(t("path.openReport"), () => { setOpen(null); openThisChest(); }, "gold", "medium")}
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
    if (s.kind === "game") {
      return (
        <>
          {head(t("game.step"), s.done ? t("path.done") : t("game.line"))}
          {bigButton(t("game.play"), () => startStep(s), "lilac")}
        </>
      );
    }
    if (s.kind === "task") {
      return (
        <>
          {head(t(`path.task.${s.task}.title`), s.done ? t("path.done") : t(`path.task.${s.task}.line`))}
          {!s.done && bigButton(t("path.go"), () => doTask(s.task!), "gold")}
          {!s.done && (
            <button type="button" onClick={() => { setOpen(null); skipTask(s.task!); setTick((k) => k + 1); }} className="mt-2 h-10 w-full text-[15px] font-semibold text-muted-foreground">
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
        {!s.done && bigButton(s.answered > 0 ? t("path.continue") : t("path.start"), () => startStep(s), "teal", "medium", s.island ? islandStyle(s.island) : undefined)}
        {s.done && s.kind === "questions" && bigButton(t("path.changeAnswers"), () => { setOpen(null); onStartStep(s, stepName(s), true); }, "slate")}
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
      <div className="absolute z-20" style={{ left, width: w, top: above ? p.y - p.r - 12 : p.y + p.r + LIP + 12, transform: above ? "translateY(-100%)" : undefined }}>
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

  // --- Coins -------------------------------------------------------------------
  const coin = (n: PNode, i: number) => {
    const p = stops[i];
    const size = p.r * 2;
    const common = {
      "data-path-stop": i,
      ref: i === focus ? focusRef : undefined,
      onClick: () => tap(i),
      "aria-expanded": open === i,
      className: cn("absolute", wiggle === i && "path-wiggle"),
    };
    const place: CSSProperties = { left: p.x - p.r, top: p.y - p.r, width: size, height: size + LIP };

    if (n.kind === "chest") {
      return (
        <Pressable key={i} {...common} style={place} shape="coin" tone="gold" aria-label={m.weekComplete ? t("path.reportReady") : reportLabel}
          behind={
            <>
              {m.weekComplete && <span aria-hidden="true" className="pointer-events-none absolute -inset-5 rounded-full bg-[radial-gradient(closest-side,hsl(44_96%_60%/0.55),transparent)]" />}
              <span className="absolute" style={{ left: -12, top: -12 + LIP / 2 }}>
                <WeekRing size={size + 24} done={daysDone} on="hsl(var(--coin-gold))" off="hsl(var(--path-under))" />
              </span>
            </>
          }
        >
          <img src={mapPic(thisChest ? "chest_open_map" : "chest_closed")} alt="" width={thisChest ? 46 : 50} height={thisChest ? 48 : 42} decoding="async" draggable={false} className="pointer-events-none" />
          {m.weekComplete && !thisChest && <img src={mapPic("sparkles")} alt="" width={30} height={30} decoding="async" draggable={false} className="pointer-events-none absolute -right-2 -top-2" />}
        </Pressable>
      );
    }
    if (n.kind === "past") {
      return (
        <Pressable key={i} {...common} style={place} shape="coin" tone="teal" aria-label={dayTitle(n.date)}>
          <NodeTile size={size}><Check className="h-[55%] w-[55%] text-[hsl(var(--coin-teal))]" strokeWidth={3} /></NodeTile>
        </Pressable>
      );
    }
    if (n.kind === "future") {
      const day = addDays(new Date(), n.offset);
      return (
        <Pressable key={i} {...common} style={place} shape="coin" tone="slate" aria-label={n.offset === 1 ? t("path.opensTomorrow") : t("path.inDays", { count: n.offset })}
          faceClassName="text-[12px] font-bold uppercase tracking-[0.06em]">
          {n.offset === 1 && currentNode < 0
            ? <img src={mapPic("moon_and_stars")} alt="" width={40} height={20} decoding="async" draggable={false} className="pointer-events-none" />
            : weekdayShort(day)}
        </Pressable>
      );
    }

    const s = n.step;
    const current = i === currentNode;
    const tone: PressTone = s.kind === "task" ? "gold" : s.kind === "game" ? "lilac" : "teal";
    const style = s.island ? { ...place, ...islandStyle(s.island) } : place;
    const Icon = s.kind === "task" ? TASK_ICON[s.task!] : s.kind === "game" ? Dices : s.kind === "fill" ? CalendarDays : s.kind === "questions" ? Layers : s.auto === "topic" ? Compass : Sparkles;
    // Rings and the halo centre on the whole coin, face and lip together
    // (her note: "обводки кривые", the lip used to touch the ring).
    const cy = p.r + LIP / 2;
    const ringR = p.r + LIP / 2 + 5;
    const box = (ringR + 3) * 2;
    const circ = 2 * Math.PI * ringR;
    const part = s.kind === "questions" && s.trackerIds.length > 0 ? s.answered / s.trackerIds.length : 0;
    return (
      <Pressable key={i} {...common} style={style} shape="coin" tone={tone} aria-label={stepName(s)}
        behind={current ? (
          <>
            <svg aria-hidden="true" className="path-halo pointer-events-none absolute overflow-visible" style={{ left: p.r - box / 2, top: cy - box / 2, filter: "drop-shadow(0 0 6px hsl(var(--p3-face) / 0.55))" }} width={box} height={box}>
              <circle cx={box / 2} cy={box / 2} r={ringR} fill="none" stroke="hsl(var(--p3-face) / 0.32)" strokeWidth={4} />
              {part > 0 && (
                <circle cx={box / 2} cy={box / 2} r={ringR} fill="none" stroke="hsl(var(--p3-face))" strokeWidth={4} strokeLinecap="round"
                  strokeDasharray={`${circ * part} ${circ}`} transform={`rotate(-90 ${box / 2} ${box / 2})`} />
              )}
            </svg>
          </>
        ) : undefined}
      >
        {s.island ? (
          <img src={mapPic("icon_" + islandDef(s.island!).icon)} alt="" width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} decoding="async" draggable={false} className="pointer-events-none" />
        ) : (
          <NodeTile size={size}><Icon className="h-[55%] w-[55%] text-[hsl(var(--p3-face))]" strokeWidth={2.4} /></NodeTile>
        )}
        {s.done && <DoneBadge />}
      </Pressable>
    );
  };

  // A fragment, so the banner's sticky range is all of Today (it stays on
  // top while the question list scrolls under it), not just the path.
  // Coming weeks start after this week's remaining days.
  const comingAfter = (m.weekComplete ? 0 : DAYS_PER_WEEK - 1 - m.pastInWeek.length) + 1;
  const pastFrom = Math.max(0, m.pastWeeks.length - pastShown);

  return (
    <>
      {/* An old user's days before the path began: one chip, no empty weeks. */}
      {m.prior > 0 && (
        <p className="surface mx-auto -mt-1 mb-1 w-fit rounded-full px-3.5 py-1.5 text-[14px] font-semibold text-muted-foreground">
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

      {/* The week: a raised banner. Tap: how far along, and last week's report.
          Stuck flush with the top of the scroll area, so nothing peeks above. */}
      <div className="sticky -top-4 z-[5] animate-fade-in">
        <WeekBanner week={m.week} tone={tone} done={daysDone} expanded={open === "banner"} data-path-stop="banner"
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
      <section aria-label={title} className="animate-fade-in" style={{ marginTop: 4 }}>
        <div ref={boxRef} className="relative mx-auto" style={{ width, height }}>
          <Road stops={stops} width={width} height={height} walked={focus} />
          {/* Her art beside the coins: static, seeded by the week. */}
          <Scenery pieces={scenery} />

          {/* One label per node, one style, on the right. */}
          {nodes.map((n, i) => {
            const lab = labelOf(n, i);
            if (!lab) return null;
            if (i === currentNode && open === currentNode) return null; // its bubble says the same
            const l = labels[i];
            const act = i === currentNode && n.kind === "step" ? () => (n.step.kind === "task" ? doTask(n.step.task!) : startStep(n.step))
              : n.kind === "chest" && m.weekComplete ? openThisChest : undefined;
            return <NodeLabel key={`note${i}`} x={l.rect.x} y={stops[i].y} w={l.rect.w} right={l.right} {...lab} onClick={act} />;
          })}

          {avatarPic && (
            <div aria-hidden="true" className="pointer-events-none absolute" style={{ left: avatar.x, top: avatar.y, width: avatar.w, height: avatar.h }}>
              <span className="absolute bottom-0 left-2 right-2 h-2.5 rounded-[50%] blur-[2px]" style={{ background: "var(--scenery-shadow)" }} />
              <img src={avatarPic} alt="" width={60} height={60} className="relative h-[60px] w-[60px] object-contain" />
            </div>
          )}
          {nodes.map((n, i) => coin(n, i))}
          {typeof open === "number" && bubble(open)}
        </div>
      </section>

      {/* Two coming weeks, quiet, so the path never just ends. */}
      {[1, 2].map((n) => (
        <WeekStrip key={`c${n}`} week={m.week + n} width={width} kind="coming" firstOffset={comingAfter + (n - 1) * DAYS_PER_WEEK} />
      ))}

      {gameOpen && (
        <GuessGame trackers={trackers} entries={entries} onClose={() => { setGameOpen(false); setTick((k) => k + 1); }} />
      )}

      {chestOpen && (
        <WeekChest week={chestOpen.week} dates={chestOpen.dates} trackers={trackers} entries={entries}
          onClose={() => setChestOpen(null)} onPlaced={() => { setChestOpen(null); onOpenMap(); }} />
      )}
    </>
  );
};
