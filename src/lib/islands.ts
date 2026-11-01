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
  /** this week against her own last four (null until two of them have answers) */
  usual: "rougher" | "usual" | "calmer" | null;
  /** the question that came up most this week, and on how many days */
  top: { trackerId: string; days: number } | null;
  slot: (typeof SLOTS)[number];
}

/** k of n: the second question came on k of the n days the first one did
 *  (lag 1: the next day). First/second are tracker ids, in reading order. */
export interface Route { a: IslandId; b: IslandId; k: number; n: number; first: string; second: string; nextDay: boolean }

/** The islands that have questions, busiest first, with this week's
 *  weather. Honest weather (plan §3.5, Nov 2 2026): a hard day is a day a
 *  problem question was answered YES; no weather before 3 answered days;
 *  3+ hard days = often (storm), 1-2 = sometimes (clouds), 0 = calm. */
export const buildIslands = (trackers: Tracker[], entries: TrackerEntry[]): Island[] => {
  const live = trackers.filter((t) => !t.archived && t.source !== "play");
  const groups = new Map<IslandId, Tracker[]>();
  for (const t of live) {
    const id = islandOf(t);
    groups.set(id, [...(groups.get(id) ?? []), t]);
  }
  const dayStart = (back: number) => {
    const d = new Date();
    d.setDate(d.getDate() - back);
    return isoLocal(d);
  };
  const list = [...groups.entries()].map(([id, ts]) => {
    const byId = new Map(ts.map((t) => [t.id, t]));
    // hard/answered days per week, week 0 = the last 7 days
    const weeks = Array.from({ length: 5 }, () => ({ answered: new Set<string>(), hard: new Set<string>() }));
    const topCount = new Map<string, number>();
    for (const e of entries) {
      const t = byId.get(e.trackerId);
      if (!t) continue;
      for (let w = 0; w < 5; w++) {
        if (e.date > dayStart(w * 7) || e.date < dayStart(w * 7 + 6)) continue;
        weeks[w].answered.add(e.date);
        if (t.problemWhen === "yes" && e.value === true) {
          weeks[w].hard.add(e.date);
          if (w === 0) topCount.set(t.id, (topCount.get(t.id) ?? 0) + 1);
        }
      }
    }
    const now = weeks[0];
    const weather: Weather = now.answered.size < 3 ? null : now.hard.size >= 3 ? "storm" : now.hard.size >= 1 ? "clouds" : "sun";
    const past = weeks.slice(1).filter((w) => w.answered.size >= 3);
    let usual: Island["usual"] = null;
    if (past.length >= 2 && now.answered.size >= 3) {
      const avg = past.reduce((sum, w) => sum + w.hard.size, 0) / past.length;
      usual = now.hard.size > avg + 1 ? "rougher" : now.hard.size < avg - 1 ? "calmer" : "usual";
    }
    const best = [...topCount.entries()].sort((x, y) => y[1] - x[1])[0];
    return {
      id, def: ISLAND_DEFS[id], trackerIds: ts.map((t) => t.id), weather,
      hardDays: now.hard.size, answeredDays: now.answered.size, usual,
      top: best ? { trackerId: best[0], days: best[1] } : null,
    };
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
    // lag -1: B the day before goes with A, so B is read first, and n
    // counts the days the first one came.
    const flip = c.lag === -1;
    const n = c.counts.bothYes + (flip ? c.counts.aNoBYes : c.counts.aYesBNo);
    out.push({ a, b, k: c.counts.bothYes, n, first: flip ? c.trackerB.id : c.trackerA.id, second: flip ? c.trackerA.id : c.trackerB.id, nextDay: c.lag !== 0 });
  }
  return out.slice(0, 4);
};
