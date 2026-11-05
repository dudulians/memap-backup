// Treasures on the map (Nov 5 2026, WORLD-BIBLE "Решения 5 ноября" #8): each
// earned treasure stands on its island on the Map and the Globe; the next one
// to come stands there pale; the island card says what and how.
// Usage: node aurora-tests/test-r26-treasures.mjs [theme]
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const theme = process.argv[2] || "aurora-light";
const D = `./aurora-tests/work/r26`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const errs = [], out = {};
const open = async (setup, view = "map") => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
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
      localStorage.setItem("memap_experiments", JSON.stringify([{ id: "x1-test", island: "health", trackerId: "x1-test", change: "Walk 20 minutes", start: iso(14), reviewed: iso(6), kept: false }]));
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
const placed = (p) => p.evaluate(() => [...document.querySelectorAll(".planet-isle")].map((el) => {
  const name = el.querySelector(".planet-label")?.textContent?.trim() || el.getAttribute("aria-label") || "";
  const ts = [...el.querySelectorAll(".treasure")].map((t) => t.className.replace("treasure ", ""));
  return ts.length ? `${name}: ${ts.join(", ")}` : null;
}).filter(Boolean));
const tag = (s) => `${D}/${theme}-${s}.png`;
{
  const { ctx, p } = await open("full");
  out.map = await placed(p);
  out.hosts = await p.evaluate(() => localStorage.getItem("memap_treasure_islands"));
  await p.screenshot({ path: tag("1-map") });
  // the card of an island that has treasures
  const isle = p.locator(".planet-map-isle").filter({ has: p.locator(".treasure:not(.is-ghost)") }).first();
  await isle.click(); await p.waitForTimeout(1400);
  await p.getByText("Treasures here").scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
  await p.screenshot({ path: tag("2-island-card") });
  // "All treasures" opens her shelf
  await p.getByRole("button", { name: "All treasures" }).click(); await p.waitForTimeout(1500);
  await p.getByText("Your treasures").scrollIntoViewIfNeeded().catch(() => {}); await p.waitForTimeout(400);
  await p.screenshot({ path: tag("3-shelf") });
  await ctx.close();
}
{
  const { ctx, p } = await open("full", "globe");
  await p.waitForTimeout(1500);
  out.globe = await p.evaluate(() => [...document.querySelectorAll(".planet-isle")].filter((el) => +el.style.opacity > 0.3).flatMap((el) => [...el.querySelectorAll(".treasure")].map((t) => t.className.replace("treasure ", ""))));
  await p.screenshot({ path: tag("4-globe") });
  await ctx.close();
}
{
  const { ctx, p } = await open("new");
  out.newMap = await placed(p);
  await p.screenshot({ path: tag("5-new-map") });
  const isle = p.locator(".planet-map-isle").filter({ has: p.locator(".treasure") }).first();
  if (await isle.count()) { await isle.click(); await p.waitForTimeout(1400); await p.getByText("Treasures here").scrollIntoViewIfNeeded(); await p.waitForTimeout(400); await p.screenshot({ path: tag("6-new-card") }); }
  await ctx.close();
}
{
  const { ctx, p } = await open("ru");
  const isle = p.locator(".planet-map-isle").filter({ has: p.locator(".treasure:not(.is-ghost)") }).first();
  await isle.click(); await p.waitForTimeout(1400);
  await p.getByText("Сокровища здесь").scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
  await p.screenshot({ path: tag("7-ru-card") });
  await ctx.close();
}
console.log(JSON.stringify({ ...out, errs: errs.filter((e) => !/InAppReview/.test(e)) }, null, 1));
await b.close();
