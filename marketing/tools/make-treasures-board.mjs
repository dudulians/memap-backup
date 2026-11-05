// Board 55: every treasure (her pack, Nov 5 2026): what earns it and where it stands, plus the islands with almost all of them.
import { chromium } from "playwright-core";
import { readFileSync } from "fs";
const W = "aurora-tests/work/r40", A = "../../src/assets/map";
const img = (f) => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
const webp = (n) => `data:image/webp;base64,${readFileSync(`${A}/${n}.webp`).toString("base64")}`;
const rows = [
  ["hot_air_balloon", "Balloon", "First week", "on the island"], ["camera", "Camera", "First link", "on the island"],
  ["wooden_signpost", "Signpost", "Your own island", "on the island"], ["books", "Books", "10 notes", "on the island"],
  ["sparkles", "Stars", "A hunch checked", "a glint over it"], ["art_easel", "Easel", "First test", "on the island"],
  ["bicycle", "Bicycle", "14 days in a row", "on the island"], ["rainbow", "Rainbow", "Storm turned calm", "behind the island"],
  ["airplane", "Plane", "60 days", "in the sky"],
  ["moon_and_stars", "Moon · new", "7 evenings in a row", "in the sky"], ["chest_open_map", "Chest · new", "First week's report", "on the island"],
  ["zen_stones", "Zen stones · new", "A calm week", "on the calm island"], ["lavender", "Lavender · new", "Bubbles on 7 days", "on the island"],
  ["house", "House · new", "An island fully grown", "behind, on that island"], ["camping_tent", "Tent · new", "30 days", "behind"],
  ["travel_suitcase", "Suitcase · new", "100 days", "on the island"],
  ["green_tree", "Garden · new", "Every finished test", "a tree on its island (2 max)"],
];
const html = `<!doctype html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&display=swap" rel="stylesheet">
<style>body{margin:0;background:#eef1f8;font-family:Manrope,sans-serif;color:#3a3f55;padding:44px 52px;width:1500px}
h1{font-size:40px;font-weight:800;margin:0 0 6px}.sub{font-size:20px;font-weight:600;color:#6b7088;margin:0 0 26px}
.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:14px}.t{background:#fff;border-radius:20px;padding:12px;text-align:center;box-shadow:0 10px 24px -16px rgba(30,40,90,.4)}
.t img{height:64px;max-width:100%;object-fit:contain}.n{font-size:17px;font-weight:800;margin-top:6px}.h{font-size:15px;font-weight:700;color:#3a8f86}.w{font-size:13px;font-weight:600;color:#7a7f96}
.row{display:flex;gap:22px;margin-top:30px;align-items:flex-start}.ph{width:330px;border-radius:30px;box-shadow:0 18px 40px -18px rgba(30,40,90,.45)}.cu{width:300px;height:220px;object-fit:cover;border-radius:22px;box-shadow:0 12px 28px -16px rgba(30,40,90,.45)}
.note{font-size:18px;font-weight:600;color:#55596f;margin-top:22px;line-height:1.5}</style></head><body>
<h1>All the treasures</h1><p class="sub">16 from your pack, plus a garden. Each stands on a ground spot of its island; at most 3 on one island, the rest wait on your shelf.</p>
<div class="grid">${rows.map(([p, n, h, w]) => `<div class="t"><img src="${webp(p)}"><div class="n">${n}</div><div class="h">${h}</div><div class="w">${w}</div></div>`).join("")}</div>
<div class="row"><img class="ph" src="${img(`${W}/aurora-light-map.png`)}"><img class="ph" src="${img(`${W}/aurora-map.png`)}">
<div><img class="cu" src="${img(`${W}/aurora-light-isle0.png`)}"><br><br><img class="cu" src="${img(`${W}/aurora-light-isle1.png`)}"><br><br><img class="cu" src="${img(`${W}/aurora-light-isle2.png`)}"></div></div>
</body></html>`;
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await b.newPage({ viewport: { width: 1604, height: 900 } });
await p.setContent(html); await p.waitForTimeout(2500);
await p.screenshot({ path: "../aurora-light-ux/55-all-treasures.png", fullPage: true });
await b.close(); console.log("ok");
