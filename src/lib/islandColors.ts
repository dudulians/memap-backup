// Each island's colour (Aurora UX, Nov 2 2026: "если шаги разные — разные
// цвета"). Calm hues, never red. Used by the path coins, the evening cards
// and the Map, so a topic looks the same everywhere.
import type { CSSProperties } from "react";
import { isOwnIsland, type BuiltinIsland, type IslandId } from "@/lib/islands";
import { getOwnIslands } from "@/lib/ownIslands";

export const ISLAND_HSL: Record<BuiltinIsland, [number, number, number]> = {
  // Muted toward the sea-and-sky background (her note: "цвета слишком
  // насыщенные"), still telling the topics apart.
  me: [258, 30, 66],
  love: [338, 38, 68],
  kids: [145, 26, 50],
  health: [174, 38, 44],
  body: [204, 40, 56],
  pet: [28, 40, 58],
  parents: [222, 32, 62],
  world: [192, 34, 46],
  work: [214, 20, 54],
  mine: [42, 46, 56],
  other: [24, 46, 60],
};

/** Her own islands take a colour from their icon. */
const ICON_HSL: Record<string, [number, number, number]> = {
  career: [214, 20, 54], home: [28, 36, 58], books: [42, 46, 56], music: [282, 26, 64], food: [16, 44, 60],
  coffee: [28, 28, 50], hobbies: [24, 46, 60], growth: [145, 26, 50], travel: [192, 34, 46], family: [222, 32, 62],
  love: [338, 38, 68], health: [174, 38, 44], fitness: [204, 40, 56], pets: [28, 40, 58], wellbeing: [258, 30, 66],
};
const hslOf = (id: IslandId): [number, number, number] => {
  if (!isOwnIsland(id)) return ISLAND_HSL[id] ?? ISLAND_HSL.other;
  const icon = getOwnIslands().find((i) => i.id === id)?.icon ?? "hobbies";
  return ICON_HSL[icon] ?? ISLAND_HSL.other;
};

/** CSS variables that colour a Pressable (face, highlight, lip) in an island's hue. */
export const islandStyle = (id: IslandId): CSSProperties => {
  const [h, s, l] = hslOf(id);
  return {
    "--p3-face": `${h} ${s}% ${l}%`,
    "--p3-face-hi": `${h} ${s}% ${Math.min(l + 9, 80)}%`,
    "--p3-lip": `${h} ${Math.min(s + 6, 90)}% ${l - 13}%`,
    "--p3-ink": "#fff",
  } as CSSProperties;
};

/** "h s% l%" for hsl(... / alpha) in styles. */
export const islandHsl = (id: IslandId) => {
  const [h, s, l] = hslOf(id);
  return `${h} ${s}% ${l}%`;
};
