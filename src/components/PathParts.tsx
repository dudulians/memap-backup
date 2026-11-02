// Pieces every week of the path draws the same way. Since Nov 2 2026 (her
// reference picture, "вот так получше будет"): flat round nodes with a soft
// shadow and a plain line icon (no 3D lip, no pasted tiles), a white pill
// label growing out of each node to the right, a calm dashed road, a white
// week card with a progress bar, and only a few quiet pieces of scenery.
import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronRight, Gift, MoonStar } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { mapPic } from "@/lib/islands";
import { placeScenery, type Piece, type Rect } from "@/lib/pathScenery";
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

/** One smooth curve through the stops, vertical at each stop. */
export const curveThrough = (stops: Stop[], from: number, to: number) => {
  let d = `M${stops[from].x},${stops[from].y}`;
  for (let i = from + 1; i <= to; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    const my = (a.y + b.y) / 2;
    d += ` C${a.x},${my} ${b.x},${my} ${b.x},${b.y}`;
  }
  return d;
};

/** The road: a soft pale ribbon with dashes on top, teal where walked. */
export const Road = ({ stops, width, height, walked }: { stops: Stop[]; width: number; height: number; walked: number }) => {
  const last = stops.length - 1;
  const road = curveThrough(stops, 0, last);
  return (
    <svg width={width} height={height} className="path-road absolute inset-0 overflow-visible" aria-hidden="true">
      <path d={road} fill="none" stroke="hsl(var(--path-ribbon))" strokeOpacity={0.85} strokeWidth={16} strokeLinecap="round" />
      {walked < last && <path d={curveThrough(stops, Math.max(walked, 0), last)} fill="none" stroke="hsl(var(--path-ahead))" strokeWidth={3} strokeDasharray="7 8" strokeLinecap="round" />}
      {walked > 0 && <path d={curveThrough(stops, 0, walked)} fill="none" stroke="hsl(var(--coin-teal))" strokeWidth={3.5} strokeDasharray="7 8" strokeLinecap="round" />}
    </svg>
  );
};

/** A few quiet pieces of her art beside the path, with a soft shadow. */
export const Scenery = ({ pieces }: { pieces: Piece[] }) => (
  <>
    {pieces.map((p, k) => (
      <div key={k} aria-hidden="true" className="pointer-events-none absolute" style={{ left: p.x, top: p.y, width: p.w, height: p.h }}>
        {p.shadow && (
          <span className="absolute rounded-[50%] blur-[2px]" style={{ left: p.w * 0.15, right: p.w * 0.15, bottom: -3, height: 7, background: "var(--scenery-shadow)" }} />
        )}
        <img src={mapPic(p.name)} alt="" width={p.w} height={p.h} decoding="async" loading="lazy" draggable={false} className="relative" />
      </div>
    ))}
  </>
);

export type NodeLook = "done" | "current" | "todo" | "gold";

/** A flat round node: teal when done or current, white ahead, gold for the
 *  week's reward. A plain line icon sits right in it. Pressing shrinks it a
 *  little, with a light tap. */
export const PathNode = ({ stop, look, children, onClick, label, refEl, pressedRing, dataStop, expanded, wiggle }: {
  stop: Stop; look: NodeLook; children: ReactNode; onClick?: () => void; label: string;
  refEl?: React.Ref<HTMLButtonElement>; pressedRing?: number; dataStop?: number; expanded?: boolean; wiggle?: boolean;
}) => {
  const size = stop.r * 2;
  return (
    <button ref={refEl} type="button" data-path-stop={dataStop} aria-label={label} aria-expanded={expanded}
      onClick={() => { if (onClick) { haptics.tap(); onClick(); } }}
      className={cn(
        "path-node absolute z-[3] flex items-center justify-center rounded-full transition-transform duration-150 active:scale-[0.94]",
        look === "done" && "bg-[hsl(var(--coin-teal))] text-white",
        look === "current" && "bg-[hsl(var(--coin-teal))] text-white",
        look === "todo" && "bg-white text-[hsl(var(--muted-foreground))] dark:bg-[hsl(var(--surface))]",
        look === "gold" && "bg-[hsl(var(--coin-gold))] text-white",
        wiggle && "path-wiggle-flat",
      )}
      style={{ left: stop.x - stop.r, top: stop.y - stop.r, width: size, height: size, boxShadow: look === "todo" ? "0 6px 16px -8px rgba(16,42,56,0.35)" : "0 8px 18px -8px rgba(16,42,56,0.45)" }}>
      {look === "current" && (
        <span aria-hidden="true" className="path-halo pointer-events-none absolute rounded-full" style={{ inset: -(pressedRing ?? 10), background: "hsl(var(--coin-teal) / 0.16)", boxShadow: "0 0 0 1px hsl(var(--coin-teal) / 0.18)" }} />
      )}
      <span className="relative flex items-center justify-center">{children}</span>
    </button>
  );
};

/** The label: a white pill that grows out of the node to the right. The
 *  node covers its left end. The current step's pill is taller and holds a
 *  "Start" button. */
export const NodePill = ({ stop, title, sub, action, onAction, maxRight, muted, big }: {
  stop: Stop; title: string; sub?: string; action?: string; onAction?: () => void; maxRight: number; muted?: boolean; big?: boolean;
}) => {
  const left = stop.x;
  const h = big ? 70 : 42;
  return (
    <div className="pointer-events-none absolute z-[2] flex items-center rounded-full bg-white/90 shadow-[0_6px_18px_-12px_rgba(16,42,56,0.45)] backdrop-blur-sm dark:bg-[hsl(var(--surface)/0.92)]"
      style={{ left, top: stop.y - h / 2, height: h, maxWidth: maxRight - left, paddingLeft: stop.r + 12, paddingRight: action ? 8 : 18 }}>
      <span className="min-w-0 flex-1">
        <span className={cn("block font-semibold leading-tight", big ? "line-clamp-2 text-[18px]" : "truncate text-[15px]", muted ? "text-foreground/75" : "text-foreground")}>{title}</span>
        {sub && <span className="mt-0.5 block truncate text-[14px] font-medium text-muted-foreground">{sub}</span>}
      </span>
      {action && (
        <button type="button" onClick={() => { haptics.medium(); onAction?.(); }}
          className="pointer-events-auto ml-2 inline-flex h-10 shrink-0 items-center gap-0.5 rounded-full bg-[hsl(var(--coin-teal))] pl-3.5 pr-2.5 text-[15px] font-bold text-white shadow-[0_6px_14px_-8px_hsl(var(--coin-teal))] active:scale-[0.96] transition-transform">
          {action} <ChevronRight className="h-5 w-5" strokeWidth={2.6} />
        </button>
      )}
    </div>
  );
};

/** The week card: "Week 1", its title, a progress bar, days done, the chest
 *  and a round arrow (her reference picture). */
export const WeekBanner = ({ week, done, onClick, expanded, opened, ...rest }: {
  week: number; done: number; onClick?: () => void; expanded?: boolean; opened?: boolean; [k: string]: unknown;
}) => {
  const { t } = useTranslation();
  return (
    <button type="button" onClick={() => { if (onClick) { haptics.tap(); onClick(); } }} aria-expanded={expanded} {...rest}
      className="surface flex w-full items-center gap-3 rounded-[24px] px-5 py-4 text-left active:scale-[0.99] transition-transform">
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-muted-foreground">{t("path.weekN", { n: week + 1 })}</span>
        <span className="mt-0.5 block truncate text-[24px] font-bold leading-tight tracking-[-0.015em]">{t(`path.title${week % WEEK_TITLES}`)}</span>
        <span className="mt-3 block h-2.5 overflow-hidden rounded-full bg-foreground/[0.08]">
          <span className="block h-full rounded-full bg-[hsl(var(--coin-teal))] transition-all duration-700" style={{ width: `${(done / DAYS_PER_WEEK) * 100}%` }} />
        </span>
      </span>
      <span className="text-[18px] font-semibold tabular-nums text-foreground/80">{done} / {DAYS_PER_WEEK}</span>
      <img src={mapPic(opened ? "chest_open_map" : "chest_closed")} alt="" width={52} height={44} decoding="async" draggable={false} className="pointer-events-none" />
      {onClick && (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--coin-teal)/0.1)] text-[hsl(var(--coin-teal))]">
          <ChevronRight className="h-5 w-5" strokeWidth={2.6} />
        </span>
      )}
    </button>
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
  const pieces = useMemo(() => {
    const blocked: Rect[] = stops.map((p) => ({ x: p.x - p.r - 6, y: p.y - 26, w: width - p.x + p.r + 6, h: 52 }));
    return placeScenery(week, stops, width, blocked, []);
  }, [stops, width, week]);
  const day = (i: number) => {
    if (kind === "past" && dates?.[i]) return new Date(dates[i] + "T00:00:00");
    const d = new Date();
    d.setDate(d.getDate() + firstOffset + i);
    return d;
  };

  return (
    <div className={cn("mt-4", kind === "coming" && "path-coming")} aria-hidden={kind === "coming" ? true : undefined}>
      <WeekBanner week={week} done={kind === "past" ? DAYS_PER_WEEK : 0} opened={!!chest} onClick={kind === "past" ? onOpenChest : undefined} />
      <div className="relative mx-auto mt-2" style={{ width, height }}>
        <Road stops={stops} width={width} height={height} walked={kind === "past" ? DAYS_PER_WEEK : 0} />
        <Scenery pieces={pieces} />
        {stops.map((p, i) => {
          if (i === DAYS_PER_WEEK) {
            return (
              <div key={i}>
                <NodePill stop={p} title={kind === "past" ? (chest ? t("path.chest.mapOfWeek") : t("path.chest.ready")) : t("path.weekReport")} maxRight={width} muted={kind === "coming"} />
                <PathNode stop={p} look={kind === "past" ? "gold" : "todo"} label={t("path.weekReport")} onClick={kind === "past" ? onOpenChest : undefined}>
                  <Gift className="h-6 w-6" strokeWidth={2.2} />
                </PathNode>
              </div>
            );
          }
          const d = day(i);
          return (
            <div key={i}>
              <NodePill stop={p} title={dayName(d)} maxRight={width} muted />
              <PathNode stop={p} look={kind === "past" ? "done" : "todo"} label={dayName(d)}
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
