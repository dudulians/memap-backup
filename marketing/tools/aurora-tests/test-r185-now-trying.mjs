// Her notes (Nov 15 2026 night): the try picker showed an empty list and, at the bottom, a grey note that "Write 3 lines"
// was already running; on other questions the same note about "Walk 20 minutes". Now: "You're trying now" on top with
// the running try (day k of 14, opens it in What helps), then "Something else to try?"; no ready ideas = said so; no
// grey note at the bottom. What helps: "You're trying now" over the running tries and "Try something else".
// Run from marketing/tools.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r185`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const out = {}, fails = [], errs = [];
for (const lang of ["en", "ru"]) {
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  await p.evaluate(async (lang) => {
    const g = await import("/src/lib/demoDataGenerator.ts"); const r = g.generateDemoData("migraine-cycle");
    localStorage.clear();
    for (const [k, v] of Object.entries({ memap_ui: "new", memap_tour_seen: "true", memap_tour_completed: "1", memap_tour_world: "1", memap_tour_today: "1", memap_language: lang, memap_language_chosen: "true", memap_theme: "aurora-light", memap_first_link_seen: "before", memap_playful_asked: "seed", memap_tips_seen: JSON.stringify(["any-order", "report", "block:world", "you", "notes", "block:helps"]), memap_examples_seen: JSON.stringify(["link", "month", "rule", "test", "chart", "chart-one"]) })) localStorage.setItem(k, v);
    localStorage.setItem("memap_trackers", JSON.stringify(r.newTrackers)); localStorage.setItem("memap_entries", JSON.stringify(r.newEntries));
    localStorage.setItem("memap_path_start", new Date(Date.now() - 59 * 864e5).toISOString().slice(0, 10));
    const i18n = (await import("/src/lib/i18n.ts")).default; await i18n.changeLanguage(lang);
    const ex = await import("/src/lib/experiments.ts"), isl = await import("/src/lib/islands.ts");
    const stress = r.newTrackers.find((t) => /^Stressful/.test(t.title));
    await ex.startExperiment(isl.islandOf(stress), i18n.t("experiment.idea.threeLines.change"), i18n.t("experiment.idea.threeLines.q"));
  }, lang);
  await p.reload(); await p.waitForTimeout(2200);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns" } }))); await p.waitForTimeout(1500);
  // "What to try" under a link from stress (its own changes: breathe, walk, outside, 3 lines)
  await p.evaluate(async () => {
    const T = JSON.parse(localStorage.getItem("memap_trackers")); const a = T.find((t) => /^Stressful/.test(t.title)), c = T.find((t) => /headache/i.test(t.title));
    const isl = await import("/src/lib/islands.ts");
    window.dispatchEvent(new CustomEvent("memap-link-try", { detail: { island: isl.islandOf(a), link: [a.id, c.id].sort().join("|"), ids: [a.id, c.id], about: a.id, aboutYes: true } }));
  });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${D}/${lang}-picker.png` });
  const pick = await p.evaluate(() => ([...document.querySelectorAll("[role=dialog]")].pop()?.innerText ?? "").replace(/\s+/g, " "));
  out[`${lang} picker`] = pick.slice(0, 420);
  if (!(await p.locator("[data-now-trying]").count())) fails.push(`${lang}: the running try is not on top`);
  if (/Also running on this island|На этом острове уже идёт/.test(pick)) fails.push(`${lang}: the grey note is still there`);
  if (!/Something else to try\?|Попробовать что-то ещё\?/.test(pick)) fails.push(`${lang}: no "Something else to try?"`);
  // What helps
  for (let i = 0; i < 3; i++) { await p.keyboard.press("Escape"); await p.waitForTimeout(400); }
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-helps", { detail: {} }))); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${D}/${lang}-helps.png` });
  const helps = await p.evaluate(() => ([...document.querySelectorAll("[role=dialog]")].pop()?.innerText ?? "").replace(/\s+/g, " "));
  out[`${lang} helps`] = helps.slice(0, 300);
  if (!/You're trying now|Сейчас пробуешь/i.test(helps) || !/Try something else|Попробовать что-то ещё/i.test(helps)) fails.push(`${lang}: What helps should say what is running and offer something else`);
  await p.close();
}
console.log(JSON.stringify({ fails, errs, out }, null, 1));
await b.close();
