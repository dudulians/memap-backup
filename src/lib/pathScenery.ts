// Scenery beside the path of evenings (Aurora UX step 2, Nov 2 2026; her
// ask: "по бокам этих кружков ... какие-то штучки, чтоб пусто не было").
// Plan: marketing/aurora-light-ux/MASTERPIECE-PLAN.md §3.2.6. Pure layout:
// given the stops, it returns where each piece of her art goes. Static and
// seeded by the week, so the same week always looks the same.

/** Art size in pixels (src/assets/map/*.webp) and the most it may take on
 *  screen. Never more than pixels ÷ 2, so nothing looks soft on a 3× phone. */
const ART: Record<string, { px: [number, number]; max: number }> = {
  island_plain: { px: [240, 124], max: 96 },
  island_lotus: { px: [213, 166], max: 96 },
  island_rocky: { px: [240, 135], max: 96 },
  island_waterfall: { px: [240, 155], max: 96 },
  pine_tree: { px: [127, 149], max: 64 },
  green_tree: { px: [155, 154], max: 72 },
  flowering_bush: { px: [126, 85], max: 50 },
  cherry_blossom_tree: { px: [215, 155], max: 88 },
  orange_tree: { px: [169, 148], max: 76 },
  palm_trees: { px: [137, 142], max: 68 },
  sailboat: { px: [123, 128], max: 62 },
  lavender: { px: [143, 105], max: 44 },
  round_bush: { px: [111, 67], max: 48 },
  single_rock: { px: [79, 48], max: 36 },
  cloud_small: { px: [106, 59], max: 53 },
  zen_stones: { px: [127, 121], max: 40 },
  camping_tent: { px: [201, 119], max: 90 },
  wooden_signpost: { px: [107, 131], max: 54 },
};

/** Pieces that sit on water get a ripple under them. */
const ON_WATER = new Set(["island_plain", "island_lotus", "island_rocky", "island_waterfall", "sailboat"]);
/** Pieces that float get no ground shadow. */
const FLOATS = new Set(["cloud_small"]);

/** Four plain sets, one per week in turn (week 1 = A), one piece per gap
 *  (seven gaps: six between stops, one before the chest). Earned things
 *  (lighthouse, bridge, flag, balloon, rainbow, chest) are never scenery.
 *  rock_cluster is left out: its art is cut off at the top. */
// Since her reference picture (Nov 2): only small, quiet pieces (bushes,
// stones, clouds), so nothing looks thrown in at random.
const SETS: string[][] = [
  ["round_bush", "cloud_small", "single_rock", "flowering_bush", "cloud_small", "lavender", "single_rock"],
  ["lavender", "cloud_small", "round_bush", "single_rock", "flowering_bush", "cloud_small", "zen_stones"],
  ["flowering_bush", "single_rock", "cloud_small", "round_bush", "lavender", "cloud_small", "round_bush"],
  ["single_rock", "round_bush", "cloud_small", "lavender", "flowering_bush", "cloud_small", "round_bush"],
];

export interface Rect { x: number; y: number; w: number; h: number }

export interface Piece {
  name: string;
  /** Top-left corner and size, in path-box pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
  ripple: boolean;
  shadow: boolean;
}

const hit = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// Small seeded random (mulberry32): same week, same scene.
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const MIN_BAND = 44;
const ROAD_GAP = 28;
const MIN_PIECE = 32;

/**
 * @param week 0-based week number (week 0 uses set A).
 * @param stops centre x, centre y and radius of every stop, top to bottom.
 * @param width the path box width (the screen minus its 16pt gutters).
 * @param blocked things that never move: coins, tonight's label, the
 *   avatar slot. Pieces never overlap them.
 * @param done indexes of done stops, which get a flower beside them.
 */
export const placeScenery = (
  week: number,
  stops: { x: number; y: number; r: number }[],
  width: number,
  blocked: Rect[],
  done: number[],
): Piece[] => {
  const set = SETS[week % SETS.length];
  const rand = rng(week * 7919 + 17);
  const out: Piece[] = [];
  const taken: Rect[] = [...blocked];

  const make = (name: string, cx: number, cy: number, w: number): Piece => {
    const [pw, ph] = ART[name].px;
    const h = Math.round((w * ph) / pw);
    return { name, x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w: Math.round(w), h, ripple: ON_WATER.has(name), shadow: !FLOATS.has(name) };
  };
  // A piece's footprint, with its ripple and shadow and a little air.
  const box = (p: Piece): Rect => ({ x: p.x - 6, y: p.y - 4, w: p.w + 12, h: p.h + (p.ripple || p.shadow ? 14 : 8) });

  // Flowers first: one small tuft beside each done stop, on the side
  // the road isn't leaving toward.
  for (const i of done) {
    const s = stops[i];
    const next = stops[i + 1] ?? stops[i - 1];
    if (!s || !next) continue;
    const away = next.x >= s.x ? -1 : 1;
    const name = i % 2 === 0 ? "lavender" : "flowering_bush";
    for (const side of [away, -away]) {
      const w = 30;
      const cx = s.x + side * (s.r + 14 + w / 2);
      if (cx - w / 2 < 0 || cx + w / 2 > width) continue;
      const p = make(name, cx, s.y + s.r * 0.45, w);
      if (taken.some((r) => hit(box(p), r))) continue;
      out.push(p);
      taken.push(box(p));
      break;
    }
  }

  // Then one piece of the week's set in each gap between two stops.
  for (let g = 0; g < stops.length - 1; g++) {
    const a = stops[g];
    const b = stops[g + 1];
    const r = Math.max(a.r, b.r);
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const left: [number, number] = [0, minX - r - ROAD_GAP];
    const right: [number, number] = [maxX + r + ROAD_GAP, width];
    const bandW = (band: [number, number]) => band[1] - band[0];
    const order = bandW(left) >= bandW(right) ? [left, right] : [right, left];
    const name = set[g % set.length];
    const jitter = (rand() * 2 - 1) * 8;
    const cy = (a.y + b.y) / 2 + jitter;
    for (const band of order) {
      const bw = bandW(band);
      if (bw < MIN_BAND) continue;
      const w = Math.min(bw, ART[name].max, ART[name].px[0] / 2);
      if (w < MIN_PIECE) continue;
      const p = make(name, (band[0] + band[1]) / 2, cy, w);
      if (taken.some((rr) => hit(box(p), rr))) continue;
      out.push(p);
      taken.push(box(p));
      break;
    }
  }
  return out;
};
