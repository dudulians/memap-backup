// Board 53: her "Me" island pack in the app (screens from aurora-tests/test-r36-me-pack.mjs).
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync } from "fs";
const W = "aurora-tests/work/r36";
const img = (f) => `data:image/png;base64,${readFileSync(`${W}/${f}.png`).toString("base64")}`;
const phone = (f, label) => `<figure><img class="ph" src="${img(f)}"><figcaption>${label}</figcaption></figure>`;
const stages = [[1, "Day 1"], [2, "3 evenings"], [3, "7 evenings"], [4, "14 evenings"], [5, "21 evenings"]];
const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;700;800&display=swap" rel="stylesheet">
<style>
body{margin:0;background:#eef1f8;font-family:Manrope,sans-serif;color:#3a3f55;padding:48px 56px;width:1720px}
h1{font-size:44px;font-weight:800;margin:0 0 6px;letter-spacing:-.02em}
.sub{font-size:22px;font-weight:600;color:#6b7088;margin:0 0 34px}
.row{display:flex;gap:28px;align-items:flex-start}
figure{margin:0;text-align:center}
.ph{width:390px;border-radius:34px;box-shadow:0 18px 40px -18px rgba(30,40,90,.45)}
figcaption{margin-top:14px;font-size:22px;font-weight:700}
h2{font-size:28px;font-weight:800;margin:46px 0 18px}
.st{width:316px;height:316px;border-radius:26px;object-fit:cover;box-shadow:0 12px 28px -16px rgba(30,40,90,.45)}
.note{margin-top:30px;font-size:20px;font-weight:600;color:#6b7088;line-height:1.5}
</style></head><body>
<h1>Me island: your pack in the app</h1>
<p class="sub">Preview only, nothing installed. Fully grown (21+ evenings), demo data.</p>
<div class="row">
${phone("map-me5-day", "World · day")}${phone("map-me5-night", "World · night")}${phone("globe-me5-day", "Globe")}${phone("card-me5-day", "Island card")}
</div>
<h2>How it grows (5 pictures)</h2>
<div class="row">${stages.map(([s, l]) => `<figure><img class="st" src="${img(`stage${s}-day`)}"><figcaption>${l}</figcaption></figure>`).join("")}</div>
<div class="row" style="margin-top:22px">${stages.map(([s]) => `<figure><img class="st" src="${img(`stage${s}-night`)}"></figure>`).join("")}</div>
</body></html>`;
writeFileSync("aurora-tests/work/r36/board.html", html);
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await b.newPage({ viewport: { width: 1832, height: 1000 }, deviceScaleFactor: 1 });
await p.setContent(html); await p.waitForTimeout(2500);
await p.screenshot({ path: "../aurora-light-ux/53-me-island-pack.png", fullPage: true });
await b.close();
console.log("ok");
