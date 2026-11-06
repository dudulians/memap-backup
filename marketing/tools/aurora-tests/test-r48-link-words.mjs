// Links say the real answers (Nov 6 2026, her note: "не была на свежем воздухе → болела
// голова", and the app said "after outside → tired"). Her case built on purpose: on
// days WITHOUT 30 minutes outside, anxiety came the next day. The first link moment,
// then the link card with "On other days". EN and RU.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r48`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
for (const lang of ["ru", "en"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  out[lang] = await p.evaluate(async (lang) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); let T = [];
    for (const id of ["showcase", "body"]) T = T.concat(g.generateDemoData(id).newTrackers);
    const pick = (re) => T.find((t) => re.test(t.title));
    const outside = pick(/30 minutes outside/), anxious = pick(/Felt anxious/), energy = pick(/Had energy/);
    T = [outside, anxious, energy];
    // a fixed pseudo-random, so the run is the same every time
    let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const E = [], walk = [];
    for (let n = 40; n >= 1; n--) walk[n] = rnd() < 0.5;
    for (let n = 40; n >= 1; n--) {
      const d = iso(n);
      E.push({ id: `o${n}`, trackerId: outside.id, date: d, value: walk[n] });
      // the day after no walk: anxious most times; after a walk: seldom
      const prev = walk[n + 1];
      E.push({ id: `a${n}`, trackerId: anxious.id, date: d, value: prev === undefined ? false : rnd() < (prev ? 0.12 : 0.8) });
      E.push({ id: `e${n}`, trackerId: energy.id, date: d, value: rnd() < 0.5 });
    }
    for (const t of T) E.push({ id: `t-${t.id}`, trackerId: t.id, date: iso(0), value: false });
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    localStorage.setItem("memap_path_start", iso(40));
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_avatar", "11_otter");
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
    for (const k of ["memap_hunch_day", "memap_act_seen"]) localStorage.setItem(k, iso(0));
    localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(1) }));
    localStorage.setItem("memap_links_known", "0");
    const isl = await import("/src/lib/islands.ts");
    const r = isl.buildRoutes(T, E, isl.buildIslands(T, E));
    return r.map((x) => ({ a: x.a, b: x.b, firstYes: x.firstYes, secondYes: x.secondYes, k: x.k, n: x.n, other: x.other }));
  }, lang);
  await p.reload(); await p.waitForTimeout(2500);
  await p.locator("nav button").nth(1).click(); await p.waitForTimeout(4200);
  await p.screenshot({ path: `${D}/${lang}-1-moment.png` });
  out[`${lang} card`] = await p.evaluate(() => document.querySelector("[role=dialog] .tour-card")?.innerText.replace(/\s+/g, " "));
  await p.locator("[role=dialog] .tour-card button").last().click(); await p.waitForTimeout(1200);
  await p.screenshot({ path: `${D}/${lang}-2-card.png` });
  out[`${lang} sheet`] = await p.evaluate(() => [...document.querySelectorAll("[role=dialog] p")].map((x) => x.innerText).join(" | ").slice(0, 600));
  await ctx.close();
}
console.log(JSON.stringify({ ...out, errs: errs.filter((e) => !e.includes("InAppReview")) }, null, 1));
await b.close();
