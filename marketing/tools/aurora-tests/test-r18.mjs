// Globe review fixes (Nov 3 2026): a tap on the sea never re-opens the last
// island; released past the tilt limit with a sideways flick, the ball eases
// back (not in one frame); the loop rests while a sheet covers it.
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const p = await ctx.newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
const out = {};
await p.goto("http://localhost:8080/"); await p.waitForTimeout(600);
await p.evaluate(async () => {
  const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
  for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
  const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
  const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId) && e.date !== iso(0));
  localStorage.clear();
  localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
  localStorage.setItem("memap_path_start", [...E.map((e) => e.date)].sort()[0]);
  localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true");
  localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
  localStorage.setItem("memap_map_view", "globe");
});
await p.reload(); await p.waitForTimeout(1600);
await p.getByRole("button", { name: /^map$/i }).first().click(); await p.waitForTimeout(2000);
const c = await p.locator("main canvas").boundingBox();
const at = (id) => p.evaluate((id) => { const g = window.__globe?.at(id); const r = document.querySelector("main canvas").getBoundingClientRect(); return g && { x: r.left + g.x, y: r.top + g.y, z: g.z }; }, id);
// 1. tap an island: its sheet; close; tap the sea: nothing opens
const me = await at("me");
out.meVisible = !!me && me.z > .3;
if (out.meVisible) {
  await p.mouse.click(me.x, me.y - 10); await p.waitForTimeout(1300);
  out.opened = await p.evaluate(() => document.querySelector('[role="dialog"] h2')?.innerText ?? "none");
  await p.keyboard.press("Escape"); await p.waitForTimeout(900);
  await p.mouse.click(c.x + c.width - 30, c.y + c.height - 160); await p.waitForTimeout(1300);
  out.afterSeaTap = await p.evaluate(() => document.querySelector('[role="dialog"] h2')?.innerText ?? "none");
}
// 2. drag far down with a sideways flick at the end, let go: it eases back
await p.mouse.move(c.x + 200, c.y + 150); await p.mouse.down();
for (let i = 1; i <= 16; i++) { await p.mouse.move(c.x + 200 + (i > 12 ? (i - 12) * 30 : 0), c.y + 150 + i * 35); await p.waitForTimeout(16); }
await p.mouse.up();
const series = [];
for (let i = 0; i < 6; i++) { series.push(await p.evaluate(() => window.__globe.state().pitch)); await p.waitForTimeout(60); }
out.pitchAfterRelease = series.map((x) => x.toFixed(3)).join(" ");
out.easesBack = series[0] !== series[1] && Math.abs(series[5] - series[0]) > 0.001;
// 3. under a sheet the loop rests (no frames for a second)
await p.locator("header").getByRole("button", { name: /^you$/i }).click(); await p.waitForTimeout(1200);
out.framesUnderSheet = await p.evaluate(() => new Promise((done) => {
  const cv = document.querySelector("main canvas"), ctx2 = cv.getContext("2d"); let draws = 0;
  const orig = ctx2.clearRect.bind(ctx2); ctx2.clearRect = (...a) => { draws++; return orig(...a); };
  setTimeout(() => { ctx2.clearRect = orig; done(draws); }, 1500);
}));
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
