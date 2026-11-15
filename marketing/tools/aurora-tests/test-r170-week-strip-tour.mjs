// r170 (Nov 15 2026, branch design/one-system): Today as she picked it on the boards.
// 1. A week strip on top of Today: the day of the light in the middle ("Today · Sunday 15", "Friday 13 · Not filled"),
//    its seven days; a tap on a day brings its light to the middle; a tap on a missed day in view opens it to fill in.
// 2. The steps say what they are ("Guess the cause", "Why the fight?", "About your sleep"…), no "Look around" step.
// 3. The tour in two parts (board F): Today's two cards stay on Today; the World tab then glows with a line over it;
//    the World's two cards start the first time the World opens and end there; never again after.
// Run from marketing/tools with the dev server on 8080; exit 1 when a check fails.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r170`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const check = (name, ok, info) => { out[name] = ok ? "ok" : `FAIL ${info !== undefined ? JSON.stringify(info).slice(0, 400) : ""}`; if (!ok) fails.push(name); };
const isoOf = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
for (const lang of ["en", "ru"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async (lang) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); const r = g.generateDemoData("work-home");
    localStorage.clear();
    // the last four days answered but the day before yesterday
    const keep = new Set([1, 3, 4].map(iso));
    localStorage.setItem("memap_trackers", JSON.stringify(r.newTrackers.map((t) => ({ ...t, createdAt: new Date(Date.now() - 30 * 864e5).toISOString() }))));
    localStorage.setItem("memap_entries", JSON.stringify(r.newEntries.filter((e) => keep.has(e.date))));
    localStorage.setItem("memap_path_start", iso(4)); localStorage.setItem("memap_onboarded_at", new Date(Date.now() - 4 * 864e5).toISOString());
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_cohort", "new"); // a new install: the World tab glows
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_playful_asked", "seed");
    localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order", "report"]));
  }, lang);
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(2600);
  const read = () => p.evaluate(() => ({ line: document.querySelector("[data-strip-day-line]")?.textContent, sub: document.querySelector("[data-strip-sub]")?.textContent, cur: document.querySelector("[data-strip-cell][aria-current]")?.getAttribute("data-strip-cell") }));
  // 1. the strip
  const s0 = await read();
  check(`${lang}: the strip starts on today`, s0.cur === isoOf(0) && (lang === "en" ? /^Today · \w+ \d+$/ : /^Сегодня · \S+ \d+$/).test(s0.line ?? ""), s0);
  check(`${lang}: seven days on the strip`, (await p.locator("[data-strip-cell]").count()) === 7);
  await p.screenshot({ path: `${D}/${lang}-today.png` });
  const missed = isoOf(2);
  await p.locator(`[data-strip-cell="${missed}"]`).click(); await p.waitForTimeout(1200);
  const s1 = await read();
  check(`${lang}: a tap on a missed day brings it up, "Not filled"`, s1.cur === missed && (lang === "en" ? /Not filled/ : /Не заполнен/).test(s1.sub ?? ""), s1);
  await p.screenshot({ path: `${D}/${lang}-missed.png` });
  await p.locator(`[data-strip-cell="${missed}"]`).click(); await p.waitForTimeout(1200);
  check(`${lang}: a second tap opens it to fill in`, (await p.locator("[role=dialog]").count()) >= 1);
  await p.keyboard.press("Escape"); await p.waitForTimeout(900);
  await p.screenshot({ path: `${D}/${lang}-after-fill.png` });
  out[`${lang} after fill`] = await p.evaluate(() => ({ dialogs: document.querySelectorAll("[role=dialog]").length, tab: document.querySelector("nav [aria-current=page]")?.textContent, scroll: document.querySelector("main")?.scrollTop }));
  await p.mouse.move(195, 500); await p.mouse.wheel(0, 420); await p.waitForTimeout(1000);
  const s2 = await read();
  check(`${lang}: scrolled down by hand, the strip follows to a later day`, !!s2.cur && s2.cur > missed, s2);
  // 2. step names
  const names = await p.$$eval("[data-path-stop]", (els) => els.map((e) => e.getAttribute("aria-label")));
  check(`${lang}: no "Look around" step`, !names.some((n) => /Look around|Осмотрись/.test(n ?? "")), names);
  out[`${lang} steps`] = names.join(" | ");
  // 3. the tour, Today's part
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-start-tour", { detail: { part: "today" } })));
  const todayCards = [];
  for (let i = 0; i < 4; i++) {
    await p.waitForTimeout(1700);
    const card = p.locator("[data-tour-card]");
    if (!(await card.count())) break;
    if (todayCards.length === 0) { const g = await p.evaluate(() => { const el = document.querySelector('[data-tour="tab-patterns"]'); return el && el.classList.contains("glow-hint") ? getComputedStyle(el, "::after").display : "none"; }); check(`${lang}: no World glow while the Today tour is on`, g === "none", g); }
    todayCards.push(`${(await card.locator("p").nth(1).textContent()).trim()} @ ${(await p.locator(".path-box").count()) ? "Today" : "World"}`);
    await card.locator("button.raised-btn").click();
  }
  await p.waitForTimeout(1200);
  check(`${lang}: Today's part is two cards, on Today`, todayCards.length === 2 && todayCards.every((c) => c.endsWith("Today")), todayCards);
  check(`${lang}: after it, still on Today`, (await p.locator(".path-box").count()) >= 1);
  const hint = p.locator("[data-world-ready]");
  check(`${lang}: the World tab glows with a line over it`, (await hint.count()) === 1 && (await p.locator('[data-tour="tab-patterns"][data-glow]').count()) === 1);
  await p.screenshot({ path: `${D}/${lang}-hint.png` });
  // the World's part
  await hint.click();
  const worldCards = [];
  for (let i = 0; i < 7; i++) {
    await p.waitForTimeout(i === 0 ? 2800 : 1700);
    const card = p.locator("[data-tour-card]");
    if (!(await card.count())) break;
    worldCards.push(`${(await card.locator("p").nth(1).textContent()).trim()} @ ${(await p.locator(".path-box").count()) ? "Today" : "World"}`);
    if (i === 1) await p.screenshot({ path: `${D}/${lang}-world-tour.png` });
    await card.locator("button.raised-btn").click();
  }
  await p.waitForTimeout(1200);
  check(`${lang}: the World's part is five cards (islands and each tile), on the World`, worldCards.length === 5 && worldCards.every((c) => c.endsWith("World")), worldCards);
  check(`${lang}: it ends on the World`, (await p.locator(".path-box").count()) === 0);
  check(`${lang}: the line over the tab is gone`, (await p.locator("[data-world-ready]").count()) === 0);
  // what to tap next (her rule, Nov 15 2026): after the World's tour the Today tab lights up with a line over it
  check(`${lang}: after the World's tour, Today lights up with a line`, (await p.locator("[data-today-next]").count()) === 1 && (await p.locator('[data-tour="tab-cards"][data-glow]').count()) === 1);
  await p.screenshot({ path: `${D}/${lang}-today-next.png` });
  await p.locator('[data-tour="tab-cards"]').click(); await p.waitForTimeout(900);
  await p.locator('[data-tour="tab-patterns"]').click(); await p.waitForTimeout(2600);
  check(`${lang}: no tour the second time`, (await p.locator("[data-tour-card]").count()) === 0);
  check(`${lang}: once Today was opened, its line is gone`, (await p.locator("[data-today-next]").count()) === 0);
  await ctx.close();
}
console.log(JSON.stringify({ ...out, errs }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
