// Onboarding v2 (Nov 5 2026): a brand-new person walks it end to end.
//   A: something keeps happening → Migraines (EN, day)
//   B: I want more good days → Energy (RU, night)
//   C: something keeps happening → Bad nights (EN, day): the main answer is saved as "no" to "Slept enough"
// Pictures of every screen; what was saved at the end; errors.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r33`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
const run = async (tag, lang, theme, branchLabel, doorLabel) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(`${tag}: ${e.message}`)); p.on("console", (m) => m.type() === "error" && errs.push(`${tag}: ${m.text()}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(({ lang, theme }) => { localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_theme", theme); }, { lang, theme });
  await p.reload(); await p.waitForTimeout(2200);
  let n = 0;
  const shot = async (name) => { await p.waitForTimeout(700); await p.screenshot({ path: `${D}/${tag}-${String(++n).padStart(2, "0")}-${name}.png` }); };
  const click = async (re) => { await p.getByRole("button", { name: re }).first().click(); };
  await shot("welcome");
  if (lang === "ru") { await click(/^RU$/); await p.waitForTimeout(400); await shot("welcome-ru"); }
  await click(lang === "ru" ? /Начать|Start/ : /^Start/); await shot("fork");
  await click(branchLabel); await shot("fork-picked");
  await click(lang === "ru" ? /^Дальше/ : /^Continue/); await shot("list");
  await click(doorLabel); await click(lang === "ru" ? /^Дальше/ : /^Continue/); await shot("promise");
  await p.waitForTimeout(1200); await shot("promise-risen");
  await click(lang === "ru" ? /Начнём/ : /Let's start/); await shot("when");
  await click(lang === "ru" ? /^Вчера$/ : /^Yesterday$/); await shot("when-picked");
  const chips = p.locator("[data-onb-interactive][aria-pressed]").filter({ hasNotText: /^(Today|Yesterday|This week|A while ago|Сегодня|Вчера|На этой неделе|Давно)$/ });
  if (await chips.count() > 1) { await chips.nth(0).click(); await chips.nth(1).click(); }
  await shot("reasons");
  await click(lang === "ru" ? /^Дальше/ : /^Next/); await shot("context");
  const yes = p.getByRole("button", { name: lang === "ru" ? /^Да$/ : /^Yes$/ });
  const no = p.getByRole("button", { name: lang === "ru" ? /^Нет$/ : /^No$/ });
  if (await yes.count()) { await no.nth(0).click(); await yes.nth(1).click().catch(() => {}); await no.nth(2).click().catch(() => {}); }
  await shot("context-answered");
  await click(lang === "ru" ? /Сохранить/ : /^Save/); await shot("first-light");
  // the reminder off (no permission prompt in a test)
  await p.locator("[role=switch]").first().click().catch(() => {});
  await click(lang === "ru" ? /^Начать|В путь/ : /^Go to today|^Start/); await shot("companion");
  await p.getByRole("button", { name: /panda/i }).first().click().catch(() => {}); await shot("companion-picked");
  await click(lang === "ru" ? /В путь/ : /Set sail/); await p.waitForTimeout(1800); await shot("today");
  out[tag] = await p.evaluate(async () => {
    const T = JSON.parse(localStorage.getItem("memap_trackers") || "[]"), E = JSON.parse(localStorage.getItem("memap_entries") || "[]");
    const door = JSON.parse(localStorage.getItem("memap_door") || "null");
    const main = T.find((t) => t.id === door?.trackerId);
    const e = E.find((x) => x.trackerId === door?.trackerId);
    return { door: door?.id, questions: T.map((t) => t.title), main: main?.title, mainAnswer: e?.value, tags: e?.tags, entries: E.length, avatar: localStorage.getItem("memap_avatar"), tour: localStorage.getItem("memap_tour_seen"), lang: localStorage.getItem("memap_language") };
  });
  await ctx.close();
};
await run("A", "en", "aurora-light", /Something keeps happening/, /Migraines/);
await run("B", "ru", "aurora", /Хочу больше хороших дней/, /Энергия/);
await run("C", "en", "aurora-light", /Something keeps happening/, /Bad nights/);
console.log(JSON.stringify({ ...out, errs }, null, 1));
await b.close();
