// Her path pictures, made to scroll with the path (her note, Nov 3 2026:
// "обои чтоб двигались вместе с путём; обрезать и дублировать?"). The sky
// with the horizon is shown once at the top; below it a band of her sea with
// islands at both edges repeats, every other copy mirrored left-right so the
// same island isn't seen twice in a row, each join a soft crossfade.
// Out: src/assets/bg/path-{day,night}-{top,tile}.webp. Run from the repo root:
// node < marketing/tools/make-path-tiles.cjs
const sharp = require("sharp");

const PICS = {
  // rows of the 853x1844 pictures: the top piece (with a fade at its bottom),
  // then the repeating band [from, to) and how many rows each join blends
  day: { top: 330, fade: 90, from: 250, to: 1640, blend: 170 },
  night: { top: 540, fade: 110, from: 470, to: 1640, blend: 170 },
};

const raw = async (img) => {
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
};
const rows = (src, from, to) => ({ data: src.data.subarray(from * src.w * 4, to * src.w * 4), w: src.w, h: to - from });
const mirror = (src) => {
  const out = Buffer.alloc(src.data.length);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const a = (y * src.w + x) * 4, b = (y * src.w + (src.w - 1 - x)) * 4;
    out[a] = src.data[b]; out[a + 1] = src.data[b + 1]; out[a + 2] = src.data[b + 2]; out[a + 3] = src.data[b + 3];
  }
  return { data: out, w: src.w, h: src.h };
};
/** `cur` without its last F rows, its first F rows blended from `prev`'s last F rows:
 *  laid after `prev`, the join can't be seen. */
const joined = (prev, cur, F) => {
  const H = cur.h - F, out = Buffer.alloc(cur.w * H * 4);
  for (let y = 0; y < H; y++) {
    const k = y < F ? (y + 0.5) / F : 1;
    const s = k * k * (3 - 2 * k); // smooth
    for (let x = 0; x < cur.w; x++) {
      const o = (y * cur.w + x) * 4;
      const c = (y * cur.w + x) * 4;
      const p = y < F ? ((prev.h - F + y) * prev.w + x) * 4 : -1;
      for (let ch = 0; ch < 4; ch++) out[o + ch] = p < 0 ? cur.data[c + ch] : Math.round(cur.data[c + ch] * s + prev.data[p + ch] * (1 - s));
    }
  }
  return { data: out, w: cur.w, h: H };
};

(async () => {
  for (const [name, P] of Object.entries(PICS)) {
    const src = await raw(sharp(`src/assets/bg/path-${name}.webp`));
    // The top: her sky and horizon, fading out at the bottom.
    const top = Buffer.from(rows(src, 0, P.top).data);
    for (let y = P.top - P.fade; y < P.top; y++) {
      const k = 1 - (y - (P.top - P.fade)) / P.fade;
      const a = Math.round(255 * k * k * (3 - 2 * k));
      for (let x = 0; x < src.w; x++) top[(y * src.w + x) * 4 + 3] = a;
    }
    await sharp(top, { raw: { width: src.w, height: P.top, channels: 4 } }).webp({ quality: 82, alphaQuality: 90 }).toFile(`src/assets/bg/path-${name}-top.webp`);
    // The band twice, the second mirrored; A' B' A' B' ... loops without a seam.
    const A = { ...rows(src, P.from, P.to), data: Buffer.from(rows(src, P.from, P.to).data) };
    const B = mirror(A);
    const a = joined(B, A, P.blend), b = joined(A, B, P.blend);
    const tile = Buffer.concat([a.data, b.data]);
    await sharp(tile, { raw: { width: src.w, height: a.h + b.h, channels: 4 } }).removeAlpha().webp({ quality: 80 }).toFile(`src/assets/bg/path-${name}-tile.webp`);
    console.log(name, "top", P.top, "tile", a.h + b.h);
  }
})();
