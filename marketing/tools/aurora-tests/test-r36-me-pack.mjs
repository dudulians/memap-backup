// Her "Me" island pack (5 stages, day/night; Nov 5 2026) shown in the app, with a
// PREVIEW-ONLY patch in globeArt.ts (me_1…me_5 at 0/3/7/14/21 evenings). Demo data;
// the Me island's evenings trimmed to N to show each stage. Pictures for a board.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r36`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
const open = async ({ theme = "aurora-light", view = "map", me = 999, tab = "world" } = {}) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async ({ theme, view, me }) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); const I = await import("/src/lib/islands.ts");
    let T = [], E = [];
    for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId));
    // the Me island: only its last `me` evenings
    const meIds = new Set(T.filter((t) => I.islandOf(t) === "me").map((t) => t.id));
    const keep = new Set(Array.from({ length: me }, (_, i) => iso(i)));
    E = E.filter((e) => !meIds.has(e.trackerId) || keep.has(e.date));
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    localStorage.setItem("memap_path_start", [...E.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_avatar", "11_otter");
    localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", theme);
    localStorage.setItem("memap_map_view", view);
    localStorage.setItem("memap_discover_seen", JSON.stringify({ links: iso(1), calendar: iso(1), chart: iso(1) }));
  }, { theme, view, me });
  await p.reload(); await p.waitForTimeout(1800);
  if (tab === "world") { await p.locator("nav button").nth(1).click(); await p.waitForTimeout(2800); }
  return { ctx, p };
};
const meIsle = (p) => p.locator(".planet-map-isle, .planet-isle").filter({ hasText: /^\s*Me\s*$|Me$/ }).first();
const shot = (p, name) => p.screenshot({ path: `${D}/${name}.png` });

// 1. the whole map, Me fully grown, day and night; the globe; the island card
for (const theme of ["aurora-light", "aurora"]) {
  const { ctx, p } = await open({ theme });
  await shot(p, `map-me5-${theme === "aurora" ? "night" : "day"}`);
  if (theme === "aurora-light") {
    out.isles = await p.evaluate(() => [...document.querySelectorAll(".planet-map-isle")].map((el) => el.textContent.trim()));
    await meIsle(p).click(); await p.waitForTimeout(1500);
    await shot(p, "card-me5-day");
    await p.mouse.wheel(0, 600); await p.waitForTimeout(600);
    await shot(p, "card-me5-day-ladder");
  }
  await ctx.close();
}
{
  const { ctx, p } = await open({ view: "globe" });
  await p.waitForTimeout(1500);
  await shot(p, "globe-me5-day");
  await ctx.close();
}
// 2. the Me island at each stage, cut from the map
for (const [stage, n] of [[1, 1], [2, 4], [3, 8], [4, 15], [5, 30]]) {
  for (const theme of ["aurora-light", "aurora"]) {
    const { ctx, p } = await open({ theme, me: n });
    const isle = meIsle(p);
    const bx = await isle.boundingBox().catch(() => null);
    out[`stage${stage}-${theme}`] = bx ? await isle.evaluate((el) => el.querySelector("img")?.getAttribute("src")?.split("/").pop()) : "NOT FOUND";
    if (bx) {
      const cx = bx.x + bx.width / 2, cy = bx.y + bx.height / 2;
      await p.screenshot({ path: `${D}/stage${stage}-${theme === "aurora" ? "night" : "day"}.png`, clip: { x: Math.max(0, cx - 120), y: Math.max(0, cy - 120), width: 240, height: 240 } });
    }
    if (stage === 2 && theme === "aurora-light") await shot(p, "map-me2-day");
    await ctx.close();
  }
}
console.log(JSON.stringify({ ...out, errs }, null, 1));
await b.close();
