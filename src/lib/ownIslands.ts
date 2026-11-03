// Islands she makes herself (Aurora, Nov 2 2026; her words: "люди могут
// создавать свои топики, свои острова… в рамках острова тоже могут свои
// вопросы писать"). Spec: marketing/aurora-light-ux/SPEC-own-islands.md.
// Stored per install; a question joins an island through tracker.island.
// The classic screens ignore all of it.
import { Tracker } from "@/types/tracker";
import { getTrackers, saveTrackers } from "@/lib/storage";

export const ISLAND_ICONS = [
  "career", "home", "books", "music", "food", "coffee", "hobbies", "growth",
  "travel", "family", "love", "health", "fitness", "pets", "wellbeing",
] as const;
export type IslandIcon = (typeof ISLAND_ICONS)[number];

/** Island looks from her art: a base and what stands on it ([picture, width share, dx, dy]). */
export const LOOKS: Record<string, { base: string; land: [string, number, number, number][] }> = {
  town: { base: "island_rocky", land: [["city_buildings", 0.58, 0, -0.42]] },
  cottage: { base: "island_plain", land: [["house", 0.5, 0.04, -0.36]] },
  camp: { base: "island_plain", land: [["camping_tent", 0.5, 0.02, -0.3]] },
  zen: { base: "island_plain", land: [["zen_stones", 0.32, 0.02, -0.36]] },
  pines: { base: "island_rocky", land: [["pine_tree", 0.42, 0.06, -0.5]] },
  grove: { base: "island_plain", land: [["green_tree", 0.45, 0.04, -0.44]] },
  orchard: { base: "island_plain", land: [["orange_tree", 0.44, 0.04, -0.46]] },
  palms: { base: "island_plain", land: [["palm_trees", 0.52, 0.02, -0.46]] },
};
export const LOOK_NAMES = Object.keys(LOOKS);

/** The look that suits an icon, until she picks another. */
export const lookForIcon = (icon: IslandIcon): string =>
  icon === "career" ? "town"
  : ["home", "family", "coffee", "pets"].includes(icon) ? "cottage"
  : ["music", "travel"].includes(icon) ? "camp"
  : ["health", "wellbeing"].includes(icon) ? "zen"
  : icon === "fitness" ? "pines"
  : icon === "books" || icon === "hobbies" ? "orchard"
  : "grove";

/** The icon a name suggests (EN + RU stems), or null. */
const KEYWORDS: [IslandIcon, string[]][] = [
  ["career", ["work", "job", "office", "boss", "работ", "карьер", "офис"]],
  ["home", ["home", "flat", "дом", "квартир", "ремонт"]],
  ["books", ["book", "read", "study", "school", "книг", "чтени", "учёб", "учеб"]],
  ["music", ["music", "guitar", "piano", "музык", "гитар"]],
  ["food", ["food", "eat", "diet", "cook", "еда", "питани", "готов"]],
  ["coffee", ["coffee", "tea", "кофе", "чай"]],
  ["hobbies", ["hobby", "art", "draw", "хобби", "рисова"]],
  ["growth", ["goal", "learn", "цел", "развити"]],
  ["travel", ["travel", "trip", "flight", "путешеств", "поездк"]],
  ["family", ["family", "friend", "mom", "dad", "семь", "друз", "мам", "пап"]],
  ["love", ["love", "partner", "date", "любов", "муж", "жена", "свидан"]],
  ["health", ["health", "doctor", "pills", "здоров", "врач"]],
  ["fitness", ["gym", "sport", "run", "yoga", "спорт", "зал", "бег", "йог"]],
  ["pets", ["dog", "cat", "pet", "собак", "кот", "кош", "питом"]],
  ["wellbeing", ["sleep", "rest", "сон", "отдых"]],
];
export const iconForName = (name: string): IslandIcon | null => {
  const n = name.toLowerCase();
  for (const [icon, words] of KEYWORDS) if (words.some((w) => n.includes(w))) return icon;
  return null;
};

export interface OwnIsland {
  id: `own-${string}`;
  name: string;
  icon: IslandIcon;
  look: string;
}

const KEY = "memap_islands";
export const MAX_OWN = 6;

export const getOwnIslands = (): OwnIsland[] => {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};
const saveOwn = (list: OwnIsland[]) => {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("memap-islands-changed"));
};

export const createIsland = (name: string, icon: IslandIcon, look: string): OwnIsland => {
  const island: OwnIsland = { id: `own-${Date.now().toString(36)}`, name: name.trim().slice(0, 20), icon, look };
  saveOwn([...getOwnIslands(), island]);
  return island;
};

export const updateIsland = (id: string, patch: Partial<Omit<OwnIsland, "id">>) => {
  saveOwn(getOwnIslands().map((i) => (i.id === id ? { ...i, ...patch } : i)));
};

/** Deleting an island sends its questions back to where they came from. */
export const deleteIsland = async (id: string) => {
  saveOwn(getOwnIslands().filter((i) => i.id !== id));
  const trackers = await getTrackers();
  if (trackers.some((t) => t.island === id)) {
    await saveTrackers(trackers.map((t) => (t.island === id ? { ...t, island: undefined } : t)));
  }
};

/** Move a question to an island (undefined = back to its own place). */
export const setTrackerIsland = async (trackerId: string, island: string | undefined) => {
  const trackers = await getTrackers();
  await saveTrackers(trackers.map((t: Tracker) => (t.id === trackerId ? { ...t, island } : t)));
  window.dispatchEvent(new Event("memap-settings-changed"));
};

/** Take a question off her list (her ask: "дать возможность удалять").
 *  It is archived, so her answers stay and Settings can bring it back. */
export const removeQuestion = async (trackerId: string) => {
  const trackers = await getTrackers();
  await saveTrackers(trackers.map((t: Tracker) => (t.id === trackerId ? { ...t, archived: true } : t)));
  window.dispatchEvent(new Event("memap-settings-changed"));
};

/** A question she writes on an island (her own words, never rewritten).
 *  "?" and a capital first letter are added; whether YES is a hard day is
 *  her pick, never guessed. A rule (when it's time to act) and her plan
 *  only if she chose one (src/lib/rules.ts); else none. */
export const addQuestionToIsland = async (
  text: string,
  island: string,
  hardWhenYes: boolean,
  rule: { threshold: number; periodDays: number } = { threshold: 0, periodDays: 30 },
  plan = "",
): Promise<string> => {
  const existing = await getTrackers();
  let q = text.trim().replace(/\s+/g, " ");
  q = q.charAt(0).toUpperCase() + q.slice(1);
  if (!/[?？]$/.test(q)) q += "?";
  const tracker: Tracker = {
    id: `${Date.now()}-own`,
    title: q.replace(/[?？]+$/, "").slice(0, 60),
    category: "Curious",
    questionText: q,
    answerType: "boolean",
    periodDays: rule.periodDays,
    threshold: rule.threshold,
    problemWhen: hardWhenYes ? "yes" : "no",
    adviceAboveThreshold: rule.threshold ? plan.trim() : "",
    createdAt: new Date().toISOString(),
    sortIndex: existing.length,
    island,
  };
  await saveTrackers([...existing, tracker]);
  window.dispatchEvent(new Event("memap-settings-changed"));
  return tracker.id;
};
