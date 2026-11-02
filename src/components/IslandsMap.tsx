// The Map, made clear (Aurora, Nov 2 2026; her note: "как будто просто
// накиданы разные элементы, планки, непонятные цифры, непонятно что к чему
// относится"). Only her islands, each with its name and one weather sign;
// a legend says what the signs mean; links are dotted lines with a link
// button that says the whole thing in words ("Short night → headache next
// day · 11 of 14 times"); what her chests gave stands by the islands.
// No floating numbers, no strange islands. Tap an island for its stats.
// Nov 2 2026 (her: "сразу подсветить, что между островами потенциально
// могут быть связи"): neighbours not linked yet get a faint route with a
// dotted route (MeMap is checking; the island's sheet says so in words, her
// note: "?" marks sat randomly, two on one island); found links are bridges.
// Later the same day (her: "карта должна отражать реальное развитие"): what
// grew on each island stands on it, a found link is a wooden bridge, and her
// special items (milestones) sit in the sea beside the islands.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Link2, Plus } from "lucide-react";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { haptics } from "@/lib/haptics";
import { islandName, mapPic, type Island, type IslandId, type Route, type Weather } from "@/lib/islands";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import { ITEMS, type GrowthKind, type ItemId } from "@/lib/growth";
import { IslandPicture } from "@/components/IslandPicture";
import { islandHsl } from "@/lib/islandColors";

const PIC = 132;
const WEATHER_PIC: Record<Exclude<Weather, null>, string> = { storm: "thunder_cloud", clouds: "partly_cloudy", sun: "sun" };

export const IslandsMap = ({
  islands,
  routes,
  trackers,
  entries = [],
  width,
  fill = {},
  lit,
  growth = {},
  items = [],
  you,
  onYou,
  onOpen,
}: {
  islands: Island[];
  routes: Route[];
  trackers: Tracker[];
  /** for "days with answers on both" under a possible link */
  entries?: TrackerEntry[];
  width: number;
  /** answered today, 0..1 per island: a calm ring around its icon */
  fill?: Record<string, number>;
  /** islands whose lighthouse is lit */
  lit?: Set<string>;
  /** what has grown on each island */
  growth?: Record<string, GrowthKind[]>;
  /** special items she has earned */
  items?: ItemId[];
  /** her avatar sailing by the island she answered last (pic null = none chosen yet) */
  you?: { pic: string | null; declined: boolean; near?: IslandId };
  onYou?: () => void;
  onOpen: (id: IslandId) => void;
}) => {
  const { t } = useTranslation();
  // Open bubble: a found link (its index) or a possible one ("p" + index).
  const [link, setLink] = useState<number | string | null>(null);
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

  // Two columns, staggered, so every island has room for its name.
  const pos = islands.map((_, i) => ({
    x: Math.round((i % 2 === 0 ? 0.28 : 0.72) * width),
    y: 40 + i * 142 + (i % 2) * 18,
  }));
  const baseHeight = (pos.length ? pos[pos.length - 1].y : 0) + PIC + 70;
  const where = new Map(islands.map((isl, i) => [isl.id, pos[i]]));
  // Neighbours on the map with no link found yet: maybe one affects the other.
  const shown = routes.slice(0, 3);
  const linked = (a: string, b: string) => shown.some((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
  const maybe = islands.slice(1).map((b, i) => [islands[i], b] as const).filter(([a, b]) => !linked(a.id, b.id));
  // Where a link's button sits: along its route, clear of island names and
  // of other link buttons (several links made them pile onto the names).
  const taken: { x: number; y: number }[] = [];
  const labels = pos.map((p) => ({ x0: p.x - 98, x1: p.x + 98, y0: p.y + PIC * 0.72, y1: p.y + PIC * 0.72 + 52 }));
  const pictures = pos.map((p) => ({ x0: p.x - PIC * 0.42, x1: p.x + PIC * 0.42, y0: p.y + 4, y1: p.y + PIC * 0.72 }));
  const spot = (pa: { x: number; y: number }, pb: { x: number; y: number }, strict = false, half = 20) => {
    const ay = pa.y + PIC * 0.38, by = pb.y + PIC * 0.38;
    for (const k of [0.5, 0.62, 0.38, 0.72, 0.28]) {
      const x = pa.x + (pb.x - pa.x) * k, y = ay + (by - ay) * k;
      const hits = (r: { x0: number; x1: number; y0: number; y1: number }) => x + half > r.x0 && x - half < r.x1 && y + 20 > r.y0 && y - 20 < r.y1;
      const hitsLink = taken.some((q) => Math.hypot(q.x - x, q.y - y) < 50);
      if (!labels.some(hits) && !hitsLink && (!strict || !pictures.some(hits))) { taken.push({ x, y }); return { x, y }; }
    }
    // A possible link with no free place keeps just its dotted line.
    if (strict) return null;
    const x = (pa.x + pb.x) / 2, y = (ay + by) / 2;
    taken.push({ x, y });
    return { x, y };
  };
  const title = (id: string) => {
    const tr = trackers.find((x) => x.id === id);
    return tr ? localizeTrackerTitle(tr.title) : "";
  };

  // Special items sit in the free sea beside each island (the other column,
  // level with its top), a second one a little lower.
  const ITEM_W: Record<string, number> = { hot_air_balloon: 46, camera: 42, wooden_signpost: 40, books: 46, sparkles: 34, art_easel: 42, bicycle: 54, rainbow: 86, airplane: 62 };
  const shownItems = ITEMS.filter((it) => items.includes(it.id));

  const linkSpots = {
    found: shown.map((r) => { const pa = where.get(r.a); const pb = where.get(r.b); return pa && pb ? spot(pa, pb, false, 32) : null; }),

  };
  // Special items: the first free place beside an island (the other column,
  // level with its top, then a little lower), never on an island, a name,
  // a link or another item.
  const busy = [
    ...pos.map((p) => ({ x0: p.x - PIC / 2, x1: p.x + PIC / 2, y0: p.y - 6, y1: p.y + PIC * 0.78 })),
    ...labels,
    ...taken.map((q) => ({ x0: q.x - 42, x1: q.x + 42, y0: q.y - 30, y1: q.y + 30 })),
  ];
  const itemSpots = shownItems.map((it) => {
    const w = ITEM_W[it.pic] ?? 44;
    for (let j = 0; j < pos.length; j++) {
      const p = pos[j];
      for (const [fx, dy] of [[0.76, 4], [0.76, 70], [0.9, 30], [0.76, -40]] as const) {
        const x = (p.x < width / 2 ? fx : 1 - fx) * width;
        const y = p.y + dy;
        const r = { x0: x - w / 2 - 4, x1: x + w / 2 + 4, y0: y - 4, y1: y + w * 0.9 + 4 };
        if (r.x0 < 0 || r.x1 > width || r.y0 < 0) continue;
        if (busy.some((b) => r.x0 < b.x1 && r.x1 > b.x0 && r.y0 < b.y1 && r.y1 > b.y0)) continue;
        busy.push(r);
        return { it, w, left: x - w / 2, top: y };
      }
    }
    return null;
  });
  const youSpot = (() => {
    if (!you) return null;
    const order = [...pos.keys()].sort((a, b) => (islands[a].id === you.near ? -1 : islands[b].id === you.near ? 1 : a - b));
    for (const j of order) {
      const p = pos[j];
      for (const [fx, dy] of [[0.78, 30], [0.78, 96], [0.62, 104], [0.86, 0]] as const) {
        const x = (p.x < width / 2 ? fx : 1 - fx) * width;
        const y = p.y + dy;
        const r = { x0: x - 34, x1: x + 34, y0: y - 6, y1: y + 70 };
        if (r.x0 < 0 || r.x1 > width) continue;
        if (busy.some((b) => r.x0 < b.x1 && r.x1 > b.x0 && r.y0 < b.y1 && r.y1 > b.y0)) continue;
        busy.push(r);
        return { x, y };
      }
    }
    // Nowhere free beside the islands: below the last one.
    const last = pos[pos.length - 1];
    return last ? { x: width / 2, y: last.y + PIC + 58, bottom: true } : null;
  })();

  const height = baseHeight + (youSpot && "bottom" in youSpot ? 90 : 0);

  return (
    <div className="relative mx-auto" style={{ width, height }}>
      {/* Links: a dotted line and one button that says it in words. */}
      <svg width={width} height={height} className="pointer-events-none absolute inset-0" aria-hidden="true">
        {maybe.map(([a, b], i) => {
          const pa = where.get(a.id)!;
          const pb = where.get(b.id)!;
          return (
            <line key={`m${i}`} x1={pa.x} y1={pa.y + PIC * 0.38} x2={pb.x} y2={pb.y + PIC * 0.38}
              stroke="hsl(var(--foreground))" strokeOpacity={0.3} strokeWidth={3} strokeDasharray="2 9" strokeLinecap="round" />
          );
        })}
        {shown.map((r, i) => {
          const pa = where.get(r.a);
          const pb = where.get(r.b);
          if (!pa || !pb) return null;
          return (
            <g key={i}>
              <line x1={pa.x} y1={pa.y + PIC * 0.38} x2={pb.x} y2={pb.y + PIC * 0.38}
                stroke="hsl(var(--coin-teal))" strokeOpacity={0.18} strokeWidth={12} strokeLinecap="round" />
              <line x1={pa.x} y1={pa.y + PIC * 0.38} x2={pb.x} y2={pb.y + PIC * 0.38}
                stroke="hsl(var(--coin-teal))" strokeWidth={4} strokeDasharray="2 8" strokeLinecap="round" />
            </g>
          );
        })}
      </svg>

      {itemSpots.map((sp) => sp && (
        <img key={sp.it.id} src={mapPic(sp.it.pic)} alt={t(`items.${sp.it.id}.name`)} decoding="async" draggable={false}
          className="pointer-events-none absolute object-contain drop-shadow-[0_6px_8px_rgba(16,42,56,0.18)]"
          style={{ left: sp.left, top: sp.top, width: sp.w }} />
      ))}

      {you && youSpot && (
        <button type="button" onClick={() => { haptics.tap(); onYou?.(); }} aria-label={t(you.pic ? "map.you" : "map.pickYou")}
          className="absolute z-[2] flex flex-col items-center active:scale-95 transition-transform" style={{ left: youSpot.x - 34, top: youSpot.y, width: 68 }}>
          <span className="relative block h-[62px] w-[62px]">
            <img src={mapPic("sailboat")} alt="" className="absolute bottom-0 left-1/2 w-[54px] -translate-x-1/2 object-contain" draggable={false} />
            {you.pic ? (
              <img src={you.pic} alt="" className="absolute left-[4px] top-[2px] h-[36px] w-[36px] object-contain drop-shadow-[0_3px_4px_rgba(16,42,56,0.25)]" draggable={false} />
            ) : !you.declined ? (
              <span className="absolute left-0 top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[hsl(var(--surface))] bg-[hsl(var(--coin-teal))] text-white">
                <Plus className="h-4 w-4" strokeWidth={3} />
              </span>
            ) : null}
          </span>
          <span className="surface -mt-1 rounded-full px-2.5 py-0.5 text-[12px] font-bold">{you.pic || you.declined ? t("map.you") : t("map.pickYouShort")}</span>
        </button>
      )}

      {islands.map((isl, i) => {
        const p = pos[i];
        return (
          <button key={isl.id} type="button" onClick={() => { haptics.tap(); onOpen(isl.id); }}
            className="absolute flex flex-col items-center active:scale-[0.97] transition-transform"
            style={{ left: p.x - PIC / 2 - 10, top: p.y, width: PIC + 20 }}
            aria-label={`${islandName(t, isl.id)}${isl.weather ? ` · ${t(`map.weather.${isl.weather}`)}` : ""}`}>
            <span className="relative">
              <IslandPicture id={isl.id} width={PIC} growth={growth[isl.id]} />
              {lit?.has(isl.id) && (
                <img src={mapPic("lighthouse")} alt="" aria-hidden="true" width={40} height={52} decoding="async" draggable={false}
                  className="pointer-events-none absolute -left-2 bottom-3 object-contain drop-shadow-[0_0_10px_hsl(44_96%_60%/0.8)]" />
              )}
              {isl.weather && (
                <img src={mapPic(WEATHER_PIC[isl.weather])} alt="" aria-hidden="true" width={46} height={46} decoding="async" draggable={false}
                  className="pointer-events-none absolute -right-3 -top-1 object-contain" />
              )}
            </span>
            <span className="surface relative z-[1] -mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full py-1 pl-1 pr-3">
              <span className="relative flex h-8 w-8 items-center justify-center">
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

      {shown.map((r, i) => {
        const at = linkSpots.found[i];
        if (!at) return null;
        const mx = at.x;
        const my = at.y;
        return (
          <div key={i}>
            <button type="button" data-map-link onClick={() => { haptics.tap(); setLink((l) => (l === i ? null : i)); }}
              aria-label={`${t("map.linked")} · ${t("map.linkAria")}`} aria-expanded={link === i}
              className="absolute flex items-center justify-center active:scale-95 transition-transform"
              style={{ left: mx - 30, top: my - 20, width: 60, height: 40 }}>
              <img src={mapPic("wooden_bridge")} alt="" width={60} height={35} draggable={false} className="pointer-events-none object-contain drop-shadow-[0_5px_6px_rgba(16,42,56,0.22)]" />
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[hsl(var(--surface))] bg-[hsl(var(--coin-teal))] text-white">
                <Link2 className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
            </button>
            {link === i && (
              <div ref={bubbleRef} role="dialog" className="path-bubble surface absolute z-20 rounded-[20px] px-4 py-3"
                style={{ left: Math.max(8, Math.min(mx - 140, width - 288)), top: my + 26, width: 280 }}>
                <p className="text-[17px] font-bold leading-snug">
                  {title(r.first)} → {title(r.second)}{r.nextDay ? ` ${t("map.nextDay")}` : ""}
                </p>
                <p className="mt-0.5 text-[15px] font-medium text-muted-foreground">{t("map.timesOf", { k: r.k, count: r.n })}</p>
                <p className="mt-2 text-[13px] font-medium text-muted-foreground">{t("map.notCause")}</p>
              </div>
            )}
          </div>
        );
      })}
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
