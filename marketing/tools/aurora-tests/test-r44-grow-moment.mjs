// An island growing in front of her (Nov 6 2026): Me reaches stage 3 with today's
// answers; opening World plays it (old picture fades, the new swells, burst, card);
// "See the island" opens its card; seen once. Day and night.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r44`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
for (const theme of ["aurora-light", "aurora"]) {
  const tag = theme === "aurora" ? "night" : "day";
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async (theme) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"), I = await import("/src/lib/islands.ts");
    let T = [], E = [];
    for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId));
    // Me: answered on the last 7 evenings, today included -> stage 3 today
    const me = new Set(T.filter((t) => I.islandOf(t) === "me").map((t) => t.id));
    const keep = new Set([0, 1, 2, 3, 4, 5, 6].map(iso));
    E = E.filter((e) => !me.has(e.trackerId) || keep.has(e.date));
    for (const t of T) if (me.has(t.id) && !E.some((e) => e.trackerId === t.id && e.date === iso(0))) E.push({ id: "t" + t.id, trackerId: t.id, date: iso(0), value: false });
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", theme === "aurora" ? "ru" : "en"); localStorage.setItem("memap_theme", theme);
    localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(1) }));
  }, theme);
  await p.reload(); await p.waitForTimeout(2200);
  out[`${tag} grew`] = await p.evaluate(async () => { const G = await import("/src/lib/globeArt.ts"); return JSON.stringify(G.grewToday(JSON.parse(localStorage.getItem("memap_trackers")), JSON.parse(localStorage.getItem("memap_entries")))); });
  await p.locator("nav button").nth(1).click();
  for (const [ms, name] of [[1300, "1-old"], [1900, "2-grow"], [3200, "3-card"]]) { await p.waitForTimeout(ms === 1300 ? 1300 : ms - (name === "2-grow" ? 1300 : 1900)); await p.screenshot({ path: `${D}/${tag}-${name}.png` }); }
  out[`${tag} card`] = await p.evaluate(() => document.querySelector("[role=dialog] .tour-card")?.innerText.replace(/\s+/g, " "));
  await p.locator("[role=dialog] .tour-card button").last().click(); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${D}/${tag}-4-island.png` });
  out[`${tag} after`] = await p.evaluate(() => ({ seen: localStorage.getItem("memap_grow_seen"), sheet: !!document.querySelector("[role=dialog]") }));
  await p.close();
}
console.log(JSON.stringify({ ...out, errs }, null, 1));
await b.close();
