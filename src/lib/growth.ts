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
import { countedDays, getChests, unloadDays } from "@/lib/pathSteps";
import { eveningStreak } from "@/lib/eveningPath";
import { finishedExperiments, currentExperiment, experimentDay } from "@/lib/experiments";
import { getOwnIslands } from "@/lib/ownIslands";
import { getHunches } from "@/lib/hunches";
import { isoLocal } from "@/lib/doors";
import { track } from "@/lib/analytics";

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

export type ItemId = "balloon" | "camera" | "signpost" | "books" | "sparkles" | "bicycle" | "easel" | "rainbow" | "airplane"
  // from her pack, Nov 5 2026 ("возьми все возможные трежерс")
  | "moon" | "chest" | "zen" | "lavender" | "house" | "tent" | "suitcase";
export const ITEMS: { id: ItemId; pic: string }[] = [
  { id: "balloon", pic: "hot_air_balloon" }, // a first full week
  { id: "camera", pic: "camera" }, // 3 evenings in a row (Nov 7 2026: never a gift for a link — "орали на ребёнка → камера")
  { id: "signpost", pic: "wooden_signpost" }, // a new island opened
  { id: "books", pic: "books" }, // 10 notes
  { id: "sparkles", pic: "sparkles" }, // a first hunch checked
  { id: "easel", pic: "art_easel" }, // a first test finished
  { id: "bicycle", pic: "bicycle" }, // 14 days in a row
  { id: "rainbow", pic: "rainbow" }, // a stormy island turned calm
  { id: "airplane", pic: "airplane" }, // 60 days
  { id: "moon", pic: "moon_and_stars" }, // 7 evenings in a row
  { id: "chest", pic: "chest_open_map" }, // a first week's report opened
  { id: "zen", pic: "zen_stones" }, // a calm week on an island
  { id: "lavender", pic: "lavender" }, // bubbles popped on 7 days
  { id: "house", pic: "house" }, // an island fully grown (21 evenings)
  { id: "tent", pic: "camping_tent" }, // 30 days
  { id: "suitcase", pic: "travel_suitcase" }, // 100 days
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
  /** week reports opened */
  reports: number;
  /** an island with a calm week now */
  calm: IslandId | null;
  /** the island with the most evenings, and how many */
  top: IslandId | null;
  topDays: number;
  /** days she popped bubbles */
  unloads: number;
}

export const itemEarned = (id: ItemId, f: WorldFacts): boolean => {
  switch (id) {
    case "balloon": return f.days >= 7;
    case "camera": return f.streak >= 3;
    case "signpost": return f.ownIslands >= 1;
    case "books": return f.notes >= 10;
    case "sparkles": return f.hunches >= 1;
    case "easel": return f.tests >= 1;
    case "bicycle": return f.streak >= 14;
    case "rainbow": return f.cleared !== null;
    case "airplane": return f.days >= 60;
    case "moon": return f.streak >= 7;
    case "chest": return f.reports >= 1;
    case "zen": return f.calm !== null;
    case "lavender": return f.unloads >= 7;
    case "house": return f.topDays >= 21;
    case "tent": return f.days >= 30;
    case "suitcase": return f.days >= 100;
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
  const fresh = !!Object.keys(kept).length;
  for (const it of ITEMS) if (!kept[it.id] && itemEarned(it.id, f)) { kept[it.id] = today; changed = true; if (fresh) track("treasure_earned", { id: it.id }); }
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
    case "camera": return [Math.min(f.streak, 3), 3];
    case "signpost": return [Math.min(f.ownIslands, 1), 1];
    case "books": return [Math.min(f.notes, 10), 10];
    case "sparkles": return [Math.min(f.hunches, 1), 1];
    case "easel": return [Math.min(f.tests, 1), 1];
    case "bicycle": return [Math.min(f.streak, 14), 14];
    case "rainbow": return [f.cleared ? 1 : 0, 1];
    case "airplane": return [Math.min(f.days, 60), 60];
    case "moon": return [Math.min(f.streak, 7), 7];
    case "chest": return [Math.min(f.reports, 1), 1];
    case "zen": return [f.calm ? 1 : 0, 1];
    case "lavender": return [Math.min(f.unloads, 7), 7];
    case "house": return [Math.min(f.topDays, 21), 21];
    case "tent": return [Math.min(f.days, 30), 30];
    case "suitcase": return [Math.min(f.days, 100), 100];
  }
};

/** Facts for the items, from what's stored. The notes count comes in. */
export const worldFacts = (trackers: Tracker[], entries: TrackerEntry[], islands: Island[], routes: Route[], notes: number): WorldFacts => {
  const days = countedDays(trackers, entries);
  const cleared = islands.find((i) => i.weather === "sun" && i.wasStormy)?.id ?? null;
  const byIsland = [...islandDays(trackers, entries).entries()].sort((a, b) => b[1] - a[1]);
  return {
    days: days.length,
    streak: eveningStreak(days),
    links: routes.length,
    ownIslands: getOwnIslands().length,
    notes,
    hunches: getHunches().filter((h) => h.seen).length,
    tests: finishedExperiments().length,
    cleared,
    reports: Object.keys(getChests()).length,
    calm: islands.find((i) => i.weather === "sun")?.id ?? null,
    top: byIsland[0]?.[0] ?? null,
    topDays: byIsland[0]?.[1] ?? 0,
    unloads: unloadDays(),
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

// Nov 5 2026 (her pack, all of it): every treasure stands on a ground spot of its
// island picture (src/lib/islandSpots.ts) — left, right, front, or back for the
// big ones (house, tent) — or in its sky (plane, rainbow, stars, moon). At most
// three on one island, so it never turns into a shop window; the rest wait on
// her shelf in You, and the next free island takes the next one.
export type TreasureSlot = "sky" | "left" | "right" | "front" | "back";
export interface PlacedTreasure { id: ItemId; pic: string; slot: TreasureSlot; ghost: boolean }
// the balloon stands on the island, landed (her note, Nov 5 2026: things "левитируют")
const SKY_ITEMS: ItemId[] = ["airplane", "rainbow", "sparkles", "moon"];
const BIG_ITEMS: ItemId[] = ["house", "tent"];
const MAX_ON_ISLAND = 3;
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
      case "house": return facts.topDays >= 21 ? facts.top ?? undefined : undefined;
      case "zen": return facts.calm ?? undefined;
      case "sparkles": {
        const h = getHunches().find((x) => x.seen);
        const tr = h && trackers.find((x) => x.id === h.suspect);
        return tr ? islandOf(tr) : undefined;
      }
      default: return undefined;
    }
  };
  const free = (isl: IslandId, id: ItemId): TreasureSlot | null => {
    const here = out.get(isl) ?? [];
    if (here.length >= MAX_ON_ISLAND) return null;
    const taken = new Set(here.map((x) => x.slot));
    if (SKY_ITEMS.includes(id)) return taken.has("sky") ? null : "sky";
    const order: TreasureSlot[] = BIG_ITEMS.includes(id) ? ["back", "front"] : ["left", "right", "front"];
    return order.find((s) => !taken.has(s)) ?? null;
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

/** Her garden: a tree for each test she finished, on the island it was about
 *  ("провёл эксперимент — сад", her note, Nov 2 2026). Two at most on one island. */
const TREES = ["green_tree", "orange_tree", "pine_tree", "cherry_blossom_tree"];
export const gardenTrees = (islands: IslandId[]): Map<IslandId, string[]> => {
  const out = new Map<IslandId, string[]>();
  finishedExperiments().forEach((x, i) => {
    const isl = x.island as IslandId;
    if (!islands.includes(isl)) return;
    const list = out.get(isl) ?? [];
    if (list.length < 2) out.set(isl, [...list, TREES[i % TREES.length]]);
  });
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
