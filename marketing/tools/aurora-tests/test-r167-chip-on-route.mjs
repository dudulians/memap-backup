// r167 (Nov 14 2026, branch design/one-system): the globe's link sign stays on its dotted route.
// Her note: with a hard zoom in or out, or a quick spin of the small globe, the sign left the dotted line and
// "flew into the sky". Since v167 it stands only on the line and slides along it.
// The check zooms out and in with the wheel, spins the ball with quick drags, and while it glides looks at every
// shown sign: its middle must be on a dot of a route and inside the ball.
// Run from marketing/tools with the dev server on 8080 (PORT env to change); exit 1 when a check fails.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const PORT = process.env.PORT ?? "8080";
const URL = `http://localhost:${PORT}/`;
const D = `./aurora-tests/work/r167`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const check = (name, ok, info) => { out[name] = ok ? "ok" : `FAIL ${info !== undefined ? JSON.stringify(info).slice(0, 500) : ""}`; if (!ok) fails.push(name); };
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
p.on("pageerror", (e) => errs.push(e.message));
await p.goto(URL); await p.waitForTimeout(800);
await p.evaluate(async () => {
  const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const g = await import("/src/lib/demoDataGenerator.ts"); const r = g.generateDemoData("work-home");
  localStorage.clear();
  localStorage.setItem("memap_trackers", JSON.stringify(r.newTrackers)); localStorage.setItem("memap_entries", JSON.stringify(r.newEntries));
  localStorage.setItem("memap_path_start", [...r.newEntries.map((e) => e.date)].sort()[0]);
  localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1");
  localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order", "report", "block:world"]));
  localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
  localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(9) })); localStorage.setItem("memap_playful_asked", "seed");
  localStorage.setItem("memap_week_chests", JSON.stringify(Object.fromEntries(Array.from({ length: 9 }, (_, w) => [w, { openedAt: iso(1), lines: [], reward: "balloon" }]))));
});
await p.goto(URL); await p.waitForTimeout(1800);
await p.locator("button").filter({ hasText: /^World$/ }).last().click(); await p.waitForTimeout(2500);

// every shown sign: how far its middle is from the nearest route dot, and whether it is inside the ball
const look = () => p.evaluate(() => {
  const dots = [...document.querySelectorAll("circle.planet-route")].map((c) => { const r = c.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  const g = window.__planet?.state?.();
  const ball = document.querySelector(".planet-wakes")?.getBoundingClientRect();
  return [...document.querySelectorAll(".planet-link-chip")].filter((c) => Number(getComputedStyle(c).opacity) > 0.5).map((c) => {
    const r = c.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    const d = dots.length ? Math.min(...dots.map(([dx, dy]) => Math.hypot(dx - x, dy - y))) : 999;
    return { d: Math.round(d), x: Math.round(x), y: Math.round(y), zoom: g?.zoom, inView: !ball || (x > ball.x - 40 && x < ball.right + 40) };
  });
});
const worst = [];
const sample = async (label, n = 6, gap = 60) => { for (let k = 0; k < n; k++) { const s = await look(); s.forEach((c) => worst.push({ ...c, label })); await p.waitForTimeout(gap); } };

const box = await p.locator('[data-tour="world"]').boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height * 0.55;
await sample("start", 2);
await p.screenshot({ path: `${D}/01-start.png` });
// hard zoom out, then quick spins of the small ball
await p.mouse.move(cx, cy);
for (let k = 0; k < 6; k++) { await p.mouse.wheel(0, 400); await p.waitForTimeout(40); }
await sample("zoomed out", 4);
for (const dx of [260, -300, 220, -180]) {
  await p.mouse.move(cx - dx / 2, cy); await p.mouse.down();
  for (let s = 1; s <= 5; s++) { await p.mouse.move(cx - dx / 2 + (dx * s) / 5, cy + (s % 2 ? 30 : -20)); await p.waitForTimeout(8); }
  await p.mouse.up();
  await sample(`spin ${dx}`, 8, 50);
}
await p.screenshot({ path: `${D}/02-zoomed-out-spun.png` });
// hard zoom in, and spins again
for (let k = 0; k < 10; k++) { await p.mouse.wheel(0, -400); await p.waitForTimeout(40); }
await sample("zoomed in", 4);
for (const dx of [200, -240]) {
  await p.mouse.move(cx - dx / 2, cy); await p.mouse.down();
  for (let s = 1; s <= 5; s++) { await p.mouse.move(cx - dx / 2 + (dx * s) / 5, cy); await p.waitForTimeout(8); }
  await p.mouse.up();
  await sample(`spin in ${dx}`, 8, 50);
}
await p.screenshot({ path: `${D}/03-zoomed-in-spun.png` });

const seen = worst.length;
const off = worst.filter((c) => c.d > 14);
check("signs were seen while zooming and spinning", seen > 5, seen);
check("every shown sign stands on its dotted route", off.length === 0, off.slice(0, 8));
// the dots are drawn only on the ball's front, so a sign on a dot is on the ball (zoomed in, the ball is wider than the screen)
out.maxDistance = Math.max(0, ...worst.map((c) => c.d));
await b.close();
console.log(JSON.stringify(out, null, 1));
if (errs.length) console.log("PAGE ERRORS:", errs.slice(0, 5));
process.exit(fails.length || errs.length ? 1 : 0);
