// The globe after the plan (her notes 1, 3, 6, 8): north-up turntable that
// follows the finger, every touch answers, the look without white dashes,
// walkways for links; the treasures shelf with "New".
import { chromium } from "playwright-core";
const D = "./aurora-tests/work";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const out = {};
const errs = [];
const open = async (theme) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 160)); });
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
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true");
    localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", theme);
    localStorage.setItem("memap_map_view", "globe");
  }, theme);
  await p.reload(); await p.waitForTimeout(1800);
  await p.getByRole("button", { name: /^map$/i }).first().click(); await p.waitForTimeout(2200);
  return { ctx, p };
};
const canvasBox = (p) => p.locator("main canvas").boundingBox();

{
  const { ctx, p } = await open("aurora-light");
  out.view = await p.getByRole("tab", { name: /globe/i }).getAttribute("aria-selected");
  await p.screenshot({ path: `${D}/r15-globe-day.png` });
  const c = await canvasBox(p);
  // a 150 px drag sideways, held still before letting go: no glide
  await p.mouse.move(c.x + 280, c.y + 330); await p.mouse.down();
  for (let i = 1; i <= 15; i++) { await p.mouse.move(c.x + 280 - i * 10, c.y + 330); await p.waitForTimeout(16); }
  await p.waitForTimeout(160); await p.mouse.up(); await p.waitForTimeout(400);
  await p.screenshot({ path: `${D}/r15-globe-dragged.png` });
  // drag far down: the tilt stops at its limit and eases back
  await p.mouse.move(c.x + 200, c.y + 200); await p.mouse.down();
  for (let i = 1; i <= 20; i++) { await p.mouse.move(c.x + 200, c.y + 200 + i * 30); await p.waitForTimeout(16); }
  await p.waitForTimeout(120); await p.mouse.up(); await p.waitForTimeout(500);
  await p.screenshot({ path: `${D}/r15-globe-limit.png` });
  await p.getByRole("button", { name: /back to me/i }).click({ timeout: 2500 }).catch(() => {}); await p.waitForTimeout(900);
  await p.screenshot({ path: `${D}/r15-globe-home.png` });
  // the sea: a ring at the finger
  await p.mouse.click(c.x + 330, c.y + 560); await p.waitForTimeout(160);
  await p.screenshot({ path: `${D}/r15-sea-ring.png` });
  await p.waitForTimeout(900);
  await ctx.close();
}
{
  const { ctx, p } = await open("aurora");
  await p.screenshot({ path: `${D}/r15-globe-night.png` });
  await ctx.close();
}
// the shelf: a treasure earned since the last look says "New"
{
  const { ctx, p } = await open("aurora-light");
  await p.evaluate(() => { localStorage.setItem("memap_treasures_seen", JSON.stringify(["balloon"])); });
  await p.locator("header").getByRole("button", { name: /^you$/i }).click(); await p.waitForTimeout(1400);
  out.newChips = await p.evaluate(() => [...document.querySelectorAll(".treasure-new")].map((x) => x.innerText.split("\n").filter(Boolean).join(" ")).join(" | "));
  out.kept = await p.evaluate(() => localStorage.getItem("memap_treasures"));
  await p.evaluate(() => { const d = document.querySelector('[role="dialog"] .overflow-y-auto'); if (d) d.scrollTop = 420; }); await p.waitForTimeout(500);
  await p.screenshot({ path: `${D}/r15-shelf.png` });
  await p.keyboard.press("Escape"); await p.waitForTimeout(700);
  await p.locator("header").getByRole("button", { name: /^you$/i }).click(); await p.waitForTimeout(1400);
  out.newChipsAgain = await p.evaluate(() => document.querySelectorAll(".treasure-new").length);
  await ctx.close();
}
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
