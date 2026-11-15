// r172 (Nov 15 2026, branch design/one-system): onboarding as she picked it on boards D and E.
// 1. What MeMap will show comes right after the welcome, before any topic, with a plain "Continue".
// 2. One step per topic: "Your topic 1 of 2", where it goes ("Goes to your … island"), what 10 evenings show,
//    two questions that could show it ("Could show if …"), none ticked for her; "Next: <topic>"; the last one starts
//    ("Start with yesterday" in the daytime, "Tonight instead" under it).
// 3. Only what she added is saved: two topics + the one she added = 3 questions.
// 4. "Your world has begun" shows her islands on a globe; "Show me around" goes straight to the tour (no reminder first).
// Run from marketing/tools with the dev server on 8080; exit 1 when a check fails.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r172`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const check = (name, ok, info) => { out[name] = ok ? "ok" : `FAIL ${info !== undefined ? JSON.stringify(info).slice(0, 400) : ""}`; if (!ok) fails.push(name); };
for (const lang of ["en", "ru"]) {
  const RU = lang === "ru", W = (en, ru) => (RU ? ru : en);
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  let n = 0; const shot = async (name) => { await p.waitForTimeout(400); await p.screenshot({ path: `${D}/${lang}-${String(++n).padStart(2, "0")}-${name}.png` }); };
  const click = async (re) => { await p.getByRole("button", { name: re }).first().click(); await p.waitForTimeout(500); };
  const t11 = new Date(); t11.setHours(11, 0, 0, 0);
  await p.clock.install({ time: t11 });
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate((lang) => { localStorage.clear(); localStorage.setItem("memap_ab_onb_preview", "A"); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light"); }, lang);
  await p.reload(); await p.waitForTimeout(2200);
  await click(W(/^Get started/, /^Начать/));
  // 1. value first
  const h1 = await p.locator(".onb h1").first().innerText();
  check(`${lang}: the value comes first`, W(/What MeMap will show you/, /Что покажет MeMap/).test(h1) && (await p.locator("[data-onb-value] > div").count()) === 4 && (await p.locator("[data-onb-example]").count()) === 4, h1);
  await shot("value");
  await click(W(/^Continue/, /^Дальше|^Продолжить/));
  // A: what brings you here, then the topics
  await p.getByRole("button", { name: W(/bothering me/i, /повторяется и мешает/i) }).first().click(); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelectorAll(".onb [aria-expanded=false]").forEach((x) => x.click())); await p.waitForTimeout(400);
  await click(W(/Migraine/, /Мигрен/)); await click(W(/Fights with my partner/, /Ссоры с партнёром/));
  await shot("topics");
  await click(W(/^Continue/, /^Дальше|^Продолжить/)); await p.waitForTimeout(500);
  // 2. one step per topic
  const page = async () => p.evaluate(() => ({
    h1: document.querySelector(".onb h1")?.textContent, island: document.querySelector("[data-onb-island]")?.textContent, ten: document.querySelector("[data-onb-in-ten]")?.textContent,
    offers: [...document.querySelectorAll("[data-onb-offer]")].map((o) => ({ id: o.getAttribute("data-onb-offer"), on: o.querySelector("[aria-pressed]")?.getAttribute("aria-pressed"), text: o.innerText.replace(/\s+/g, " ") })),
  }));
  const p1 = await page();
  out[`${lang} step 1`] = p1;
  check(`${lang}: "Your topic 1 of 2"`, W(/Your topic 1 of 2/, /Твоя тема 1 из 2/).test(p1.h1 ?? ""), p1.h1);
  check(`${lang}: it says which island it goes to`, W(/Goes to your .+ island/, /Попадёт на остров «.+»/).test(p1.island ?? ""), p1.island);
  check(`${lang}: it says what 10 evenings show`, W(/You'll see what comes on the days /, /Увидишь, что бывает в дни, когда /).test(p1.ten ?? ""), p1.ten);
  check(`${lang}: two offers, none ticked for her`, p1.offers.length === 2 && p1.offers.every((o) => o.on === "false"), p1.offers);
  check(`${lang}: each offer says what it could show`, p1.offers.every((o) => W(/Could show/i, /Может показать/i).test(o.text)), p1.offers.map((o) => o.text));
  await shot("topic-1");
  await p.locator(`[data-onb-offer="${p1.offers[0].id}"] [aria-pressed]`).click(); await p.waitForTimeout(300);
  check(`${lang}: + Add adds it`, (await p.locator(`[data-onb-offer="${p1.offers[0].id}"] [aria-pressed]`).getAttribute("aria-pressed")) === "true");
  const next = await p.getByRole("button", { name: W(/^Next: /, /^Дальше: /) }).first().innerText();
  check(`${lang}: the button names the next topic`, W(/Next: Fights with my partner/, /Дальше: Ссоры с партнёром/).test(next), next);
  await p.getByRole("button", { name: W(/^Next: /, /^Дальше: /) }).first().click(); await p.waitForTimeout(600);
  const p2 = await page();
  out[`${lang} step 2`] = p2;
  check(`${lang}: "Your topic 2 of 2"`, W(/Your topic 2 of 2/, /Твоя тема 2 из 2/).test(p2.h1 ?? ""), p2.h1);
  check(`${lang}: the second topic offers other questions`, p2.offers.every((o) => !p1.offers.some((x) => x.id === o.id)), [p1.offers.map((o) => o.id), p2.offers.map((o) => o.id)]);
  check(`${lang}: daytime: start with yesterday, or tonight`, (await p.getByRole("button", { name: W(/Start with yesterday/, /Начать со вчера/) }).count()) === 1 && (await p.getByRole("button", { name: W(/Tonight instead/, /Лучше вечером/) }).count()) === 1);
  await shot("topic-2");
  await click(W(/Start with yesterday/, /Начать со вчера/)); await p.waitForTimeout(1500);
  // 3. what was saved
  const saved = await p.evaluate(() => ({ n: JSON.parse(localStorage.getItem("memap_trackers") || "[]").filter((t) => !t.archived).length, day: localStorage.getItem("memap_first_day_pick") }));
  check(`${lang}: two topics and the one she added are saved`, saved.n === 3 && saved.day === "yesterday", saved);
  await shot("first-checkin");
  // 4. "Your world has begun": her islands; the tour straight away (the check-in sheet closed first, as after answering)
  await p.keyboard.press("Escape"); await p.waitForTimeout(800);
  await p.evaluate(async () => {
    const st = await import("/src/lib/storage.ts"); const dz = await import("/src/lib/doors.ts");
    const tr = await st.getTrackers(); const d = new Date(); d.setDate(d.getDate() - 1); const y = dz.isoLocal(d);
    await st.saveEntries(tr.map((t, i) => ({ id: `e${i}`, trackerId: t.id, date: y, value: i % 2 === 0, createdAt: d.toISOString() })));
    document.querySelectorAll("[role=dialog] button[aria-label]").forEach(() => undefined);
    window.dispatchEvent(new CustomEvent("memap-world-begun", { detail: { date: y } }));
  });
  await p.waitForTimeout(2200);
  check(`${lang}: "Your world has begun" shows her islands on a globe`, (await p.locator("[data-begun-globe]").count()) === 1);
  await shot("begun");
  await p.locator("button", { hasText: W(/Show me around/, /Покажи, что где/) }).first().click(); await p.waitForTimeout(2500);
  const remind = await p.locator("button", { hasText: W(/^Not now/, /^Не сейчас/) }).count();
  check(`${lang}: no reminder before the tour`, remind === 0 && (await p.locator("[data-tour-card]").count()) === 1, { remind });
  await shot("tour");
  await ctx.close();
}
console.log(JSON.stringify({ ...out, errs }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
