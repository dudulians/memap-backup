// Aurora UX step: the Map (Nov 1 2026). Her idea: your life as a world of
// islands. Each life area is an island; every question lands on one by its
// theme (the library cluster it came from, else its category). Weather over
// an island = how often its "hard" answer came this week. Pictures are her
// map set (marketing/brand/map-assets), shipped as small webp files.
import { Tracker, TrackerEntry } from "@/types/tracker";
import { computeCorrelations } from "@/lib/correlations";
import { isoLocal } from "@/lib/doors";

const PICS = new Map(
  Object.entries(import.meta.glob("@/assets/map/*.webp", { eager: true, import: "default" }) as Record<string, string>)
    .map(([path, url]) => [path.split("/").pop()!.replace(".webp", ""), url]),
);
export const mapPic = (name: string): string => PICS.get(name) ?? "";

export type IslandId = "me" | "love" | "kids" | "health" | "body" | "pet" | "parents" | "world" | "other";

export interface IslandDef {
  id: IslandId;
  /** island base picture and what stands on it: [picture, width share, dx, dy] */
  base: string;
  land?: [string, number, number, number][];
  icon: string;
}

export const ISLAND_DEFS: Record<IslandId, IslandDef> = {
  me: { id: "me", base: "island_plain", land: [["flowering_bush", .4, .02, -.4]], icon: "wellbeing" },
  love: { id: "love", base: "island_plain", land: [["cherry_blossom_tree", .56, .04, -.44]], icon: "love" },
  kids: { id: "kids", base: "island_waterfall", icon: "growth" },
  health: { id: "health", base: "island_lotus", icon: "health" },
  body: { id: "body", base: "island_mountain", icon: "fitness" },
  pet: { id: "pet", base: "island_rocky", land: [["house", .56, .04, -.36]], icon: "pets" },
  parents: { id: "parents", base: "island_plain", land: [["orange_tree", .44, .04, -.46]], icon: "family" },
  world: { id: "world", base: "island_rocky", land: [["city_buildings", .58, 0, -.42], ["lighthouse", .3, .27, -.32]], icon: "travel" },
  other: { id: "other", base: "island_plain", land: [["palm_trees", .52, .02, -.46]], icon: "hobbies" },
};

// Library cluster → island. Trackers made from a library card carry `cluster`.
const CLUSTER: Record<string, IslandId> = {
  partner: "love", "trending-argued": "love", "trending-wanted-child": "love",
  parenting: "kids", "child-wellbeing": "kids", "trending-yelled": "kids",
  health: "health",
  habits: "body", "trending-alcohol": "body",
  state: "me", "trending-cried": "me", "big-decisions": "me",
  pet: "pet",
  "elderly-parent": "parents",
  "external-events": "world", expat: "world",
};
const CATEGORY: Record<Tracker["category"], IslandId> = {
  Emotions: "me", Voice: "me", Connections: "love", Social: "love", Health: "health", Body: "body", Curious: "other", Fun: "other",
};
export const islandOf = (t: Tracker): IslandId => (t.cluster && CLUSTER[t.cluster]) || CATEGORY[t.category] || "other";

// Where islands sit: on the ball (lon/lat, a tight cluster so several fit in
// view) and on the flat map (in a 370×600 box). Busiest island takes slot 0.
export const SLOTS: { lon: number; lat: number; fx: number; fy: number }[] = [
  { lon: -13, lat: 15, fx: 104, fy: 140 }, { lon: 15, lat: 19, fx: 272, fy: 242 }, { lon: -15, lat: -5, fx: 96, fy: 350 },
  { lon: 15, lat: -3, fx: 272, fy: 446 }, { lon: -1, lat: -22, fx: 104, fy: 520 }, { lon: 32, lat: -22, fx: 276, fy: 560 },
  { lon: -34, lat: 6, fx: 70, fy: 250 }, { lon: 34, lat: 6, fx: 300, fy: 130 }, { lon: 0, lat: 33, fx: 190, fy: 60 },
];

export type Weather = "storm" | "clouds" | "sun" | null;

export interface Island {
  id: IslandId;
  def: IslandDef;
  trackerIds: string[];
  weather: Weather;
  /** hard days / answered days this week */
  hardDays: number;
  answeredDays: number;
  slot: (typeof SLOTS)[number];
}

/** k of n: the second question came on k of the n days the first one did */
export interface Route { a: IslandId; b: IslandId; k: number; n: number }

/** The islands that have questions, busiest first, with this week's weather. */
export const buildIslands = (trackers: Tracker[], entries: TrackerEntry[]): Island[] => {
  const live = trackers.filter((t) => !t.archived);
  const groups = new Map<IslandId, Tracker[]>();
  for (const t of live) {
    const id = islandOf(t);
    groups.set(id, [...(groups.get(id) ?? []), t]);
  }
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  const from = isoLocal(weekAgo);
  const list = [...groups.entries()].map(([id, ts]) => {
    const byId = new Map(ts.map((t) => [t.id, t]));
    const answered = new Set<string>(), hard = new Set<string>();
    for (const e of entries) {
      const t = byId.get(e.trackerId);
      if (!t || e.date < from) continue;
      answered.add(e.date);
      if (e.value === (t.problemWhen === "yes")) hard.add(e.date);
    }
    const ratio = answered.size ? hard.size / answered.size : 0;
    const weather: Weather = answered.size === 0 ? null : hard.size >= 3 && ratio >= .5 ? "storm" : hard.size >= 1 ? "clouds" : "sun";
    return { id, def: ISLAND_DEFS[id], trackerIds: ts.map((t) => t.id), weather, hardDays: hard.size, answeredDays: answered.size };
  });
  list.sort((x, y) => y.trackerIds.length - x.trackerIds.length);
  return list.slice(0, SLOTS.length).map((x, i) => ({ ...x, slot: SLOTS[i] }));
};

/** Sea routes: the strongest link found between questions on two different islands. */
export const buildRoutes = (trackers: Tracker[], entries: TrackerEntry[], islands: Island[]): Route[] => {
  const where = new Map<string, IslandId>();
  for (const isl of islands) for (const id of isl.trackerIds) where.set(id, isl.id);
  const seen = new Set<string>();
  const out: Route[] = [];
  for (const c of computeCorrelations(trackers, entries, 12)) {
    if (c.phi <= 0) continue;
    const a = where.get(c.trackerA.id), b = where.get(c.trackerB.id);
    if (!a || !b || a === b) continue;
    const key = [a, b].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    const n = c.counts.bothYes + c.counts.aYesBNo;
    out.push({ a, b, k: c.counts.bothYes, n });
  }
  return out.slice(0, 4);
};
