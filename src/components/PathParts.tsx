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

export const XS = [140, 220, 250, 200, 120, 90, 150, 205];
export const DESIGN_W = 340;
export const R_DAY = 30;
export const R_CHEST = 46;
export const LIP = 6;
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
      <path d={road} transform="translate(0 3)" fill="none" stroke="hsl(var(--path-under))" strokeWidth={18} strokeLinecap="round" />
      <path d={road} fill="none" stroke="hsl(var(--path-ribbon))" strokeWidth={16} strokeLinecap="round" />
      {walked < last && <path d={curveThrough(stops, Math.max(walked, 0), last)} fill="none" stroke="hsl(var(--path-ahead))" strokeWidth={3} strokeDasharray="7 9" strokeLinecap="round" />}
      {walked > 0 && <path d={curveThrough(stops, 0, walked)} fill="none" stroke="hsl(var(--coin-teal))" strokeWidth={3.5} strokeDasharray="7 9" strokeLinecap="round" />}
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
      blocked.push({ x: right ? p.x + p.r + 12 : p.x - p.r - 12 - 96, y: p.y - 12, w: 96, h: 24 });
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
      <Pressable tone={tone} haptic={kind === "past" ? "tap" : "none"} onClick={kind === "past" ? onOpenChest : undefined}
        className="h-[70px] w-full rounded-[20px]" faceClassName="justify-between gap-3 px-[18px] text-left">
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold uppercase tracking-[0.06em] opacity-85">{t("path.weekN", { n: week + 1 })}</span>
          <span className="mt-0.5 block truncate text-[19px] font-bold leading-tight tracking-[-0.015em]">{t(`path.title${week % WEEK_TITLES}`)}</span>
        </span>
        {kind === "past" && <span className="text-[15px] font-bold tabular-nums">{DAYS_PER_WEEK}/{DAYS_PER_WEEK}</span>}
      </Pressable>
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
                  <Check className="h-6 w-6" strokeWidth={3.2} />
                </Pressable>
                <p aria-hidden="true" className={cn("pointer-events-none absolute text-[14px] font-semibold leading-tight text-muted-foreground", right ? "text-left" : "text-right")}
                  style={{ left: right ? p.x + p.r + 12 : p.x - p.r - 12 - 96, top: p.y - 9, width: 96 }}>
                  {short(d)} {d.getDate()}
                </p>
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
