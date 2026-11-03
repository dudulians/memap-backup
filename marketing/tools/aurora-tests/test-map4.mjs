// Map: weather words under island names, Calendar opens straight with no tabs, Week summary, the one Map|Globe switch.
import { chromium } from "playwright-core";
const D = "./aurora-tests/work";
const LNG = process.env.LNG || "en";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true })).newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:8080/"); await p.waitForTimeout(900);
await p.evaluate(async (LNG) => {
  const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
  for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
  const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
  const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId));
  localStorage.clear();
  localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
  localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true");
  localStorage.setItem("memap_language", LNG); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
}, LNG);
await p.reload(); await p.waitForTimeout(1600);
await p.getByRole("button", { name: /^(map|карта)$/i }).first().click(); await p.waitForTimeout(2600);
await p.screenshot({ path: `${D}/map4-${LNG}.png` });
const out = { labels: await p.evaluate(() => [...document.querySelectorAll("main button[aria-label]")].map((e) => e.getAttribute("aria-label")).slice(0, 4).join(" | ")) };
await p.getByRole("button", { name: /^(calendar|календарь)/i }).click(); await p.waitForTimeout(1300);
out.calendarSheet = await p.evaluate(() => ({ title: document.querySelector('[role="dialog"] h2')?.innerText, tabs: document.querySelectorAll('[role="dialog"] [role="tab"]').length }));
await p.screenshot({ path: `${D}/map4-calendar-${LNG}.png` });
await p.keyboard.press("Escape"); await p.waitForTimeout(800);
await p.locator("header").getByRole("button", { name: /^(you|ты)$/i }).click(); await p.waitForTimeout(1300);
out.summary = await p.evaluate(() => (document.querySelector('[role="dialog"]')?.innerText || "").split("\n").filter(Boolean).slice(0, 12).join(" | "));
await p.keyboard.press("Escape"); await p.waitForTimeout(800);
await p.getByRole("tab", { name: /^(globe|глобус)$/i }).click(); await p.waitForTimeout(2000);
await p.screenshot({ path: `${D}/map4-globe-${LNG}.png` });
out.globeCanvas = await p.evaluate(() => !!document.querySelector("main canvas"));
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
