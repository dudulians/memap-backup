// Her phone note (Nov 15 2026): «что это за странный вопрос, откуда он вылез» — a try's evening question ("No nausea
// today counts as yes. Each time it came, did you note…") stood in My days as "Question 8 of 8". A try's question is
// not one of her questions: not in My days, not among the island's questions; still asked in the evening; its home is
// What helps. Run from marketing/tools.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r179`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const out = {}, fails = [], errs = [];
const ok = (cond, what) => { if (!cond) fails.push(what); };
for (const lang of ["en", "ru"]) {
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  const seeded = await p.evaluate(async (lang) => {
    localStorage.clear();
    for (const [k, v] of Object.entries({ memap_ui: "new", memap_tour_seen: "true", memap_tour_completed: "1", memap_tour_world: "1", memap_language: lang, memap_language_chosen: "true", memap_theme: "aurora-light", memap_ab_onb: "A", memap_first_link_seen: "before", memap_tips_seen: JSON.stringify(["any-order", "report", "block:world"]) })) localStorage.setItem(k, v);
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts"), ex = await import("/src/lib/experiments.ts"), i18n = (await import("/src/lib/i18n.ts")).default;
    await i18n.changeLanguage(lang);
    localStorage.setItem("memap_path_start", dz.daysAgoIso(12));
    const ids = await dz.ensureTemplates(["felt-nauseous", "slept-enough", "felt-stressed"]);
    const E = []; for (let d = 1; d <= 12; d++) ids.forEach((id, i) => E.push({ id: `e${d}-${i}`, trackerId: id, date: dz.daysAgoIso(d), value: (d + i) % 3 === 0 }));
    await st.saveEntries(E);
    const nausea = (await st.getTrackers()).find((t) => t.id === ids[0]);
    await ex.startExperiment("health", "Note the time and what came before each time nausea comes", i18n.t("experiment.idea.nauseaNote.q"), nausea?.id);
    const T = await st.getTrackers();
    return { questions: T.length, tests: T.filter((t) => t.id.endsWith("-test")).map((t) => t.questionText) };
  }, lang);
  out[`${lang} seeded`] = seeded;
  await p.reload(); await p.waitForTimeout(2400);
  // still asked in the evening: Today's steps carry it
  out[`${lang} evening asks it`] = await p.evaluate(async () => { const st = await import("/src/lib/storage.ts"); return (await st.getTrackers()).some((t) => t.id.endsWith("-test")); });
  // My days
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns" } }))); await p.waitForTimeout(2000);
  await p.evaluate(() => document.querySelector("[data-tour=calendar]")?.click()); await p.waitForTimeout(1600);
  const cal = await p.evaluate(() => ([...document.querySelectorAll("[role=dialog]")].pop()?.innerText ?? "").replace(/\s+/g, " "));
  await p.screenshot({ path: `${D}/${lang}-my-days.png` });
  out[`${lang} my days`] = cal.slice(0, 260);
  ok(!/counts as yes|считается за «да»|считается как|note the time|отмеч/i.test(cal), `${lang}: the try's question is in My days`);
  ok(/(of|из) 3\b/.test(cal), `${lang}: My days should count 3 questions`);
  await p.keyboard.press("Escape"); await p.waitForTimeout(500); await p.keyboard.press("Escape"); await p.waitForTimeout(500);
  // the island
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-island", { detail: { island: "health" } }))); await p.waitForTimeout(1800);
  const isl = await p.evaluate(() => ([...document.querySelectorAll("[role=dialog]")].pop()?.innerText ?? "").replace(/\s+/g, " "));
  await p.screenshot({ path: `${D}/${lang}-island.png` });
  out[`${lang} island`] = isl.slice(0, 300);
  ok(!/counts as yes|считается/i.test(isl), `${lang}: the try's question is among the island's questions`);
  // the try is named in her language on the island (it said "Note the time…" in Russian)
  if (lang === "ru") ok(/Сейчас пробуешь: Записывать время/.test(isl), "ru: the try on the island is named in Russian");
  await p.close();
}
console.log(JSON.stringify({ fails, errs, out }, null, 1));
await b.close();
