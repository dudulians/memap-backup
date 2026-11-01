// The Map, made clear (Aurora, Nov 2 2026; her note: "как будто просто
// накиданы разные элементы, планки, непонятные цифры, непонятно что к чему
// относится"). Only her islands, each with its name and one weather sign;
// a legend says what the signs mean; links are dotted lines with a link
// button that says the whole thing in words ("Short night → headache next
// day · 11 of 14 times"); what her chests gave stands by the islands.
// No floating numbers, no strange islands. Tap an island for its stats.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Link2 } from "lucide-react";
import { Tracker } from "@/types/tracker";
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
  width,
  fill = {},
  onOpen,
}: {
  islands: Island[];
  routes: Route[];
  trackers: Tracker[];
  width: number;
  /** answered today, 0..1 per island: a calm ring around its icon */
  fill?: Record<string, number>;
  onOpen: (id: IslandId) => void;
}) => {
  const { t } = useTranslation();
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

  // Two columns, staggered, so every island has room for its name.
  const pos = islands.map((_, i) => ({
    x: Math.round((i % 2 === 0 ? 0.28 : 0.72) * width),
    y: 70 + i * 128 + (i % 2) * 18,
  }));
  const height = (pos.length ? pos[pos.length - 1].y : 0) + PIC + 70;
  const where = new Map(islands.map((isl, i) => [isl.id, pos[i]]));
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

  return (
    <div className="relative mx-auto" style={{ width, height }}>
      {/* Links: a dotted line and one button that says it in words. */}
      <svg width={width} height={height} className="pointer-events-none absolute inset-0" aria-hidden="true">
        {routes.slice(0, 3).map((r, i) => {
          const pa = where.get(r.a);
          const pb = where.get(r.b);
          if (!pa || !pb) return null;
          return (
            <line key={i} x1={pa.x} y1={pa.y + PIC * 0.45} x2={pb.x} y2={pb.y + PIC * 0.45}
              stroke="hsl(var(--coin-teal))" strokeOpacity={0.55} strokeWidth={3} strokeDasharray="1 9" strokeLinecap="round" />
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
            aria-label={`${islandName(t, isl.id)}${isl.weather ? ` · ${t(`map.legend.${isl.weather}`)}` : ""}`}>
            <span className="relative">
              <IslandPicture id={isl.id} width={PIC} />
              {isl.weather && (
                <img src={mapPic(WEATHER_PIC[isl.weather])} alt="" aria-hidden="true" width={46} height={46} decoding="async" draggable={false}
                  className="pointer-events-none absolute -right-3 -top-1 object-contain" />
              )}
            </span>
            <span className="surface -mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full py-1 pl-1 pr-3">
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
              <span className="truncate text-[15px] font-bold text-foreground">{islandName(t, isl.id)}</span>
            </span>
          </button>
        );
      })}

      {routes.slice(0, 3).map((r, i) => {
        const pa = where.get(r.a);
        const pb = where.get(r.b);
        if (!pa || !pb) return null;
        const mx = (pa.x + pb.x) / 2;
        const my = (pa.y + pb.y) / 2 + PIC * 0.45;
        return (
          <div key={i}>
            <button type="button" data-map-link onClick={() => { haptics.tap(); setLink((l) => (l === i ? null : i)); }}
              aria-label={t("map.linkAria")} aria-expanded={link === i}
              className="surface absolute flex h-9 w-9 items-center justify-center rounded-full text-[hsl(var(--coin-teal))]"
              style={{ left: mx - 18, top: my - 18 }}>
              <Link2 className="h-[18px] w-[18px]" strokeWidth={2.4} />
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
