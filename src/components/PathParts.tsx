// Pieces every week of the path draws the same way. Since Nov 2 2026 (her
// reference picture, "вот так получше будет"): flat round nodes with a soft
// shadow and a plain line icon (no 3D lip, no pasted tiles), a white pill
// label growing out of each node to the right, a calm dashed road, a white
// week card with a progress bar. Since Nov 3 2026 her own day/night picture
// is behind the path, and nothing is scattered on it (her note).
import { useId, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Briefcase, Check, ChevronRight, Coffee, Dumbbell, Flower2, Gift, Heart, HeartPulse, Home, Layers, Lock, MoonStar, Music, Palette, PawPrint, Plane, Sprout, Users, Utensils, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { playTick } from "@/lib/feedback";
import { DAYS_PER_WEEK, type ChestRecord } from "@/lib/pathSteps";

// Nodes sit in the left half, a gentle zigzag, so every pill fits on the right.
export const XS = [156, 95, 109, 156, 109, 85, 126, 150];
export const DESIGN_W = 340;
export const R_DAY = 24;
export const R_STEP = 27;
export const R_CURRENT = 36;
export const R_CHEST = 30;
export const GAP = 30;
export const WEEK_TITLES = 4;
/** Kept for callers that still pass a week tone. */
export type { PressTone } from "@/components/ui/pressable";

export type Stop = { x: number; y: number; r: number };
/** Days still ahead: a soft night blue, so the path ahead isn't grey. */
export const DAY_AHEAD = "232 34% 64%";

/** Seven arcs around a point: one per day of the week. */
export const WeekRing = ({ size, done, on, off, width = 4 }: { size: number; done: number; on: string; off: string; width?: number }) => {
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

/** One smooth curve through the stops, vertical at each stop. `wy` moves
 *  every height (Today's drum bends the road with its steps, EveningPath). */
export const curveThrough = (stops: Stop[], from: number, to: number, wy: (y: number) => number = (y) => y) => {
  const at = (y: number) => Math.round(wy(y) * 10) / 10;
  let d = `M${stops[from].x},${at(stops[from].y)}`;
  for (let i = from + 1; i <= to; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    const my = at((a.y + b.y) / 2);
    d += ` C${a.x},${my} ${b.x},${my} ${b.x},${at(b.y)}`;
  }
  return d;
};

/** The road: a soft pale ribbon with dashes on top, teal where walked. The
 *  stops and each line's span are kept on it, so the drum can bend it. */
export const Road = ({ stops, width, height, walked }: { stops: Stop[]; width: number; height: number; walked: number }) => {
  const last = stops.length - 1;
  const ahead = Math.max(walked, 0);
  return (
    <svg width={width} height={height} className="path-road absolute inset-0 overflow-visible" aria-hidden="true"
      data-stops={stops.map((p) => `${p.x},${p.y}`).join(" ")} data-h={height}>
      <path data-from={0} data-to={last} d={curveThrough(stops, 0, last)} fill="none" stroke="var(--path-shadow)" strokeWidth={22} strokeLinecap="round" transform="translate(0 4)" />
      <path data-from={0} data-to={last} d={curveThrough(stops, 0, last)} fill="none" stroke="hsl(var(--path-ribbon))" strokeOpacity={0.85} strokeWidth={16} strokeLinecap="round" />
      {walked < last && <path data-from={ahead} data-to={last} d={curveThrough(stops, ahead, last)} fill="none" stroke="hsl(var(--path-ahead))" strokeWidth={3} strokeDasharray="7 8" strokeLinecap="round" />}
      {walked > 0 && <path data-from={0} data-to={walked} d={curveThrough(stops, 0, walked)} fill="none" stroke="hsl(var(--coin-teal))" strokeWidth={3.5} strokeDasharray="7 8" strokeLinecap="round" />}
    </svg>
  );
};

/** Where the scroll may come to rest: a still point at a stop's centre (the
 *  node itself rolls on the drum, and a moving element would move its own
 *  snap position). */
export const SnapDot = ({ stop }: { stop: Stop }) => (
  <span aria-hidden="true" className="path-snap pointer-events-none absolute snap-center" style={{ left: stop.x - 1, top: stop.y - 1, width: 2, height: 2 }} />
);

/** done: filled + check; current: the main step; todo: open now (white,
 *  full coloured rim and a soft glow); gold: a reward ready; locked: not yet
 *  (grey, with a lock; her note, Nov 3 2026: "визуально должно быть понятно,
 *  какие уровни открыты, а какие ещё нет"). */
export type NodeLook = "done" | "current" | "todo" | "gold" | "locked";
/** circle: questions and days; badge (wavy edge): games; square: practices and tasks. */
export type NodeShape = "circle" | "badge" | "square";

/** A wavy "badge" outline (10 soft lobes) in a size×size box. */
const badgePath = (size: number) => {
  const c = size / 2, R = size / 2 - 1.5, pts: string[] = [];
  for (let k = 0; k <= 120; k++) {
    const a = (k / 120) * Math.PI * 2;
    const r = R * (0.92 + 0.08 * Math.cos(10 * a));
    pts.push(`${(c + r * Math.cos(a)).toFixed(2)},${(c + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join(" L")} Z`;
};

/** Line icons for the islands (one family with the rest of the path, her
 *  note: pasted 3D tiles looked "нелепо"). Keys are the island icon names. */
const ICONS: Record<string, LucideIcon> = {
  wellbeing: Flower2, love: Heart, growth: Sprout, health: HeartPulse, fitness: Dumbbell, pets: PawPrint,
  family: Users, travel: Plane, career: Briefcase, books: BookOpen, hobbies: Palette, music: Music,
  food: Utensils, coffee: Coffee, home: Home,
};
export const islandIcon = (name?: string): LucideIcon => (name && ICONS[name]) || Layers;

/** A round node in its topic's calm colour (her: "кружки смотрятся скучно и
 *  грустно"): done and current are filled, with a white rim and soft light
 *  from above; steps ahead are white with the coloured icon and a tinted
 *  rim; the reward is gold. `hue` is "h s% l%" or a var(). Pressing shrinks
 *  it a little, with a light tap. */
export const PathNode = ({ stop, look, children, onClick, label, refEl, pressedRing, dataStop, expanded, wiggle, hue = "var(--coin-teal)", shape = "circle", lock = true }: {
  stop: Stop; look: NodeLook; children: ReactNode; onClick?: () => void; label: string;
  refEl?: React.Ref<HTMLButtonElement>; pressedRing?: number; dataStop?: number; expanded?: boolean; wiggle?: boolean; hue?: string;
  shape?: NodeShape;
  /** a locked node shows its lock (the quiet coming weeks don't) */
  lock?: boolean;
}) => {
  const size = stop.r * 2;
  const tone = look === "gold" ? "var(--coin-gold)" : hue;
  const locked = look === "locked";
  const filled = look !== "todo" && !locked;
  const gid = `g${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const badge = shape === "badge";
  const radius = shape === "square" ? "32%" : "9999px";
  return (
    <button ref={refEl} type="button" data-path-stop={dataStop} data-shape={shape} aria-label={label} aria-expanded={expanded}
      onClick={() => { if (onClick) { haptics.tap(); playTick(true); onClick(); } }}
      className={cn(
        "path-node absolute z-[3] flex items-center justify-center transition-transform duration-150 active:scale-[0.92]",
        filled ? "text-white" : locked ? !badge && "bg-[hsl(var(--path-locked))]" : !badge && "bg-white dark:bg-[hsl(var(--surface))]",
        wiggle && "path-wiggle-flat",
      )}
      style={{
        left: stop.x - stop.r, top: stop.y - stop.r, width: size, height: size, borderRadius: radius,
        color: filled ? undefined : locked ? "hsl(var(--muted-foreground) / 0.75)" : `hsl(${tone})`,
        background: badge ? undefined : filled ? `linear-gradient(180deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0) 58%), hsl(${tone})` : undefined,
        border: badge ? undefined : filled ? "3px solid hsl(var(--surface))" : locked ? "2px solid hsl(var(--muted-foreground) / 0.2)" : `3.5px solid hsl(${tone})`,
        boxShadow: badge || locked ? undefined : filled
          ? `0 9px 18px -9px hsl(${tone} / 0.75), inset 0 -3px 0 rgba(0,0,0,0.06)`
          : `0 0 0 4px hsl(${tone} / 0.14), 0 8px 18px -8px hsl(${tone} / 0.6)`,
      }}>
      {look === "current" && (
        <span aria-hidden="true" className="path-halo pointer-events-none absolute"
          style={{ inset: -(pressedRing ?? 11), borderRadius: shape === "square" ? "36%" : "9999px", background: `hsl(${tone} / 0.16)`, boxShadow: `0 0 0 1px hsl(${tone} / 0.2)` }} />
      )}
      {/* A game: the same colours on a wavy badge edge. */}
      {badge && (
        <svg aria-hidden="true" width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="pointer-events-none absolute inset-0"
          style={{ filter: filled ? `drop-shadow(0 7px 8px hsl(${tone} / 0.45))` : "drop-shadow(0 5px 7px rgba(16,42,56,0.22))" }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity={filled ? 0.26 : 0} />
              <stop offset="0.58" stopColor="#fff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={badgePath(size)} fill={filled ? `hsl(${tone})` : locked ? "hsl(var(--path-locked))" : "hsl(var(--surface))"}
            stroke={filled ? "hsl(var(--surface))" : locked ? "hsl(var(--muted-foreground) / 0.2)" : `hsl(${tone})`} strokeWidth={locked ? 2 : 3.5}
            strokeLinejoin="round" />
          {filled && <path d={badgePath(size)} fill={`url(#${gid})`} />}
        </svg>
      )}
      <span className="relative flex items-center justify-center">{children}</span>
      {locked && lock && (
        <span aria-hidden="true" className="absolute -bottom-1 -right-1 z-[1] flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white text-muted-foreground shadow-[0_2px_6px_rgba(16,42,56,0.25)] dark:bg-[hsl(var(--surface))]">
          <Lock className="h-3 w-3" strokeWidth={2.6} />
        </span>
      )}
    </button>
  );
};

/** The label: a white pill that grows out of the node to the right. The
 *  node covers its left end. The current step's pill is taller and holds a
 *  "Start" button. Tapping the pill does what tapping its node does (her
 *  note, Nov 3 2026: "чтобы нажать на шаг, можно нажать и на плашку"). */
export const NodePill = ({ stop, title, sub, action, onAction, maxRight, muted, big, second, onSecond, open, dim, locked, tone, onTap }: {
  stop: Stop; title: string; sub?: string; action?: string; onAction?: () => void; maxRight: number; muted?: boolean; big?: boolean;
  second?: string; onSecond?: () => void;
  /** open now: bold, with an arrow in its colour */
  open?: boolean;
  /** not yet: dim */
  dim?: boolean;
  /** not yet: a lock at the end */
  locked?: boolean;
  /** the step's colour, "h s% l%" or a var() */
  tone?: string;
  /** the same as tapping the node */
  onTap?: () => void;
}) => {
  const left = stop.x;
  const h = big ? 70 : 42;
  return (
    <>
    {second && (
      <button type="button" onClick={() => { haptics.tap(); onSecond?.(); }}
        className="absolute z-[2] h-8 rounded-full px-3 text-[14px] font-semibold text-muted-foreground active:opacity-60"
        style={{ right: 4, top: stop.y + h / 2 + 2 }}>
        {second}
      </button>
    )}
    <div onClick={onTap ? () => { haptics.tap(); onTap(); } : undefined}
      className={cn("absolute z-[2] flex items-center rounded-full bg-white/90 shadow-[0_6px_18px_-12px_rgba(16,42,56,0.45)] backdrop-blur-sm dark:bg-[hsl(var(--surface)/0.92)]",
        onTap ? "cursor-pointer transition-transform duration-150 active:scale-[0.98]" : "pointer-events-none",
        dim && "bg-white/60 shadow-none dark:bg-[hsl(var(--surface)/0.5)]")}
      style={{ left, top: stop.y - h / 2, height: h, maxWidth: maxRight - left, paddingLeft: stop.r + 12, paddingRight: action ? 8 : 14 }}>
      <span className="min-w-0 flex-1">
        <span className={cn("block leading-tight", big ? "line-clamp-2 text-[18px] font-semibold" : "truncate text-[15px]", open ? "font-bold text-foreground" : "font-semibold", muted || dim ? "text-foreground/60" : "text-foreground")}>{title}</span>
        {sub && <span className="mt-0.5 block truncate text-[14px] font-medium text-muted-foreground">{sub}</span>}
      </span>
      {open && !action && <ChevronRight aria-hidden="true" className="ml-1 h-5 w-5 shrink-0" strokeWidth={2.8} style={{ color: `hsl(${tone ?? "var(--coin-teal)"})` }} />}
      {locked && !action && <Lock aria-hidden="true" className="ml-1.5 h-4 w-4 shrink-0 text-muted-foreground/70" strokeWidth={2.4} />}
      {action && (
        <button type="button" onClick={(e) => { e.stopPropagation(); haptics.medium(); onAction?.(); }}
          className="pointer-events-auto ml-2 inline-flex h-10 shrink-0 items-center gap-0.5 rounded-full bg-[hsl(var(--coin-teal))] pl-3.5 pr-2.5 text-[15px] font-bold text-white shadow-[0_6px_14px_-8px_hsl(var(--coin-teal))] active:scale-[0.96] transition-transform">
          {action} <ChevronRight className="h-5 w-5" strokeWidth={2.6} />
        </button>
      )}
    </div>
    </>
  );
};

/** Stops for a week of eight nodes (seven days and the reward). */
export const weekStops = (width: number, radii: number[], top = 24) => {
  const out: Stop[] = [];
  radii.forEach((r, i) => {
    const y = i === 0 ? top + r : out[i - 1].y + out[i - 1].r + r + GAP;
    out.push({ x: Math.round((XS[i % XS.length] / DESIGN_W) * width), y, r });
  });
  return out;
};

/** A whole week that isn't today's: finished (above) or coming (below,
 *  quiet at 45%). Seven day nodes and the reward. */
export const WeekStrip = ({
  week,
  width,
  kind,
  dates,
  firstOffset = 0,
  chest,
  onOpenDay,
  onOpenChest,
}: {
  week: number;
  width: number;
  kind: "past" | "coming";
  /** past: the seven days */
  dates?: string[];
  /** coming: days from today to this week's first day */
  firstOffset?: number;
  chest?: ChestRecord | null;
  onOpenDay?: (date: string) => void;
  onOpenChest?: () => void;
}) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith("ru") ? "ru-RU" : "en-US";
  const dayName = (d: Date) => {
    const w = d.toLocaleDateString(lang, { weekday: "long" });
    return w.charAt(0).toUpperCase() + w.slice(1);
  };
  const stops = useMemo(() => weekStops(width, [...Array(DAYS_PER_WEEK).fill(R_DAY), R_CHEST]), [width]);
  const height = stops[DAYS_PER_WEEK].y + R_CHEST + 28;
  const day = (i: number) => {
    if (kind === "past" && dates?.[i]) return new Date(dates[i] + "T00:00:00");
    const d = new Date();
    d.setDate(d.getDate() + firstOffset + i);
    return d;
  };

  return (
    <div className={cn("mt-4", kind === "coming" && "path-coming")} aria-hidden={kind === "coming" ? true : undefined}>
      {/* the week's name, plain, rolling with its days (EveningPath) */}
      <div>
        <div data-wheel>
          <p className="path-week-label">{t("path.weekN", { n: week + 1 })}</p>
        </div>
      </div>
      <div className="path-box relative mx-auto mt-2 [overflow-x:clip]" style={{ width, height }}>
        <Road stops={stops} width={width} height={height} walked={kind === "past" ? DAYS_PER_WEEK : 0} />
        {stops.map((p, i) => <SnapDot key={`s${i}`} stop={p} />)}
        {stops.map((p, i) => {
          if (i === DAYS_PER_WEEK) {
            return (
              <div key={i} data-wheel data-cy={p.y} style={{ transformOrigin: `${p.x}px ${p.y}px` }}>
                <NodePill stop={p} title={kind === "past" ? (chest ? t("path.chest.mapOfWeek") : t("path.chest.ready")) : t("path.weekReport")} maxRight={width} dim={kind === "coming"}
                  onTap={kind === "past" ? onOpenChest : undefined} />
                <PathNode stop={p} look={kind === "past" ? "gold" : "locked"} lock={false} hue="var(--coin-gold)" label={t("path.weekReport")} onClick={kind === "past" ? onOpenChest : undefined}>
                  <Gift className="h-6 w-6" strokeWidth={2.2} />
                </PathNode>
              </div>
            );
          }
          const d = day(i);
          return (
            <div key={i} data-wheel data-cy={p.y} style={{ transformOrigin: `${p.x}px ${p.y}px` }}>
              <NodePill stop={p} title={dayName(d)} maxRight={width} muted={kind === "past"} dim={kind === "coming"}
                onTap={kind === "past" && dates?.[i] ? () => onOpenDay?.(dates[i]) : undefined} />
              <PathNode stop={p} look={kind === "past" ? "done" : "locked"} lock={false} label={dayName(d)} hue={kind === "past" ? undefined : DAY_AHEAD}
                onClick={kind === "past" && dates?.[i] ? () => onOpenDay?.(dates[i]) : undefined}>
                {kind === "past" ? <Check className="h-5 w-5" strokeWidth={3} /> : <MoonStar className="h-5 w-5" strokeWidth={2} />}
              </PathNode>
            </div>
          );
        })}
      </div>
    </div>
  );
};
