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
  // her note (Nov 10 2026): the flag on the very top of the peak, not beside it
  "06_snow_peak": { flag: [53, 5], light: [86, 64], left: [20, 66], right: [72, 72], front: [46, 80], back: [30, 48], g1: [12, 60], g2: [84, 52] },
  "09_waterfall": { flag: [70, 16], light: [28, 24], left: [17, 66], right: [86, 64], front: [30, 80], back: [50, 17], g1: [10, 52], g2: [92, 50] },
  // her note (Nov 10 2026): the lighthouse goes on the top; the flag and a house on the terraces beside it
  "10_terraced_garden": { flag: [76, 46], light: [50, 16], left: [22, 68], right: [66, 76], front: [44, 84], back: [30, 40], g1: [14, 58], g2: [84, 52] },
  "11_sakura": { flag: [22, 72], light: [80, 70], left: [36, 82], right: [66, 84], front: [50, 90], back: [62, 68], g1: [12, 76], g2: [88, 74] },
  // her note (Nov 10 2026): the lighthouse and the house on the edge looked about to fall off: the lighthouse in the
  // middle of the top, the flag beside it, and no house or tent here (BLOCKED below)
  "14_stone_arch": { flag: [44, 12], light: [60, 12], left: [22, 76], right: [84, 66], front: [30, 84], back: [34, 13], g1: [12, 70], g2: [34, 62] },
  "16_cozy_cottage": { flag: [35, 67], light: [88, 70], left: [18, 72], right: [64, 80], front: [44, 86], back: [70, 44], g1: [10, 62], g2: [78, 56] },
  // her note (Nov 5 2026): Me looked strange with the flag over the arch: on the grass by the cypress now
  "17_lavender_garden": { flag: [80, 50], light: [88, 66], left: [26, 80], right: [64, 80], front: [46, 88], back: [30, 40], g1: [12, 64], g2: [70, 58] },
  // her note: the lighthouse on the top of Body; the flag goes to the side
  "19_grassy_terraces": { flag: [84, 60], light: [48, 14], left: [18, 68], right: [44, 82], front: [62, 86], back: [30, 36], g1: [10, 60], g2: [74, 40] },
  "20_tropical_palms": { flag: [22, 68], light: [84, 70], left: [40, 88], right: [68, 80], front: [56, 90], back: [50, 62], g1: [12, 74], g2: [90, 78] },
  "24_oak_tree": { flag: [24, 66], light: [80, 66], left: [38, 83], right: [68, 82], front: [50, 90], back: [60, 64], g1: [12, 72], g2: [88, 72] },
  "26_flowery_island": { flag: [52, 14], light: [86, 60], left: [36, 80], right: [64, 84], front: [50, 88], back: [34, 34], g1: [14, 56], g2: [80, 40] },
  // her own islands' pictures (Nov 14 2026), picked on the same 10% grid (marketing/tools/aurora-tests/work/own-spots.mjs)
  "12_cypress_hill": { flag: [72, 40], light: [88, 60], left: [22, 72], right: [82, 68], front: [48, 82], back: [58, 48], g1: [12, 70], g2: [90, 62] },
  "07_blue_lagoon": { flag: [32, 16], light: [80, 42], left: [12, 62], right: [88, 60], front: [50, 86], back: [42, 26], g1: [20, 40], g2: [72, 52] },
  "08_rocky_grove": { flag: [64, 34], light: [84, 54], left: [16, 66], right: [84, 68], front: [50, 84], back: [48, 40], g1: [12, 62], g2: [88, 62] },
  "13_palms": { flag: [78, 64], light: [88, 68], left: [18, 74], right: [70, 82], front: [46, 86], back: [56, 64], g1: [12, 72], g2: [90, 72] },
  "18_zen_sakura": { flag: [20, 78], light: [84, 78], left: [30, 86], right: [70, 86], front: [50, 92], back: [62, 76], g1: [12, 80], g2: [88, 80] },
  "25_waterfall_garden": { flag: [22, 42], light: [80, 42], left: [16, 66], right: [86, 64], front: [30, 82], back: [70, 32], g1: [10, 58], g2: [92, 58] },
};
const FALLBACK: Spots = { flag: [50, 14], light: [86, 62], left: [22, 68], right: [70, 74], front: [46, 84], back: [34, 36], g1: [14, 60], g2: [82, 50] };

/** Treasures that don't stand on a picture (her note, Nov 10 2026): a house on the cottage island is a house on a house,
 *  and the stone arch's narrow top has no room for one. They wait on her shelf in You instead. */
const BLOCKED: Record<string, string[]> = { "16_cozy_cottage": ["house"], "14_stone_arch": ["house", "tent"] };
export const standsOn = (art: string, item: string): boolean => !BLOCKED[art]?.includes(item);

/** Inline position of an item standing on a spot of this picture. */
export const standAt = (art: string, kind: SpotKind): { left: string; top: string } => {
  const [x, y] = (SPOTS[art] ?? FALLBACK)[kind];
  return { left: `${x}%`, top: `${y}%` };
};
