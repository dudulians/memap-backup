// Her note (Nov 15 2026 evening): Settings → "Show app tour" opened the whole onboarding (topics to pick, no skip).
// Now it shows the tour of the main screens: Today's part, then the World tab glows and the World's part runs there.
// Nothing she answered changes. Run from marketing/tools.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r181`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const out = {}, fails = [], errs = [];
for (const lang of ["en", "ru"]) {
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  await p.evaluate(async (lang) => {
    const g = await import("/src/lib/demoDataGenerator.ts"); const r = g.generateDemoData("work-home");
    localStorage.clear();
    for (const [k, v] of Object.entries({ memap_ui: "new", memap_tour_seen: "true", memap_tour_completed: "1", memap_tour_world: "1", memap_tour_today: "1", memap_language: lang, memap_language_chosen: "true", memap_theme: "aurora-light", memap_first_link_seen: "before", memap_tips_seen: JSON.stringify(["any-order", "report", "block:world", "you", "notes"]) })) localStorage.setItem(k, v);
    localStorage.setItem("memap_trackers", JSON.stringify(r.newTrackers)); localStorage.setItem("memap_entries", JSON.stringify(r.newEntries));
    localStorage.setItem("memap_path_start", new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 10));
  }, lang);
  await p.reload(); await p.waitForTimeout(2200);
  const answers0 = await p.evaluate(() => JSON.parse(localStorage.getItem("memap_entries")).length);
  await p.getByRole("button", { name: lang === "ru" ? "Ты" : "You", exact: true }).first().click(); await p.waitForTimeout(1000);
  await p.getByRole("button", { name: lang === "ru" ? /^Настройки$/ : /^Settings$/ }).first().click(); await p.waitForTimeout(1000);
  await p.getByRole("button", { name: lang === "ru" ? /Помощь/ : /Help/ }).first().click(); await p.waitForTimeout(800);
  await p.getByRole("button", { name: lang === "ru" ? /Посмотреть, как работает приложение/ : /Show app tour/ }).first().click(); await p.waitForTimeout(1800);
  await p.screenshot({ path: `${D}/${lang}-tour-today.png` });
  out[`${lang} onboarding shown`] = await p.locator(".onb").count();
  out[`${lang} tour`] = await p.evaluate(() => [...document.querySelectorAll("[role=dialog].tour, .tour[role=dialog]")].map((x) => x.getAttribute("aria-label")));
  if (out[`${lang} onboarding shown`]) fails.push(`${lang}: Show app tour opened the onboarding`);
  if (!out[`${lang} tour`].length) fails.push(`${lang}: no tour on Today`);
  // walk Today's part with its own buttons
  for (let k = 0; k < 8 && (await p.locator(".tour[role=dialog]").count()); k++) {
    await p.locator(".tour[role=dialog] button").last().click().catch(() => {}); await p.waitForTimeout(900);
  }
  await p.waitForTimeout(600);
  out[`${lang} world glows`] = await p.locator("[data-world-ready]").count();
  if (!out[`${lang} world glows`]) fails.push(`${lang}: after Today's part the World tab should glow`);
  await p.screenshot({ path: `${D}/${lang}-tour-world-ready.png` });
  await p.locator("[data-world-ready]").click().catch(() => {}); await p.waitForTimeout(2200);
  out[`${lang} world tour`] = await p.evaluate(() => [...document.querySelectorAll(".tour[role=dialog]")].map((x) => x.getAttribute("aria-label")));
  if (!out[`${lang} world tour`].length) fails.push(`${lang}: the World's part should start on the World`);
  await p.screenshot({ path: `${D}/${lang}-tour-world.png` });
  for (let k = 0; k < 10 && (await p.locator(".tour[role=dialog]").count()); k++) {
    await p.locator(".tour[role=dialog] button").last().click().catch(() => {}); await p.waitForTimeout(900);
  }
  out[`${lang} keys after`] = await p.evaluate(() => Object.fromEntries(["memap_tour_completed", "memap_tour_world", "memap_tour_replay", "memap_world_next", "memap_tour_seen"].map((k) => [k, localStorage.getItem(k)])));
  const answers1 = await p.evaluate(() => JSON.parse(localStorage.getItem("memap_entries")).length);
  if (answers1 !== answers0) fails.push(`${lang}: answers changed ${answers0} → ${answers1}`);
  if (out[`${lang} keys after`].memap_tour_seen !== "true") fails.push(`${lang}: the onboarding would come back on the next launch`);
  await p.close();
}
console.log(JSON.stringify({ fails, errs, out }, null, 1));
await b.close();
