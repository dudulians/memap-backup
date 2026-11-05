// A sheet of every island picture with a 10% grid, to pick the flat ground spots
// where a flag, a lighthouse and treasures can stand (Nov 5 2026).
import { chromium } from "playwright-core";
import { writeFileSync } from "fs";
const A = "C:/Users/ulian/OneDrive/Desktop/MeMap/memap-self-aware-main/src/assets";
const names = ["03_flower_hill", "04_twin_hills", "05_wide_meadow", "06_snow_peak", "09_waterfall", "10_terraced_garden", "11_sakura",
  "14_stone_arch", "16_cozy_cottage", "17_lavender_garden", "19_grassy_terraces", "20_tropical_palms", "24_oak_tree", "26_flowery_island"];
const spots = process.argv[2] ? JSON.parse(process.argv[2]) : {};
const cell = (n) => {
  const s = spots[n] ?? {};
  const dots = Object.entries(s).map(([k, [x, y]]) => `<span style="position:absolute;left:${x}%;top:${y}%;width:12px;height:12px;margin:-6px;border-radius:50%;background:${({ flag: "#e33", light: "#f90", left: "#09f", right: "#0b6", front: "#a3f", back: "#850", g1: "#063", g2: "#063" })[k] ?? "#000"};border:2px solid #fff"></span><span style="position:absolute;left:${x}%;top:${y}%;font:700 11px sans-serif;color:#000;transform:translate(8px,-4px)">${k}</span>`).join("");
  return `<div style="display:inline-block;margin:10px;text-align:center;font:600 14px sans-serif">
  <div style="position:relative;width:420px;background:#bcd6f6">
    <img src="file:///${A}/globe/day/${n}.webp" style="display:block;width:100%">
    <div style="position:absolute;inset:0;background-image:linear-gradient(to right,rgba(0,0,0,.18) 1px,transparent 1px),linear-gradient(to bottom,rgba(0,0,0,.18) 1px,transparent 1px);background-size:10% 10%"></div>
    ${dots}
  </div>${n}</div>`;
};
const html = `<body style="margin:0;width:1800px;background:#fff">${names.map(cell).join("")}</body>`;
const S = "C:/Users/ulian/AppData/Local/Temp/claude/5a8edffa16f0e7b7/0e73248b-23c2-4fd8-aeae-4a9274fb2ac3/scratchpad";
writeFileSync(`${S}/spots.html`, html);
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", args: ["--allow-file-access-from-files"] });
const p = await b.newPage({ viewport: { width: 1800, height: 900 } });
await p.goto(`file:///${S}/spots.html`); await p.waitForTimeout(1200);
await p.screenshot({ path: `${S}/spots${process.argv[2] ? "-marked" : ""}.png`, fullPage: true });
await b.close();
console.log("ok");
