// Share card (Nov 6 2026) and the 2.0 analytics events: open You → "Share my world"
// draws the story picture; walking day 1 logs the new events (dev logs them as
// "[analytics:would-track]" instead of sending).
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "fs";
const D = `./aurora-tests/work/r45`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], events = [], out = {};
for (const theme of ["aurora-light", "aurora"]) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => { const s = m.text(); if (s.startsWith("[analytics:would-track]")) events.push(s.replace("[analytics:would-track] ", "")); });
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async (theme) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
    for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId) && e.date !== iso(0));
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    localStorage.setItem("memap_path_start", [...E.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", theme === "aurora" ? "ru" : "en"); localStorage.setItem("memap_theme", theme);
    localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(1) }));
  }, theme);
  await p.reload(); await p.waitForTimeout(2200);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-share-world", { detail: { from: "test" } })));
  await p.waitForTimeout(2600);
  await p.screenshot({ path: `${D}/${theme}-sheet.png` });
  const png = await p.evaluate(() => document.querySelector("[role=dialog] img[src^='data:image/png']")?.getAttribute("src"));
  if (png) writeFileSync(`${D}/${theme}-story.png`, Buffer.from(png.split(",")[1], "base64"));
  out[theme] = !!png;
  // a few events
  await p.keyboard.press("Escape"); await p.waitForTimeout(600);
  await p.locator("nav button").nth(1).click(); await p.waitForTimeout(1800);
  await p.locator(".planet-map-isle").first().click(); await p.waitForTimeout(1200);
  await p.close();
}
console.log(JSON.stringify({ ...out, events: [...new Set(events)].slice(0, 30), errs }, null, 1));
await b.close();
