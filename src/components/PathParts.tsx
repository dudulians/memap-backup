// Pieces every week of the path draws the same way (Aurora steps 2 and 5):
// the road with depth, her art beside the coins, the seven-segment week
// ring, and a whole finished or coming week as a quiet strip.
import { useMemo, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { mapPic } from "@/lib/islands";
import { placeScenery, type Piece, type Rect } from "@/lib/pathScenery";
import { DAYS_PER_WEEK, type ChestRecord } from "@/lib/pathSteps";
import { Pressable, type PressTone } from "@/components/ui/pressable";

// Nodes lean left so every label sits on the right (one rule, her note:
// "подписи выглядят случайно расположенными").
export const XS = [110, 160, 185, 150, 95, 70, 115, 160];
export const DESIGN_W = 340;
export const R_DAY = 25;
export const R_CHEST = 38;
export const LIP = 5;
export const GAP = 26;
export const WEEK_TONES: PressTone[] = ["teal", "gold", "sky", "lilac"];
export const WEEK_TITLES = 4;

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

/** The road: an under-stroke for thickness, a pale ribbon, dashes on top
 *  (teal where walked, slate ahead). */
export const Road = ({ stops, width, height, walked }: { stops: Stop[]; width: number; height: number; walked: number }) => {
  const last = stops.length - 1;
  const road = curveThrough(stops, 0, last);
  return (
    <svg width={width} height={height} className="path-road absolute inset-0 overflow-visible" aria-hidden="true">
      {/* The road's side: same width, 6px down, the same depth as the coins' lip. */}
      <path d={road} transform={`translate(0 ${LIP})`} fill="none" stroke="hsl(var(--path-under))" strokeWidth={22} strokeLinecap="round" />
      <path d={road} fill="none" stroke="hsl(var(--path-ribbon))" strokeWidth={22} strokeLinecap="round" />
      {walked < last && <path d={curveThrough(stops, Math.max(walked, 0), last)} fill="none" stroke="hsl(var(--path-ahead))" strokeWidth={3.5} strokeDasharray="2 10" strokeLinecap="round" />}
      {walked > 0 && <path d={curveThrough(stops, 0, walked)} fill="none" stroke="hsl(var(--coin-teal))" strokeWidth={4} strokeDasharray="2 10" strokeLinecap="round" />}
    </svg>
  );
};

/** Her art beside the coins: static, with a contact shadow or water. */
export const Scenery = ({ pieces }: { pieces: Piece[] }) => (
  <>
    {pieces.map((p, k) => (
      <div key={k} aria-hidden="true" className="pointer-events-none absolute" style={{ left: p.x, top: p.y, width: p.w, height: p.h }}>
        {p.ripple && (
          <img src={mapPic("water_ripple")} alt="" width={Math.round(p.w * 1.15)} height={Math.round(p.w * 1.15 * 0.366)} decoding="async" loading="lazy" draggable={false}
            className="absolute max-w-none opacity-90" style={{ left: -p.w * 0.075, bottom: -p.w * 0.16 }} />
        )}
        {p.shadow && !p.ripple && (
          <span className="absolute rounded-[50%] blur-[2px]" style={{ left: p.w * 0.15, right: p.w * 0.15, bottom: -4, height: 9, background: "var(--scenery-shadow)" }} />
        )}
        <img src={mapPic(p.name)} alt="" width={p.w} height={p.h} decoding="async" loading="lazy" draggable={false} className="relative" />
      </div>
    ))}
  </>
);

/** The tile inside every node: white, rounded, a soft shadow, like her
 *  category icons, so art and line icons read as one family. */
export const NodeTile = ({ size, children }: { size: number; children: React.ReactNode }) => (
  <span className="pointer-events-none flex items-center justify-center rounded-[30%] bg-white shadow-[0_1px_3px_rgba(16,42,56,0.18)]"
    style={{ width: Math.round(size * 0.56), height: Math.round(size * 0.56) }}>
    {children}
  </span>
);

/** One label style for every node: a name, and under it what it means in
 *  words ("6 questions", "Done"). The current step's second line is its
 *  action. Labels sit on the right of the node unless there is no room. */
export const NodeLabel = ({ x, y, w, right, title, sub, action, muted, onClick }: {
  x: number; y: number; w: number; right: boolean; title: string; sub?: string; action?: boolean; muted?: boolean; onClick?: () => void;
}) => {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} aria-hidden={onClick ? undefined : true}
      className={cn("absolute z-[2] flex flex-col", right ? "items-start text-left" : "items-end text-right", !onClick && "pointer-events-none")}
      style={{ left: x, top: y - 20, width: w, minHeight: 40 }}>
      <span className={cn("line-clamp-2 text-[15px] font-bold leading-tight", muted ? "text-muted-foreground" : "text-foreground")}>{title}</span>
      {sub && (
        <span className={cn("mt-0.5 text-[13px] font-semibold leading-tight", action ? "text-[hsl(var(--coin-teal))]" : "text-muted-foreground")}>
          {sub}{action ? " →" : ""}
        </span>
      )}
    </Tag>
  );
};

/** The week, calm: a white slab with a coloured dot, the title and the
 *  seven-day ring with the chest. */
export const WeekBanner = ({ week, tone, done, onClick, expanded, ...rest }: {
  week: number; tone: PressTone; done: number; onClick?: () => void; expanded?: boolean; [k: string]: unknown;
}) => {
  const { t } = useTranslation();
  return (
    <Pressable tone="slate" haptic={onClick ? "tap" : "none"} onClick={onClick} aria-expanded={expanded} {...rest}
      className="h-[62px] w-full rounded-[18px]" faceClassName="justify-between gap-3 px-4 text-left !text-foreground">
      <span className="flex min-w-0 items-center gap-2.5">
        <span className={cn("h-3 w-3 shrink-0 rounded-full", `tone-${tone}`)} style={{ background: "hsl(var(--p3-face))" }} />
        <span className="min-w-0">
          <span className="block text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t("path.weekN", { n: week + 1 })}</span>
          <span className="block truncate text-[17px] font-bold leading-tight">{t(`path.title${week % WEEK_TITLES}`)}</span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="text-[14px] font-bold tabular-nums text-muted-foreground">{done}/{DAYS_PER_WEEK}</span>
        <span className="relative h-[40px] w-[40px]">
          <WeekRing size={40} done={done} width={3} on="hsl(var(--coin-gold))" off="hsl(var(--foreground) / 0.12)" />
          <img src={mapPic("chest_closed")} alt="" width={24} height={20} decoding="async" draggable={false} className="pointer-events-none absolute left-[8px] top-[10px]" />
        </span>
      </span>
    </Pressable>
  );
};

/** A whole week that isn't today's: finished (above, with its chest) or
 *  coming (below, quiet at 45%). Seven day coins and the chest. */
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
  const short = (d: Date) => {
    const w = d.toLocaleDateString(lang, { weekday: "short" }).replace(".", "").slice(0, 3);
    return w.charAt(0).toUpperCase() + w.slice(1);
  };
  const stops = useMemo(() => {
    const out: Stop[] = [];
    for (let i = 0; i <= DAYS_PER_WEEK; i++) {
      const r = i === DAYS_PER_WEEK ? R_CHEST : R_DAY;
      const y = i === 0 ? 24 + R_DAY : out[i - 1].y + out[i - 1].r + r + GAP;
      out.push({ x: Math.round((XS[i % XS.length] / DESIGN_W) * width), y, r });
    }
    return out;
  }, [width]);
  const height = stops[DAYS_PER_WEEK].y + R_CHEST + LIP + 24;
  const pieces = useMemo(() => {
    const blocked: Rect[] = stops.map((p) => ({ x: p.x - p.r - 4, y: p.y - p.r - 4, w: p.r * 2 + 8, h: p.r * 2 + LIP + 10 }));
    // Room for the notes beside the past days.
    if (kind === "past") stops.slice(0, DAYS_PER_WEEK).forEach((p) => {
      const right = width - (p.x + p.r) >= p.x - p.r;
      blocked.push({ x: right ? p.x + p.r + 12 : p.x - p.r - 12 - 104, y: p.y - 20, w: 104, h: 40 });
    });
    return placeScenery(week, stops, width, blocked, kind === "past" ? [0, 1, 2, 3, 4, 5, 6] : []);
  }, [stops, width, week, kind]);

  const tone = WEEK_TONES[week % WEEK_TONES.length];
  const day = (i: number) => {
    if (kind === "past" && dates?.[i]) return new Date(dates[i] + "T00:00:00");
    const d = new Date();
    d.setDate(d.getDate() + firstOffset + i);
    return d;
  };
  const opened = !!chest;

  return (
    <div className={cn(kind === "coming" && "path-coming")} aria-hidden={kind === "coming" ? true : undefined}>
      <WeekBanner week={week} tone={tone} done={kind === "past" ? DAYS_PER_WEEK : 0} onClick={kind === "past" ? onOpenChest : undefined} />
      <div className="relative mx-auto mt-1" style={{ width, height }}>
        <Road stops={stops} width={width} height={height} walked={kind === "past" ? DAYS_PER_WEEK : 0} />
        <Scenery pieces={pieces} />
        {stops.map((p, i) => {
          const place: CSSProperties = { left: p.x - p.r, top: p.y - p.r, width: p.r * 2, height: p.r * 2 + LIP };
          if (i === DAYS_PER_WEEK) {
            return (
              <Pressable key={i} shape="coin" tone="gold" className="absolute" style={place} haptic={kind === "past" ? "tap" : "none"}
                onClick={kind === "past" ? onOpenChest : undefined} aria-label={t("path.weekReport")} tabIndex={kind === "coming" ? -1 : undefined}>
                <img src={mapPic(opened ? "chest_open_map" : "chest_closed")} alt="" width={opened ? 54 : 58} height={opened ? 56 : 49} decoding="async" loading="lazy" draggable={false} className="pointer-events-none" />
                {kind === "past" && !opened && <img src={mapPic("sparkles")} alt="" width={26} height={26} decoding="async" loading="lazy" draggable={false} className="pointer-events-none absolute -right-2 -top-2" />}
              </Pressable>
            );
          }
          const d = day(i);
          if (kind === "past") {
            const right = width - (p.x + p.r) >= p.x - p.r;
            return (
              <div key={i}>
                <Pressable shape="coin" tone="teal" className="absolute" style={place} onClick={() => dates?.[i] && onOpenDay?.(dates[i])} aria-label={d.toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" })}>
                  <NodeTile size={p.r * 2}><Check className="h-[55%] w-[55%] text-[hsl(var(--coin-teal))]" strokeWidth={3} /></NodeTile>
                </Pressable>
                <NodeLabel x={right ? p.x + p.r + 12 : p.x - p.r - 12 - 104} y={p.y} w={104} right={right} title={`${short(d)} ${d.getDate()}`} sub={t("path.done")} muted />
              </div>
            );
          }
          return (
            <Pressable key={i} shape="coin" tone="slate" className="absolute" style={place} haptic="none" tabIndex={-1} faceClassName="text-[12px] font-bold uppercase tracking-[0.06em]">
              {short(d)}
            </Pressable>
          );
        })}
      </div>
    </div>
  );
};
