// Where things stand on each island picture (her note, Nov 5 2026: the flags and
// treasures "левитируют над островом"). A spot is the point where an item's base
// touches the ground, in % of the picture's width and height; the item stands on
// it with a soft shadow (index.css ".stand"). Picked on a 10% grid over every
// picture (marketing/tools/aurora-tests/island-spots-sheet.mjs).
//   flag: stage 4 · light: her lit rule (the lighthouse) · left/right: treasures
export type SpotKind = "flag" | "light" | "left" | "right";
type Spots = Record<SpotKind, [number, number]>;

const SPOTS: Record<string, Spots> = {
  "03_flower_hill": { flag: [52, 14], light: [84, 62], left: [26, 66], right: [68, 72] },
  "04_twin_hills": { flag: [58, 12], light: [86, 58], left: [24, 66], right: [72, 70] },
  "05_wide_meadow": { flag: [63, 12], light: [88, 58], left: [22, 66], right: [74, 70] },
  "06_snow_peak": { flag: [48, 7], light: [86, 64], left: [20, 66], right: [72, 72] },
  "09_waterfall": { flag: [70, 16], light: [28, 24], left: [14, 64], right: [86, 64] },
  "10_terraced_garden": { flag: [50, 14], light: [84, 66], left: [22, 68], right: [66, 76] },
  "11_sakura": { flag: [22, 72], light: [80, 70], left: [36, 82], right: [66, 84] },
  "14_stone_arch": { flag: [52, 10], light: [74, 14], left: [22, 76], right: [84, 66] },
  "16_cozy_cottage": { flag: [44, 10], light: [86, 64], left: [18, 72], right: [64, 80] },
  "17_lavender_garden": { flag: [48, 6], light: [86, 64], left: [18, 70], right: [64, 80] },
  "19_grassy_terraces": { flag: [48, 14], light: [86, 62], left: [18, 68], right: [44, 82] },
  "20_tropical_palms": { flag: [22, 68], light: [84, 70], left: [40, 88], right: [68, 80] },
  "24_oak_tree": { flag: [24, 66], light: [80, 66], left: [30, 80], right: [68, 82] },
  "26_flowery_island": { flag: [52, 14], light: [86, 60], left: [36, 80], right: [64, 84] },
};
const FALLBACK: Spots = { flag: [50, 14], light: [86, 62], left: [22, 68], right: [70, 74] };

/** Inline position of an item standing on a spot of this picture. */
export const standAt = (art: string, kind: SpotKind): { left: string; top: string } => {
  const [x, y] = (SPOTS[art] ?? FALLBACK)[kind];
  return { left: `${x}%`, top: `${y}%` };
};
