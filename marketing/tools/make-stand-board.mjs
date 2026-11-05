// Board 54: things stand on the islands (flags, lighthouses, treasures), Nov 5 2026.
import { chromium } from "playwright-core";
import { readFileSync } from "fs";
const W = "aurora-tests/work";
const img = (f) => `data:image/png;base64,${readFileSync(`${W}/${f}`).toString("base64")}`;
const phone = (f, label) => `<figure><img class="ph" src="${img(f)}"><figcaption>${label}</figcaption></figure>`;
const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&display=swap" rel="stylesheet">
<style>body{margin:0;background:#eef1f8;font-family:Manrope,sans-serif;color:#3a3f55;padding:48px 56px;width:1400px}
h1{font-size:42px;font-weight:800;margin:0 0 6px;letter-spacing:-.02em}.sub{font-size:21px;font-weight:600;color:#6b7088;margin:0 0 30px}
.row{display:flex;gap:28px;align-items:flex-start}figure{margin:0;text-align:center}
.ph{width:360px;border-radius:32px;box-shadow:0 18px 40px -18px rgba(30,40,90,.45)}figcaption{margin-top:12px;font-size:21px;font-weight:700}
.cu{width:410px;height:300px;object-fit:cover;border-radius:24px;box-shadow:0 12px 28px -16px rgba(30,40,90,.45)}</style></head><body>
<h1>Things stand on the islands</h1><p class="sub">Flag, lighthouse and treasures on the ground with a soft shadow. Balloon landed; plane and sparkles stay in the sky.</p>
<div class="row">${phone("r26/aurora-light-1-map.png", "Map · day")}${phone("r26/aurora-1-map.png", "Map · night")}${phone("r26/aurora-light-4-globe.png", "Globe")}</div>
<div class="row" style="margin-top:34px">${[0,1,2].map(i=>`<img class="cu" src="${img(`r37/aurora-light-isle${i}.png`)}">`).join("")}</div><div class="row" style="margin-top:18px">${[0,1,2].map(i=>`<img class="cu" src="${img(`r37/aurora-isle${i}.png`)}">`).join("")}</div>
</body></html>`;
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await b.newPage({ viewport: { width: 1512, height: 900 } });
await p.setContent(html); await p.waitForTimeout(2500);
await p.screenshot({ path: "../aurora-light-ux/54-things-on-islands.png", fullPage: true });
await b.close(); console.log("ok");
