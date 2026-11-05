// Her island pack v2 and the dotted route between islands, shared by the globe, the flat
// map and Today (Nov 4 2026). Pictures: src/assets/globe/{day,night}, made
// from marketing/brand/map-assets-v2 by marketing/tools/prep-map-assets-v2.mjs.
import { Island, IslandId, Route, bridgesOf, islandOf, isOwnIsland } from "@/lib/islands";
import { isoLocal } from "@/lib/doors";
import type { Tracker, TrackerEntry } from "@/types/tracker";

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
// --- How an island grows (her note, Nov 5 2026: the world hardly changed with
// her answers). Every island grows with the evenings answered on it and never
// shrinks, for gaps or for hard days; never a bare rock on day one (her rule).
// Stage 1 a flower hill, 2 two hills, 3 the island shows what it is (her
// sakura, her waterfall…; her own island a meadow), 4 the same, bigger, with a
// flag. The thresholds live here only (WORLD-BIBLE.md, "Рост острова").
export type Stage = 1 | 2 | 3 | 4;
/** Evenings at which stages 1-4 begin. */
export const STAGE_AT = [0, 3, 7, 21] as const;
export const stageOf = (days: number): Stage => (days >= STAGE_AT[3] ? 4 : days >= STAGE_AT[2] ? 3 : days >= STAGE_AT[1] ? 2 : 1);
/** Evenings still to go to the next stage (null at the last). */
export const toNextStage = (days: number): number | null => { const s = stageOf(days); return s === 4 ? null : STAGE_AT[s] - days; };
/** How big an island stands at each stage. */
export const STAGE_SCALE: Record<Stage, number> = { 1: 0.82, 2: 0.9, 3: 1, 4: 1.12 };
export const artOf = (id: IslandId, days: number) => {
  const s = stageOf(days);
  if (s === 1) return "03_flower_hill";
  if (s === 2) return "04_twin_hills";
  return isOwnIsland(id) ? "05_wide_meadow" : ART[id] ?? ART.other;
};
/** Evenings with any answer on each island, all time (as growth.ts islandDays). */
export const islandEvenings = (trackers: Tracker[], entries: TrackerEntry[]): Map<IslandId, number> => {
  const where = new Map(trackers.filter((t) => !t.archived && t.source !== "play").map((t) => [t.id, islandOf(t)]));
  const days = new Map<IslandId, Set<string>>();
  for (const e of entries) {
    const id = where.get(e.trackerId);
    if (!id) continue;
    if (!days.has(id)) days.set(id, new Set());
    days.get(id)!.add(e.date);
  }
  return new Map([...days].map(([id, d]) => [id, d.size]));
};
/** Islands that reached a new stage with today's answers. */
export const grewToday = (trackers: Tracker[], entries: TrackerEntry[], today = isoLocal(new Date())): { island: IslandId; stage: Stage }[] => {
  if (!entries.some((e) => e.date === today)) return [];
  const now = islandEvenings(trackers, entries), before = islandEvenings(trackers, entries.filter((e) => e.date !== today));
  const out: { island: IslandId; stage: Stage }[] = [];
  for (const [id, n] of now) {
    const s = stageOf(n);
    if (s > stageOf(before.get(id) ?? 0)) out.push({ island: id, stage: s });
  }
  return out;
};

/** Islands in ring order: linked pairs side by side (their wake is short), then the rest. */
export const ringOrder = (islands: Island[], routes: Route[]) => {
  const links = bridgesOf(routes, 3);
  const ordered: Island[] = [];
  for (const r of links) for (const id of [r.a, r.b]) { const isl = islands.find((i) => i.id === id); if (isl && !ordered.includes(isl)) ordered.push(isl); }
  for (const isl of islands) if (!ordered.includes(isl)) ordered.push(isl);
  return { ordered, links: links.map((r) => [r.a, r.b] as const) };
};

export type WakePoint = { x: number; y: number; t: number; k?: number };
/** A link drawn as a boat's route on a sea chart (her note, Nov 4 2026: the soft
 *  wake before it "больше похожа на молнию"): round dots along a smooth curve,
 *  every `gap` px, small and faint near both islands, full in the middle. `k`
 *  (0..1) shrinks them toward the back of the globe. */
export type RouteDot = { x: number; y: number; r: number; o: number };
export const routeDots = (P: WakePoint[], gap = 12): RouteDot[] => {
  const out: RouteDot[] = [];
  let carry = gap * 0.5;
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], L = Math.hypot(b.x - a.x, b.y - a.y);
    let d = carry;
    for (; d <= L; d += gap) {
      const f = L ? d / L : 0, t = a.t + (b.t - a.t) * f, k = (a.k ?? 1) + ((b.k ?? 1) - (a.k ?? 1)) * f;
      const end = Math.min(1, Math.min(t, 1 - t) / 0.14);
      out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, r: (1.5 + 1.7 * end) * k, o: (0.3 + 0.7 * end) * (0.45 + 0.55 * k) });
    }
    carry = d - L;
  }
  return out;
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
