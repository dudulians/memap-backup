// r117 (Nov 10 2026, her note: "когда перешла по ссылке посмотреть график, то обратно уже не смогла выйти на эту
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
  const W = lang === "ru" ? { back: /Назад к связи/, see: /^Посмотреть дни$/, chart: /график|Смотреть на графике/i } : { back: /Back to the link/, see: /^See the days$/, chart: /chart/i };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: "Europe/London" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  let n = 0; const shot = async (name) => { await p.waitForTimeout(500); await p.screenshot({ path: `${D}/${lang}-back-${String(++n).padStart(2, "0")}-${name}.png` }); };
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  // the same 60 evenings as r95: several links, a forced yes → headache the next day among them
  await p.evaluate(async (lang) => {
    localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order"])); localStorage.setItem("memap_tour_seen", "true");
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

  // 1. the Links list: open the SECOND link, "See the days", then back
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "findings", back: true } })));
  await p.waitForTimeout(2200);
  const cards = p.locator("[data-link-card]");
  out[`${lang}.cards`] = await cards.count();
  ok(`${lang}.links: two or more links`, (await cards.count()) >= 2, String(await cards.count()));
  const second = cards.nth(1);
  const head2 = (await second.locator("button[aria-expanded]").innerText()).replace(/\s+/g, " ").slice(0, 80);
  await second.locator("button[aria-expanded]").click(); await p.waitForTimeout(500);
  await second.getByRole("button", { name: W.see }).click(); await p.waitForTimeout(1600);
  await shot("chart-from-list");
  const backBtn = p.locator("[data-back-to-link]");
  ok(`${lang}.list → chart: "Back to the link" shown`, (await backBtn.count()) === 1 && W.back.test(await backBtn.innerText()));
  await backBtn.click(); await p.waitForTimeout(1600);
  await shot("back-in-list");
  const openCard = p.locator("[data-link-card]", { has: p.locator("button[aria-expanded=true]") });
  const openHeads = (await openCard.locator("button[aria-expanded]").allInnerTexts()).map((x) => x.replace(/\s+/g, " ").slice(0, 80));
  out[`${lang}.openAfterBack`] = openHeads;
  ok(`${lang}.back: the same link is open again`, openHeads.includes(head2), { head2, openHeads });
  const inView = await p.evaluate((h) => { const c = [...document.querySelectorAll("[data-link-card]")].find((x) => x.textContent.replace(/\s+/g, " ").includes(h.slice(0, 30))); if (!c) return false; const r = c.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }, head2);
  ok(`${lang}.back: that link is in view`, inView);
  // closing the chart (not the button) goes back too
  await p.locator("[data-link-card]").nth(1).getByRole("button", { name: W.see }).click(); await p.waitForTimeout(1600);
  await p.keyboard.press("Escape"); await p.waitForTimeout(1600);
  ok(`${lang}.close chart → back in Links`, (await p.locator("[data-link-card]").count()) >= 2);
  await p.keyboard.press("Escape"); await p.waitForTimeout(1000);
  ok(`${lang}.close Links → closed`, (await p.locator("[data-link-card]").count()) === 0);

  // 2. a link's own sheet on the map: its chart button, then back to the sheet
  const route = await p.evaluate(async () => {
    const isl = await import("/src/lib/islands.ts"), st = await import("/src/lib/storage.ts");
    const T = await st.getTrackers(), E = await st.getEntries();
    const r = isl.buildRoutes(T, E, isl.buildIslands(T, E))[0];
    return r ? { a: r.a, b: r.b } : null;
  });
  if (route) {
    await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns" } }))); await p.waitForTimeout(1800);
    await p.evaluate((d) => window.dispatchEvent(new CustomEvent("memap-open-link", { detail: d })), route); await p.waitForTimeout(1500);
    const sheetText = (await p.locator("[role=dialog]").last().innerText()).replace(/\s+/g, " ").slice(0, 120);
    await p.locator("[role=dialog]").last().locator("button.raised-btn").last().click(); await p.waitForTimeout(1800);
    await shot("chart-from-sheet");
    ok(`${lang}.sheet → chart: "Back to the link" shown`, (await p.locator("[data-back-to-link]").count()) === 1);
    await p.locator("[data-back-to-link]").click(); await p.waitForTimeout(1600);
    await shot("back-in-sheet");
    const again = (await p.locator("[role=dialog]").last().innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 120);
    ok(`${lang}.back: the link's sheet again`, again === sheetText, { sheetText, again });
  } else ok(`${lang}.a route on the map`, false);
  await ctx.close();
}
console.log(JSON.stringify({ fails, out, errs }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
