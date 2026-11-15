// Her notes (Nov 15 2026 night): «давай фиксировать заголовки» (Links, When to act, What helps) and «не хватает, к чему я
// это делаю… «заряжать телефон вне спальни» — не понимаю, к чему это». A try picked on an island says what it is for
// ("For: Short night") in What helps and in the picker; the World's sheets keep their head on top. Run from marketing/tools.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r186`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const out = {}, fails = [], errs = [];
for (const lang of ["en", "ru"]) {
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  await p.evaluate(async (lang) => {
    const g = await import("/src/lib/demoDataGenerator.ts"); const r = g.generateDemoData("migraine-cycle");
    localStorage.clear();
    for (const [k, v] of Object.entries({ memap_ui: "new", memap_tour_seen: "true", memap_tour_completed: "1", memap_tour_world: "1", memap_tour_today: "1", memap_language: lang, memap_language_chosen: "true", memap_theme: "aurora-light", memap_first_link_seen: "before", memap_playful_asked: "seed", memap_tips_seen: JSON.stringify(["any-order", "report", "block:world", "you", "notes", "block:helps", "block:findings", "block:signals"]), memap_examples_seen: JSON.stringify(["link", "month", "rule", "test", "chart", "chart-one"]) })) localStorage.setItem(k, v);
    localStorage.setItem("memap_trackers", JSON.stringify(r.newTrackers)); localStorage.setItem("memap_entries", JSON.stringify(r.newEntries));
    localStorage.setItem("memap_path_start", new Date(Date.now() - 59 * 864e5).toISOString().slice(0, 10));
    const i18n = (await import("/src/lib/i18n.ts")).default; await i18n.changeLanguage(lang);
    const ex = await import("/src/lib/experiments.ts"), isl = await import("/src/lib/islands.ts");
    const screens = r.newTrackers.find((t) => /^Screens before bed/.test(t.title));
    // picked on the island, not from a link or When to act
    await ex.startExperiment(isl.islandOf(screens), i18n.t("experiment.idea.chargeOutside.change"), i18n.t("experiment.idea.chargeOutside.q"));
  }, lang);
  await p.reload(); await p.waitForTimeout(2200);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns" } }))); await p.waitForTimeout(1500);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-helps", { detail: {} }))); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${D}/${lang}-helps.png` });
  const helps = await p.evaluate(() => ([...document.querySelectorAll("[role=dialog]")].pop()?.innerText ?? "").replace(/\s+/g, " "));
  out[`${lang} helps`] = helps.slice(0, 260);
  if (!/For: |К чему: /.test(helps)) fails.push(`${lang}: the try picked on an island doesn't say what it is for`);
  // "Try something else": the island's ideas say what each is for
  await p.locator("[role=dialog] button", { hasText: /Try something else|Попробовать что-то ещё/ }).first().click(); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${D}/${lang}-picker.png` });
  out[`${lang} idea lines`] = await p.locator("[data-idea-for]").allInnerTexts();
  if (!out[`${lang} idea lines`].length) fails.push(`${lang}: the island's ideas don't say what they are for`);
  for (let i = 0; i < 3; i++) { await p.keyboard.press("Escape"); await p.waitForTimeout(400); }
  // Links: the head stays on top while the list scrolls
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "findings", back: true } }))); await p.waitForTimeout(1800);
  await p.evaluate(() => { const sc = document.querySelector("[data-sheet-head]")?.closest(".overflow-y-auto"); if (sc) sc.scrollTop = 900; }); await p.waitForTimeout(500);
  await p.screenshot({ path: `${D}/${lang}-links-scrolled.png` });
  const head = await p.evaluate(() => { const h = document.querySelector("[data-sheet-head]")?.getBoundingClientRect(), sc = document.querySelector("[data-sheet-head]")?.closest(".overflow-y-auto")?.getBoundingClientRect(); return h && sc ? Math.round(h.top - sc.top) : null; });
  if (head === null || Math.abs(head) > 2) fails.push(`${lang}: the Links head did not stay on top (${head})`);
  await p.close();
}
console.log(JSON.stringify({ fails, errs, out }, null, 1));
await b.close();
