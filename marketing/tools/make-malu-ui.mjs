/**
 * Malu poses for inside the app (first screen, "Logged", evening done
 * screen), same rig as the Instagram avatars and the app icon
 * (../mascot/chibi.js through lamb.js). Transparent 640x640 PNGs, so the
 * app or a mockup can put them on any background.
 *
 * Usage (from marketing/): node tools/make-malu-ui.mjs
 *   -> mascot/ui/malu-{wave,happy,cheer,heart}.png
 */
import fs from "node:fs";
import path from "node:path";
import { openPage, INSTAGRAM } from "./lib/render.mjs";
import { fontFace } from "./lib/ui.mjs";

const MASCOT = path.join(path.dirname(INSTAGRAM), "mascot");
const OUT = path.join(MASCOT, "ui");
fs.mkdirSync(OUT, { recursive: true });
const S = 640, K = 2.55, GROUND = 590;

const POSES = {
  // door picker: hello from the account people just came from
  wave: { eyes: "sparkle", mouth: "open", blush: 0.6, armR: -70, r: -3, head: { r: -4 } },
  // "Logged.": pleased, nothing loud
  happy: { eyes: "happy", mouth: "w", blush: 0.85, armL: 25, armR: -25, r: 2, head: { r: 5 } },
  // evening done, calm day: both arms up
  cheer: { eyes: "happy", mouth: "open", blush: 0.8, armL: 75, armR: -75, sy: 1.03, sx: 0.98 },
  // evening done, the hard thing happened today: calm closed eyes, hearts
  // floating above like on the Instagram avatars, no judging. Nothing is
  // drawn on the body (paws on the chest read as a bra; a hoof holding the
  // heart hides behind the wool)
  heart: { eyes: "closed", mouth: "w", blush: 0.9, earL: -6, earR: 6, head: { r: 6 } },
};

const read = (f) => fs.readFileSync(path.join(MASCOT, f), "utf8");
const script = `
const POSES = ${JSON.stringify(POSES)}, S = ${S}, K = ${K}, GROUND = ${GROUND};
const LINE = CHIBI.LINE;
const heart = (x, y, sc) => '<g transform="translate(' + x + ' ' + y + ') scale(' + sc + ')"><path d="M0 9 C-17 -3 -11 -21 0 -11 C11 -21 17 -3 0 9Z" fill="#f2847c" stroke="' + LINE + '" stroke-width="2.6" stroke-linejoin="round"/><ellipse cx="-5.5" cy="-7" rx="3" ry="2" fill="#fff" opacity=".85" transform="rotate(-30 -5.5 -7)"/></g>';
window.pose = (key) => {
  // the heart pose sits a little lower to leave room for the hearts above
  const l = { who: "mallow", x: S / 2, y: GROUND + (key === "heart" ? 20 : 0), k: K, pose: POSES[key] };
  let cast = lambShadow(l) + lamb(l);
  if (key === "heart") {
    const a = lambAt(l, 70, -196), b = lambAt(l, -74, -180);
    cast += heart(a[0], a[1], K * 1.6) + heart(b[0], b[1], K * 1.05);
  }
  return '<defs>' + lambBoil(0.2, 2.2) + '</defs><g filter="url(#boil)">' + cast + '</g>';
};`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${fontFace()}*{margin:0}html,body{background:transparent}</style></head>
<body><svg id="stage" width="${S}" height="${S}" xmlns="http://www.w3.org/2000/svg"></svg><script>${read("chibi.js")}</script><script>${read("lamb.js")}</script><script>${script}</script></body></html>`;

const { browser, page } = await openPage({ width: S, height: S, html });
for (const key of Object.keys(POSES)) {
  await page.evaluate((k) => { document.getElementById("stage").innerHTML = window.pose(k); }, key);
  fs.writeFileSync(path.join(OUT, `malu-${key}.png`), await page.screenshot({ type: "png", omitBackground: true }));
}
await browser.close();
console.log(OUT);
