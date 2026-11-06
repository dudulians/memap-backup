// Boards 64–65 (Nov 6 2026): decisions ("do I really want it?") and reminders for actions. Helpers from make-storyline-v3.mjs.
// Run from marketing/tools: node make-boards-64.mjs
// Run from marketing/tools: node make-onboarding.mjs
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const url = (p) => pathToFileURL(path.join(R, p)).href;
const OUT = path.join(R, "marketing/aurora-light-ux");
const SHOTS = path.join(OUT, "64-decisions-reminders");
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
// her note (Nov 6 2026): hard days reddish, good days greenish
const HARDC = "hsl(348 70% 69%)", GOODC = "hsl(146 45% 60%)", HARDL = "hsl(348 70% 69% / .45)", GOODL = "hsl(146 45% 60% / .45)";
const step = (n, ic, title, line, ex) => `<div class="card" style="padding:12px 14px;display:flex;gap:12px;align-items:flex-start">
  <span class="tile" style="background:hsl(${TEAL} / .14);color:${TEALD};margin-top:2px">${icon(ic, { size: 21, sw: 2.3 })}</span>
  <div style="min-width:0;flex:1"><div style="font-size:18px;font-weight:800">${n} · ${title}</div>${line ? `<div style="font-size:14px;font-weight:600;color:#6B7184;line-height:1.3;margin-top:1px">${line}</div>` : ""}${ex ? `<div style="margin-top:8px">${ex}</div>` : ""}</div></div>`;
const minichips = (xs) => `<div style="display:flex;flex-wrap:wrap;gap:5px">${xs.map((x, i) => `<span style="height:24px;padding:0 9px;border-radius:12px;font-size:13px;font-weight:800;display:inline-flex;align-items:center;${i === 0 ? `background:${IND};color:#fff` : "background:rgba(58,63,78,.07)"}">${x}</span>`).join("")}</div>`;
const exline = (txt, pill) => `<div style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:800">${icon("spline", { size: 15, sw: 2.6, color: IND })}${txt}${pill ? ` <span class="pill" style="height:22px;font-size:12px;padding:0 8px">${pill}</span>` : ""}</div>`;
// a month as dots (5 weeks): on = indices with "yes"
const month = (on, { size = 13, gap = 5, col = IND, off = LAV, ring = [], start = 6, days = 30 } = {}) => {
  // a real calendar (her note, Nov 6 2026: "дотс как календарь с датами"): weekdays, Monday first, the date in each day
  const f = Math.max(7, Math.round(size * 0.42));
  const head = ["M", "T", "W", "T", "F", "S", "S"].map((d) => `<span style="text-align:center;font-size:${Math.max(9, f)}px;font-weight:800;color:#9AA0B0">${d}</span>`).join("");
  const blanks = Array.from({ length: start }, () => "<i></i>").join("");
  const cells = Array.from({ length: days }, (_, i) => { const lit = on.includes(i); return `<i style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:50%;background:${lit ? col : off};color:${lit ? "#fff" : "#6B7184"};font-style:normal;font-size:${f}px;font-weight:800;${ring.includes(i) ? `box-shadow:0 0 0 2px #fff, 0 0 0 4px ${AMB}` : ""}">${i + 1}</i>`; }).join("");
  return `<div style="display:grid;grid-template-columns:repeat(7,${size}px);gap:${gap}px">${head}${blanks}${cells}</div>`;
};
// a week as a calendar strip: weekday on top, date inside
const weekstrip = (on, col, off, { s = 30, from = 2 } = {}) => `<div style="display:flex;gap:8px">${["M", "T", "W", "T", "F", "S", "S"].map((d, i) => `<div style="text-align:center"><div style="font-size:12px;font-weight:800;color:#9AA0B0">${d}</div><i style="display:flex;margin-top:3px;align-items:center;justify-content:center;width:${s}px;height:${s}px;border-radius:50%;background:${on.includes(i) ? col : off};color:${on.includes(i) ? "#fff" : "#6B7184"};font-style:normal;font-size:${Math.round(s * 0.42)}px;font-weight:800">${from + i}</i></div>`).join("")}</div>`;
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
    <div class="card"><div class="h">Energy days</div><div class="cal">${Array.from({ length: 21 }, (_, i) => `<i style="${[1, 2, 5, 8, 9, 12, 15, 16].includes(i) ? `background:${GOODC}` : i > 17 ? `background:${EMPTY}` : `background:${HARDL}`}"></i>`).join("")}</div></div>
    <div class="card"><div class="h">Your weeks</div><svg width="90" height="56" style="margin-top:8px">${[14, 18, 16, 26, 30, 36].map((v, i) => `<rect x="${i * 15}" y="${56 - v}" width="10" height="${v}" rx="5" fill="${IND}" opacity="${0.45 + i * 0.1}"/>`).join("")}</svg></div>
    <div class="card"><div class="h">Action points</div><div style="display:flex;align-items:center;gap:6px;margin-top:10px"><img src="${MAP("lighthouse")}" style="height:44px"><b style="font-size:20px">0<span style="font-size:14px;color:#6B7184"> of 1</span></b></div></div>
  </div>
  ${isle(92, 420, 128, "19_grassy_terraces")}${ilab(92, 432, "Body", "walks · sleep")}
  ${isle(300, 410, 120, "06_snow_peak")}${ilab(300, 420, "Work", "late hours")}
  ${isle(200, 566, 160, "17_lavender_garden")}${ilab(200, 580, "Me", "energy")}
  <img src="${ISL("cloud_island_03")}" style="position:absolute;left:290px;top:600px;width:96px;opacity:.9">
  ${boat(40, 600, 78)}
  ${extra}${tabbar(1)}`;


// ---- v3 (her notes, Nov 6 2026): "можно ли упростить для понимания, но без загадочных
// фраз? может больше картинок?" and "на странице мира 4 стоуна — наши 4 пункта:
// слежка, связи, действия, помощь (по-другому назови); календарь и графики — в первом,
// в связях тоже графики". One name and one sign for each part, the same everywhere:
// My days · Links · When to act · What helps.
const PARTS = [
  { n: 1, key: "days", en: "My days", ru: "Мои дни", ic: "calendar-days" },
  { n: 2, key: "links", en: "Links", ru: "Связи", ic: "spline" },
  { n: 3, key: "act", en: "When to act", ru: "Когда действовать", ic: "lighthouse" },
  { n: 4, key: "helps", en: "What helps", ru: "Что помогает", ic: "sprout" },
];
const partIcon = (p, size = 22, col = TEALD) => p.ic === "lighthouse" ? `<img src="${MAP("lighthouse")}" style="height:${size + 8}px">` : icon(p.ic, { size, sw: 2.3, color: col });
const EXTRA3 = `
.slide-art { position: absolute; left: 20px; right: 20px; top: 92px; height: 400px; border-radius: 32px; background: rgba(255,255,255,.55); box-shadow: 0 14px 34px -22px rgba(20,40,90,.5); overflow: hidden; }
.slide-txt { position: absolute; left: 24px; right: 24px; top: 520px; }
.slide-txt .k { display: inline-flex; align-items: center; gap: 8px; height: 30px; padding: 0 12px 0 8px; border-radius: 15px; background: hsl(${TEAL} / .14); color: ${TEALD}; font-size: 14px; font-weight: 800; }
.slide-txt h1 { margin-top: 12px; font-size: 32px; }
.slide-txt .l { margin-top: 6px; font-size: 18px; font-weight: 600; color: #6B7184; line-height: 1.35; }
.sdots { position: absolute; left: 0; right: 0; bottom: 118px; display: flex; gap: 7px; justify-content: center; }
.sdots i { width: 8px; height: 8px; border-radius: 4px; background: rgba(58,63,78,.2); }
.sdots i.on { width: 24px; background: hsl(${TEAL}); }
.sbtn { position: absolute; left: 20px; right: 20px; bottom: 40px; }
.skip3 { position: absolute; right: 22px; top: 56px; font-size: 16px; font-weight: 700; color: #6B7184; }
.mini { background: #fff; border-radius: 20px; box-shadow: 0 10px 24px -16px rgba(20,40,90,.55); }
.stone { position: absolute; width: 84px; height: 70px; border-radius: 50% 50% 46% 46% / 56% 56% 44% 44%; background: linear-gradient(180deg, #ffffff, #EEF1F8); box-shadow: 0 7px 0 #D6DCE9, 0 16px 24px -14px rgba(20,40,90,.55); display: flex; align-items: center; justify-content: center; transform: translateX(-50%); }
.stone .num { position: absolute; top: -8px; right: 2px; width: 22px; height: 22px; border-radius: 11px; background: hsl(${TEAL}); color: #fff; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
.slab { position: absolute; transform: translateX(-50%); text-align: center; white-space: nowrap; font-size: 14px; font-weight: 800; }
.slab small { display: block; font-size: 12px; font-weight: 700; color: #6B7184; }
.g4 { position: absolute; top: 108px; left: 16px; right: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.g4 .card { height: 118px; padding: 11px 12px; position: relative; }
.g4 .t { display: flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 800; }
.g4 .t .n { width: 20px; height: 20px; border-radius: 10px; background: hsl(${TEAL}); color: #fff; font-size: 11px; display: flex; align-items: center; justify-content: center; }
.seg2 { display: flex; height: 38px; border-radius: 19px; background: rgba(58,63,78,.07); padding: 3px; font-size: 15px; font-weight: 800; }
.seg2 span { flex: 1; display: flex; align-items: center; justify-content: center; border-radius: 16px; color: #6B7184; }
.seg2 span.on { background: #fff; color: #3A3F4E; box-shadow: 0 2px 6px rgba(20,40,80,.15); }
`;
const P3 = (body) => page(body, EXTRA + EXTRA3);
const slide = (i, art, title, line, btn = "Next") => P3(`<span class="skip3">Skip</span>
  <div class="slide-art">${art}</div>
  <div class="slide-txt"><span class="k">${partIcon(PARTS[i], 16)} ${i + 1} of 4</span><h1>${title}</h1><div class="l">${line}</div></div>
  <div class="sdots">${[0, 1, 2, 3].map((k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div>
  <div class="sbtn"><div class="btn">${btn} ${icon("arrow-right", { size: 20, sw: 2.6 })}</div></div>`);
const dotrow = (on, col, off, n = 10, s = 16) => `<div style="display:flex;gap:6px">${Array.from({ length: n }, (_, i) => `<i style="display:block;width:${s}px;height:${s}px;border-radius:50%;background:${on.includes(i) ? col : off}"></i>`).join("")}</div>`;
const bars = (vals, col, w = 16, h = 70, gap = 7) => `<div style="display:flex;align-items:flex-end;gap:${gap}px;height:${h}px">${vals.map((v) => `<i style="display:block;width:${w}px;height:${Math.max(4, v)}px;border-radius:${w / 2}px;background:${col}"></i>`).join("")}</div>`;


// ---- Her notes (Nov 6 2026):
// 1. "в первоначальной идее — понять, действительно ли ты чего-то хочешь, или это просто
//    с чем-то связано: хочу ли я ребёнка, уволиться, переехать… может, это повторяется
//    только в дни, когда плохо сплю, ругаюсь с партнёром… можем ввязать в концепцию?"
// 2. "нужны отдельные уведомления под действия? за час до сна: через час спать, пройди
//    сессию, убирай телефон…"
const NEU = "hsl(232 62% 62%)", NEUL = "hsl(232 62% 62% / .22)";
const sec = (t) => `<div class="wk" style="text-align:left;margin-top:14px">${t}</div>`;
const lrow = (ic, h, t, on = false, dim = false) => `<div class="card row${on ? " on" : ""}" style="height:52px;margin-top:8px;${dim ? "opacity:.55" : ""}">${tile(ic, h)}${t}${on ? `<span class="tick">${icon("check", { size: 15, sw: 3, color: "#fff" })}</span>` : ""}</div>`;
const hbar = (label, k, n, col, strong = false) => `<div style="margin-top:10px"><div style="display:flex;justify-content:space-between;font-size:15px;font-weight:${strong ? 800 : 700}"><span>${label}</span><span style="color:#6B7184">${k} of ${n}</span></div>
  <div style="height:12px;border-radius:6px;background:rgba(58,63,78,.08);margin-top:5px;overflow:hidden"><i style="display:block;height:100%;width:${Math.round((k / n) * 100)}%;border-radius:6px;background:${col}"></i></div></div>`;
const lock = (time, date, cards) => P3(`<div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(30,40,90,.35), rgba(30,40,90,.15))"></div>
  <div style="position:absolute;left:0;right:0;top:86px;text-align:center;color:#fff"><div style="font-size:18px;font-weight:700;opacity:.9">${date}</div><div style="font-size:84px;font-weight:700;letter-spacing:-.03em;line-height:1">${time}</div></div>
  <div style="position:absolute;left:14px;right:14px;top:250px;display:flex;flex-direction:column;gap:10px">${cards}</div>`);

const s4 = {
  // ---- decisions ----
  "d1-list": P3(`<div class="screen">${navTop(1, 6)}
    <h1 style="font-size:28px;margin-top:6px">What keeps happening?</h1>
    ${lrow("heart-crack", HUE.love, "Fights with my partner", false, true)}${lrow("activity", HUE.health, "Migraines", false, true)}${lrow("moon", HUE.sleep, "Bad nights", false, true)}
    ${sec("A THOUGHT KEEPS COMING BACK")}
    ${lrow("briefcase", HUE.work, "I want to quit my job", true)}${lrow("baby", HUE.love, "I want a baby")}${lrow("plane", HUE.amber, "I want to move")}${lrow("split", HUE.lilac, "I think about breaking up")}
    <div class="grow"></div><div class="btn">Continue</div></div>`),
  "d2-main": P3(`<div class="screen">${navTop(3, 6)}
    <h1 style="font-size:28px;margin-top:6px">Your main question</h1>
    <div class="card" style="margin-top:16px;padding:18px">
      <span class="itag"><b style="background:${NEU}"></b>Work · main</span>
      <div style="font-size:23px;font-weight:800;margin-top:8px">Did you want to quit today?</div>
      <div class="yn" style="margin-top:14px"><span style="height:48px">No</span><span class="on" style="height:48px">Yes</span></div>
      <div style="margin-top:12px;display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:15px;background:${NEUL};color:${NEU};font-size:14px;font-weight:800">${icon("scale", { size: 15, sw: 2.4 })} No right or wrong answer</div></div>
    ${sec("WHAT MIGHT BRING IT ON · EXAMPLES")}
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">${qrow(HUE.health, "Body", "Did you sleep 7+ hours?", 1)}${qrow(HUE.work, "Work", "Hard day at work?", 1)}${qrow(HUE.love, "Love", "Fight with your partner?", 1)}${qrow(HUE.health, "Body", "Period?", 0)}</div>
    <div class="grow"></div><div class="btn">Next</div></div>`),
  "d3-days": P3(`<div class="sheet"><div class="grab"></div>
    <div style="display:flex;align-items:center;gap:10px"><span class="tile" style="background:hsl(${TEAL} / .14)">${partIcon(PARTS[0], 21)}</span><span style="font-size:27px;font-weight:800">My days</span></div>
    <div style="margin-top:14px;font-size:17px;font-weight:800">Wanted to quit · November</div>
    <div style="margin-top:12px;display:flex;justify-content:center">${month([1, 2, 5, 8, 9, 12, 15, 16, 19, 22, 23, 26, 29, 30], { size: 30, gap: 12, col: NEU, off: NEUL })}</div>
    <div style="display:flex;gap:16px;justify-content:center;margin-top:14px;font-size:14px;font-weight:800;color:#6B7184"><span><i style="display:inline-block;width:11px;height:11px;border-radius:6px;background:${NEU}"></i> wanted to</span><span><i style="display:inline-block;width:11px;height:11px;border-radius:6px;background:${NEUL}"></i> didn't</span></div>
    <div class="card" style="margin-top:16px;padding:14px;background:${NEUL};box-shadow:none;font-size:17px;font-weight:800;text-align:center">14 of 30 days</div>
    <div style="margin-top:10px;font-size:14px;font-weight:600;color:#6B7184;text-align:center">A wish isn't good or bad — so it's blue, not red or green.</div></div>`),
  "d4-steady": P3(`<div class="sheet"><div class="grab"></div>
    <div style="display:flex;align-items:center;gap:10px"><span class="tile" style="background:hsl(${TEAL} / .14)">${partIcon(PARTS[1], 21)}</span><span style="font-size:27px;font-weight:800">Links</span></div>
    <div class="card" style="margin-top:14px;padding:16px;background:rgba(58,63,78,.04);box-shadow:none">
      <div style="font-size:12px;font-weight:800;letter-spacing:.06em;color:#6B7184">STEADY OR DEPENDS ON THE DAY?</div>
      <div style="font-size:19px;font-weight:800;margin-top:4px">When you wanted to quit</div>
      ${hbar("After a short night", 9, 10, NEU, true)}${hbar("After a hard day at work", 7, 8, NEU, true)}${hbar("After a fight", 2, 5, NEU)}${hbar("Other days", 3, 12, NEU)}</div>
    <div class="card" style="margin-top:12px;padding:14px 16px;background:${NEUL};box-shadow:none">
      <div style="font-size:18px;font-weight:800">Mostly on tired days</div>
      <div style="font-size:14px;font-weight:600;color:#6B7184;margin-top:3px">It came after short nights and hard work days — much less on other days.</div></div>
    <div class="card" style="margin-top:8px;padding:12px 16px;background:rgba(58,63,78,.04);box-shadow:none;opacity:.7">
      <div style="font-size:15px;font-weight:800">Other answer: “Steady”</div>
      <div style="font-size:13px;font-weight:600;color:#6B7184">Most days, whatever the day was like.</div></div>
    <div style="margin-top:10px;font-size:14px;font-weight:700;color:#6B7184;text-align:center">MeMap shows when the wish comes. The decision is yours.</div></div>`),
  "d5-act": P3(`<div class="sheet"><div class="grab"></div>
    <div style="display:flex;align-items:center;gap:10px"><span class="tile" style="background:hsl(${TEAL} / .14)">${partIcon(PARTS[2], 21)}</span><span style="font-size:27px;font-weight:800">When to act</span></div>
    <div class="card" style="margin-top:14px;padding:14px;background:rgba(58,63,78,.04);box-shadow:none">
      <div style="display:flex;align-items:center;gap:10px"><img src="${MAP("lighthouse")}" style="height:40px;filter:saturate(.4) opacity(.8)"><div><div style="font-size:17px;font-weight:800">Talk it over with someone I trust</div><div style="font-size:14px;font-weight:700;color:#6B7184">if it stays on 20 of 30 days · 2 months in a row</div></div></div>
      <div style="display:flex;gap:4px;margin-top:12px">${Array.from({ length: 20 }, (_, i) => `<i style="display:block;flex:1;height:9px;border-radius:5px;background:${i < 14 ? NEU : "rgba(58,63,78,.12)"}"></i>`).join("")}</div>
      <div style="font-size:13px;font-weight:700;color:#6B7184;margin-top:6px">14 of 20 this month · month 1 of 2</div></div>
    ${sec("WHAT HELPS · A TRY")}
    <div class="card" style="margin-top:8px;padding:14px;background:rgba(58,63,78,.04);box-shadow:none">
      <div style="font-size:16px;font-weight:800;display:flex;align-items:center;gap:6px">${icon("moon", { size: 16, sw: 2.4 })}2 weeks of good sleep</div>
      <div style="font-size:14px;font-weight:600;color:#6B7184;margin-top:3px">Does the wish stay when you're rested?</div></div></div>`),

  // ---- reminders for actions ----
  "r1-try": P3(`<div class="sheet" style="top:240px"><div class="grab"></div>
    <div style="font-size:12px;font-weight:800;letter-spacing:.06em;color:#6B7184">WHAT HELPS · YOU'LL TRY</div>
    <div style="font-size:24px;font-weight:800;margin-top:4px;display:flex;align-items:center;gap:8px">${icon("moon", { size: 22, sw: 2.4 })} In bed by 11 · 2 weeks</div>
    <div style="font-size:18px;font-weight:800;margin-top:20px">Remind me?</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">
      <div class="card row on" style="height:58px">${icon("bell-ring", { size: 20, sw: 2.4, color: TEALD })}<div style="line-height:1.15">22:00<div style="font-size:13px;font-weight:600;color:#6B7184">an hour before bed</div></div><span class="tick">${icon("check", { size: 15, sw: 3, color: "#fff" })}</span></div>
      <div class="card row" style="height:52px">${icon("clock", { size: 20, sw: 2.4, color: "#6B7184" })}Other time</div>
      <div class="card row" style="height:52px">${icon("bell-off", { size: 20, sw: 2.4, color: "#6B7184" })}No reminder</div></div>
    <div style="margin-top:12px;font-size:14px;font-weight:600;color:#6B7184">Your bedtime: 23:00 · change in Settings</div>
    <div class="btn" style="margin-top:16px">Start</div></div>`),
  "r2-lock": lock("22:00", "Thursday, 12 November", [
    notif("Bed in an hour 🌙", "3 questions, then the phone goes away. Day 5 of 14.", "now"),
    notif("Morning walk", "10 minutes is enough. Day 5 of 14.", "8:00"),
    notif("Last coffee for today?", "None after 2 pm — 3 days in a row.", "13:30"),
    notif("Your plan: book the neurologist", "You set it when the lighthouse lit up.", "10:00"),
  ].join("")),
  "r3-settings": P3(`<div class="sheet"><div class="grab"></div>
    <div style="font-size:27px;font-weight:800">Reminders</div>
    ${[["moon-star", "Bedtime", "23:00", ""], ["layers", "Evening questions", "22:00", "an hour before bed"], ["sprout", "What helps: in bed by 11", "22:00", "until 19 Nov"], ["sprout", "What helps: morning walk", "8:00", "until 19 Nov"], ["file-text", "When to act: my plan", "next day 10:00", "when a lighthouse lights"]].map(([ic, t, v, s]) =>
      `<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid rgba(58,63,78,.08)"><span class="tile" style="background:hsl(${TEAL} / .12)">${icon(ic, { size: 19, sw: 2.3, color: TEALD })}</span><div style="flex:1;line-height:1.2"><div style="font-size:16px;font-weight:800">${t}</div>${s ? `<div style="font-size:13px;font-weight:600;color:#6B7184">${s}</div>` : ""}</div><span style="font-size:15px;font-weight:800">${v}</span><span class="toggle" style="transform:scale(.8);margin-left:0"></span></div>`).join("")}
    <div class="card" style="margin-top:14px;padding:12px 14px;background:rgba(58,63,78,.04);box-shadow:none;font-size:14px;font-weight:700;color:#6B7184;line-height:1.4">At most 2 a day. Only kind words — never warnings.</div></div>`),
};

const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", args: ["--allow-file-access-from-files"] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const shots = {};
for (const [k, html] of Object.entries(s4)) {
  const f = path.join(SHOTS, k + ".html");
  writeFileSync(f, html);
  await p.goto(pathToFileURL(f).href); await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(SHOTS, k + ".png") });
  shots[k] = pathToFileURL(path.join(SHOTS, k + ".png")).href;
}
const board = async (keys, caps, title, sub, file) => {
  const w = keys.length * 410 + 30;
  await p.setViewportSize({ width: w, height: 1000 });
  const cells = keys.map((k, i) => '<div class="s"><img src="' + shots[k] + '"><p><b>' + (i + 1) + '.</b> ' + caps[i] + '</p></div>').join("");
  await p.setContent('<html><head><style>@font-face{font-family:DM;src:url(' + FONT + ');font-weight:100 900}@font-face{font-family:DM;src:url(' + FONT.replace("latin", "cyrillic") + ');unicode-range:U+0400-04FF;font-weight:100 900}body{margin:0;background:#EEF1FA;font-family:DM,sans-serif;color:#3A3F4E}' +
    'h2{margin:0;padding:26px 30px 0;font-size:32px;font-weight:800}h3{margin:6px 30px 0;font-size:20px;font-weight:600;color:#6B7184}.r{display:flex;gap:20px;padding:18px 30px 30px}.s{width:390px}.s img{width:390px;border-radius:28px;box-shadow:0 14px 30px -18px rgba(20,40,80,.5);display:block}' +
    '.s p{margin:12px 4px 0;font-size:18px;font-weight:600;line-height:1.35}.s p b{color:hsl(174 44% 36%)}</style></head><body><h2>' + title + '</h2><h3>' + sub + '</h3><div class="r">' + cells + '</div></body></html>');
  await p.waitForTimeout(700);
  await p.screenshot({ path: path.join(OUT, file), fullPage: true });
};
await board(["d1-list", "d2-main", "d3-days", "d4-steady", "d5-act"],
  ["<b>Без новой ветки:</b> в том же списке «Что повторяется?» раздел «Мысль возвращается»: уволиться, ребёнок, переезд, расстаться.",
   "<b>Главный вопрос-желание</b> с пометкой «тут нет правильного ответа». Примеры того, что может его вызывать: сон, тяжёлый день на работе, ссора, месячные.",
   "<b>Мои дни:</b> желание — синим, не красным и не зелёным (это уже работает в приложении). «14 из 30 дней».",
   "<b>Главное новое — «Постоянно или зависит от дня?»</b> Когда желание приходит: после короткой ночи 9 из 10, после тяжёлого дня 7 из 8, в остальные дни 3 из 12 → «Чаще в усталые дни». Или «Постоянно: почти каждый день, какой бы он ни был». «Решение — твоё».",
   "<b>Когда действовать:</b> «если держится 20 из 30 дней два месяца подряд → обсудить с тем, кому доверяю». <b>Что помогает:</b> две недели хорошего сна — остаётся ли желание, когда отдохнула?"],
  "«Правда ли я этого хочу?» — внутри тех же 4 частей", "Не новая ветка и не новый раздел: желание — такой же главный вопрос, плюс одна новая карточка в Связях", "64-decisions.png");
await board(["r1-try", "r2-lock", "r3-settings"],
  ["<b>«Попробую» спрашивает «Напомнить?»:</b> время подбирается само — за час до сна для «лечь до 23», утром для прогулки; можно своё или без напоминания.",
   "<b>Какие будут уведомления:</b> «Через час спать 🌙 — 3 вопроса и телефон в сторону», «Утренняя прогулка — 10 минут хватит», «Последний кофе на сегодня?», «Твой план: записаться к неврологу».",
   "<b>Настройки → Напоминания:</b> время сна, вечерние вопросы (за час до сна), привычки до конца попытки, план по маяку. Не больше 2 в день, только добрые слова."],
  "Напоминания под действия", "Сейчас есть только вечернее напоминание и уведомление, когда загорелся маяк; напоминаний к привычкам нет", "65-action-reminders.png");
console.log("ok", Object.keys(s4).length);
await b.close();
