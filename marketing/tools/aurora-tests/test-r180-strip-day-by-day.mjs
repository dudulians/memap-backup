// Her phone note (Nov 15 2026 evening): «когда листаю шаги, у меня с воскресенья перелистывается сразу на среду,
// пропуская понедельник, вторник». Scrolling Today down step by step, the strip goes day by day: no day skipped.
// Run from marketing/tools.
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const out = {}, fails = [], errs = [];
for (const [lang, h] of [["en", 844], ["ru", 667]]) {
  const p = await (await b.newContext({ viewport: { width: 390, height: h }, deviceScaleFactor: 2, hasTouch: true })).newPage();
  p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  await p.evaluate(async (lang) => {
    localStorage.clear();
    for (const [k, v] of Object.entries({ memap_ui: "new", memap_tour_seen: "true", memap_tour_completed: "1", memap_tour_world: "1", memap_tour_today: "1", memap_cohort: "new", memap_language: lang, memap_language_chosen: "true", memap_theme: "aurora-light", memap_ab_onb: "A", memap_tips_seen: JSON.stringify(["any-order", "report", "block:world"]) })) localStorage.setItem(k, v);
    const dz = await import("/src/lib/doors.ts");
    localStorage.setItem("memap_path_start", dz.isoLocal(new Date()));
    await dz.ensureTemplates(["felt-nauseous", "slept-enough", "felt-stressed", "argued-with-partner", "exercised", "felt-happy"]);
  }, lang);
  await p.reload(); await p.waitForTimeout(2600);
  const days = [];
  const cur = () => p.evaluate(() => document.querySelector("[data-strip-cell][aria-current]")?.getAttribute("data-strip-cell") ?? "");
  days.push(await cur());
  for (let k = 0; k < 60; k++) {
    await p.mouse.move(195, h / 2); await p.mouse.wheel(0, 40); await p.waitForTimeout(90);
    const d = await cur(); if (d && d !== days[days.length - 1]) days.push(d);
  }
  out[`${lang} days in order`] = days;
  const step = (a, b2) => Math.round((new Date(b2 + "T00:00:00") - new Date(a + "T00:00:00")) / 864e5);
  for (let i = 1; i < days.length; i++) if (step(days[i - 1], days[i]) !== 1) fails.push(`${lang}: ${days[i - 1]} → ${days[i]} skips a day`);
  if (days.length < 3) fails.push(`${lang}: the strip did not move on (${days.join(", ")})`);
  await p.close();
}
console.log(JSON.stringify({ fails, errs, out }, null, 1));
await b.close();
