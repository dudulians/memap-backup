// Pieces every week of the path draws the same way. Since Nov 2 2026 (her
// reference picture, "вот так получше будет"): flat round nodes with a soft
// shadow and a plain line icon (no 3D lip, no pasted tiles), a white pill
// label growing out of each node to the right, a calm dashed road, a white
// week card with a progress bar. Since Nov 3 2026 her own day/night picture
// is behind the path, and nothing is scattered on it (her note).
import { useMemo, type ReactNode } from "react";
import { art } from "@/lib/globeArt";
import { mapPicFor } from "@/lib/islands";
import { useTranslation } from "react-i18next";
import { BookOpen, Briefcase, Check, ChevronRight, Coffee, Dumbbell, FileBarChart2, Flower2, Heart, HeartPulse, Home, Layers, Lock, MoonStar, Music, Palette, PawPrint, Plane, Sprout, Users, Utensils, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { playTick } from "@/lib/feedback";
import { DAYS_PER_WEEK, type ChestRecord } from "@/lib/pathSteps";

// Lights wind down the middle, Duolingo-style (her note, Nov 4 2026): a share
// of the width left (-) or right (+) of the centre, eight to a turn.
export const ZIG = [0, 0.16, 0.24, 0.16, 0, -0.16, -0.24, -0.16];
// About a quarter bigger since Nov 3 2026 (her note: "увеличим кружочки").
export const R_DAY = 30;
export const R_STEP = 34;
export const R_CURRENT = 44;
export const R_CHEST = 38;
// room under each light for its name
export const GAP = 56;
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


/** done: filled + check; current: the main step; todo: open now (white,
 *  full coloured rim and a soft glow); gold: a reward ready; locked: not yet
 *  (grey, with a lock; her note, Nov 3 2026: "визуально должно быть понятно,
 *  какие уровни открыты, а какие ещё нет"). */
export type NodeLook = "done" | "current" | "todo" | "gold" | "locked";
/** Line icons for the islands (one family with the rest of the path, her
 *  note: pasted 3D tiles looked "нелепо"). Keys are the island icon names. */
const ICONS: Record<string, LucideIcon> = {
  wellbeing: Flower2, love: Heart, growth: Sprout, health: HeartPulse, fitness: Dumbbell, pets: PawPrint,
  family: Users, travel: Plane, career: Briefcase, books: BookOpen, hobbies: Palette, music: Music,
  food: Utensils, coffee: Coffee, home: Home,
};
export const islandIcon = (name?: string): LucideIcon => (name && ICONS[name]) || Layers;

/** A step on the path: a round, slightly raised disc with its icon, as on
 *  Duolingo (her note, Nov 4 2026: "кружочки … слегка объёмные … с нашими
 *  иконками"). Done = gold with a check; her step = her topic's colour with a
 *  ring round it; open today = white, the icon in its colour; not yet = grey.
 *  `hue` is "h s% l%" or a var(). Pressing sinks it onto its lip. */
export const PathNode = ({ stop, look, children, onClick, label, refEl, dataStop, expanded, wiggle, hue = "var(--coin-teal)" }: {
  stop: Stop; look: NodeLook; children?: ReactNode; onClick?: () => void; label: string;
  refEl?: React.Ref<HTMLButtonElement>; dataStop?: number; expanded?: boolean; wiggle?: boolean; hue?: string;
}) => {
  const size = stop.r * 2;
  return (
    <>
    <span aria-hidden="true" className="path-ripple" style={{ left: stop.x - stop.r * 1.1, top: stop.y + stop.r * 0.5, width: stop.r * 2.2, height: stop.r * 0.7 }} />
    <button ref={refEl} type="button" data-path-stop={dataStop} aria-label={label} aria-expanded={expanded}
      onClick={() => { if (onClick) { haptics.tap(); playTick(true); onClick(); } }}
      className={cn("path-node absolute z-[3] rounded-full", `disc-${look}`, wiggle && "path-wiggle-flat")}
      style={{ left: stop.x - stop.r, top: stop.y - stop.r, width: size, height: size, ["--hue" as string]: look === "gold" ? "var(--coin-gold)" : hue }}>
      {look === "current" && <span aria-hidden="true" className="path-cur-ring" />}
      <span aria-hidden="true" className="path-disc" />
      <span className="path-icon">{children}</span>
    </button>
    </>
  );
};

/** Over the step to do now (her note, Nov 4 2026: "как у дуолинго"): one big
 *  short word with a tail pointing down at its light, bobbing gently. It
 *  starts the step; the light itself opens its card. */
export const StartBubble = ({ stop, label, aria, onClick }: { stop: Stop; label: string; aria: string; onClick: () => void }) => (
  <button type="button" aria-label={aria} onClick={() => { haptics.medium(); onClick(); }}
    className="path-start absolute z-[5]" style={{ left: stop.x, top: stop.y - stop.r - 22 }}>
    <span className="path-start-body">{label}</span>
  </button>
);

/** A light's name under it (her note, Nov 4 2026: "надо подписывать"), the same
 *  pill as an island's name on the Map; `below` is extra room (tonight's ring). */
export const LightLabel = ({ stop, text, dim, below = 0 }: { stop: Stop; text: string; dim?: boolean; below?: number }) => (
  <span aria-hidden="true" className={cn("planet-label path-label", dim && "is-dim")} style={{ left: stop.x, top: stop.y + stop.r + 14 + below }}>
    <span>{text}</span>
  </span>
);

/** Stops winding down the middle (seven days and the reward, or today's week). */
export const weekStops = (width: number, radii: number[], top = 24) => {
  const out: Stop[] = [];
  radii.forEach((r, i) => {
    const y = i === 0 ? top + r : out[i - 1].y + out[i - 1].r + r + GAP;
    out.push({ x: Math.round(width / 2 + ZIG[i % ZIG.length] * width), y, r });
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
  const height = stops[DAYS_PER_WEEK].y + R_CHEST + 52;
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
        {stops.map((p, i) => {
          if (i === DAYS_PER_WEEK) {
            return (
              <div key={i} data-wheel data-cy={p.y} style={{ transformOrigin: `${p.x}px ${p.y}px` }}>
                <LightLabel stop={p} text={t("path.weekReport")} dim={kind === "coming"} />
                {/* gold = opened; a report not opened yet stays lit, not "done" (QA re-check, Nov 9 2026) */}
                <PathNode stop={p} look={kind === "past" ? (chest ? "gold" : "todo") : "locked"} hue="var(--coin-gold)" label={t("path.weekReport")} onClick={kind === "past" ? onOpenChest : undefined}>
                  <FileBarChart2 className="h-7 w-7" strokeWidth={2.2} />
                </PathNode>
              </div>
            );
          }
          const d = day(i);
          return (
            <div key={i} data-wheel data-cy={p.y} style={{ transformOrigin: `${p.x}px ${p.y}px` }}>
              <LightLabel stop={p} text={dayName(d)} dim={kind === "coming"} />
              <PathNode stop={p} look={kind === "past" ? "done" : "locked"} label={dayName(d)} hue={kind === "past" ? undefined : DAY_AHEAD}
                onClick={kind === "past" && dates?.[i] ? () => onOpenDay?.(dates[i]) : undefined}>
                {kind === "past" ? <Check className="h-6 w-6" strokeWidth={3} /> : <MoonStar className="h-6 w-6" strokeWidth={2} />}
              </PathNode>
            </div>
          );
        })}
      </div>
    </div>
  );
};
