// The welcome screen with different promises side by side (her question, Nov 5 2026:
// "Find what's behind your hard days — а мы точно хотим так позиционировать?").
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIR = path.join(R, "marketing/aurora-light-ux/44-onboarding");
const base = readFileSync(path.join(DIR, "n1-welcome.html"), "utf8");
const H1 = /<h1 class="c" style="font-size:34px">[\s\S]*?<\/h1>\s*<p class="sub c">[\s\S]*?<\/p>/;
if (!H1.test(base)) throw new Error("no headline");
const V = [
  ["now", "Find what's behind<br>your hard days", "One minute each evening", "Now: promises a cause"],
  ["a", "See what your<br>hard days<br>have in common", "One minute each evening", "A · the research wedge, honest"],
  ["b", "Spot your patterns<br>and triggers", "One minute each evening", "B · people's own words, neutral"],
  ["c", "All your days<br>on one map", "One minute each evening", "C · brand-led, no pain"],
];
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", args: ["--allow-file-access-from-files"] });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
const shots = [];
for (const [k, h, s] of V) {
  const f = path.join(DIR, `welcome-${k}.html`);
  writeFileSync(f, base.replace(H1, `<h1 class="c" style="font-size:32px;padding:0 6px">${h}</h1><p class="sub c">${s}</p>`));
  await p.goto(pathToFileURL(f).href); await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(DIR, `welcome-${k}.png`) });
  shots.push(pathToFileURL(path.join(DIR, `welcome-${k}.png`)).href);
}
const FONT = pathToFileURL(path.join(R, "marketing/tools/aurora-tests/work/phone-preview-map/assets/dm-sans-latin-wght-normal-Xz1IZZA0.woff2")).href;
await p.setViewportSize({ width: 4 * 410 + 30, height: 1000 });
await p.setContent(`<html><head><style>@font-face{font-family:DM;src:url(${FONT})}body{margin:0;background:#EEF1FA;font-family:DM,sans-serif;color:#1E2F3A}
  .r{display:flex;gap:20px;padding:24px 30px}.s img{width:390px;border-radius:28px;box-shadow:0 14px 30px -18px rgba(20,40,80,.5);display:block}.s p{margin:12px 4px 0;font-size:19px;font-weight:700}</style></head>
  <body><div class="r">${V.map(([, , , cap], i) => `<div class="s"><img src="${shots[i]}"><p>${cap}</p></div>`).join("")}</div></body></html>`);
await p.waitForTimeout(500);
await p.screenshot({ path: path.join(R, "marketing/aurora-light-ux/46-welcome-lines.png"), fullPage: true });
await b.close();
console.log("ok");
