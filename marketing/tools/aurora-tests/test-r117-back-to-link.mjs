// r117 (Nov 10 2026; since v151 the chart is on the link card itself, her note: "когда перешла по ссылке посмотреть график, то обратно уже не смогла выйти на эту
// связь"). "See the days" on a link opens the chart with both questions; "Back to the link" — or closing the chart —
// returns to that same link: in the Links list (the card open again) and from a link's own sheet on the map.
// Run from marketing/tools:  node aurora-tests/test-r117-back-to-link.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r117`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const ok = (name, cond, info = "") => { out[name] = !!cond; if (!cond) fails.push(`${name} ${typeof info === "string" ? info : JSON.stringify(info)}`.trim()); };

for (const lang of ["en", "ru"]) {
  const W = lang === "ru" ? { back: /Назад к связи/, see: /^(Посмотреть дни|График)$/, chart: /график|Смотреть на графике/i } : { back: /Back to the link/, see: /^(See the days|Chart)$/, chart: /chart/i };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: "Europe/London" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  let n = 0; const shot = async (name) => { await p.waitForTimeout(500); await p.screenshot({ path: `${D}/${lang}-back-${String(++n).padStart(2, "0")}-${name}.png` }); };
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  // the same 60 evenings as r95: several links, a forced yes → headache the next day among them
  await p.evaluate(async (lang) => {
    localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order"])); localStorage.setItem("memap_tour_seen", "true");
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" })); localStorage.setItem("memap_tour_completed", "1"); localStorage.setItem("memap_first_link_seen", "before");
    localStorage.setItem("memap_ab_onb", "A");
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    const [head, forced, sleep] = await dz.ensureTemplates(["headache", "said-yes-when-meant-no", "slept-enough"]);
    const forcedOn = (d) => d % 3 === 0, shortOn = (d) => d % 4 === 1;
    const E = [];
    const add = (id, d, v) => E.push({ id: `${id}-${d}`, trackerId: id, date: dz.daysAgoIso(d), value: v });
    for (let d = 1; d <= 60; d++) { add(forced, d, forcedOn(d)); add(sleep, d, !shortOn(d)); add(head, d, shortOn(d) || (forcedOn(d + 1) && d % 5 !== 0) || d % 11 === 0); }
    await st.saveEntries(E);
    localStorage.setItem("memap_path_start", dz.daysAgoIso(60));
    localStorage.setItem("memap_door", JSON.stringify({ id: "migraine", trackerId: head, contextTrackerIds: [], startedAt: dz.daysAgoIso(60) }));
  }, lang);
  await p.reload(); await p.waitForTimeout(2500);

  // 1. the Links list: open the SECOND link — its chart and days are on the card (v151, her pick: no page to go to)
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "findings", back: true } })));
  await p.waitForTimeout(2200);
  const cards = p.locator("[data-link-card]");
  out[`${lang}.cards`] = await cards.count();
  // r153 (Nov 13 2026): links about one thing share a card, so this data may show one card; the last card is opened
  ok(`${lang}.links: a link card is there`, (await cards.count()) >= 1, String(await cards.count()));
  const second = cards.nth(Math.min(1, (await cards.count()) - 1));
  await second.locator("button[aria-expanded]").click(); await p.waitForTimeout(700);
  await shot("open-in-list");
  const inCard = await second.evaluate((c) => ({ chart: !!c.querySelector("[data-link-chart-inline] svg"), days: !!c.querySelector("[data-chart-days]"), lit: c.querySelectorAll(".hl-a, .hl-b").length }));
  ok(`${lang}.list: the chart and the days on the card`, inCard.chart && inCard.days, inCard);
  ok(`${lang}.list: the two answers lit in the sentence`, inCard.lit >= 2, inCard);
  ok(`${lang}.list: still in Links`, (await p.locator("[data-link-card]").count()) >= 1);
  await p.keyboard.press("Escape"); await p.waitForTimeout(1000);
  ok(`${lang}.close Links → closed`, (await p.locator("[data-link-card]").count()) === 0);

  // 2. a link's own sheet on the map: the same card, open, with its chart
  const route = await p.evaluate(async () => {
    const isl = await import("/src/lib/islands.ts"), st = await import("/src/lib/storage.ts");
    const T = await st.getTrackers(), E = await st.getEntries();
    const r = isl.buildRoutes(T, E, isl.buildIslands(T, E))[0];
    return r ? { a: r.a, b: r.b } : null;
  });
  if (route) {
    await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns" } }))); await p.waitForTimeout(1800);
    await p.evaluate((d) => window.dispatchEvent(new CustomEvent("memap-open-link-sheet", { detail: d })), route); await p.waitForTimeout(1500);
    await shot("globe-sheet");
    const sheet = await p.evaluate(() => { const s = document.querySelector("[data-link-sheet]"); return { card: !!s?.querySelector("[data-link-card]"), chart: !!s?.querySelector("[data-link-chart-inline] svg") }; });
    ok(`${lang}.sheet: the Links card, open, with its chart`, sheet.card && sheet.chart, sheet);
  } else ok(`${lang}.a route on the map`, false);
  await ctx.close();
}
console.log(JSON.stringify({ fails, out, errs }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
