// Globe only (her note, Nov 7 2026: "заменить map на globe и всё, что было на map,
// перетащить на globe… если что, откатим"): World = header + the 4 parts on top + the
// globe below with her topic's island lit, links, New island, zoom buttons. Day and night.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r59`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
for (const [lang, theme] of [["en", "aurora-light"], ["ru", "aurora"]]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && !/favicon|Failed to load resource/.test(m.text()) && errs.push(m.text()));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  await p.evaluate(async ({ lang, theme }) => {
    localStorage.clear();
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_theme", theme);
    localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" }));
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    const [mig, sleep, coffee, outside, tired, anx, sweets, friends] = await dz.ensureTemplates(["migraine", "slept-enough", "coffee-late", "outside-30min", "felt-fatigued", "felt-anxious", "ate-sweets", "saw-friends"]);
    dz.saveDoorState({ id: "migraine", trackerId: mig, contextTrackerIds: [sleep, coffee, outside, tired, anx], startedAt: dz.daysAgoIso(30) });
    const T = await st.getTrackers();
    await st.saveTrackers(T.map((x) => (x.id === sleep ? { ...x, threshold: 3, periodDays: 7 } : x)));
    const E = []; let i = 0;
    const put = (trackerId, d, value) => E.push({ id: `e${i++}`, trackerId, date: dz.daysAgoIso(d), value });
    for (let d = 30; d >= 1; d--) {
      const coffeeY = d % 3 === 2, badNight = (d + 1) % 3 === 2 || d === 7, noOut = d % 4 === 1, drained = (d + 1) % 4 === 1 || d === 10;
      put(coffee, d, coffeeY); put(sleep, d, !badNight); put(outside, d, !noOut); put(tired, d, drained);
      put(mig, d, badNight ? d !== 13 : d === 5); put(anx, d, d % 6 === 0); put(sweets, d, d % 2 === 0); put(friends, d, d % 5 !== 0);
    }
    await st.saveEntries(E);
  }, { lang, theme });
  await p.reload(); await p.waitForTimeout(2200);
  await p.locator("nav button").nth(1).click(); await p.waitForTimeout(3000);
  const tag = `${lang}-${theme}`;
  await p.screenshot({ path: `${D}/${tag}-1-world.png` });
  out[tag] = await p.evaluate(() => ({
    isles: [...document.querySelectorAll("[data-isle]")].map((e) => `${e.dataset.isle}${e.classList.contains("is-main") ? "*" : ""}:${(+getComputedStyle(e).opacity).toFixed(1)}`),
    innerChips: document.querySelectorAll(".planet-inner-chip").length,
    switch: !!document.querySelector("[role=tablist][aria-label]") && [...document.querySelectorAll("[role=tab]")].map((x) => x.textContent).join("|"),
    zoom: (window).__planet?.state?.(),
  }));
  await p.getByRole("button", { name: /Zoom in|Приблизить/ }).click(); await p.waitForTimeout(700);
  await p.screenshot({ path: `${D}/${tag}-2-zoomed.png` });
  out[`${tag} zoom`] = await p.evaluate(() => (window).__planet?.state?.());
  // tap the main island
  const main = await p.evaluate(() => { const e = document.querySelector("[data-isle].is-main"); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.6 }; });
  if (main) { await p.mouse.click(main.x, main.y); await p.waitForTimeout(1600); await p.screenshot({ path: `${D}/${tag}-3-island.png` }); }
  await ctx.close();
}
console.log(JSON.stringify({ out, errs }, null, 1));
await b.close();
