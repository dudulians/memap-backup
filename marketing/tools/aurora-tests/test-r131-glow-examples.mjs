// r131 (her note, Nov 10 2026, after the short onboarding C): "не хватило всё-таки какого-то лёгкого тура…
// чтоб подсвечивалась кнопка World… он нажимает — там светятся другие… когда открываю Links — nothing to show
// yet, а хочется пример… календарь — как эти дни будут заполняться… чтобы было четко понятно, что это примеры".
// 1. After the first evening the World tab glows; opened, it stops, and the four parts glow until each is opened.
// 2. Each part shows a labelled example while nothing of hers is there: My days (a month), Chart (a link's lines),
//    Links (a link), When to act (a reached rule), What helps (a change being tried).
// 3. Old users: no glow. A month of answers: no example month in My days.
// Run from marketing/tools: node aurora-tests/test-r131-glow-examples.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r131`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const ok = (name, cond, info = "") => { out[name] = cond ? "ok" : `FAIL ${typeof info === "string" ? info : JSON.stringify(info)}`.slice(0, 600); if (!cond) fails.push(name); };

const seed = async (p, { lang = "en", days = 1, cohort = "new" } = {}) => {
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  await p.evaluate(async ({ lang, days, cohort }) => {
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_cohort", cohort); localStorage.setItem("memap_ab_onb", "C");
    localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order"]));
    localStorage.setItem("memap_tour_seen", "true");
    const now = new Date(); now.setHours(20, 0, 0, 0);
    const day = (k) => { const d = new Date(now); d.setDate(d.getDate() - k); return d; };
    const start = day(days - 1); start.setHours(9, 0, 0, 0);
    const got = await dz.ensureTemplates(["slept-enough", "felt-happy", "felt-stressed", "exercised"]);
    await st.saveTrackers((await st.getTrackers()).map((t) => ({ ...t, createdAt: start.toISOString() })));
    localStorage.setItem("memap_onboarded_at", start.toISOString()); localStorage.setItem("memap_path_start", dz.isoLocal(start));
    const E = []; for (let k = days - 1; k >= 0; k--) got.forEach((id, i) => E.push({ id: `e${k}-${i}`, trackerId: id, date: dz.isoLocal(day(k)), value: (i + k) % 3 === 0, createdAt: day(k).toISOString() }));
    await st.saveEntries(E);
  }, { lang, days, cohort });
  const t20 = new Date(); t20.setHours(20, 30, 0, 0);
  await p.clock.install({ time: t20 });
  await p.reload(); await p.waitForTimeout(2600);
};
const closeSheets = async (p) => { for (let i = 0; i < 3; i++) { await p.keyboard.press("Escape"); await p.waitForTimeout(450); } };
const sheetText = (p) => p.evaluate(() => ([...document.querySelectorAll("[role=dialog]")].pop()?.innerText ?? "").replace(/\s+/g, " "));
const example = (p, kind) => p.evaluate((kind) => { const el = [...document.querySelectorAll(`[data-example="${kind}"]`)].pop(); if (!el) return null; const r = el.getBoundingClientRect(); return { text: el.innerText.replace(/\s+/g, " ").slice(0, 200), w: Math.round(r.width), overflow: el.scrollWidth > el.clientWidth + 1 }; }, kind);

for (const lang of ["en", "ru"]) {
  const EX = lang === "ru" ? "ПРИМЕР" : "EXAMPLE";
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: lang === "ru" ? "ru-RU" : "en-US" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  await seed(p, { lang });
  await closeSheets(p);
  const worldGlow = await p.locator('[data-tour="tab-patterns"].glow-hint').count();
  await p.screenshot({ path: `${D}/${lang}-1-today-world-glows.png` });
  ok(`${lang}: after the first evening the World tab glows`, worldGlow === 1, worldGlow);
  const otherGlow = await p.locator('[data-tour="tab-notes"].glow-hint, [data-tour="tab-cards"].glow-hint').count();
  ok(`${lang}: only the World tab glows`, otherGlow === 0, otherGlow);
  await p.locator('[data-tour="tab-patterns"]').click(); await p.waitForTimeout(2600);
  await closeSheets(p);
  const parts = await p.evaluate(() => ["calendar", "links-card", "actions", "helps"].map((k) => !!document.querySelector(`[data-tour="${k}"].glow-hint`)));
  const tabGlowAfter = await p.locator('[data-tour="tab-patterns"].glow-hint').count();
  await p.screenshot({ path: `${D}/${lang}-2-world-parts-glow.png` });
  ok(`${lang}: opened, the World tab stops glowing`, tabGlowAfter === 0, tabGlowAfter);
  ok(`${lang}: in the World the four parts glow`, parts.every(Boolean), parts);

  // My days: an example month under her calendar
  await p.locator('[data-tour="calendar"]').click(); await p.waitForTimeout(1800);
  let m = await example(p, "month");
  await p.locator("[data-example=month]").last().scrollIntoViewIfNeeded().catch(() => {}); await p.waitForTimeout(400);
  await p.screenshot({ path: `${D}/${lang}-3-my-days-example.png` });
  ok(`${lang}: My days shows an example month, labelled`, !!m && m.text.toUpperCase().includes(EX) && /\b30\b/.test(m.text) && !m.overflow, m);
  // Chart: an example link chart
  await p.locator("[role=dialog] .seg button", { hasText: lang === "ru" ? /^График$/ : /^Chart$/ }).first().click(); await p.waitForTimeout(1200);
  // the Chart's own example is "chart-one" in its "each" view since v132 (each example folds on its own)
  m = (await example(p, "chart")) ?? (await example(p, "chart-one"));
  await p.screenshot({ path: `${D}/${lang}-4-chart-example.png` });
  ok(`${lang}: Chart shows an example, labelled`, !!m && m.text.toUpperCase().includes(EX) && !m.overflow, m);
  await closeSheets(p);
  // Links
  await p.locator('[data-tour="links-card"]').click(); await p.waitForTimeout(1800);
  m = await example(p, "link");
  await p.locator("[data-example=link]").last().scrollIntoViewIfNeeded().catch(() => {}); await p.waitForTimeout(400);
  await p.screenshot({ path: `${D}/${lang}-5-links-example.png` });
  ok(`${lang}: Links shows an example link, labelled`, !!m && m.text.toUpperCase().includes(EX) && (lang === "ru" ? /ноч/i.test(m.text) : /night/i.test(m.text)) && !m.overflow, m);
  await closeSheets(p);
  // When to act
  await p.locator('[data-tour="actions"]').click(); await p.waitForTimeout(1800);
  m = await example(p, "rule");
  await p.screenshot({ path: `${D}/${lang}-6-when-to-act-example.png` });
  ok(`${lang}: When to act shows an example rule, labelled`, !!m && m.text.toUpperCase().includes(EX) && !m.overflow, m);
  await closeSheets(p);
  // What helps
  await p.locator('[data-tour="helps"]').click(); await p.waitForTimeout(1800);
  m = await example(p, "test");
  await p.screenshot({ path: `${D}/${lang}-7-what-helps-example.png` });
  ok(`${lang}: What helps shows an example change, labelled`, !!m && m.text.toUpperCase().includes(EX) && !m.overflow, m);
  await closeSheets(p);
  const after = await p.evaluate(() => ["calendar", "links-card", "actions", "helps"].map((k) => !!document.querySelector(`[data-tour="${k}"].glow-hint`)));
  await p.screenshot({ path: `${D}/${lang}-8-world-after.png` });
  ok(`${lang}: once opened, no part glows`, after.every((x) => !x), after);
  // the examples can't be tapped
  ok(`${lang}: examples aren't buttons`, await p.evaluate(() => [...document.querySelectorAll("[data-example] [aria-hidden=true] button, [data-example] [aria-hidden=true] a")].length === 0));
  await ctx.close();
}

// old users: no glow
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`old: ${e.message}`));
  await seed(p, { cohort: "old" });
  await closeSheets(p);
  ok("old users: the World tab doesn't glow", (await p.locator('[data-tour="tab-patterns"].glow-hint').count()) === 0);
  await ctx.close();
}
// a month of answers: her calendar, no example month
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`month: ${e.message}`));
  await seed(p, { days: 12 });
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "overview", back: true } }))); await p.waitForTimeout(2400);
  for (let i = 0; i < 3; i++) { const g = p.locator(".tour[role=dialog]"); if (!(await g.count())) break; await g.locator("button").first().click().catch(() => {}); await p.waitForTimeout(900); await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "overview", back: true } }))); await p.waitForTimeout(2000); }
  ok("12 days of answers: no example month", (await p.locator("[data-example=month]").count()) === 0, await sheetText(p).then((x) => x.slice(0, 200)));
  await ctx.close();
}
console.log(JSON.stringify({ fails, out, errs }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
