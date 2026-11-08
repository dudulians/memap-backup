// QA (Nov 8 2026): a brand-new person walks onboarding → first answers → Today, every screen
// photographed and its text dumped. Saves the end state for qa-new-path.mjs.
// usage: node aurora-tests/qa-new-onb.mjs <tag> <lang en|ru> <hour> <theme aurora-light|aurora> <tone bother|good> <day yesterday|tonight> <topics comma-separated regex>
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "fs";
const [tag = "s1", lang = "en", hourS = "10", theme = "aurora-light", tone = "bother", day = "yesterday", topicsS = "Headaches$,Anxiety,Bedtime struggles,Too much screen time"] = process.argv.slice(2);
const hour = Number(hourS), RU = lang === "ru";
const D = `./aurora-tests/work/qa-new`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], log = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, locale: RU ? "ru-RU" : "en-US", timezoneId: RU ? "Europe/Moscow" : "Asia/Dubai" });
const p = await ctx.newPage();
p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && !/InAppReview|favicon|Failed to load resource/.test(m.text()) && errs.push(m.text()));
const at = (h) => { const d = new Date(); d.setHours(h, 5, 0, 0); return d; };
await p.clock.install({ time: at(hour) });
await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
await p.evaluate(({ theme, lang }) => { localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_theme", theme); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1"); }, { theme, lang });
await p.reload(); await p.waitForTimeout(2400);
let n = 0;
const audit = () => p.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.opacity !== "0"; };
  const fonts = new Set(), cut = [], off = [];
  for (const e of document.querySelectorAll("body *")) {
    if (!vis(e)) continue;
    const own = [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
    if (!own) continue;
    const s = getComputedStyle(e);
    fonts.add(s.fontFamily.split(",")[0].replace(/"/g, "").trim());
    if ((s.overflow.includes("hidden") || s.textOverflow === "ellipsis" || s.overflowX === "hidden") && (e.scrollWidth > e.clientWidth + 2 || e.scrollHeight > e.clientHeight + 4)) cut.push(e.textContent.trim().slice(0, 60));
    const r = e.getBoundingClientRect(); if (r.right > window.innerWidth + 2 || r.left < -2) off.push(e.textContent.trim().slice(0, 50));
  }
  const dialogs = [...document.querySelectorAll("[role=dialog]")].filter(vis).map((d) => d.innerText.replace(/\s+/g, " ").slice(0, 600));
  return { text: document.body.innerText.replace(/\s+/g, " ").slice(0, 1500), dialogs, fonts: [...fonts], cut: cut.slice(0, 10), off: off.slice(0, 10), buttons: [...document.querySelectorAll("button")].filter(vis).map((x) => (x.innerText || x.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 40) };
});
const shot = async (name, full = false) => {
  await p.waitForTimeout(700);
  const file = `${D}/${tag}-${String(++n).padStart(2, "0")}-${name}.png`;
  await p.screenshot({ path: file, fullPage: full });
  log.push({ shot: file.split("/").pop(), ...(await audit().catch((e) => ({ auditErr: e.message }))) });
};
const btn = (re) => p.getByRole("button", { name: re }).first();
const tryClick = async (re, wait = 600) => { const x = btn(re); if (await x.isVisible().catch(() => false)) { await x.click().catch(() => {}); await p.waitForTimeout(wait); return true; } return false; };
const T = RU
  ? { start: /^Начать/, cont: /^Дальше|^Продолжить/, answer: /Ответить на вопросы/, notNow: /Не сейчас/, see: /Покажи, что где/, yes: /^Да$/, no: /^Нет$/, why: tone === "good" ? /хороших дней/i : /повторяется и мешает/i, yesterday: /За вчера|Вчера/, tonight: /Вечером|вечером|Сегодня/ }
  : { start: /^Get started/, cont: /^Continue/, answer: /Answer .*questions/, notNow: /^Not now/, see: /Show me around/, yes: /^Yes$/, no: /^No$/, why: tone === "good" ? /more good days/i : /bothering me/i, yesterday: /^Yesterday/, tonight: /^Tonight|this evening/ };

p.on("framenavigated", (f) => f === p.mainFrame() && errs.push("NAVIGATED " + f.url()));
try {
await shot("welcome");
// the language globe on the welcome page
if (await tryClick(/language|язык/i, 500)) { await shot("welcome-lang"); await p.keyboard.press("Escape"); await p.waitForTimeout(400); }
await btn(T.start).click(); await p.waitForTimeout(700);
await shot("why");
await btn(T.why).click(); await p.waitForTimeout(700);
await shot("islands-closed");
await p.evaluate(() => document.querySelectorAll(".onb [aria-expanded=false]").forEach((b) => b.click())); await p.waitForTimeout(500);
await shot("islands-open");
await shot("islands-open-full", true);
for (const t of topicsS.split(",")) {
  const x = p.getByRole("button", { name: new RegExp(t, "i") }).first();
  await x.scrollIntoViewIfNeeded().catch(() => {});
  await x.click().catch((e) => log.push({ pickErr: t, e: e.message.slice(0, 120) }));
  await p.waitForTimeout(400);
}
await shot("topics-picked");
await p.locator(".onb-scroll").first().evaluate((e) => e.scrollTo(0, 0)).catch(() => {});
await shot("topics-picked-top");
await btn(T.cont).click(); await p.waitForTimeout(900);
await shot("questions");
await p.locator(".onb-scroll").first().evaluate((e) => e.scrollTo(0, 9999)).catch(() => {});
await shot("questions-bottom");
await btn(T.cont).click(); await p.waitForTimeout(900);
await shot("value");
await p.locator(".onb-scroll").first().evaluate((e) => e.scrollTo(0, 9999)).catch(() => {});
await shot("value-bottom");
await btn(T.answer).click(); await p.waitForTimeout(900);
await shot("after-answer-btn");
if (hour < 17) {
  const sh = p.locator(".onb [role=dialog], div.fixed.inset-0.items-end").last();
  await sh.getByRole("button", { name: day === "yesterday" ? T.yesterday : T.tonight }).first().click(); await p.waitForTimeout(400);
  await shot("which-day-picked");
  await sh.getByRole("button", { name: T.cont }).first().click(); await p.waitForTimeout(1800);
}
await shot("first-card");
// answer the cards: Yes, No alternating; photograph each
for (let i = 0; i < 16; i++) {
  const yes = p.getByRole("button", { name: T.yes }).last(), no = p.getByRole("button", { name: T.no }).last();
  if (!(await yes.isVisible().catch(() => false)) && !(await no.isVisible().catch(() => false))) {
    // a follow-up with other buttons? photograph and try Continue/Skip
    await shot(`card${i}-other`);
    if (!(await tryClick(/^Skip|^Пропустить|^Continue|^Дальше|^Next/))) break; continue;
  }
  if (i > 0) await shot(`card${i}`);
  const target = i % 2 ? no : yes;
  if (!(await target.click({ timeout: 3000 }).then(() => true).catch(() => false))) break;
  await p.waitForTimeout(800);
}
await p.waitForTimeout(1500); await shot("after-answers");
await p.waitForTimeout(2000); await shot("after-answers-2");
for (let k = 0; k < 6; k++) {
  // reminder / world moment / anything modal: photograph, then the softest way out
  const dlg = await p.locator("[role=dialog]").count();
  if (!dlg) break;
  await shot(`modal${k}`);
  if (await tryClick(T.notNow, 900)) continue;
  if (await tryClick(RU ? /^Дальше|^Продолжить|Посмотреть|Готово/ : /^Continue|^See |^Done|^Got it/, 900)) continue;
  break;
}
await shot("before-tour");
// Show me around → tour to the end
log.push({ around: await p.getByRole("button", { name: T.see }).count() });
if (await tryClick(T.see, 1500)) {
  for (let k = 0; k < 16; k++) {
    await p.waitForTimeout(1300);
    if (!(await p.locator("[data-tour-card]").count())) { await shot(`tour-gone${k}`); break; }
    await shot(`tour${k}`);
    log.push({ tourCard: await p.evaluate(() => document.querySelector("[data-tour-card]")?.innerText.replace(/\s+/g, " ")) });
    await p.locator("[data-tour-card] button").last().click().catch(() => {});
  }
}
await p.waitForTimeout(1500);
for (let k = 0; k < 4; k++) { if (!(await tryClick(RU ? /^Не сейчас$|^Пропустить$|^Закрыть$/ : /^(Not now|Skip|Close)$/, 900))) break; }
await shot("today");
await shot("today-full", true);
const state = await ctx.storageState();
writeFileSync(`${D}/${tag}-state.json`, JSON.stringify(state));
log.push({ model: await p.evaluate(async () => {
  const ps = await import("/src/lib/pathSteps.ts"), s = await import("/src/lib/storage.ts");
  const T = await s.getTrackers(), E = await s.getEntries(); const m = ps.pathModel(T, E);
  return { trackers: T.filter((t) => !t.archived).map((t) => t.title), entries: E.map((e) => `${e.date}:${e.value}`), steps: m.steps.map((x) => `${x.id}${x.done ? "✓" : ""}`), week: m.week, streak: m.streak, keys: Object.keys(localStorage) };
}).catch((e) => e.message) });
} catch (e) { errs.push("SCRIPT: " + e.message.slice(0, 300)); await shot("crash").catch(() => {}); }
writeFileSync(`${D}/${tag}-log.json`, JSON.stringify({ log, errs }, null, 1));
console.log(`done ${tag}: ${n} shots, ${errs.length} errors`);
await ctx.close(); await b.close();
