// r154/r155 (Nov 13 2026, branch design/one-system): Links is a list that scrolls down, its first card open (the sideways deck of v154 was taken back: it fought the chart's and the calendar's own sideways gestures).
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
  // r155: everything scrolls down. Links is a list; its first card is open from the start; nothing swipes sideways.
  const st = await p.evaluate(() => ({ deck: !!document.querySelector("[data-links-deck]"), cards: document.querySelectorAll("[data-link-card]").length, open: [...document.querySelectorAll("[data-link-card]")].map((c) => !!c.querySelector("[data-link-chart-inline]")), buttons: document.querySelectorAll("[data-links-as-list], [data-links-as-deck]").length, wide: document.documentElement.scrollWidth }));
  out[`${lang} list`] = st;
  check(`${lang}: Links is a list, no sideways deck and no switch`, !st.deck && st.buttons === 0 && st.cards >= 2, st);
  check(`${lang}: the first card is open from the start, the others closed`, st.open[0] === true && st.open.slice(1).every((x) => !x), st.open);
  check(`${lang}: the page does not scroll sideways`, st.wide <= 390, st.wide);
  await shot("list-first-open");
  await ctx.close();
}
await b.close();
console.log(JSON.stringify(out, null, 1));
if (errs.length) console.log("PAGE ERRORS:", errs.slice(0, 5));
process.exit(fails.length || errs.length ? 1 : 0);
