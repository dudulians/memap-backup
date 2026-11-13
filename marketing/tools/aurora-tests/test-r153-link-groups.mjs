// r153 (Nov 13 2026, branch design/one-system): links about one thing sit on one card.
// 1. The long "two things" sentence cards are gone.
// 2. Fewer cards than links: a card holds every link about its thing; closed, it says how many more ("+2 more with it").
// 3. Opened, it lists them as short rows under "Also with it" (EN) / «Ещё вместе с этим» (RU), each with its count.
// 4. A tap on a row makes that link the card's sentence, open, with its own chart; the first one becomes a row.
// 5. Every link is still reachable: sentences + rows = the links found.
// Screenshots in work/r153. Run from marketing/tools with the dev server on 8080; exit 1 when a check fails.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r153`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const check = (name, ok, info) => { out[name] = ok ? "ok" : `FAIL ${info !== undefined ? JSON.stringify(info).slice(0, 400) : ""}`; if (!ok) fails.push(name); };
let n = 0;
const seed = async (p, lang) => {
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async (lang) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); const r = g.generateDemoData("work-home");
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(r.newTrackers)); localStorage.setItem("memap_entries", JSON.stringify(r.newEntries));
    localStorage.setItem("memap_path_start", [...r.newEntries.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1");
    localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order", "report"]));
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(9) })); localStorage.setItem("memap_playful_asked", "seed");
    localStorage.setItem("memap_week_chests", JSON.stringify(Object.fromEntries(Array.from({ length: 9 }, (_, w) => [w, { openedAt: iso(1), lines: [], reward: "balloon" }]))));
  }, lang);
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(1800);
};
const shot = async (p, name) => { await p.waitForTimeout(500); await p.screenshot({ path: `${D}/${String(++n).padStart(2, "0")}-${name}.png` }); };

for (const lang of ["en", "ru"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await seed(p, lang);
  const tile = await p.locator('[data-tour="links-card"]').count();
  await p.locator("button").filter({ hasText: lang === "en" ? /^World$/ : /^Мир$/ }).last().click(); await p.waitForTimeout(2500);
  const found = Number((await p.locator('[data-tour="links-card"]').innerText()).match(/\d+/)?.[0] ?? 0);
  await p.locator('[data-tour="links-card"]').click(); await p.waitForTimeout(1300);
  await shot(p, `${lang}-list`);
  const more = p.locator("[data-more-links]"); if (await more.count()) { await more.click(); await p.waitForTimeout(500); }
  const state = await p.evaluate(() => ({
    two: document.querySelectorAll("[data-story=two]").length,
    cards: document.querySelectorAll("[data-link-card]").length,
    counts: [...document.querySelectorAll("[data-link-also-count]")].map((x) => x.textContent.trim()),
    sentences: [...document.querySelectorAll("[data-link-card] [data-link-sentence]")].map((x) => x.textContent.replace(/\s+/g, " ").trim()),
  }));
  out[`${lang} cards`] = state;
  check(`${lang}: no long "two things" cards`, state.two === 0, state.two);
  check(`${lang}: fewer cards than links`, state.cards > 0 && state.cards < found, { cards: state.cards, found });
  const moreN = state.counts.reduce((s, x) => s + Number(x.match(/\d+/)?.[0] ?? 0), 0);
  check(`${lang}: every link is on a card (sentences + rows = links found)`, state.cards + moreN === found, { cards: state.cards, moreN, found });
  check(`${lang}: a closed card says how many more`, state.counts.some((x) => (lang === "en" ? /^·?\s*\+\d+ more with it$/ : /^·?\s*и ещё \d+ вместе с этим$/).test(x)), state.counts);
  // open the first card: the rows
  const card = p.locator("[data-link-card]").first();
  const before = (await card.locator("[data-link-sentence]").innerText()).replace(/\s+/g, " ").trim();
  await card.locator("button").first().click(); await p.waitForTimeout(900);
  const rows = await card.locator("[data-also-row]").allInnerTexts();
  const head = (await card.locator("[data-link-also] p").first().innerText().catch(() => "")).trim();
  check(`${lang}: the opened card lists the other links as rows with counts`, rows.length >= 1 && head === (lang === "en" ? "Also with it" : "Ещё вместе с этим") && rows.every((x) => /\d+ (of|из) \d+/.test(x)), { head, rows });
  await card.locator("[data-link-also]").scrollIntoViewIfNeeded(); await shot(p, `${lang}-open-rows`);
  // a row becomes the card
  const rowText = rows[0].split("\n")[0].trim();
  await card.locator("[data-also-row]").first().click(); await p.waitForTimeout(900);
  const card2 = p.locator("[data-link-card]").first();
  const after = (await card2.locator("[data-link-sentence]").innerText()).replace(/\s+/g, " ").trim();
  const open2 = await card2.locator("[data-link-chart-inline]").count();
  const rows2 = await card2.locator("[data-also-row]").count();
  check(`${lang}: a tapped row becomes the card's sentence, open, with its chart`, after !== before && open2 === 1 && rows2 === rows.length, { before, after, open2, rows2, rowText });
  await shot(p, `${lang}-row-picked`);
  await ctx.close();
}
await b.close();
console.log(JSON.stringify(out, null, 1));
if (errs.length) console.log("PAGE ERRORS:", errs.slice(0, 5));
process.exit(fails.length || errs.length ? 1 : 0);
