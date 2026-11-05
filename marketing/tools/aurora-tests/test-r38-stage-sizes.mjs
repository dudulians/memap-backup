// Stage sizes (her note, Nov 5 2026: the first stage looked bigger than the second): Me at stage 1, Health 2, Body 3.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r38`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
const open = async ({ theme = "aurora-light", view = "map", me = 999, tab = "world", per = null } = {}) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async ({ theme, view, me, per }) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); const I = await import("/src/lib/islands.ts");
    let T = [], E = [];
    for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId));
    // the Me island: only its last `me` evenings
    const where = new Map(T.map((t) => [t.id, I.islandOf(t)]));
    const lim = per ?? { me };
    E = E.filter((e) => { const n = lim[where.get(e.trackerId)]; if (n === undefined) return true; const d = new Date(); d.setDate(d.getDate() - n); return e.date > iso(n); });
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    localStorage.setItem("memap_path_start", [...E.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_avatar", "11_otter");
    localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", theme);
    localStorage.setItem("memap_map_view", view);
    localStorage.setItem("memap_discover_seen", JSON.stringify({ links: iso(1), calendar: iso(1), chart: iso(1) }));
  }, { theme, view, me, per });
  await p.reload(); await p.waitForTimeout(1800);
  if (tab === "world") { await p.locator("nav button").nth(1).click(); await p.waitForTimeout(2800); }
  return { ctx, p };
};

const per = { me: 1, health: 4, body: 10 };
for (const theme of ["aurora-light", "aurora"]) {
  const { ctx, p } = await open({ theme, per });
  await p.screenshot({ path: `${D}/map-${theme}.png` });
  if (theme === "aurora-light") {
    await p.locator(".planet-map-isle").filter({ hasText: "Me" }).first().click(); await p.waitForTimeout(1500);
    await p.screenshot({ path: `${D}/card-me.png` });
  }
  await ctx.close();
}
{ const { ctx, p } = await open({ view: "globe", per }); await p.waitForTimeout(1500); await p.screenshot({ path: `${D}/globe.png` }); await ctx.close(); }
console.log(JSON.stringify({ errs: errs.filter((e) => !e.includes("InAppReview")) }));
await b.close();
