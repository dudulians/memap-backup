// "When to act" after her phone test (Nov 7 2026): the question is the title, one dot row with
// words; a plan is Once (I did it → before/after) or Every day (a 2-week test); tests on different
// islands side by side; old medical advice turns general; the camera isn't for a link.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r70`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const out = {}, errs = [];
for (const lang of ["en", "ru"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  await p.evaluate(async (lang) => {
    localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1");
    localStorage.setItem("memap_tour_completed", "1"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" }));
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    await dz.ensureTemplates(["felt-fatigued", "slept-enough", "felt-anxious"]);
    const T = await st.getTrackers();
    // an old user's advice from before (it should turn into the general one on start)
    const fat = T.find((x) => /drain|fatig|устал|разбит/i.test(x.title + x.questionText));
    fat.adviceAboveThreshold = "Get bloodwork — iron, ferritin, B12, thyroid"; fat.threshold = 12; fat.periodDays = 30;
    const sl = T.find((x) => /7\+|sleep|сна|сон/i.test(x.title + x.questionText));
    sl.adviceAboveThreshold = "Go to bed by 23:00"; sl.threshold = 6; sl.periodDays = 14;
    await st.saveTrackers(T);
    const E = [];
    for (let d = 1; d <= 30; d++) {
      E.push({ id: `f${d}`, trackerId: fat.id, date: dz.daysAgoIso(d), value: fat.problemWhen === "yes" ? d % 2 === 0 : d % 2 !== 0 });
      E.push({ id: `s${d}`, trackerId: sl.id, date: dz.daysAgoIso(d), value: sl.problemWhen === "yes" ? d % 3 !== 0 : d % 3 === 0 });
    }
    await st.saveEntries(E);
  }, lang);
  await p.reload(); await p.waitForTimeout(2600);
  out[`${lang} advice`] = await p.evaluate(async () => { const st = await import("/src/lib/storage.ts"); return (await st.getTrackers()).map((x) => x.adviceAboveThreshold).filter(Boolean); });
  // World → When to act
  await p.locator("nav button").nth(1).click(); await p.waitForTimeout(2200);
  await p.getByText(/^(When to act|Когда действовать)$/).first().click().catch(() => {}); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${D}/${lang}-list.png` });
  out[`${lang} buttons`] = await p.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].map((x) => x.textContent?.trim()).filter((s) => s && s.length < 40));
  // Show on the first card
  const show = p.getByRole("button", { name: /^(Show|Показать)$/ }).first();
  if (await show.count()) { await show.click(); await p.waitForTimeout(1300); await p.screenshot({ path: `${D}/${lang}-show.png` }); out[`${lang} show`] = await p.evaluate(() => [...document.querySelectorAll("[role=dialog]")].pop()?.innerText.replace(/\s+/g, " ").slice(0, 500)); }
  await ctx.close();
}
// two tests side by side, one per island; the camera
{
  const ctx = await b.newContext(); const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  out.tests = await p.evaluate(async () => {
    localStorage.clear(); const ex = await import("/src/lib/experiments.ts");
    await ex.startExperiment("health", "Bed by 23:00", "Were you in bed by 23:00?");
    await ex.startExperiment("me", "10 minutes outside", "Were you outside for 10 minutes?");
    const two = ex.runningExperiments().map((x) => x.island);
    await ex.startExperiment("health", "No coffee after 14:00", "Did you skip coffee after 14:00?");
    return { two, afterSameIsland: ex.runningExperiments().map((x) => `${x.island}:${x.change}`) };
  });
  await ctx.close();
}
console.log(JSON.stringify({ out, errs }, null, 1));
await b.close();
