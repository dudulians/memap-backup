// r153 (Nov 13 2026, branch design/one-system): links about one thing sit on one card.
// 1. The long "two things" sentence cards are gone.
// 2. Fewer cards than links: a card holds every link about its thing; closed, it says how many more ("+2 more with it").
// 3. Opened, it has one way on, "All about …", to the page of that thing, which lists all its links (Nov 14 2026).
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
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1");
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
  // since v164 the tile counts cards, as the list shows them; every link worth showing is counted here
  const found = Number((await p.locator('[data-tour="links-card"]').innerText()).match(/\d+/)?.[0] ?? 0);
  const links = await p.evaluate(async () => { const c = await import("/src/lib/correlations.ts"), i = await import("/src/lib/islands.ts"); const T = JSON.parse(localStorage.getItem("memap_trackers")), E = JSON.parse(localStorage.getItem("memap_entries")); return c.computeCorrelations(T.filter((x) => !x.archived && x.source !== "play"), E, i.LINKS_TOP).filter(i.linkWorthShowing).length; });
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
  check(`${lang}: fewer cards than links, and the tile says the cards`, state.cards > 0 && state.cards < links && state.cards === found, { cards: state.cards, links, found });
  const moreN = state.counts.reduce((s, x) => s + Number(x.match(/\d+/)?.[0] ?? 0), 0);
  check(`${lang}: every link is on a card (sentences + rows = all links)`, state.cards + moreN === links, { cards: state.cards, moreN, links });
  check(`${lang}: a closed card says how many more`, state.counts.some((x) => (lang === "en" ? /^·?\s*\+\d+ more with it$/ : /^·?\s*и ещё \d+ вместе с этим$/).test(x)), state.counts);
  // since Nov 14 2026 the opened card has no rows of the other links (her note: text rows under the steps distracted);
  // one way on, "All about …", opens the page of that thing, which lists all its links
  const card = p.locator("[data-link-card]").first();
  const before = (await card.locator("[data-link-sentence]").innerText()).replace(/\s+/g, " ").trim();
  await card.locator("button").first().click(); await p.waitForTimeout(900);
  const rows = await card.locator("[data-also-row]").count();
  const way = (await card.locator("[data-link-thing]").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
  check(`${lang}: the opened card has no rows of other links, one way to the thing instead`, rows === 0 && (lang === "en" ? /^All about “.+” and \d+ more links? with it$/ : /^Всё про «.+» и ещё \d+ связ\S* с этим$/).test(way), { rows, way });
  await card.locator("[data-link-thing]").scrollIntoViewIfNeeded(); await shot(p, `${lang}-open-way`);
  await card.locator("[data-link-thing]").click(); await p.waitForTimeout(1500);
  const thingLinks = await p.locator("[data-thing] [data-thing-link]").allInnerTexts();
  const moreLinks = Number(way.match(/\d+/)?.[0] ?? 0);
  check(`${lang}: the thing's page lists its links, the strongest first`, thingLinks.length === 1 + moreLinks && thingLinks[0].replace(/\s+/g, " ").startsWith(before.slice(0, 30)), { n: thingLinks.length, moreLinks, first: thingLinks[0]?.slice(0, 80) });
  await shot(p, `${lang}-thing`);
  // a link on that page opens as its own card in Links, open, with its chart
  const second = thingLinks[1]?.split("\n")[0].replace(/\s+/g, " ").trim();
  await p.locator("[data-thing] [data-thing-link]").nth(1).click(); await p.waitForTimeout(2000);
  const opened = await p.evaluate(() => [...document.querySelectorAll("[data-link-card]")].filter((c) => c.querySelector("[aria-expanded=true]") && c.querySelector("[data-link-chart-inline]")).map((c) => c.querySelector("[data-link-sentence]").textContent.replace(/\s+/g, " ").trim()));
  check(`${lang}: a link on the thing's page opens as its card, with its chart`, opened.length === 1 && opened[0] === second, { opened, second });
  await shot(p, `${lang}-link-from-thing`);
  await ctx.close();
}
await b.close();
console.log(JSON.stringify(out, null, 1));
if (errs.length) console.log("PAGE ERRORS:", errs.slice(0, 5));
process.exit(fails.length || errs.length ? 1 : 0);
