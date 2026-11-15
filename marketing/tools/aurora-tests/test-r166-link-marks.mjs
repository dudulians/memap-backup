// r166 (Nov 14 2026, branch design/one-system): her note on links and tries.
// 1. Every link card starts with its own top line (link sign + islands, or "Strongest so far"), so the next card never
//    reads as more text of the open one.
// 2. A link walked to its last step says "Seen" with a tick when closed.
// 3. A link with a try running says "Trying now" when closed, and opens straight on the try (no Next needed).
// 4. Under "Trying now" one row goes to What helps; When to act's tests and What helps' tries say "From a link: … → …".
// 5. (v171) no "All about…" on the World: a question lives on its island, switched one at a time (test-r171).
// Screenshots in work/r166. Run from marketing/tools with the dev server on 8080 (PORT env to change); exit 1 on a failure.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const PORT = process.env.PORT ?? "8080";
const URL = `http://localhost:${PORT}/`;
const D = `./aurora-tests/work/r166`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const check = (name, ok, info) => { out[name] = ok ? "ok" : `FAIL ${info !== undefined ? JSON.stringify(info).slice(0, 400) : ""}`; if (!ok) fails.push(name); };
let n = 0;
const shot = async (p, name) => { await p.waitForTimeout(500); await p.screenshot({ path: `${D}/${String(++n).padStart(2, "0")}-${name}.png` }); };
const seed = async (p, lang) => {
  await p.goto(URL); await p.waitForTimeout(800);
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
  await p.goto(URL); await p.waitForTimeout(1800);
};
const world = async (p, lang) => { await p.locator("button").filter({ hasText: lang === "en" ? /^World$/ : /^Мир$/ }).last().click(); await p.waitForTimeout(2200); };
const closeSheet = async (p) => { await p.keyboard.press("Escape"); await p.waitForTimeout(700); };

for (const lang of ["en", "ru"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await seed(p, lang);
  // a try started from the second card's link, as "What to try" would start it
  const started = await p.evaluate(async () => {
    const c = await import("/src/lib/correlations.ts"), i = await import("/src/lib/islands.ts"), x = await import("/src/lib/experiments.ts");
    const T = JSON.parse(localStorage.getItem("memap_trackers")), E = JSON.parse(localStorage.getItem("memap_entries"));
    const links = i.rankLinks(c.computeCorrelations(T.filter((y) => !y.archived && y.source !== "play"), E, i.LINKS_TOP).filter(i.linkWorthShowing));
    // a link of a different thing than the first card's
    const firstSecond = i.linkOf(links[0]).second.id;
    const l = links.map(i.linkOf).find((y) => y.second.id !== firstSecond) ?? i.linkOf(links[1]);
    const ex = await x.startExperiment(i.islandOf(l.first), "Make something for 15 minutes a day", "Did you make something for 15 minutes?", undefined, { link: x.linkKey(l.first.id, l.second.id) });
    return { id: ex.id, first: l.first.id, second: l.second.id };
  });
  await p.goto(URL); await p.waitForTimeout(1800);
  await world(p, lang);
  await p.locator('[data-tour="links-card"]').click(); await p.waitForTimeout(1300);
  const cards = p.locator("[data-link-card]");
  const kickers = await p.evaluate(() => [...document.querySelectorAll("[data-link-card]")].map((c) => !!c.querySelector("[data-link-kicker]")));
  check(`${lang}: every link card has its own top line`, kickers.length > 1 && kickers.every(Boolean), kickers);
  const trying = p.locator('[data-link-card][data-link-mark="trying"]');
  check(`${lang}: the link with a try says "Trying now" closed`, (await trying.count()) === 1 && (await trying.locator('[data-link-status="trying"]').count()) === 1, await trying.count());
  await shot(p, `${lang}-list-closed`);

  // walk the first card to its last step: it says "Seen"
  const first = cards.first();
  await first.locator("button").first().click(); await p.waitForTimeout(800);
  for (let k = 0; k < 4; k++) {
    if (await first.locator("[data-order-ask]:not([data-order-done]) [data-order=first]").count()) { await first.locator("[data-order=first]").click(); await p.waitForTimeout(600); }
    const next = first.locator("[data-link-next]");
    if (!(await next.count())) break;
    await next.click(); await p.waitForTimeout(600);
  }
  await first.locator("button").first().click(); await p.waitForTimeout(700);
  check(`${lang}: a link walked to its last step says "Seen"`, (await first.getAttribute("data-link-mark")) === "seen" && (await first.locator('[data-link-status="seen"]').count()) === 1, await first.getAttribute("data-link-mark"));
  await first.scrollIntoViewIfNeeded(); await shot(p, `${lang}-seen`);

  // the trying card opens straight on its try, with the way to What helps
  const tc = p.locator('[data-link-card][data-link-mark="trying"]').first();
  await tc.scrollIntoViewIfNeeded(); await tc.locator("button").first().click(); await p.waitForTimeout(900);
  check(`${lang}: a link with a try opens on the try`, (await tc.locator('[data-link-try="running"]').count()) === 1 && (await tc.locator("[data-link-try-helps]").count()) === 1, await tc.locator("[data-link-steps]").getAttribute("data-link-steps").catch(() => null));
  await tc.locator('[data-link-try="running"]').scrollIntoViewIfNeeded(); await shot(p, `${lang}-trying-open`);
  await tc.locator("[data-link-try-helps]").click(); await p.waitForTimeout(1800);
  const helpsOpen = await p.evaluate(() => !!document.querySelector('[data-tour="helps"]') && [...document.querySelectorAll("h2")].some((h) => /What helps|Что помогает/.test(h.textContent)));
  check(`${lang}: "See it in What helps" opens What helps`, helpsOpen);
  await shot(p, `${lang}-to-helps`);
  await closeSheet(p); await closeSheet(p);

  // When to act's tests and What helps' tries say where they came from
  await p.locator('[data-tour="actions"]').click(); await p.waitForTimeout(1500);
  const actFrom = await p.locator("[data-try-from]").allInnerTexts();
  check(`${lang}: When to act says the test came from a link`, actFrom.some((x) => (lang === "en" ? /^From a link: .+ (→|·) .+/ : /^Из связи: .+ (→|·) .+/).test(x)), actFrom);
  if (actFrom.length) { await p.locator("[data-try-from]").first().scrollIntoViewIfNeeded(); }
  await shot(p, `${lang}-act-from`);
  await closeSheet(p);
  await p.locator('[data-tour="helps"]').click(); await p.waitForTimeout(1500);
  const helpsFrom = await p.locator("[data-try-from]").allInnerTexts();
  check(`${lang}: What helps says the try came from a link`, helpsFrom.some((x) => (lang === "en" ? /^From a link: / : /^Из связи: /).test(x)), helpsFrom);
  await shot(p, `${lang}-helps-from`);
  await closeSheet(p);

  // v171 (her pick, Nov 15 2026): no "All about…" on the World; a question lives on its island, one at a time
  check(`${lang}: no "All about…" on the World`, (await p.locator("[data-world-things]").count()) === 0);
  await shot(p, `${lang}-world`);
  await ctx.close();
}
await b.close();
console.log(JSON.stringify(out, null, 1));
if (errs.length) console.log("PAGE ERRORS:", errs.slice(0, 5));
process.exit(fails.length || errs.length ? 1 : 0);
