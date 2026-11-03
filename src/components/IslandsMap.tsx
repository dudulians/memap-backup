// The Map (Aurora). Nov 2 2026, her notes: only her islands, each with its
// name and weather said in words; links said in words when tapped; what grew
// on an island stands on it.
// Nov 3 2026 (the "Improve Map & Globe" brief she brought: composition,
// scale and hierarchy, not more decoration): the islands are larger and keep
// one even rhythm down a calm zigzag; one sea route joins them in order,
// behind them; two islands with a link found sit side by side and her
// wooden bridge stands from shore to shore, its button above it; any other
// link is a brighter route; nothing floats in the sea any more (her special
// items are in Week summary → treasures); the weather sits on each island's
// corner; her boat waits on the route by the island she answered last.
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link2, Plus } from "lucide-react";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { haptics } from "@/lib/haptics";
import { islandName, isNightMap, mapPic, type Island, type IslandId, type Route, type Weather } from "@/lib/islands";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import { type GrowthKind, type ItemId } from "@/lib/growth";
import { IslandPicture } from "@/components/IslandPicture";
import { islandHsl } from "@/lib/islandColors";

const WEATHER_PIC: Record<Exclude<Weather, null>, string> = { storm: "thunder_cloud", clouds: "partly_cloudy", sun: "sun" };
/** wooden_bridge.webp is 205 x 120, its feet at the bottom corners. */
const BRIDGE_ASPECT = 120 / 205;

type Pt = { x: number; y: number };
type Seg = readonly [Pt, Pt, Pt, Pt];
type Box = { x0: number; x1: number; y0: number; y1: number };
/** A smooth curve through the points (Catmull-Rom as cubic Béziers), one segment per pair. */
const segments = (pts: Pt[]): Seg[] => pts.slice(0, -1).map((p1, i) => {
  const p0 = pts[i - 1] ?? p1, p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
  return [p1, { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }, { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }, p2] as const;
});
const bez = ([a, b, c, d]: Seg, t: number): Pt => {
  const u = 1 - t;
  return { x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x, y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y };
};
const curve = ([a, b, c, d]: Seg) => `M${a.x},${a.y} C${b.x.toFixed(1)},${b.y.toFixed(1)} ${c.x.toFixed(1)},${c.y.toFixed(1)} ${d.x},${d.y}`;
const hit = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

export const IslandsMap = ({
  islands,
  routes,
  trackers,
  width,
  fill = {},
  lit,
  growth = {},
  you,
  onYou,
  onOpen,
}: {
  islands: Island[];
  routes: Route[];
  trackers: Tracker[];
  /** kept for callers; the map no longer counts days itself */
  entries?: TrackerEntry[];
  width: number;
  /** answered today, 0..1 per island: a calm ring around its icon */
  fill?: Record<string, number>;
  /** islands whose lighthouse is lit */
  lit?: Set<string>;
  /** what has grown on each island */
  growth?: Record<string, GrowthKind[]>;
  /** kept for callers; special items now live in Week summary */
  items?: ItemId[];
  /** her avatar sailing by the island she answered last (pic null = none chosen yet) */
  you?: { pic: string | null; declined: boolean; near?: IslandId };
  onYou?: () => void;
  onOpen: (id: IslandId) => void;
}) => {
  const { t } = useTranslation();
  const night = isNightMap();
  // The bubble of a found link (its index).
  const [link, setLink] = useState<number | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (link === null) return;
    const close = (e: PointerEvent) => {
      const el = e.target as Element | null;
      if (bubbleRef.current?.contains(el as Node) || el?.closest?.("[data-map-link]")) return;
      setLink(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [link]);

  // One scale for everything: islands 10-15% larger than before, as the screen allows.
  const PIC = Math.round(Math.max(132, Math.min(152, width * 0.42)));
  const BOX_H = Math.round(PIC * 0.9); // IslandPicture's box
  const ROW = BOX_H + 64; // an island and its name
  const ZIG = Math.round(ROW * 0.7); // the next island, on the other side
  const LABEL_W = Math.min(176, Math.round(width * 0.48));
  const TOP = 20;

  // The strongest found links; a pair of linked islands sits side by side.
  const shown = useMemo(() => routes.slice(0, 3), [routes]);
  const linked = (a: string, b: string) => shown.some((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
  const order = useMemo(() => {
    const byId = new Map(islands.map((i) => [i.id, i]));
    const seq: Island[] = [];
    const used = new Set<string>();
    for (const isl of islands) {
      if (used.has(isl.id)) continue;
      seq.push(isl);
      used.add(isl.id);
      // its strongest linked island comes right after it
      const mate = shown.map((r) => (r.a === isl.id ? r.b : r.b === isl.id ? r.a : null)).map((id) => (id ? byId.get(id) : undefined))
        .find((x): x is Island => !!x && !used.has(x.id));
      if (mate) { seq.push(mate); used.add(mate.id); }
    }
    return seq;
  }, [islands, shown]);
  // pairWithPrev[i]: island i shares a row with island i-1 (a bridge between them)
  const pairWithPrev = order.map(() => false);
  for (let i = 1; i < order.length; i++) if (!pairWithPrev[i - 1] && linked(order[i - 1].id, order[i].id)) pairWithPrev[i] = true;

  const pos: Pt[] = [];
  order.forEach((_, i) => {
    const inPair = pairWithPrev[i] || pairWithPrev[i + 1];
    const right = i % 2 === 1;
    const y = i === 0 ? TOP : pairWithPrev[i] ? pos[i - 1].y : pairWithPrev[i - 1] ? pos[i - 1].y + ROW : pos[i - 1].y + ZIG;
    pos.push({ x: Math.round((right ? (inPair ? 0.75 : 0.7) : (inPair ? 0.25 : 0.3)) * width), y });
  });
  // Where the route meets each island: the middle of its shore.
  const shore = pos.map((p) => ({ x: p.x, y: p.y + BOX_H * 0.64 }));
  const segs = segments(shore);
  const at = new Map(order.map((isl, i) => [isl.id, i]));

  // What's already on the map, so her boat and the link buttons keep clear.
  const taken: Box[] = [
    ...pos.map((p) => ({ x0: p.x - PIC * 0.44, x1: p.x + PIC * 0.44, y0: p.y + BOX_H * 0.08, y1: p.y + BOX_H * 0.9 })),
    ...pos.map((p) => ({ x0: p.x - LABEL_W * 0.45, x1: p.x + LABEL_W * 0.45, y0: p.y + BOX_H - 10, y1: p.y + BOX_H + 42 })),
  ];

  // Bridges between side-by-side islands; any other link is a brighter route.
  const links = shown.map((r) => {
    const i = at.get(r.a), j = at.get(r.b);
    if (i === undefined || j === undefined) return null;
    const lo = Math.min(i, j), hi = Math.max(i, j);
    if (hi - lo === 1 && pairWithPrev[hi]) {
      const L = shore[pos[lo].x < pos[hi].x ? lo : hi], R = shore[pos[lo].x < pos[hi].x ? hi : lo];
      const x0 = L.x + PIC * 0.3, x1 = R.x - PIC * 0.3;
      const w = Math.max(56, x1 - x0), h = w * BRIDGE_ASPECT;
      const box = { left: (x0 + x1) / 2 - w / 2, top: L.y - h * 0.62, w, h };
      const mid = { x: (x0 + x1) / 2, y: box.top - 4 };
      taken.push({ x0: mid.x - 22, x1: mid.x + 22, y0: mid.y - 20, y1: box.top + h });
      return { r, bridge: box, mid, seg: lo };
    }
    const s: Seg = hi - lo === 1 ? segs[lo] : [shore[lo], { x: shore[lo].x + (shore[hi].x - shore[lo].x) * 0.2 + (lo % 2 ? -40 : 40), y: shore[lo].y + (shore[hi].y - shore[lo].y) * 0.3 }, { x: shore[hi].x - (shore[hi].x - shore[lo].x) * 0.2 + (lo % 2 ? -40 : 40), y: shore[hi].y - (shore[hi].y - shore[lo].y) * 0.3 }, shore[hi]];
    // its button: the first free place along it
    const mid = [0.5, 0.4, 0.6, 0.3, 0.7].map((k) => bez(s, k)).find((p) => !taken.some((b) => hit(b, { x0: p.x - 18, x1: p.x + 18, y0: p.y - 18, y1: p.y + 18 }))) ?? bez(s, 0.5);
    taken.push({ x0: mid.x - 18, x1: mid.x + 18, y0: mid.y - 18, y1: mid.y + 18 });
    return { r, curve: s, mid, seg: hi - lo === 1 ? lo : -1 };
  });
  const special = new Set(links.map((l) => l?.seg ?? -1));

  // Her boat: on a free stretch of the route next to the island she answered last.
  const boat = (() => {
    if (!you || order.length === 0) return null;
    const k = Math.max(0, order.findIndex((isl) => isl.id === you.near));
    const fits = (p: Pt) => p.x > 40 && p.x < width - 40 && !taken.some((b) => hit(b, { x0: p.x - 34, x1: p.x + 34, y0: p.y - 52, y1: p.y + 22 }));
    for (const s of [k, k - 1, k + 1, k - 2, k + 2]) {
      if (s < 0 || s >= segs.length || special.has(s)) continue;
      for (const t of [0.5, 0.38, 0.62, 0.28, 0.72]) { const p = bez(segs[s], t); if (fits(p)) return p; }
    }
    const p = pos[pos.length - 1];
    return { x: width / 2, y: p.y + BOX_H + 96 };
  })();

  const last = pos[pos.length - 1];
  const height = Math.max(last ? last.y + BOX_H + 56 : 0, boat ? boat.y + 34 : 0);
  const title = (id: string) => {
    const tr = trackers.find((x) => x.id === id);
    return tr ? localizeTrackerTitle(tr.title) : "";
  };

  return (
    <div className="relative mx-auto" style={{ width, height }}>
      {/* Behind everything: the route, the brighter links, the bridges. */}
      <svg width={width} height={height} className="pointer-events-none absolute inset-0" aria-hidden="true">
        {segs.map((s, i) => !pairWithPrev[i + 1] && (
          <g key={i}>
            <path d={curve(s)} fill="none" stroke="#fff" strokeOpacity={night ? 0.07 : 0.32} strokeWidth={10} strokeLinecap="round" />
            <path d={curve(s)} fill="none" stroke={night ? "hsl(200 60% 85%)" : "#fff"} strokeOpacity={night ? 0.45 : 0.95} strokeWidth={3.2} strokeDasharray="0.1 11" strokeLinecap="round" />
          </g>
        ))}
        {links.map((l, i) => l?.curve && (
          <g key={i}>
            <path d={curve(l.curve)} fill="none" stroke="hsl(var(--coin-teal))" strokeOpacity={0.16} strokeWidth={10} strokeLinecap="round" />
            <path d={curve(l.curve)} fill="none" stroke="hsl(var(--coin-teal))" strokeWidth={3.5} strokeDasharray="0.1 9" strokeLinecap="round" />
          </g>
        ))}
      </svg>
      {links.map((l, i) => l?.bridge && (
        <img key={i} src={mapPic("wooden_bridge")} alt="" aria-hidden="true" decoding="async" draggable={false}
          className="pointer-events-none absolute object-contain drop-shadow-[0_5px_6px_rgba(16,42,56,0.2)]"
          style={{ left: l.bridge.left, top: l.bridge.top, width: l.bridge.w, height: l.bridge.h }} />
      ))}

      {you && boat && (
        <button type="button" onClick={() => { haptics.soft(); onYou?.(); }} aria-label={t(you.pic ? "map.you" : "map.pickYou")}
          className="absolute z-[2] flex flex-col items-center active:scale-95 transition-transform" style={{ left: boat.x - 50, top: boat.y - 52, width: 100 }}>
          <span className="relative block h-[54px] w-[54px]">
            <img src={mapPic("sailboat")} alt="" className="absolute bottom-0 left-1/2 w-[48px] -translate-x-1/2 object-contain drop-shadow-[0_4px_5px_rgba(16,42,56,0.2)]" draggable={false} />
            {you.pic ? (
              <img src={you.pic} alt="" className="absolute left-[3px] top-[1px] h-[32px] w-[32px] object-contain drop-shadow-[0_3px_4px_rgba(16,42,56,0.25)]" draggable={false} />
            ) : !you.declined ? (
              <span className="absolute left-0 top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[hsl(var(--surface))] bg-[hsl(var(--coin-teal))] text-white">
                <Plus className="h-4 w-4" strokeWidth={3} />
              </span>
            ) : null}
          </span>
          <span className="surface -mt-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-bold">{you.pic || you.declined ? t("map.you") : t("map.pickYouShort")}</span>
        </button>
      )}

      {order.map((isl, i) => {
        const p = pos[i];
        const w = Math.max(PIC, LABEL_W);
        return (
          <button key={isl.id} type="button" onClick={() => { haptics.tap(); onOpen(isl.id); }}
            className="absolute z-[1] flex flex-col items-center active:scale-[0.97] transition-transform"
            style={{ left: p.x - w / 2, top: p.y, width: w }}
            aria-label={`${islandName(t, isl.id)}${isl.weather ? ` · ${t(`map.weather.${isl.weather}`)}` : ""}`}>
            <span className="relative">
              <IslandPicture id={isl.id} width={PIC} growth={growth[isl.id]} />
              {lit?.has(isl.id) && (
                <img src={mapPic("lighthouse")} alt="" aria-hidden="true" decoding="async" draggable={false}
                  className="pointer-events-none absolute object-contain drop-shadow-[0_0_10px_hsl(44_96%_60%/0.8)]"
                  style={{ width: Math.round(PIC * 0.28), left: -Math.round(PIC * 0.04), bottom: Math.round(PIC * 0.1) }} />
              )}
              {isl.weather && (
                <img src={mapPic(WEATHER_PIC[isl.weather])} alt="" aria-hidden="true" decoding="async" draggable={false}
                  className="pointer-events-none absolute object-contain"
                  style={{ width: Math.round(PIC * 0.3), right: -Math.round(PIC * 0.05), top: 0 }} />
              )}
            </span>
            <span className="surface relative z-[1] -mt-2 inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3" style={{ maxWidth: LABEL_W }}>
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                <svg width={32} height={32} className="absolute inset-0 -rotate-90" aria-hidden="true">
                  <circle cx={16} cy={16} r={14} fill="none" stroke="hsl(var(--foreground) / 0.08)" strokeWidth={3} />
                  {(fill[isl.id] ?? 0) > 0 && (
                    <circle cx={16} cy={16} r={14} fill="none" stroke={`hsl(${islandHsl(isl.id)})`} strokeWidth={3} strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 14 * (fill[isl.id] ?? 0)} ${2 * Math.PI * 14}`} />
                  )}
                </svg>
                <img src={mapPic("icon_" + isl.def.icon)} alt="" width={22} height={22} decoding="async" draggable={false} />
              </span>
              <span className="min-w-0 text-left">
                <span className="block truncate text-[15px] font-bold leading-tight text-foreground">{islandName(t, isl.id)}</span>
                {/* What the weather sign means, said under the name (no legend to decode). */}
                <span className="block truncate text-[12px] font-semibold leading-tight text-muted-foreground">{t(isl.weather ? `map.weather.${isl.weather}` : "map.tooEarly")}</span>
              </span>
            </span>
          </button>
        );
      })}

      {/* A link's button: what the link is, in words. */}
      {links.map((l, i) => l && (
        <div key={i}>
          <button type="button" data-map-link onClick={() => { haptics.land(); setLink((v) => (v === i ? null : i)); }}
            aria-label={`${t("map.linked")} · ${t("map.linkAria")}`} aria-expanded={link === i}
            className="surface absolute z-[2] flex h-8 w-8 items-center justify-center rounded-full text-[hsl(var(--coin-teal))] active:scale-95 transition-transform"
            style={{ left: l.mid.x - 16, top: l.mid.y - 16 }}>
            <Link2 className="h-4 w-4" strokeWidth={2.6} />
          </button>
          {link === i && (
            <div ref={bubbleRef} role="dialog" className="path-bubble surface absolute z-20 rounded-[20px] px-4 py-3"
              style={{ left: Math.max(8, Math.min(l.mid.x - 140, width - 288)), top: l.mid.y + 22, width: 280 }}>
              <p className="text-[17px] font-bold leading-snug">
                {title(l.r.first)} → {title(l.r.second)}{l.r.nextDay ? ` ${t("map.nextDay")}` : ""}
              </p>
              <p className="mt-0.5 text-[15px] font-medium text-muted-foreground">{t("map.timesOf", { k: l.r.k, count: l.r.n })}</p>
              <p className="mt-2 text-[13px] font-medium text-muted-foreground">{t("map.notCause")}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

/** What the weather signs mean, in three words. */
export const WeatherLegend = () => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center gap-3" aria-label={t("map.legendAria")}>
      {(["storm", "clouds", "sun"] as const).map((w) => (
        <span key={w} className="inline-flex items-center gap-1 text-[14px] font-semibold text-foreground/80">
          <img src={mapPic(WEATHER_PIC[w])} alt="" width={24} height={24} className="object-contain" />
          {t(`map.legend.${w}`)}
        </span>
      ))}
    </div>
  );
};
