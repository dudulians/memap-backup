// v112 (her "Yes, build A/B/C", Nov 8 2026): three onboardings for new installs.
// A = What brings you here? → topics of that tone → questions → what you'll discover → answers → "begun" → tour.
// B = all topics at once (no first door), the rest as A. C = all topics → answers → a reminder; no tour, hints instead.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r89`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const out = {}, errs = [];
const RUNS = [["A", "en", 20], ["B", "en", 20], ["C", "en", 20], ["C", "ru", 15], ["B", "ru", 20]];
for (const [v, lang, hour] of RUNS) {
  const tag = `${v}-${lang}-${hour}h`;
  const o = (out[tag] = {});
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${tag}: ${e.message}`));
  const logs = []; p.on("console", (m) => { const s = m.text(); if (s.includes("[analytics:")) logs.push(s); });
  await p.clock.install({ time: new Date(`2026-11-08T${String(hour).padStart(2, "0")}:10:00`) });
  let n = 0; const shot = async (name) => { await p.waitForTimeout(500); await p.screenshot({ path: `${D}/${tag}-${++n}-${name}.png` }); };
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  await p.evaluate(([lang, v]) => { localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_theme", "aurora-light"); localStorage.setItem("memap_ab_onb", v); }, [lang, v]);
  logs.length = 0;
  await p.reload(); await p.waitForTimeout(2200);
  o.registered = logs.filter((l) => l.includes("onb_variant")).map((l) => l.replace(/^.*would-register\]\s*/, ""));
  await p.getByRole("button", { name: lang === "ru" ? /^Начать/ : /^Get started/ }).first().click(); await p.waitForTimeout(700);
  if (v === "A") { await shot("why"); await p.getByRole("button", { name: /bothering me|повторяется и мешает/i }).click(); await p.waitForTimeout(700); }
  o.topicTitle = await p.locator(".onb h1").first().innerText();
  o.dots = await p.locator(".onb [aria-hidden=true] > span.rounded-full").count();
  o.islands = await p.locator(".onb [aria-expanded]").count();
  await shot("topics");
  const isl = (re) => p.getByRole("button", { name: re }).first();
  await isl(/^Health|^Здоровье/).click(); await p.waitForTimeout(300);
  o.healthChips = await p.locator(".onb .flex-wrap [aria-pressed]").count();
  await p.locator(".onb .flex-wrap [aria-pressed=false]").first().click();
  await isl(/^Mind & mood|^Настроение/).click(); await p.waitForTimeout(300);
  await isl(/^Health|^Здоровье/).click(); await p.waitForTimeout(300); await p.locator(".onb .flex-wrap [aria-pressed=false]").first().click();
  o.picked = await p.locator(".onb .flex-wrap [aria-pressed=true]").allInnerTexts();
  await shot("topics-picked");
  await p.getByRole("button", { name: /^Continue|^Дальше|^Продолжить/ }).first().click(); await p.waitForTimeout(1200);
  if (v !== "C") {
    o.questionsTitle = await p.locator(".onb h1").first().innerText();
    await shot("questions");
    await p.getByRole("button", { name: /^Continue|^Дальше|^Продолжить/ }).first().click(); await p.waitForTimeout(900);
    o.valueTitle = await p.locator(".onb h1").first().innerText();
    await shot("value");
    await p.locator(".onb button.raised-btn").last().click(); await p.waitForTimeout(800);
  }
  o.onboardingGone = (await p.locator(".onb").count()) === 0;
  await p.waitForTimeout(900);
  await shot("first-answers");
  // answer every card: Yes, one No
  for (let i = 0; i < 14; i++) {
    const btn = p.getByRole("button", { name: i === 1 ? /^No$|^Нет$/ : /^Yes$|^Да$/ }).last();
    if (!(await btn.isVisible().catch(() => false))) break;
    await btn.click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(650);
  }
  await p.waitForTimeout(2600);
  const body = async () => (await p.locator("body").innerText()).replace(/\s+/g, " ");
  o.afterAnswers = (await body()).slice(0, 220);
  o.begunScreen = /Your world has begun|Твой мир появился/.test(await body());
  o.reminder = /When should we remind you|Когда напомнить/i.test(await body());
  await shot("after-answers");
  // not now
  const notNow = p.getByRole("button", { name: /^Not now$|^Не сейчас$/ }).first();
  if (await notNow.isVisible().catch(() => false)) { await notNow.click(); await p.waitForTimeout(900); }
  // A/B: "Show me around" → the tour
  const around = p.getByRole("button", { name: /Show me around|Покажи|Осмотреться/i }).first();
  if (await around.isVisible().catch(() => false)) { await around.click(); await p.waitForTimeout(1500); }
  o.tourOn = await p.getByRole("button", { name: /^Skip$|^Пропустить$/ }).first().isVisible().catch(() => false);
  await shot("today");
  o.steps = await p.evaluate(async () => {
    const st = await import("/src/lib/storage.ts"), ps = await import("/src/lib/pathSteps.ts");
    const m = ps.pathModel(await st.getTrackers(), await st.getEntries());
    return m.steps.map((s) => s.id);
  });
  o.trackers = await p.evaluate(async () => (await (await import("/src/lib/storage.ts")).getTrackers()).length);
  if (v === "C") {
    o.stepsTip = /Today's steps|Шаги на сегодня/.test(await body());
    // World: the globe says what it is, once
    await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns" } }))); await p.waitForTimeout(1800);
    o.worldTip = /Every topic is an island|Каждая тема — остров/.test(await body());
    await shot("world");
  }
  await ctx.close();
}
console.log(JSON.stringify({ out, errs }, null, 1));
await b.close();
