// Where things stand on each island picture (her note, Nov 5 2026: the flags and
// treasures "левитируют над островом"). A spot is the point where an item's base
// touches the ground, in % of the picture's width and height; the item stands on
// it with a soft shadow (index.css ".stand"). Picked on a 10% grid over every
// picture (marketing/tools/aurora-tests/island-spots-sheet.mjs).
//   flag: stage 4 · light: her lit rule (the lighthouse) · left/right: treasures
export type SpotKind = "flag" | "light" | "left" | "right" | "front" | "back" | "g1" | "g2";
type Spots = Record<SpotKind, [number, number]>;
//   front: before the island on its sand · back: high ground behind (a house, a tent)
//   g1, g2: her garden (a tree for each finished test), Nov 5 2026

const SPOTS: Record<string, Spots> = {
  "03_flower_hill": { flag: [52, 14], light: [84, 62], left: [26, 66], right: [68, 72], front: [46, 80], back: [36, 30], g1: [16, 58], g2: [80, 46] },
  "04_twin_hills": { flag: [58, 12], light: [86, 58], left: [24, 66], right: [72, 70], front: [48, 80], back: [32, 34], g1: [14, 60], g2: [82, 46] },
  "05_wide_meadow": { flag: [63, 12], light: [88, 58], left: [22, 66], right: [74, 70], front: [48, 80], back: [26, 30], g1: [12, 58], g2: [84, 48] },
  "06_snow_peak": { flag: [48, 7], light: [86, 64], left: [20, 66], right: [72, 72], front: [46, 80], back: [30, 48], g1: [12, 60], g2: [84, 52] },
  "09_waterfall": { flag: [70, 16], light: [28, 24], left: [14, 64], right: [86, 64], front: [30, 80], back: [44, 18], g1: [10, 52], g2: [92, 50] },
  "10_terraced_garden": { flag: [50, 14], light: [84, 66], left: [22, 68], right: [66, 76], front: [44, 84], back: [34, 38], g1: [14, 58], g2: [84, 52] },
  "11_sakura": { flag: [22, 72], light: [80, 70], left: [36, 82], right: [66, 84], front: [50, 90], back: [62, 68], g1: [12, 76], g2: [88, 74] },
  "14_stone_arch": { flag: [52, 10], light: [74, 14], left: [22, 76], right: [84, 66], front: [30, 84], back: [63, 9], g1: [12, 70], g2: [34, 62] },
  "16_cozy_cottage": { flag: [44, 10], light: [86, 64], left: [18, 72], right: [64, 80], front: [44, 86], back: [72, 50], g1: [10, 62], g2: [78, 56] },
  // her note (Nov 5 2026): Me looked strange with the flag over the arch: on the grass by the cypress now
  "17_lavender_garden": { flag: [80, 50], light: [88, 66], left: [26, 80], right: [64, 80], front: [46, 88], back: [30, 40], g1: [12, 64], g2: [70, 58] },
  // her note: the lighthouse on the top of Body; the flag goes to the side
  "19_grassy_terraces": { flag: [84, 60], light: [48, 14], left: [18, 68], right: [44, 82], front: [62, 86], back: [30, 36], g1: [10, 60], g2: [74, 40] },
  "20_tropical_palms": { flag: [22, 68], light: [84, 70], left: [40, 88], right: [68, 80], front: [56, 90], back: [50, 62], g1: [12, 74], g2: [90, 78] },
  "24_oak_tree": { flag: [24, 66], light: [80, 66], left: [30, 80], right: [68, 82], front: [50, 90], back: [60, 64], g1: [12, 72], g2: [88, 72] },
  "26_flowery_island": { flag: [52, 14], light: [86, 60], left: [36, 80], right: [64, 84], front: [50, 88], back: [34, 34], g1: [14, 56], g2: [80, 40] },
};
const FALLBACK: Spots = { flag: [50, 14], light: [86, 62], left: [22, 68], right: [70, 74], front: [46, 84], back: [34, 36], g1: [14, 60], g2: [82, 50] };

/** Inline position of an item standing on a spot of this picture. */
export const standAt = (art: string, kind: SpotKind): { left: string; top: string } => {
  const [x, y] = (SPOTS[art] ?? FALLBACK)[kind];
  return { left: `${x}%`, top: `${y}%` };
};
