// Safety round (Nov 7 2026): "Need to talk?" on mood cards opens a free line for the phone's
// time zone; hard mood on 12 of 14 days shows a card on Today; palpitations in the doctor list.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r65`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
const setup = async (p, lang, heavy) => {
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  await p.evaluate(async ({ lang, heavy }) => {
    localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order"])); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1");
    localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" })); localStorage.setItem("memap_tour_completed", "1");
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    await dz.ensureTemplates(["felt-depressed", "slept-enough"]);
    if (heavy) {
      const T = await st.getTrackers(); const dep = T.find((x) => /depress|down|подавл|грус/i.test(x.title + x.questionText)) ?? T[0]; const E = [];
      for (let d = 1; d <= 13; d++) E.push({ id: `h${d}`, trackerId: dep.id, date: dz.daysAgoIso(d), value: dep.problemWhen === "yes" });
      await st.saveEntries(E);
    }
  }, { lang, heavy });
  await p.reload(); await p.waitForTimeout(2400);
};
// 1. the chip on a mood card, three time zones
for (const [tz, lang] of [["Asia/Dubai", "en"], ["Europe/Berlin", "en"], ["Europe/Moscow", "ru"]]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, timezoneId: tz });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await setup(p, lang, false);
  await p.locator(".path-start").first().click(); await p.waitForTimeout(1500);
  const tag = tz.split("/")[1];
  for (let k = 0; k < 3; k++) {
    const chip = p.getByRole("button", { name: /Talk to someone|Поговорить с кем-то/ });
    if (await chip.count()) {
      out[`${tag} chip`] = true;
      await chip.first().click(); await p.waitForTimeout(1200);
      await p.screenshot({ path: `${D}/${tag}-support.png` });
      out[`${tag} sheet`] = await p.evaluate(() => [...document.querySelectorAll("[role=dialog]")].pop()?.innerText.replace(/\s+/g, " ").slice(0, 400));
      break;
    }
    await p.getByRole("button", { name: lang === "ru" ? /^Нет$/ : /^No$/ }).last().click(); await p.waitForTimeout(800);
  }
  await ctx.close();
}
// 2. the two-weeks card on Today
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, timezoneId: "Europe/London" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await setup(p, "en", true);
  out.card = await p.getByText("Most days were hard for two weeks").count();
  await p.screenshot({ path: `${D}/today-card.png` });
  const go = p.getByRole("button", { name: "Talk to someone" });
  if (await go.count()) { await go.first().click(); await p.waitForTimeout(1300); out.cardSheet = await p.evaluate(() => [...document.querySelectorAll("[role=dialog]")].pop()?.innerText.replace(/\s+/g, " ").slice(0, 300)); await p.screenshot({ path: `${D}/today-support.png` }); }
  // the red-flag list was removed (her content audit, Nov 10 2026)
  out.flagsRemoved = await p.evaluate(async () => { const { default: i18n } = await import("/src/lib/i18n.ts"); return !i18n.exists("redFlags.now"); });
  await ctx.close();
}
// 3. no card without a heavy two weeks
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await setup(p, "en", false);
  out.noCard = await p.getByText("Most days were hard for two weeks").count();
  await ctx.close();
}
console.log(JSON.stringify({ out, errs }, null, 1));
await b.close();
