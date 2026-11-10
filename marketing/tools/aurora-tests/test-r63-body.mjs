// Body questions (research round 2, Nov 7 2026): a follow-up comes only after "yes" to its
// question; one day without a poo isn't a hard day; no "Something worrying?" chip since Nov 10 2026.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r63`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
for (const [lang, first] of [["en", false], ["en", true], ["ru", true]]) {
  const tag = `${lang}-${first ? "yes" : "no"}`;
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  await p.evaluate(async (lang) => {
    localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1");
    localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" })); localStorage.setItem("memap_tour_completed", "1");
    const dz = await import("/src/lib/doors.ts"); await dz.ensureTemplates(["period-day", "heavy-flow-day", "pooped-today"]);
  }, lang);
  await p.reload(); await p.waitForTimeout(2200);
  await p.locator(".path-start").first().click(); await p.waitForTimeout(1500);
  const cardText = () => p.evaluate(() => [...document.querySelectorAll("[role=dialog] p, [role=dialog] h2, [role=dialog] h3")].map((x) => x.textContent).filter((s) => /\?$/.test(s?.trim() ?? "")).slice(-1)[0] ?? "");
  const seen = [];
  for (let k = 0; k < 4; k++) {
    const txt = await cardText(); if (!txt) break; seen.push(txt);
    if (k === 0) { await p.screenshot({ path: `${D}/${tag}-card.png` }); const chip = p.getByRole("button", { name: /Something worrying|Что-то тревожит/ }); out[`${tag} chip`] = await chip.count(); }
    const isPeriod = /period|месячные/i.test(txt) && !/heavy|обильн/i.test(txt);
    const ans = isPeriod ? first : false;
    await p.getByRole("button", { name: ans ? (lang === "ru" ? /^Да$/ : /^Yes$/) : (lang === "ru" ? /^Нет$/ : /^No$/) }).last().click(); await p.waitForTimeout(800);
  }
  out[tag] = seen;
  await ctx.close();
}
// the red flags sheet
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, timezoneId: "Asia/Dubai" });
const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
await p.evaluate(async () => { localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_tour_completed", "1"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" })); const dz = await import("/src/lib/doors.ts"); await dz.ensureTemplates(["pooped-today", "heartburn"]); });
await p.reload(); await p.waitForTimeout(2200);
await p.locator(".path-start").first().click(); await p.waitForTimeout(1500);
// the red-flag list was removed (her content audit, Nov 10 2026): no chip
out.noFlagsChip = (await p.getByRole("button", { name: /Something worrying/ }).count()) === 0;
// quiet no
out.quiet = await p.evaluate(async () => { const I = await import("/src/lib/islands.ts"); const S = await import("/src/lib/storage.ts"); const T = await S.getTrackers(); const poo = T.find((x) => /poop/i.test(x.title)); const hb = T.find((x) => /heartburn/i.test(x.title)); return { pooNoHard: I.isHardAnswer(poo, false), heartburnYesHard: I.isHardAnswer(hb, true) }; });
console.log(JSON.stringify({ out, errs }, null, 1));
await b.close();
