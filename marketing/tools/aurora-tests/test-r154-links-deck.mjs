// r154 (Nov 13 2026, branch design/one-system): Links opens as cards one by one, swiped sideways; the list is an option.
// 1. Links shows a deck: every card open (its chart is there), "5 findings · swipe", a pager.
// 2. Swiping to the next card lights the next pager dot.
// 3. "See all as a list" shows the list (closed cards); "Show one by one" brings the deck back; the choice is kept.
// Screenshots in work/r154. Run from marketing/tools with the dev server on 8080; exit 1 when a check fails.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r154`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const check = (name, ok, info) => { out[name] = ok ? "ok" : `FAIL ${info !== undefined ? JSON.stringify(info).slice(0, 400) : ""}`; if (!ok) fails.push(name); };
let n = 0;
for (const lang of ["en", "ru"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
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
  await p.locator("button").filter({ hasText: lang === "en" ? /^World$/ : /^Мир$/ }).last().click(); await p.waitForTimeout(2500);
  await p.locator('[data-tour="links-card"]').click(); await p.waitForTimeout(1400);
  const shot = async (name) => { await p.waitForTimeout(400); await p.screenshot({ path: `${D}/${String(++n).padStart(2, "0")}-${lang}-${name}.png` }); };
  const st = await p.evaluate(() => ({ deck: !!document.querySelector("[data-links-deck]"), items: document.querySelectorAll("[data-deck-item]").length, charts: document.querySelectorAll("[data-deck-item] [data-link-chart-inline]").length, cards: document.querySelectorAll("[data-deck-item] [data-link-card]").length, head: document.querySelector("[data-deck-head]")?.textContent ?? "", dots: document.querySelectorAll("[data-deck-pager] span").length, wide: document.documentElement.scrollWidth }));
  out[`${lang} deck`] = st;
  check(`${lang}: Links is a deck of open cards`, st.deck && st.items >= 2 && st.charts === st.cards && st.cards >= 2, st);
  check(`${lang}: the head counts the cards and says to swipe`, (lang === "en" ? /^\d+ findings · swipe$/ : /^\d+ наход\S+ · листай$/).test(st.head) && st.dots === st.items, st);
  check(`${lang}: the page itself does not scroll sideways`, st.wide <= 390, st.wide);
  await shot("deck");
  await p.evaluate(() => { const el = document.querySelector("[data-links-deck]"); el.scrollTo({ left: el.firstElementChild.offsetWidth + 12 }); }); await p.waitForTimeout(700);
  const on = await p.evaluate(() => [...document.querySelectorAll("[data-deck-pager] span")].findIndex((x) => x.className.includes("w-5")));
  check(`${lang}: after a swipe the second dot is lit`, on === 1, on);
  await shot("deck-second");
  await p.locator("[data-links-as-list]").click(); await p.waitForTimeout(600);
  const list = await p.evaluate(() => ({ deck: !!document.querySelector("[data-links-deck]"), closed: document.querySelectorAll("[data-link-card] button[aria-expanded=false]").length, pref: localStorage.getItem("memap_links_view") }));
  check(`${lang}: "See all as a list" shows the list and keeps the choice`, !list.deck && list.closed >= 2 && list.pref === "list", list);
  await p.locator("[data-links-as-deck]").scrollIntoViewIfNeeded(); await p.locator("[data-links-as-deck]").click(); await p.waitForTimeout(600);
  check(`${lang}: "Show one by one" brings the deck back`, await p.evaluate(() => !!document.querySelector("[data-links-deck]") && localStorage.getItem("memap_links_view") === "deck"));
  await ctx.close();
}
await b.close();
console.log(JSON.stringify(out, null, 1));
if (errs.length) console.log("PAGE ERRORS:", errs.slice(0, 5));
process.exit(fails.length || errs.length ? 1 : 0);
