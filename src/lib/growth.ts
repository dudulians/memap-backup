// Your world grows with what you really do (her ideas, Nov 2 2026: "чтобы
// карта отражала реальное развитие: начал исследовать сон — на острове
// появился домик; провёл эксперимент — сад; нашёл связь с другой сферой —
// мост"; plus special items and a new mission each week). Everything here is
// worked out from her answers, notes, guesses and tests, nothing is bought:
//   island growth — a little house (3 days on that island), flowers (7),
//                   a garden (a finished test there), a flag (30);
//   bridges       — between two islands once a link between them is found;
//   special items — milestones (first week, first link, 10 notes…), each one
//                   a picture from her set, kept for good on her shelf in
//                   You (Nov 3 2026, her note: "куда они идут?");
//   mission       — what to go for next week, said in the chest.
import { Tracker, TrackerEntry } from "@/types/tracker";
import { islandOf, type Island, type IslandId, type Route } from "@/lib/islands";
import { countedDays, getChests } from "@/lib/pathSteps";
import { eveningStreak } from "@/lib/eveningPath";
import { finishedExperiments, currentExperiment, experimentDay } from "@/lib/experiments";
import { getOwnIslands } from "@/lib/ownIslands";
import { getHunches } from "@/lib/hunches";
import { isoLocal } from "@/lib/doors";

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

// Treasures are kept for good: the day each was first earned is stored, so
// one never vanishes (fewer notes after a clean-up, a broken streak) and
// never comes back as new.
const KEPT = "memap_treasures";
const SEEN = "memap_treasures_seen";
const readJson = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; } };
/** The treasures she has, with the day each came. */
export const keptTreasures = (): Partial<Record<ItemId, string>> => readJson(KEPT, {});
/** Keeps the ones earned now; call it wherever the facts are worked out. */
export const syncTreasures = (f: WorldFacts): void => {
  const kept = keptTreasures();
  let changed = false;
  const today = isoLocal(new Date());
  for (const it of ITEMS) if (!kept[it.id] && itemEarned(it.id, f)) { kept[it.id] = today; changed = true; }
  if (changed) { try { localStorage.setItem(KEPT, JSON.stringify(kept)); } catch { /* shown, not kept */ } }
};
/** She has it: kept, or earned right now. */
export const owned = (id: ItemId, f: WorldFacts): boolean => !!keptTreasures()[id] || itemEarned(id, f);
/** Treasures she hasn't seen on her shelf yet (the first look counts all as seen). */
export const unseenTreasures = (f: WorldFacts): ItemId[] => {
  const have = ITEMS.filter((it) => owned(it.id, f)).map((it) => it.id);
  const seen = readJson<ItemId[] | null>(SEEN, null);
  if (!seen) {
    // the first look: everything she had before is seen, except what the
    // last chest just announced
    const last = Object.values(getChests()).sort((a, b) => (a.openedAt ?? "").localeCompare(b.openedAt ?? "")).pop();
    const news = new Set(last?.fresh?.items ?? []);
    try { localStorage.setItem(SEEN, JSON.stringify(have.filter((id) => !news.has(id)))); } catch { /* ignore */ }
    return have.filter((id) => news.has(id));
  }
  return have.filter((id) => !seen.includes(id));
};
export const markTreasuresSeen = (f: WorldFacts): void => {
  try { localStorage.setItem(SEEN, JSON.stringify(ITEMS.filter((it) => owned(it.id, f)).map((it) => it.id))); } catch { /* ignore */ }
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

// --- Treasures on the map ----------------------------------------------------
// WORLD-BIBLE "Решения 5 ноября" #8 (Nov 5 2026): a treasure stands on an
// island, in one of three places — over it (balloon, plane, rainbow, stars) or
// on its left or right shore (camera, signpost, books, easel, bicycle). The
// island is the one it belongs to when there is one (the rainbow over the
// island that turned calm, the easel where her test was, the signpost on her
// own island, the camera where her first link starts, the stars where her
// hunch was); otherwise the island she answers most. Once chosen it is kept,
// so a treasure never moves. The next one to come stands there pale, with how
// to get it in the island's card.

export type TreasureSlot = "sky" | "left" | "right";
export interface PlacedTreasure { id: ItemId; pic: string; slot: TreasureSlot; ghost: boolean }
const SKY_ITEMS: ItemId[] = ["balloon", "airplane", "rainbow", "sparkles"];
const HOSTS = "memap_treasure_islands";

export const placeTreasures = ({ islands, days, facts, routes, trackers }: {
  /** the islands on the map */
  islands: IslandId[];
  /** evenings answered on each island */
  days: Record<string, number>;
  facts: WorldFacts;
  routes: Route[];
  trackers: Tracker[];
}): Map<IslandId, PlacedTreasure[]> => {
  const out = new Map<IslandId, PlacedTreasure[]>();
  if (islands.length === 0) return out;
  const busiest = [...islands].sort((a, b) => (days[b] ?? 0) - (days[a] ?? 0));
  const hosts = readJson<Partial<Record<ItemId, IslandId>>>(HOSTS, {});
  const own = (id: ItemId): IslandId | undefined => {
    switch (id) {
      case "rainbow": return facts.cleared ?? undefined;
      case "easel": return finishedExperiments()[0]?.island as IslandId | undefined;
      case "signpost": return getOwnIslands()[0]?.id;
      case "camera": return routes[0]?.a;
      case "sparkles": {
        const h = getHunches().find((x) => x.seen);
        const tr = h && trackers.find((x) => x.id === h.suspect);
        return tr ? islandOf(tr) : undefined;
      }
      default: return undefined;
    }
  };
  const free = (isl: IslandId, id: ItemId): TreasureSlot | null => {
    const taken = new Set((out.get(isl) ?? []).map((x) => x.slot));
    if (SKY_ITEMS.includes(id)) return taken.has("sky") ? null : "sky";
    return !taken.has("left") ? "left" : !taken.has("right") ? "right" : null;
  };
  const put = (id: ItemId, ghost: boolean): IslandId | null => {
    const want = [hosts[id], own(id), ...busiest].filter((x): x is IslandId => !!x && islands.includes(x));
    for (const isl of want) {
      const slot = free(isl, id);
      if (!slot) continue;
      out.set(isl, [...(out.get(isl) ?? []), { id, pic: ITEMS.find((it) => it.id === id)!.pic, slot, ghost }]);
      return isl;
    }
    return null;
  };
  let changed = false;
  // the ones that belong to an island take their places first
  const order = [...ITEMS].sort((x, y) => Number(!own(x.id)) - Number(!own(y.id)));
  for (const it of order) {
    if (!owned(it.id, facts)) continue;
    const isl = put(it.id, false);
    if (isl && hosts[it.id] !== isl) { hosts[it.id] = isl; changed = true; }
  }
  if (changed) { try { localStorage.setItem(HOSTS, JSON.stringify(hosts)); } catch { /* placed, not kept */ } }
  // the next one to come, pale
  const next = ITEMS.filter((it) => !owned(it.id, facts))
    .map((it) => ({ id: it.id, p: itemProgress(it.id, facts) }))
    .sort((a, b) => b.p[0] / b.p[1] - a.p[0] / a.p[1])[0];
  if (next) put(next.id, true);
  return out;
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
