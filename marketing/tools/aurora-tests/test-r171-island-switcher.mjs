// r171 (Nov 15 2026, branch design/one-system): the World as she picked it on the boards.
// 1. An island shows one question at a time: ‹ question › and "Question 1 of N ▾", whose it is, and its four rows
//    (My days, Links, When to act, What helps); the arrows switch questions like the calendar's months.
// 2. ▾ lists the island's questions, hers first ("Yours", then "MeMap suggested"); a tap there picks one.
// 3. A question opened from elsewhere (memap-open-thing) opens its island on that question.
// 4. Share is a pale circle on top of the globe's column (variant B); the header has no Share and no "All about…".
// Run from marketing/tools with the dev server on 8080; exit 1 when a check fails.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r171`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const check = (name, ok, info) => { out[name] = ok ? "ok" : `FAIL ${info !== undefined ? JSON.stringify(info).slice(0, 400) : ""}`; if (!ok) fails.push(name); };
for (const lang of ["en", "ru"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  const ids = await p.evaluate(async (lang) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); const r = g.generateDemoData("work-home");
    const isl = await import("/src/lib/islands.ts");
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(r.newTrackers)); localStorage.setItem("memap_entries", JSON.stringify(r.newEntries));
    localStorage.setItem("memap_path_start", [...r.newEntries.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1");
    localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order", "report", "block:world"]));
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_playful_asked", "seed");
    // the topic she came with: the first love-life question
    const love = r.newTrackers.filter((t) => isl.islandOf(t) === "love");
    localStorage.setItem("memap_door", JSON.stringify({ id: "fights", trackerId: love[0].id, contextTrackerIds: [], startedAt: iso(30) }));
    return love.map((t) => t.id);
  }, lang);
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(1800);
  await p.locator("button").filter({ hasText: lang === "en" ? /^World$/ : /^Мир$/ }).last().click(); await p.waitForTimeout(2800);
  // 4. the header and the globe's column
  check(`${lang}: no "All about…" in the header`, (await p.locator("[data-world-things]").count()) === 0);
  const share = await p.evaluate(() => { const s = document.querySelector("[data-world-share]"); return s ? !!s.closest("[data-globe-controls]") : null; });
  check(`${lang}: Share sits on top of the globe's column`, share === true, share);
  await p.screenshot({ path: `${D}/${lang}-world.png` });
  // 1. an island, one question at a time
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-island", { detail: { island: "love" } }))); await p.waitForTimeout(1600);
  const sw = p.locator("[data-question-switcher]");
  check(`${lang}: the island has the question switcher`, (await sw.count()) === 1);
  const of = (await p.locator("[data-question-list]").innerText()).replace(/\s+/g, " ");
  check(`${lang}: it says which question of how many`, (lang === "en" ? new RegExp(`1 of ${ids.length}`) : new RegExp(`1 из ${ids.length}`)).test(of), of);
  const whose = (await p.locator("[data-question-whose]").innerText()).trim();
  check(`${lang}: the first is hers, the topic she came with`, lang === "en" ? /Yours · you came with this/.test(whose) : /Твой · с него всё началось/.test(whose), whose);
  const rows = await p.locator("[data-island-things] [data-thing-row]").evaluateAll((els) => els.map((e) => e.getAttribute("data-thing-row")));
  check(`${lang}: four rows in the app's order`, rows.join() === "days,links,act,helps", rows);
  await p.screenshot({ path: `${D}/${lang}-island-1.png` });
  const q1 = await p.locator("[data-switcher-question]").innerText();
  await sw.getByRole("button", { name: lang === "en" ? "Next question" : "Следующий вопрос" }).click(); await p.waitForTimeout(500);
  const q2 = await p.locator("[data-switcher-question]").innerText();
  const of2 = (await p.locator("[data-question-list]").innerText()).replace(/\s+/g, " ");
  check(`${lang}: › shows the next question`, q2 !== q1 && (lang === "en" ? /2 of/ : /2 из/).test(of2), { q1, q2, of2 });
  // 2. the list
  await p.locator("[data-question-list]").click(); await p.waitForTimeout(900);
  const sheet = p.locator("[role=dialog]").last();
  const listText = (await sheet.innerText()).replace(/\s+/g, " ");
  check(`${lang}: ▾ lists hers first, then MeMap's`, lang === "en" ? /YOURS.*MEMAP SUGGESTED/i.test(listText) : /ТВОИ.*ПРЕДЛОЖИЛ MEMAP/i.test(listText), listText.slice(0, 200));
  await p.screenshot({ path: `${D}/${lang}-list.png` });
  await sheet.locator("[data-open-thing]").first().click(); await p.waitForTimeout(900);
  check(`${lang}: a tap in the list picks that question`, (await p.locator("[data-switcher-question]").innerText()) === q1);
  await p.keyboard.press("Escape"); await p.waitForTimeout(900);
  // 3. a question opened from elsewhere
  const last = ids[ids.length - 1];
  await p.evaluate((id) => window.dispatchEvent(new CustomEvent("memap-open-thing", { detail: { id } })), last); await p.waitForTimeout(1600);
  const of3 = (await p.locator("[data-question-list]").innerText().catch(() => "")).replace(/\s+/g, " ");
  check(`${lang}: memap-open-thing opens its island on that question`, (lang === "en" ? new RegExp(`${ids.length} of ${ids.length}`) : new RegExp(`${ids.length} из ${ids.length}`)).test(of3) || ids.length === 1, of3);
  await p.screenshot({ path: `${D}/${lang}-opened.png` });
  await ctx.close();
}
console.log(JSON.stringify({ ...out, errs }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
