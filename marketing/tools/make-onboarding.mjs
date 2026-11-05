// Onboarding for new and old users, drawn in the app's look of Nov 4 2026 (her ask, Nov 5:
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
const SHOTS = path.join(OUT, "44-onboarding");
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
.chip.on { background: hsl(${TEAL} / .16); box-shadow: 0 0 0 1.5px hsl(${TEAL}); color: hsl(174 50% 28%); font-weight: 800; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.big { height: 64px; border-radius: 20px; font-size: 18px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.big.on { background: hsl(${TEAL} / .16); box-shadow: 0 0 0 2px hsl(${TEAL}); color: hsl(174 50% 26%); }
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
const tabbar = (on) => `<div class="tabbar">${[["calendar-days", "Today"], ["map", "Map"], ["notebook-pen", "Notes"]].map(([i, t], k) => `<div class="${k === on ? "on" : ""}">${icon(i, { size: 20 })}${t}</div>`).join("")}</div>`;
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

const S = {};
// ---------------- NEW USERS ----------------
S["n1-welcome"] = page(`
  <div class="seg"><span class="on">EN</span><span>RU</span></div>
  ${isle(92, 330, 150, "11_sakura")}${isle(300, 300, 130, "09_waterfall")}${isle(268, 470, 120, "17_lavender_garden")}
  ${boat(118, 360, 150)}
  <div class="screen" style="padding-top:0">
    <div class="grow"></div>
    <h1 class="c" style="font-size:34px">Find what's behind<br>your hard days</h1>
    <p class="sub c">One minute each evening</p>
    <div style="height:34px"></div>
    <div class="btn">Start ${icon("arrow-right", { size: 20, sw: 2.6 })}</div>
    <div class="link">I already have MeMap</div>
  </div>`);

S["n2-door"] = page(`<div class="screen">
  <div class="dots"><i class="on"></i><i></i><i></i><i></i></div>
  <h1 style="margin-top:10px">Something keeps<br>happening?</h1>
  <div style="margin-top:20px">
    ${[["heart", "Fights with my partner", HUE.love], ["activity", "Migraines", HUE.health, 1], ["wine", "Drinking", HUE.amber], ["moon", "My sleep", HUE.sleep], ["smile", "Snapping at my kid", HUE.coral], ["cloud", "My mood", HUE.lilac]]
      .map(([ic, t, h, on]) => `<div class="card row${on ? " on" : ""}">${tile(ic, h)}${t}${on ? `<span class="tick">${icon("check", { size: 16, sw: 3.2, color: "#fff" })}</span>` : ""}</div>`).join("")}
  </div>
  <div class="grid2" style="margin-top:12px"><div class="dash">Something else</div><div class="dash">Just curious</div></div>
  <div class="grow"></div>
  <div class="btn">Continue</div></div>`);

S["n3-first"] = page(`<div class="screen">
  <div class="dots"><span class="back">${icon("arrow-left", { size: 22 })}</span><i></i><i class="on"></i><i></i><i></i></div>
  <h1 style="margin-top:10px">When was the<br>last migraine?</h1>
  <div class="grid2" style="margin-top:18px">
    <div class="card big">Today</div><div class="card big on">Yesterday</div><div class="card big">This week</div><div class="card big">A while ago</div>
  </div>
  <p style="margin-top:28px;font-size:22px;font-weight:800">What came before?</p>
  <div class="chips" style="margin-top:12px">
    ${["Little sleep", "Stress", "Screens", "Skipped a meal", "Alcohol", "Weather", "Period", "Don't know"].map((c) => `<span class="chip${c === "Little sleep" || c === "Stress" ? " on" : ""}">${c}</span>`).join("")}
  </div>
  <div class="grow"></div>
  <div class="btn">Next</div></div>`);

S["n4-swipe"] = page(`<div class="screen">
  <div class="dots"><span class="back">${icon("arrow-left", { size: 22 })}</span><i></i><i></i><i class="on"></i><i></i></div>
  <h1 style="margin-top:10px">What else was<br>that day?</h1></div>
  <div class="swipe" style="top:262px;height:380px;transform:scale(.9) translateY(30px);opacity:.6"></div>
  <div class="swipe" style="top:262px;height:380px;transform:scale(.95) translateY(15px);opacity:.85"></div>
  <div class="swipe" style="top:262px;height:380px;transform:rotate(-3deg)">
    <div style="padding:20px 22px;font-size:15px;font-weight:700;color:#4E6177">1 of 3</div>
    <div style="display:flex;justify-content:center;margin-top:4px"><img src="${ISL("04_twin_hills")}" style="width:180px;filter:drop-shadow(0 6px 8px rgba(20,60,100,.25))"></div>
    <p style="position:absolute;left:22px;right:22px;bottom:28px;font-size:30px;font-weight:800;line-height:1.15">Did you sleep OK the night before?</p>
  </div>
  <div style="position:absolute;left:214px;top:398px;display:flex;flex-direction:column;align-items:center;gap:6px">
    <span style="width:64px;height:64px;border-radius:32px;background:rgba(255,255,255,.9);display:flex;align-items:center;justify-content:center;box-shadow:0 10px 20px -10px rgba(20,40,80,.5)">${icon("pointer", { size: 34, sw: 2, color: "#1E2F3A" })}</span>
    <span class="lab" style="position:static;transform:none">Swipe right = Yes</span>
  </div>
  <div style="position:absolute;left:22px;right:22px;top:676px;display:flex;gap:12px">
    <div class="card big" style="flex:1;color:#4E6177">${icon("arrow-left", { size: 20 })}&nbsp;No</div><div class="card big" style="flex:1;color:#4E6177">Yes&nbsp;${icon("arrow-right", { size: 20 })}</div>
  </div>
  <div class="link" style="position:absolute;left:0;right:0;top:752px">Not sure</div>`);

S["n5-firstlight"] = page(`<div class="screen">
  <h1 class="c" style="margin-top:28px">Your first light<br>is lit</h1>
  <p class="sub c">A few questions each evening.<br>Day 7: your first report.</p>
  </div>
  ${disc(195, 300, 40, "done", icon("check", { size: 34, sw: 3.2 }))}${lab(195, 354, "Today")}
  ${disc(250, 414, 30, "lock", icon("moon-star", { size: 24 }))}${lab(250, 458, "Tomorrow", true)}
  <div style="position:absolute;left:184px;top:500px;display:flex;flex-direction:column;gap:7px">${"<i style='width:8px;height:8px;border-radius:4px;background:rgba(30,47,58,.25);display:block'></i>".repeat(3)}</div>
  ${disc(150, 582, 36, "lock", icon("file-bar-chart-2", { size: 28 }), "background:linear-gradient(180deg,#FFF3C8,#F5DC92);box-shadow:0 6px 0 #DDBB62;color:#B88A25;")}${lab(150, 632, "Week report · day 7", true)}
  <div class="screen" style="padding-top:0">
    <div class="grow"></div>
    <div class="card row" style="height:58px;margin-bottom:14px">${icon("bell", { size: 22, color: "hsl(174 44% 42%)" })}<span style="font-size:17px">Remind me at 20:00</span><span class="toggle"></span></div>
    <div class="btn">Next</div>
  </div>`);

const animals = ["01_malu", "11_otter", "02_cat", "08_fox", "05_panda", "04_rabbit", "09_koala", "07_penguin", "29_red_panda"];
S["n6-companion"] = page(`<div class="screen">
  <h1 class="c" style="margin-top:20px">Who sails with you?</h1></div>
  ${boat(120, 150, 150)}
  <div style="position:absolute;left:30px;right:30px;top:330px;display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
    ${animals.map((a) => `<div class="card" style="height:96px;display:flex;align-items:center;justify-content:center;${a === "11_otter" ? `box-shadow:0 0 0 3px hsl(${TEAL}),0 10px 24px -18px rgba(30,50,110,.6)` : ""}"><img src="${ANI(a)}" style="width:72px"></div>`).join("")}
  </div>
  <div class="screen" style="padding-top:0"><div class="grow"></div>
    <div class="link" style="margin-bottom:4px">More animals · No one</div>
    <div class="btn">Set sail ${icon("arrow-right", { size: 20, sw: 2.6 })}</div></div>`);

S["n7-today-coach"] = page(`
  ${head("Week 1 · 0/7")}
  <p class="wk" style="position:absolute;left:0;right:0;top:112px">WEEK 1 · COLLECT CLUES</p>
  ${disc(150, 180, 30, "done", icon("check", { size: 26, sw: 3.2 }))}${lab(150, 224, "First answer")}
  ${cur(225, 370, 44, HUE.health, icon("heart-pulse", { size: 38 }))}${lab(225, 438, "Migraines")}
  <span class="startb" style="left:225px;top:302px">Start</span>
  ${boat(92, 330, 58)}
  ${disc(265, 530, 34, "todo", icon("pen-line", { size: 26, color: "hsl(350 60% 66%)" }))}${lab(265, 578, "Write a note")}
  ${disc(195, 660, 34, "todo", icon("lightbulb", { size: 26, color: "hsl(262 40% 64%)" }))}
  <div class="coachdim" style="background:radial-gradient(circle at 225px 345px, transparent 0 98px, rgba(14,24,60,.42) 100px)"></div>
  <div class="card coach" style="top:478px"><span class="tail" style="left:196px;top:-8px"></span>
    <p class="t">Tap Start</p><p class="s">4 questions · 1 minute</p><div class="ok">Got it</div></div>
  ${tabbar(0)}`);

S["n8-firstisland"] = page(`
  <div class="head" style="justify-content:flex-start;padding-left:20px;font-size:26px">Your world</div>
  ${isle(110, 330, 120, "cloud_island_01")}${isle(290, 300, 110, "cloud_island_03")}${isle(300, 560, 110, "cloud_island_05")}
  ${isle(110, 560, 140, "09_waterfall")}${lab(110, 588, `<span style="color:#7D8CC4;display:flex">${icon("cloud-lightning", { size: 16, sw: 2.4 })}</span>Health`)}
  ${boat(160, 380, 72)}
  <div class="coachdim" style="background:radial-gradient(circle at 110px 545px, transparent 0 92px, rgba(14,24,60,.42) 94px)"></div>
  <div class="card coach" style="top:238px"><span class="tail" style="left:80px;bottom:-8px"></span>
    <p class="t">Your first island</p><p class="s">It grows as you answer</p><div class="ok">Got it</div></div>
  ${tabbar(1)}`);

// ---------------- OLD USERS ----------------
S["o1-invite"] = page(`
  ${isle(95, 250, 120, "11_sakura")}${isle(295, 235, 110, "09_waterfall")}${isle(105, 420, 110, "17_lavender_garden")}${isle(290, 410, 110, "06_snow_peak")}
  ${route(dotsAlong([120, 245], [190, 200], [270, 232], 13))}
  ${boat(150, 280, 92)}
  <div class="screen" style="padding-top:0"><div class="grow"></div>
    <h1 class="c" style="font-size:32px">Your answers<br>built a world</h1>
    <div style="display:flex;gap:10px;margin-top:20px">
      <div class="card stat"><b>63</b><span>evenings</span></div><div class="card stat"><b>4</b><span>islands</span></div><div class="card stat"><b>2</b><span>links</span></div>
    </div>
    <p class="sub c" style="margin-top:14px">Nothing is lost · Old look stays in Settings</p>
    <div style="height:20px"></div>
    <div class="btn">Show me</div>
    <div class="link">Later</div>
  </div>`);

S["o2-islands"] = page(`<div class="screen">
  <h1 class="c" style="margin-top:14px">Your 4 islands</h1>
  <p class="sub c">Each one is a part of your life</p></div>
  ${route(dotsAlong([130, 330], [190, 270], [262, 312], 14))}
  ${isle(105, 345, 130, "11_sakura")}${lab(105, 378, "Love life")}
  ${isle(285, 330, 120, "09_waterfall")}${lab(285, 360, "Health")}
  ${isle(110, 560, 120, "17_lavender_garden")}${lab(110, 590, "Me")}
  ${isle(285, 560, 120, "06_snow_peak")}${lab(285, 590, "Work")}
  ${boat(158, 420, 74)}
  <div class="card" style="position:absolute;left:96px;top:208px;padding:9px 14px;font-size:15px;font-weight:700;border-radius:16px">Fights → a headache next day</div>
  <div class="screen" style="padding-top:0"><div class="grow"></div>
    <p class="sub c" style="margin-bottom:16px">Dots show what's linked</p>
    <div class="btn">Next</div></div>`);

S["o3-path"] = page(`<div class="screen">
  <h1 class="c" style="margin-top:14px">Your days are<br>now a path</h1>
  <p class="sub c">Same questions, in small steps</p></div>
  <div style="position:absolute;left:0;right:0;top:250px;display:flex;justify-content:center"><span class="goldchip">${icon("check", { size: 18, sw: 3, color: "#E3A21A" })}63 evenings so far</span></div>
  <p class="wk" style="position:absolute;left:0;right:0;top:304px">WEEK 1</p>
  <span class="startb" style="left:195px;top:368px">Start</span>
  ${cur(195, 436, 44, HUE.love, icon("heart", { size: 36 }))}${lab(195, 504, "Love life")}
  ${disc(255, 590, 34, "todo", icon("heart-pulse", { size: 26, color: `hsl(${HUE.health})` }))}${lab(255, 638, "Health")}
  ${disc(140, 690, 30, "lock", icon("moon-star", { size: 24 }))}
  <div class="screen" style="padding-top:0"><div class="grow"></div><div class="btn">Next</div></div>`);

S["o5-today"] = page(`
  ${head("Week 1 · 0/7", "63")}
  <div style="position:absolute;left:0;right:0;top:110px;display:flex;justify-content:center"><span class="goldchip">${icon("check", { size: 18, sw: 3, color: "#E3A21A" })}63 evenings so far</span></div>
  <p class="wk" style="position:absolute;left:0;right:0;top:162px">WEEK 1 · COLLECT CLUES</p>
  <span class="startb" style="left:195px;top:236px">Start</span>
  ${cur(195, 304, 44, HUE.love, icon("heart", { size: 36 }))}${lab(195, 372, "Love life")}
  ${boat(64, 264, 58)}
  ${disc(255, 460, 34, "todo", icon("heart-pulse", { size: 26, color: `hsl(${HUE.health})` }))}${lab(255, 508, "Health")}
  ${disc(170, 588, 34, "todo", icon("flower-2", { size: 26, color: `hsl(${HUE.me})` }))}${lab(170, 636, "Me")}
  <div class="card" style="position:absolute;left:16px;right:16px;bottom:96px;height:58px;display:flex;align-items:center;gap:12px;padding:0 10px 0 16px">
    ${icon("settings", { size: 22, color: "#4E6177" })}<span style="font-size:16px;font-weight:700">The old look is in Settings</span>
    <span style="margin-left:auto;width:36px;height:36px;display:flex;align-items:center;justify-content:center;color:#6A7B8E">${icon("x", { size: 20 })}</span></div>
  ${tabbar(0)}`);

const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", args: ["--allow-file-access-from-files"] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const shots = {};
for (const [k, html] of Object.entries(S)) {
  const f = path.join(SHOTS, `${k}.html`);
  writeFileSync(f, html);
  await p.goto(pathToFileURL(f).href); await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(SHOTS, `${k}.png`) });
  shots[k] = pathToFileURL(path.join(SHOTS, `${k}.png`)).href;
}
// boards: one per path, a caption under each screen
const board = async (keys, caps, title, file) => {
  const w = keys.length * 410 + 30;
  await p.setViewportSize({ width: w, height: 1000 });
  await p.setContent(`<html><head><style>@font-face{font-family:DM;src:url(${FONT})}body{margin:0;background:#EEF1FA;font-family:DM,sans-serif;color:#1E2F3A}
    h2{margin:0;padding:26px 30px 6px;font-size:30px;font-weight:800}.r{display:flex;gap:20px;padding:14px 30px}.s{width:390px}.s img{width:390px;border-radius:28px;box-shadow:0 14px 30px -18px rgba(20,40,80,.5);display:block}
    .s p{margin:12px 4px 0;font-size:18px;font-weight:700;line-height:1.3}.s p b{color:hsl(174 44% 36%)}</style></head><body>
    <h2>${title}</h2><div class="r">${keys.map((k, i) => `<div class="s"><img src="${shots[k]}"><p><b>${i + 1}.</b> ${caps[i]}</p></div>`).join("")}</div></body></html>`);
  await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(OUT, file), fullPage: true });
};
await board(["n1-welcome", "n2-door", "n3-first", "n4-swipe", "n5-firstlight", "n6-companion", "n7-today-coach", "n8-firstisland"],
  ["Promise + language in a corner", "What keeps happening", "First answer: two taps", "First swipe = the first lesson", "First light lit · what's next · reminder", "Pick who sails with you", "Today: one hint, on Start", "First visit to the Map: one hint"],
  "New user: first answer in under a minute", "44-onboarding-new.png");
await board(["o1-invite", "o2-islands", "o3-path", "n6-companion", "o5-today"],
  ["Their own numbers · ask, not force", "Their questions became islands", "Past evenings fold into one chip", "Pick who sails with you (same)", "Today + a way back, once"],
  "Old user: meets 2.0 with their own world", "45-onboarding-old.png");
console.log("ok", Object.keys(S).length);
await b.close();
