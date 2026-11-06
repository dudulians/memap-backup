// Storyline v2 boards 60–61 (Nov 6 2026, her notes on 58–59). Helpers from make-storyline.mjs.
// Run from marketing/tools: node make-storyline-v2.mjs
// Run from marketing/tools: node make-onboarding.mjs
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const url = (p) => pathToFileURL(path.join(R, p)).href;
const OUT = path.join(R, "marketing/aurora-light-ux");
const SHOTS = path.join(OUT, "60-storyline-v2");
mkdirSync(SHOTS, { recursive: true });

const icon = (name, { size = 24, sw = 2, color = "currentColor" } = {}) => {
  let src = readFileSync(path.join(R, `node_modules/lucide-react/dist/esm/icons/${name}.js`), "utf8");
  // an old name re-exports the new one
  for (let k = 0; k < 3 && !src.includes("createLucideIcon("); k++) {
    const to = src.match(/from ["']\.\/([\w-]+)\.js["']/);
    if (!to) break;
    src = readFileSync(path.join(R, `node_modules/lucide-react/dist/esm/icons/${to[1]}.js`), "utf8");
  }
  const nodes = Function(`return ${src.match(/createLucideIcon\("[^"]+", (\[[\s\S]*\])\);/)[1]}`)();
  const kids = nodes.map(([t, a]) => `<${t} ${Object.entries(a).filter(([k]) => k !== "key").map(([k, v]) => `${k}="${v}"`).join(" ")}/>`).join("");
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${kids}</svg>`;
};
const ISL = (n) => url(`src/assets/globe/day/${n}.webp`);
const ANI = (n) => url(`src/assets/avatars/${n}.webp`);
const BOAT = url("src/assets/map/sailboat.webp");
const PLANET = url("src/assets/globe/planet-day.webp");
const FONT = url("src/assets/fonts/manrope-latin-wght-normal.woff2");
const TEAL = "174 44% 42%";

const CSS = `
@font-face { font-family: DM; src: url(${FONT}) format("woff2"); font-weight: 100 900; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { width: 390px; height: 844px; overflow: hidden; position: relative; font-family: DM, sans-serif; color: #3A3F4E; -webkit-font-smoothing: antialiased; }
.sea { position: absolute; inset: 0; background: #B4CDF8 url(${PLANET}) no-repeat; background-size: 2767px auto; background-position: -1014px -31px; }
.status { position: absolute; top: 0; left: 0; right: 0; height: 47px; display: flex; align-items: center; justify-content: space-between; padding: 0 28px 0 34px; font-weight: 700; font-size: 16px; }
.screen { position: absolute; inset: 0; padding: 63px 20px 40px; display: flex; flex-direction: column; }
h1 { font-size: 30px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.12; }
.c { text-align: center; }
.sub { margin-top: 8px; font-size: 17px; font-weight: 600; color: #6B7184; line-height: 1.35; }
.grow { flex: 1; }
.card { background: rgba(255,255,255,.95); border-radius: 22px; box-shadow: 0 10px 24px -18px rgba(30,50,110,.6); }
.btn { height: 56px; border-radius: 999px; background: hsl(${TEAL}); color: #fff; font-weight: 800; font-size: 17px; box-shadow: 0 5px 0 hsl(172 70% 30%);
  display: flex; align-items: center; justify-content: center; gap: 8px; }
.link { height: 48px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; color: #6B7184; }
.dots { display: flex; gap: 6px; justify-content: center; height: 44px; align-items: center; position: relative; }
.dots i { width: 8px; height: 8px; border-radius: 4px; background: rgba(30,47,58,.22); }
.dots i.on { width: 22px; background: hsl(${TEAL}); }
.back { position: absolute; left: 0; top: 0; width: 44px; height: 44px; border-radius: 22px; background: rgba(255,255,255,.7); display: flex; align-items: center; justify-content: center; }
.row { display: flex; align-items: center; gap: 12px; padding: 0 16px; height: 62px; font-size: 18px; font-weight: 700; }
.row + .row { margin-top: 10px; }
.tile { width: 40px; height: 40px; border-radius: 20px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.row.on { box-shadow: 0 0 0 2px hsl(${TEAL}), 0 10px 24px -18px rgba(30,50,110,.6); }
.tick { margin-left: auto; width: 26px; height: 26px; border-radius: 13px; background: hsl(${TEAL}); display: flex; align-items: center; justify-content: center; }
.dash { border: 1.5px dashed rgba(30,47,58,.28); border-radius: 18px; height: 50px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; color: #3A4E63; background: rgba(255,255,255,.35); }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { height: 44px; padding: 0 18px; border-radius: 999px; background: rgba(255,255,255,.95); font-size: 17px; font-weight: 600; display: inline-flex; align-items: center; box-shadow: 0 8px 18px -14px rgba(30,50,110,.6); }
.chip.on { background: #fff; box-shadow: 0 0 0 2px hsl(${TEAL}); color: #3A3F4E; font-weight: 800; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.big { height: 64px; border-radius: 20px; font-size: 18px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.big.on { background: #fff; box-shadow: 0 0 0 2px hsl(${TEAL}); color: #3A3F4E; font-weight: 800; }
.fork { display: flex; align-items: center; gap: 16px; padding: 0 20px; height: 112px; font-size: 22px; font-weight: 800; line-height: 1.2; }
.fork .tile { width: 56px; height: 56px; border-radius: 28px; }
.fork.on { box-shadow: 0 0 0 2px hsl(${TEAL}), 0 10px 24px -18px rgba(30,50,110,.6); }
.disc { position: absolute; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.disc::after { content: ""; position: absolute; left: 20%; right: 20%; top: 9%; height: 34%; border-radius: 50%; background: linear-gradient(rgba(255,255,255,.5), rgba(255,255,255,0)); }
.disc.done { background: linear-gradient(180deg, #FFD866, #F6B92B); box-shadow: 0 6px 0 #CF8E17; color: #fff; }
.disc.todo { background: #fff; box-shadow: 0 6px 0 #D3DAE8; }
.disc.lock { background: #E4E8F1; box-shadow: 0 6px 0 #C6CEDD; color: #A3ACC0; }
.ring { position: absolute; border-radius: 50%; border: 6px solid rgba(255,255,255,.78); }
.lab { position: absolute; transform: translateX(-50%); white-space: nowrap; height: 28px; padding: 0 11px; border-radius: 14px; background: rgba(255,255,255,.95); font-size: 14px; font-weight: 700;
  display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 6px 14px -8px rgba(20,50,90,.5); }
.lab.dim { opacity: .7; }
.startb { position: absolute; transform: translate(-50%, -100%); height: 46px; padding: 0 20px; border-radius: 16px; background: #fff; color: hsl(${TEAL}); font-size: 18px; font-weight: 800;
  display: flex; align-items: center; box-shadow: 0 10px 22px -12px rgba(16,42,56,.55); }
.startb::after { content: ""; position: absolute; left: 50%; bottom: -6px; width: 14px; height: 14px; margin-left: -7px; background: #fff; border-radius: 0 0 4px 0; transform: rotate(45deg); }
.boat { position: absolute; }
.boat img.b { width: 100%; display: block; }
.boat img.who { position: absolute; left: 48%; top: 40%; width: 42%; }
.isle { position: absolute; transform: translate(-50%, -70%); }
.isle img { width: 100%; display: block; filter: drop-shadow(0 6px 8px rgba(20,60,100,.25)); }
.coachdim { position: absolute; inset: 0; z-index: 3; background: rgba(14, 24, 60, .42); }
.coach { position: absolute; z-index: 4; left: 20px; right: 20px; padding: 18px 18px 14px; background: #fff !important; }
.coach .t { font-size: 22px; font-weight: 800; }
.coach .s { margin-top: 4px; font-size: 16px; font-weight: 600; color: #6B7184; }
.coach .ok { margin-top: 12px; height: 46px; border-radius: 999px; background: hsl(${TEAL}); color: #fff; font-weight: 800; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 0 hsl(172 70% 30%); }
.coach .tail { position: absolute; width: 18px; height: 18px; background: #fff; transform: rotate(45deg); border-radius: 3px; }
.tabbar { z-index: 2; position: absolute; left: 16px; right: 16px; bottom: 16px; height: 66px; border-radius: 24px; background: rgba(255,255,255,.92); display: grid; grid-template-columns: repeat(3, 1fr); box-shadow: 0 10px 30px -16px rgba(20,40,80,.4); }
.tabbar div { display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: #6A7B8E; gap: 2px; }
.tabbar div.on { color: #3A3F4E; background: rgba(30,47,58,.06); border-radius: 20px; margin: 4px; }
.head { position: absolute; top: 47px; left: 0; right: 0; height: 52px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; }
.head .l { position: absolute; left: 14px; height: 36px; padding: 0 12px 0 9px; border-radius: 18px; background: #fff; display: flex; align-items: center; gap: 4px; font-size: 16px; }
.head .r { position: absolute; right: 16px; width: 34px; height: 34px; }
.swipe { position: absolute; left: 22px; right: 22px; border-radius: 26px; background: #fff; box-shadow: 0 18px 40px -22px rgba(20,40,90,.6); }
.toggle { margin-left: auto; width: 50px; height: 30px; border-radius: 15px; background: hsl(${TEAL}); position: relative; }
.toggle::after { content: ""; position: absolute; right: 3px; top: 3px; width: 24px; height: 24px; border-radius: 12px; background: #fff; }
.seg { position: absolute; right: 18px; top: 54px; height: 36px; border-radius: 18px; background: rgba(255,255,255,.75); display: flex; padding: 3px; font-size: 14px; font-weight: 800; }
.seg span { padding: 0 12px; display: flex; align-items: center; border-radius: 15px; color: #6B7184; }
.seg span.on { background: #fff; color: #3A3F4E; box-shadow: 0 2px 6px rgba(20,40,80,.15); }
.stat { flex: 1; padding: 12px 8px; text-align: center; }
.stat b { display: block; font-size: 28px; font-weight: 800; letter-spacing: -.02em; }
.stat span { font-size: 14px; font-weight: 700; color: #6B7184; }
.goldchip { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 14px; border-radius: 17px; background: #fff; font-weight: 800; font-size: 15px; box-shadow: 0 8px 18px -12px rgba(160,110,20,.55); }
.wk { font-size: 13px; font-weight: 800; letter-spacing: .08em; color: rgba(30,47,58,.55); text-align: center; }
.route circle { fill: #fff; stroke: rgba(70,100,170,.28); stroke-width: 1; }
`;
const status = `<div class="status"><span>9:41</span><span style="display:flex;gap:6px;align-items:center">${icon("signal", { size: 17, sw: 2.6 })}${icon("wifi", { size: 17, sw: 2.6 })}${icon("battery-full", { size: 22, sw: 2 })}</span></div>`;
const page = (body, extra = "") => `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}${extra}</style></head><body><div class="sea"></div>${status}${body}</body></html>`;

// a raised disc at (x, y) with radius r
const disc = (x, y, r, kind, inner = "", color = "") =>
  `<div class="disc ${kind}" style="left:${x - r}px;top:${y - r}px;width:${2 * r}px;height:${2 * r}px;${color}"><span style="position:relative;z-index:1;display:flex">${inner}</span></div>`;
const cur = (x, y, r, hue, inner) => `<div class="ring" style="left:${x - r - 12}px;top:${y - r - 12}px;width:${2 * r + 24}px;height:${2 * r + 24}px"></div>` +
  disc(x, y, r, "", inner, `background:hsl(${hue});box-shadow:0 6px 0 rgba(0,0,0,.22), 0 6px 0 hsl(${hue});color:#fff;`);
const lab = (x, y, text, dim = false) => `<span class="lab${dim ? " dim" : ""}" style="left:${x}px;top:${y}px">${text}</span>`;
const boat = (x, y, w, who = "11_otter") => `<div class="boat" style="left:${x}px;top:${y}px;width:${w}px"><img class="b" src="${BOAT}">${who ? `<img class="who" src="${ANI(who)}">` : ""}</div>`;
const isle = (x, y, w, name) => `<div class="isle" style="left:${x}px;top:${y}px;width:${w}px"><img src="${ISL(name)}"></div>`;
const tabbar = (on) => `<div class="tabbar">${[["calendar-days", "Today"], ["earth", "World"], ["notebook-pen", "Notes"]].map(([i, t], k) => `<div class="${k === on ? "on" : ""}">${icon(i, { size: 20 })}${t}</div>`).join("")}</div>`;
const head = (title, flame = "") => `<div class="head">${flame ? `<span class="l">${icon("flame", { size: 18, color: "#F59E0B" })}${flame}</span>` : ""}${title}<img class="r" src="${ANI("11_otter")}"></div>`;
const tile = (ic, hue) => `<span class="tile" style="background:hsl(${hue} / .16);color:hsl(${hue})">${icon(ic, { size: 22, sw: 2.2 })}</span>`;
const route = (pts) => `<svg class="route" style="position:absolute;inset:0" width="390" height="844">${pts.map(([x, y, r, o]) => `<circle cx="${x}" cy="${y}" r="${r}" opacity="${o}"/>`).join("")}</svg>`;
const dotsAlong = (a, m, b, n = 16) => Array.from({ length: n }, (_, i) => {
  const t = (i + 0.5) / n, u = 1 - t;
  const x = u * u * a[0] + 2 * u * t * m[0] + t * t * b[0], y = u * u * a[1] + 2 * u * t * m[1] + t * t * b[1];
  const e = Math.min(1, Math.min(t, 1 - t) / 0.16);
  return [x.toFixed(1), y.toFixed(1), (1.6 + 1.8 * e).toFixed(2), (0.35 + 0.65 * e).toFixed(2)];
});

const HUE = { love: "340 62% 64%", health: "174 44% 42%", me: "262 48% 62%", work: "212 60% 56%", amber: "36 86% 56%", sleep: "232 62% 62%", coral: "16 72% 62%", lilac: "290 40% 62%" };


// ---- Storyline proposal (Nov 6 2026). Her tester: "ничего не понятно: ценность, связь разделов,
// что есть остров, что есть категория, как работать, цель". Her ask: start with value, more
// examples, explain; propose first, don't change the app. One chain everywhere:
// Answer → See → Try. Screens English (her rule), notes under them Russian.
const MAP = (n) => url(`src/assets/map/${n}.webp`);
const IND = "#5B5FC7", LAV = "#DCD9F6", EMPTY = "#E7EAF1", AMB = "hsl(36 86% 56%)";
const EXTRA = `
.ex { display: inline-flex; align-items: center; height: 26px; padding: 0 10px; border-radius: 13px; background: rgba(91,95,199,.12); color: ${IND}; font-size: 13px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
.blk { padding: 14px 16px; }
.blk + .blk { margin-top: 12px; }
.num { display: inline-flex; width: 26px; height: 26px; border-radius: 13px; background: hsl(${TEAL}); color: #fff; font-size: 15px; font-weight: 800; align-items: center; justify-content: center; margin-right: 8px; }
.bt { display: flex; align-items: center; font-size: 19px; font-weight: 800; }
.bl { margin-top: 3px; font-size: 15px; font-weight: 600; color: #6B7184; line-height: 1.3; }
.drow { display: flex; align-items: center; gap: 4px; margin-top: 8px; }
.drow .k { width: 92px; font-size: 13px; font-weight: 700; color: #6B7184; flex-shrink: 0; }
.drow i { width: 14px; height: 14px; border-radius: 7px; background: ${EMPTY}; display: block; }
.result { margin-top: 10px; display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 800; }
.pill { display: inline-flex; align-items: center; height: 26px; padding: 0 10px; border-radius: 13px; background: #fff; font-weight: 800; font-size: 14px; box-shadow: 0 0 0 1.5px rgba(91,95,199,.35); color: ${IND}; }
.yn { display: flex; gap: 8px; margin-top: 10px; }
.yn span { flex: 1; height: 40px; border-radius: 14px; background: rgba(58,63,78,.06); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; }
.yn span.on { background: #fff; box-shadow: 0 0 0 2px hsl(${TEAL}); }
.itag { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: #6B7184; }
.itag b { width: 10px; height: 10px; border-radius: 5px; display: block; }
.qcard { padding: 12px 16px 14px; }
.qcard + .qcard { margin-top: 10px; }
.qcard .q { margin-top: 4px; font-size: 18px; font-weight: 800; }
.tl { position: relative; padding: 6px 16px 6px 16px; }
.tl .r { display: flex; gap: 14px; align-items: flex-start; padding: 10px 0; position: relative; }
.tl .r .d { width: 36px; height: 36px; border-radius: 18px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; position: relative; z-index: 1; }
.tl .r .d.g { background: linear-gradient(180deg,#FFD866,#F6B92B); color: #fff; box-shadow: 0 3px 0 #CF8E17; }
.tl .r .d.w { background: #fff; box-shadow: 0 0 0 2px rgba(58,63,78,.14); color: #6B7184; }
.tl .line { position: absolute; left: 33px; top: 30px; bottom: 30px; width: 2px; background: rgba(58,63,78,.12); }
.tl .when { font-size: 13px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #6B7184; }
.tl .what { font-size: 18px; font-weight: 800; margin-top: 1px; }
.tl .why { font-size: 15px; font-weight: 600; color: #6B7184; }
.ilab { z-index: 2; position: absolute; transform: translateX(-50%); white-space: nowrap; padding: 5px 12px; border-radius: 14px; background: #fff; font-size: 14px; font-weight: 800; text-align: center; line-height: 1.2; box-shadow: 0 6px 14px -8px rgba(20,50,90,.5); }
.ilab small { display: block; font-size: 13px; font-weight: 600; color: #6B7184; }
.badge { z-index: 3; position: absolute; transform: translate(-50%,-50%); height: 30px; padding: 0 11px; border-radius: 15px; background: #fff; display: flex; align-items: center; gap: 5px; font-weight: 800; font-size: 14px; color: ${IND}; box-shadow: 0 6px 14px -6px rgba(20,50,90,.5); }
.qbadge { z-index: 3; position: absolute; transform: translate(-50%,-50%); width: 30px; height: 30px; border-radius: 15px; background: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; color: #6B7184; box-shadow: 0 6px 14px -6px rgba(20,50,90,.5); }
.chain { display: flex; gap: 6px; }
.chain span { height: 28px; padding: 0 9px; border-radius: 14px; background: rgba(58,63,78,.06); display: flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 800; color: #9AA0B0; }
.chain span.on { background: hsl(${TEAL} / .14); color: hsl(172 60% 30%); }
.chain span.done { color: hsl(172 60% 30%); }
.wcards { position: absolute; top: 108px; left: 16px; right: 16px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
.wcards .card { height: 104px; padding: 10px 10px; }
.wcards .h { font-size: 13px; font-weight: 800; color: #6B7184; }
.cal { display: grid; grid-template-columns: repeat(7, 10px); gap: 4px; margin-top: 8px; }
.cal i { width: 10px; height: 10px; border-radius: 5px; background: ${LAV}; display: block; }
.coachc { position: absolute; z-index: 5; left: 16px; right: 16px; padding: 16px 16px 14px; border-radius: 24px; background: #fff; box-shadow: 0 18px 40px -16px rgba(10,20,60,.55); }
.coachc .t { margin-top: 10px; font-size: 22px; font-weight: 800; line-height: 1.15; letter-spacing: -.01em; }
.coachc .s { margin-top: 4px; font-size: 16px; font-weight: 600; color: #6B7184; line-height: 1.3; }
.coachc .ft { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; }
.coachc .skip { font-weight: 700; color: #6B7184; font-size: 16px; }
.coachc .nx { height: 44px; padding: 0 22px; border-radius: 999px; background: hsl(${TEAL}); color: #fff; font-weight: 800; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 0 hsl(172 70% 30%); }
.exbox { margin-top: 10px; padding: 10px 12px; border-radius: 16px; background: rgba(58,63,78,.04); }
.sheet { position: absolute; left: 0; right: 0; bottom: 0; top: 70px; background: #fff; border-radius: 30px 30px 0 0; padding: 14px 20px 20px; box-shadow: 0 -10px 30px -16px rgba(10,20,60,.4); }
.grab { width: 40px; height: 5px; border-radius: 3px; background: rgba(58,63,78,.18); margin: 0 auto 14px; }
.leg { display: flex; align-items: center; gap: 12px; padding: 7px 0; }
.leg .pic { width: 52px; height: 40px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.leg .pic img { max-width: 52px; max-height: 40px; }
.leg b { font-size: 16px; font-weight: 800; display: block; }
.leg span { font-size: 14px; font-weight: 600; color: #6B7184; }
.step3 { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 18px; background: rgba(58,63,78,.04); }
.step3 + .step3 { margin-top: 8px; }
.step3 .ic { width: 44px; height: 44px; border-radius: 22px; background: hsl(${TEAL} / .14); color: hsl(172 60% 30%); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.step3 b { font-size: 18px; font-weight: 800; display: block; }
.step3 span { font-size: 14px; font-weight: 600; color: #6B7184; }
.step3 .tab { margin-left: auto; font-size: 12px; font-weight: 800; color: #6B7184; text-transform: uppercase; letter-spacing: .05em; text-align: right; }
`;
const P = (body) => page(body, EXTRA);
// 14 days of an example: short nights, and migraines the day after 5 of them
const SHORT = [1, 4, 6, 9, 11, 12], MIG = [2, 5, 7, 10, 12];
const drow = (k, on, col) => `<div class="drow"><span class="k">${k}</span>${Array.from({ length: 14 }, (_, i) => `<i style="${on.includes(i) ? `background:${col}` : `background:${LAV}`}"></i>`).join("")}</div>`;
const dotted = (a, m, b, n = 18, col = "#fff") => `<svg style="position:absolute;inset:0;z-index:1" width="390" height="844">${dotsAlong(a, m, b, n).map(([x, y, r, o]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}" opacity="${o}" stroke="rgba(70,100,170,.3)" stroke-width="1"/>`).join("")}</svg>`;
const ilab = (x, y, a, b = "") => `<div class="ilab" style="left:${x}px;top:${y}px">${a}${b ? `<small>${b}</small>` : ""}</div>`;
const navTop = (n, of = 6) => `<div style="position:relative;height:44px"><span class="back">${icon("chevron-left", { size: 22, sw: 2.4 })}</span><div class="dots">${Array.from({ length: of }, (_, i) => `<i class="${i === n ? "on" : ""}"></i>`).join("")}</div></div>`;
// a veil with holes ({x,y,w,h,r}) and a white ring around each
const veil = (holes) => `<svg style="position:absolute;inset:0;z-index:4" width="390" height="844"><defs><mask id="m"><rect width="390" height="844" fill="#fff"/>${holes.map((h) => `<rect x="${h.x}" y="${h.y}" width="${h.w}" height="${h.h}" rx="${h.r}" fill="#000"/>`).join("")}</mask></defs><rect width="390" height="844" fill="rgba(14,24,60,.5)" mask="url(#m)"/>${holes.map((h) => `<rect x="${h.x - 3}" y="${h.y - 3}" width="${h.w + 6}" height="${h.h + 6}" rx="${h.r + 3}" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="3"/>`).join("")}</svg>`;
const chain = (on) => `<div class="chain">${["Track", "Links", "Act", "Try"].map((w, i) => `<span class="${i === on ? "on" : i < on ? "done" : ""}">${i < on ? icon("check", { size: 13, sw: 3 }) : `${i + 1}`} ${w}</span>`).join("")}</div>`;
const coach = (top, on, t, s, ex = "", last = false) => `<div class="coachc" style="top:${top}px">${chain(on)}<div class="t">${t}</div><div class="s">${s}</div>${ex}<div class="ft"><span class="skip">Skip</span><span class="nx">${last ? "Done" : "Next"} ${icon("arrow-right", { size: 18, sw: 2.6 })}</span></div></div>`;
// the World page: three cards, the sea with her islands, the boat
const world = (extra = "") => `
  <div style="position:absolute;top:58px;left:20px;font-size:30px;font-weight:800;letter-spacing:-.02em">World</div>
  <div class="seg" style="top:62px"><span class="on">Map</span><span>Globe</span></div>
  <div class="wcards">
    <div class="card"><div class="h">Migraine days</div><div class="cal">${Array.from({ length: 21 }, (_, i) => `<i style="${[2, 5, 7, 10, 12, 16].includes(i) ? `background:${IND}` : i > 17 ? `background:${EMPTY}` : ""}"></i>`).join("")}</div></div>
    <div class="card"><div class="h">Your weeks</div><svg width="90" height="56" style="margin-top:8px">${[18, 30, 22, 34, 14, 10].map((v, i) => `<rect x="${i * 15}" y="${56 - v}" width="10" height="${v}" rx="5" fill="${IND}" opacity="${0.45 + i * 0.1}"/>`).join("")}</svg></div>
    <div class="card"><div class="h">Action points</div><div style="display:flex;align-items:center;gap:6px;margin-top:10px"><img src="${MAP("lighthouse")}" style="height:44px"><b style="font-size:20px">0<span style="font-size:14px;color:#6B7184"> of 1</span></b></div></div>
  </div>
  ${isle(92, 420, 128, "19_grassy_terraces")}${ilab(92, 432, "Body", "sleep · meals")}
  ${isle(300, 410, 120, "06_snow_peak")}${ilab(300, 420, "Work", "stress")}
  ${isle(200, 566, 160, "09_waterfall")}${ilab(200, 580, "Health", "migraines")}
  <img src="${ISL("cloud_island_03")}" style="position:absolute;left:290px;top:600px;width:96px;opacity:.9">
  ${boat(40, 600, 78)}
  ${extra}${tabbar(1)}`;


// ---- v2 (her notes, Nov 6 2026): a plain explanation instead of the riddle; value and
// method first, choices after; her loop shown at once: track → links → when to act →
// try what helps, and MeMap supports you; main question apart from the ones around it;
// "these are examples, change them or write your own"; calendars instead of animals;
// the good side clearer; adding questions visible.
const TEALD = "hsl(172 60% 30%)";
const step = (n, ic, title, line, ex) => `<div class="card" style="padding:12px 14px;display:flex;gap:12px;align-items:flex-start">
  <span class="tile" style="background:hsl(${TEAL} / .14);color:${TEALD};margin-top:2px">${icon(ic, { size: 21, sw: 2.3 })}</span>
  <div style="min-width:0;flex:1"><div style="font-size:18px;font-weight:800">${n} · ${title}</div>${line ? `<div style="font-size:14px;font-weight:600;color:#6B7184;line-height:1.3;margin-top:1px">${line}</div>` : ""}${ex ? `<div style="margin-top:8px">${ex}</div>` : ""}</div></div>`;
const minichips = (xs) => `<div style="display:flex;flex-wrap:wrap;gap:5px">${xs.map((x, i) => `<span style="height:24px;padding:0 9px;border-radius:12px;font-size:13px;font-weight:800;display:inline-flex;align-items:center;${i === 0 ? `background:${IND};color:#fff` : "background:rgba(58,63,78,.07)"}">${x}</span>`).join("")}</div>`;
const exline = (txt, pill) => `<div style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:800">${icon("spline", { size: 15, sw: 2.6, color: IND })}${txt}${pill ? ` <span class="pill" style="height:22px;font-size:12px;padding:0 8px">${pill}</span>` : ""}</div>`;
// a month as dots (5 weeks): on = indices with "yes"
const month = (on, { size = 13, gap = 5, col = IND, ring = [] } = {}) => `<div style="display:grid;grid-template-columns:repeat(7,${size}px);gap:${gap}px">${Array.from({ length: 35 }, (_, i) => i > 30 ? `<i style="width:${size}px;height:${size}px"></i>` : `<i style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${on.includes(i) ? col : LAV};${ring.includes(i) ? `box-shadow:0 0 0 2px #fff, 0 0 0 4px ${AMB}` : ""}"></i>`).join("")}</div>`;
const OCT = [3, 6, 9, 10, 13, 16, 20, 23, 27], SHORTN = [2, 5, 8, 12, 15, 18, 26];
const notif = (title, body, time = "20:00") => `<div style="background:rgba(255,255,255,.9);border-radius:22px;padding:12px 14px;display:flex;gap:10px;box-shadow:0 12px 26px -16px rgba(20,40,90,.55)">
  <img src="${url("src/assets/memap-icon-192.png")}" style="width:38px;height:38px;border-radius:10px;flex-shrink:0"><div style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between;font-size:14px;font-weight:800">MeMap<span style="font-weight:600;color:#6B7184">${time}</span></div>
  <div style="font-size:15px;font-weight:700;line-height:1.3;margin-top:1px">${title}</div><div style="font-size:14px;font-weight:600;color:#6B7184;line-height:1.3">${body}</div></div></div>`;
const qrow = (h, isl, q, on) => `<div class="card" style="padding:10px 14px;display:flex;align-items:center;gap:10px"><span class="itag" style="width:62px;flex-shrink:0"><b style="background:hsl(${h})"></b>${isl}</span><span style="flex:1;font-size:16px;font-weight:700;line-height:1.25">${q}</span>${on ? `<span class="tick" style="margin-left:0">${icon("check", { size: 15, sw: 3, color: "#fff" })}</span>` : `<span style="width:26px;height:26px;border-radius:13px;box-shadow:inset 0 0 0 2px rgba(58,63,78,.2)"></span>`}</div>`;
// World for the energy example
const worldE = (extra = "") => `
  <div style="position:absolute;top:58px;left:20px;font-size:30px;font-weight:800;letter-spacing:-.02em">World</div>
  <div class="seg" style="top:62px"><span class="on">Map</span><span>Globe</span></div>
  <div class="wcards">
    <div class="card"><div class="h">Energy days</div><div class="cal">${Array.from({ length: 21 }, (_, i) => `<i style="${[1, 2, 5, 8, 9, 12, 15, 16].includes(i) ? `background:${IND}` : i > 17 ? `background:${EMPTY}` : ""}"></i>`).join("")}</div></div>
    <div class="card"><div class="h">Your weeks</div><svg width="90" height="56" style="margin-top:8px">${[14, 18, 16, 26, 30, 36].map((v, i) => `<rect x="${i * 15}" y="${56 - v}" width="10" height="${v}" rx="5" fill="${IND}" opacity="${0.45 + i * 0.1}"/>`).join("")}</svg></div>
    <div class="card"><div class="h">Action points</div><div style="display:flex;align-items:center;gap:6px;margin-top:10px"><img src="${MAP("lighthouse")}" style="height:44px"><b style="font-size:20px">0<span style="font-size:14px;color:#6B7184"> of 1</span></b></div></div>
  </div>
  ${isle(92, 420, 128, "19_grassy_terraces")}${ilab(92, 432, "Body", "walks · sleep")}
  ${isle(300, 410, 120, "06_snow_peak")}${ilab(300, 420, "Work", "late hours")}
  ${isle(200, 566, 160, "17_lavender_garden")}${ilab(200, 580, "Me", "energy")}
  <img src="${ISL("cloud_island_03")}" style="position:absolute;left:290px;top:600px;width:96px;opacity:.9">
  ${boat(40, 600, 78)}
  ${extra}${tabbar(1)}`;

const screens = {
  // 1 · what MeMap does, in plain words: her loop, each step with an example
  "v1-what": P(`<div class="seg"><span class="on">EN</span><span>RU</span></div>
    <div class="screen" style="padding-top:104px">
      <h1 style="font-size:28px">See what affects your days — and change it</h1>
      <div class="sub" style="margin-top:6px">A few yes/no questions each evening. MeMap does the rest.</div>
      <div style="display:flex;flex-direction:column;gap:9px;margin-top:16px">
        ${step(1, "check-check", "Track your main thing", "", minichips(["Headache", "Sleep", "Coffee", "Stress", "+ yours"]))}
        ${step(2, "spline", "Find what goes with it", "", exline("Short night → headache", "6 of 7"))}
        ${step(3, "signpost", "Know when to act", "", `<div style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:800"><img src="${MAP("lighthouse")}" style="height:22px">8+ headache days → see a doctor</div>`)}
        ${step(4, "flask-conical", "Try what helps", "", `<div style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:800">${icon("moon", { size: 15, sw: 2.4 })} In bed by 11 · headaches <span class="pill" style="height:22px;font-size:12px;padding:0 8px">9 → 3</span></div>`)}
      </div>
      <div class="card" style="margin-top:9px;padding:12px 14px;display:flex;align-items:center;gap:12px;font-size:16px;font-weight:800"><span class="tile" style="background:hsl(${TEAL} / .14);color:${TEALD}">${icon("bell-ring", { size: 21, sw: 2.3 })}</span>All along: MeMap reminds you and cheers you on</div>
      <div class="grow"></div>
      <div class="btn">See an example ${icon("arrow-right", { size: 20, sw: 2.6 })}</div>
    </div>`),

  // 2 · the method on one example, with calendars (labelled Example)
  "v2-example": P(`<div class="screen">${navTop(1, 8)}
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px"><h1 style="font-size:26px">How it works</h1><span class="ex">Example</span></div>
    <div class="card blk" style="margin-top:12px"><div class="bt"><span class="num">1</span>October: she tracks</div>
      <div style="display:flex;gap:14px;margin-top:10px;align-items:flex-start">${month(OCT, { ring: SHORTN })}
        <div style="font-size:13px;font-weight:700;color:#6B7184;line-height:1.5"><div><i style="display:inline-block;width:11px;height:11px;border-radius:6px;background:${IND};vertical-align:-1px"></i> headache</div><div><i style="display:inline-block;width:11px;height:11px;border-radius:6px;background:${LAV};box-shadow:0 0 0 2px #fff,0 0 0 3.5px ${AMB};vertical-align:-1px"></i> short night</div><div style="margin-top:6px;color:#3A3F4E;font-weight:800">9 headache days</div></div></div></div>
    <div class="card blk"><div class="bt"><span class="num">2</span>MeMap finds a link</div>
      <div class="result" style="margin-top:6px">Headache after a short night <span class="pill">6 of 7</span></div><div class="bl">Other days: 3 of 24</div></div>
    <div class="card blk"><div class="bt"><span class="num">3</span>Time to act</div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:6px"><img src="${MAP("lighthouse")}" style="height:40px"><div style="font-size:15px;font-weight:700;line-height:1.3">Her rule: 8+ headache days → see a neurologist.<br><span style="color:#6B7184">MeMap made the report for the visit.</span></div></div></div>
    <div class="card blk"><div class="bt"><span class="num">4</span>November: she tries</div>
      <div style="display:flex;gap:14px;margin-top:8px;align-items:center">${month([7, 18, 26], { size: 11, gap: 4 })}<div style="font-size:15px;font-weight:700;line-height:1.35">In bed by 11<br><span class="pill">9 → 3</span> <span style="color:#6B7184">headache days</span></div></div></div>
    <div class="grow"></div><div class="btn">Continue</div></div>`),

  // 3 · the fork: the good side first and as concrete as the hard one
  "v3-fork": P(`<div class="screen">${navTop(2, 8)}
    <h1 style="font-size:28px;margin-top:6px">Where do you want to start?</h1>
    <div class="card" style="margin-top:18px;padding:16px;box-shadow:0 0 0 2px hsl(${TEAL}), 0 10px 24px -18px rgba(30,50,110,.6)">
      <div style="display:flex;align-items:center;gap:12px">${tile("sun", HUE.amber)}<span style="font-size:22px;font-weight:800">More good days</span><span class="tick">${icon("check", { size: 15, sw: 3, color: "#fff" })}</span></div>
      <div style="font-size:15px;font-weight:600;color:#6B7184;margin-top:6px;line-height:1.35">Energy, good sleep, calm, focus. Find what gives you them — and do more of it.</div>
      <div class="exbox" style="margin-top:10px">${exline("Energy after a morning walk", "9 of 11")}</div></div>
    <div class="card" style="margin-top:12px;padding:16px">
      <div style="display:flex;align-items:center;gap:12px">${tile("repeat", HUE.love)}<span style="font-size:22px;font-weight:800">Something keeps happening</span></div>
      <div style="font-size:15px;font-weight:600;color:#6B7184;margin-top:6px;line-height:1.35">Headaches, bad nights, fights. Find what's behind it — and when to get help.</div>
      <div class="exbox" style="margin-top:10px">${exline("Headache after a short night", "6 of 7")}</div></div>
    <div class="grow"></div><div class="link">Just looking around</div><div class="btn">Continue</div></div>`),

  // 4 · the good list
  "v4-good": P(`<div class="screen">${navTop(3, 8)}
    <h1 style="font-size:28px;margin-top:6px">What do you want more of?</h1>
    <div style="margin-top:14px">${[["zap", HUE.amber, "Energy", 1], ["moon", HUE.sleep, "Good sleep", 0], ["leaf", HUE.health, "Calm", 0], ["target", HUE.work, "Focus", 0], ["heart", HUE.love, "Closeness", 0], ["footprints", HUE.coral, "Movement", 0], ["smile", HUE.lilac, "Joy", 0]].map(([ic, h, t, on]) =>
      `<div class="card row${on ? " on" : ""}" style="height:56px">${tile(ic, h)}${t}${on ? `<span class="tick">${icon("check", { size: 15, sw: 3, color: "#fff" })}</span>` : ""}</div>`).join("")}</div>
    <div class="grow"></div><div class="btn">Continue</div></div>`),

  // 5 · the main question, apart, answered for today right away
  "v5-main": P(`<div class="screen">${navTop(4, 8)}
    <h1 style="font-size:28px;margin-top:6px">Your main question</h1>
    <div class="sub" style="margin-top:4px">One tap each evening. Everything else is compared to it.</div>
    <div class="card" style="margin-top:22px;padding:20px 18px">
      <span class="itag"><b style="background:hsl(${HUE.lilac})"></b>Me · main</span>
      <div style="font-size:24px;font-weight:800;line-height:1.2;margin-top:8px">Did you have energy today?</div>
      <div class="yn" style="margin-top:16px"><span style="height:52px">No</span><span class="on" style="height:52px">Yes</span></div>
      <div style="margin-top:14px;display:flex;align-items:center;gap:6px;font-size:15px;font-weight:700;color:${TEALD}">${icon("pencil", { size: 16, sw: 2.4 })} Change the words</div></div>
    <div class="c" style="margin-top:16px;font-size:15px;font-weight:600;color:#6B7184">That's today's first dot.</div>
    <div class="grow"></div><div class="btn">Next</div></div>`),

  // 6 · the questions around it: examples, change them, write your own
  "v6-around": P(`<div class="screen">${navTop(5, 8)}
    <h1 style="font-size:28px;margin-top:6px">What might affect it?</h1>
    <div style="margin-top:10px;padding:10px 14px;border-radius:16px;background:rgba(255,255,255,.6);display:flex;gap:10px;align-items:center;font-size:15px;font-weight:700;line-height:1.3">${icon("lightbulb", { size: 20, sw: 2.3, color: TEALD })}<span>These are examples. Keep them, remove them, or write your own.</span></div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">
      ${qrow(HUE.health, "Body", "Did you sleep 7+ hours?", 1)}${qrow(HUE.health, "Body", "Were you outside for 30 min?", 1)}${qrow(HUE.amber, "Body", "Coffee after 2 pm?", 1)}${qrow(HUE.work, "Work", "Did you work late?", 0)}${qrow(HUE.health, "Body", "Did you exercise?", 0)}
    </div>
    <div class="dash" style="margin-top:10px">${icon("plus", { size: 18, sw: 2.6 })}&nbsp;Write your own question</div>
    <div class="grow"></div><div class="btn">Continue</div></div>`),

  // 7 · calendars instead of animals: what she'll see, and when
  "v7-calendars": P(`<div class="screen">${navTop(6, 8)}
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px"><h1 style="font-size:26px">What you'll see</h1><span class="ex">Example</span></div>
    <div class="card blk" style="margin-top:12px"><div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:17px;font-weight:800">Your energy days</span><span style="font-size:14px;font-weight:700;color:#6B7184">14 of 31</span></div>
      <div style="margin-top:10px;display:flex;justify-content:center">${month([0, 1, 4, 5, 7, 8, 11, 14, 15, 18, 21, 22, 25, 28], { size: 22, gap: 9 })}</div></div>
    <div class="card blk"><span style="font-size:17px;font-weight:800">What goes with them</span>
      ${drow("Walk outside", [0, 2, 3, 5, 7, 9, 10, 12], AMB)}${drow("Energy", [0, 3, 5, 6, 7, 10, 12], IND)}
      <div class="result">Energy after a walk <span class="pill">9 of 11</span></div></div>
    <div class="card" style="margin-top:12px;padding:10px 16px;display:flex;justify-content:space-between;text-align:center">${[["Tonight", "first dot"], ["Day 10", "first links"], ["Day 30", "clear picture"]].map(([a, b]) => `<div><div class="when" style="font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#6B7184">${a}</div><div style="font-size:15px;font-weight:800">${b}</div></div>`).join("")}</div>
    <div class="grow"></div><div class="btn">Continue</div></div>`),

  // 8 · support: reminders that help and cheer, never warn
  "v8-support": P(`<div class="screen">${navTop(7, 8)}
    <h1 style="font-size:28px;margin-top:6px">MeMap keeps you going</h1>
    <div class="sub" style="margin-top:4px">Short, kind reminders. Never warnings.</div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:18px">
      ${notif("3 questions · 1 min", "Your Me island grows in 2 evenings.")}
      ${notif("First links are 3 evenings away", "Keep going — you're close.", "Thu")}
      ${notif("Your plan: early night", "You set it for weeks with 4 low-energy days.", "Sun")}
      ${notif("5 of 7 evenings in bed by 11", "Your energy days: 3 → 5 a week. Nice!", "Mon")}
    </div>
    <div class="card" style="margin-top:14px;padding:0 16px;height:56px;display:flex;align-items:center;gap:10px;font-weight:700;font-size:16px">${icon("bell", { size: 20 })} Remind me at 20:00 <span class="toggle"></span></div>
    <div class="grow"></div><div class="btn">Go to today</div></div>`),

  // ---- the first day ----
  // Today: three steps, and adding a question is in plain sight
  "w1-today": P(`${head("Week 1 · 1/7", "1")}
    ${disc(195, 168, 38, "done", icon("check", { size: 34, sw: 3.2 }))}${lab(195, 216, "Energy · 4 questions")}
    ${cur(195, 380, 46, HUE.lilac, icon("compass", { size: 38, sw: 2.4 }))}<div class="startb" style="left:195px;top:308px">Start</div>${lab(195, 440, "Look around")}
    ${boat(46, 340, 84)}
    ${disc(195, 548, 38, "lock", icon("flag", { size: 30, sw: 2.4 }))}${lab(195, 598, "Done for today", true)}
    <div class="dash" style="position:absolute;left:40px;right:40px;top:650px;background:rgba(255,255,255,.75)">${icon("plus", { size: 18, sw: 2.6 })}&nbsp;Add a question</div>
    ${tabbar(0)}`),
  // tour: track → a dot
  "w2-track": P(worldE(veil([{ x: 16, y: 108, w: 112, h: 104, r: 22 }]) + coach(236, 0, "Every evening becomes a dot", "Dark — a day with energy. Light — without.",
    `<div class="exbox"><div style="display:flex;gap:8px">${["M", "T", "W", "T", "F", "S", "S"].map((d, i) => `<div style="text-align:center;font-size:12px;font-weight:800;color:#6B7184">${d}<i style="display:block;margin-top:4px;width:22px;height:22px;border-radius:11px;background:${[0, 2, 3].includes(i) ? IND : i === 6 ? EMPTY : LAV}"></i></div>`).join("")}</div></div>`))),
  // tour: links
  "w3-links": P(worldE(dotted([150, 400], [196, 452], [178, 520], 14) +
    `<div class="badge" style="left:182px;top:458px;z-index:6">${icon("spline", { size: 15, sw: 2.6 })}9 of 11</div>` +
    veil([{ x: 18, y: 330, w: 354, h: 290, r: 30 }]) + coach(108, 1, "A line = they go together", "Energy came after a walk — 9 of 11. Yours show up after about 10 evenings.", `<div style="margin-top:8px"><span class="ex">Example</span></div>`))),
  // tour: when to act
  "w4-act": P(worldE(veil([{ x: 272, y: 108, w: 102, h: 104, r: 22 }]) + coach(236, 2, "Know when to act", "Set your own rule. When it's reached, the lighthouse lights up and MeMap reminds you of your plan.",
    `<div class="exbox" style="display:flex;align-items:center;gap:10px;font-size:15px;font-weight:800"><img src="${MAP("lighthouse")}" style="height:30px">4 low-energy days a week → early night</div>`))),
  // tour: try what helps
  "w5-try": P(worldE(veil([{ x: 144, y: 108, w: 102, h: 104, r: 22 }]) + coach(236, 3, "Try what helps", "A new habit for 2 weeks. MeMap checks it — and you see your weeks change.",
    `<div class="exbox" style="display:flex;align-items:center;gap:10px;font-size:16px;font-weight:800">${icon("footprints", { size: 18, sw: 2.4 })} Morning walk <span style="margin-left:auto;color:#6B7184;font-weight:700;white-space:nowrap">energy days</span> <span class="pill" style="white-space:nowrap">3 → 5</span></div>`, true))),
  // the cheat sheet, always in You
  "w6-how": P(`<div class="sheet"><div class="grab"></div>
    <div style="font-size:27px;font-weight:800;letter-spacing:-.02em">How MeMap works</div>
    <div style="margin-top:10px">${[["check-check", "1 · Track", "your main question + what's around it", "Today"], ["spline", "2 · Find links", "same day or the day after", "World"], ["signpost", "3 · Know when to act", "your rule → your plan", "World"], ["flask-conical", "4 · Try what helps", "a new habit, checked", "World"]].map(([ic, a, b, tab]) =>
      `<div class="step3" style="padding:9px 12px"><span class="ic">${icon(ic, { size: 22, sw: 2.3 })}</span><div><b>${a}</b><span>${b}</span></div><span class="tab">${tab}</span></div>`).join("")}</div>
    <div style="margin-top:8px;display:flex;align-items:center;gap:8px;font-size:15px;font-weight:800;color:${TEALD}">${icon("bell-ring", { size: 18, sw: 2.4 })} All along: kind reminders and cheering</div>
    <div class="dash" style="margin-top:12px;height:46px">${icon("plus", { size: 18, sw: 2.6 })}&nbsp;Add a question — any time</div>
    <div class="wk" style="margin-top:14px;text-align:left">ON YOUR MAP</div>
    <div style="margin-top:2px">
      <div class="leg"><span class="pic"><img src="${ISL("17_lavender_garden")}"></span><div><b>Island</b><span>a part of your life, its questions</span></div></div>
      <div class="leg"><span class="pic"><svg width="50" height="20">${[4, 13, 22, 31, 40].map((x) => `<circle cx="${x + 3}" cy="10" r="3.4" fill="#fff" stroke="rgba(70,100,170,.45)"/>`).join("")}</svg></span><div><b>Dotted line</b><span>two things that go together</span></div></div>
      <div class="leg"><span class="pic"><img src="${MAP("lighthouse")}"></span><div><b>Lighthouse</b><span>your rule was reached — time for your plan</span></div></div>
      <div class="leg"><span class="pic"><img src="${MAP("hot_air_balloon")}"></span><div><b>Growth & treasures</b><span>for coming back — not for good days</span></div></div>
    </div></div>`),
};

const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", args: ["--allow-file-access-from-files"] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const shots = {};
for (const [k, html] of Object.entries(screens)) {
  const f = path.join(SHOTS, k + ".html");
  writeFileSync(f, html);
  await p.goto(pathToFileURL(f).href); await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(SHOTS, k + ".png") });
  shots[k] = pathToFileURL(path.join(SHOTS, k + ".png")).href;
}
shots["r-companion"] = pathToFileURL(path.join(R, "marketing/tools/aurora-tests/work/r33/A-13-companion.png")).href;
const board = async (keys, caps, title, sub, file) => {
  const w = keys.length * 410 + 30;
  await p.setViewportSize({ width: w, height: 1000 });
  const cells = keys.map((k, i) => '<div class="s' + (k.startsWith("r-") ? " same" : "") + '"><img src="' + shots[k] + '"><p><b>' + (i + 1) + '.</b> ' + caps[i] + '</p></div>').join("");
  await p.setContent('<html><head><style>@font-face{font-family:DM;src:url(' + FONT + ');font-weight:100 900}@font-face{font-family:DM;src:url(' + FONT.replace("latin", "cyrillic") + ');unicode-range:U+0400-04FF;font-weight:100 900}body{margin:0;background:#EEF1FA;font-family:DM,sans-serif;color:#3A3F4E}' +
    'h2{margin:0;padding:26px 30px 0;font-size:32px;font-weight:800}h3{margin:6px 30px 0;font-size:20px;font-weight:600;color:#6B7184}.r{display:flex;gap:20px;padding:18px 30px 30px}.s{width:390px}.s img{width:390px;border-radius:28px;box-shadow:0 14px 30px -18px rgba(20,40,80,.5);display:block}' +
    '.s.same img{opacity:.55}.s p{margin:12px 4px 0;font-size:18px;font-weight:600;line-height:1.35}.s p b{color:hsl(174 44% 36%)}</style></head><body><h2>' + title + '</h2><h3>' + sub + '</h3><div class="r">' + cells + '</div></body></html>');
  await p.waitForTimeout(700);
  await p.screenshot({ path: path.join(OUT, file), fullPage: true });
};
await board(["v1-what", "v2-example", "v3-fork", "v4-good", "v5-main", "v6-around", "v7-calendars", "v8-support"],
  ["<b>Что делает MeMap — обычными словами</b> (загадочная фраза — на потом). Сразу твой цикл: отмечаешь → находишь связи (в тот же день или на следующий) → знаешь, когда действовать → пробуешь, что помогает. И поддержка.",
   "<b>Метод на одном примере, с календарями:</b> октябрь с головной болью и короткими ночами → связь «6 из 7, в остальные дни 3 из 24» → её правило «8+ дней → к неврологу», отчёт для визита → ноябрь «спать до 23» и 9 → 3.",
   "<b>Потом выбор.</b> Хорошее — первым и так же конкретно, как трудное: «энергия после утренней прогулки — 9 из 11». Трудное: «и когда пора за помощью».",
   "<b>Хороший список:</b> энергия, сон, спокойствие, фокус, близость, движение, радость. (Трудный — как сейчас.)",
   "<b>Главный вопрос — отдельно.</b> «С ним сравнивается всё остальное», «изменить слова». Ответ за сегодня — первая точка прямо тут.",
   "<b>Сопутствующие — отдельно</b>, с подписью «это примеры: оставь, убери или напиши свой» и кнопкой «Написать свой вопрос».",
   "<b>Календари вместо зверей:</b> твой месяц дней с энергией, что идёт вместе, и когда что будет. Зверёк — на второй день (или при первом заходе на карту).",
   "<b>Поддержка:</b> какие будут напоминания — короткие и добрые, никогда не предупреждения. Твой план, когда правило сработало, и похвала за новую привычку."],
  "Новый пользователь, v2: что делает → как → выбор → свои вопросы", "По твоим заметкам: сначала ценность и метод, потом выборы; цикл «отмечай → связи → когда действовать → пробуй» виден сразу", "60-storyline-v2-onboarding.png");
await board(["w1-today", "w2-track", "w3-links", "w4-act", "w5-try", "w6-how"],
  ["<b>Первый день:</b> три шага и видная кнопка «Добавить вопрос» (люди не знали, что можно).",
   "<b>Экскурсия по тому же циклу</b> из 4 шагов: Track · Links · Act · Try. 1 — вечер становится точкой.",
   "<b>Links:</b> пунктир рисуется вживую, «9 из 11», пометка «Пример».",
   "<b>Act:</b> её правило и её план, маяк загорается, MeMap напоминает о плане.",
   "<b>Try:</b> новая привычка на 2 недели, график недель показывает, помогло ли.",
   "<b>Шпаргалка</b> в профиле: 4 шага, поддержка, «Добавить вопрос — в любой момент», значки карты."],
  "Первый день, v2: тот же цикл из 4 шагов", "Тема в примерах — «больше энергии», чтобы показать хорошую сторону", "61-storyline-v2-first-day.png");
console.log("ok", Object.keys(screens).length);
await b.close();
