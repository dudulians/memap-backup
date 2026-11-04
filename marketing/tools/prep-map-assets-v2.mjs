// Her island pack v2 (Nov 4 2026, Downloads/MeMap_Islands_Clouds_Day_Night_Transparent.zip, unpacked to
// marketing/brand/map-assets-v2/). Each sprite sits on a 512 px canvas with empty margins; this trims every
// one to its painted pixels and saves a light webp, day and night with the same names:
// marketing/brand/map-assets-v2/trimmed/{day,night}/<name>.webp  (+ sizes.json with width/height)
// Run from marketing/tools: node prep-map-assets-v2.mjs
import { chromium } from "playwright-core";
import { readdirSync, writeFileSync, mkdirSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PACK = path.join(R, "marketing/brand/map-assets-v2/MeMap_Islands_Clouds_Day_Night_Pack");
const OUT = path.join(R, "marketing/brand/map-assets-v2/trimmed");
const jobs = [];
for (const [dir, prefix] of [["Islands", "isl_"], ["Cloud_Islands", ""], ["Clouds", ""]])
  for (const [tod, sub] of [["Day", "day"], ["Night", "night"]]) {
    mkdirSync(path.join(OUT, sub), { recursive: true });
    for (const f of readdirSync(path.join(PACK, dir, tod))) {
      if (!f.endsWith(".png") || (dir === "Clouds" && !f.includes("_large"))) continue;
      jobs.push({ src: pathToFileURL(path.join(PACK, dir, tod, f)).href, out: path.join(OUT, sub, prefix + f.replace(".png", ".webp")), name: prefix + f.replace(".png", ""), sub });
    }
  }
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", args: ["--allow-file-access-from-files"] });
const p = await b.newPage();
await p.goto(pathToFileURL(path.join(PACK, "README.txt")).href);
const sizes = {};
for (const j of jobs) {
  const r = await p.evaluate(async (src) => {
    const img = new Image(); img.src = src; await img.decode();
    const W = img.naturalWidth, H = img.naturalHeight, c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d"); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, W, H).data;
    let l = W, t = H, rr = 0, bb = 0;
    for (let y = 0; y < H; y++) for (let k = 0; k < W; k++) if (d[(y * W + k) * 4 + 3] > 10) { if (k < l) l = k; if (k > rr) rr = k; if (y < t) t = y; if (y > bb) bb = y; }
    const w = rr - l + 1, h = bb - t + 1, o = document.createElement("canvas"); o.width = w; o.height = h;
    o.getContext("2d").drawImage(c, l, t, w, h, 0, 0, w, h);
    return { data: o.toDataURL("image/webp", 0.9), w, h };
  }, j.src);
  writeFileSync(j.out, Buffer.from(r.data.split(",")[1], "base64"));
  if (j.sub === "day") sizes[j.name] = [r.w, r.h];
}
writeFileSync(path.join(OUT, "sizes.json"), JSON.stringify(sizes, null, 1));
await b.close();
console.log("trimmed", jobs.length);
