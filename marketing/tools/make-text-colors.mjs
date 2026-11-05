// Text colour options on two onboarding screens, side by side (her question, Nov 5 2026:
// "а нам нравится чёрный шрифт? есть ещё варианты? просто пример покажи, не меняя").
import { chromium } from "playwright-core";
import { pathToFileURL } from "url";
const R = "C:/Users/ulian/OneDrive/Desktop/MeMap/memap-self-aware-main/";
const SHOTS = R + "marketing/aurora-light-ux/49-onboarding-v2/";
const OUT = R + "marketing/aurora-light-ux/51-text-colors.png";
const V = [
  ["Now: dark slate", "#1E2F3A", "#4E6177"],
  ["Ink blue", "#252A6B", "#5B60A0"],
  ["Plum", "#43295F", "#77608F"],
  ["Deep teal", "#0E4744", "#46736F"],
  ["Soft graphite", "#3A3F4E", "#6B7184"],
];
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", args: ["--allow-file-access-from-files"] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const shots = {};
for (const [name, ink, sub] of V) {
  for (const scr of ["v1-welcome", "v3-pain", "v7-firstlight"]) {
    await p.goto(pathToFileURL(SHOTS + scr + ".html").href); await p.waitForTimeout(300);
    await p.addStyleTag({ content: `body, h1, .row, .card, .big, .chip, .lab, .head, .wk, .status { color: ${ink} !important; }
      .sub, .link, .p-sub, .s { color: ${sub} !important; } .row svg, .tile svg { color: inherit; } .btn { color: #fff !important; }
      p span[style*="4E6177"] { color: ${sub} !important; }` });
    await p.waitForTimeout(150);
    const f = `C:/Users/ulian/AppData/Local/Temp/claude/5a8edffa16f0e7b7/0e73248b-23c2-4fd8-aeae-4a9274fb2ac3/scratchpad/tc-${V.findIndex((v) => v[0] === name)}-${scr}.png`;
    await p.screenshot({ path: f });
    (shots[name] ??= []).push(pathToFileURL(f).href);
  }
}
const cols = V.map(([name, ink]) => `<div class="c"><h3><i style="background:${ink}"></i>${name}<span>${ink}</span></h3>${shots[name].map((s) => `<img src="${s}">`).join("")}</div>`).join("");
await p.setViewportSize({ width: 5 * 330 + 60, height: 900 });
await p.setContent(`<html><head><style>body{margin:0;background:#EEF1FA;font-family:"Segoe UI",sans-serif;color:#1E2F3A}
  h2{margin:0;padding:24px 30px 4px;font-size:28px}.r{display:flex;gap:20px;padding:14px 30px}.c{width:310px}
  .c h3{display:flex;align-items:center;gap:8px;margin:0 0 10px;font-size:18px}.c h3 i{width:18px;height:18px;border-radius:9px;display:inline-block}
  .c h3 span{margin-left:auto;font-size:13px;font-weight:600;opacity:.6}.c img{width:310px;border-radius:24px;display:block;margin-bottom:14px;box-shadow:0 12px 26px -18px rgba(20,40,80,.5)}</style></head>
  <body><h2>Text colour: now and four other options</h2><div class="r">${cols}</div></body></html>`);
await p.waitForTimeout(800);
await p.screenshot({ path: OUT, fullPage: true });
await b.close();
console.log("ok");
