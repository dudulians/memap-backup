// Today on her sea (Nov 4 2026). Her portrait sea picture becomes a tile that repeats downwards:
// the bottom strip is blended into the top so week after week scrolls with no seam. Then Today is drawn
// on it: the wake through the lit evenings, tonight's light, the chest on an islet at the week's end.
// Run from marketing/tools: node make-today-sea.mjs night   (or: day, when her day picture is in)
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const MODE = process.argv[2] === "day" ? "day" : "night";
const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const url = (p) => pathToFileURL(path.join(R, p)).href;
const OUT = path.join(R, "marketing/aurora-light-ux");
const BRAND = path.join(R, "marketing/brand/globe");
mkdirSync(path.join(OUT, "39-today-sea"), { recursive: true });
const SRC = `today-sea-${MODE}-v1.webp`, TILE = `today-sea-${MODE}-v1-tile.webp`;
const N = MODE === "night";

const icon = (name, { size = 24, sw = 2, color = "currentColor", fill = "none" } = {}) => {
  const src = readFileSync(path.join(R, `node_modules/lucide-react/dist/esm/icons/${name}.js`), "utf8");
  const nodes = Function(`return ${src.match(/createLucideIcon\("[^"]+", (\[[\s\S]*\])\);/)[1]}`)();
  const kids = nodes.map(([t, a]) => `<${t} ${Object.entries(a).filter(([k]) => k !== "key").map(([k, v]) => `${k}="${v}"`).join(" ")}/>`).join("");
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${kids}</svg>`;
};
const M = (n) => url(`src/assets/${N ? "map-night" : "map"}/${n}.webp`);
const OTTER = url("src/assets/avatars/11_otter.webp");

const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", args: ["--allow-file-access-from-files"] });
const p = await b.newPage({ viewport: { width: 1500, height: 1300 }, deviceScaleFactor: 2 });

// 1. the tile: the bottom 8% is faded over the top, then cut off, so the bottom edge flows into the top edge
await p.goto(pathToFileURL(path.join(BRAND, SRC)).href);
const tile = await p.evaluate(async (src) => {
  const img = new Image(); img.src = src; await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight, b = Math.round(H * 0.08);
  const c = document.createElement("canvas"); c.width = W; c.height = H - b; const x = c.getContext("2d");
  x.drawImage(img, 0, 0, W, H - b, 0, 0, W, H - b);
  const s = document.createElement("canvas"); s.width = W; s.height = b; const y = s.getContext("2d");
  y.drawImage(img, 0, H - b, W, b, 0, 0, W, b);
  y.globalCompositeOperation = "destination-in";
  const g = y.createLinearGradient(0, 0, 0, b); g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)");
  y.fillStyle = g; y.fillRect(0, 0, W, b);
  x.drawImage(s, 0, 0);
  return { data: c.toDataURL("image/webp", 0.9), W, H: H - b };
}, pathToFileURL(path.join(BRAND, SRC)).href);
writeFileSync(path.join(BRAND, TILE), Buffer.from(tile.data.split(",")[1], "base64"));
const TILE_URL = pathToFileURL(path.join(BRAND, TILE)).href, TH = (390 * tile.H) / tile.W; // one repeat on a 390 px wide phone

// 2. Today on it
const f1 = (v) => v.toFixed(1);
const wake = (pts, { waves = 4, amp = 4, width = 8 } = {}) => {
  const K = 80, P = []; const seg = []; let L = 0;
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); L += l; }
  for (let k = 0; k <= K; k++) { let d = (k / K) * L, i = 0; while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; } const t = seg[i] ? d / seg[i] : 0; P.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t, k / K]); }
  const C = P.map(([x, y, t], i) => { const a = P[Math.max(0, i - 1)], c = P[Math.min(K, i + 1)], dx = c[0] - a[0], dy = c[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    const taper = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 0.04) / 0.92))), 0.55), wv = amp * Math.sin(t * Math.PI * 2 * waves) * taper;
    return { x: x + nx * wv, y: y + ny * wv, nx, ny, w: width * taper, cw: 2 * taper }; });
  const poly = (k) => `M${C.map((c) => `${f1(c.x + c.nx * c[k])} ${f1(c.y + c.ny * c[k])}`).join(" L")} L${C.map((c) => `${f1(c.x - c.nx * c[k])} ${f1(c.y - c.ny * c[k])}`).reverse().join(" L")}Z`;
  return `<path d="${poly("w")}" fill="${N ? "rgba(140,235,220,.32)" : "rgba(255,255,255,.58)"}" filter="url(#wb)"/><path d="${poly("cw")}" fill="${N ? "rgba(205,255,245,.9)" : "rgba(255,255,255,.95)"}" filter="url(#ws)"/>`;
};
const defs = `<defs><filter id="wb" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.2"/></filter><filter id="ws"><feGaussianBlur stdDeviation="0.5"/></filter></defs>`;
const light = (x, y, d, cls) => `<div class="ripple" style="left:${x - d * 1.05}px;top:${y + d * 0.18}px;width:${d * 2.1}px;height:${d * 0.62}px"></div><div class="orb ${cls}" style="left:${x - d / 2}px;top:${y - d / 2}px;width:${d}px;height:${d}px"></div>`;
const boat = (x, y, w) => `<div class="bob" style="left:${x - w / 2}px;top:${y - w * 0.62}px;width:${w}px"><img src="${M("sailboat")}" style="width:100%;display:block"><img src="${OTTER}" style="position:absolute;left:48%;top:42%;width:42%"></div>`;
const chestIsle = (x, y) => `<img class="abs" src="${M("island_plain")}" style="left:${x - 60}px;top:${y - 18}px;width:120px;z-index:2">
  <img class="abs" src="${M("chest_closed")}" style="left:${x - 30}px;top:${y - 44}px;width:60px;z-index:3">`;
const flame = icon("flame", { size: 21, fill: "#F59A3C", color: "#F59A3C", sw: 1.5 });
const tabs = () => `<div class="tabs">${[["sailboat", "Today"], ["map", "Map"], ["notebook-pen", "Notes"]].map(([i, t]) => `<div class="${t === "Today" ? "on" : ""}">${icon(i, { size: 22 })}<span>${t}</span></div>`).join("")}</div>`;
// Her note: "плашка Start непонятно к чему относится". Ways to tie Start to tonight's light:
// old = a pill floating under the boat; A = the light sits inside the Start capsule; B = a bubble pointing at
// the light; C = the light is labelled "Tonight" and one wide button says "Start tonight".
const tonightCallout = (x, y, kind) => {
  if (kind === "A") return `<div class="cap" style="left:${x - 33}px;top:${y - 31}px"><b>Start</b><small>14 questions</small></div>${light(x, y, 50, "tonight ringed")}`;
  if (kind === "B") return `${light(x, y, 50, "tonight")}<div class="bubble" style="left:${x + 40}px;top:${y - 52}px"><i></i><span>Tonight</span><b>14 questions</b><em>Start</em></div>`;
  if (kind === "C") return `${light(x, y, 50, "tonight teal")}<div class="tag" style="left:${x - 50}px;top:${y + 32}px">Tonight</div>`;
  // more ways (her "ещё варианты"): D the light is the button; E a buoy sign hangs from the light; F a card that repeats the light; G the animal asks
  // H = as the app does it now (PathParts NodePill): a white pill grows out of the light, the teal "Start ›" sits inside it
  if (kind === "H") return `<div class="npill" style="left:${x}px;top:${y - 35}px"><span><b>Tonight</b><small>14 questions</small></span><em>Start ${icon("chevron-right", { size: 18, sw: 2.8, color: "#fff" })}</em></div>${light(x, y, 64, "tonight ringed")}`;
  if (kind === "D") return `${light(x, y, 84, "tonight pulse")}<div class="inlight" style="left:${x - 42}px;top:${y - 42}px"><b>Start</b></div><div class="under" style="left:${x - 80}px;top:${y + 48}px">14 questions</div>`;
  if (kind === "E") return `${light(x, y, 50, "tonight")}<div class="stem" style="left:${x - 1}px;top:${y + 25}px"></div><div class="sign" style="left:${x - 85}px;top:${y + 49}px"><b>Start</b><small>· 14 questions</small></div>`;
  if (kind === "F") return `${light(x, y, 50, "tonight teal")}`;
  if (kind === "G") return `${light(x, y, 50, "tonight")}<div class="say" style="left:16px;top:${y + 44}px"><i></i><span>Tonight · 14 questions</span><em>Let's go</em></div>`;
  return `${light(x, y, 50, "tonight")}<div class="go" style="left:150px;top:${y + 38}px"><b>Start</b><small>14 questions</small></div>`;
};
const week = (y0, done, current, kind = "old", { X: XX, gap = 0, step = 74, bx: BX } = {}) => { // one week of the voyage, starting at y0
  const X = XX || [160, 236, 168, kind === "old" ? 240 : 204, 172, 238, 176], out = [];
  const pts = X.map((x, i) => [x, y0 + i * step + (i > done ? gap : 0)]);
  const upto = current ? done : 7, bx = BX ?? (kind === "old" ? 132 : 122);
  out.push(`<svg class="abs" width="390" height="${y0 + 700}" style="left:0;top:0;z-index:1">${defs}${wake([[pts[0][0] - 10, y0 - 40], ...pts.slice(0, upto), ...(current ? [[bx, pts[done][1] + 8]] : [])])}</svg>`);
  pts.forEach(([x, y], i) => {
    if (i < done) out.push(light(x, y, 38, "lit"));
    else if (current && i === done) out.push(`<div class="halo" style="left:${x - 70}px;top:${y - 70}px;width:140px;height:140px"></div>${boat(bx, y + 14, 78)}${tonightCallout(x, y, kind)}`);
    else out.push(light(x, y, 36, "dim"));
  });
  out.push(chestIsle(196, y0 + 7 * step + gap + 20));
  return out.join("");
};
const today = `<div class="phone" style="background:url(${TILE_URL}) 0 0 / 390px auto repeat-y">
  <div class="hdr"><div class="hl">${flame}<b>59</b></div><div class="hc">Voyage 9 <span>· 3/7</span></div><div class="hr"><div class="ava"><img src="${OTTER}"></div></div></div>
  ${week(150, 3, true)}
  <div class="task" style="left:318px;top:280px">${icon("pencil", { size: 19, color: "#C9962E", sw: 2.2 })}</div>
  ${tabs()}</div>`;
const STRIP_H = Math.round(TH * 3);
const strip = `<div class="strip" style="height:${STRIP_H}px;background:url(${TILE_URL}) 0 0 / 390px auto repeat-y">
  ${[1, 2].map((k) => `<div class="seam" style="top:${f1(TH * k)}px"><i></i><span>seam ${k}</span></div>`).join("")}</div>`;

const css = `
@font-face { font-family: DMS; src: url(${url("src/assets/fonts/dm-sans-latin-wght-normal.woff2")}) format("woff2"); font-weight: 100 1000; }
@font-face { font-family: ONS; src: url(${url("src/assets/fonts/onest-cyrillic-wght-normal.woff2")}) format("woff2"); font-weight: 100 900; }
* { box-sizing: border-box; }
body { margin: 0; background: #EDF1F6; font-family: DMS, ONS, sans-serif; color: #1E2A33; -webkit-font-smoothing: antialiased; }
.board { padding: 56px 64px 64px; width: max-content; }
h1 { font-size: 44px; font-weight: 700; letter-spacing: -.02em; margin: 0 0 12px; }
.sub { font-size: 22px; color: #4A5A66; margin: 0 0 40px; max-width: 1100px; line-height: 1.45; }
.brow { display: flex; gap: 56px; align-items: flex-start; }
.col { width: 390px; }
.ct { font-size: 24px; font-weight: 700; margin: 30px 0 6px; } .cc { font-size: 17px; line-height: 1.45; color: #4A5A66; }
.phone { width: 390px; height: 844px; border-radius: 46px; overflow: hidden; position: relative; box-shadow: 0 0 0 10px #fff, 0 40px 70px -24px rgba(20,40,60,.30); }
.strip { width: 390px; position: relative; border-radius: 24px; overflow: hidden; transform: scale(.5); transform-origin: 0 0; margin-bottom: ${-STRIP_H / 2}px; box-shadow: 0 30px 60px -24px rgba(20,40,60,.3); }
.seam { position: absolute; left: 0; right: 0; height: 0; }
.seam i { position: absolute; right: 0; width: 34px; border-top: 4px solid #F59A3C; }
.seam span { position: absolute; right: 40px; top: -16px; font-size: 22px; font-weight: 700; color: #F59A3C; }
.abs { position: absolute; }
.hdr { position: relative; z-index: 6; height: 64px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px 0 20px; color: ${N ? "#F1F5FF" : "#1E2A33"}; }
.hl, .hr { width: 70px; display: flex; align-items: center; gap: 5px; } .hr { justify-content: flex-end; } .hl b { font-size: 17px; font-weight: 700; }
.hc { font-size: 17px; font-weight: 700; } .hc span { opacity: .7; font-weight: 600; }
.ava { width: 44px; height: 44px; border-radius: 50%; background: ${N ? "#26365F" : "#fff"}; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 14px -8px rgba(0,0,0,.45); } .ava img { width: 38px; }
.bob { position: absolute; z-index: 3; }
.orb { position: absolute; border-radius: 50%; z-index: 2; }
.orb.lit { background: radial-gradient(circle at 50% 46%, #FFFFFF 0%, #FFF6D8 32%, #FBDF95 70%, #F3C977 100%); box-shadow: 0 0 0 5px rgba(255,236,180,.35), 0 0 30px 12px rgba(255,214,120,${N ? ".6" : ".5"}); }
.orb.dim { background: radial-gradient(circle at 40% 34%, ${N ? "#AEB9E0 0%, #7F8CC2 55%, #5E6AA6 100%" : "#FFFFFF 0%, #EEF1F8 55%, #D8DFEC 100%"}); box-shadow: 0 8px 14px -8px rgba(0,0,0,.4); }
.orb.tonight { background: radial-gradient(circle at 40% 34%, #FFFFFF 0%, #F4F1E4 55%, #E4DCC0 100%); box-shadow: 0 10px 16px -8px rgba(0,0,0,.4); }
.ripple { position: absolute; border-radius: 50%; z-index: 1; background: radial-gradient(closest-side, ${N ? "rgba(150,200,255,.35)" : "rgba(255,255,255,.55)"}, rgba(255,255,255,0)); }
.halo { position: absolute; border-radius: 50%; z-index: 1; background: radial-gradient(closest-side, rgba(255,222,140,${N ? ".4" : ".5"}), rgba(255,222,140,0)); }
.go { position: absolute; z-index: 4; height: 54px; padding: 0 22px; border-radius: 27px; background: #3D9A8B; color: #fff; display: flex; flex-direction: column; justify-content: center; box-shadow: 0 12px 24px -10px rgba(0,0,0,.5); }
.go b { font-size: 17px; font-weight: 700; line-height: 20px; } .go small { font-size: 13px; font-weight: 500; opacity: .85; line-height: 17px; }
.task { position: absolute; z-index: 3; width: 44px; height: 44px; border-radius: 50%; background: ${N ? "#26365F" : "#fff"}; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 20px -8px rgba(0,0,0,.4); }
.tabs { position: absolute; left: 18px; right: 18px; bottom: 22px; height: 70px; border-radius: 30px; background: ${N ? "#26365F" : "#fff"}; z-index: 6; display: flex; justify-content: space-around; align-items: center; box-shadow: 0 16px 34px -16px rgba(0,0,0,.45); }
.tabs div { display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 12px; font-weight: 600; color: ${N ? "#AEBADA" : "#7D8A96"}; width: 80px; } .tabs div.on { color: ${N ? "#7FE0CF" : "#3D9A8B"}; }
.orb.ringed { box-shadow: 0 0 0 4px #fff, 0 10px 16px -8px rgba(0,0,0,.4); z-index: 5; }
.orb.teal { box-shadow: 0 0 0 4px #3D9A8B, 0 0 0 9px rgba(61,154,139,.25), 0 10px 16px -8px rgba(0,0,0,.4); }
.cap { position: absolute; z-index: 4; height: 62px; padding: 0 24px 0 72px; border-radius: 31px; background: #3D9A8B; color: #fff; display: flex; flex-direction: column; justify-content: center; box-shadow: 0 12px 24px -10px rgba(0,0,0,.5); }
.cap b { font-size: 18px; font-weight: 700; line-height: 21px; } .cap small { font-size: 13px; font-weight: 500; opacity: .85; line-height: 17px; }
.bubble { position: absolute; z-index: 4; width: 132px; padding: 12px 14px 14px; border-radius: 20px; background: ${N ? "#26365F" : "#fff"}; color: ${N ? "#F1F5FF" : "#1E2A33"}; display: flex; flex-direction: column; box-shadow: 0 14px 28px -12px rgba(0,0,0,.45); }
.bubble i { position: absolute; left: -7px; top: 44px; width: 16px; height: 16px; background: inherit; transform: rotate(45deg); border-radius: 3px; }
.bubble span { font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; opacity: .6; } .bubble b { font-size: 16px; font-weight: 700; margin: 2px 0 10px; }
.bubble em { font-style: normal; height: 38px; border-radius: 19px; background: #3D9A8B; color: #fff; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.tag { position: absolute; z-index: 4; width: 100px; display: flex; justify-content: center; } .tag::before { content: "Tonight"; height: 24px; padding: 0 10px; border-radius: 12px; background: #3D9A8B; color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; }
.tag { font-size: 0; }
.wide { position: absolute; z-index: 5; left: 18px; right: 18px; bottom: 104px; height: 58px; border-radius: 29px; background: #3D9A8B; color: #fff; font-size: 17px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 14px 26px -12px rgba(0,0,0,.55); }
.wide i { width: 16px; height: 16px; border-radius: 50%; background: radial-gradient(circle at 40% 34%, #FFFFFF, #E4DCC0); box-shadow: 0 0 0 3px rgba(255,255,255,.35); }
.wide small { font-weight: 500; opacity: .85; }
.npill { position: absolute; z-index: 4; height: 70px; border-radius: 35px; padding: 0 8px 0 44px; display: flex; align-items: center; gap: 12px;
  background: ${N ? "rgba(38,54,95,.94)" : "rgba(255,255,255,.92)"}; color: ${N ? "#F1F5FF" : "#1E2A33"}; box-shadow: 0 6px 18px -12px rgba(16,42,56,.45); }
.npill span { display: flex; flex-direction: column; } .npill b { font-size: 19px; font-weight: 650; line-height: 1.15; } .npill small { font-size: 14px; font-weight: 500; opacity: .62; margin-top: 2px; }
.npill em { font-style: normal; height: 40px; padding: 0 8px 0 14px; border-radius: 20px; background: #3D9A8B; color: #fff; font-size: 15px; font-weight: 700; display: inline-flex; align-items: center; gap: 1px; box-shadow: 0 6px 14px -8px #3D9A8B; }
.orb.pulse { box-shadow: 0 0 0 6px rgba(255,255,255,.6), 0 0 0 14px rgba(61,154,139,.22), 0 0 34px 10px rgba(255,222,140,.5); z-index: 3; }
.inlight { position: absolute; z-index: 4; width: 84px; height: 84px; display: flex; align-items: center; justify-content: center; } .inlight b { font-size: 19px; font-weight: 800; color: #2F7F72; }
.under { position: absolute; z-index: 4; width: 160px; text-align: center; font-size: 13px; font-weight: 600; color: ${N ? "#DCE3F8" : "#3F4E5A"}; }
.stem { position: absolute; z-index: 3; width: 2px; height: 24px; background: ${N ? "rgba(220,230,255,.8)" : "rgba(255,255,255,.95)"}; box-shadow: 0 0 4px rgba(0,0,0,.15); }
.sign { position: absolute; z-index: 4; width: 170px; height: 46px; border-radius: 23px; background: #3D9A8B; color: #fff; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 12px 24px -10px rgba(0,0,0,.5); }
.sign b { font-size: 17px; font-weight: 700; } .sign small { font-size: 13px; font-weight: 500; opacity: .85; }
.tcard { position: absolute; z-index: 5; left: 18px; right: 18px; bottom: 102px; height: 76px; border-radius: 24px; background: ${N ? "#26365F" : "#fff"}; color: ${N ? "#F1F5FF" : "#1E2A33"}; display: flex; align-items: center; gap: 12px; padding: 0 12px 0 16px; box-shadow: 0 16px 30px -14px rgba(0,0,0,.45); }
.tcard i { width: 34px; height: 34px; border-radius: 50%; background: radial-gradient(circle at 40% 34%, #FFFFFF, #F4F1E4 55%, #E4DCC0); box-shadow: 0 0 0 3px #3D9A8B; flex: none; }
.tcard div { flex: 1; display: flex; flex-direction: column; } .tcard b { font-size: 16px; font-weight: 700; } .tcard small { font-size: 13px; opacity: .65; }
.tcard em, .say em { font-style: normal; height: 44px; padding: 0 20px; border-radius: 22px; background: #3D9A8B; color: #fff; font-size: 16px; font-weight: 700; display: flex; align-items: center; }
.say { position: absolute; z-index: 5; width: 210px; padding: 12px 12px 12px 14px; border-radius: 20px; background: ${N ? "#26365F" : "#fff"}; color: ${N ? "#F1F5FF" : "#1E2A33"}; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 14px 28px -12px rgba(0,0,0,.45); }
.say i { position: absolute; left: 112px; top: -7px; width: 16px; height: 16px; background: inherit; transform: rotate(45deg); border-radius: 3px; }
.say span { font-size: 15px; font-weight: 700; } .say em { align-self: flex-start; }
`;
if (process.argv[3] === "start") { // the board of ways to tie Start to tonight's light
  const phone = (kind) => `<div class="phone" style="background:url(${TILE_URL}) 0 0 / 390px auto repeat-y">
  <div class="hdr"><div class="hl">${flame}<b>59</b></div><div class="hc">Voyage 9 <span>· 3/7</span></div><div class="hr"><div class="ava"><img src="${OTTER}"></div></div></div>
  ${week(...({ C: [112], D: [126, { gap: 30 }], E: [104, { gap: 62 }], F: [96, { step: 66 }], G: [130, { X: [160, 236, 168, 204, 290, 250, 196], gap: 20, step: 70 }], H: [150, { X: [168, 236, 160, 128, 182, 246, 190], bx: 62 }] }[kind] || [150]).map((v, i) => i === 0 ? v : v).flatMap((v, i, a) => i === 0 ? [v, 3, true, kind] : [v]))}
  <div class="task" style="left:318px;top:${kind === "B" ? 230 : 280}px">${icon("pencil", { size: 19, color: "#C9962E", sw: 2.2 })}</div>
  ${kind === "C" ? `<div class="wide"><i></i>Start tonight <small>· 14 questions</small></div>` : ""}
  ${kind === "F" ? `<div class="tcard"><i></i><div><b>Tonight · Wed</b><small>14 questions · about 2 min</small></div><em>Start</em></div>` : ""}
  ${tabs()}</div>`;
  const cols = process.argv[4] === "app"
    ? [["H", `Как сейчас в приложении · ${N ? "ночь" : "день"}`, "Белая плашка растёт прямо из сегодняшнего огонька: «Tonight · 14 questions» и бирюзовая кнопка «Start ›» внутри."]]
    : process.argv[4] === "more"
    ? [["A", "A · Огонёк в кнопке", "Из прошлого раза, для сравнения."],
       ["D", "D · Огонёк и есть кнопка", "Большой сегодняшний огонёк, внутри написано Start. Нажимаешь прямо на него."],
       ["E", "E · Буёк с табличкой", "От огонька вниз тянется ниточка, на ней табличка Start, как на буйке."],
       ["F", "F · Карточка вечера", "Внизу карточка с таким же огоньком: «Tonight · Wed», Start. Огонёк на пути обведён тем же цветом."],
       ["G", "G · Зовёт твой зверёк", "Твой зверёк в лодке говорит: «Tonight · 14 questions» и кнопка «Let's go»."]]
    : [["old", "Было", "Плашка висит между лодкой и огоньком: непонятно, чья она."],
    ["A", "A · Огонёк в кнопке", "Сегодняшний огонёк сидит прямо в кнопке Start. Нажимаешь на огонёк или на кнопку — одно и то же."],
    ["B", "B · Облачко от огонька", "Облачко с хвостиком показывает на огонёк: «Tonight · 14 questions · Start»."],
    ["C", "C · Подпись + большая кнопка", "Огонёк подписан «Tonight», внизу одна широкая кнопка «Start tonight». Связаны словом и цветом."]];
  const board = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="board">
<h1>К чему относится Start</h1>
<div class="sub">${process.argv[4] === "more" ? "Ещё четыре способа показать, что Start — это сегодняшний огонёк." : "Три способа сразу показать, что Start — это сегодняшний огонёк."}</div>
<div class="brow">${cols.map(([k, t, c]) => `<div class="col" id="k${k}">${phone(k)}<div class="ct">${t}</div><div class="cc">${c}</div></div>`).join("")}</div>
</div></body></html>`;
  const tag = process.argv[4] === "app" ? "42-start-app" : process.argv[4] === "more" ? "41-start-more" : "40-start";
  const pg = path.join(OUT, `sources/${tag}-${MODE}.html`);
  writeFileSync(pg, board);
  await p.setViewportSize({ width: 2500, height: 1300 });
  await p.goto(pathToFileURL(pg).href); await p.waitForTimeout(900);
  await p.locator(".board").screenshot({ path: path.join(OUT, `${tag}-${MODE}.png`) });
  if (process.argv[4] === "app") await p.locator("#kH .phone").screenshot({ path: path.join(OUT, "39-today-sea", `today-start-app-${MODE}.png`) });
  await b.close();
  console.log("start board ok");
  process.exit(0);
}
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="board">
<h1>Today ${N ? "ночью" : "днём"} на твоём море</h1>
<div class="sub">Море повторяется вниз без шва, поэтому неделю за неделей можно листать бесконечно. Острова у краёв, путь огоньков посередине.</div>
<div class="brow">
  <div class="col">${today}<div class="ct">Today</div><div class="cc">След лодки через огоньки прошлых вечеров, сегодняшний огонёк со Start, сундук на островке в конце недели.</div></div>
  <div class="col">${strip}<div class="ct">Как листается</div><div class="cc">Три повтора твоей картинки подряд. Оранжевые метки — места стыков: шва не видно.</div></div>
</div></div></body></html>`;
const page = path.join(OUT, `sources/39-today-sea-${MODE}.html`);
writeFileSync(page, html);
await p.goto(pathToFileURL(page).href); await p.waitForTimeout(900);
await p.locator(".board").screenshot({ path: path.join(OUT, `39-today-sea-${MODE}.png`) });
await p.locator(".phone").screenshot({ path: path.join(OUT, "39-today-sea", `today-${MODE}.png`) });
await b.close();
console.log("ok", tile.W, tile.H, f1(TH));
