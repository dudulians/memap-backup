// Builds globe.html from src.html: inlines lucide icons and copies her art next to it.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = "C:/Users/ulian/OneDrive/Desktop/MeMap/memap-self-aware-main";
const svg = (name, size = 24, color = "currentColor") => {
  const src = readFileSync(`${REPO}/node_modules/lucide-react/dist/esm/icons/${name}.js`, "utf8");
  const nodes = Function(`return ${src.match(/createLucideIcon\("[^"]+", (\[[\s\S]*\])\);/)[1]}`)();
  const kids = nodes.map(([t, a]) => `<${t} ${Object.entries(a).filter(([k]) => k !== "key").map(([k, v]) => `${k}="${v}"`).join(" ")}/>`).join("");
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${kids}</svg>`;
};
let html = readFileSync(path.join(HERE, "src.html"), "utf8");
html = html.replace(/\{\{i:([a-z0-9-]+)(?::(\d+))?(?::(#[0-9A-Fa-f]+))?\}\}/g, (_, n, s, c) => svg(n, s ? +s : 24, c || "currentColor").replace(c ? 'fill="none"' : "@@", c ? `fill="${c}"` : "@@"));
const icons = Object.fromEntries(["sprout", "heart", "heart-pulse", "cloud-sun", "sun", "paw-print", "chevron-right"].map((n) => [n, svg(n)]));
html = html.replace("{{ICONS}}", JSON.stringify(icons));
writeFileSync(path.join(HERE, "globe.html"), html);
const pics = ["island_lotus", "island_mountain", "island_waterfall", "island_rocky", "island_plain", "cherry_blossom_tree", "green_tree", "pine_tree", "palm_trees", "orange_tree", "lighthouse", "sailboat", "cloud_large"];
for (const [dir, from] of [["a", "map"], ["n", "map-night"]]) {
  mkdirSync(path.join(HERE, dir), { recursive: true });
  for (const p of pics) copyFileSync(`${REPO}/src/assets/${from}/${p}.webp`, path.join(HERE, dir, `${p}.webp`));
}
copyFileSync(`${REPO}/src/assets/avatars/11_otter.webp`, path.join(HERE, "a", "otter.webp"));
copyFileSync(`${REPO}/marketing/brand/globe/sky-day-v1.webp`, path.join(HERE, "a", "sky-day.webp"));
copyFileSync(`${REPO}/marketing/brand/globe/sky-night-v1.webp`, path.join(HERE, "a", "sky-night.webp"));
copyFileSync(`${REPO}/marketing/brand/globe/planet-night-v3.webp`, path.join(HERE, "a", "planet-3-night.webp"));
// her island pack v2, trimmed by marketing/tools/prep-map-assets-v2.mjs
const V2 = `${REPO}/marketing/brand/map-assets-v2/trimmed`;
const v2pics = ["isl_20_tropical_palms", "isl_11_sakura", "isl_09_waterfall", "isl_06_snow_peak", "isl_17_lavender_garden", "isl_24_oak_tree", "cloud_island_01", "cloud_island_03", "cloud_island_05", ...[1, 2, 3, 4, 5, 6, 7].map((k) => `cloud_0${k}_large`)];
for (const [dir, sub] of [["a", "day"], ["n", "night"]]) for (const p of v2pics) copyFileSync(`${V2}/${sub}/${p}.webp`, path.join(HERE, dir, `${p}.webp`));
html = html.replace("{{SIZES}}", readFileSync(`${V2}/sizes.json`, "utf8").replace(/\s+/g, ""));
writeFileSync(path.join(HERE, "globe.html"), html);
for (const k of [1, 2, 3]) copyFileSync(`${REPO}/marketing/brand/globe/planet-day-v${k}.webp`, path.join(HERE, "a", `planet-${k}.webp`));
console.log("built", html.length);
