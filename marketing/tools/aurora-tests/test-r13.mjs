// Her Nov 3 notes on the globe: a day/night switch keeps the page (the globe
// stays the globe, Today keeps its place); the globe follows the finger and
// glides; a tap shows (the island presses in, a ring on the water).
import { chromium } from "playwright-core";
const D = "./aurora-tests/work";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const p = await ctx.newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
const out = {};
await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
await p.evaluate(async () => {
  const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
  for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
  const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
  const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId) && e.date !== iso(0));
  localStorage.clear();
  localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
  localStorage.setItem("memap_path_start", [...E.map((e) => e.date)].sort()[0]);
  localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_avatar", "08_fox");
  localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
});
await p.reload(); await p.waitForTimeout(2400);
const themeBtn = () => p.locator("header").getByRole("button", { name: /^(day|night)$/i }).first();

// Today keeps its place
await p.mouse.move(195, 470);
for (let i = 0; i < 4; i++) { await p.mouse.wheel(0, 150); await p.waitForTimeout(90); }
await p.waitForTimeout(1000);
const before = await p.evaluate(() => document.querySelector("main").scrollTop);
await themeBtn().click(); await p.waitForTimeout(900);
out.today = { before, after: await p.evaluate(() => document.querySelector("main").scrollTop), theme: await p.evaluate(() => document.documentElement.dataset.theme) };
await themeBtn().click(); await p.waitForTimeout(700);

// The globe stays the globe
await p.getByRole("button", { name: /^map$/i }).first().click(); await p.waitForTimeout(1800);
await p.getByRole("tab", { name: /globe/i }).click(); await p.waitForTimeout(1500);
const canvas = await p.locator("canvas").boundingBox();
const shot = (n) => p.screenshot({ path: `${D}/r13-${n}.png` });
await shot("globe-start");
// drag 120 px to the left, slowly, then let go still: no glide
await p.mouse.move(canvas.x + 260, canvas.y + 380); await p.mouse.down();
for (let i = 1; i <= 12; i++) { await p.mouse.move(canvas.x + 260 - i * 10, canvas.y + 380); await p.waitForTimeout(16); }
await p.waitForTimeout(150); await p.mouse.up(); await p.waitForTimeout(500);
await shot("globe-dragged");
// a flick: glides on
await p.mouse.move(canvas.x + 300, canvas.y + 400); await p.mouse.down();
for (let i = 1; i <= 6; i++) { await p.mouse.move(canvas.x + 300 - i * 25, canvas.y + 400); await p.waitForTimeout(12); }
await p.mouse.up(); await p.waitForTimeout(60);
await shot("globe-flick-60ms");
await p.waitForTimeout(900);
await shot("globe-flick-1s");
// back to me, then the theme: still the globe
await p.getByRole("button", { name: /back to me/i }).click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(1200);
await themeBtn().click(); await p.waitForTimeout(1200);
out.globe = { selected: await p.getByRole("tab", { name: /globe/i }).getAttribute("aria-selected"), canvas: await p.locator("canvas").count(), theme: await p.evaluate(() => document.documentElement.dataset.theme) };
await shot("globe-night");
// a tap: a ring on the water, the island presses in
const isl = await p.evaluate(() => {
  // the middle island sits near the ball's front: aim a bit below the screen's middle
  const c = document.querySelector("main canvas").getBoundingClientRect(); const g = window.__globe?.at("me"); return g && g.z > .3 ? { x: c.left + g.x, y: c.top + g.y } : { x: 100, y: 382 };
});
await p.mouse.click(isl.x, isl.y); await p.waitForTimeout(120);
await shot("globe-tap-120ms");
await p.waitForTimeout(1200);
out.tapOpened = await p.evaluate(() => document.querySelector('[role="dialog"] h2')?.innerText || "none");
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
