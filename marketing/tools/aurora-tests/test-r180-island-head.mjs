// Her note (Nov 15 2026 evening): «когда на острове открываешь вопросы, верхняя часть с вопросом будет зафиксирована».
// The question with its arrows and "1 of N ▾" stays at the top of the island sheet while its rows scroll; the sheet's ×
// does not cover the › arrow. Run from marketing/tools.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r180`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const out = {}, fails = [], errs = [];
for (const [lang, h] of [["en", 844], ["ru", 667]]) {
  const p = await (await b.newContext({ viewport: { width: 390, height: h }, deviceScaleFactor: 2 })).newPage();
  p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  await p.evaluate(async (lang) => {
    const g = await import("/src/lib/demoDataGenerator.ts"); const r = g.generateDemoData("work-home");
    localStorage.clear();
    for (const [k, v] of Object.entries({ memap_ui: "new", memap_tour_seen: "true", memap_tour_completed: "1", memap_tour_world: "1", memap_tour_today: "1", memap_language: lang, memap_language_chosen: "true", memap_theme: "aurora-light", memap_first_link_seen: "before", memap_tips_seen: JSON.stringify(["any-order", "report", "block:world"]) })) localStorage.setItem(k, v);
    localStorage.setItem("memap_trackers", JSON.stringify(r.newTrackers)); localStorage.setItem("memap_entries", JSON.stringify(r.newEntries));
    localStorage.setItem("memap_path_start", new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 10));
  }, lang);
  await p.reload(); await p.waitForTimeout(2200);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns" } }))); await p.waitForTimeout(1800);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-island", { detail: { island: "health" } }))); await p.waitForTimeout(1800);
  const head0 = await p.evaluate(() => document.querySelector("[data-question-head]")?.getBoundingClientRect().top ?? null);
  await p.evaluate(() => { const sc = document.querySelector("[data-island-things]")?.closest(".overflow-y-auto"); if (sc) sc.scrollTop = 500; }); await p.waitForTimeout(600);
  await p.screenshot({ path: `${D}/${lang}-island-scrolled.png` });
  const r = await p.evaluate(() => {
    const head = document.querySelector("[data-question-head]")?.getBoundingClientRect();
    const sc = document.querySelector("[data-island-things]")?.closest(".overflow-y-auto")?.getBoundingClientRect();
    const next = document.querySelector("[data-question-switcher] button:last-child")?.getBoundingClientRect();
    const x = [...document.querySelectorAll("[role=dialog] button")].find((el) => /close|закрыть/i.test(el.getAttribute("aria-label") ?? "") || el.querySelector("svg.lucide-x"))?.getBoundingClientRect();
    return { headTop: head?.top, scTop: sc?.top, nextTop: next?.top, xBottom: x?.bottom, xLeft: x?.left, nextRight: next?.right };
  });
  out[`${lang}`] = { head0, ...r };
  if (r.headTop == null || Math.abs(r.headTop - r.scTop) > 2) fails.push(`${lang}: the question head did not stay at the top (${r.headTop} vs ${r.scTop})`);
  // the × stays above the head (it was covered once stuck)
  const xOnTop = await p.evaluate(() => { const x = [...document.querySelectorAll("[role=dialog] button")].find((el) => el.querySelector("svg.lucide-x")); if (!x) return null; const r = x.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest("button") === x; });
  if (xOnTop === false) fails.push(`${lang}: the question head covers the sheet's ×`);
  if (r.xBottom != null && r.nextTop != null && r.nextTop < r.xBottom && r.nextRight > r.xLeft) fails.push(`${lang}: the sheet's × covers the › arrow`);
  await p.close();
}
console.log(JSON.stringify({ fails, errs, out }, null, 1));
await b.close();
