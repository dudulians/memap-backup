// Day 1, guided (her notes, Nov 5 2026): a brand-new person finishes onboarding
// (Migraines, "Yesterday") and follows the highlight on Today, step by step:
//   - "A bit of everything" has more than 2 questions
//   - "Write a note": Go, then close without writing → the highlight moves on, no note again
//   - she adds questions mid-day → one "New questions" step at the boat, never back
//   - the end: "Done for today" lights up, its card offers bubbles / questions / links / calendar
// A picture after every move; the path's steps as the model sees them; errors.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
// variant A (Nov 7 2026): "What brings you here?", then the islands open to show their topics
const whyStep = async (p, good = false) => {
  await p.getByRole("button", { name: good ? /more good days|хороших дней/i : /bothering me|повторяется и мешает/i }).first().click(); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelectorAll(".onb [aria-expanded=false]").forEach((b) => b.click())); await p.waitForTimeout(400);
};
const D = `./aurora-tests/work/r34v7`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], log = [];
const lang = process.argv[2] ?? "en";
const RU = lang === "ru";
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const p = await ctx.newPage();
p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
let n = 0;
const shot = async (name) => { await p.waitForTimeout(700); await p.screenshot({ path: `${D}/${lang}-${String(++n).padStart(2, "0")}-${name}.png` }); };
const click = async (re) => { await p.getByRole("button", { name: re }).first().click(); };

// --- onboarding v7 (Nov 6 2026): migraine door, tonight's first check-in --------
const at19 = () => { const d = new Date(); d.setHours(19, 0, 0, 0); return d; };
await p.clock.install({ time: at19() });
await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
await p.evaluate(({ lang, theme }) => { localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_theme", theme); }, { lang, theme: process.argv[3] || "aurora-light" });
await p.reload(); await p.waitForTimeout(2200);
await click(RU ? /^Начать/ : /^Get started/); await p.waitForTimeout(500); await whyStep(p);
await click(RU ? /Мигрен/ : /Migraine/); await click(RU ? /^Дальше|^Продолжить/ : /^Continue/); await p.waitForTimeout(600);
await click(RU ? /^Дальше|^Продолжить/ : /^Continue/); await p.waitForTimeout(600);
await click(RU ? /Ответить на вопросы за сегодня/ : /Answer today's questions/); await p.waitForTimeout(1800);
for (let i = 0; i < 8; i++) {
  const target = p.getByRole("button", { name: i % 2 ? (RU ? /^Нет$/ : /^No$/) : (RU ? /^Да$/ : /^Yes$/) }).last();
  if (!(await target.isVisible().catch(() => false))) break;
  if (!(await target.click({ timeout: 3000 }).then(() => true).catch(() => false))) break; await p.waitForTimeout(650);
}
await p.waitForTimeout(3200);
await click(RU ? /Не сейчас/ : /Not now/).catch(() => {}); await p.waitForTimeout(600);
await click(RU ? /Покажи, что где/ : /Show me around/).catch(() => {}); await p.waitForTimeout(700);
await click(RU ? /Не сейчас/ : /Not now/).catch(() => {}); await p.waitForTimeout(2200);
await click(RU ? /Пропустить/ : /^Skip/).catch(() => {}); await p.waitForTimeout(1500);
await p.locator("nav button").nth(0).click(); await p.waitForTimeout(1500);

// --- what the path holds ----------------------------------------------------------
const model = async () => p.evaluate(async () => {
  const ps = await import("/src/lib/pathSteps.ts");
  const T = JSON.parse(localStorage.getItem("memap_trackers") || "[]"), E = JSON.parse(localStorage.getItem("memap_entries") || "[]");
  const byId = new Map(T.map((t) => [t.id, t.title]));
  const m = ps.pathModel(T, E);
  return m.steps.map((s, i) => `${i === m.current ? "▶ " : ""}${s.id}${s.done ? " ✓" : ""}${s.skipped ? " (skipped)" : ""}${s.trackerIds.length && s.kind === "questions" ? " [" + s.trackerIds.map((id) => byId.get(id)).join(" | ") + "]" : ""}`);
});
const here = async () => p.evaluate(() => {
  const b = document.querySelector(".path-start");
  return b ? (b.getAttribute("aria-label") || b.textContent) : "NO START BUBBLE";
});
const toTop = async () => { await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300); };
const answerDeck = async () => {
  for (let k = 0; k < 24; k++) {
    const no = p.getByRole("button", { name: RU ? /^Нет$/ : /^No$/ }), yes = p.getByRole("button", { name: RU ? /^Да$/ : /^Yes$/ });
    if (!(await no.count()) || !(await no.first().isVisible().catch(() => false))) break;
    await (k % 3 === 1 ? yes : no).first().click(); await p.waitForTimeout(700);
  }
  await p.waitForTimeout(900);
  await shot("deck-end");
  const end = p.getByRole("button", { name: RU ? /Назад|Вернуться|Дальше|Готово/ : /Back to Today|Continue|Done|Next/ });
  if (await end.count()) await end.last().click().catch(() => {});
  await p.waitForTimeout(1500);
};

log.push({ after: "onboarding", start: await here(), steps: await model(), tasks: await p.evaluate(() => localStorage.getItem("memap_path_tasks")) });
await shot("today");

let addedOnce = false;
for (let move = 0; move < 18; move++) {
  const at = await here();
  if (at === "NO START BUBBLE") { log.push({ move, note: "no start bubble" }); break; }
  if (/Done for today|What's next|На сегодня всё|Что дальше/.test(at)) {
    await p.locator(".path-start").first().click(); await p.waitForTimeout(900);
    await shot("end-card");
    log.push({ move, end: await p.evaluate(() => document.querySelector(".path-bubble")?.innerText.replace(/\s+/g, " ") ?? "NO CARD") });
    break;
  }
  await p.locator(".path-start").first().click(); await p.waitForTimeout(1300);
  await shot(`move${move}`);
  const kind = await p.evaluate(() => document.querySelector("textarea") ? "note" : document.body.innerText.match(/Your hunch|Твоя догадка|Догадка/) ? "hunch" : "other");
  // "Look around": the tour of the real pages, stop by stop
  if (await p.locator("[data-tour-card]").count()) {
    const stops = [];
    for (let k = 0; k < 12 && await p.locator("[data-tour-card]").count(); k++) {
      await p.waitForTimeout(1100);
      await shot(`tour${k}`);
      stops.push(await p.evaluate(() => ({ card: document.querySelector("[data-tour-card]")?.innerText.replace(/\s+/g, " ").slice(0, 120), lit: !!document.querySelector(".tour-hole"), tab: document.querySelector("nav [aria-current=page]")?.textContent })));
      await p.locator("[data-tour-card] button").last().click();
    }
    await p.waitForTimeout(1200); await toTop();
    log.push({ move, tour: stops, next: await here(), steps: await model() });
    await shot(`after${move}`);
    continue;
  }
  const hasDeck = await p.getByRole("button", { name: RU ? /^Нет$/ : /^No$/ }).first().isVisible().catch(() => false);
  const discover = p.getByRole("dialog").getByRole("button", { name: RU ? /^Дальше/ : /^Next/ });
  const isDiscover = !hasDeck && await discover.first().isVisible().catch(() => false);
  if (isDiscover) {
    log.push({ move, discover: await p.evaluate(() => document.querySelector("[role=dialog]")?.innerText.replace(/\s+/g, " ")) });
    await discover.first().click(); await p.waitForTimeout(1200);
  }
  else if (hasDeck) await answerDeck();
  else if (kind === "note") { await p.keyboard.press("Escape"); await p.waitForTimeout(1200); }
  else {
    // a game or a tab: skip it, back to Today
    const skip = p.getByRole("button", { name: RU ? /Не сегодня|Пропустить/ : /Not today|Skip/ });
    if (await skip.count()) await skip.last().click().catch(() => {});
    else await p.keyboard.press("Escape");
    await p.waitForTimeout(1000);
    const today = p.getByRole("tab", { name: RU ? /Сегодня/ : /Today/ });
    if (await today.count()) await today.first().click().catch(() => {});
    await p.waitForTimeout(1200);
  }
  await toTop();
  log.push({ move, did: at, kind: hasDeck ? "deck" : isDiscover ? "discover" : kind, next: await here(), steps: await model() });
  await shot(`after${move}`);
  // after the first answered step she adds two questions (one to an island already done)
  if (!addedOnce && hasDeck) {
    addedOnce = true;
    await p.evaluate(async () => { const d = await import("/src/lib/doors.ts"); await d.ensureTemplates(["headache", "exercised"]); });
    await p.reload(); await p.waitForTimeout(2400);
    log.push({ after: "added 2 questions", start: await here(), steps: await model() });
    await shot("added");
  }
}
log.push({ tasks: await p.evaluate(() => localStorage.getItem("memap_path_tasks")) });
console.log(JSON.stringify({ log, errs }, null, 1));
await b.close();
