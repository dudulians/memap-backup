// Each island's colour (Aurora UX, Nov 2 2026: "если шаги разные — разные
// цвета"). Calm hues, never red. Used by the path coins, the evening cards
// and the Map, so a topic looks the same everywhere.
import type { CSSProperties } from "react";
import type { IslandId } from "@/lib/islands";

export const ISLAND_HSL: Record<IslandId, [number, number, number]> = {
  me: [262, 50, 60],
  love: [334, 60, 62],
  kids: [142, 42, 42],
  health: [172, 64, 36],
  body: [205, 70, 48],
  pet: [30, 68, 50],
  parents: [222, 52, 56],
  world: [190, 58, 38],
  other: [24, 78, 55],
};

/** CSS variables that colour a Pressable (face, highlight, lip) in an island's hue. */
export const islandStyle = (id: IslandId): CSSProperties => {
  const [h, s, l] = ISLAND_HSL[id];
  return {
    "--p3-face": `${h} ${s}% ${l}%`,
    "--p3-face-hi": `${h} ${s}% ${Math.min(l + 9, 80)}%`,
    "--p3-lip": `${h} ${Math.min(s + 6, 90)}% ${l - 15}%`,
    "--p3-ink": "#fff",
  } as CSSProperties;
};

/** "h s% l%" for hsl(... / alpha) in styles. */
export const islandHsl = (id: IslandId) => {
  const [h, s, l] = ISLAND_HSL[id];
  return `${h} ${s}% ${l}%`;
};
