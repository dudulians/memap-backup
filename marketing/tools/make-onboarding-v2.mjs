// Onboarding v2 (Nov 5 2026, her direction: no "hard days"; best days and hardest; a fork; screens in onboarding-v2-screens.mjs). Drawn in the app's look of Nov 5 2026 (her ask, Nov 5:
// "теперь онбординг давай продумывать и для старых и для новых"). Her sea behind, white cards,
// raised buttons and discs, her islands and animals. Screens are English (her rule).
// Run from marketing/tools: node make-onboarding.mjs
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const url = (p) => pathToFileURL(path.join(R, p)).href;
const OUT = path.join(R, "marketing/aurora-light-ux");
const SHOTS = path.join(OUT, "49-onboarding-v2");
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
const FONT = url("marketing/tools/aurora-tests/work/phone-preview-map/assets/dm-sans-latin-wght-normal-Xz1IZZA0.woff2");
const TEAL = "174 44% 42%";

const CSS = `
@font-face { font-family: DM; src: url(${FONT}) format("woff2"); font-weight: 100 900; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { width: 390px; height: 844px; overflow: hidden; position: relative; font-family: DM, sans-serif; color: #1E2F3A; -webkit-font-smoothing: antialiased; }
.sea { position: absolute; inset: 0; background: #B4CDF8 url(${PLANET}) no-repeat; background-size: 2767px auto; background-position: -1014px -31px; }
.status { position: absolute; top: 0; left: 0; right: 0; height: 47px; display: flex; align-items: center; justify-content: space-between; padding: 0 28px 0 34px; font-weight: 700; font-size: 16px; }
.screen { position: absolute; inset: 0; padding: 63px 20px 40px; display: flex; flex-direction: column; }
h1 { font-size: 30px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.12; }
.c { text-align: center; }
.sub { margin-top: 8px; font-size: 17px; font-weight: 600; color: #4E6177; line-height: 1.35; }
.grow { flex: 1; }
.card { background: rgba(255,255,255,.95); border-radius: 22px; box-shadow: 0 10px 24px -18px rgba(30,50,110,.6); }
.btn { height: 56px; border-radius: 999px; background: hsl(${TEAL}); color: #fff; font-weight: 800; font-size: 17px; box-shadow: 0 5px 0 hsl(172 70% 30%);
  display: flex; align-items: center; justify-content: center; gap: 8px; }
.link { height: 48px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; color: #4E6177; }
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
.chip.on { background: #fff; box-shadow: 0 0 0 2px hsl(${TEAL}); color: #1E2F3A; font-weight: 800; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.big { height: 64px; border-radius: 20px; font-size: 18px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.big.on { background: #fff; box-shadow: 0 0 0 2px hsl(${TEAL}); color: #1E2F3A; font-weight: 800; }
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
.coach .s { margin-top: 4px; font-size: 16px; font-weight: 600; color: #4E6177; }
.coach .ok { margin-top: 12px; height: 46px; border-radius: 999px; background: hsl(${TEAL}); color: #fff; font-weight: 800; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 0 hsl(172 70% 30%); }
.coach .tail { position: absolute; width: 18px; height: 18px; background: #fff; transform: rotate(45deg); border-radius: 3px; }
.tabbar { z-index: 2; position: absolute; left: 16px; right: 16px; bottom: 16px; height: 66px; border-radius: 24px; background: rgba(255,255,255,.92); display: grid; grid-template-columns: repeat(3, 1fr); box-shadow: 0 10px 30px -16px rgba(20,40,80,.4); }
.tabbar div { display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: #6A7B8E; gap: 2px; }
.tabbar div.on { color: #1E2F3A; background: rgba(30,47,58,.06); border-radius: 20px; margin: 4px; }
.head { position: absolute; top: 47px; left: 0; right: 0; height: 52px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; }
.head .l { position: absolute; left: 14px; height: 36px; padding: 0 12px 0 9px; border-radius: 18px; background: #fff; display: flex; align-items: center; gap: 4px; font-size: 16px; }
.head .r { position: absolute; right: 16px; width: 34px; height: 34px; }
.swipe { position: absolute; left: 22px; right: 22px; border-radius: 26px; background: #fff; box-shadow: 0 18px 40px -22px rgba(20,40,90,.6); }
.toggle { margin-left: auto; width: 50px; height: 30px; border-radius: 15px; background: hsl(${TEAL}); position: relative; }
.toggle::after { content: ""; position: absolute; right: 3px; top: 3px; width: 24px; height: 24px; border-radius: 12px; background: #fff; }
.seg { position: absolute; right: 18px; top: 54px; height: 36px; border-radius: 18px; background: rgba(255,255,255,.75); display: flex; padding: 3px; font-size: 14px; font-weight: 800; }
.seg span { padding: 0 12px; display: flex; align-items: center; border-radius: 15px; color: #4E6177; }
.seg span.on { background: #fff; color: #1E2F3A; box-shadow: 0 2px 6px rgba(20,40,80,.15); }
.stat { flex: 1; padding: 12px 8px; text-align: center; }
.stat b { display: block; font-size: 28px; font-weight: 800; letter-spacing: -.02em; }
.stat span { font-size: 14px; font-weight: 700; color: #4E6177; }
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

import { screens } from "./onboarding-v2-screens.mjs";
const S = screens({ page, isle, boat, disc, cur, lab, tile, icon, tabbar, head, HUE, TEAL, ISL, ANI });

const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", args: ["--allow-file-access-from-files"] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const shots = {};
for (const [k, html] of Object.entries(S)) {
  const f = path.join(SHOTS, k + ".html");
  writeFileSync(f, html);
  await p.goto(pathToFileURL(f).href); await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(SHOTS, k + ".png") });
  shots[k] = pathToFileURL(path.join(SHOTS, k + ".png")).href;
}
const board = async (keys, caps, title, file) => {
  const w = keys.length * 410 + 30;
  await p.setViewportSize({ width: w, height: 1000 });
  const cells = keys.map((k, i) => '<div class="s"><img src="' + shots[k] + '"><p><b>' + (i + 1) + '.</b> ' + caps[i] + '</p></div>').join("");
  await p.setContent('<html><head><style>@font-face{font-family:DM;src:url(' + FONT + ')}body{margin:0;background:#EEF1FA;font-family:DM,sans-serif;color:#1E2F3A}' +
    'h2{margin:0;padding:26px 30px 6px;font-size:30px;font-weight:800}.r{display:flex;gap:20px;padding:14px 30px}.s{width:390px}.s img{width:390px;border-radius:28px;box-shadow:0 14px 30px -18px rgba(20,40,80,.5);display:block}' +
    '.s p{margin:12px 4px 0;font-size:18px;font-weight:700;line-height:1.3}.s p b{color:hsl(174 44% 36%)}</style></head><body><h2>' + title + '</h2><div class="r">' + cells + '</div></body></html>');
  await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(OUT, file), fullPage: true });
};
await board(["v1-welcome", "v2-fork", "v3-pain", "v4-promise", "v5-first", "v6-swipe", "v7-firstlight", "v8-companion", "v9-today"],
  ["One line for both sides", "The fork: two big cards", "What keeps happening", "Her words · her first island from the cloud", "First answer: two taps", "First swipe = the first lesson", "First light · day 10 · reminder", "Who sails with you", "Today: one hint, on Start"],
  "New user · something keeps happening", "49-onboarding-v2-pain.png");
await board(["v2b-fork-good", "v3b-good", "v4b-promise-good", "v5b-first-good"],
  ["The other card", "What do you want more of", "Best days · her first island", "First answer: what helped"],
  "New user · more good days (then the same 6–9)", "50-onboarding-v2-good.png");
console.log("ok", Object.keys(S).length);
await b.close();
