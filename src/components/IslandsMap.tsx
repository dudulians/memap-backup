// The Map, made clear (Aurora, Nov 2 2026; her note: "как будто просто
// накиданы разные элементы, планки, непонятные цифры, непонятно что к чему
// относится"). Only her islands, each with its name and one weather sign;
// a legend says what the signs mean; links are dotted lines with a link
// button that says the whole thing in words ("Short night → headache next
// day · 11 of 14 times"); what her chests gave stands by the islands.
// No floating numbers, no strange islands. Tap an island for its stats.
// Nov 2 2026 (her: "сразу подсветить, что между островами потенциально
// могут быть связи"): neighbours not linked yet get a faint route with a
// "?" (MeMap is checking); found links are drawn stronger, "Linked".
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { HelpCircle, Link2 } from "lucide-react";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { haptics } from "@/lib/haptics";
import { islandName, mapPic, type Island, type IslandId, type Route, type Weather } from "@/lib/islands";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import { getChests } from "@/lib/pathSteps";
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
  const height = (pos.length ? pos[pos.length - 1].y : 0) + PIC + 70;
  const where = new Map(islands.map((isl, i) => [isl.id, pos[i]]));
  // Neighbours on the map with no link found yet: maybe one affects the other.
  const shown = routes.slice(0, 3);
  const linked = (a: string, b: string) => shown.some((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
  const maybe = islands.slice(1).map((b, i) => [islands[i], b] as const).filter(([a, b]) => !linked(a.id, b.id));
  const bothDays = (a: Island, b: Island) => {
    const days = (ids: string[]) => new Set(entries.filter((e) => ids.includes(e.trackerId)).map((e) => e.date));
    const da = days(a.trackerIds);
    return [...days(b.trackerIds)].filter((d) => da.has(d)).length;
  };
  // Where a link's button sits: along its route, clear of island names and
  // of other link buttons (several links made them pile onto the names).
  const taken: { x: number; y: number }[] = [];
  const labels = pos.map((p) => ({ x0: p.x - 98, x1: p.x + 98, y0: p.y + PIC * 0.72, y1: p.y + PIC * 0.72 + 52 }));
  const spot = (pa: { x: number; y: number }, pb: { x: number; y: number }) => {
    const ay = pa.y + PIC * 0.38, by = pb.y + PIC * 0.38;
    for (const k of [0.5, 0.62, 0.38, 0.72, 0.28, 0.8, 0.2]) {
      const x = pa.x + (pb.x - pa.x) * k, y = ay + (by - ay) * k;
      const hitsLabel = labels.some((l) => x + 20 > l.x0 && x - 20 < l.x1 && y + 20 > l.y0 && y - 20 < l.y1);
      const hitsLink = taken.some((q) => Math.hypot(q.x - x, q.y - y) < 44);
      if (!hitsLabel && !hitsLink) { taken.push({ x, y }); return { x, y }; }
    }
    const x = (pa.x + pb.x) / 2, y = (ay + by) / 2;
    taken.push({ x, y });
    return { x, y };
  };
  const title = (id: string) => {
    const tr = trackers.find((x) => x.id === id);
    return tr ? localizeTrackerTitle(tr.title) : "";
  };

  // What her opened chests gave, set by the first two islands.
  const placed = [...new Set(Object.values(getChests()).filter((c) => c.placed).map((c) => c.reward))];
  const rewardAt = (name: string): CSSProperties | null => {
    const a = pos[0];
    const b = pos[1] ?? pos[0];
    if (!a) return null;
    if (name === "wooden_bridge") return { left: (a.x + b.x) / 2 - 40, top: (a.y + b.y) / 2 + PIC * 0.5, width: 80 };
    if (name === "rainbow") return { left: a.x - 50, top: a.y - 64, width: 100 };
    if (name === "marker_flag") return { left: a.x + PIC * 0.18, top: a.y - 8, width: 34 };
    if (name === "hot_air_balloon") return { left: b.x + PIC * 0.28, top: b.y - 70, width: 44 };
    return null;
  };

  const linkSpots = {
    found: shown.map((r) => { const pa = where.get(r.a); const pb = where.get(r.b); return pa && pb ? spot(pa, pb) : null; }),
    maybe: maybe.map(([a, b]) => ({ a, b, at: spot(where.get(a.id)!, where.get(b.id)!) })),
  };

  return (
    <div className="relative mx-auto" style={{ width, height }}>
      {/* Links: a dotted line and one button that says it in words. */}
      <svg width={width} height={height} className="pointer-events-none absolute inset-0" aria-hidden="true">
        {maybe.map(([a, b], i) => {
          const pa = where.get(a.id)!;
          const pb = where.get(b.id)!;
          return (
            <line key={`m${i}`} x1={pa.x} y1={pa.y + PIC * 0.38} x2={pb.x} y2={pb.y + PIC * 0.38}
              stroke="hsl(var(--foreground))" strokeOpacity={0.22} strokeWidth={2.5} strokeDasharray="1 8" strokeLinecap="round" />
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

      {placed.map((name) => {
        const st = rewardAt(name);
        return st ? <img key={name} src={mapPic(name)} alt="" aria-hidden="true" decoding="async" draggable={false} className="pointer-events-none absolute" style={st} /> : null;
      })}

      {islands.map((isl, i) => {
        const p = pos[i];
        return (
          <button key={isl.id} type="button" onClick={() => { haptics.tap(); onOpen(isl.id); }}
            className="absolute flex flex-col items-center active:scale-[0.97] transition-transform"
            style={{ left: p.x - PIC / 2 - 10, top: p.y, width: PIC + 20 }}
            aria-label={`${islandName(t, isl.id)}${isl.weather ? ` · ${t(`map.weather.${isl.weather}`)}` : ""}`}>
            <span className="relative">
              <IslandPicture id={isl.id} width={PIC} />
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

      {linkSpots.maybe.map(({ a, b, at }, i) => {
        const mx = at.x;
        const my = at.y;
        const key = `p${i}`;
        return (
          <div key={key}>
            <button type="button" data-map-link onClick={() => { haptics.tap(); setLink((l) => (l === key ? null : key)); }}
              aria-label={t("map.maybeAria", { a: islandName(t, a.id), b: islandName(t, b.id) })} aria-expanded={link === key}
              className="surface absolute flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground"
              style={{ left: mx - 16, top: my - 16 }}>
              <HelpCircle className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </button>
            {link === key && (
              <div ref={bubbleRef} role="dialog" className="path-bubble surface absolute z-20 rounded-[20px] px-4 py-3"
                style={{ left: Math.max(8, Math.min(mx - 140, width - 288)), top: my + 24, width: 280 }}>
                <p className="text-[17px] font-bold leading-snug">{islandName(t, a.id)} ↔ {islandName(t, b.id)}</p>
                <p className="mt-0.5 text-[15px] font-medium text-muted-foreground">{t(bothDays(a, b) >= 21 ? "map.noLinkYet" : "map.maybeLine")}</p>
                <p className="mt-2 text-[14px] font-semibold text-foreground/80">{t("map.bothDays", { count: bothDays(a, b) })}</p>
              </div>
            )}
          </div>
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
              className="absolute flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-[hsl(var(--surface))] bg-[hsl(var(--coin-teal))] text-white shadow-[0_6px_16px_-6px_hsl(var(--coin-teal))]"
              style={{ left: mx - 20, top: my - 20 }}>
              <Link2 className="h-[18px] w-[18px]" strokeWidth={2.6} />
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
