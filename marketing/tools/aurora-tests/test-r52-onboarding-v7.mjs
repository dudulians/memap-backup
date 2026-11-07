// Onboarding v7 in the app (Nov 6 2026, boards 70–75): a brand-new person, every path.
//   A  migraine, evening (19:00), EN, day theme       → first check-in → world begun → reminder: Not now
//   B  migraine, daytime (10:00), EN → Yesterday       → check-in for yesterday → world begun
//   C  energy-ish "start simple", daytime → Tonight    → "Your world is waiting"
//   D  own question, evening, RU, night theme         → world begun
//   E  migraine, evening, every card "Not sure"        → "Nothing saved"
//   F  More topics → Thinking of quitting, evening    → neutral main question
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
// variant A (Nov 7 2026): "What brings you here?", then the islands open to show their topics
const whyStep = async (p, good = false) => {
  await p.getByRole("button", { name: good ? /more good days|хороших дней/i : /bothering me|повторяется и мешает/i }).first().click(); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelectorAll(".onb [aria-expanded=false]").forEach((b) => b.click())); await p.waitForTimeout(400);
};
const D = `./aurora-tests/work/r52`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
const at = (h) => { const d = new Date(); d.setHours(h, 5, 0, 0); return d; };
const only = process.argv[2];
const run = async (tag, { lang = "en", theme = "aurora-light", hour = 19, path }) => {
  if (only && !only.includes(tag)) return;
  console.error("run", tag);
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, locale: lang === "ru" ? "ru-RU" : "en-US", timezoneId: lang === "ru" ? "Europe/Moscow" : "Asia/Dubai" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(`${tag}: ${e.message}`)); p.on("console", (m) => m.type() === "error" && !/InAppReview|favicon|Failed to load resource/.test(m.text()) && errs.push(`${tag}: ${m.text()}`));
  await p.clock.install({ time: at(hour) });
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(({ theme }) => { localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_theme", theme); }, { theme });
  await p.reload(); await p.waitForTimeout(2200);
  let n = 0;
  const shot = async (name) => { await p.waitForTimeout(650); await p.screenshot({ path: `${D}/${tag}-${String(++n).padStart(2, "0")}-${name}.png` }); };
  const btn = (re) => p.getByRole("button", { name: re }).first();
  const T = lang === "ru"
    ? { start: /^Начать/, simple: /Начни с простого/, cont: /^Дальше|^Продолжить/, answer: /Ответить на вопросы за сегодня/, more: /Ещё темы/, own: /^Свой вопрос/, notNow: /Не сейчас/, see: /Покажи, что где/, yes: /Да/, no: /Нет/, notSure: /Не знаю/ }
    : { start: /^Get started/, simple: /Start simple/, cont: /^Continue/, answer: /Answer today's questions/, more: /More topics/, own: /^Write your own question/, notNow: /Not now/, see: /Show me around/, yes: /Yes/, no: /No$/, notSure: /Not sure/ };
  await shot("welcome");
  if (path.simple) { await btn(T.simple).click(); }
  else {
    await btn(T.start).click(); await whyStep(p); await shot("topic");
    if (path.more) { await btn(path.more).click(); await shot("topic-more"); await btn(T.cont).click(); }
    else if (path.own) { await btn(T.own).click(); await shot("own"); await p.locator("input").first().fill(path.own); await shot("own-typed"); await btn(T.cont).click(); await shot("topic-own"); await btn(T.cont).click(); }
    else { await btn(path.topic).click(); await btn(T.cont).click(); }
  }
  await shot("questions");
  out[`${tag} questions`] = await p.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 260));
  await btn(T.cont).click(); await shot("value");
  await btn(T.answer).click(); await p.waitForTimeout(500);
  if (hour < 17) { await shot("daytime"); const sh = p.locator(".onb [role=dialog]"); await sh.getByRole("button", { name: path.day === "yesterday" ? (lang === "ru" ? /За вчера/ : /^Yesterday/) : (lang === "ru" ? /Вечером/ : /^Tonight/) }).click(); await sh.getByRole("button", { name: T.cont }).click(); }
  await p.waitForTimeout(1800); await shot("after-onboarding");
  if (path.day === "tonight") {
    out[`${tag} end`] = await p.evaluate(() => document.querySelector("[role=dialog]")?.innerText.replace(/\s+/g, " ").slice(0, 200));
    await btn(T.notNow).click().catch(() => {}); await p.waitForTimeout(2200); await shot("tour");
    out[`${tag} tour`] = await p.evaluate(() => document.querySelector("[data-tour-card]")?.innerText.replace(/s+/g, " ").slice(0, 60) ?? "NO TOUR");
    await btn(/^Skip/).click().catch(() => {}); await p.waitForTimeout(1200); await shot("today");
  } else {
    // the real cards: answer each (or Not sure)
    for (let i = 0; i < 8; i++) {
      const target = path.notSure ? p.getByRole("button", { name: T.notSure }).last() : p.getByRole("button", { name: i % 2 ? T.no : T.yes }).last();
      if (!(await target.isVisible().catch(() => false))) break;
      if (i === 0) await shot("checkin");
      const ok = await target.click({ timeout: 3000 }).then(() => true).catch(() => false); if (!ok) break; await p.waitForTimeout(650);
    }
    await p.waitForTimeout(1500); await shot("world-moment");
    out[`${tag} end`] = await p.evaluate(() => [...document.querySelectorAll("[role=dialog]")].map((d) => d.innerText.replace(/\s+/g, " ").slice(0, 200)).join(" || "));
    await p.waitForTimeout(1500); await shot("reminder");
    await btn(T.notNow).click().catch(() => {}); await p.waitForTimeout(600);
    await btn(T.see).click().catch(() => {}); await p.waitForTimeout(600); await btn(T.notNow).click().catch(() => {}); await p.waitForTimeout(2200); await shot("tour");
    out[`${tag} tour`] = await p.evaluate(() => document.querySelector("[data-tour-card]")?.innerText.replace(/s+/g, " ").slice(0, 60) ?? "NO TOUR");
    await btn(lang === "ru" ? /Пропустить/ : /^Skip/).click().catch(() => {}); await p.waitForTimeout(1200); await shot("today");
  }
  out[`${tag} saved`] = await p.evaluate(async () => {
    const s = await import("/src/lib/storage.ts"), ps = await import("/src/lib/pathSteps.ts");
    const T = await s.getTrackers(), E = await s.getEntries();
    const m = ps.pathModel(T, E);
    return { questions: T.filter((t) => !t.archived).map((t) => t.title).join(" | "), entries: E.map((e) => `${e.date.slice(5)}:${e.value ? "Y" : "N"}`).join(" "), door: JSON.parse(localStorage.getItem("memap_door") || "null")?.id ?? null, counted: m.pastInWeek.length + (m.steps.some((x) => x.done && x.kind === "questions") ? 1 : 0), firstSteps: m.steps.slice(0, 4).map((x) => x.kind + (x.onPath ? "*" : "") + (x.done ? "✓" : "")).join(" "), seen: localStorage.getItem("memap_tour_seen") };
  });
  await ctx.close();
};
await run("A", { path: { topic: /Headaches & migraines|Migraines/ } });
await run("B", { hour: 10, path: { topic: /Headaches & migraines|Migraines/, day: "yesterday" } });
await run("C", { hour: 10, path: { simple: true, day: "tonight" } });
await run("D", { lang: "ru", theme: "aurora", path: { own: "Удалось погулять с собакой?" } });
await run("E", { path: { topic: /Headaches & migraines|Migraines/, notSure: true } });
await run("F", { path: { more: /Thinking of quitting my job/ } });
console.log(JSON.stringify({ ...out, errs }, null, 1));
await b.close();
