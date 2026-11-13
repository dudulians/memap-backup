// The flat map after her notes 6 and 8 (Nov 3 2026): a found link is a
// bridge only (no route, no lines), the bridge opens what the link is, a
// one-time tip says what a bridge means, every island in its shallows with a
// soft shadow, the boat on free water beside her last island.
import { chromium } from "playwright-core";
const D = "./aurora-tests/work";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const out = {};
const errs = [];
const open = async (theme, seenBefore) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async ({ theme, seenBefore }) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
    for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId) && e.date !== iso(0));
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    localStorage.setItem("memap_path_start", [...E.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true");
    localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", theme);
    localStorage.setItem("memap_map_view", "map");
    if (seenBefore) localStorage.setItem("memap_bridges_seen", "[]");
  }, { theme, seenBefore });
  await p.reload(); await p.waitForTimeout(1800);
  await p.getByRole("button", { name: /^map$/i }).first().click(); await p.waitForTimeout(2200);
  return { ctx, p };
};

{
  const { ctx, p } = await open("aurora-light", true);
  out.day = await p.evaluate(() => ({
    routes: document.querySelectorAll("main svg path[stroke-dasharray]").length,
    bridges: document.querySelectorAll('main img[src*="wooden_bridge"]').length,
    building: document.querySelectorAll("main .bridge-build").length,
    shores: document.querySelectorAll("main .map-shore").length,
    islands: document.querySelectorAll("main button.island-press").length,
    tip: document.querySelector("main p.surface")?.innerText ?? "none",
  }));
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${D}/r16-map-day.png` });
  // the bridge opens what the link is
  const btn = p.locator("main [data-map-link]").first();
  if (await btn.count()) {
    await btn.click(); await p.waitForTimeout(500);
    out.bubble = await p.evaluate(() => document.querySelector('main [role="dialog"]')?.innerText.split("\n").filter(Boolean).join(" | ") ?? "none");
    out.tipAfterTap = await p.evaluate(() => [...document.querySelectorAll("main p.surface")].map((x) => x.innerText).join(" | ") || "gone");
    await p.screenshot({ path: `${D}/r16-bridge-bubble.png` });
  }
  // the boat: on free water, not over an island
  out.boat = await p.evaluate(() => {
    const boat = document.querySelector('main button[aria-label="You"]')?.getBoundingClientRect();
    if (!boat) return "none";
    const over = [...document.querySelectorAll("main button.island-press .island-art")].some((a) => { const r = a.getBoundingClientRect(); return boat.left < r.right - 20 && boat.right > r.left + 20 && boat.top < r.bottom - 20 && boat.bottom > r.top + 20; });
    return over ? "over an island" : "on free water";
  });
  await ctx.close();
}
{
  const { ctx, p } = await open("aurora", false);
  out.nightTip = await p.evaluate(() => document.querySelector("main p.surface")?.innerText ?? "none");
  out.nightBuilding = await p.evaluate(() => document.querySelectorAll("main .bridge-build").length);
  await p.screenshot({ path: `${D}/r16-map-night.png` });
  await ctx.close();
}
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
