// Aurora UX step: the Map (Nov 1 2026). Her idea: your life as a world of
// islands. Each life area is an island; every question lands on one by its
// theme (the library cluster it came from, else its category). Weather over
// an island = how often its "hard" answer came this week. Pictures are her
// map set (marketing/brand/map-assets), shipped as small webp files.
import { Tracker, TrackerEntry } from "@/types/tracker";
import type { TFunction } from "i18next";
import { computeCorrelations, correlationFrame, isHighlySignificant, trackerPolarity, type CorrelationResult } from "@/lib/correlations";
import { isoLocal } from "@/lib/doors";
import { matchTemplateIdByTitle } from "@/lib/relatedQuestions";
import { LIFE_STREAMS } from "@/lib/lifeStreams";
import { getOwnIslands, LOOKS } from "@/lib/ownIslands";

const PICS = new Map(
  Object.entries(import.meta.glob("@/assets/map/*.webp", { eager: true, import: "default" }) as Record<string, string>)
    .map(([path, url]) => [path.split("/").pop()!.replace(".webp", ""), url]),
);
// Her night pack (Nov 2 2026): the same names, drawn for the night sea.
const NIGHT = new Map(
  Object.entries(import.meta.glob("@/assets/map-night/*.webp", { eager: true, import: "default" }) as Record<string, string>)
    .map(([path, url]) => [path.split("/").pop()!.replace(".webp", ""), url]),
);
/** Night on the new screens (classic keeps its own look). */
export const isNightMap = (): boolean =>
  typeof document !== "undefined" &&
  document.documentElement.getAttribute("data-theme") === "aurora" &&
  document.documentElement.getAttribute("data-ui") === "new";
/** A map picture for day or night (the globe loads the other one ahead). */
export const mapPicFor = (name: string, night: boolean): string => (night && NIGHT.get(name)) || PICS.get(name) || "";
export const mapPic = (name: string): string => mapPicFor(name, isNightMap());

export type BuiltinIsland = "me" | "love" | "kids" | "health" | "body" | "pet" | "parents" | "world" | "work" | "mine" | "other";
/** A built-in island, or one she made ("own-…"). */
export type IslandId = BuiltinIsland | `own-${string}`;

export interface IslandDef {
  id: IslandId;
  /** island base picture and what stands on it: [picture, width share, dx, dy] */
  base: string;
  land?: [string, number, number, number][];
  icon: string;
}

export const ISLAND_DEFS: Record<BuiltinIsland, IslandDef> = {
  me: { id: "me", base: "island_plain", land: [["flowering_bush", .4, .02, -.4]], icon: "wellbeing" },
  love: { id: "love", base: "island_plain", land: [["cherry_blossom_tree", .56, .04, -.44]], icon: "love" },
  kids: { id: "kids", base: "island_waterfall", icon: "growth" },
  health: { id: "health", base: "island_lotus", icon: "health" },
  body: { id: "body", base: "island_mountain", icon: "fitness" },
  pet: { id: "pet", base: "island_rocky", land: [["house", .56, .04, -.36]], icon: "pets" },
  parents: { id: "parents", base: "island_plain", land: [["orange_tree", .44, .04, -.46]], icon: "family" },
  world: { id: "world", base: "island_rocky", land: [["city_buildings", .58, 0, -.42], ["lighthouse", .3, .27, -.32]], icon: "travel" },
  // Nov 2 2026 (her ask: old questions onto islands, "если свои, то новый
  // остров… назови сам"): work questions get their own island, and the
  // questions she typed herself live on "My own".
  work: { id: "work", base: "island_rocky", land: [["city_buildings", .58, 0, -.42]], icon: "career" },
  mine: { id: "mine", base: "island_plain", land: [["camping_tent", .5, .02, -.3]], icon: "books" },
  other: { id: "other", base: "island_plain", land: [["palm_trees", .52, .02, -.46]], icon: "hobbies" },
};

export const isOwnIsland = (id: string): id is `own-${string}` => id.startsWith("own-");

/** Picture and icon of any island, hers included. */
export const islandDef = (id: IslandId): IslandDef => {
  if (!isOwnIsland(id)) return ISLAND_DEFS[id] ?? ISLAND_DEFS.other;
  const own = getOwnIslands().find((i) => i.id === id);
  const look = LOOKS[own?.look ?? "grove"] ?? LOOKS.grove;
  return { id, base: look.base, land: look.land, icon: own?.icon ?? "hobbies" };
};

/** The name she sees: built-in names in her language, her own as typed. */
export const islandName = (t: TFunction, id: IslandId): string =>
  isOwnIsland(id) ? getOwnIslands().find((i) => i.id === id)?.name ?? "" : t(`map.island.${id}`);

// Library cluster → island. Trackers made from a library card carry `cluster`.
const CLUSTER: Record<string, BuiltinIsland> = {
  partner: "love", "trending-argued": "love", "trending-wanted-child": "love",
  parenting: "kids", "child-wellbeing": "kids", "trending-yelled": "kids",
  health: "health",
  habits: "body", "trending-alcohol": "body",
  state: "me", "trending-cried": "me", "big-decisions": "me", growth: "me",
  pet: "pet",
  "elderly-parent": "parents",
  "external-events": "world", expat: "world",
};
const CATEGORY: Record<Tracker["category"], BuiltinIsland> = {
  Emotions: "me", Voice: "me", Connections: "love", Social: "love", Health: "health", Body: "body", Curious: "other", Fun: "other",
};
/** Movement lives on Body & habits (her note, Nov 6 2026: choosing "Movement" in
 *  onboarding brought up the Health island — "мужа выбесило"). */
export const BODY_TEMPLATES = new Set(["exercised"]);
export const WORK_TEMPLATES = new Set([
  "burned-out-after-work", "didnt-want-to-work", "worked-overtime", "felt-fulfilled-at-work", "boss-was-difficult",
  "conflict-with-colleague", "wanted-leave-job", "thought-career-change", "long-commute", "dealt-with-paperwork",
  "main-thing-done", "focus-hour",
]);
const STREAM_OF = new Map(LIFE_STREAMS.flatMap((st) => st.templates.map((tpl) => [tpl.id, st.id] as const)));
const islandCache = new Map<string, IslandId>();

/** Where a question lives. Her move wins; then work questions; then the
 *  library cluster it came from (found by its title when not stored); a
 *  question she typed herself goes to "My own". */
export const islandOf = (t: Tracker): IslandId => {
  if (t.island && (isOwnIsland(t.island) ? getOwnIslands().some((i) => i.id === t.island) : t.island in ISLAND_DEFS)) {
    return t.island as IslandId;
  }
  const key = `${t.title}|${t.cluster ?? ""}|${t.category}`;
  const hit = islandCache.get(key);
  if (hit) return hit;
  const tpl = matchTemplateIdByTitle(t.title);
  const id: IslandId =
    (tpl && WORK_TEMPLATES.has(tpl) && "work") ||
    (tpl && BODY_TEMPLATES.has(tpl) && "body") ||
    (t.cluster && CLUSTER[t.cluster]) ||
    (tpl && CLUSTER[STREAM_OF.get(tpl) ?? ""]) ||
    (!tpl ? "mine" : CATEGORY[t.category]) ||
    "other";
  islandCache.set(key, id);
  return id;
};

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
  /** this week's hard answers by question, most first: why the weather is what it is */
  hardBy: { trackerId: string; days: number }[];
  /** stormy in one of the four weeks before (a calm week now = a rainbow) */
  wasStormy: boolean;
  slot: (typeof SLOTS)[number];
}

/** k of n: the second question came on k of the n days the first one did
 *  (lag 1: the next day). First/second are tracker ids, in reading order.
 *  firstYes false: the days WITHOUT the first (her note, Nov 6 2026: "no walk →
 *  tired" read as "walk → tired"); secondYes false: the second did NOT come.
 *  other: the second (that same answer) on the rest of the days. */
export interface Route { a: IslandId; b: IslandId; k: number; n: number; first: string; second: string; nextDay: boolean; firstYes: boolean; secondYes: boolean; other: { k: number; n: number }; /** the counted answer is a hard one (red), a good one (green), or neither */ secondHard: boolean | null }

/** A pattern as she reads it. Together (phi > 0): "with A → B". Apart (phi < 0):
 *  the second is told by its hard answer, as a hard day is (WORLD-BIBLE): "without
 *  a walk → tired", "anxious → not slept enough". k of n counts those days; other
 *  counts the same second answer on the rest. */
export const linkOf = (c: CorrelationResult) => {
  const flip = c.lag === -1;
  const second0 = flip ? c.trackerA : c.trackerB;
  const secondYes = c.phi >= 0 || trackerPolarity(second0) !== "good";
  const firstYes = c.phi >= 0 || !secondYes;
  const { bothYes, aYesBNo, aNoBYes, bothNo } = c.counts;
  const cell = (a: boolean, b: boolean) => (a ? (b ? bothYes : aYesBNo) : b ? aNoBYes : bothNo);
  // in reading order: the first is A, or B when B came the day before
  const at = (f: boolean, s: boolean) => (flip ? cell(s, f) : cell(f, s));
  const k = at(firstYes, secondYes), ok = at(!firstYes, secondYes);
  const pol = trackerPolarity(second0);
  const secondHard = pol === "neutral" ? null : secondYes === (pol === "bad");
  return {
    first: flip ? c.trackerB : c.trackerA, second: second0, firstYes, secondYes, secondHard, nextDay: c.lag !== 0,
    k, n: k + at(firstYes, !secondYes), other: { k: ok, n: ok + at(!firstYes, !secondYes) },
  };
};

/** Worth showing as a link. Against intuition (a good thing before a hard one, a
 *  hard thing before a good one) only when it held many times: stable and
 *  p < 0.01. "Without" links only from the counted tiers (early and fresh count
 *  "both yes" only). */
export const linkWorthShowing = (c: CorrelationResult): boolean => {
  if (c.phi === 0) return false;
  if (correlationFrame(trackerPolarity(c.trackerA), trackerPolarity(c.trackerB), c.phi) === "unexpected") return c.stage === "stable" && isHighlySignificant(c.chiSquare);
  if (c.phi < 0) return c.stage === "stable" || c.stage === "emerging";
  return true;
};

/** A hard day's answer, the same rule as the lighthouses (WORLD-BIBLE, Nov 5
 *  2026): YES to a hard question, NO to a good one ("Slept 7+ hours?" — no). */
export const isHardAnswer = (t: Tracker, value: unknown): boolean => !isTestQuestion(t) && !isNeutralQuestion(t) && typeof value === "boolean" && value === (t.problemWhen === "yes");
/** A wish or a decision ("Wanted to quit", "Wanted a child"): no good or bad
 *  answer, so never a hard day; drawn in neutral indigo (Nov 6 2026). */
export const isNeutralQuestion = (t: Tracker): boolean => trackerPolarity(t) === "neutral";
/** A week's test asks "Did you…?" (src/lib/experiments.ts): a "no" there means
 *  she didn't try it that day, not that the day was hard. */
export const isTestQuestion = (t: Tracker) => t.id.endsWith("-test");

/** The islands that have questions, busiest first, with this week's
 *  weather. Honest weather (plan §3.5, Nov 2 2026): a hard day is a day with
 *  a hard answer (isHardAnswer); no weather before 3 answered days;
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
  for (const own of getOwnIslands()) if (!groups.has(own.id)) groups.set(own.id, []);
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
        if (isHardAnswer(t, e.value)) {
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
    const wasStormy = past.some((w) => w.hard.size >= 3);
    return {
      id, def: islandDef(id), trackerIds: ts.map((t) => t.id), weather,
      hardDays: now.hard.size, answeredDays: now.answered.size, usual,
      top: best ? { trackerId: best[0], days: best[1] } : null, wasStormy,
      hardBy: [...topCount].sort((x, y) => y[1] - x[1]).map(([trackerId, days]) => ({ trackerId, days })),
    };
  });

  list.sort((x, y) => y.trackerIds.length - x.trackerIds.length);
  return list.map((x, i) => ({ ...x, slot: SLOTS[i % SLOTS.length] }));
};

/** Sea routes: the strongest link found between questions on two different islands. */
export const buildRoutes = (trackers: Tracker[], entries: TrackerEntry[], islands: Island[]): Route[] => {
  const where = new Map<string, IslandId>();
  for (const isl of islands) for (const id of isl.trackerIds) where.set(id, isl.id);
  const seen = new Set<string>();
  const out: Route[] = [];
  for (const c of computeCorrelations(trackers, entries, 12)) {
    if (!linkWorthShowing(c)) continue;
    const l = linkOf(c);
    // islands in reading order: the first question's island, then the second's
    const a = where.get(l.first.id), b = where.get(l.second.id);
    if (!a || !b || a === b) continue;
    const key = [a, b].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ a, b, k: l.k, n: l.n, first: l.first.id, second: l.second.id, nextDay: l.nextDay, firstYes: l.firstYes, secondYes: l.secondYes, secondHard: l.secondHard, other: l.other });
  }
  return out.slice(0, 4);
};

/** The strongest link with both questions on the same island, one per island
 *  (board 75, Nov 6 2026): drawn as a dotted loop on that island. */
export const buildInnerLinks = (trackers: Tracker[], entries: TrackerEntry[], islands: Island[]): Map<IslandId, Route> => {
  const where = new Map<string, IslandId>();
  for (const isl of islands) for (const id of isl.trackerIds) where.set(id, isl.id);
  const out = new Map<IslandId, Route>();
  for (const c of computeCorrelations(trackers, entries, 24)) {
    if (!linkWorthShowing(c)) continue;
    const a = where.get(c.trackerA.id), b = where.get(c.trackerB.id);
    if (!a || a !== b || out.has(a)) continue;
    const l = linkOf(c);
    out.set(a, { a, b: a, k: l.k, n: l.n, first: l.first.id, second: l.second.id, nextDay: l.nextDay, firstYes: l.firstYes, secondYes: l.secondYes, secondHard: l.secondHard, other: l.other });
  }
  return out;
};

/** The links drawn as bridges (her note, Nov 3 2026: when is it a bridge,
 *  when a line?): strongest first, at most one per island (an island can
 *  sit beside one neighbour), at most `max`. Every other link lives in the
 *  island sheets. */
export const bridgesOf = (routes: Route[], max = 3): Route[] => {
  const used = new Set<IslandId>(), out: Route[] = [];
  for (const r of [...routes].sort((x, y) => y.k - x.k)) {
    if (out.length >= max) break;
    if (used.has(r.a) || used.has(r.b)) continue;
    used.add(r.a); used.add(r.b); out.push(r);
  }
  return out;
};
