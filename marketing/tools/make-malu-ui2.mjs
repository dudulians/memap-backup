/**
 * Second set of Malu poses and small scenes for inside the app ("Malu's
 * world" redesign, Oct 31 2026). Same rig and line as make-malu-ui.mjs.
 * Transparent PNGs; nothing is ever drawn on a lamb's body, props float
 * around them.
 *
 * Usage (from marketing/): node tools/make-malu-ui2.mjs
 *   -> mascot/ui/malu-<name>.png (640x640, scenes 960x640)
 */
import fs from "node:fs";
import path from "node:path";
import { openPage, INSTAGRAM } from "./lib/render.mjs";
import { fontFace } from "./lib/ui.mjs";

const MASCOT = path.join(path.dirname(INSTAGRAM), "mascot");
// STICKER=1: no floor shadow, into ui-sticker/ (the app bakes a white edge around these)
const STICKER = !!process.env.STICKER;
const OUT = path.join(MASCOT, STICKER ? "ui-sticker" : "ui");
fs.mkdirSync(OUT, { recursive: true });

// one lamb: [who, dx from centre, size factor, pose]
const SCENES = {
  // evening reminder / night header: dozing
  sleepy: { w: 640, cast: [["mallow", 0, 1, { eyes: "closed", mouth: "o", blush: 0.7, earL: 10, earR: -6, head: { r: -9 }, sy: 0.97, sx: 1.02 }]], props: "zz" },
  // empty Findings: thinking
  think: { w: 640, cast: [["mallow", 0, 1, { eyes: "open", look: [5, -5], mouth: "o", blush: 0.6, head: { r: 9 }, armR: -45, r: 2 }]], props: "dots" },
  // a finding is ready
  wink: { w: 640, cast: [["mallow", 0, 1, { eyes: "wink", mouth: "open", blush: 0.85, armR: -78, r: -3, head: { r: -5 } }]], props: "sparkles" },
  // quiet thanks
  shy: { w: 640, cast: [["mallow", 0, 1, { eyes: "shy", mouth: "w", blush: 1, head: { r: -7 }, armL: 20, armR: -20 }]] },
  // sitting, pleased (home header in the day)
  sit: { w: 640, cast: [["mallow", 0, 1, { sit: true, eyes: "happy", mouth: "w", blush: 0.8, head: { r: 4 } }]] },
  // hard day: Tumu leans in, both eyes closed, one heart above
  hug: { w: 960, cast: [["toffee", 92, 0.98, { eyes: "closed", mouth: "w", blush: 0.8, r: -9, head: { r: -6 }, armL: 40 }], ["mallow", -78, 1, { eyes: "closed", mouth: "w", blush: 0.9, r: 7, head: { r: 6 } }]], props: "heart" },
  // fights door: hmph, heads turned away, a little puff between them
  hmph: { w: 960, cast: [["mallow", -205, 0.8, { eyes: "closed", mouth: "sad", blush: 0.7, r: -6, head: { r: -12 } }], ["toffee", 205, 0.78, { eyes: "closed", mouth: "sad", blush: 0.4, r: 6, head: { r: 12 } }]], props: "puff" },
  // kid door: Malu and Momo
  mom: { w: 960, cast: [["mallow", -110, 0.88, { eyes: "happy", mouth: "open", blush: 0.8, r: 4, head: { r: 6 }, armR: -30 }], ["baby", 190, 0.56, { eyes: "sparkle", mouth: "open", blush: 0.9, r: -6, head: { r: -8 }, armL: 60, armR: -60 }]] },
  // mood door: faces floating around her
  mood: { w: 640, cast: [["mallow", 0, 1, { eyes: "open", mouth: "w", blush: 0.7, head: { r: -4 } }]], props: "faces" },
  // drinking door: a glass floats beside her
  glass: { w: 640, cast: [["mallow", -30, 1, { eyes: "open", look: [6, 0], mouth: "o", blush: 0.6, head: { r: 5 } }]], props: "glass" },
  // migraine door: a small grey cloud floats above
  cloud: { w: 640, cast: [["mallow", 0, 1, { eyes: "closed", mouth: "sad", blush: 0.5, earL: 14, earR: -14, head: { r: -3 }, sy: 0.96 }]], props: "rain" },
};

const S = 640, K = 2.4, GROUND = 600;
const read = (f) => fs.readFileSync(path.join(MASCOT, f), "utf8");
const script = `
const STICKER = ${STICKER};
const SCENES = ${JSON.stringify(SCENES)}, H = ${S}, K = ${K}, GROUND = ${GROUND};
const LINE = CHIBI.LINE;
const heart = (x, y, sc, fill) => '<g transform="translate(' + x + ' ' + y + ') scale(' + sc + ')"><path d="M0 9 C-17 -3 -11 -21 0 -11 C11 -21 17 -3 0 9Z" fill="' + (fill || '#f2847c') + '" stroke="' + LINE + '" stroke-width="2.6" stroke-linejoin="round"/><ellipse cx="-5.5" cy="-7" rx="3" ry="2" fill="#fff" opacity=".85" transform="rotate(-30 -5.5 -7)"/></g>';
const z = (x, y, s) => '<text x="' + x + '" y="' + y + '" font-size="' + s + '" font-weight="900" fill="#fff" stroke="' + LINE + '" stroke-width="' + (s / 7) + '" paint-order="stroke" font-family="DM Sans">z</text>';
const spark = (x, y, s) => '<path transform="translate(' + x + ' ' + y + ') scale(' + s + ')" d="M0 -12 C2 -3 3 -2 12 0 C3 2 2 3 0 12 C-2 3 -3 2 -12 0 C-3 -2 -2 -3 0 -12Z" fill="#ffe49a" stroke="' + LINE + '" stroke-width="2.2" stroke-linejoin="round"/>';
const dot = (x, y, r) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#fff" stroke="' + LINE + '" stroke-width="3"/>';
const face = (x, y, s, kind, fill) => {
  const m = kind === 'happy' ? 'M-6 2 Q0 8 6 2' : kind === 'sad' ? 'M-6 6 Q0 0 6 6' : 'M-6 4 L6 4';
  return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><circle r="15" fill="' + fill + '" stroke="' + LINE + '" stroke-width="2.4"/><circle cx="-5" cy="-3" r="2" fill="' + LINE + '"/><circle cx="5" cy="-3" r="2" fill="' + LINE + '"/><path d="' + m + '" fill="none" stroke="' + LINE + '" stroke-width="2.2" stroke-linecap="round"/></g>';
};
const cloud = (x, y, s) => '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><path d="M-30 8 C-42 8 -42 -10 -28 -10 C-28 -26 -6 -30 0 -18 C6 -30 30 -26 28 -8 C42 -8 42 8 30 8Z" fill="#dfe3ee" stroke="' + LINE + '" stroke-width="2.6" stroke-linejoin="round"/>' +
  [-16, 0, 16].map((dx, i) => '<path d="M' + dx + ' 16 q-2 6 0 10" stroke="#a8d8f7" stroke-width="3.2" stroke-linecap="round" fill="none" transform="translate(0 ' + (i % 2) * 4 + ')"/>').join('') + '</g>';
const glass = (x, y, s) => '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><path d="M-14 -24 L14 -24 C14 -4 8 4 0 4 C-8 4 -14 -4 -14 -24Z" fill="#fff6ea" stroke="' + LINE + '" stroke-width="2.6" stroke-linejoin="round"/><path d="M-12 -14 L12 -14 C11 -2 6 2 0 2 C-6 2 -11 -2 -12 -14Z" fill="#e8838f"/><path d="M0 4 L0 22 M-9 23 L9 23" stroke="' + LINE + '" stroke-width="2.6" stroke-linecap="round"/></g>';
const puff = (x, y, s) => '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><path d="M-16 6 C-26 6 -26 -8 -14 -8 C-14 -20 4 -22 6 -12 C16 -18 26 -6 18 2 C24 10 12 16 6 10 C0 16 -14 14 -16 6Z" fill="#fff" stroke="' + LINE + '" stroke-width="2.4" stroke-linejoin="round"/><path d="M-6 -2 l4 4 l4 -6 l4 4" fill="none" stroke="#f2665f" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g>';
window.scene = (key) => {
  const sc = SCENES[key], W = sc.w, cx = W / 2;
  const ls = sc.cast.map(([who, dx, k, pose]) => ({ who, x: cx + dx, y: GROUND, k: K * k, pose }));
  let cast = (STICKER ? '' : ls.map(lambShadow).join('')) + ls.map(lamb).join('');
  const m = ls[ls.length - 1], top = lambAt(m, 0, -200);
  const p = sc.props;
  if (p === 'zz') cast += z(top[0] + 120, top[1] + 70, 100) + z(top[0] + 195, top[1] + 0, 76) + z(top[0] + 250, top[1] - 60, 56);
  if (p === 'dots') cast += dot(top[0] + 130, top[1] + 20, 12) + dot(top[0] + 165, top[1] - 20, 16) + dot(top[0] + 205, top[1] - 70, 22);
  if (p === 'sparkles') cast += spark(top[0] + 150, top[1] - 10, 3) + spark(top[0] - 160, top[1] + 30, 2) + spark(top[0] + 200, top[1] + 90, 1.6);
  if (p === 'heart') cast += heart(cx + 6, 120, K * 1.5);
  if (p === "puff") cast += puff(cx, 200, K * 1.5);
  if (p === 'faces') cast += face(top[0] - 175, top[1] + 60, 2.6, 'happy', '#cfe8c4') + face(top[0] + 175, top[1] + 30, 2.6, 'flat', '#fff1c4') + face(top[0] + 130, top[1] - 80, 2.2, 'sad', '#dceffc');
  if (p === 'glass') cast += glass(cx + 210, GROUND - 230, 3.2);
  if (p === 'rain') cast += cloud(cx, 110, 2.8);
  return { W, svg: '<defs>' + lambBoil(0.2, 2.2) + '</defs><g filter="url(#boil)">' + cast + '</g>' };
};`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${fontFace()}*{margin:0}html,body{background:transparent}</style></head>
<body><svg id="stage" width="960" height="${S}" xmlns="http://www.w3.org/2000/svg"></svg><script>${read("chibi.js")}</script><script>${read("lamb.js")}</script><script>${script}</script></body></html>`;

const { browser, page } = await openPage({ width: 960, height: S, html });
const only = process.argv.slice(2);
for (const key of Object.keys(SCENES)) {
  if (only.length && !only.includes(key)) continue;
  const W = await page.evaluate((k) => { const r = window.scene(k); const st = document.getElementById("stage"); st.setAttribute("width", r.W); st.innerHTML = r.svg; return r.W; }, key);
  fs.writeFileSync(path.join(OUT, `malu-${key}.png`), await page.screenshot({ type: "png", omitBackground: true, clip: { x: 0, y: 0, width: W, height: S } }));
}
await browser.close();
console.log(OUT);
