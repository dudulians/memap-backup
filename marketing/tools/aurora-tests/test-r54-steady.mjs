// "Steady, or depends on the day?" (board 64): a thought topic (quit) shows when the thought came.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r54`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
for (const [lang, n, mode] of [["en", 16, "hard"], ["ru", 16, "hard"], ["en", 4, "early"], ["en", 16, "steady"]]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  await p.evaluate(async ({ lang, n, mode }) => {
    localStorage.clear();
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1");
    localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" }));
    const dz = await import("/src/lib/doors.ts"); const st = await import("/src/lib/storage.ts");
    const { trackerId, contextTrackerIds } = await dz.ensureDoorTrackers(dz.getDoor("quit"));
    dz.saveDoorState({ id: "quit", trackerId, contextTrackerIds, startedAt: dz.daysAgoIso(n) });
    const [sleep, burned, argued] = contextTrackerIds; const E = [];
    for (let d = 1; d <= n; d++) {
      const date = dz.daysAgoIso(d);
      const badSleep = d % 3 === 0, burn = d % 4 === 0, arg = d === 7;
      const hard = badSleep || burn || arg;
      const quit = mode === "steady" ? d % 5 !== 0 : hard ? d !== 12 : d === 5;
      E.push({ id: `${d}a`, trackerId: sleep, date, value: !badSleep }, { id: `${d}b`, trackerId: burned, date, value: burn }, { id: `${d}c`, trackerId: argued, date, value: arg }, { id: `${d}m`, trackerId, date, value: quit });
    }
    await st.saveEntries(E);
  }, { lang, n, mode });
  await p.reload(); await p.waitForTimeout(2200);
  await p.locator("nav button").nth(1).click(); await p.waitForTimeout(2200);
  await p.locator("[data-tour='links-card']").click(); await p.waitForTimeout(1500);
  const tag = `${lang}-${n}-${mode}`;
  await p.screenshot({ path: `${D}/${tag}.png` });
  out[tag] = await p.evaluate(() => [...document.querySelectorAll("p")].find((x) => /Steady, or depends|Постоянно или зависит/.test(x.textContent))?.parentElement?.innerText.replace(/\s+/g, " ") ?? null);
  await ctx.close();
}
console.log(JSON.stringify({ ...out, errs }, null, 1));
await b.close();
