// The first link moment (Nov 6 2026): the day her first link is found, Today has
// "Your first link!"; it takes her to her map where the link is drawn island to
// island, the count goes up, the camera lands; "Open it" opens the link's card; the
// step is done after. Also: opening World that day plays it by itself. Day + night.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r41`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
const setup = async (p, theme) => {
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async (theme) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
    for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId) && e.date !== iso(0));
    for (const t of T) if (!t.archived) E.push({ id: `today-${t.id}`, trackerId: t.id, date: iso(0), value: false });
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    localStorage.setItem("memap_path_start", [...E.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_avatar", "11_otter");
    localStorage.setItem("memap_language", theme === "aurora" ? "ru" : "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", theme);
    for (const k of ["memap_hunch_day", "memap_act_seen"]) localStorage.setItem(k, iso(0));
    localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(1) }));
    // the links were 0 until now: her first one has just been found
    localStorage.setItem("memap_links_known", "0");
    const ps = await import("/src/lib/pathSteps.ts");
    for (const s of ps.pathModel(T, E).steps) if (s.kind === "task") ps.markTaskDone(s.task);
  }, theme);
  await p.reload(); await p.waitForTimeout(2500);
};
for (const theme of ["aurora-light", "aurora"]) {
  const tag = theme === "aurora" ? "night" : "day";
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await setup(p, theme);
  out[`${tag} bubble`] = await p.evaluate(() => document.querySelector(".path-start")?.getAttribute("aria-label"));
  await p.screenshot({ path: `${D}/${tag}-0-today.png` });
  await p.locator(".path-start").first().click();
  for (const [ms, name] of [[500, "1-start"], [1900, "2-drawing"], [3600, "3-done"]]) { await p.waitForTimeout(ms === 500 ? 500 : ms - 500); await p.screenshot({ path: `${D}/${tag}-${name}.png` }); }
  out[`${tag} card`] = await p.evaluate(() => document.querySelector("[role=dialog] .tour-card")?.innerText.replace(/\s+/g, " "));
  out[`${tag} drawn`] = await p.evaluate(() => ({ dots: document.querySelectorAll(".tour-link circle").length, chip: !!document.querySelector(".tour-link-chip"), count: document.querySelector(".tour-link-count")?.textContent, camera: !!document.querySelector(".link-moment-new"), mapLinksHidden: document.documentElement.classList.contains("link-moment-on") }));
  await p.locator("[role=dialog] .tour-card button").last().click(); await p.waitForTimeout(1200);
  await p.screenshot({ path: `${D}/${tag}-4-open.png` });
  out[`${tag} link card`] = await p.evaluate(() => (document.body.innerText.match(/(After|On days with|После|В дни)[^\n]{0,90}/) ?? [""])[0]);
  // back on Today the step is done
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(2200);
  out[`${tag} after`] = await p.evaluate(async () => {
    const ps = await import("/src/lib/pathSteps.ts");
    const m = ps.pathModel(JSON.parse(localStorage.getItem("memap_trackers")), JSON.parse(localStorage.getItem("memap_entries")));
    return m.steps.filter((s) => s.kind === "link").map((s) => s.id + (s.done ? " ✓" : "")).join(",") + " | seen=" + localStorage.getItem("memap_first_link_seen");
  });
  await ctx.close();
}
// opening World by itself that day plays it
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await setup(p, "aurora-light");
  await p.locator("nav button").nth(1).click(); await p.waitForTimeout(2600);
  out.worldAuto = await p.evaluate(() => !!document.querySelector("[role=dialog] .tour-card") && document.querySelectorAll(".tour-link circle").length > 0);
  await p.screenshot({ path: `${D}/world-auto.png` });
  // an old hand (links before this came) sees nothing
  await p.evaluate(() => { localStorage.removeItem("memap_links_known"); localStorage.removeItem("memap_first_link_seen"); });
  await p.reload(); await p.waitForTimeout(2200); await p.locator("nav button").nth(1).click(); await p.waitForTimeout(2200);
  out.oldHand = await p.evaluate(() => ({ moment: !!document.querySelector("[role=dialog] .tour-card"), seen: localStorage.getItem("memap_first_link_seen") }));
  await ctx.close();
}
console.log(JSON.stringify({ ...out, errs: errs.filter((e) => !e.includes("InAppReview")) }, null, 1));
await b.close();
