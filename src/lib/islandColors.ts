// Each island's colour (Aurora UX, Nov 2 2026: "если шаги разные — разные
// цвета"). Calm hues, never red. Used by the path coins, the evening cards
// and the Map, so a topic looks the same everywhere.
import type { CSSProperties } from "react";
import { isOwnIsland, type BuiltinIsland, type IslandId } from "@/lib/islands";
import { getOwnIslands } from "@/lib/ownIslands";

export const ISLAND_HSL: Record<BuiltinIsland, [number, number, number]> = {
  me: [262, 50, 60],
  love: [334, 60, 62],
  kids: [142, 42, 42],
  health: [172, 64, 36],
  body: [205, 70, 48],
  pet: [30, 68, 50],
  parents: [222, 52, 56],
  world: [190, 58, 38],
  work: [215, 30, 46],
  mine: [48, 70, 44],
  other: [24, 78, 55],
};

/** Her own islands take a colour from their icon. */
const ICON_HSL: Record<string, [number, number, number]> = {
  career: [215, 30, 46], home: [30, 55, 50], books: [48, 70, 44], music: [280, 40, 58], food: [18, 70, 54],
  coffee: [28, 40, 42], hobbies: [24, 78, 55], growth: [142, 42, 42], travel: [190, 58, 38], family: [222, 52, 56],
  love: [334, 60, 62], health: [172, 64, 36], fitness: [205, 70, 48], pets: [30, 68, 50], wellbeing: [262, 50, 60],
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
    "--p3-lip": `${h} ${Math.min(s + 6, 90)}% ${l - 15}%`,
    "--p3-ink": "#fff",
  } as CSSProperties;
};

/** "h s% l%" for hsl(... / alpha) in styles. */
export const islandHsl = (id: IslandId) => {
  const [h, s, l] = hslOf(id);
  return `${h} ${s}% ${l}%`;
};
