// The flat map, new look (Nov 4 2026): the same planet as the globe, unrolled.
// Her painted planet is the sea; her islands stand on a ring around the boat
// in the middle (her pick, "карта 1"), each with its weather and name right
// under it; a link is the same dotted boat route as on the globe; an empty place
// on the ring is her cloud island, where a new island can open.
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CloudLightning, CloudSun, Link2, Plus, Sun } from "lucide-react";
import { Island, IslandId, Route, islandName, mapPicFor } from "@/lib/islands";
import { ASPECT, STAGE_SCALE, alongCurve, art, artOf, ringOrder, routeDots, stageOf, type RouteDot, type WakePoint } from "@/lib/globeArt";
import { haptics } from "@/lib/haptics";
import { standAt, standsOn } from "@/lib/islandSpots";
import type { PlacedTreasure } from "@/lib/growth";
import { playBloop } from "@/lib/feedback";
import planetDay from "@/assets/globe/planet-day.webp";
import planetNight from "@/assets/globe/planet-night.webp";

const WEATHER_ICON = { storm: CloudLightning, clouds: CloudSun, sun: Sun } as const;
const WEATHER_COLOR = { storm: "#7D8CC4", clouds: "#7D9CC8", sun: "#E8A93A" } as const;
// Where the ring's middle sits in her planet picture (1774 × 887), and how many
// picture pixels 28 degrees are: the crop puts the ring on her open sea.
const PIC_W = 1774, MID_X = 779, MID_Y = 335, RING_PX = 128;

export const PlanetMap = ({ islands, routes, inner, width, lit, main = null, days = {}, avatar = null, treasures, garden, onOpen, onNewIsland, onYou, onLink }: {
  islands: Island[]; routes: Route[];
  /** a link inside one island (buildInnerLinks): a loop and its chip on that island */
  inner?: Map<IslandId, Route>;
  /** her topic's island: a soft light under it and a dot in its name */
  main?: IslandId | null;
  /** the column's width; the map adds 16 px on both sides (its parent has no padding) */
  width: number;
  lit?: Set<IslandId>;
  days?: Record<string, number>;
  avatar?: string | null;
  /** her treasures, each on its island (growth.ts placeTreasures) */
  treasures?: Map<IslandId, PlacedTreasure[]>;
  /** her garden: a tree for each finished test (growth.ts gardenTrees) */
  garden?: Map<IslandId, string[]>;
  onOpen: (id: IslandId) => void;
  onNewIsland?: () => void;
  onYou?: () => void;
  /** a dotted route tapped: its link card */
  onLink?: (route: Route) => void;
}) => {
  const { t } = useTranslation();
  // one empty place on the ring for a new island while there is room; more
  // islands, a taller ring
  const canAdd = !!onNewIsland && islands.length < 9;
  const slots = islands.length + (canAdd ? 1 : 0), big = slots <= 6;
  const W = width + 32, H = Math.round(W * (slots <= 5 ? 1.15 : slots <= 7 ? 1.32 : 1.48));
  const C = { x: W / 2, y: H * (big ? 0.44 : 0.46) };
  const scale = (W * 0.34) / RING_PX;
  // a name near the edge leans inward instead of running off the screen
  const label = (x: number) => { const dx = Math.min(Math.max(x, 100), W - 100) - x; return { marginLeft: -90 + dx, justifyContent: dx > 0 ? "flex-start" : dx < 0 ? "flex-end" : "center" } as const; };

  const { spots, wakes } = useMemo(() => {
    const { ordered, links } = ringOrder(islands, routes);
    const rx = W * (big ? 0.33 : 0.35), ry = H * (big ? 0.3 : 0.34), size = W * (big ? 0.27 : 0.23);
    // equal steps along the ring, not equal angles: the ring is taller than
    // wide, and equal angles crowd the islands at its top and bottom
    const ring = Array.from({ length: 241 }, (_, k) => { const b = (k / 240) * Math.PI * 2; return [rx * Math.sin(b), -ry * Math.cos(b)]; });
    const run = [0];
    for (let k = 1; k < ring.length; k++) run.push(run[k - 1] + Math.hypot(ring[k][0] - ring[k - 1][0], ring[k][1] - ring[k - 1][1]));
    const at = (i: number) => {
      if (slots === 1) return { x: C.x, y: C.y - ry * 0.55 };
      const d = (((i / slots) + 0.1) % 1) * run[run.length - 1], k = Math.max(1, run.findIndex((r) => r >= d));
      const f = (d - run[k - 1]) / ((run[k] - run[k - 1]) || 1);
      return { x: C.x + ring[k - 1][0] + (ring[k][0] - ring[k - 1][0]) * f, y: C.y + ring[k - 1][1] + (ring[k][1] - ring[k - 1][1]) * f };
    };
    // each island stands at the size of its stage
    const list = ordered.map((isl, i) => { const stage = stageOf(days[isl.id] ?? 0); return { isl, ...at(i), name: artOf(isl.id, days[isl.id] ?? 0), stage, size: size * STAGE_SCALE[stage] }; });
    const empty = slots > ordered.length ? { ...at(ordered.length), size: size * 0.9 } : null;
    // A wake between two neighbours never runs through a name: side by side it
    // leaves from the facing shores; one above the other it leaves the upper
    // island on the boat's side, bends toward the boat and slips behind the lower one.
    const ws = links.map(([a, b]) => {
      const P = list.find((s) => s.isl.id === a), Q = list.find((s) => s.isl.id === b);
      const route = routes.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
      if (!P || !Q || !route) return null;
      const way = (pts: WakePoint[]) => ({ route, pts, dots: routeDots(pts) });
      const [U, L] = P.y <= Q.y ? [P, Q] : [Q, P];
      const hU = U.size * (ASPECT[U.name] ?? 0.55), hL = L.size * (ASPECT[L.name] ?? 0.55);
      if (L.y - U.y < size * 0.45) {
        const s = Math.sign(L.x - U.x) || 1, mx = (U.x + L.x) / 2, my = (U.y + L.y) / 2;
        return way(alongCurve([[U.x + s * size * 0.4, U.y], [mx, my + (my > C.y ? -1 : 1) * size * 0.12], [L.x - s * size * 0.4, L.y]], 80));
      }
      const s = Math.sign(C.x - (U.x + L.x) / 2) || 1;
      const mid: [number, number] = [(U.x + L.x) / 2 + s * size * 0.4, (U.y + L.y) / 2];
      return way(alongCurve([[U.x + s * size * 0.48, U.y - hU * 0.05], mid, [L.x + s * size * 0.12, L.y - hL * 0.25]], 80));
    }).filter(Boolean) as { route: Route; pts: WakePoint[]; dots: RouteDot[] }[];
    return { spots: { list, empty }, wakes: ws };
  }, [islands, routes, days, W, H, C.x, C.y, slots, big]);

  const bg = (pic: string) => ({
    backgroundImage: `url(${pic})`,
    backgroundSize: `${PIC_W * scale}px auto`,
    backgroundPosition: `${C.x - MID_X * scale}px ${C.y - MID_Y * scale}px`,
  });

  return (
    <div className="planet-map relative" style={{ width: W, height: H }}>
      <div aria-hidden="true" className="planet-map-sea art-day" style={bg(planetDay)} />
      <div aria-hidden="true" className="planet-map-sea art-night" style={bg(planetNight)} />
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1]" width={W} height={H}>
        {wakes.map((w, i) => (
          <g key={i}>
            {/* the whole route answers a tap, not just its dots */}
            <path d={`M${w.pts.map((q) => `${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(" L")}`} fill="none" stroke="transparent" strokeWidth={28}
              style={{ pointerEvents: onLink ? "stroke" : "none", cursor: "pointer" }} onClick={() => { haptics.tap(); onLink?.(w.route); }} />
            {w.dots.map((d, j) => <circle key={j} className="planet-route" cx={d.x} cy={d.y} r={d.r * 1.1} opacity={d.o} />)}
          </g>
        ))}
      </svg>
      {/* a small round sign on each route, so it reads as something to open */}
      {onLink && wakes.map((w, i) => {
        const m = w.pts[Math.floor(w.pts.length / 2)];
        return (
          <button key={`link${i}`} type="button" aria-label={t("link.chip", { a: islandName(t, w.route.a), b: islandName(t, w.route.b) })}
            onClick={() => { haptics.tap(); onLink(w.route); }} className="link-chip absolute z-[2]" style={{ left: m.x - 17, top: m.y - 17 }}>
            <Link2 className="h-4 w-4" strokeWidth={2.6} />
          </button>
        );
      })}

      {/* her boat in the middle: you */}
      <button type="button" aria-label={t("map.you")} onClick={() => { haptics.tap(); onYou?.(); }}
        className="planet-isle planet-boat absolute z-[3] transition-transform duration-150 active:scale-95" style={{ left: C.x - W * 0.09, top: C.y - W * 0.13, width: W * 0.18 }}>
        <div className="bob">
          <img className="art-day" src={mapPicFor("sailboat", false)} alt="" />
          <img className="art-night" src={mapPicFor("sailboat", true)} alt="" />
          {avatar && <img className="otter" src={avatar} alt="" />}
        </div>
      </button>

      {spots.list.map(({ isl, x, y, name, size, stage }) => {
        const h = size * (ASPECT[name] ?? 0.55), Icon = isl.weather ? WEATHER_ICON[isl.weather] : null;
        return (
          <button key={isl.id} type="button" aria-label={islandName(t, isl.id)}
            onClick={(e) => { haptics.tap(); playBloop(Math.min(1, Math.max(0, x / W))); const el = e.currentTarget; el.classList.add("on"); window.setTimeout(() => { el.classList.remove("on"); onOpen(isl.id); }, 150); }}
            data-isle={isl.id} data-art={name}
            className={`planet-isle planet-map-isle island-press absolute z-[2]${isl.id === main ? " is-main" : ""}`} style={{ left: x - size / 2, top: y - h * 0.7, width: size }}>
            {isl.id === main && <span className="main-glow" aria-hidden="true" />}
            <span className="ring" />
            <img className="art-day island-art" src={art(name, false)} alt="" />
            <img className="art-night island-art" src={art(name, true)} alt="" />
            {/* things stand on the island's ground (src/lib/islandSpots.ts); her garden first, behind */}
            {garden?.get(isl.id)?.map((pic, gi) => (
              <span key={`g${gi}`} className="stand tree" style={standAt(name, gi === 0 ? "g1" : "g2")}><img className="art-day" src={mapPicFor(pic, false)} alt="" /><img className="art-night" src={mapPicFor(pic, true)} alt="" /></span>
            ))}
            {lit?.has(isl.id) && <span className="stand lighthouse" style={standAt(name, "light")}><img className="art-day" src={mapPicFor("lighthouse", false)} alt="" /><img className="art-night" src={mapPicFor("lighthouse", true)} alt="" /></span>}
            {stage === 4 && <span className="stand flag" style={standAt(name, "flag")}><img className="art-day" src={mapPicFor("marker_flag", false)} alt="" /><img className="art-night" src={mapPicFor("marker_flag", true)} alt="" /></span>}
            {treasures?.get(isl.id)?.filter((tr) => standsOn(name, tr.id)).map((tr) => (
              <span key={tr.id} className={`treasure t-${tr.slot} it-${tr.id}${tr.ghost ? " is-ghost" : ""}${tr.slot !== "sky" ? " stand" : ""}`} style={tr.slot !== "sky" ? standAt(name, tr.slot) : undefined}><img className="art-day" src={mapPicFor(tr.pic, false)} alt="" /><img className="art-night" src={mapPicFor(tr.pic, true)} alt="" /></span>
            ))}
            {inner?.get(isl.id) && (
              <svg className="inner-loop" aria-hidden="true" viewBox="0 0 100 40" preserveAspectRatio="none">
                {Array.from({ length: 11 }, (_, k) => { const u = 0.15 + (k / 10) * 0.7, xx = 10 + u * 80, yy = 34 - Math.sin(u * Math.PI) * 30; return <circle key={k} cx={xx} cy={yy} r={2.4} className="planet-route" />; })}
              </svg>
            )}
            <span className="planet-label" style={{ position: "absolute", left: "50%", top: "100%", marginTop: 4, ...label(x) }}>
              <span>{isl.id === main && <i className="main-dot" aria-hidden="true" />}{Icon && <Icon className="h-4 w-4" strokeWidth={2.4} style={{ color: WEATHER_COLOR[isl.weather!] }} />}{islandName(t, isl.id)}</span>
            </span>
          </button>
        );
      })}

      {onLink && inner && spots.list.map(({ isl, x, y, size, name }) => {
        const r = inner.get(isl.id);
        if (!r) return null;
        const h = size * (ASPECT[name] ?? 0.55);
        return (
          <button key={`in-${isl.id}`} type="button" aria-label={`${t("map.linked")} · ${t("map.linkAria")}`} onClick={() => { haptics.tap(); onLink(r); }}
            className="inner-chip absolute z-[3]" style={{ left: x - 30, top: y - h * 0.7 - 14 }}>
            <Link2 className="h-3.5 w-3.5" strokeWidth={2.6} />{r.k}/{r.n}
          </button>
        );
      })}

      {spots.empty && (
        <button type="button" aria-label={t("islands.new")} onClick={() => { haptics.tap(); onNewIsland?.(); }}
          className="planet-isle planet-map-isle island-press absolute z-[2]" style={{ left: spots.empty.x - spots.empty.size / 2, top: spots.empty.y - spots.empty.size * 0.32, width: spots.empty.size }}>
          {/* a tool, not an island name (board 76 A): a faint cloud, a + tile, a small caption */}
          <img className="art-day island-art opacity-50" src={art("cloud_island_03", false)} alt="" />
          <img className="art-night island-art opacity-50" src={art("cloud_island_03", true)} alt="" />
          <span className="new-tool" aria-hidden="true"><Plus className="h-6 w-6" strokeWidth={2.6} /></span>
          <span className="new-tool-cap">{t("islands.new")}</span>
        </button>
      )}
    </div>
  );
};
