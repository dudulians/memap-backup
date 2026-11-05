// The world legend (Nov 5 2026, her ask: "собрать такую штуку для нас, где у каждого элемента
// в игре есть какой-то смысл"): every element of MeMap's world, its picture and one line of what
// it means. The words live in marketing/aurora-light-ux/WORLD-BIBLE.md. English, her rule.
// Run from marketing/tools: node make-world-legend.mjs
import { chromium } from "playwright-core";
import { readFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const url = (p) => pathToFileURL(path.join(R, p)).href;
const icon = (name, { size = 24, sw = 2, color = "currentColor" } = {}) => {
  let src = readFileSync(path.join(R, `node_modules/lucide-react/dist/esm/icons/${name}.js`), "utf8");
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
const BOAT = url("src/assets/map/sailboat.webp"), OTTER = url("src/assets/avatars/11_otter.webp"), LIGHT = url("src/assets/map/lighthouse.webp");
const PLANET = url("src/assets/globe/planet-day.webp");
const FONT = url("marketing/tools/aurora-tests/work/phone-preview-map/assets/dm-sans-latin-wght-normal-Xz1IZZA0.woff2");
const TEAL = "174 44% 42%";

const disc = (r, kind, inner, style = "") => `<span class="disc ${kind}" style="width:${2 * r}px;height:${2 * r}px;${style}"><b>${inner}</b></span>`;
const cur = (r, hue, inner) => `<span style="position:relative;display:inline-flex;padding:12px;border-radius:50%;border:6px solid rgba(255,255,255,.8)">${disc(r, "", inner, `background:hsl(${hue});box-shadow:0 6px 0 rgba(0,0,0,.22),0 6px 0 hsl(${hue});color:#fff`)}</span>`;
const pill = (inner) => `<span class="pill">${inner}</span>`;
const boat = (w) => `<span style="position:relative;display:inline-block;width:${w}px"><img src="${BOAT}" style="width:100%;display:block"><img src="${OTTER}" style="position:absolute;left:48%;top:40%;width:42%"></span>`;
const dots = (n = 11) => `<svg width="150" height="70">${Array.from({ length: n }, (_, i) => { const t = (i + 0.5) / n, u = 1 - t, x = u * u * 10 + 2 * u * t * 75 + t * t * 140, y = u * u * 55 + 2 * u * t * 0 + t * t * 55, e = Math.min(1, Math.min(t, 1 - t) / 0.16); return `<circle cx="${x}" cy="${y}" r="${1.8 + 2 * e}" fill="#fff" stroke="rgba(70,100,170,.3)" opacity="${0.35 + 0.65 * e}"/>`; }).join("")}</svg>`;

const TODAY = [
  [disc(32, "done", icon("check", { size: 28, sw: 3.2 })), "Gold disc", "An evening done", "A whole topic answered"],
  [cur(30, "174 44% 42%", icon("heart-pulse", { size: 28 })), "Disc with a ring", "Do this now", "Always one · Start begins it"],
  [disc(30, "todo", icon("pen-line", { size: 24, color: "hsl(350 60% 66%)" })), "White disc", "Open today", "Any order · tap for its card"],
  [disc(30, "lock", icon("moon-star", { size: 24 })), "Grey disc", "Not yet", "Coming days, or a game without data"],
  [boat(96), "The boat", "You", "Waits at your step · opens You"],
  [disc(34, "done", icon("file-bar-chart-2", { size: 28 })), "Week report", "What your week showed", "After 7 evenings · not a chest"],
  [`<span class="flame">${icon("flame", { size: 22, color: "#F59E0B" })}59</span>`, "The flame", "Evenings in a row", "Same rule as the gold discs"],
  [`<span style="display:flex;flex-direction:column;align-items:center;gap:6px">${disc(13, "done", "")}<span style="margin-left:34px">${disc(13, "todo", "")}</span>${disc(13, "lock", "")}</span>`, "The path", "Time", "Past above · today · future below"],
];
const MAP = [
  [`<img src="${ISL("11_sakura")}" style="width:118px">`, "An island", "A part of your life", "Appears with its questions"],
  [`<span style="display:flex;flex-direction:column;gap:6px">${pill(`<i style="color:#7D8CC4">${icon("cloud-lightning", { size: 16, sw: 2.4 })}</i>Storm`)}${pill(`<i style="color:#7D9CC8">${icon("cloud-sun", { size: 16, sw: 2.4 })}</i>Clouds`)}${pill(`<i style="color:#E8A93A">${icon("sun", { size: 16, sw: 2.4 })}</i>Sun`)}</span>`, "Weather", "The last 7 days there", "3+ hard days · 1–2 · none"],
  [`<span style="display:flex;align-items:flex-end;gap:4px"><img src="${ISL("03_flower_hill")}" style="width:46px"><img src="${ISL("04_twin_hills")}" style="width:56px"><img src="${ISL("05_wide_meadow")}" style="width:68px"></span>`, "Growth", "Your evenings there", "Your own islands: 7 and 14 evenings"],
  [`<img src="${ISL("cloud_island_03")}" style="width:118px">`, "Cloud island", "Not explored yet", "+ New island"],
  [dots(), "Dotted route", "A link found", "Often together, or the next day"],
  [`<img src="${LIGHT}" style="height:96px">`, "Lighthouse", "Your rule is reached", "Your limit, your plan · gold, no alarm"],
  [`<span style="display:flex;gap:10px;align-items:center"><span class="mini">${icon("map", { size: 30 })}</span>=<span class="mini">${icon("globe", { size: 30 })}</span></span>`, "Map and Globe", "One world, two views", "Same islands, same data"],
  [`<span class="cal">${Array.from({ length: 21 }, (_, i) => `<i style="background:${[2, 5, 6, 11, 15, 18].includes(i) ? "hsl(232 62% 64%)" : [9, 20].includes(i) ? "rgba(30,47,58,.08)" : "hsl(228 75% 84%)"}"></i>`).join("")}</span>`, "Calendar", "Hard and calm days", "Indigo = hard · lavender = calm"],
];
const COLORS = [["linear-gradient(180deg,#FFD866,#F6B92B)", "Gold", "done · report · lighthouse"], ["hsl(262 48% 62%)", "Island colour", "anything of that island"], [`hsl(${TEAL})`, "Teal", "act: Start, main buttons"], ["hsl(232 62% 64%)", "Indigo", "data: a yes, a hard day"], ["hsl(228 75% 84%)", "Lavender", "data: a no, a calm day"], ["#E4E8F1", "Grey", "not yet"]];

const card = ([pic, name, mean, rule]) => `<div class="card"><div class="pic">${pic}</div><p class="n">${name}</p><p class="m">${mean}</p><p class="r">${rule}</p></div>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: DM; src: url(${FONT}) format("woff2"); font-weight: 100 900; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { width: 1720px; font-family: DM, sans-serif; color: #1E2F3A; background: #B4CDF8 url(${PLANET}) no-repeat; background-size: 4200px auto; background-position: -1500px -60px; padding: 40px 40px 46px; -webkit-font-smoothing: antialiased; }
h1 { font-size: 40px; font-weight: 800; letter-spacing: -.02em; }
.lead { margin-top: 6px; font-size: 21px; font-weight: 600; color: #3E5168; }
h2 { margin: 30px 0 14px; font-size: 15px; font-weight: 800; letter-spacing: .1em; color: rgba(30,47,58,.6); }
.grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 14px; }
.card { background: rgba(255,255,255,.95); border-radius: 22px; padding: 14px 14px 16px; box-shadow: 0 12px 28px -20px rgba(30,50,110,.6); }
.pic { height: 132px; border-radius: 16px; background: linear-gradient(180deg, rgba(180,205,248,.55), rgba(200,214,250,.35)); display: flex; align-items: center; justify-content: center; overflow: hidden; }
.n { margin-top: 12px; font-size: 14px; font-weight: 800; color: rgba(30,47,58,.55); text-transform: uppercase; letter-spacing: .05em; }
.m { margin-top: 3px; font-size: 21px; font-weight: 800; line-height: 1.15; }
.r { margin-top: 5px; font-size: 15px; font-weight: 600; color: #4E6177; line-height: 1.3; }
.disc { position: relative; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; }
.disc b { position: relative; z-index: 1; display: flex; }
.disc::after { content: ""; position: absolute; left: 20%; right: 20%; top: 9%; height: 34%; border-radius: 50%; background: linear-gradient(rgba(255,255,255,.5), rgba(255,255,255,0)); }
.disc.done { background: linear-gradient(180deg,#FFD866,#F6B92B); box-shadow: 0 6px 0 #CF8E17; color: #fff; }
.disc.todo { background: #fff; box-shadow: 0 6px 0 #D3DAE8; }
.disc.lock { background: #E4E8F1; box-shadow: 0 6px 0 #C6CEDD; color: #A3ACC0; }
.pill { display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 12px 0 9px; border-radius: 15px; background: #fff; font-size: 15px; font-weight: 700; box-shadow: 0 6px 14px -8px rgba(20,50,90,.5); }
.pill i { display: flex; }
.flame { display: inline-flex; align-items: center; gap: 4px; height: 44px; padding: 0 16px 0 12px; border-radius: 22px; background: #fff; font-size: 22px; font-weight: 800; box-shadow: 0 6px 14px -8px rgba(20,50,90,.5); }
.mini { width: 58px; height: 58px; border-radius: 18px; background: #fff; display: flex; align-items: center; justify-content: center; color: #3E5168; box-shadow: 0 6px 14px -8px rgba(20,50,90,.5); }
.cal { display: grid; grid-template-columns: repeat(7, 13px); gap: 4px; }
.cal i { width: 13px; height: 13px; border-radius: 4px; }
.rules { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.rule { background: rgba(255,255,255,.95); border-radius: 22px; padding: 18px 20px; box-shadow: 0 12px 28px -20px rgba(30,50,110,.6); }
.rule b { display: block; font-size: 21px; font-weight: 800; }
.rule span { display: block; margin-top: 5px; font-size: 16px; font-weight: 600; color: #4E6177; line-height: 1.35; }
.colors { display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; }
.color { background: rgba(255,255,255,.95); border-radius: 18px; padding: 12px 14px; display: flex; gap: 12px; align-items: center; box-shadow: 0 12px 28px -20px rgba(30,50,110,.6); }
.color i { width: 38px; height: 38px; border-radius: 19px; flex-shrink: 0; }
.color b { display: block; font-size: 17px; font-weight: 800; }
.color span { display: block; font-size: 14px; font-weight: 600; color: #4E6177; }
</style></head><body>
<h1>The MeMap world: what each thing means</h1>
<p class="lead">You explore your own life. Each evening is a step. Parts of your life are islands. What happens together is a dotted route. Your own rule is a lighthouse. Each week ends in a report.</p>
<h2>THREE RULES</h2>
<div class="rules">
  <div class="rule"><b>Showing up grows the world</b><span>Gold discs, growth and the report come from answering, never from a "good" day. Weather and lighthouses show how things are; they never reward or punish.</span></div>
  <div class="rule"><b>Together, not why</b><span>A link says what tends to happen together, always with "k of n times". No "because".</span></div>
  <div class="rule"><b>No penalty for a gap</b><span>A week is 7 evenings you did, not 7 calendar days. Yesterday can still be filled in.</span></div>
</div>
<h2>TODAY · TIME: HOW YOU MOVE</h2>
<div class="grid">${TODAY.map(card).join("")}</div>
<h2>MAP & GLOBE · SPACE: WHAT YOU HAVE</h2>
<div class="grid">${MAP.map(card).join("")}</div>
<h2>EACH COLOUR, ONE JOB</h2>
<div class="colors">${COLORS.map(([c, n, s]) => `<div class="color"><i style="background:${c}"></i><div><b>${n}</b><span>${s}</span></div></div>`).join("")}</div>
</body></html>`;

const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", args: ["--allow-file-access-from-files"] });
const p = await (await b.newContext({ viewport: { width: 1720, height: 1200 }, deviceScaleFactor: 2 })).newPage();
const f = path.join(R, "marketing/aurora-light-ux/47-world-legend.html");
(await import("fs")).writeFileSync(f, html);
await p.goto(pathToFileURL(f).href); await p.waitForTimeout(700);
await p.screenshot({ path: path.join(R, "marketing/aurora-light-ux/47-world-legend.png"), fullPage: true });
await b.close();
console.log("ok");
