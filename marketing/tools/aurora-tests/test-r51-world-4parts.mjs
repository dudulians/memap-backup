// World v77 (her pick, board 76 A): one header, the 4 parts as a row on top, the main
// island lit, New island as a + tool. Demo world EN day / RU night; each tile opens its
// sheet; a day-1 user's World.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r51`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
const demo = async (p, lang, theme) => {
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  await p.evaluate(async ({ lang, theme }) => {
    const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
    for (const id of ["showcase", "relationship-reality", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId));
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    const head = T.find((t) => /headache/i.test(t.title));
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    if (head) localStorage.setItem("memap_door", JSON.stringify({ id: "migraine", trackerId: head.id, contextTrackerIds: [], startedAt: iso(60) }));
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true");
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_theme", theme);
    localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(1) }));
  }, { lang, theme });
  await p.reload(); await p.waitForTimeout(2200);
  await p.locator("nav button").nth(1).click(); await p.waitForTimeout(2600);
};
for (const [lang, theme, tag] of [["en", "aurora-light", "en-day"], ["ru", "aurora", "ru-night"]]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${tag}: ${e.message}`));
  await demo(p, lang, theme);
  await p.screenshot({ path: `${D}/${tag}-world.png` });
  out[tag] = await p.evaluate(() => ({
    headerBrandHidden: getComputedStyle(document.querySelector("header h1")).visibility,
    tiles: [...document.querySelectorAll("[data-tour='calendar'],[data-tour='links-card'],[data-tour='actions'],[data-tour='helps']")].map((x) => x.innerText.replace(/\s+/g, " ").trim()),
    tileHeights: [...document.querySelectorAll("[data-tour='calendar'],[data-tour='links-card'],[data-tour='actions'],[data-tour='helps']")].map((x) => Math.round(x.getBoundingClientRect().height)),
    mainIsland: document.querySelector(".planet-map-isle.is-main")?.getAttribute("data-isle"),
    newTool: !!document.querySelector(".new-tool"),
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
  }));
  for (const [sel, name] of [["[data-tour='calendar']", "days"], ["[data-tour='links-card']", "links"], ["[data-tour='actions']", "act"], ["[data-tour='helps']", "helps"]]) {
    await p.locator(sel).click(); await p.waitForTimeout(1300);
    await p.screenshot({ path: `${D}/${tag}-${name}.png` });
    out[`${tag} ${name}`] = await p.evaluate(() => { const d = [...document.querySelectorAll("[role=dialog]")].pop(); return d ? d.innerText.replace(/\s+/g, " ").slice(0, 140) : "no sheet"; });
    if (name === "days") {
      const chart = p.getByRole("tab", { name: lang === "ru" ? "График" : "Chart" });
      if (await chart.isVisible().catch(() => false)) { await chart.click(); await p.waitForTimeout(900); await p.screenshot({ path: `${D}/${tag}-days-chart.png` }); out[`${tag} chart tab`] = true; }
    }
    await p.keyboard.press("Escape"); await p.waitForTimeout(800);
  }
  await ctx.close();
}
// a day-1 user
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`day1: ${e.message}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  await p.evaluate(async () => {
    localStorage.clear();
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_theme", "aurora-light");
    const doors = await import("/src/lib/doors.ts");
    const door = doors.DOORS.find((d) => d.id === "migraine");
    const ensured = await doors.ensureDoorTrackers(door);
    doors.saveDoorState({ id: "migraine", trackerId: ensured.trackerId, contextTrackerIds: ensured.contextTrackerIds, startedAt: doors.isoLocal(new Date()), extra: [] });
    await doors.logDoorEntry({ trackerId: ensured.trackerId, date: doors.isoLocal(new Date()), tags: [], value: true, context: Object.fromEntries(ensured.contextTrackerIds.map((id) => [id, false])) });
    localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: doors.isoLocal(new Date()) }));
  });
  await p.reload(); await p.waitForTimeout(2200);
  await p.locator("nav button").nth(1).click(); await p.waitForTimeout(2600);
  await p.screenshot({ path: `${D}/day1-world.png` });
  out.day1 = await p.evaluate(() => [...document.querySelectorAll("[data-tour='calendar'],[data-tour='links-card'],[data-tour='actions'],[data-tour='helps']")].map((x) => x.innerText.replace(/\s+/g, " ").trim()));
  await p.locator("[data-tour='helps']").click(); await p.waitForTimeout(1300);
  await p.screenshot({ path: `${D}/day1-helps.png` });
  out["day1 helps"] = await p.evaluate(() => { const d = [...document.querySelectorAll("[role=dialog]")].pop(); return d ? d.innerText.replace(/\s+/g, " ").slice(0, 120) : "no sheet"; });
  await ctx.close();
}
console.log(JSON.stringify({ ...out, errs: errs.filter((e) => !e.includes("InAppReview")) }, null, 1));
await b.close();
