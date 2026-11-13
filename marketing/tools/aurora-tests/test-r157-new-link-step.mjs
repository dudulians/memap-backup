// r157 (Nov 13 2026, branch design/one-system): every new link comes to Today as a step.
// 1. An install that already has links gets no "New link" step for them.
// 2. When a link is found that was not seen (one pair taken out of the seen list), Today shows "New link".
// 3. Starting it opens Links, and back on Today the step is done; no second "New link" waits.
// Run from marketing/tools with the dev server on 8080; exit 1 when a check fails.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r157`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const check = (name, ok, info) => { out[name] = ok ? "ok" : `FAIL ${info !== undefined ? JSON.stringify(info).slice(0, 400) : ""}`; if (!ok) fails.push(name); };
for (const lang of ["en", "ru"]) {
  const NEW = lang === "en" ? "New link" : "Новая связь";
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
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
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(2200);
  const text = () => p.evaluate(() => document.querySelector("main")?.innerText ?? "");
  check(`${lang}: no "New link" step for links that were already there`, !(await text()).includes(NEW));
  const seen = await p.evaluate(() => JSON.parse(localStorage.getItem("memap_links_seen") || "null"));
  check(`${lang}: the links that were there are kept as seen`, Array.isArray(seen) && seen.length >= 2, seen);
  // one link becomes "new": take it out of the seen list
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem("memap_links_seen")); localStorage.setItem("memap_links_seen", JSON.stringify(s.slice(1))); });
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(2200);
  check(`${lang}: a link not seen yet shows as a "New link" step`, (await text()).includes(NEW), (await text()).slice(0, 300));
  await p.screenshot({ path: `${D}/${lang}-1-step.png` });
  // the step's own button on the path, then the action on its card (clicked in the page: the path box sits over them)
  await p.evaluate((NEW) => { const el = [...document.querySelectorAll("main button")].find((x) => x.innerText.includes(NEW)) ?? [...document.querySelectorAll("main *")].find((x) => x.childElementCount === 0 && x.textContent.trim() === NEW)?.closest("button"); el?.click(); }, NEW);
  await p.waitForTimeout(800);
  const acted = await p.evaluate(() => { const re = /^(See it|Go|Start|Посмотреть|Открыть|Вперёд|Начать|Смотреть)$/; const btn = [...document.querySelectorAll("button")].filter((x) => re.test(x.innerText.trim())); btn[btn.length - 1]?.click(); return btn.map((x) => x.innerText.trim()); });
  out[`${lang} action buttons`] = acted;
  await p.waitForTimeout(2600);
  check(`${lang}: it opens Links`, (await p.locator("[data-link-card]").count()) >= 1, await p.locator("[role=dialog]").last().innerText().catch(() => "none"));
  await p.screenshot({ path: `${D}/${lang}-2-links.png` });
  const after = await p.evaluate(() => ({ seen: JSON.parse(localStorage.getItem("memap_links_seen") || "[]").length, day: localStorage.getItem("memap_links_seen_day") }));
  check(`${lang}: the links are seen now`, after.seen >= seen.length && !!after.day, after);
  await ctx.close();
}
await b.close();
console.log(JSON.stringify(out, null, 1));
if (errs.length) console.log("PAGE ERRORS:", errs.slice(0, 5));
process.exit(fails.length || errs.length ? 1 : 0);
