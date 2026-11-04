// Her island pack v2 and the soft boat wake, shared by the globe, the flat
// map and Today (Nov 4 2026). Pictures: src/assets/globe/{day,night}, made
// from marketing/brand/map-assets-v2 by marketing/tools/prep-map-assets-v2.mjs.
import { Island, IslandId, Route, bridgesOf, isOwnIsland } from "@/lib/islands";

const named = (files: Record<string, string>) => new Map(Object.entries(files).map(([p, url]) => [p.split("/").pop()!.replace(".webp", ""), url]));
const DAY = named(import.meta.glob("@/assets/globe/day/*.webp", { eager: true, import: "default" }) as Record<string, string>);
const NIGHT = named(import.meta.glob("@/assets/globe/night/*.webp", { eager: true, import: "default" }) as Record<string, string>);
/** A picture from her pack, day or night (the same shapes). */
export const art = (name: string, night: boolean) => (night && NIGHT.get(name)) || DAY.get(name) || "";

/** height / width of each picture */
export const ASPECT: Record<string, number> = {
  "03_flower_hill": 0.514, "04_twin_hills": 0.451, "05_wide_meadow": 0.379, "06_snow_peak": 0.508, "09_waterfall": 0.462,
  "10_terraced_garden": 0.496, "11_sakura": 0.753, "14_stone_arch": 0.579, "16_cozy_cottage": 0.539, "17_lavender_garden": 0.519,
  "19_grassy_terraces": 0.513, "20_tropical_palms": 0.747, "24_oak_tree": 0.704, "26_flowery_island": 0.441,
  cloud_01_large: 0.607, cloud_02_large: 0.526, cloud_03_large: 0.384, cloud_04_large: 0.424, cloud_05_large: 0.447,
  cloud_06_large: 0.406, cloud_07_large: 0.284, cloud_island_01: 0.461, cloud_island_03: 0.51, cloud_island_05: 0.415, sailboat: 1,
};

// Each life area is one whole island from her pack.
const ART: Record<string, string> = {
  me: "17_lavender_garden", love: "11_sakura", kids: "20_tropical_palms", health: "09_waterfall", body: "19_grassy_terraces",
  pet: "24_oak_tree", parents: "16_cozy_cottage", world: "14_stone_arch", work: "06_snow_peak", mine: "26_flowery_island", other: "10_terraced_garden",
};
/** Her own islands grow with her evenings there; never a bare rock on day one (her rule). */
export const artOf = (id: IslandId, days: number) =>
  isOwnIsland(id) ? (days >= 14 ? "05_wide_meadow" : days >= 7 ? "04_twin_hills" : "03_flower_hill") : ART[id] ?? ART.other;

/** Islands in ring order: linked pairs side by side (their wake is short), then the rest. */
export const ringOrder = (islands: Island[], routes: Route[]) => {
  const links = bridgesOf(routes, 3);
  const ordered: Island[] = [];
  for (const r of links) for (const id of [r.a, r.b]) { const isl = islands.find((i) => i.id === id); if (isl && !ordered.includes(isl)) ordered.push(isl); }
  for (const isl of islands) if (!ordered.includes(isl)) ordered.push(isl);
  return { ordered, links: links.map((r) => [r.a, r.b] as const) };
};

export type WakePoint = { x: number; y: number; t: number; k?: number };
/** A link drawn as the wake a boat left (her notes: one soft wavy trail, thin at both
 *  ends, never a straight line, never side ripples): a glow band and a white core,
 *  as SVG path data. `k` (0..1) shrinks it toward the back of the globe. */
export const wakeShape = (P: WakePoint[], { waves = 3.5, amp = 5.5, width = 4.5 }: { waves?: number; amp?: number; width?: number } = {}) => {
  const f1 = (n: number) => n.toFixed(1), pt = (x: number, y: number) => `${f1(x)} ${f1(y)}`;
  const C = P.map((q, i) => {
    const a0 = P[Math.max(0, i - 1)], a1 = P[Math.min(P.length - 1, i + 1)];
    const dx = a1.x - a0.x, dy = a1.y - a0.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const k = q.k ?? 1;
    const taper = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, (q.t - 0.07) / 0.86))), 0.55);
    const wave = amp * k * Math.sin(q.t * Math.PI * 2 * waves) * taper; // a gentle meander, fixed to the water
    return { x: q.x + nx * wave, y: q.y + ny * wave, nx, ny, w: (width + width * k) * k * taper, cw: (0.9 + 1.2 * k) * taper };
  });
  const band = (key: "w" | "cw") => `M${C.map((c) => pt(c.x + c.nx * c[key], c.y + c.ny * c[key])).join(" L")} L${C.map((c) => pt(c.x - c.nx * c[key], c.y - c.ny * c[key])).reverse().join(" L")}Z`;
  return { glow: band("w"), core: band("cw"), mid: `M${C.map((c) => pt(c.x, c.y)).join(" L")}` };
};

/** Points along a smooth curve through `pts` (Catmull-Rom), t from 0 to 1 by length. */
export const alongCurve = (pts: [number, number][], n = 80): WakePoint[] => {
  if (pts.length < 2) return [];
  const g = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  const dense: [number, number][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [g(i - 1), g(i), g(i + 1), g(i + 2)];
    for (let s = 0; s < 12; s++) {
      const t = s / 12, t2 = t * t, t3 = t2 * t;
      dense.push([0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)) as [number, number]);
    }
  }
  dense.push(pts[pts.length - 1]);
  const len = [0];
  for (let i = 1; i < dense.length; i++) len.push(len[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const L = len[len.length - 1] || 1, out: WakePoint[] = [];
  for (let k = 0, j = 0; k <= n; k++) {
    const d = (k / n) * L;
    while (j < len.length - 2 && len[j + 1] < d) j++;
    const s = (d - len[j]) / ((len[j + 1] - len[j]) || 1);
    out.push({ x: dense[j][0] + (dense[j + 1][0] - dense[j][0]) * s, y: dense[j][1] + (dense[j + 1][1] - dense[j][1]) * s, t: k / n });
  }
  return out;
};
