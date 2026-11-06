// Examples for her (Nov 6 2026, "дай примеры как будут писаться связи разных типов и
// количество для экшн пойнт"): a month of answers with every kind of link — together the
// same day, the next day, "without" (no time outside → drained), the second missing, her
// own question — and two rules lit. Screens: Links, a link card, When to act, a lit rule.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r58`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
for (const lang of (process.argv[2] ? [process.argv[2]] : ["ru", "en"])) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  await p.evaluate(async (lang) => {
    localStorage.clear();
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1");
    localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" }));
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    const [mig, sleep, coffee, outside, tired, anx] = await dz.ensureTemplates(["migraine", "slept-enough", "coffee-late", "outside-30min", "felt-fatigued", "felt-anxious"]);
    const dog = await dz.addOwnTracker(lang === "ru" ? "Погулял(а) с собакой?" : "Walked the dog?");
    dz.saveDoorState({ id: "migraine", trackerId: mig, contextTrackerIds: [sleep, coffee, outside, tired, anx, dog], startedAt: dz.daysAgoIso(30) });
    // rules: short night 3+ in 7, migraine 2+ in 7
    const T = await st.getTrackers();
    await st.saveTrackers(T.map((x) => (x.id === sleep ? { ...x, threshold: 3, periodDays: 7 } : x.id === mig ? { ...x, threshold: 2, periodDays: 7 } : x)));
    const E = []; let i = 0;
    const put = (trackerId, d, value) => E.push({ id: `e${i++}`, trackerId, date: dz.daysAgoIso(d), value });
    for (let d = 30; d >= 1; d--) {
      const coffeeY = d % 3 === 2;                  // coffee after 2 pm …
      const badNight = (d + 1) % 3 === 2 || d === 7; // … and a short night the next day
      const noOut = d % 4 === 1;                    // no time outside …
      const drained = (d + 1) % 4 === 1 || d === 10; // … drained the next day
      const walkedNo = d % 5 === 0;                 // her own question: didn't walk the dog
      put(coffee, d, coffeeY); put(sleep, d, !badNight); put(outside, d, !noOut); put(tired, d, drained);
      put(mig, d, badNight ? d !== 13 : walkedNo); put(anx, d, d % 6 === 0); put(dog, d, !walkedNo);
    }
    await st.saveEntries(E);
  }, lang);
  await p.reload(); await p.waitForTimeout(2200);
  await p.locator("nav button").nth(1).click(); await p.waitForTimeout(2200);
  // Links
  await p.locator("[data-tour='links-card']").click(); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${D}/${lang}-1-links.png` });
  out[`${lang} links`] = await p.evaluate(() => [...document.querySelectorAll("[role=dialog] p")].map((x) => x.innerText).filter((s) => /→/.test(s)));
  await p.keyboard.press("Escape"); await p.waitForTimeout(900);
  // When to act
  await p.locator("[data-tour='actions']").click(); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${D}/${lang}-2-actions.png` });
  out[`${lang} actions`] = await p.evaluate(() => [...document.querySelectorAll("[role=dialog]")].pop()?.innerText.replace(/\n+/g, " | ").slice(0, 600));
  const lit = p.locator("[role=dialog] button").filter({ hasText: /Show|Показать/ }).first();
  if (await lit.count()) { await lit.click(); await p.waitForTimeout(1300); await p.screenshot({ path: `${D}/${lang}-3-rule.png` }); out[`${lang} rule`] = await p.evaluate(() => [...document.querySelectorAll("[role=dialog]")].pop()?.innerText.replace(/\n+/g, " | ").slice(0, 400)); }
  await ctx.close();
}
console.log(JSON.stringify({ out, errs }, null, 1));
await b.close();
