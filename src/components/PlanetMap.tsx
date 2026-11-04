// The flat map, new look (Nov 4 2026): the same planet as the globe, unrolled.
// Her painted planet is the sea; her islands stand on a ring around the boat
// in the middle (her pick, "карта 1"), each with its weather and name right
// under it; a link is the same soft boat wake as on the globe; an empty place
// on the ring is her cloud island, where a new island can open.
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CloudLightning, CloudSun, Plus, Sun } from "lucide-react";
import { Island, IslandId, Route, islandName, mapPicFor } from "@/lib/islands";
import { ASPECT, alongCurve, art, artOf, ringOrder, wakeShape } from "@/lib/globeArt";
import { haptics } from "@/lib/haptics";
import { playBloop } from "@/lib/feedback";
import planetDay from "@/assets/globe/planet-day.webp";
import planetNight from "@/assets/globe/planet-night.webp";

const WEATHER_ICON = { storm: CloudLightning, clouds: CloudSun, sun: Sun } as const;
const WEATHER_COLOR = { storm: "#7D8CC4", clouds: "#7D9CC8", sun: "#E8A93A" } as const;
// Where the ring's middle sits in her planet picture (1774 × 887), and how many
// picture pixels 28 degrees are: the crop puts the ring on her open sea.
const PIC_W = 1774, MID_X = 779, MID_Y = 335, RING_PX = 128;

export const PlanetMap = ({ islands, routes, width, lit, days = {}, avatar = null, onOpen, onNewIsland, onYou }: {
  islands: Island[]; routes: Route[];
  /** the column's width; the map adds 16 px on both sides (its parent has no padding) */
  width: number;
  lit?: Set<IslandId>;
  days?: Record<string, number>;
  avatar?: string | null;
  onOpen: (id: IslandId) => void;
  onNewIsland?: () => void;
  onYou?: () => void;
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
    const list = ordered.map((isl, i) => ({ isl, ...at(i), name: artOf(isl.id, days[isl.id] ?? 0), size }));
    const empty = slots > ordered.length ? { ...at(ordered.length), size: size * 0.9 } : null;
    // A wake between two neighbours never runs through a name: side by side it
    // leaves from the facing shores; one above the other it leaves the upper
    // island on the boat's side, bends toward the boat and slips behind the lower one.
    const ws = links.map(([a, b]) => {
      const P = list.find((s) => s.isl.id === a), Q = list.find((s) => s.isl.id === b);
      if (!P || !Q) return null;
      const [U, L] = P.y <= Q.y ? [P, Q] : [Q, P];
      const hU = size * (ASPECT[U.name] ?? 0.55), hL = size * (ASPECT[L.name] ?? 0.55);
      if (L.y - U.y < size * 0.45) {
        const s = Math.sign(L.x - U.x) || 1, mx = (U.x + L.x) / 2, my = (U.y + L.y) / 2;
        return wakeShape(alongCurve([[U.x + s * size * 0.4, U.y], [mx, my + (my > C.y ? -1 : 1) * size * 0.12], [L.x - s * size * 0.4, L.y]], 80));
      }
      const s = Math.sign(C.x - (U.x + L.x) / 2) || 1;
      const mid: [number, number] = [(U.x + L.x) / 2 + s * size * 0.4, (U.y + L.y) / 2];
      return wakeShape(alongCurve([[U.x + s * size * 0.48, U.y - hU * 0.05], mid, [L.x + s * size * 0.12, L.y - hL * 0.25]], 80));
    }).filter(Boolean) as ReturnType<typeof wakeShape>[];
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
        <defs>
          <filter id="pm-wb" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.2" /></filter>
          <filter id="pm-ws"><feGaussianBlur stdDeviation="0.5" /></filter>
        </defs>
        {wakes.map((w, i) => (
          <g key={i}>
            <path d={w.glow} className="planet-wake-glow" filter="url(#pm-wb)" />
            <path d={w.core} className="planet-wake-core" filter="url(#pm-ws)" />
            <path d={w.mid} className="planet-shimmer" strokeWidth={2.4} strokeDasharray="0.1 22" fill="none" strokeLinecap="round" />
          </g>
        ))}
      </svg>

      {/* her boat in the middle: you */}
      <button type="button" aria-label={t("map.you")} onClick={() => { haptics.tap(); onYou?.(); }}
        className="planet-isle planet-boat absolute z-[3] transition-transform duration-150 active:scale-95" style={{ left: C.x - W * 0.09, top: C.y - W * 0.13, width: W * 0.18 }}>
        <div className="bob">
          <img className="art-day" src={mapPicFor("sailboat", false)} alt="" />
          <img className="art-night" src={mapPicFor("sailboat", true)} alt="" />
          {avatar && <img className="otter" src={avatar} alt="" />}
        </div>
      </button>

      {spots.list.map(({ isl, x, y, name, size }) => {
        const h = size * (ASPECT[name] ?? 0.55), Icon = isl.weather ? WEATHER_ICON[isl.weather] : null;
        return (
          <button key={isl.id} type="button" aria-label={islandName(t, isl.id)}
            onClick={(e) => { haptics.tap(); playBloop(Math.min(1, Math.max(0, x / W))); const el = e.currentTarget; el.classList.add("on"); window.setTimeout(() => { el.classList.remove("on"); onOpen(isl.id); }, 150); }}
            className="planet-isle planet-map-isle island-press absolute z-[2]" style={{ left: x - size / 2, top: y - h * 0.7, width: size }}>
            <span className="ring" />
            <img className="art-day island-art" src={art(name, false)} alt="" />
            <img className="art-night island-art" src={art(name, true)} alt="" />
            {lit?.has(isl.id) && <><img className="lighthouse art-day" src={mapPicFor("lighthouse", false)} alt="" /><img className="lighthouse art-night" src={mapPicFor("lighthouse", true)} alt="" /></>}
            <span className="planet-label" style={{ position: "absolute", left: "50%", top: "100%", marginTop: 4, ...label(x) }}>
              <span>{Icon && <Icon className="h-4 w-4" strokeWidth={2.4} style={{ color: WEATHER_COLOR[isl.weather!] }} />}{islandName(t, isl.id)}</span>
            </span>
          </button>
        );
      })}

      {spots.empty && (
        <button type="button" aria-label={t("islands.new")} onClick={() => { haptics.tap(); onNewIsland?.(); }}
          className="planet-isle planet-map-isle island-press absolute z-[2]" style={{ left: spots.empty.x - spots.empty.size / 2, top: spots.empty.y - spots.empty.size * 0.32, width: spots.empty.size }}>
          <img className="art-day island-art" src={art("cloud_island_03", false)} alt="" />
          <img className="art-night island-art" src={art("cloud_island_03", true)} alt="" />
          <span className="planet-label" style={{ position: "absolute", left: "50%", top: "100%", marginTop: 2, ...label(spots.empty.x) }}>
            <span className="is-new"><Plus className="h-4 w-4" strokeWidth={2.6} />{t("islands.new")}</span>
          </span>
        </button>
      )}
    </div>
  );
};
