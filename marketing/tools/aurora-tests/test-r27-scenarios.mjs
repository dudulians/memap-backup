// Three journeys from WORLD-BIBLE "Решения 5 ноября" #10 (Nov 5 2026):
//   A. a hard week: almost every answer is a hard one, for the last 7 days;
//   B. she skipped 4 days, then comes back;
//   C. day <-> night on every screen.
// Walks each as she would, takes a picture of every screen, lists errors.
// Usage: node aurora-tests/test-r27-scenarios.mjs [A|B|C|all]
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const which = process.argv[2] || "all";
const D = `./aurora-tests/work/r27`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const errs = [], out = {};
const open = async (setup, theme = "aurora-light") => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(`${setup}: ${e.message}`)); p.on("console", (m) => m.type() === "error" && errs.push(`${setup}: ${m.text()}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async ({ theme, setup }) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
    for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId) && e.date !== iso(0) && e.date >= iso(24));
    if (setup === "hard") {
      // the last 7 days: every answer a hard one (yes to a hard question, no to a good one)
      const byId = new Map(T.map((t) => [t.id, t]));
      E = E.map((e) => (e.date >= iso(7) && typeof e.value === "boolean" ? { ...e, value: byId.get(e.trackerId).problemWhen === "yes" } : e));
    }
    if (setup === "skip") E = E.filter((e) => e.date < iso(4)); // nothing for the last 4 days
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    localStorage.setItem("memap_path_start", [...E.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_avatar", "11_otter");
    localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", theme);
    localStorage.setItem("memap_map_view", "map");
  }, { theme, setup });
  await p.reload(); await p.waitForTimeout(2000);
  return { ctx, p };
};
const shot = (p, name) => p.screenshot({ path: `${D}/${name}.png` });
const esc = async (p) => { await p.keyboard.press("Escape"); await p.waitForTimeout(700); };
const tab = async (p, i) => { await p.locator("nav button").nth(i).click(); await p.waitForTimeout(1800); };
const text = (p) => p.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 600));

if (which === "A" || which === "all") {
  const { ctx, p } = await open("hard");
  await shot(p, "A1-today"); out.A_today = await text(p);
  await p.mouse.wheel(0, 900); await p.waitForTimeout(600); await shot(p, "A2-today-down");
  await tab(p, 1); await shot(p, "A3-world");
  await p.locator(".planet-map-isle").first().click(); await p.waitForTimeout(1400); await shot(p, "A4-island");
  await p.mouse.wheel(0, 500); await p.waitForTimeout(500); await shot(p, "A5-island-why");
  await esc(p);
  await p.getByRole("button", { name: /Action points/ }).first().click(); await p.waitForTimeout(1200); await shot(p, "A6-actions");
  await esc(p);
  await p.getByRole("button", { name: /Calendar/ }).first().click(); await p.waitForTimeout(1200); await shot(p, "A7-calendar");
  await esc(p);
  await p.getByRole("button", { name: /Chart/ }).first().click(); await p.waitForTimeout(1500); await shot(p, "A8-chart");
  await ctx.close();
}
if (which === "B" || which === "all") {
  const { ctx, p } = await open("skip");
  await shot(p, "B1-today-back"); out.B_today = await text(p);
  out.B_missedButton = await p.locator(".missed-day").count();
  out.B_streak = await p.evaluate(() => document.querySelector("[aria-label*='streak' i], [aria-label*='row' i]")?.getAttribute("aria-label") ?? "no streak chip");
  if (out.B_missedButton) { await p.locator(".missed-day").first().click(); await p.waitForTimeout(1400); await shot(p, "B2-missed-open"); out.B_missedOpen = await text(p); await esc(p); }
  // the current step: does it start tonight's questions?
  await p.locator(".path-node.disc-current").first().click().catch(() => {}); await p.waitForTimeout(900); await shot(p, "B3-step-card");
  await esc(p);
  await tab(p, 1); await shot(p, "B4-world");
  await p.getByRole("button", { name: /Action points/ }).first().click(); await p.waitForTimeout(1200); await shot(p, "B5-actions");
  await esc(p);
  await p.getByRole("button", { name: /Calendar/ }).first().click(); await p.waitForTimeout(1200); await shot(p, "B6-calendar");
  await ctx.close();
}
if (which === "C" || which === "all") {
  const { ctx, p } = await open("full");
  const flip = async (name) => {
    await p.getByRole("button", { name: /^(Night|Day)$/ }).first().click(); await p.waitForTimeout(1600);
    await shot(p, name);
  };
  await flip("C1-today-night");
  await tab(p, 1); await shot(p, "C2-world-night");
  await flip("C3-world-day");
  await p.getByRole("tab", { name: "Globe" }).click(); await p.waitForTimeout(2200); await shot(p, "C4-globe-day");
  await flip("C5-globe-night");
  await flip("C6-globe-day-again");
  await p.getByRole("tab", { name: "Map" }).click(); await p.waitForTimeout(1500);
  // (a sheet covers the header switch, so: switch, then open an island)
  await flip("C7a-map-night");
  await p.locator(".planet-map-isle").first().click(); await p.waitForTimeout(1300);
  await shot(p, "C7-island-sheet-night");
  await esc(p);
  await tab(p, 2); await shot(p, "C8-notes-night");
  await flip("C9-notes-day");
  await tab(p, 0); await shot(p, "C10-today-day");
  out.C_globeAlive = await p.evaluate(() => !!document.querySelector("nav"));
  await ctx.close();
}
console.log(JSON.stringify({ ...out, errs: errs.filter((e) => !/InAppReview/.test(e)) }, null, 1));
await b.close();
