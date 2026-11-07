// Onboarding by islands (Nov 7 2026), her two notes:
//  - "чтобы не было опять: темы одни, слова другие, вопросы третьи, топики четвёртые" →
//    one chain of words: island (the same names and icons as on the globe) → topic → questions
//    labelled with that island;
//  - "может, спрашивать: есть проблемы, которые хотите решить, или всё устраивает, но можно лучше" →
//    A: a first question "What brings you here?" on its own screen; B: one screen with a switch.
// Run from marketing/tools: node make-onboarding-areas.mjs
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const url = (p) => pathToFileURL(path.join(R, p)).href;
const OUT = path.join(R, "marketing/aurora-light-ux");
const SHOTS = path.join(OUT, "77-onboarding-islands");
mkdirSync(SHOTS, { recursive: true });

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
const ICON = (n) => url(`src/assets/map/icon_${n}.webp`);
const ISL = (n) => url(`src/assets/globe/day/${n}.webp`);
const PLANET = url("src/assets/globe/planet-day.webp");
const FONT = url("src/assets/fonts/manrope-latin-wght-normal.woff2");
const TEAL = "174 44% 42%";

const CSS = `
@font-face { font-family: DM; src: url(${FONT}) format("woff2"); font-weight: 100 900; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { width: 390px; height: 844px; overflow: hidden; position: relative; font-family: DM, sans-serif; color: #3A3F4E; -webkit-font-smoothing: antialiased; }
.sea { position: absolute; inset: 0; background: #B4CDF8 url(${PLANET}) no-repeat; background-size: 2767px auto; background-position: -1014px -31px; }
.status { position: absolute; top: 0; left: 0; right: 0; height: 47px; display: flex; align-items: center; justify-content: space-between; padding: 0 28px 0 34px; font-weight: 700; font-size: 16px; }
.screen { position: absolute; inset: 0; padding: 63px 20px 34px; display: flex; flex-direction: column; }
h1 { font-size: 30px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.12; }
.sub { margin-top: 6px; font-size: 17px; font-weight: 600; color: #6B7184; line-height: 1.35; }
.grow { flex: 1; }
.screen > * { flex-shrink: 0; }
.screen > .grow { flex-shrink: 1; }
.card { background: rgba(255,255,255,.96); border-radius: 22px; box-shadow: 0 10px 24px -18px rgba(30,50,110,.6); }
.btn { height: 56px; border-radius: 999px; background: hsl(${TEAL}); color: #fff; font-weight: 800; font-size: 17px; box-shadow: 0 5px 0 hsl(172 70% 30%); display: flex; align-items: center; justify-content: center; gap: 8px; }
.link { height: 48px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; color: #6B7184; }
.dots { display: flex; gap: 6px; justify-content: center; height: 44px; align-items: center; position: relative; }
.dots i { width: 8px; height: 8px; border-radius: 4px; background: rgba(30,47,58,.22); }
.dots i.on { width: 22px; background: hsl(${TEAL}); }
.back { position: absolute; left: 0; top: 0; width: 44px; height: 44px; border-radius: 22px; background: rgba(255,255,255,.7); display: flex; align-items: center; justify-content: center; }
.tick { margin-left: auto; width: 26px; height: 26px; border-radius: 13px; background: hsl(${TEAL}); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.fork { display: flex; align-items: center; gap: 16px; padding: 0 20px; height: 118px; font-size: 22px; font-weight: 800; line-height: 1.2; }
.fork + .fork { margin-top: 12px; }
.fork .ft { width: 58px; height: 58px; border-radius: 29px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.fork.on { box-shadow: 0 0 0 2px hsl(${TEAL}), 0 10px 24px -18px rgba(30,50,110,.6); }
.isl { padding: 0 14px; }
.isl + .isl { margin-top: 6px; }
.isl .h { display: flex; align-items: center; gap: 12px; height: 52px; font-size: 18px; font-weight: 800; }
.isl .h img { width: 36px; height: 36px; object-fit: contain; flex-shrink: 0; }
.isl .h .n { font-size: 14px; font-weight: 700; color: hsl(${TEAL}); margin-left: auto; display: flex; align-items: center; gap: 4px; }
.isl .h .chev { margin-left: auto; color: #9AA0B0; display: flex; }
.isl.open { padding-bottom: 12px; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { height: 38px; padding: 0 14px; border-radius: 999px; background: rgba(30,47,58,.05); font-size: 15px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; }
.chip.on { background: #fff; box-shadow: 0 0 0 2px hsl(${TEAL}); font-weight: 800; }
.seg { margin-top: 14px; height: 48px; border-radius: 24px; background: rgba(255,255,255,.6); display: grid; grid-template-columns: 1fr 1fr; padding: 4px; font-size: 15px; font-weight: 800; }
.seg span { display: flex; align-items: center; justify-content: center; border-radius: 20px; color: #6B7184; }
.seg span.on { background: #fff; color: #3A3F4E; box-shadow: 0 2px 8px rgba(20,40,80,.15); }
.q { padding: 12px 14px; }
.q + .q { margin-top: 8px; }
.q .lab { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px 0 4px; border-radius: 13px; background: rgba(30,47,58,.05); font-size: 13px; font-weight: 800; color: #5B6275; }
.q .lab img { width: 20px; height: 20px; object-fit: contain; }
.q .t { margin-top: 6px; font-size: 18px; font-weight: 700; line-height: 1.3; display: flex; gap: 10px; align-items: flex-start; }
.q.main { box-shadow: 0 0 0 2px hsl(${TEAL}), 0 10px 24px -18px rgba(30,50,110,.6); }
.kick { font-size: 12px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; color: #8A90A2; margin: 14px 4px 6px; }
.lbl { position: absolute; transform: translateX(-50%); white-space: nowrap; height: 30px; padding: 0 12px; border-radius: 15px; background: rgba(255,255,255,.96); font-size: 15px; font-weight: 800; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 6px 14px -8px rgba(20,50,90,.5); }
.isle { position: absolute; transform: translate(-50%, -70%); }
.isle img { width: 100%; display: block; filter: drop-shadow(0 6px 8px rgba(20,60,100,.25)); }
`;
const status = `<div class="status"><span>9:41</span><span style="display:flex;gap:6px;align-items:center">${icon("signal", { size: 17, sw: 2.6 })}${icon("wifi", { size: 17, sw: 2.6 })}${icon("battery-full", { size: 22, sw: 2 })}</span></div>`;
const page = (body) => `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body><div class="sea"></div>${status}${body}</body></html>`;
const top = (step, steps = 4) => `<div class="dots"><span class="back">${icon("arrow-left", { size: 22, sw: 2.4 })}</span>${Array.from({ length: steps }, (_, i) => `<i class="${i === step ? "on" : ""}"></i>`).join("")}</div>`;
const tick = `<span class="tick">${icon("check", { size: 16, sw: 3.2, color: "#fff" })}</span>`;
const chevD = `<span class="chev">${icon("chevron-down", { size: 22, sw: 2.4 })}</span>`;

// The islands (the globe's names; "Me" proposed as "Mind & mood")
const I = {
  health: ["health", "Health"], mind: ["wellbeing", "Mind & mood"], love: ["love", "Love life"], kids: ["growth", "Kids"],
  work: ["career", "Work"], body: ["fitness", "Body & habits"],
};
const islandRow = (key, chips, picked = []) => {
  const [ic, name] = I[key];
  if (!chips) return `<div class="isl card"><div class="h"><img src="${ICON(ic)}">${name}${chevD}</div></div>`;
  const n = picked.length;
  return `<div class="isl card open"><div class="h"><img src="${ICON(ic)}">${name}${n ? `<span class="n">${n} picked</span>` : `<span class="chev">${icon("chevron-up", { size: 22, sw: 2.4 })}</span>`}</div>
    <div class="chips">${chips.map((c) => `<span class="chip${picked.includes(c) ? " on" : ""}">${picked.includes(c) ? icon("check", { size: 16, sw: 3, color: `hsl(${TEAL})` }) : ""}${c}</span>`).join("")}</div></div>`;
};
const more = `<div class="link" style="height:40px;font-size:15px">${icon("plus", { size: 18, sw: 2.6 })}&nbsp;Pet · Parents · World around · your own</div>`;

const S = {};
// A1 — what brings you here
S["A1-why"] = page(`<div class="screen">${top(0)}
  <h1 style="margin-top:18px">What brings you here?</h1>
  <p class="sub">There's no wrong answer.</p>
  <div style="margin-top:26px">
    <div class="fork card"><span class="ft" style="background:hsl(230 60% 60% / .14);color:hsl(230 50% 55%)">${icon("cloud-drizzle", { size: 30, sw: 2.2 })}</span>Something keeps bothering me</div>
    <div class="fork card on"><span class="ft" style="background:hsl(40 90% 55% / .18);color:hsl(36 85% 48%)">${icon("sun", { size: 30, sw: 2.2 })}</span>I want more good days</div>
  </div>
  <div class="grow"></div>
  <div class="link">Just looking around</div>
  <div class="btn">Continue ${icon("arrow-right", { size: 20, sw: 2.6 })}</div></div>`);
// A2 — something bothers me → islands, the trouble topics
S["A2-bother"] = page(`<div class="screen">${top(1)}
  <h1 style="margin-top:14px">What keeps happening?</h1>
  <p class="sub">Pick up to 3.</p>
  <div style="margin-top:16px">
    ${islandRow("health", ["Bad nights", "Headaches", "Low energy", "Period & cycle"], ["Bad nights"])}
    ${islandRow("mind", ["Stress", "Low mood", "Worry"], ["Stress"])}
    ${islandRow("love")}${islandRow("kids")}${islandRow("work")}${islandRow("body")}
  </div>
  ${more}<div class="grow"></div>
  <div class="btn">Continue</div></div>`);
// A3 — more good days → the same islands, the good topics
S["A3-good"] = page(`<div class="screen">${top(1)}
  <h1 style="margin-top:14px">What do you want more of?</h1>
  <p class="sub">Pick up to 3.</p>
  <div style="margin-top:16px">
    ${islandRow("health", ["Good sleep", "Energy"], ["Good sleep"])}
    ${islandRow("mind", ["Calm", "Joy", "Focus"], ["Calm"])}
    ${islandRow("love", ["Closeness", "Time together"])}
    ${islandRow("work")}${islandRow("body")}
  </div>
  ${more}<div class="grow"></div>
  <div class="btn">Continue</div></div>`);
// B1/B2 — one screen with a switch
const bScreen = (good) => page(`<div class="screen">${top(0, 3)}
  <h1 style="margin-top:14px">What would you like to work on?</h1>
  <div class="seg"><span class="${good ? "" : "on"}">Something bothers me</span><span class="${good ? "on" : ""}">More good days</span></div>
  <div style="margin-top:14px">
    ${good ? islandRow("health", ["Good sleep", "Energy"], ["Good sleep"]) : islandRow("health", ["Bad nights", "Headaches", "Low energy", "Period & cycle"], ["Bad nights"])}
    ${good ? islandRow("mind", ["Calm", "Joy", "Focus"], ["Calm"]) : islandRow("mind", ["Stress", "Low mood", "Worry"], ["Stress"])}
    ${islandRow("love")}${islandRow("kids")}${islandRow("work")}
  </div>
  <div class="grow"></div>
  <div class="btn">Continue</div></div>`);
S["B1-switch-bother"] = bScreen(false);
S["B2-switch-good"] = bScreen(true);
// Shared — your daily questions, each with its island
const qRow = (key, text, main = false) => { const [ic, name] = I[key]; return `<div class="q card${main ? " main" : ""}"><span class="lab"><img src="${ICON(ic)}">${name}</span><div class="t"><span style="flex:1">${text}</span>${tick}</div></div>`; };
S["C1-questions"] = page(`<div class="screen">${top(2)}
  <h1 style="margin-top:14px">Your daily questions</h1>
  <p class="sub">About 1 minute each evening.</p>
  <div class="kick">For your topics</div>
  ${qRow("health", "Did you sleep 7+ hours last night?", true)}
  ${qRow("mind", "Was today stressful?", true)}
  <div class="kick">Around them</div>
  ${qRow("health", "Did you have caffeine after 2pm?")}
  ${qRow("work", "Did you work much longer than planned?")}
  ${qRow("body", "Screens in the hour before sleep?")}
  <div class="grow"></div>
  <div class="btn">Continue</div></div>`);
// Shared — the same islands on the globe
S["C2-world"] = page(`<div class="screen" style="padding:0">
  <div style="position:absolute;left:20px;top:70px"><h1>Your world has begun</h1><p class="sub">Your islands grow every evening you answer.</p></div>
  <div class="isle" style="left:120px;top:470px;width:150px"><img src="${ISL("03_flower_hill")}"></div><span class="lbl" style="left:120px;top:470px">${`<img src="${ICON("health")}" style="width:20px;height:20px">`}Health</span>
  <div class="isle" style="left:280px;top:600px;width:140px"><img src="${ISL("17_lavender_garden")}"></div><span class="lbl" style="left:280px;top:600px"><img src="${ICON("wellbeing")}" style="width:20px;height:20px">Mind &amp; mood</span>
  <div class="isle" style="left:150px;top:720px;width:120px"><img src="${ISL("04_twin_hills")}"></div><span class="lbl" style="left:150px;top:720px"><img src="${ICON("career")}" style="width:20px;height:20px">Work</span>
  </div>`);

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
const board = async (keys, caps, title, sub, file) => {
  const w = keys.length * 410 + 30;
  await p.setViewportSize({ width: w, height: 700 });
  const cells = keys.map((k, i) => '<div class="s"><img src="' + shots[k] + '"><p><b>' + (i + 1) + '.</b> ' + caps[i] + '</p></div>').join("");
  await p.setContent('<html><head><style>@font-face{font-family:DM;src:url(' + FONT + ');font-weight:100 900}@font-face{font-family:DM;src:url(' + FONT.replace("latin", "cyrillic") + ');unicode-range:U+0400-04FF;font-weight:100 900}body{margin:0;background:#EEF1FA;font-family:DM,sans-serif;color:#3A3F4E}' +
    'h2{margin:0;padding:26px 30px 0;font-size:32px;font-weight:800}h3{margin:6px 30px 0;font-size:20px;font-weight:600;color:#6B7184}.r{display:flex;gap:20px;padding:18px 30px 30px}.s{width:390px}.s img{width:390px;border-radius:28px;box-shadow:0 14px 30px -18px rgba(20,40,80,.5);display:block}' +
    '.s p{margin:12px 4px 0;font-size:18px;font-weight:600;line-height:1.35}.s p b{color:hsl(174 44% 36%)}</style></head><body><h2>' + title + '</h2><h3>' + sub + '</h3><div class="r">' + cells + '</div></body></html>');
  await p.waitForTimeout(700);
  await p.screenshot({ path: path.join(OUT, file), fullPage: true });
};
const shared = ["<b>Вопросы подписаны тем же островом</b> полным именем, со значком: «Health», «Mind &amp; mood», «Work». Без обрезанных «BODY &amp; H…».",
  "<b>И на глобусе те же острова, те же имена.</b> Одна цепочка слов: остров → тема → вопрос → остров на глобусе."];
await board(["A1-why", "A2-bother", "A3-good", "C1-questions", "C2-world"],
  ["<b>Сначала вопрос «What brings you here?»</b> Два больших ответа: «что-то беспокоит» / «хочу больше хороших дней». «Just looking around» — вместо «Start simple».",
   "<b>«Беспокоит» → острова</b> (те же, что на глобусе), внутри — темы про трудное. Раскрыт остров, где выбрано. До 3 тем из любых островов.",
   "<b>«Больше хороших дней» → те же острова</b>, внутри — хорошие темы: хороший сон, энергия, спокойствие, близость.",
   ...shared],
  "Вариант A: сначала «что тебя привело», потом острова", "Отдельный экран с двумя большими ответами; острова и их имена — как на глобусе; на один экран больше", "77-onboarding-islands-A.png");
await board(["B1-switch-bother", "B2-switch-good", "C1-questions", "C2-world"],
  ["<b>Один экран:</b> сверху переключатель «Something bothers me · More good days», под ним острова с темами.",
   "<b>Переключили на «More good days»</b> — те же острова, внутри хорошие темы. Экраном меньше, но переключатель легко не заметить.",
   ...shared],
  "Вариант B: один экран с переключателем", "Острова и темы те же; выбор тона — переключателем сверху, без отдельного экрана", "77-onboarding-islands-B.png");
console.log("ok", Object.keys(S).length);
await b.close();
