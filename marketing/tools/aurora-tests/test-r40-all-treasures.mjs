// All the treasures (her pack, Nov 5 2026): what an island looks like with almost everything earned.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const theme = process.argv[2] || "aurora-light";
const D = `./aurora-tests/work/r40`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const errs = [], out = {};
const open = async (setup, view = "map") => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async ({ theme, setup, view }) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
    for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId) && e.date !== iso(0));
    if (setup === "new") E = E.filter((e) => e.date >= iso(3));
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    localStorage.setItem("memap_path_start", [...E.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_avatar", "11_otter");
    localStorage.setItem("memap_language", setup === "ru" ? "ru" : "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", theme);
    localStorage.setItem("memap_map_view", view);
    if (setup !== "new") {
      const now = new Date().toISOString();
      // 10 notes (books), a finished test on Health (easel), a checked hunch (stars)
      localStorage.setItem("memap_notes", JSON.stringify(Array.from({ length: 10 }, (_, i) => ({ id: "n" + i, date: iso(i + 1), text: "note " + i, createdAt: now, updatedAt: now }))));
      localStorage.setItem("memap_experiments", JSON.stringify([
        { id: "x1-test", island: "health", trackerId: "x1-test", change: "Walk 20 minutes", start: iso(30), reviewed: iso(22), kept: true },
        { id: "x2-test", island: "me", trackerId: "x2-test", change: "No phone in bed", start: iso(20), reviewed: iso(12), kept: true },
        { id: "x3-test", island: "health", trackerId: "x3-test", change: "Water before coffee", start: iso(12), reviewed: iso(4), kept: false }]));
      localStorage.setItem("memap_week_chests", JSON.stringify({ 0: { openedAt: iso(50), lines: [], reward: "wooden_bridge" } }));
      localStorage.setItem("memap_unload_days", JSON.stringify(Array.from({ length: 8 }, (_, i) => iso(i + 1))));
      const isl = await import("/src/lib/islands.ts");
      const suspect = T.find((t) => isl.islandOf(t) === "me");
      const target = T.find((t) => t.id !== suspect.id);
      localStorage.setItem("memap_hunches", JSON.stringify([{ id: "h1", target: target.id, suspect: suspect.id, made: iso(9), seen: iso(2) }]));
    }
  }, { theme, setup, view });
  await p.reload(); await p.waitForTimeout(1500);
  await p.locator("nav button").nth(1).click(); await p.waitForTimeout(2600);
  return { ctx, p };
};

const all = {};
for (const th of ["aurora-light", "aurora"]) {
  const { ctx, p } = await open("full");
  if (th === "aurora") { await p.evaluate(() => localStorage.setItem("memap_theme", "aurora")); await p.reload(); await p.waitForTimeout(1500); await p.locator("nav button").nth(1).click(); await p.waitForTimeout(2600); }
  await p.screenshot({ path: `${D}/${th}-map.png` });
  all[th] = await p.evaluate(() => [...document.querySelectorAll(".planet-map-isle")].map((el) => (el.textContent.trim() || "?") + ": " + [...el.querySelectorAll(".stand, .treasure")].map((x) => x.className.replace(/stand |treasure /g, "")).join(", ")));
  const isles = p.locator(".planet-map-isle"); const n = await isles.count();
  for (let i = 0; i < n; i++) { const bx = await isles.nth(i).boundingBox(); if (!bx || bx.width < 60) continue; const pad = 40;
    await p.screenshot({ path: `${D}/${th}-isle${i}.png`, clip: { x: bx.x - pad, y: bx.y - pad - 14, width: bx.width + pad * 2, height: bx.height * 0.95 + pad * 2 } }); }
  if (th === "aurora-light") {
    await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-you"))); await p.waitForTimeout(1600);
    await p.getByText(/Your treasures/).first().scrollIntoViewIfNeeded().catch(() => {}); await p.waitForTimeout(500);
    await p.screenshot({ path: `${D}/shelf.png` });
  }
  await ctx.close();
}
{ const { ctx, p } = await open("full", "globe"); await p.waitForTimeout(1500); await p.screenshot({ path: `${D}/globe.png` }); await ctx.close(); }
console.log(JSON.stringify({ all, errs: errs.filter((e) => !e.includes("InAppReview")) }, null, 1));
await b.close();
