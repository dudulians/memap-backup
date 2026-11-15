// Her note (Nov 15 2026 night): «открываю карточку [вопроса на острове], там уже должно быть несколько штук того, что мы
// пробуем… идёт тест такой-то… узнаем через несколько дней». The question's page lists every try for it: from a link with
// it, and one picked on the island for it, each with its day and when its result comes. Run from marketing/tools.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r188`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const out = {}, fails = [], errs = [];
for (const lang of ["en", "ru"]) {
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  const sleepId = await p.evaluate(async (lang) => {
    const g = await import("/src/lib/demoDataGenerator.ts"); const r = g.generateDemoData("migraine-cycle");
    localStorage.clear();
    for (const [k, v] of Object.entries({ memap_ui: "new", memap_tour_seen: "true", memap_tour_completed: "1", memap_tour_world: "1", memap_tour_today: "1", memap_language: lang, memap_language_chosen: "true", memap_theme: "aurora-light", memap_first_link_seen: "before", memap_playful_asked: "seed", memap_tips_seen: JSON.stringify(["any-order", "report", "block:world", "you", "notes", "block:helps"]) })) localStorage.setItem(k, v);
    localStorage.setItem("memap_trackers", JSON.stringify(r.newTrackers)); localStorage.setItem("memap_entries", JSON.stringify(r.newEntries));
    localStorage.setItem("memap_path_start", new Date(Date.now() - 59 * 864e5).toISOString().slice(0, 10));
    const i18n = (await import("/src/lib/i18n.ts")).default; await i18n.changeLanguage(lang);
    const ex = await import("/src/lib/experiments.ts"), isl = await import("/src/lib/islands.ts");
    const T = r.newTrackers, sleep = T.find((t) => /^Slept enough/.test(t.title)), coffee = T.find((t) => /^Coffee after/.test(t.title));
    // a try from the coffee → short night link, and one picked on the island for sleep
    await ex.startExperiment(isl.islandOf(coffee), i18n.t("experiment.idea.noCoffee14.change"), i18n.t("experiment.idea.noCoffee14.q"), undefined, { link: [coffee.id, sleep.id].sort().join("|") });
    await ex.startExperiment(isl.islandOf(sleep), i18n.t("experiment.idea.worryList.change"), i18n.t("experiment.idea.worryList.q"));
    return sleep.id;
  }, lang);
  await p.reload(); await p.waitForTimeout(2200);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns" } }))); await p.waitForTimeout(1500);
  await p.evaluate((id) => window.dispatchEvent(new CustomEvent("memap-open-thing", { detail: { id } })), sleepId); await p.waitForTimeout(2200);
  await p.evaluate(() => document.querySelector("[data-thing-row=helps]")?.scrollIntoView({ block: "center" })); await p.waitForTimeout(400);
  await p.screenshot({ path: `${D}/${lang}-card.png` });
  out[`${lang} tries`] = await p.locator("[data-thing-trying]").allInnerTexts();
  if (out[`${lang} tries`].length < 2) fails.push(`${lang}: the question's page should list both tries (got ${out[`${lang} tries`].length})`);
  if (!out[`${lang} tries`].every((s) => /Results in|Итог через/.test(s))) fails.push(`${lang}: each try should say when its result comes`);
  await p.close();
}
console.log(JSON.stringify({ fails, errs, out }, null, 1));
await b.close();
