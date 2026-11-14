// Her own islands' pictures (Nov 14 2026): six islands of her pack the app did not use yet, day and night, made 360 px
// wide like the others in src/assets/globe/{day,night}. From marketing/brand/map-assets-v2/trimmed.
// Run from marketing/tools: node prep-own-islands.mjs
import { chromium } from "playwright-core";
import fs from "fs";
const ROOT = "C:/Users/ulian/OneDrive/Desktop/MeMap/memap-self-aware-main";
const SRC = `${ROOT}/marketing/brand/map-assets-v2/trimmed`, OUT = `${ROOT}/src/assets/globe`;
const NAMES = ["12_cypress_hill", "07_blue_lagoon", "08_rocky_grove", "13_palms", "18_zen_sakura", "25_waterfall_garden"];
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", args: ["--allow-file-access-from-files"] });
const p = await b.newPage();
await p.goto(`file:///${SRC}/day/isl_${NAMES[0]}.webp`);
for (const n of NAMES) for (const dn of ["day", "night"]) {
  const data = await p.evaluate(async (url) => {
    const img = new Image(); img.src = url; await img.decode();
    const w = 360, h = Math.round((img.naturalHeight * w) / img.naturalWidth);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(img, 0, 0, w, h);
    return { w, h, url: c.toDataURL("image/webp", 0.86) };
  }, `file:///${SRC}/${dn}/isl_${n}.webp`);
  fs.writeFileSync(`${OUT}/${dn}/${n}.webp`, Buffer.from(data.url.split(",")[1], "base64"));
  console.log(dn, n, data.w, data.h, (data.h / data.w).toFixed(3));
}
await b.close();
