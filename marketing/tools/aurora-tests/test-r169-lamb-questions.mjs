// r169 (Nov 14 2026, branch design/one-system): the lamb → My questions.
// Her note: the reminder sat in My questions; a question opened onto limits and numbers; Back went to Today, not to
// the lamb; the lamb's sheet repeated the week's dots and the links.
// 1. My questions has no reminder card (the evening reminder is in Settings).
// 2. A question opens onto Edit, Archive, Delete and "All about …", nothing else (no month dots, no limit).
// 3. Edit from here has the question and its words, no limit and no advice.
// 4. Back from My questions opened from the lamb goes back to the lamb's sheet.
// 5. The lamb's sheet has no week of dots and no links (My days and Links hold them).
// 6. "All about …" opens that question's page on the World.
// Screenshots in work/r169. Run from marketing/tools with the dev server on 8080 (PORT env to change); exit 1 on a failure.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const PORT = process.env.PORT ?? "8080";
const URL = `http://localhost:${PORT}/`;
const D = `./aurora-tests/work/r169`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const check = (name, ok, info) => { out[name] = ok ? "ok" : `FAIL ${info !== undefined ? JSON.stringify(info).slice(0, 400) : ""}`; if (!ok) fails.push(name); };
let n = 0;
const shot = async (p, name) => { await p.waitForTimeout(500); await p.screenshot({ path: `${D}/${String(++n).padStart(2, "0")}-${name}.png` }); };

for (const lang of ["en", "ru"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(800);
  await p.evaluate(async (lang) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); const r = g.generateDemoData("work-home");
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(r.newTrackers)); localStorage.setItem("memap_entries", JSON.stringify(r.newEntries));
    localStorage.setItem("memap_path_start", [...r.newEntries.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1");
    localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order", "report", "block:world", "block:you"]));
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(9) })); localStorage.setItem("memap_playful_asked", "seed");
    localStorage.setItem("memap_notification_enabled", "false");
    localStorage.setItem("memap_week_chests", JSON.stringify(Object.fromEntries(Array.from({ length: 9 }, (_, w) => [w, { openedAt: iso(1), lines: [], reward: "balloon" }]))));
  }, lang);
  await p.goto(URL); await p.waitForTimeout(1800);
  const openLamb = async () => { await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-you"))); await p.waitForTimeout(1200); };
  await openLamb();
  const lambText = await p.locator('[role="dialog"]').last().innerText();
  const weekHead = lang === "en" ? /this week|last 7 days/i : /эта неделя|последние 7 дней/i;
  const linksHead = lang === "en" ? /^LINKS$/m : /^СВЯЗИ$/m;
  check(`${lang}: the lamb's sheet has no week of dots and no links`, !weekHead.test(lambText) && !linksHead.test(lambText), lambText.slice(0, 300));
  await shot(p, `${lang}-lamb`);
  await p.locator('[role="dialog"] button').filter({ hasText: lang === "en" ? /^My questions/ : /^Мои вопросы/ }).first().click(); await p.waitForTimeout(1500);
  check(`${lang}: My questions has no reminder card`, (await p.locator("[data-notif-card]").count()) === 0);
  await shot(p, `${lang}-questions`);
  // a question: only its actions
  await p.locator('[data-coachmark="cards-list"] button, [data-coachmark="cards-list"] [role="button"]').filter({ hasText: /\?/ }).first().click(); await p.waitForTimeout(1200);
  const acts = await p.locator("[data-question-action]").evaluateAll((els) => els.map((e) => e.getAttribute("data-question-action")));
  const sheetText = await p.locator("[data-question-sheet]").innerText().catch(() => "");
  check(`${lang}: a question opens onto Edit, Archive, Delete`, acts.join() === "edit,archive,delete", acts);
  check(`${lang}: no limit and no month count on it`, !(lang === "en" ? /limit|\/ \d+/i : /лимит|\/ \d+/i).test(sheetText) && (await p.locator("[data-question-all]").count()) === 1, sheetText.slice(0, 200));
  await shot(p, `${lang}-question`);
  await p.locator('[data-question-action="edit"]').click(); await p.waitForTimeout(1200);
  check(`${lang}: Edit from here has no limit`, (await p.locator("#threshold").count()) === 0 && (await p.locator("#questionText").count()) === 1);
  await shot(p, `${lang}-edit`);
  // close the edit window and the question's sheet
  for (let k = 0; k < 3 && (await p.locator('[role="dialog"]').count()); k++) { await p.keyboard.press("Escape"); await p.waitForTimeout(700); }
  // Back: to the lamb
  await shot(p, `${lang}-before-back`);
  await p.locator("main button, button").filter({ hasText: lang === "en" ? /Back\s*$/ : /Назад\s*$/ }).first().click(); await p.waitForTimeout(1300);
  const lambAgain = await p.locator('[role="dialog"] button').filter({ hasText: lang === "en" ? /^My questions/ : /^Мои вопросы/ }).count();
  check(`${lang}: Back goes back to the lamb`, lambAgain === 1, lambAgain);
  await shot(p, `${lang}-back-to-lamb`);
  // "All about …" opens the page on the World
  await p.locator('[role="dialog"] button').filter({ hasText: lang === "en" ? /^My questions/ : /^Мои вопросы/ }).first().click(); await p.waitForTimeout(1500);
  await p.locator('[data-coachmark="cards-list"] button, [data-coachmark="cards-list"] [role="button"]').filter({ hasText: /\?/ }).first().click(); await p.waitForTimeout(1200);
  await p.locator("[data-question-all]").click(); await p.waitForTimeout(2600);
  check(`${lang}: "All about …" opens the question's page on the World`, (await p.locator("[data-thing]").count()) === 1);
  await shot(p, `${lang}-all-about`);
  await ctx.close();
}
await b.close();
console.log(JSON.stringify(out, null, 1));
if (errs.length) console.log("PAGE ERRORS:", errs.slice(0, 5));
process.exit(fails.length || errs.length ? 1 : 0);
