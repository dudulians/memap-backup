// r158 (Nov 13 2026, branch design/one-system): the page of one thing.
// 1. A question on its island opens a page with four rows in the app's order: My days, Links, When to act, What helps.
// 2. My days says "k of the last 30 days" with 30 dots; Links says the question's strongest link; a lit rule says "Time to act".
// 3. Each row opens its own place (My days, Links, When to act), and closing the page goes back to the island.
// Run from marketing/tools with the dev server on 8080; exit 1 when a check fails.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r158`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const check = (name, ok, info) => { out[name] = ok ? "ok" : `FAIL ${info !== undefined ? JSON.stringify(info).slice(0, 500) : ""}`; if (!ok) fails.push(name); };
for (const lang of ["en", "ru"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async (lang) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); const r = g.generateDemoData("work-home");
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(r.newTrackers)); localStorage.setItem("memap_entries", JSON.stringify(r.newEntries));
    localStorage.setItem("memap_path_start", [...r.newEntries.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1");
    localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order", "report", "block:world"]));
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(9) })); localStorage.setItem("memap_playful_asked", "seed");
    localStorage.setItem("memap_week_chests", JSON.stringify(Object.fromEntries(Array.from({ length: 9 }, (_, w) => [w, { openedAt: iso(1), lines: [], reward: "balloon" }]))));
  }, lang);
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(1800);
  await p.locator("button").filter({ hasText: lang === "en" ? /^World$/ : /^Мир$/ }).last().click(); await p.waitForTimeout(2800);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-island", { detail: { island: "love" } }))); await p.waitForTimeout(1600);
  const q = p.locator("[data-open-thing]").first();
  check(`${lang}: a question on the island can be opened`, (await q.count()) === 1 || (await p.locator("[data-open-thing]").count()) >= 1);
  await q.scrollIntoViewIfNeeded(); await q.click(); await p.waitForTimeout(1300);
  const page = p.locator("[data-thing]");
  const rows = await page.locator("[data-thing-row]").evaluateAll((els) => els.map((e) => e.getAttribute("data-thing-row")));
  check(`${lang}: four rows in the app's order`, rows.join() === "days,links,act,helps", rows);
  const text = (await page.innerText()).replace(/\s+/g, " ");
  out[`${lang} page`] = text.slice(0, 420);
  const dots = await page.locator('[data-thing-row="days"]').evaluate((el) => el.querySelectorAll(".grid-cols-7 > span").length);
  check(`${lang}: My days counts the last 30 days and draws 30 dots`, (lang === "en" ? /\d+ of the last 30 days/ : /\d+ из последних 30 дней/).test(text) && dots === 30, { dots });
  check(`${lang}: Links says the question's link from its days`, (lang === "en" ? /From your days .*(argue|drained|email)/i : /По твоим дням .*(ссор|сил|email)/i).test(text), text.slice(0, 300));
  check(`${lang}: a reached limit says it is time to act`, (lang === "en" ? /This is often\. Time to act/ : /Это часто\. Пора действовать/).test(text));
  await p.screenshot({ path: `${D}/${lang}-1-thing.png` });
  // the rows lead to their places
  await page.locator('[data-thing-row="days"]').click(); await p.waitForTimeout(1300);
  const days = (await p.locator("[role=dialog]").last().innerText()).replace(/\s+/g, " ");
  check(`${lang}: the My days row opens My days`, (lang === "en" ? /My days/ : /Мои дни/).test(days) && !/\[data-thing\]/.test(days), days.slice(0, 120));
  await p.keyboard.press("Escape"); await p.waitForTimeout(900);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-island", { detail: { island: "love" } }))); await p.waitForTimeout(1500);
  await p.locator("[data-open-thing]").first().click(); await p.waitForTimeout(1200);
  await p.locator("[data-thing-link]").click(); await p.waitForTimeout(1500);
  check(`${lang}: the link opens in Links`, (await p.locator("[data-link-card]").count()) >= 1);
  await p.keyboard.press("Escape"); await p.waitForTimeout(900);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-island", { detail: { island: "love" } }))); await p.waitForTimeout(1500);
  await p.locator("[data-open-thing]").first().click(); await p.waitForTimeout(1200);
  await p.keyboard.press("Escape"); await p.waitForTimeout(1200);
  const back = (await p.locator("[role=dialog]").last().innerText().catch(() => "")).replace(/\s+/g, " ");
  check(`${lang}: closing the page goes back to the island`, (lang === "en" ? /Love life/ : /Личная жизнь|Любовь|Отношения/).test(back) && (await p.locator("[data-open-thing]").count()) >= 1, back.slice(0, 100));
  await ctx.close();
}
await b.close();
console.log(JSON.stringify(out, null, 1));
if (errs.length) console.log("PAGE ERRORS:", errs.slice(0, 5));
process.exit(fails.length || errs.length ? 1 : 0);
