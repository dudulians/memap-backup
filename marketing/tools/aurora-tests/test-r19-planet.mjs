// The new globe in the app (PlanetGlobe, Nov 4 2026): her planet and sky, her island pack on a ring,
// a sideways drag slides the islands sideways, a tap turns to the island and opens its sheet, night swaps
// the planet, the sky and the islands. Run from marketing/tools with the dev server on :8080.
import { chromium } from "playwright-core";
const D = "./aurora-tests/work";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const errs = [], out = {};
const open = async (theme) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
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
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_avatar", "11_otter");
    localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", theme);
    localStorage.setItem("memap_map_view", "globe");
  }, theme);
  await p.reload(); await p.waitForTimeout(1500);
  await p.locator("nav button").nth(1).click(); await p.waitForTimeout(2200);
  return { ctx, p };
};
const labels = (p) => p.evaluate(() => [...document.querySelectorAll(".planet-label")].filter((l) => +l.style.opacity > 0.5).map((l) => { const r = l.querySelector("span").getBoundingClientRect(); return { n: l.textContent.trim(), x: Math.round(r.x + r.width / 2), y: Math.round(r.y) }; }));

// day: the ring, then a sideways drag
{
  const { ctx, p } = await open("aurora-light");
  await p.screenshot({ path: `${D}/r19-day.png` });
  const a = await labels(p);
  await p.mouse.move(195, 470); await p.mouse.down();
  for (let i = 1; i <= 12; i++) { await p.mouse.move(195 - i * 10, 470); await p.waitForTimeout(20); }
  await p.waitForTimeout(120); await p.mouse.up(); await p.waitForTimeout(400);
  const z = await labels(p);
  out.drag = a.map((r) => { const q = z.find((s) => s.n === r.n); return q ? { n: r.n, dx: q.x - r.x, dy: q.y - r.y } : { n: r.n, gone: true }; });
  // tap the first island: it turns to the middle, its sheet opens
  const first = z[0];
  await p.mouse.click(first.x, first.y - 30); await p.waitForTimeout(1200);
  out.sheet = await p.evaluate(() => !!document.querySelector('[role="dialog"]'));
  await p.screenshot({ path: `${D}/r19-tapped.png` });
  out.sideways = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await ctx.close();
}
// night
{
  const { ctx, p } = await open("aurora");
  await p.screenshot({ path: `${D}/r19-night.png` });
  out.nightIsles = await p.evaluate(() => [...document.querySelectorAll(".planet-isle img")].slice(0, 2).map((i) => i.getAttribute("src")));
  await ctx.close();
}
console.log(JSON.stringify({ errs, ...out }, null, 1));
await b.close();
