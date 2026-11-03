// Your world grows with what you really do (her ideas, Nov 2 2026: "чтобы
// карта отражала реальное развитие: начал исследовать сон — на острове
// появился домик; провёл эксперимент — сад; нашёл связь с другой сферой —
// мост"; plus special items and a new mission each week). Everything here is
// worked out from her answers, notes, guesses and tests, nothing is bought:
//   island growth — a little house (3 days on that island), flowers (7),
//                   a garden (a finished test there), a flag (30);
//   bridges       — between two islands once a link between them is found;
//   special items — milestones (first week, first link, 10 notes…), each one
//                   a picture from her set that then stays on the map;
//   mission       — what to go for next week, said in the chest.
import { Tracker, TrackerEntry } from "@/types/tracker";
import { islandOf, type Island, type IslandId, type Route } from "@/lib/islands";
import { countedDays, getChests } from "@/lib/pathSteps";
import { eveningStreak } from "@/lib/eveningPath";
import { finishedExperiments, currentExperiment, experimentDay } from "@/lib/experiments";
import { getOwnIslands } from "@/lib/ownIslands";
import { getHunches } from "@/lib/hunches";

// --- Island growth ---------------------------------------------------------

export type GrowthKind = "house" | "flowers" | "garden" | "flag";
export const GROWTH_AT: Record<Exclude<GrowthKind, "garden">, number> = { house: 3, flowers: 7, flag: 30 };

/** Days she answered something on each island (all time). */
export const islandDays = (trackers: Tracker[], entries: TrackerEntry[]): Map<IslandId, number> => {
  const where = new Map(trackers.filter((t) => !t.archived && t.source !== "play").map((t) => [t.id, islandOf(t)]));
  const days = new Map<IslandId, Set<string>>();
  for (const e of entries) {
    const id = where.get(e.trackerId);
    if (!id) continue;
    if (!days.has(id)) days.set(id, new Set());
    days.get(id)!.add(e.date);
  }
  return new Map([...days.entries()].map(([id, s]) => [id, s.size]));
};

/** What has grown on an island. */
export const growthOf = (id: IslandId, days: number): GrowthKind[] => {
  const out: GrowthKind[] = [];
  if (days >= GROWTH_AT.house) out.push("house");
  if (days >= GROWTH_AT.flowers) out.push("flowers");
  if (finishedExperiments().some((x) => x.island === id)) out.push("garden");
  if (days >= GROWTH_AT.flag) out.push("flag");
  return out;
};

/** An island whose landmark is already a house grows a tent instead. */
export const homeWord = (land: [string, number, number, number][] = []): "house" | "tent" =>
  land.some(([n]) => n === "house" || n === "city_buildings") ? "tent" : "house";

/** Pictures for the growth, placed on the island picture: [picture, width
 *  share, dx, dy] like IslandDef.land. "back" pieces stand behind the
 *  island's own landmark, "front" ones before it. An island that already
 *  has a house gets a tent. */
export const growthLand = (kinds: GrowthKind[], land: [string, number, number, number][] = []) => {
  const hasHouse = land.some(([n]) => n === "house" || n === "city_buildings");
  const back: [string, number, number, number][] = [];
  const front: [string, number, number, number][] = [];
  // The flag stands on the land behind the landmark, clear of the lighthouse (left).
  if (kinds.includes("flag")) back.push(["marker_flag", 0.15, 0.17, -0.3]);
  if (kinds.includes("garden")) {
    back.push(["orange_tree", 0.25, 0.33, -0.33]);
    front.push(["lavender", 0.2, -0.04, -0.05]);
  }
  if (kinds.includes("house")) front.push([hasHouse ? "camping_tent" : "house", 0.25, 0.3, -0.17]);
  if (kinds.includes("flowers")) front.push(["flowering_bush", 0.2, -0.31, -0.1]);
  return { back, front };
};

// --- Special items ---------------------------------------------------------

export type ItemId = "balloon" | "camera" | "signpost" | "books" | "sparkles" | "bicycle" | "easel" | "rainbow" | "airplane";
export const ITEMS: { id: ItemId; pic: string }[] = [
  { id: "balloon", pic: "hot_air_balloon" }, // a first full week
  { id: "camera", pic: "camera" }, // a first link found
  { id: "signpost", pic: "wooden_signpost" }, // a new island opened
  { id: "books", pic: "books" }, // 10 notes
  { id: "sparkles", pic: "sparkles" }, // a first hunch checked
  { id: "easel", pic: "art_easel" }, // a first test finished
  { id: "bicycle", pic: "bicycle" }, // 14 days in a row
  { id: "rainbow", pic: "rainbow" }, // a stormy island turned calm
  { id: "airplane", pic: "airplane" }, // 60 days
];

export interface WorldFacts {
  days: number;
  streak: number;
  links: number;
  ownIslands: number;
  notes: number;
  /** hunches she has seen checked */
  hunches: number;
  tests: number;
  /** an island that was stormy in an earlier week and is calm now */
  cleared: IslandId | null;
}

export const itemEarned = (id: ItemId, f: WorldFacts): boolean => {
  switch (id) {
    case "balloon": return f.days >= 7;
    case "camera": return f.links >= 1;
    case "signpost": return f.ownIslands >= 1;
    case "books": return f.notes >= 10;
    case "sparkles": return f.hunches >= 1;
    case "easel": return f.tests >= 1;
    case "bicycle": return f.streak >= 14;
    case "rainbow": return f.cleared !== null;
    case "airplane": return f.days >= 60;
  }
};

/** How far along to the next item, for "next up" lines: [now, goal]. */
export const itemProgress = (id: ItemId, f: WorldFacts): [number, number] => {
  switch (id) {
    case "balloon": return [Math.min(f.days, 7), 7];
    case "camera": return [Math.min(f.links, 1), 1];
    case "signpost": return [Math.min(f.ownIslands, 1), 1];
    case "books": return [Math.min(f.notes, 10), 10];
    case "sparkles": return [Math.min(f.hunches, 1), 1];
    case "easel": return [Math.min(f.tests, 1), 1];
    case "bicycle": return [Math.min(f.streak, 14), 14];
    case "rainbow": return [f.cleared ? 1 : 0, 1];
    case "airplane": return [Math.min(f.days, 60), 60];
  }
};

/** Facts for the items, from what's stored. The notes count comes in. */
export const worldFacts = (trackers: Tracker[], entries: TrackerEntry[], islands: Island[], routes: Route[], notes: number): WorldFacts => {
  const days = countedDays(trackers, entries);
  const cleared = islands.find((i) => i.weather === "sun" && i.wasStormy)?.id ?? null;
  return {
    days: days.length,
    streak: eveningStreak(days),
    links: routes.length,
    ownIslands: getOwnIslands().length,
    notes,
    hunches: getHunches().filter((h) => h.seen).length,
    tests: finishedExperiments().length,
    cleared,
  };
};

// --- Mission ------------------------------------------------------------------

export type Mission =
  | { id: "test" }
  | { id: "testRunning"; day: number }
  | { id: "newIsland" }
  | { id: "notes"; left: number }
  | { id: "streak"; goal: number };

/** Next week's mission: try a change first, then widen the map, then habits. */
export const nextMission = (f: WorldFacts, islandsWithDays: number): Mission => {
  const running = currentExperiment();
  if (running) return { id: "testRunning", day: Math.min(experimentDay(running), 7) };
  if (f.tests === 0) return { id: "test" };
  if (islandsWithDays < 3 && f.ownIslands === 0) return { id: "newIsland" };
  if (f.notes < 10) return { id: "notes", left: Math.min(3, 10 - f.notes) };
  return { id: "streak", goal: f.streak < 7 ? 7 : 14 };
};

/** What the last opened chest already showed, to tell what is new since. */
export const lastWorld = (): { growth: string[]; items: string[]; bridges: string[] } => {
  const all = getChests();
  const weeks = Object.keys(all).map(Number).sort((a, b) => b - a);
  for (const w of weeks) if (all[w].world) return all[w].world!;
  return { growth: [], items: [], bridges: [] };
};
