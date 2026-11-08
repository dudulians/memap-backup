// Her notes, Nov 6 2026: (1) the first step lets you pick several topics (up to 3);
// (2) after "Your world has begun" the app shows Today and its steps, then the World;
// (3) the tour walks the 4-part row left to right, no jump to the map and back.
// Paths: evening, 3 topics (+ a 4th refused) → questions → first check-in → tour;
// daytime "tonight" with 2 topics + her own question → "Your world is waiting" → tour.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
// variant A (Nov 7 2026): "What brings you here?", then the islands open to show their topics
const whyStep = async (p, good = false) => {
  await p.getByRole("button", { name: good ? /more good days|хороших дней/i : /bothering me|повторяется и мешает/i }).first().click(); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelectorAll(".onb [aria-expanded=false]").forEach((b) => b.click())); await p.waitForTimeout(400);
};
const D = `./aurora-tests/work/r56`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
const lang = process.argv[2] ?? "en", RU = lang === "ru";
const W = (en, ru) => (RU ? ru : en);

for (const run of ["evening", "daytime"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(`${run}: ${e.message}`)); p.on("console", (m) => m.type() === "error" && errs.push(`${run}: ${m.text()}`));
  let n = 0;
  const shot = async (name) => { await p.waitForTimeout(600); await p.screenshot({ path: `${D}/${lang}-${run}-${String(++n).padStart(2, "0")}-${name}.png` }); };
  const click = async (re) => { await p.getByRole("button", { name: re }).first().click(); await p.waitForTimeout(450); };
  const at = () => { const d = new Date(); d.setHours(run === "evening" ? 19 : 11, 0, 0, 0); return d; };
  await p.clock.install({ time: at() });
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate((lang) => { localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_theme", "aurora-light"); }, lang);
  await p.reload(); await p.waitForTimeout(2200);
  const log = [];
  await click(W(/^Get started/, /^Начать/)); await whyStep(p);
  if (run === "evening") {
    await click(W(/Migraine/, /Мигрен/)); await click(W(/Bad nights|Sleep/, /Плохие ночи|Сон/)); await click(W(/^Stress/, /^Стресс/));
    await click(W(/^Period|cycle/i, /Месячн|цикл/i));
    log.push({ topicsTicked: await p.locator("[aria-pressed=true]").count(), hint: await p.locator(".onb h1 + p").innerText() });
    await shot("topics-3");
  } else {
    await click(W(/Low energy/, /Мало энергии/));
    await click(W(/quitting/i, /уволит/i));
    await click(W(/Write your own question/, /Свой вопрос/));
    await p.locator("input").first().fill(W("Did I take a proper lunch break?", "Удалось нормально пообедать?"));
    await shot("own");
    await click(W(/^Continue/, /^Дальше|^Продолжить/));
    log.push({ backOnTopics: await p.locator(".onb h1").innerText(), ticked: await p.locator("[aria-pressed=true]").allInnerTexts() });
    await shot("topics-own");
  }
  await click(W(/^Continue/, /^Дальше|^Продолжить/)); await p.waitForTimeout(500);
  log.push({ questions: await p.evaluate(() => [...document.querySelectorAll(".pick-on")].map((x) => x.innerText.replace(/\s+/g, " ").slice(0, 90))) });
  await shot("questions");
  await p.evaluate(() => window.scrollTo(0, 9999)); await p.locator(".onb .overflow-y-auto").evaluate((e) => e.scrollTo(0, 9999)).catch(() => {});
  await shot("questions-bottom");
  await click(W(/^Continue/, /^Дальше|^Продолжить/)); await p.waitForTimeout(800);
  await click(W(/Answer today's questions/, /Ответить на вопросы/)); await p.waitForTimeout(900);
  if (run === "daytime") { await click(W(/Tonight|this evening/, /Сегодня вечером|Вечером|вечером/)); await click(W(/^Continue/, /^Дальше|^Продолжить/)); await p.waitForTimeout(1500); }
  else {
    await p.waitForTimeout(1000);
    for (let i = 0; i < 14; i++) {
      const tgt = p.getByRole("button", { name: i % 2 ? W(/^No$/, /^Нет$/) : W(/^Yes$/, /^Да$/) }).last();
      if (!(await tgt.isVisible().catch(() => false))) break;
      if (!(await tgt.click({ timeout: 3000 }).then(() => true).catch(() => false))) break; await p.waitForTimeout(650);
    }
    await p.waitForTimeout(1200);
  }
  await shot("ending");
  log.push({ ending: await p.evaluate(() => document.querySelector("[role=dialog]")?.innerText.replace(/\s+/g, " ").slice(0, 200)) });
  // "Show me around" (the reminder is asked first if it wasn't)
  const nn = p.getByRole("button", { name: W(/^Not now/, /^Не сейчас/) });
  if (await nn.count() && await nn.first().isVisible().catch(() => false)) { await shot("reminder-auto"); await nn.first().click(); await p.waitForTimeout(600); }
  const around = p.getByRole("button", { name: W(/Show me around/, /Покажи, что где/) });
  if (await around.count()) { await around.first().click(); await p.waitForTimeout(700); }
  const notNow = p.getByRole("button", { name: W(/^Not now/, /^Не сейчас/) });
  if (await notNow.count() && await notNow.first().isVisible().catch(() => false)) { await shot("reminder"); await notNow.first().click(); }
  await p.waitForTimeout(1800);
  const stops = [];
  for (let k = 0; k < 14 && await p.locator("[data-tour-card]").count(); k++) {
    await p.waitForTimeout(1300);
    await shot(`tour${k}`);
    stops.push(await p.evaluate(() => {
      const ring = document.querySelector(".tour-ring"), r = ring?.getBoundingClientRect();
      return { card: document.querySelector("[data-tour-card]")?.innerText.replace(/\s+/g, " ").slice(0, 110), hole: r ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null, tab: document.querySelector("nav [aria-current=page]")?.textContent, scroll: (() => { const m = document.querySelector("main"); const c = document.querySelector(".path-node.disc-current"); return m ? [Math.round(m.scrollTop), m.scrollHeight, m.clientHeight, c ? Math.round(c.getBoundingClientRect().top) : null, getComputedStyle(m).overflowY] : null; })() };
    }));
    await p.locator("[data-tour-card] button").last().click();
  }
  await p.waitForTimeout(1500);
  await shot("after-tour");
  log.push({ stops, after: await p.evaluate(() => ({ tab: document.querySelector("nav [aria-current=page]")?.textContent, start: document.querySelector(".path-start")?.textContent, door: localStorage.getItem("memap_door") })) });
  out[run] = log;
  await ctx.close();
}
console.log(JSON.stringify({ out, errs }, null, 1));
await b.close();
