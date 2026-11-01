// Today's path (Aurora UX; step 1 Oct 31, step 2 + "steps, not evenings"
// Nov 2 2026). Past days of the week fold into one coin each with a note;
// today is a row of different steps (one per topic in its island's colour,
// day-1 steps already done, one gold task); coming days and the week's chest
// follow. Raised coins press in, every coin has a bubble, her art sits beside.
// Plan: marketing/aurora-light-ux/MASTERPIECE-PLAN.md (top note, §3.2, §6).
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, BarChart3, CalendarDays, Check, Compass, Flame, Layers, Map as MapIcon, PenLine, Plus, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isoDay } from "@/lib/eveningPath";
import { countedDays, DAYS_PER_WEEK, pathModel, syncTasks, type Step, type TaskId } from "@/lib/pathSteps";
import { placeScenery, type Rect } from "@/lib/pathScenery";
import { ISLAND_DEFS, mapPic } from "@/lib/islands";
import { islandStyle } from "@/lib/islandColors";
import { getDoorState } from "@/lib/doors";
import { getNotes } from "@/lib/notes";
import { Pressable, type PressTone } from "@/components/ui/pressable";
import { Tracker, TrackerEntry } from "@/types/tracker";

// Coins zigzag on a rhythm from a 340-wide design, scaled to the screen.
const XS = [140, 220, 250, 200, 120, 90, 150, 205];
const DESIGN_W = 340;
const PATH_MAX = 440;
const TOP = 34;
const GAP = 26; // between two coins, edge to edge
const R_DAY = 30;
const R_STEP = 36;
const R_CURRENT = 42;
const R_CHEST = 46;
const LIP = 6;
const LABEL_W = 140;

const WEEK_TONES: PressTone[] = ["teal", "gold", "sky", "lilac"];
const WEEK_TITLES = 4; // path.title0..title3, then they repeat

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

/** Seven arcs around a point: one per day of the week. */
const WeekRing = ({ size, done, on, off, width = 4 }: { size: number; done: number; on: string; off: string; width?: number }) => {
  const r = size / 2 - width / 2;
  const c = size / 2;
  const gap = 0.22;
  const seg = (Math.PI * 2) / DAYS_PER_WEEK;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="pointer-events-none">
      {Array.from({ length: DAYS_PER_WEEK }, (_, i) => {
        const a0 = -Math.PI / 2 + i * seg + gap / 2;
        const a1 = a0 + seg - gap;
        const p = (a: number) => `${c + r * Math.cos(a)},${c + r * Math.sin(a)}`;
        return <path key={i} d={`M${p(a0)} A${r},${r} 0 0 1 ${p(a1)}`} fill="none" stroke={i < done ? on : off} strokeWidth={width} strokeLinecap="round" />;
      })}
    </svg>
  );
};

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
  onFillDay,
  onOpenDay,
}: {
  trackers: Tracker[];
  entries: TrackerEntry[];
  /** Answer one step's questions (one topic); title names it in the deck. */
  onStartStep: (step: Step, title: string) => void;
  /** Do today's small task (write a note, see the calendar…). */
  onTask: (task: TaskId) => void;
  onOpenReport: () => void;
  /** Answer a missed day (one of the last two). */
  onFillDay: (date: string) => void;
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
  const m = useMemo(() => {
    const draft = pathModel(trackers, entries);
    if (noteDays === null) return draft;
    syncTasks(trackers, noteDays, draft.week);
    return pathModel(trackers, entries);
  }, [trackers, entries, noteDays]);

  const active = useMemo(() => trackers.filter((tr) => !tr.archived && tr.source !== "play"), [trackers]);

  // A missed day to fill in from the current step's bubble: yesterday, else
  // the day before, only for someone who was already answering before it.
  const fillDay = useMemo(() => {
    const counted = new Set(countedDays(trackers, entries));
    const first = entries.reduce<string | null>((min, e) => (min === null || e.date < min ? e.date : min), null);
    // Onboarding may log the door thing days back; nothing before install day.
    const started = getDoorState()?.startedAt;
    for (const n of [1, 2]) {
      const d = isoDay(addDays(new Date(), -n));
      if (started && d < started) continue;
      if (first && first < d && !counted.has(d)) return d;
    }
    return null;
  }, [trackers, entries]);

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
  const nodes: PNode[] = useMemo(() => {
    const out: PNode[] = m.pastInWeek.map((date) => ({ kind: "past" as const, date }));
    for (const step of m.steps) out.push({ kind: "step", step });
    const coming = m.weekComplete ? 0 : DAYS_PER_WEEK - 1 - m.pastInWeek.length;
    for (let o = 1; o <= coming; o++) out.push({ kind: "future", offset: o });
    out.push({ kind: "chest" });
    return out;
  }, [m]);
  const firstStep = m.pastInWeek.length;
  const currentNode = m.current >= 0 ? firstStep + m.current : -1;
  const chestIndex = nodes.length - 1;
  // The coin to bring into view and label: the current step, else tomorrow, else the chest.
  const focus = currentNode >= 0 ? currentNode : m.weekComplete ? chestIndex : firstStep + m.steps.length;

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
    if (s.kind === "task") return t(`path.task.${s.task}.title`);
    const name = s.island ? t(`map.island.${s.island}`) : t(s.mixed === "all" ? "path.allQuestions" : "path.mixed");
    return name + (s.part ? ` ${s.part[0]}/${s.part[1]}` : "");
  };

  // Short notes beside the coins (her ask: "ставить ноутсы что было сделано").
  const noteFor = (n: PNode, i: number): string | null => {
    if (i === focus) return null; // the focus coin gets the bigger label
    if (n.kind === "past") return `${weekdayShort(new Date(n.date + "T00:00:00"))} · ${answersOn(n.date)}`;
    if (n.kind === "step") {
      const s = n.step;
      if (s.kind === "questions" && !s.done) return `${stepName(s)} · ${s.trackerIds.length - s.answered}`;
      return stepName(s);
    }
    return null;
  };

  // Labels go on the side with more room; the focus coin's other side stays
  // free for the avatar (plan §3.2.7).
  const labels = useMemo(() => stops.map((p, i) => {
    const right = width - (p.x + p.r) >= p.x - p.r;
    const room = right ? width - p.x - p.r - 12 : p.x - p.r - 12;
    const w = Math.max(84, Math.min(LABEL_W, room));
    const x = right ? p.x + p.r + 12 : p.x - p.r - 12 - w;
    const isFocus = i === focus && focus !== chestIndex;
    return { right, rect: { x, y: p.y - (isFocus ? 34 : 18), w, h: isFocus ? 76 : 40 } as Rect };
  }), [stops, width, focus, chestIndex]);
  const f = stops[focus];
  const avatar: Rect = { x: labels[focus].right ? f.x - f.r - 68 : f.x + f.r + 8, y: f.y - 30, w: 60, h: 60 };

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
  const [open, setOpen] = useState<Open>(() => (fillDay && currentNode >= 0 ? currentNode : null));
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

  const curve = (from: number, to: number) => {
    let d = `M${stops[from].x},${stops[from].y}`;
    for (let i = from + 1; i <= to; i++) {
      const a = stops[i - 1];
      const b = stops[i];
      const my = (a.y + b.y) / 2;
      d += ` C${a.x},${my} ${b.x},${my} ${b.x},${b.y}`;
    }
    return d;
  };
  const road = curve(0, chestIndex);
  const walked = focus;

  const tone = WEEK_TONES[m.week % WEEK_TONES.length];
  const title = t(`path.title${m.week % WEEK_TITLES}`);
  const reportLabel = m.week === 0 ? t("path.firstReport") : t("path.weekReport");
  const daysDone = m.pastInWeek.length + (m.todayCounted ? 1 : 0);
  const toGo = DAYS_PER_WEEK - daysDone;

  const startStep = (s: Step) => {
    setOpen(null);
    onStartStep(s, stepName(s));
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
          {bigButton(t("path.openDay"), () => { setOpen(null); onOpenDay(n.date); }, "slate")}
        </>
      );
    }
    if (n.kind === "future") return head(n.offset === 1 ? t("path.opensTomorrow") : t("path.inDays", { count: n.offset }));
    if (n.kind === "chest") {
      return m.weekComplete ? (
        <>
          {head(t("path.reportReady"))}
          {bigButton(t("path.openReport"), () => { setOpen(null); onOpenReport(); }, "gold", "medium")}
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
    if (s.kind === "task") {
      return (
        <>
          {head(t(`path.task.${s.task}.title`), s.done ? t("path.done") : t(`path.task.${s.task}.line`))}
          {!s.done && bigButton(t("path.go"), () => doTask(s.task!), "gold")}
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
        {i === currentNode && fillDay && (
          <button type="button" onClick={() => { setOpen(null); onFillDay(fillDay); }} className="mt-3 inline-flex h-9 items-center gap-1 rounded-xl bg-primary/10 px-3 text-[14px] font-semibold text-[hsl(var(--coin-teal))]">
            {t("path.fillIn", { day: weekdayName(fillDay) })} <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
          </button>
        )}
        {!s.done && bigButton(s.answered > 0 ? t("path.continue") : t("path.start"), () => startStep(s), "teal", "medium", s.island ? islandStyle(s.island) : undefined)}
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
              <span className="absolute" style={{ left: -9, top: -9 }}>
                <WeekRing size={size + 18} done={daysDone} on="hsl(var(--coin-gold))" off="hsl(var(--path-under))" />
              </span>
            </>
          }
        >
          <img src={mapPic("chest_closed")} alt="" width={60} height={51} decoding="async" draggable={false} className="pointer-events-none" />
          {m.weekComplete && <img src={mapPic("sparkles")} alt="" width={30} height={30} decoding="async" draggable={false} className="pointer-events-none absolute -right-2 -top-2" />}
        </Pressable>
      );
    }
    if (n.kind === "past") {
      return (
        <Pressable key={i} {...common} style={place} shape="coin" tone="teal" aria-label={dayTitle(n.date)}>
          <Check className="h-6 w-6" strokeWidth={3.2} />
        </Pressable>
      );
    }
    if (n.kind === "future") {
      const day = addDays(new Date(), n.offset);
      return (
        <Pressable key={i} {...common} style={place} shape="coin" tone="slate" aria-label={n.offset === 1 ? t("path.opensTomorrow") : t("path.inDays", { count: n.offset })}
          faceClassName="text-[12px] font-bold uppercase tracking-[0.06em]">
          {n.offset === 1 && m.current < 0
            ? <img src={mapPic("moon_and_stars")} alt="" width={40} height={20} decoding="async" draggable={false} className="pointer-events-none" />
            : weekdayShort(day)}
        </Pressable>
      );
    }

    const s = n.step;
    const current = i === currentNode;
    const tone: PressTone = s.kind === "task" ? "gold" : "teal";
    const style = s.island ? { ...place, ...islandStyle(s.island) } : place;
    const Icon = s.kind === "task" ? TASK_ICON[s.task!] : s.kind === "questions" ? Layers : s.auto === "topic" ? Compass : Sparkles;
    const ringR = p.r + 7;
    const circ = 2 * Math.PI * ringR;
    const part = s.kind === "questions" && s.trackerIds.length > 0 ? s.answered / s.trackerIds.length : 0;
    return (
      <Pressable key={i} {...common} style={style} shape="coin" tone={tone} aria-label={stepName(s)}
        behind={current ? (
          <>
            <span aria-hidden="true" className="path-halo pointer-events-none absolute -inset-[18px] rounded-full bg-[hsl(var(--p3-face)/0.22)]" style={{ bottom: LIP - 18 }} />
            <svg aria-hidden="true" className="pointer-events-none absolute" style={{ left: -9, top: -9 }} width={size + 18} height={size + 18}>
              <circle cx={p.r + 9} cy={p.r + 9} r={ringR} fill="none" stroke="hsl(var(--path-ribbon))" strokeWidth={5} />
              {part > 0 && (
                <circle cx={p.r + 9} cy={p.r + 9} r={ringR} fill="none" stroke="hsl(var(--p3-face))" strokeWidth={5} strokeLinecap="round"
                  strokeDasharray={`${circ * part} ${circ}`} transform={`rotate(-90 ${p.r + 9} ${p.r + 9})`} />
              )}
            </svg>
          </>
        ) : undefined}
      >
        {s.island ? (
          <img src={mapPic("icon_" + ISLAND_DEFS[s.island!].icon)} alt="" width={Math.round(p.r * 1.25)} height={Math.round(p.r * 1.25)} decoding="async" draggable={false} className="pointer-events-none" />
        ) : (
          <Icon className={current ? "h-9 w-9" : "h-7 w-7"} strokeWidth={2.3} />
        )}
        {s.done && <DoneBadge />}
      </Pressable>
    );
  };

  // The focus coin's label: what to do now, without a tap.
  const focusLabel = (() => {
    const l = labels[focus];
    const align = l.right ? "items-start text-left" : "items-end text-right";
    const pos: CSSProperties = { left: l.rect.x, top: f.y - 30, width: l.rect.w };
    if (currentNode >= 0) {
      const s = m.steps[m.current];
      if (open === currentNode) return null; // its bubble has the same button
      if (s.kind === "task") {
        return (
          <div className={cn("absolute z-10 flex flex-col gap-1.5", align)} style={pos}>
            <Pressable tone="gold" onClick={() => doTask(s.task!)} className="h-[42px] rounded-xl" faceClassName="px-4 text-[14px] font-extrabold uppercase tracking-[0.06em]">{t("path.go")}</Pressable>
            <span className="text-[15px] font-semibold leading-tight text-foreground">{stepName(s)}</span>
          </div>
        );
      }
      const left = s.trackerIds.length - s.answered;
      return (
        <div className={cn("absolute z-10 flex flex-col gap-1.5", align)} style={pos}>
          <Pressable tone="teal" haptic="medium" onClick={() => startStep(s)} style={s.island ? islandStyle(s.island) : undefined} className="h-[42px] rounded-xl" faceClassName="px-4 text-[14px] font-extrabold uppercase tracking-[0.06em]">
            {s.answered > 0 ? t("path.continue") : t("path.start")}
          </Pressable>
          <span className="text-[15px] font-semibold leading-tight text-foreground">
            {stepName(s)} · {s.answered > 0 ? t("path.left", { count: left }) : t("path.questions", { count: left })}
          </span>
        </div>
      );
    }
    if (m.weekComplete) {
      return (
        <div className={cn("absolute z-10 flex flex-col gap-1.5", align)} style={pos}>
          <Pressable tone="gold" haptic="medium" onClick={onOpenReport} className="h-[42px] rounded-xl" faceClassName="px-4 text-[14px] font-extrabold uppercase tracking-[0.06em]">{t("path.openReport")}</Pressable>
          <span className="text-[15px] font-semibold leading-tight text-foreground">{reportLabel}</span>
        </div>
      );
    }
    return (
      <p className={cn("absolute z-10 text-[15px] font-semibold leading-tight text-foreground", l.right ? "text-left" : "text-right")} style={{ left: l.rect.x, top: f.y - 10, width: l.rect.w }}>
        {t("path.tomorrow")}
      </p>
    );
  })();

  // A fragment, so the banner's sticky range is all of Today (it stays on
  // top while the question list scrolls under it), not just the path.
  return (
    <>
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
        <Pressable tone={tone} onClick={() => setOpen((o) => (o === "banner" ? null : "banner"))} data-path-stop="banner"
          aria-expanded={open === "banner"} className="h-[82px] w-full rounded-[20px]" faceClassName="justify-between gap-3 px-[18px] text-left">
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold uppercase tracking-[0.06em] opacity-85">{t("path.weekN", { n: m.week + 1 })}</span>
            <span className="mt-0.5 block truncate text-[22px] font-bold leading-tight tracking-[-0.015em]">{title}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="text-[15px] font-bold tabular-nums">{daysDone}/{DAYS_PER_WEEK}</span>
            <span className="relative h-[52px] w-[52px]">
              <WeekRing size={52} done={daysDone} width={3.5} on="currentColor" off="color-mix(in srgb, currentColor 30%, transparent)" />
              <img src={mapPic("chest_closed")} alt="" width={32} height={27} decoding="async" draggable={false} className="pointer-events-none absolute left-[10px] top-[12px]" />
            </span>
          </span>
        </Pressable>
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
          <svg width={width} height={height} className="path-road absolute inset-0 overflow-visible" aria-hidden="true">
            <path d={road} transform="translate(0 3)" fill="none" stroke="hsl(var(--path-under))" strokeWidth={18} strokeLinecap="round" />
            <path d={road} fill="none" stroke="hsl(var(--path-ribbon))" strokeWidth={16} strokeLinecap="round" />
            {walked < chestIndex && <path d={curve(Math.max(walked, 0), chestIndex)} fill="none" stroke="hsl(var(--path-ahead))" strokeWidth={3} strokeDasharray="7 9" strokeLinecap="round" />}
            {walked > 0 && <path d={curve(0, walked)} fill="none" stroke="hsl(var(--coin-teal))" strokeWidth={3.5} strokeDasharray="7 9" strokeLinecap="round" />}
          </svg>

          {/* Her art beside the coins: static, seeded by the week. */}
          {scenery.map((p, k) => (
            <div key={k} aria-hidden="true" className="pointer-events-none absolute" style={{ left: p.x, top: p.y, width: p.w, height: p.h }}>
              {p.ripple && (
                <img src={mapPic("water_ripple")} alt="" width={Math.round(p.w * 1.15)} height={Math.round(p.w * 1.15 * 0.366)} decoding="async" draggable={false}
                  className="absolute max-w-none opacity-90" style={{ left: -p.w * 0.075, bottom: -p.w * 0.16 }} />
              )}
              {p.shadow && !p.ripple && (
                <span className="absolute rounded-[50%] blur-[2px]" style={{ left: p.w * 0.15, right: p.w * 0.15, bottom: -4, height: 9, background: "var(--scenery-shadow)" }} />
              )}
              <img src={mapPic(p.name)} alt="" width={p.w} height={p.h} decoding="async" draggable={false} className="relative" />
            </div>
          ))}

          {/* Notes beside the coins: what each one was or is. */}
          {nodes.map((n, i) => {
            const note = noteFor(n, i);
            if (note === null) return null;
            const l = labels[i];
            const done = n.kind === "past" || (n.kind === "step" && n.step.done);
            return (
              <p key={`note${i}`} aria-hidden="true"
                className={cn("pointer-events-none absolute z-[1] line-clamp-2 text-[14px] font-semibold leading-tight", done ? "text-muted-foreground" : "text-foreground", l.right ? "text-left" : "text-right")}
                style={{ left: l.rect.x, top: stops[i].y - 9, width: l.rect.w }}>
                {note}
              </p>
            );
          })}

          {nodes.map((n, i) => coin(n, i))}
          {focusLabel}
          {typeof open === "number" && bubble(open)}
        </div>
      </section>
    </>
  );
};
