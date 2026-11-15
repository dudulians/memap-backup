// Her note (Nov 15 2026 evening): «давай в онбординге ярче выделим то, что можно 3 только для начала и дальше добавишь».
// The topic step: three dots that fill as topics are picked, "3 topics to start" in teal, "Add more anytime later".
// Run from marketing/tools.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r180`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const out = {}, fails = [], errs = [];
for (const lang of ["en", "ru"]) {
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true })).newPage();
  p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  await p.evaluate((lang) => { localStorage.clear(); for (const [k, v] of Object.entries({ memap_ab_onb: "A", memap_ui: "new", memap_language: lang, memap_language_chosen: "true", memap_theme: "aurora-light" })) localStorage.setItem(k, v); }, lang);
  await p.reload(); await p.waitForTimeout(2200);
  // welcome → value → (A) why → topics
  for (let k = 0; k < 4 && !(await p.locator("[data-topic-count]").count()); k++) {
    const btn = p.locator(".onb button").filter({ hasText: /^(Get started|Начать|Continue|Дальше|Next)/ }).first();
    if (await btn.count()) { await btn.click(); await p.waitForTimeout(900); continue; }
    const choice = p.locator(".onb button[aria-pressed]").first();
    if (await choice.count()) { await choice.click(); await p.waitForTimeout(300); }
    await p.locator(".onb button").filter({ hasText: /Continue|Дальше|Next/ }).last().click().catch(() => {}); await p.waitForTimeout(900);
  }
  const dots = () => p.evaluate(() => [...document.querySelectorAll("[data-topic-count] span > span")].map((d) => getComputedStyle(d).backgroundColor));
  out[`${lang} line`] = await p.locator("[data-topic-count]").innerText().catch(() => "no topic step");
  const d0 = await dots();
  await p.evaluate(() => document.querySelectorAll(".onb [aria-expanded=false]").forEach((x) => x.click())); await p.waitForTimeout(400);
  const chips = p.locator(".onb button[aria-pressed=false]");
  await chips.nth(0).click(); await p.waitForTimeout(250); await chips.nth(0).click(); await p.waitForTimeout(250);
  const d2 = await dots();
  await p.screenshot({ path: `${D}/${lang}-three-to-start.png` });
  out[`${lang} dots`] = { before: new Set(d0).size, filledAfterTwo: d2.filter((c) => c !== d2[2]).length };
  if (d0.length !== 3) fails.push(`${lang}: three dots expected, got ${d0.length}`);
  if (!/3/.test(out[`${lang} line`])) fails.push(`${lang}: "3 to start" not shown`);
  if (out[`${lang} dots`].filledAfterTwo !== 2) fails.push(`${lang}: two picks should fill two dots`);
  await p.close();
}
console.log(JSON.stringify({ fails, errs, out }, null, 1));
await b.close();
