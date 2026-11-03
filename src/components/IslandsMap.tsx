// The Map (Aurora). Nov 2 2026, her notes: only her islands, each with its
// name and weather said in words; links said in words when tapped; what grew
// on an island stands on it.
// Nov 3 2026 (the "Improve Map & Globe" brief she brought: composition,
// scale and hierarchy, not more decoration): the islands are larger and keep
// one even rhythm down a calm zigzag; the weather sits on each island's
// corner; nothing floats in the sea (her treasures live on her shelf in You).
// Later that night (her notes: "не понимаю, когда нужен мост, а когда линия";
// the map still looked odd): one meaning, one mark. A found link is her
// wooden bridge between two islands side by side, at most one per island,
// and the bridge itself opens what the link is; no route and no lines. Each
// island sits in its own shallows with a soft shadow; a new bridge builds
// itself once; her boat waits on free water beside the island she answered
// last.
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link2 } from "lucide-react";
import { Tracker, TrackerEntry } from "@/types/tracker";
import { haptics } from "@/lib/haptics";
import { playBloop, playSparkle, preloadSounds } from "@/lib/feedback";
import { bridgesOf, islandName, isNightMap, mapPic, type Island, type IslandId, type Route, type Weather } from "@/lib/islands";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import { type GrowthKind, type ItemId } from "@/lib/growth";
import { IslandPicture } from "@/components/IslandPicture";
import { islandHsl } from "@/lib/islandColors";

const WEATHER_PIC: Record<Exclude<Weather, null>, string> = { storm: "thunder_cloud", clouds: "partly_cloudy", sun: "sun" };
/** wooden_bridge.webp is 205 x 120, its feet at the bottom corners. */
const BRIDGE_ASPECT = 120 / 205;
const BRIDGES_SEEN = "memap_bridges_seen";
const BRIDGE_TIP = "memap_bridge_tip";

type Pt = { x: number; y: number };
type Box = { x0: number; x1: number; y0: number; y1: number };
const hit = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
const readList = (key: string): string[] | null => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } };

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
  /** kept for callers; her treasures live in You */
  items?: ItemId[];
  /** her animal sailing by the island she answered last */
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

  // An island pressed (her note, Nov 3 2026: "чтобы остров как кнопка
  // отжимался, с ощущением"): it sinks and eases back (.island-press), a
  // ring spreads on the water, a soft bloop where it is.
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number; w: number }[]>([]);
  useEffect(() => { preloadSounds("drop", "sparkle"); }, []);

  // One scale for everything: islands 10-15% larger than before, as the screen allows.
  const PIC = Math.round(Math.max(132, Math.min(152, width * 0.42)));
  const BOX_H = Math.round(PIC * 0.9); // IslandPicture's box
  const ROW = BOX_H + 64; // an island and its name
  const ZIG = Math.round(ROW * 0.7); // the next island, on the other side
  const LABEL_W = Math.min(176, Math.round(width * 0.48));
  const TOP = 20;

  // The found links that get a bridge: at most one per island; its two
  // islands sit side by side.
  const bridges = useMemo(() => bridgesOf(routes, 3), [routes]);
  const order = useMemo(() => {
    const byId = new Map(islands.map((i) => [i.id, i]));
    const seq: Island[] = [];
    const used = new Set<string>();
    for (const isl of islands) {
      if (used.has(isl.id)) continue;
      seq.push(isl);
      used.add(isl.id);
      const r = bridges.find((b) => b.a === isl.id || b.b === isl.id);
      const mate = r ? byId.get(r.a === isl.id ? r.b : r.a) : undefined;
      if (mate && !used.has(mate.id)) { seq.push(mate); used.add(mate.id); }
    }
    return seq;
  }, [islands, bridges]);
  const bridged = (a: string, b: string) => bridges.some((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
  // pairWithPrev[i]: island i shares a row with island i-1 (a bridge between them)
  const pairWithPrev = order.map(() => false);
  for (let i = 1; i < order.length; i++) if (!pairWithPrev[i - 1] && bridged(order[i - 1].id, order[i].id)) pairWithPrev[i] = true;

  const pos: Pt[] = [];
  order.forEach((_, i) => {
    const inPair = pairWithPrev[i] || pairWithPrev[i + 1];
    const right = i % 2 === 1;
    const y = i === 0 ? TOP : pairWithPrev[i] ? pos[i - 1].y : pairWithPrev[i - 1] ? pos[i - 1].y + ROW : pos[i - 1].y + ZIG;
    pos.push({ x: Math.round((right ? (inPair ? 0.75 : 0.7) : (inPair ? 0.25 : 0.3)) * width), y });
  });
  // where each island meets the water
  const waterline = pos.map((p) => p.y + BOX_H * 0.72);
  const at = new Map(order.map((isl, i) => [isl.id, i]));

  // What's already on the map, so her boat keeps clear.
  const taken: Box[] = [
    ...pos.map((p) => ({ x0: p.x - PIC * 0.44, x1: p.x + PIC * 0.44, y0: p.y + BOX_H * 0.08, y1: p.y + BOX_H * 0.9 })),
    ...pos.map((p) => ({ x0: p.x - LABEL_W * 0.45, x1: p.x + LABEL_W * 0.45, y0: p.y + BOX_H - 10, y1: p.y + BOX_H + 42 })),
  ];

  // The bridges, shore to shore; the bridge itself is the button.
  const links = bridges.map((r) => {
    const i = at.get(r.a), j = at.get(r.b);
    if (i === undefined || j === undefined) return null;
    const lo = Math.min(i, j), hi = Math.max(i, j);
    if (hi - lo !== 1 || !pairWithPrev[hi]) return null;
    const L = pos[lo].x < pos[hi].x ? lo : hi, Rr = L === lo ? hi : lo;
    const x0 = pos[L].x + PIC * 0.3, x1 = pos[Rr].x - PIC * 0.3;
    const w = Math.max(56, x1 - x0), h = w * BRIDGE_ASPECT, y = waterline[L] - BOX_H * 0.08;
    const box = { left: (x0 + x1) / 2 - w / 2, top: y - h * 0.62, w, h };
    taken.push({ x0: box.left, x1: box.left + w, y0: box.top - 14, y1: box.top + h });
    // the one-time tip sits under the pair's names, not over them
    const tipY = pos[L].y + BOX_H + 46;
    return { r, bridge: box, tipY, key: [r.a, r.b].sort().join("|") };
  });

  // A bridge new since she last saw the map builds itself, once; the very
  // first one says what a bridge means (her note: bridge or line?).
  const [fresh] = useState<Set<string>>(() => {
    const seen = readList(BRIDGES_SEEN);
    if (!seen) return new Set();
    return new Set(links.filter((l): l is NonNullable<typeof l> => !!l && !seen.includes(l.key)).map((l) => l.key));
  });
  const [tip, setTip] = useState(() => { try { return !localStorage.getItem(BRIDGE_TIP); } catch { return false; } });
  const keys = links.filter(Boolean).map((l) => l!.key).join(",");
  useEffect(() => {
    try { localStorage.setItem(BRIDGES_SEEN, JSON.stringify(keys ? keys.split(",") : [])); } catch { /* ignore */ }
    if (fresh.size && !matchMedia("(prefers-reduced-motion: reduce)").matches) playSparkle(0.3);
  }, [keys]); // eslint-disable-line react-hooks/exhaustive-deps
  const firstBridge = links.find(Boolean);
  useEffect(() => {
    if (!tip || !firstBridge) return;
    const off = () => { setTip(false); try { localStorage.setItem(BRIDGE_TIP, "1"); } catch { /* ignore */ } };
    document.addEventListener("pointerdown", off, { once: true });
    return () => document.removeEventListener("pointerdown", off);
  }, [tip, !!firstBridge]); // eslint-disable-line react-hooks/exhaustive-deps

  // Her boat: on free water beside the island she answered last (right, left, below).
  const boat = (() => {
    if (!you || order.length === 0) return null;
    const k = Math.max(0, order.findIndex((isl) => isl.id === you.near));
    const p = pos[k], wl = waterline[k];
    const fits = (q: Pt) => q.x > 40 && q.x < width - 40 && !taken.some((b) => hit(b, { x0: q.x - 34, x1: q.x + 34, y0: q.y - 52, y1: q.y + 22 }));
    for (const q of [{ x: p.x + PIC * 0.62, y: wl }, { x: p.x - PIC * 0.62, y: wl }, { x: p.x, y: p.y + BOX_H + 96 }, { x: p.x + PIC * 0.62, y: wl + 70 }, { x: p.x - PIC * 0.62, y: wl + 70 }]) if (fits(q)) return q;
    const last = pos[pos.length - 1];
    return { x: width / 2, y: last.y + BOX_H + 96 };
  })();

  const last = pos[pos.length - 1];
  const height = Math.max(last ? last.y + BOX_H + 56 : 0, boat ? boat.y + 34 : 0, firstBridge && tip ? firstBridge.tipY + 36 : 0);
  const title = (id: string) => {
    const tr = trackers.find((x) => x.id === id);
    return tr ? localizeTrackerTitle(tr.title) : "";
  };

  return (
    <div className="relative mx-auto" style={{ width, height }}>
      {/* Under each island: its shallows and a soft contact shadow. */}
      {order.map((isl, i) => {
        const p = pos[i], wl = waterline[i], sw = PIC * 1.25, sh = sw * 0.33;
        return (
          <span key={`g${isl.id}`} aria-hidden="true" className="pointer-events-none absolute" style={{ left: p.x - sw / 2, top: wl - sh / 2, width: sw, height: sh }}>
            <span className="absolute rounded-[50%] blur-[6px]"
              style={{ left: sw * 0.1 + 4, top: sh * 0.32 + 6, width: PIC * 0.8, height: PIC * 0.14, background: night ? "rgba(5,8,30,.3)" : "rgba(16,42,56,.16)" }} />
            <img src={mapPic("water_ripple")} alt="" decoding="async" draggable={false} className="map-shore absolute inset-0 h-full w-full object-fill"
              style={{ opacity: night ? 0.6 : 0.85 }} />
          </span>
        );
      })}

      {links.map((l, i) => l && (
        <img key={i} src={mapPic("wooden_bridge")} alt="" aria-hidden="true" decoding="async" draggable={false}
          className={`pointer-events-none absolute object-contain drop-shadow-[0_5px_6px_rgba(16,42,56,0.2)]${fresh.has(l.key) ? " bridge-build" : ""}`}
          style={{ left: l.bridge.left, top: l.bridge.top, width: l.bridge.w, height: l.bridge.h }} />
      ))}

      {ripples.map((r) => (
        <span key={r.id} aria-hidden="true" className="island-ripple" style={{ left: r.x - r.w / 2, top: r.y - r.w * 0.16, width: r.w, height: r.w * 0.32 }} />
      ))}

      {you && boat && (
        <button type="button" onClick={() => { haptics.soft(); onYou?.(); }} aria-label={t("map.you")}
          className="absolute z-[2] flex flex-col items-center active:scale-95 transition-transform" style={{ left: boat.x - 50, top: boat.y - 52, width: 100 }}>
          <span className="relative block h-[54px] w-[54px]">
            <img src={mapPic("sailboat")} alt="" className="absolute bottom-0 left-1/2 w-[48px] -translate-x-1/2 object-contain drop-shadow-[0_4px_5px_rgba(16,42,56,0.2)]" draggable={false} />
            {you.pic && (
              <img src={you.pic} alt="" className="absolute left-[3px] top-[1px] h-[32px] w-[32px] object-contain drop-shadow-[0_3px_4px_rgba(16,42,56,0.25)]" draggable={false} />
            )}
          </span>
          <span className="surface -mt-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-bold">{t("map.you")}</span>
        </button>
      )}

      {order.map((isl, i) => {
        const p = pos[i];
        const w = Math.max(PIC, LABEL_W);
        return (
          <button key={isl.id} type="button"
            onClick={() => {
              // a finished tap only, never the start of a scroll (the CSS
              // :active sink still shows at touch-down)
              haptics.pop(0.55);
              playBloop(p.x / width);
              const id = Date.now() + i;
              setRipples((r) => [...r, { id, x: p.x, y: waterline[i], w: PIC * 0.95 }]);
              window.setTimeout(() => setRipples((r) => r.filter((q) => q.id !== id)), 800);
              window.setTimeout(() => onOpen(isl.id), 140);
            }}
            className="island-press absolute z-[1] flex flex-col items-center"
            style={{ left: p.x - w / 2, top: p.y, width: w }}
            aria-label={`${islandName(t, isl.id)}${isl.weather ? ` · ${t(`map.weather.${isl.weather}`)}` : ""}`}>
            <span className="island-art relative">
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

      {/* The bridge itself opens what the link is, in words. */}
      {links.map((l, i) => l && (
        <div key={i}>
          <button type="button" data-map-link onClick={() => { haptics.land(); setLink((v) => (v === i ? null : i)); }}
            aria-label={`${t("map.linked")} · ${t("map.linkAria")}`} aria-expanded={link === i}
            className="absolute z-[2] flex items-start justify-center active:scale-95 transition-transform"
            style={{ left: l.bridge.left + l.bridge.w / 2 - 32, top: l.bridge.top - 14, width: 64, height: 44 }}>
            <span className="surface flex h-6 w-6 items-center justify-center rounded-full text-[hsl(var(--coin-teal))]">
              <Link2 className="h-3.5 w-3.5" strokeWidth={2.6} />
            </span>
          </button>
          {l === firstBridge && tip && link === null && (
            <p className="surface pointer-events-none absolute z-[2] whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-semibold text-foreground animate-fade-in"
              style={{ left: l.bridge.left + l.bridge.w / 2, top: l.tipY, transform: "translateX(-50%)" }}>
              {t("map.bridgeTip")}
            </p>
          )}
          {link === i && (
            <div ref={bubbleRef} role="dialog" className="path-bubble surface absolute z-20 rounded-[20px] px-4 py-3"
              style={{ left: Math.max(8, Math.min(l.bridge.left + l.bridge.w / 2 - 140, width - 288)), top: l.bridge.top + l.bridge.h + 8, width: 280 }}>
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
