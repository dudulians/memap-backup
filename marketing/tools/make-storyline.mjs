// Storyline proposal boards 58–59 (Nov 6 2026). Helpers copied from make-onboarding-v2.mjs.
// Run from marketing/tools: node make-storyline.mjs
// Run from marketing/tools: node make-onboarding.mjs
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const url = (p) => pathToFileURL(path.join(R, p)).href;
const OUT = path.join(R, "marketing/aurora-light-ux");
const SHOTS = path.join(OUT, "58-storyline");
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
.chain span { height: 28px; padding: 0 11px; border-radius: 14px; background: rgba(58,63,78,.06); display: flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 800; color: #9AA0B0; }
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
const chain = (on) => `<div class="chain">${["Answer", "See", "Try"].map((w, i) => `<span class="${i === on ? "on" : i < on ? "done" : ""}">${i < on ? icon("check", { size: 13, sw: 3 }) : `${i + 1}`} ${w}</span>`).join("")}</div>`;
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

const screens = {
  // 1 · value first: a statement and the three steps, no unexplained pictures
  "s1-value": P(`<div class="seg"><span class="on">EN</span><span>RU</span></div>
    ${isle(105, 296, 170, "19_grassy_terraces")}${isle(292, 228, 160, "09_waterfall")}
    ${dotted([158, 248], [196, 156], [226, 194], 16)}
    <div class="badge" style="left:192px;top:146px">${icon("spline", { size: 16, sw: 2.6 })}5 of 6</div>
    ${ilab(105, 316, "A short night")}${ilab(292, 246, "Headache", "the next day")}
    <div class="screen" style="padding-top:380px">
      <h1 class="c" style="font-size:29px">See what comes before your best days — and your hardest</h1>
      <div class="card" style="margin-top:18px;padding:14px 8px;display:grid;grid-template-columns:1fr 1fr 1fr;text-align:center">
        ${[["hand", "Answer", "yes or no,<br>1 min a night"], ["spline", "See", "what comes<br>before what"], ["flask-conical", "Try", "one change,<br>see if it helps"]].map(([ic, w, l], i) => `<div style="padding:0 4px;${i ? "border-left:1px solid rgba(58,63,78,.08)" : ""}"><span class="tile" style="margin:0 auto;background:hsl(${TEAL} / .14);color:hsl(172 60% 30%)">${icon(ic, { size: 22, sw: 2.3 })}</span><div style="margin-top:6px;font-size:17px;font-weight:800">${i + 1} · ${w}</div><div style="font-size:13px;font-weight:600;color:#6B7184;line-height:1.3;margin-top:2px">${l}</div></div>`).join("")}
      </div>
      <div class="grow"></div>
      <div class="btn">Show me how ${icon("arrow-right", { size: 20, sw: 2.6 })}</div>
    </div>`),

  // 4 · how it works, on HER topic, labelled Example; fills in step by step
  "s4-how": P(`<div class="screen">${navTop(2)}
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px"><h1 style="font-size:27px">How MeMap finds it</h1><span class="ex">Example</span></div>
    <div class="card blk" style="margin-top:14px"><div class="bt"><span class="num">1</span>Answer</div><div class="bl">Every evening, yes or no. About a minute.</div>
      <div style="margin-top:10px;padding:12px 14px;border-radius:16px;background:rgba(58,63,78,.04)"><div style="font-size:17px;font-weight:800">Did you sleep 7+ hours?</div><div class="yn"><span class="on">No</span><span>Yes</span></div></div></div>
    <div class="card blk"><div class="bt"><span class="num">2</span>See</div><div class="bl">Every day is a dot. MeMap compares them.</div>
      ${drow("Short night", SHORT, AMB)}${drow("Migraine", MIG, IND)}
      <div class="result">${icon("spline", { size: 18, sw: 2.6, color: IND })}Migraine after a short night <span class="pill">5 of 6</span></div></div>
    <div class="card blk"><div class="bt"><span class="num">3</span>Try</div><div class="bl">One change for a week. MeMap checks if it helps.</div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:10px;font-size:16px;font-weight:800">${icon("moon", { size: 18, sw: 2.4 })} In bed by 11 <span style="margin-left:auto;color:#6B7184;font-weight:700">migraines</span> <span class="pill">3 → 1</span></div></div>
    <div class="grow"></div><div class="btn">Continue</div></div>`),

  // 5 · her promise line + what an island is + why there are several
  "s5-map": P(`<div class="screen">${navTop(3)}
    <h1 class="c" style="font-size:26px;margin-top:6px">Let's see what comes before your migraines</h1></div>
    ${isle(200, 280, 160, "09_waterfall")}${ilab(200, 292, "Health", "migraines")}
    ${isle(80, 420, 124, "19_grassy_terraces")}${ilab(80, 432, "Body", "sleep · meals")}
    ${isle(312, 420, 118, "06_snow_peak")}${ilab(312, 432, "Work", "stress")}
    ${dotted([96, 372], [104, 300], [140, 276], 12)}${dotted([296, 370], [292, 298], [262, 274], 12)}
    <div class="qbadge" style="left:108px;top:318px">?</div><div class="qbadge" style="left:290px;top:316px">?</div>
    <div class="screen" style="padding-top:500px">
      <div class="c" style="font-size:17px;font-weight:700;line-height:1.35">Each part of your life is an island.<br>MeMap looks for lines between them.</div>
      <div class="wk" style="margin-top:16px;text-align:left">ALSO WATCH</div>
      <div class="chips" style="margin-top:8px">${[["Short sleep", 1], ["Stress", 1], ["Skipped meal", 1], ["Alcohol", 0], ["+ Other", 0]].map(([c, on]) => `<span class="chip${on ? " on" : ""}">${on ? icon("check", { size: 16, sw: 3, color: `hsl(${TEAL})` }) + "&nbsp;" : ""}${c}</span>`).join("")}</div>
      <div class="grow"></div><div class="btn">Continue</div></div>`),

  // 6 · the evening: the same few questions, each with its island
  "s6-evening": P(`<div class="screen">${navTop(4)}
    <h1 style="font-size:27px;margin-top:6px">Your evening questions</h1>
    <div class="sub" style="margin-top:4px">The same few, every evening.</div>
    <div style="margin-top:14px">${[["Health", HUE.health, "Did you have a migraine today?", 0], ["Body", HUE.amber, "Did you sleep 7+ hours?", 1], ["Work", HUE.work, "Was today stressful?", 2], ["Body", HUE.amber, "Did you eat before 2 pm?", 2]].map(([i, h, q, on]) =>
      `<div class="card qcard"><span class="itag"><b style="background:hsl(${h})"></b>${i}</span><div class="q">${q}</div><div class="yn"><span class="${on === 1 ? "on" : ""}">No</span><span class="${on === 0 ? "on" : ""}">Yes</span></div></div>`).join("")}</div>
    <div class="grow"></div><div class="btn">Save</div></div>`),

  // 7 · the goal: what she gets and when (replaces "Your first light is lit")
  "s7-when": P(`<div class="screen">${navTop(5)}
    <h1 style="font-size:27px;margin-top:6px">What you'll see, and when</h1>
    <div class="card tl" style="margin-top:14px"><div class="line"></div>
      ${[["g", icon("check", { size: 18, sw: 3 }), "Tonight", "Your first dots", "on your map"], ["w", "7", "Day 7", "Your first week", "how often, which days"], ["w", "10", "Day 10", "First links", "what comes before migraines"], ["w", "30", "Day 30", "A clear picture", "+ a report for your doctor"]].map(([k, d, w, a, b]) =>
        `<div class="r"><span class="d ${k}">${d}</span><div><div class="when">${w}</div><div class="what">${a}</div><div class="why">${b}</div></div></div>`).join("")}
    </div>
    <div class="card" style="margin-top:12px;padding:12px 16px;display:flex;align-items:center;gap:12px"><img src="${MAP("hot_air_balloon")}" style="height:40px"><div style="font-size:15px;font-weight:700;line-height:1.3">Every evening you answer,<br>your islands grow.</div></div>
    <div class="card" style="margin-top:12px;padding:0 16px;height:58px;display:flex;align-items:center;gap:10px;font-weight:700;font-size:16px">${icon("bell", { size: 20 })} Remind me at 20:00 <span class="toggle"></span></div>
    <div class="grow"></div><div class="btn">Go to today</div></div>`),

  // ---- the first day ----
  // Today, day 1: three steps only
  "d1-today": P(`${head("Week 1 · 1/7", "1")}
    ${disc(195, 168, 38, "done", icon("check", { size: 34, sw: 3.2 }))}${lab(195, 216, "Migraines · 4 questions")}
    ${cur(195, 400, 46, HUE.health, icon("compass", { size: 38, sw: 2.4 }))}<div class="startb" style="left:195px;top:328px">Start</div>${lab(195, 460, "Look around")}
    ${boat(46, 360, 84)}
    ${disc(195, 580, 40, "lock", icon("flag", { size: 30, sw: 2.4 }))}${lab(195, 632, "Done for today", true)}
    ${disc(195, 730, 34, "lock", icon("lock", { size: 24, sw: 2.4 }))}
    ${tabbar(0)}`),

  // tour stop: answer → a dot (the calendar)
  "d2-dot": P(world(veil([{ x: 16, y: 108, w: 112, h: 104, r: 22 }]) + coach(236, 0, "Every evening becomes a dot", "Dark — a migraine day. Light — a calm one.",
    `<div class="exbox"><div style="display:flex;gap:8px">${["M", "T", "W", "T", "F", "S", "S"].map((d, i) => `<div style="text-align:center;font-size:12px;font-weight:800;color:#6B7184">${d}<i style="display:block;margin-top:4px;width:22px;height:22px;border-radius:11px;background:${[2, 5].includes(i) ? IND : i === 6 ? EMPTY : LAV}"></i></div>`).join("")}</div></div>`))),

  // tour stop: see — islands
  "d3-islands": P(world(veil([{ x: 18, y: 330, w: 354, h: 290, r: 30 }]) + coach(108, 1, "Each part of your life is an island", "Your questions live on them. Migraines on Health, sleep on Body."))),

  // tour stop: see — a line between islands
  "d4-link": P(world(dotted([150, 400], [196, 452], [178, 520], 14) +
    `<div class="badge" style="left:182px;top:458px;z-index:6">${icon("spline", { size: 15, sw: 2.6 })}5 of 6</div>` +
    veil([{ x: 18, y: 330, w: 354, h: 290, r: 30 }]) + coach(108, 1, "A line = they keep happening together", "Short night → migraine the next day. Yours show up after about 10 evenings.", `<div style="margin-top:8px"><span class="ex">Example</span></div>`))),

  // tour stop: try — action points
  "d5-try": P(world(veil([{ x: 272, y: 108, w: 102, h: 104, r: 22 }]) + coach(236, 2, "Then try one change", "Pick one thing for a week. MeMap checks if it helps.",
    `<div class="exbox" style="display:flex;align-items:center;gap:10px;font-size:16px;font-weight:800">${icon("moon", { size: 18, sw: 2.4 })} In bed by 11 · 7 days <span style="margin-left:auto" class="pill">3 → 1</span></div>`, true))),

  // the cheat sheet: in You → "How MeMap works", and as the tour's last card
  "d6-how": P(`<div class="sheet"><div class="grab"></div>
    <div style="font-size:27px;font-weight:800;letter-spacing:-.02em">How MeMap works</div>
    <div style="margin-top:12px">${[["hand", "1 · Answer", "a few yes/no, every evening", "Today"], ["spline", "2 · See", "dots, islands, lines", "World"], ["flask-conical", "3 · Try", "one change for a week", "World"]].map(([ic, a, b, tab]) =>
      `<div class="step3"><span class="ic">${icon(ic, { size: 22, sw: 2.3 })}</span><div><b>${a}</b><span>${b}</span></div><span class="tab">${tab}</span></div>`).join("")}</div>
    <div class="wk" style="margin-top:18px;text-align:left">ON YOUR MAP</div>
    <div style="margin-top:4px">
      <div class="leg"><span class="pic"><img src="${ISL("09_waterfall")}"></span><div><b>Island</b><span>a part of your life, its questions</span></div></div>
      <div class="leg"><span class="pic" style="gap:4px"><i style="width:14px;height:14px;border-radius:7px;background:${IND};display:block"></i><i style="width:14px;height:14px;border-radius:7px;background:${LAV};display:block"></i></span><div><b>Dot</b><span>one day: dark — hard, light — calm</span></div></div>
      <div class="leg"><span class="pic"><svg width="50" height="20">${[4, 13, 22, 31, 40].map((x) => `<circle cx="${x + 3}" cy="10" r="3.4" fill="#fff" stroke="rgba(70,100,170,.45)"/>`).join("")}</svg></span><div><b>Dotted line</b><span>two things that keep happening together</span></div></div>
      <div class="leg"><span class="pic"><img src="${MAP("lighthouse")}"></span><div><b>Lighthouse</b><span>your own rule: if it happens N times → your plan</span></div></div>
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
// screens that stay as they are: the real app (test-r33)
const REAL = path.join(R, "marketing/tools/aurora-tests/work/r33");
shots["r-fork"] = pathToFileURL(path.join(REAL, "A-02-fork.png")).href;
shots["r-list"] = pathToFileURL(path.join(REAL, "A-04-list.png")).href;
shots["r-companion"] = pathToFileURL(path.join(REAL, "A-13-companion.png")).href;
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
await board(["s1-value", "r-fork", "r-list", "s4-how", "s5-map", "s6-evening", "s7-when", "r-companion"],
  ["<b>Ценность сразу.</b> Не вопрос, а что получишь. Картинка сама показывает связь «короткая ночь → голова». Три шага: Отвечаешь → Видишь → Пробуешь.",
   "<i>Как сейчас.</i>",
   "<i>Как сейчас.</i>",
   "<b>Новое: как это работает — на её теме.</b> Те же три шага с примером (с пометкой «Пример»). Появляются по очереди.",
   "<b>Что такое остров.</b> Её строка «Let's see what comes before…» остаётся. Мигрень — на Health, то, что бывает перед ней, — на других островах. Поэтому островов несколько. Она сама отмечает, за чем ещё следить (вместо трёх случайных примеров).",
   "<b>Её вечерние вопросы</b> — у каждого видно, на каком он острове. «Каждый вечер одни и те же».",
   "<b>Цель и сроки</b> вместо «Your first light is lit»: сегодня точки, 7-й день неделя, 10-й первые связи, 30-й ясная картина и отчёт врачу. Игра — одной строкой: острова растут за вечера.",
   "<i>Как сейчас</i> (лодка = это ты на карте)."],
  "Новый пользователь: сначала зачем, потом как, потом где", "Экраны 1, 4–7 — новые или переписанные; бледные — без изменений", "58-storyline-onboarding.png");
await board(["d1-today", "d2-dot", "d3-islands", "d4-link", "d5-try", "d6-how"],
  ["<b>Первый день — три шага:</b> вопросы (уже сделаны в онбординге), «Осмотрись», «На сегодня всё». Заметка, догадка, пузыри — со 2–3 дня.",
   "<b>Экскурсия = та же цепочка.</b> Сверху «1 Answer · 2 See · 3 Try». Ответ → точка в календаре.",
   "<b>See: острова.</b> Её вопросы живут на островах: мигрень — Health, сон — Body.",
   "<b>See: линия.</b> Пунктир рисуется вживую — это и есть связь. Её — примерно через 10 вечеров.",
   "<b>Try:</b> точки действия — одно изменение на неделю, MeMap проверяет. Графики, заметки и профиль — без отдельных остановок.",
   "<b>Шпаргалка</b> «How MeMap works»: в профиле всегда, и последней карточкой экскурсии. Три шага и пять значков карты."],
  "Первый день: одна цепочка — Answer → See → Try", "Экскурсия рассказывает не «где что лежит», а как одно ведёт к другому", "59-storyline-first-day.png");
console.log("ok", Object.keys(screens).length);
await b.close();
