// QA (old user): inside My days, Links, When to act, What helps. Usage: node aurora-tests/qa-old-deep.mjs en aurora-light
import { launch, page, seed, shooter, installHelpers, toWorld, toSection, esc, ev, buttons, clickText, log } from "./qa-old-lib.mjs";
const lang = process.argv[2] ?? "en", theme = process.argv[3] ?? "aurora-light";
const dir = `deep-${lang}-${theme === "aurora" ? "night" : "day"}`;
const RU = lang === "ru";
const b = await launch();
const { ctx, p, errs } = await page(b, { lang });
await installHelpers(p);
const info = await seed(p, { lang, theme });
const { shot, text, save, scrollShots } = shooter(p, dir);
const step = async (name, fn) => { try { await fn(); } catch (e) { log(dir, { [`FAIL ${name}`]: e.message.slice(0, 300) }); } };
const topDialogs = () => p.evaluate(() => document.querySelectorAll("[role=dialog]").length);

// ---------- My days ----------
await step("calendar", async () => {
  await toSection(p, "overview");
  await shot("cal-open");
  // next question ›, twice
  await p.locator("[role=dialog] [aria-label='Next question'], [role=dialog] [aria-label='Следующий вопрос']").first().click();
  await shot("cal-next-q"); await text("cal next q");
  await p.locator("[role=dialog] [aria-label='Next question'], [role=dialog] [aria-label='Следующий вопрос']").first().click();
  await shot("cal-next-q2");
  // the question list (the title button)
  await p.locator("[role=dialog] button[aria-expanded]").last().click(); await shot("cal-q-list"); await text("cal q list");
  await scrollShots("cal-q-list", 3);
  await p.locator("[role=dialog] button[aria-expanded]").last().click().catch(() => {}); await p.waitForTimeout(400);
  // previous month
  await p.locator("[role=dialog] [aria-label='Previous month'], [role=dialog] [aria-label='Предыдущий месяц']").first().click(); await shot("cal-prev-month");
  // year
  await clickText(p, RU ? /^Год$/ : /^Year$/); await shot("cal-year"); await text("cal year");
  await scrollShots("cal-year", 3);
  await clickText(p, RU ? /^Месяц$/ : /^Month$/); await p.waitForTimeout(500);
  // a day: tap day 3 of the shown month
  await p.evaluate(() => { const s = window.__qaScroller(); if (s) s.scrollTop = 0; });
  const day = p.locator("[role=dialog] button", { hasText: /^12$/ }).first();
  await day.click(); await p.waitForTimeout(1200);
  await shot("cal-day-sheet"); await text("cal day sheet"); log(dir, { daySheetButtons: await buttons(p) });
  await scrollShots("cal-day-sheet", 4);
  await esc(p, 1); await p.waitForTimeout(600);
  log(dir, { afterDayEscDialogs: await topDialogs() });
  // select several days
  await p.evaluate(() => { const s = window.__qaScroller(); if (s) s.scrollTop = 99999; });
  await clickText(p, RU ? /Выбрать несколько/ : /Select several days/); await p.waitForTimeout(700);
  await shot("cal-multi"); await text("cal multi");
  for (const d of ["13", "14", "15"]) await p.locator("[role=dialog] button", { hasText: new RegExp(`^${d}$`) }).first().click().catch(() => {});
  await p.waitForTimeout(500); await shot("cal-multi-picked"); await text("cal multi picked"); log(dir, { multiButtons: await buttons(p) });
  await p.evaluate(() => { const s = window.__qaScroller(); if (s) s.scrollTop = 99999; }); await shot("cal-multi-bottom");
  await esc(p, 2);
});
// island chip filter inside My days
await step("calendar island", async () => {
  await toSection(p, "overview");
  await clickText(p, RU ? /Здоровье/ : /^Health$/); await p.waitForTimeout(800);
  await shot("cal-health"); await text("cal health chip");
  await clickText(p, RU ? /^График$/ : /^Chart$/); await p.waitForTimeout(1200);
  await shot("chart-health"); await text("chart health");
  await scrollShots("chart-health", 4);
  await clickText(p, RU ? /^Все$/ : /^All$/); await p.waitForTimeout(1000);
  await shot("chart-all"); await text("chart all"); log(dir, { chartButtons: await buttons(p) });
  await scrollShots("chart-all", 5);
  await esc(p, 2);
});

// ---------- Links ----------
await step("links", async () => {
  await toSection(p, "findings");
  const all = await p.locator("[role=dialog] button[aria-expanded]").count();
  const tabs = await p.evaluate(() => [...[...document.querySelectorAll("[role=dialog]")].pop().querySelectorAll("button")].filter((x) => /^(All|Все|Mind & mood|Health|Body & habits|Разум и настроение|Здоровье|Тело и привычки|Голова и настроение|Тело)/.test(x.textContent.trim())).map((x) => x.textContent.trim()));
  log(dir, { linksAll: all, tabs });
  // open 2nd and 3rd links
  await p.locator("[role=dialog] button[aria-expanded]").nth(1).click(); await p.waitForTimeout(700);
  await p.locator("[role=dialog] button[aria-expanded]").nth(1).scrollIntoViewIfNeeded(); await shot("links-2nd-open"); await text("links 2nd open");
  // "See the days" on the strongest
  await p.evaluate(() => { const s = window.__qaScroller(); if (s) s.scrollTop = 0; });
  const seeDays = await clickText(p, RU ? /Посмотреть дни|Показать дни|дни/ : /See the days/);
  log(dir, { seeDays });
  await p.waitForTimeout(1500); await shot("links-see-days"); await text("links see the days");
  await scrollShots("links-see-days", 3);
  await esc(p, 1); await p.waitForTimeout(800);
  log(dir, { afterSeeDaysDialogs: await topDialogs() });
  // each island tab
  await toSection(p, "findings");
  const tabsIdx = await p.locator("[role=dialog] [role=tab]").count();
  log(dir, { roleTabs: tabsIdx });
  const names = RU ? [/Голова|Разум|настроение/, /Здоровье/, /Тело/] : [/^Mind & mood$/, /^Health$/, /^Body & habits$/];
  for (const re of names) {
    const hit = await clickText(p, re); await p.waitForTimeout(1300);
    const c = await p.locator("[role=dialog] button[aria-expanded]").count();
    log(dir, { [`links tab ${hit}`]: c });
    await shot(`links-tab-${String(hit).slice(0, 12).replace(/[^a-zа-я]/gi, "")}`); await text(`links tab ${hit}`);
    await scrollShots(`links-tab-${String(hit).slice(0, 6).replace(/[^a-zа-я]/gi, "")}`, 3);
  }
  await esc(p, 2);
});
// island sheet links: tap the first link tile
await step("island link tile", async () => {
  await toWorld(p);
  await ev(p, "memap-open-island", { island: "health" }); await p.waitForTimeout(1600);
  await p.evaluate(() => { const s = window.__qaScroller(); if (s) s.scrollTop = 99999; });
  const hit = await clickText(p, /→/); log(dir, { islandLinkTap: hit });
  await p.waitForTimeout(1500); await shot("island-link-tap"); await text("island link tap");
  await scrollShots("island-link-tap", 3);
  await esc(p, 2);
  // the island's own Calendar / Chart / Action points tiles
  await toWorld(p);
  await ev(p, "memap-open-island", { island: "health" }); await p.waitForTimeout(1600);
  await p.evaluate(() => { const s = window.__qaScroller(); if (s) s.scrollTop = 99999; });
  await clickText(p, RU ? /Пункты действий|Когда действовать|Точки действия|маяк/i : /Action points/); await p.waitForTimeout(1500);
  await shot("island-action-points"); await text("island action points");
  await esc(p, 2);
  // ideas expanded, treasures "All treasures"
  await toWorld(p);
  await ev(p, "memap-open-island", { island: "health" }); await p.waitForTimeout(1600);
  await clickText(p, RU ? /Все сокровища/ : /All treasures/); await p.waitForTimeout(1500);
  await shot("island-all-treasures"); await text("island all treasures");
  await scrollShots("island-all-treasures", 4);
  await esc(p, 2);
  await toWorld(p);
  await ev(p, "memap-open-island", { island: "health" }); await p.waitForTimeout(1600);
  await p.evaluate(() => { const s = window.__qaScroller(); if (s) s.scrollTop = 99999; });
  await clickText(p, RU ? /Идеи для/ : /Ideas for this island/); await p.waitForTimeout(800);
  await shot("island-ideas"); await text("island ideas");
  // a question's ••• menu
  await p.locator("[role=dialog] button[aria-label]").filter({ hasText: "" }).nth(2).click().catch(() => {});
  await p.waitForTimeout(800); await shot("island-q-menu"); await text("island q menu");
  await esc(p, 3);
});

// ---------- When to act ----------
await step("act", async () => {
  await toSection(p, "signals");
  // See details on the first lit card
  await clickText(p, RU ? /Подробнее/ : /See details/); await p.waitForTimeout(1300);
  await shot("act-see-details"); await text("act see details"); log(dir, { seeDetailsButtons: await buttons(p) });
  await scrollShots("act-see-details", 4);
  await esc(p, 1); await p.waitForTimeout(600);
  log(dir, { afterDetailsDialogs: await topDialogs() });
  // Not for me
  await toSection(p, "signals");
  await clickText(p, RU ? /Не для меня|Не моё|Не мое/ : /Not for me/); await p.waitForTimeout(1200);
  await shot("act-not-for-me"); await text("act not for me"); log(dir, { notForMeButtons: await buttons(p) });
  await scrollShots("act-not-for-me", 3);
  await esc(p, 1); await p.waitForTimeout(600);
  // a running test's sheet
  await toSection(p, "signals");
  await clickText(p, RU ? /Ложиться спать до 23:00|23:00/ : /Go to bed by 23:00/); await p.waitForTimeout(1200);
  await shot("act-test-sheet"); await text("act test sheet"); log(dir, { testSheetButtons: await buttons(p) });
  await scrollShots("act-test-sheet", 4);
  // reminder switch off and on, change time
  const sw = p.locator("[role=dialog] [role=switch]").last();
  if (await sw.count()) {
    await sw.click(); await p.waitForTimeout(500); await shot("act-test-remind-off");
    await sw.click(); await p.waitForTimeout(500);
    const tm = p.locator("[role=dialog] input[type=time]").last();
    if (await tm.count()) { await tm.fill("21:30"); await p.waitForTimeout(500); }
    await shot("act-test-remind-2130");
    log(dir, { remind: await p.evaluate(() => JSON.parse(localStorage.getItem("memap_experiments")).map((e) => `${e.change}: ${e.remind ?? "-"}`)) });
  }
  await esc(p, 1); await p.waitForTimeout(600);
  // the finished-waiting test row (done: see on Today)
  await toSection(p, "signals");
  await clickText(p, RU ? /кофе/i : /Skip coffee/); await p.waitForTimeout(1300);
  await shot("act-done-test"); await text("act done test"); log(dir, { doneTestButtons: await buttons(p) });
  await scrollShots("act-done-test", 3);
  await esc(p, 1);
  // a watching row: does it open?
  await toSection(p, "signals");
  await p.evaluate(() => { const s = window.__qaScroller(); if (s) s.scrollTop = 99999; });
  const before = await topDialogs();
  const tapped = await p.evaluate((RU) => {
    const d = [...document.querySelectorAll("[role=dialog]")].pop();
    const el = [...d.querySelectorAll("p, div, span, h3")].find((x) => (RU ? /Запишите|Записать|триггер/ : /Log the trigger|Book a doctor/).test(x.textContent) && x.children.length === 0);
    if (!el) return null; el.click(); return el.textContent.slice(0, 60);
  }, RU);
  await p.waitForTimeout(1200);
  log(dir, { watchingTap: tapped, dialogsBefore: before, dialogsAfter: await topDialogs() });
  await shot("act-watching-tap"); await text("act watching tap");
  await esc(p, 2);
  // "I did it" on a once-plan
  await toSection(p, "signals");
  await clickText(p, RU ? /Я сделал|Сделано|Готово/ : /I did it/); await p.waitForTimeout(1300);
  await shot("act-i-did-it"); await text("act i did it"); log(dir, { didItButtons: await buttons(p) });
  await esc(p, 2);
  // Try it for 2 weeks
  await toSection(p, "signals");
  await clickText(p, RU ? /Попробовать 2 недели|2 недели/ : /Try it for 2 weeks/); await p.waitForTimeout(1300);
  await shot("act-try-2w"); await text("act try 2 weeks"); log(dir, { try2wButtons: await buttons(p) });
  await scrollShots("act-try-2w", 3);
  await esc(p, 2);
});

// ---------- What helps ----------
await step("helps", async () => {
  await toWorld(p);
  await p.evaluate(() => document.querySelector("[data-tour=helps]")?.click()); await p.waitForTimeout(1500);
  await shot("helps"); await text("helps");
  // tried-before row tap
  const before = await topDialogs();
  const hit = await p.evaluate((RU) => { const d = [...document.querySelectorAll("[role=dialog]")].pop(); const el = [...d.querySelectorAll("*")].find((x) => x.children.length === 0 && (RU ? /20 минут/ : /Walk for 20 minutes/).test(x.textContent)); if (!el) return null; (el.closest("button") ?? el).click(); return !!el.closest("button"); }, RU);
  await p.waitForTimeout(1200); log(dir, { triedBeforeTap: hit, before, after: await topDialogs() });
  await shot("helps-tried-before-tap"); await text("helps tried before tap");
  await esc(p, 1);
  // See how it went
  await toWorld(p);
  await p.evaluate(() => document.querySelector("[data-tour=helps]")?.click()); await p.waitForTimeout(1500);
  await clickText(p, RU ? /кофе/i : /Skip coffee/); await p.waitForTimeout(1500);
  await shot("helps-see-how"); await text("helps see how it went"); log(dir, { seeHowButtons: await buttons(p) });
  await scrollShots("helps-see-how", 4);
  await esc(p, 2);
  // Test one change
  await toWorld(p);
  await p.evaluate(() => document.querySelector("[data-tour=helps]")?.click()); await p.waitForTimeout(1500);
  await clickText(p, RU ? /Проверить одно|Попробовать одно|изменени/ : /Test one change/); await p.waitForTimeout(1500);
  await shot("helps-test-one"); await text("helps test one change"); log(dir, { testOneButtons: await buttons(p) });
  await scrollShots("helps-test-one", 4);
  // pick the first idea
  const idea = await p.evaluate(() => { const d = [...document.querySelectorAll("[role=dialog]")].pop(); const bs = [...d.querySelectorAll("button")].filter((x) => x.textContent.trim().length > 12 && !/Close|Закрыть/.test(x.getAttribute("aria-label") ?? "")); bs[0]?.click(); return bs[0]?.textContent.trim().slice(0, 80); });
  await p.waitForTimeout(1300); log(dir, { pickedIdea: idea });
  await shot("helps-start-screen"); await text("helps start screen"); log(dir, { startButtons: await buttons(p) });
  await scrollShots("helps-start-screen", 3);
  await esc(p, 3);
});

save();
log(dir, { errs });
console.log(JSON.stringify({ errs: errs.filter((e) => !/InAppReview/.test(e)).slice(0, 10) }, null, 1));
await ctx.close(); await b.close();
