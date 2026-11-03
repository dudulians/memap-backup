// Her 15 topic icons on even tiles (Nov 3 2026, her note: "иконки криво
// объединены, собачья лапка обрезана"). The source tiles in her asset pack
// are cut at the edge for pets, home and wellbeing and differ in size, so:
// take only her line drawing (the coloured strokes), and put it, the same
// size and centred, on one tile drawn here. Day and night. Run from the repo
// root via stdin: node < marketing/tools/make-topic-tiles.cjs (needs sharp and
// her asset pack in marketing/brand/map-assets, which is not in git).
const sharp = require("sharp");
const SRC = "marketing/brand/map-assets/02_square_512_png/category_icons";
const N = 192;
const COLOR = {
  books: "#7387d0", career: "#6387bd", coffee: "#ba8358", family: "#6583b9", fitness: "#429580",
  food: "#cd945a", growth: "#409286", health: "#399586", hobbies: "#d1955b", home: "#cd9057",
  love: "#db8098", music: "#ad78ca", pets: "#3c9384", travel: "#3d978e", wellbeing: "#ac74c5",
};
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lighten = (h, k) => hex(h).map((v) => Math.round(v + (255 - v) * k));

const tile = (night) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${N}" height="${N}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${night ? "#3b4373" : "#ffffff"}"/>
      <stop offset="1" stop-color="${night ? "#2b3159" : "#eef1f6"}"/>
    </linearGradient>
    <filter id="s" x="-25%" y="-25%" width="150%" height="160%">
      <feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="${night ? "#04071a" : "#1a3a52"}" flood-opacity="${night ? 0.6 : 0.2}"/>
    </filter>
  </defs>
  <rect x="16" y="11" width="160" height="160" rx="48" fill="url(#g)" filter="url(#s)"/>
  <rect x="16.75" y="11.75" width="158.5" height="158.5" rx="47.25" fill="none" stroke="${night ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.95)"}" stroke-width="1.5"/>
</svg>`);

/** Her strokes only: alpha from how colourful a pixel is (the tile is near white). */
const strokes = async (name, rgb) => {
  const { data, info } = await sharp(`${SRC}/${name}.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const out = Buffer.alloc(W * H * 4);
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let i = 0, p = 0; p < W * H; p++, i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const s = mx ? (mx - mn) / mx : 0;
    const k = Math.max(0, Math.min(1, (s - 0.12) / 0.2)) * a;
    out[i] = rgb[0]; out[i + 1] = rgb[1]; out[i + 2] = rgb[2]; out[i + 3] = Math.round(k * 255);
    if (k > 0.35) { const x = p % W, y = (p / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  const pad = 4;
  const left = Math.max(0, x0 - pad), top = Math.max(0, y0 - pad);
  const w = Math.min(W - left, x1 - x0 + 1 + pad * 2), h = Math.min(H - top, y1 - y0 + 1 + pad * 2);
  return sharp(out, { raw: { width: W, height: H, channels: 4 } }).extract({ left, top, width: w, height: h });
};

(async () => {
  const report = [];
  for (const [name, col] of Object.entries(COLOR)) {
    for (const night of [false, true]) {
      const rgb = night ? lighten(col, 0.18) : hex(col);
      const icon = await (await strokes(name, rgb)).png().toBuffer();
      const meta = await sharp(icon).metadata();
      // the same visual size for every drawing: its longer side is 46% of the tile box
      const side = Math.round(N * 0.46);
      const sc = side / Math.max(meta.width, meta.height);
      const w = Math.round(meta.width * sc), h = Math.round(meta.height * sc);
      const sized = await sharp(icon).resize(w, h).png().toBuffer();
      const out = `src/assets/${night ? "map-night" : "map"}/icon_${name}.webp`;
      await sharp(tile(night)).composite([{ input: sized, left: Math.round(96 - w / 2), top: Math.round(91 - h / 2) }])
        .webp({ quality: 92, alphaQuality: 100 }).toFile(out);
      if (!night) report.push(`${name} ${meta.width}x${meta.height} -> ${w}x${h}`);
    }
  }
  console.log(report.join("\n"));
})();
