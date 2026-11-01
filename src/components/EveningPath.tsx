// Today's path of evenings (Aurora UX; step 1 Oct 31, step 2 Nov 2 2026).
// One stop per evening, seven make a week, then the week's chest opens a
// report. Mechanics from Duolingo's lesson path, drawn in her Aurora Light:
// raised coins that press in, a road with depth, her art beside the stops,
// and a bubble on every stop that says what it is and what's next.
// Plan: marketing/aurora-light-ux/MASTERPIECE-PLAN.md §3.2 and §6.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check, Flame, MoonStar } from "lucide-react";
import { cn } from "@/lib/utils";
import { EVENINGS_PER_WEEK, eveningDates, isoDay, pathState } from "@/lib/eveningPath";
import { placeScenery, type Rect } from "@/lib/pathScenery";
import { mapPic } from "@/lib/islands";
import { Pressable, type PressTone } from "@/components/ui/pressable";
import { Tracker, TrackerEntry } from "@/types/tracker";

// Stops keep their zigzag rhythm from a 340-wide design, scaled to the
// screen (plan §3.2.4). The eighth point is the week's chest.
const XS = [140, 220, 250, 200, 120, 90, 150, 205];
const DESIGN_W = 340;
const PATH_MAX = 440;
const STEP = 96;
const TOP = 34;
const R_STOP = 34;
const R_TONIGHT = 42;
const R_CHEST = 46;
const LIP = 6;
const CHEST = EVENINGS_PER_WEEK;
const LABEL_W = 132;

const WEEK_TONES: PressTone[] = ["teal", "gold", "sky", "lilac"];
const WEEK_TITLES = 4; // path.title0..title3, then they repeat

const minutesFor = (questions: number) => Math.max(1, Math.round((questions * 4) / 60));

const addDays = (base: Date, n: number) => {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + n);
  return d;
};

type StopKind = "done" | "tonight" | "next" | "later" | "chest";
type Open = number | "banner" | null;

/** Seven arcs around a point: one per evening of the week. */
const WeekRing = ({ size, done, on, off, width = 4 }: { size: number; done: number; on: string; off: string; width?: number }) => {
  const r = size / 2 - width / 2;
  const c = size / 2;
  const gap = 0.22; // radians between segments
  const seg = (Math.PI * 2) / EVENINGS_PER_WEEK;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="pointer-events-none">
      {Array.from({ length: EVENINGS_PER_WEEK }, (_, i) => {
        const a0 = -Math.PI / 2 + i * seg + gap / 2;
        const a1 = a0 + seg - gap;
        const p = (a: number) => `${c + r * Math.cos(a)},${c + r * Math.sin(a)}`;
        return <path key={i} d={`M${p(a0)} A${r},${r} 0 0 1 ${p(a1)}`} fill="none" stroke={i < done ? on : off} strokeWidth={width} strokeLinecap="round" />;
      })}
    </svg>
  );
};

export const EveningPath = ({
  trackers,
  entries,
  onStartTonight,
  onOpenReport,
  onFillDay,
  onOpenDay,
}: {
  trackers: Tracker[];
  entries: TrackerEntry[];
  onStartTonight: () => void;
  onOpenReport: () => void;
  /** Answer a missed day (one of the last two). */
  onFillDay: (date: string) => void;
  /** Look at a done evening. */
  onOpenDay: (date: string) => void;
}) => {
  const { t, i18n } = useTranslation();
  const s = useMemo(() => pathState(trackers, entries), [trackers, entries]);
  const active = useMemo(() => trackers.filter((tr) => !tr.archived && tr.source !== "play"), [trackers]);

  // A missed day to fill in from tonight's bubble: yesterday, else the day
  // before, and only for someone who was already answering before it.
  const fillDay = useMemo(() => {
    const evenings = new Set(eveningDates(trackers, entries));
    const first = entries.reduce<string | null>((min, e) => (min === null || e.date < min ? e.date : min), null);
    for (const n of [1, 2]) {
      const d = isoDay(addDays(new Date(), -n));
      if (first && first < d && !evenings.has(d)) return d;
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

  // With a day to fill in, tonight's bubble starts open so the chip is
  // seen. (On day 1 the START label beside tonight already says it.)
  const [open, setOpen] = useState<Open>(() => (!s.tonightDone && fillDay ? s.tonightIndex : null));
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

  const tonight = s.tonightDone ? -1 : s.tonightIndex;
  // The stop to bring into view and to label: tonight, else what opens next.
  const focus = !s.tonightDone ? s.tonightIndex : s.weekComplete ? CHEST : s.doneInWeek;
  const walked = s.weekComplete ? CHEST : s.tonightDone ? s.doneInWeek - 1 : s.tonightIndex;
  const answeredTonight = s.activeCount - s.leftTonight;

  const kindOf = (i: number): StopKind => {
    if (i === CHEST) return "chest";
    if (i < s.doneInWeek) return "done";
    if (i === tonight) return "tonight";
    if (i === (s.tonightDone ? s.doneInWeek : s.tonightIndex + 1)) return "next";
    return "later";
  };
  // Evenings until stop i opens (1 = tomorrow).
  const eveningsUntil = (i: number) => i - (s.tonightDone ? s.doneInWeek - 1 : s.tonightIndex);

  const stops = XS.map((x, i) => ({
    x: Math.round((x / DESIGN_W) * width),
    y: TOP + R_TONIGHT + i * STEP,
    r: i === CHEST ? R_CHEST : i === tonight ? R_TONIGHT : R_STOP,
  }));
  const height = stops[CHEST].y + R_CHEST + LIP + 28;

  // The label beside the focus stop goes where there's more room; the
  // other side stays free for the avatar (plan §3.2.7).
  const f = stops[focus];
  const labelRight = width - (f.x + f.r) >= f.x - f.r;
  const labelW = Math.max(96, Math.min(LABEL_W, labelRight ? width - f.x - f.r - 14 : f.x - f.r - 14));
  const labelX = labelRight ? f.x + f.r + 14 : f.x - f.r - 14 - labelW;
  const label: Rect = { x: labelX, y: f.y - 34, w: labelW, h: 74 };
  const avatar: Rect = { x: labelRight ? f.x - f.r - 68 : f.x + f.r + 8, y: f.y - 30, w: 60, h: 60 };

  const scenery = useMemo(() => {
    const blocked: Rect[] = stops.map((p) => ({ x: p.x - p.r - 4, y: p.y - p.r - 4, w: p.r * 2 + 8, h: p.r * 2 + LIP + 10 }));
    blocked.push(label, avatar);
    const done = Array.from({ length: s.doneInWeek }, (_, i) => i);
    return placeScenery(s.week, stops, width, blocked, done);
    // stops, label and avatar derive from these
  }, [s.week, s.doneInWeek, tonight, focus, width]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bring tonight (or what opens next) to 42% of the screen once laid out,
  // after Index has reset the scroll for the tab.
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

  if (s.leftTonight === 0 && s.totalEvenings === 0 && trackers.length === 0) return null;

  // The road: one curve through every stop; walked dashes in teal.
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
  const road = curve(0, CHEST);

  const lang = i18n.language?.startsWith("ru") ? "ru-RU" : "en-US";
  const weekdayShort = (d: Date) => d.toLocaleDateString(lang, { weekday: "short" }).replace(".", "").slice(0, 3).toUpperCase();
  const dayTitle = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    const txt = d.toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" });
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  };
  const weekdayName = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString(lang, { weekday: "long" });

  const tone = WEEK_TONES[s.week % WEEK_TONES.length];
  const title = t(`path.title${s.week % WEEK_TITLES}`);
  const reportLabel = s.week === 0 ? t("path.firstReport") : t("path.weekReport");
  const toGo = EVENINGS_PER_WEEK - s.doneInWeek;

  const start = () => {
    setOpen(null);
    onStartTonight();
  };
  const tapStop = (i: number) => {
    const kind = kindOf(i);
    if ((kind === "next" || (kind === "chest" && !s.weekComplete)) && open !== i) {
      setWiggle(i);
      window.setTimeout(() => setWiggle((w) => (w === i ? null : w)), 450);
    }
    setOpen((o) => (o === i ? null : i));
  };

  // --- Bubbles -------------------------------------------------------------
  // Plain render helpers (not components), so a re-render doesn't remount
  // an open bubble and replay its entrance.
  const bigButton = (children: ReactNode, onClick: () => void, bt: PressTone = "teal", haptic: "tap" | "medium" = "tap") => (
    <Pressable tone={bt} haptic={haptic} onClick={onClick} className="mt-3 h-[56px] w-full rounded-2xl" faceClassName="text-[15px] font-extrabold uppercase tracking-[0.06em]">
      {children}
    </Pressable>
  );

  const bubbleBody = (i: number): ReactNode => {
    const kind = kindOf(i);
    if (kind === "tonight") {
      const partly = answeredTonight > 0;
      return (
        <>
          <p className="text-[17px] font-bold leading-tight">{t("path.tonight")}</p>
          <p className="mt-0.5 text-[15px] font-medium text-muted-foreground">
            {partly ? t("path.left", { count: s.leftTonight }) : t("path.questions", { count: s.leftTonight })} · {t("path.minutes", { count: minutesFor(s.leftTonight) })}
          </p>
          {fillDay && (
            <button type="button" onClick={() => { setOpen(null); onFillDay(fillDay); }} className="mt-3 inline-flex h-9 items-center gap-1 rounded-xl bg-primary/10 px-3 text-[14px] font-semibold text-[hsl(var(--coin-teal))]">
              {t("path.fillIn", { day: weekdayName(fillDay) })} <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
            </button>
          )}
          {bigButton(partly ? t("path.continue") : t("path.start"), start, "teal", "medium")}
        </>
      );
    }
    if (kind === "done") {
      const date = s.weekDates[i];
      if (!date) return null;
      const byTracker = new Map(entries.filter((e) => e.date === date).map((e) => [e.trackerId, e.value]));
      const answered = active.filter((tr) => byTracker.has(tr.id)).length;
      const leftovers = s.tonightDone && i === s.doneInWeek - 1 && s.leftTonight > 0;
      return (
        <>
          <p className="text-[17px] font-bold leading-tight">{dayTitle(date)}</p>
          <p className="mt-0.5 text-[15px] font-medium text-muted-foreground">{t("path.answers", { count: answered })}</p>
          {/* Filled = yes, ring = no, grey = skipped. Never red or green. */}
          <div className="mt-2.5 flex flex-wrap gap-1.5" aria-hidden="true">
            {active.slice(0, 40).map((tr) => {
              const v = byTracker.get(tr.id);
              return (
                <span key={tr.id} className={cn("h-2.5 w-2.5 rounded-full",
                  v === true && "bg-[hsl(var(--coin-teal))]",
                  v === false && "border-2 border-[hsl(var(--coin-teal))]",
                  v === undefined && "bg-foreground/15")} />
              );
            })}
          </div>
          {leftovers ? (
            <>
              <p className="mt-3 text-[15px] font-medium text-muted-foreground">{t("path.left", { count: s.leftTonight })}</p>
              {bigButton(t("path.continue"), start, "teal", "medium")}
            </>
          ) : (
            bigButton(t("path.openDay"), () => { setOpen(null); onOpenDay(date); }, "slate")
          )}
        </>
      );
    }
    if (kind === "next") return <p className="text-[17px] font-bold leading-tight">{t("path.opensTomorrow")}</p>;
    if (kind === "later") return <p className="text-[17px] font-bold leading-tight">{t("path.inEveningsCap", { count: eveningsUntil(i) })}</p>;
    // The chest.
    return s.weekComplete ? (
      <>
        <p className="text-[17px] font-bold leading-tight">{t("path.reportReady")}</p>
        {bigButton(t("path.openReport"), () => { setOpen(null); onOpenReport(); }, "gold", "medium")}
      </>
    ) : (
      <>
        <p className="text-[17px] font-bold leading-tight">{reportLabel}</p>
        <p className="mt-0.5 text-[15px] font-medium text-muted-foreground">{t("path.toGo", { count: toGo })}</p>
      </>
    );
  };

  const bubble = (i: number) => {
    const p = stops[i];
    const w = Math.min(width - 16, 300);
    const left = Math.max(8, Math.min(p.x - w / 2, width - w - 8));
    const above = i >= 5;
    const caret = Math.max(18, Math.min(p.x - left, w - 18));
    return (
      <div
        className="absolute z-20"
        style={{ left, width: w, top: above ? p.y - p.r - 12 : p.y + p.r + LIP + 12, transform: above ? "translateY(-100%)" : undefined }}
      >
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

  // --- Stops -----------------------------------------------------------------
  const coin = (i: number) => {
    const p = stops[i];
    const kind = kindOf(i);
    const size = p.r * 2;
    const common = {
      "data-path-stop": i,
      ref: i === focus ? focusRef : undefined,
      onClick: () => tapStop(i),
      "aria-expanded": open === i,
      className: cn("absolute", wiggle === i && "path-wiggle"),
      style: { left: p.x - p.r, top: p.y - p.r, width: size, height: size + LIP },
    } as const;

    if (kind === "chest") {
      return (
        <Pressable key={i} {...common} shape="coin" tone="gold" aria-label={s.weekComplete ? t("path.reportReady") : reportLabel}
          behind={
            <>
              {s.weekComplete && <span aria-hidden="true" className="pointer-events-none absolute -inset-5 rounded-full bg-[radial-gradient(closest-side,hsl(44_96%_60%/0.55),transparent)]" />}
              <span className="absolute" style={{ left: -9, top: -9 }}>
                <WeekRing size={size + 18} done={s.doneInWeek} on="hsl(var(--coin-gold))" off="hsl(var(--path-under))" />
              </span>
            </>
          }
        >
          <img src={mapPic("chest_closed")} alt="" width={60} height={51} decoding="async" draggable={false} className="pointer-events-none" />
          {s.weekComplete && <img src={mapPic("sparkles")} alt="" width={30} height={30} decoding="async" draggable={false} className="pointer-events-none absolute -right-2 -top-2" />}
        </Pressable>
      );
    }
    if (kind === "done") {
      return (
        <Pressable key={i} {...common} shape="coin" tone="teal" aria-label={s.weekDates[i] ? dayTitle(s.weekDates[i]) : undefined}>
          <Check className="h-7 w-7" strokeWidth={3.2} />
        </Pressable>
      );
    }
    if (kind === "tonight") {
      const ringR = p.r + 7;
      const circ = 2 * Math.PI * ringR;
      const part = s.activeCount > 0 ? answeredTonight / s.activeCount : 0;
      return (
        <Pressable key={i} {...common} shape="coin" tone="teal" aria-label={t("path.tonight")}
          behind={
            <>
              <span aria-hidden="true" className="path-halo pointer-events-none absolute -inset-[18px] rounded-full bg-[hsl(var(--coin-teal)/0.22)]" style={{ bottom: LIP - 18 }} />
              <svg aria-hidden="true" className="pointer-events-none absolute" style={{ left: -9, top: -9 }} width={size + 18} height={size + 18}>
                <circle cx={p.r + 9} cy={p.r + 9} r={ringR} fill="none" stroke="hsl(var(--path-ribbon))" strokeWidth={5} />
                {part > 0 && (
                  <circle cx={p.r + 9} cy={p.r + 9} r={ringR} fill="none" stroke="hsl(var(--coin-teal))" strokeWidth={5} strokeLinecap="round"
                    strokeDasharray={`${circ * part} ${circ}`} transform={`rotate(-90 ${p.r + 9} ${p.r + 9})`} />
                )}
              </svg>
            </>
          }
        >
          <MoonStar className="h-9 w-9" strokeWidth={2.1} />
        </Pressable>
      );
    }
    if (kind === "next") {
      return (
        <Pressable key={i} {...common} shape="coin" tone="slate" aria-label={t("path.opensTomorrow")}>
          <img src={mapPic("moon_and_stars")} alt="" width={44} height={22} decoding="async" draggable={false} className="pointer-events-none" />
        </Pressable>
      );
    }
    const day = addDays(new Date(), eveningsUntil(i));
    return (
      <Pressable key={i} {...common} shape="coin" tone="slate" aria-label={t("path.inEveningsCap", { count: eveningsUntil(i) })}
        faceClassName="text-[13px] font-bold tracking-[0.06em]">
        {weekdayShort(day)}
      </Pressable>
    );
  };

  // What's next, beside the focus stop, without a tap.
  const sideLabel = (() => {
    const align = labelRight ? "items-start text-left" : "items-end text-right";
    if (!s.tonightDone) {
      // Tonight's open bubble has the same START; don't show it twice.
      if (open === tonight) return null;
      const partly = answeredTonight > 0;
      return (
        <div className={cn("absolute z-10 flex flex-col gap-1.5", align)} style={{ left: label.x, top: f.y - 30, width: label.w }}>
          <Pressable tone="teal" haptic="medium" onClick={start} className="h-[42px] rounded-xl" faceClassName="px-4 text-[14px] font-extrabold uppercase tracking-[0.06em]">
            {partly ? t("path.continue") : t("path.start")}
          </Pressable>
          <span className="text-[15px] font-semibold leading-tight text-foreground">
            {partly ? t("path.left", { count: s.leftTonight }) : t("path.questions", { count: s.leftTonight })}
          </span>
        </div>
      );
    }
    if (s.weekComplete) {
      return (
        <div className={cn("absolute z-10 flex flex-col gap-1.5", align)} style={{ left: label.x, top: f.y - 30, width: label.w }}>
          <Pressable tone="gold" haptic="medium" onClick={onOpenReport} className="h-[42px] rounded-xl" faceClassName="px-4 text-[14px] font-extrabold uppercase tracking-[0.06em]">
            {t("path.openReport")}
          </Pressable>
          <span className="text-[15px] font-semibold leading-tight text-foreground">{reportLabel}</span>
        </div>
      );
    }
    return (
      <p className={cn("absolute z-10 text-[15px] font-semibold leading-tight text-foreground", labelRight ? "text-left" : "text-right")} style={{ left: label.x, top: f.y - 10, width: label.w }}>
        {t("path.tomorrow")}
      </p>
    );
  })();

  // A fragment, so the banner's sticky range is all of Today (it stays on
  // top while the question list scrolls under it), not just the path.
  return (
    <>
      {headerSlot && s.streak > 0 && createPortal(
        <span aria-label={t("path.streakAria", { count: s.streak })} className="surface inline-flex h-9 items-center gap-1 rounded-full pl-2 pr-3 text-[16px] font-bold tabular-nums text-foreground">
          <Flame className="h-[18px] w-[18px] fill-amber-400 text-amber-500" strokeWidth={2} />
          {s.streak}
        </span>,
        headerSlot,
      )}

      {/* The week: a raised banner. Tap: how far along, and last week's report.
          Stuck flush with the top of the scroll area, so nothing peeks above. */}
      <div className="sticky -top-4 z-[5] animate-fade-in">
        <Pressable tone={tone} onClick={() => setOpen((o) => (o === "banner" ? null : "banner"))} data-path-stop="banner"
          aria-expanded={open === "banner"} className="h-[82px] w-full rounded-[20px]" faceClassName="justify-between gap-3 px-[18px] text-left">
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold uppercase tracking-[0.06em] opacity-85">{t("path.weekN", { n: s.week + 1 })}</span>
            <span className="mt-0.5 block truncate text-[22px] font-bold leading-tight tracking-[-0.015em]">{title}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="text-[15px] font-bold tabular-nums">{s.doneInWeek}/{EVENINGS_PER_WEEK}</span>
            <span className="relative h-[52px] w-[52px]">
              <WeekRing size={52} done={s.doneInWeek} width={3.5} on="currentColor" off="color-mix(in srgb, currentColor 30%, transparent)" />
              <img src={mapPic("chest_closed")} alt="" width={32} height={27} decoding="async" draggable={false} className="pointer-events-none absolute left-[10px] top-[12px]" />
            </span>
          </span>
        </Pressable>
        {open === "banner" && (
          <div ref={bubbleRef} role="dialog" className="path-bubble surface absolute left-0 right-0 top-full z-20 mt-2 rounded-[20px] px-4 py-3.5" style={{ transformOrigin: "50% 0" }}>
            <p className="text-[17px] font-bold leading-tight">{t("path.weekProgress", { k: s.doneInWeek })}</p>
            <p className="mt-0.5 text-[15px] font-medium text-muted-foreground">
              {s.weekComplete ? t("path.reportReady") : `${reportLabel} · ${t("path.toGo", { count: toGo })}`}
            </p>
            {s.week > 0 && (
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
          {walked < CHEST && <path d={curve(Math.max(walked, 0), CHEST)} fill="none" stroke="hsl(var(--path-ahead))" strokeWidth={3} strokeDasharray="7 9" strokeLinecap="round" />}
          {walked > 0 && <path d={curve(0, walked)} fill="none" stroke="hsl(var(--coin-teal))" strokeWidth={3.5} strokeDasharray="7 9" strokeLinecap="round" />}
        </svg>

        {/* Her art beside the stops: static, seeded by the week. */}
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

        {stops.map((_, i) => coin(i))}
        {sideLabel}
        {typeof open === "number" && bubble(open)}
      </div>
      </section>
    </>
  );
};
