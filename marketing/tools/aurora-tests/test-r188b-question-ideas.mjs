// Her note (Nov 15 2026 night): from "Did you fight with your partner?" on Love life, "What to try" offered "write to one
// person just because" ("For: no meeting friends"). From a question's page the picker offers that question's own
// changes only, and its head says what it is for. Run from marketing/tools.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r188`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const out = {}, fails = [], errs = [];
for (const lang of ["en", "ru"]) {
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  const info = await p.evaluate(async (lang) => {
    localStorage.clear();
    for (const [k, v] of Object.entries({ memap_ui: "new", memap_tour_seen: "true", memap_tour_completed: "1", memap_tour_world: "1", memap_tour_today: "1", memap_language: lang, memap_language_chosen: "true", memap_theme: "aurora-light", memap_first_link_seen: "before", memap_playful_asked: "seed", memap_tips_seen: JSON.stringify(["any-order", "report", "block:world", "you", "notes", "block:helps"]) })) localStorage.setItem(k, v);
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts"), ti = await import("/src/lib/topicIdeas.ts");
    localStorage.setItem("memap_path_start", dz.daysAgoIso(12));
    // two Love life questions: fights (few, not lit) and seeing friends
    const [fight, friends] = await dz.ensureTemplates(["argued-with-partner", "saw-friends"]);
    const E = []; for (let d = 1; d <= 12; d++) { E.push({ id: `f${d}`, trackerId: fight, date: dz.daysAgoIso(d), value: d % 6 === 0 }); E.push({ id: `s${d}`, trackerId: friends, date: dz.daysAgoIso(d), value: d % 4 === 0 }); }
    await st.saveEntries(E);
    const T = await st.getTrackers();
    return { fight, own: ti.ideasForQuestion(T.find((x) => x.id === fight)), friendsIdeas: ti.ideasForQuestion(T.find((x) => x.id === friends)) };
  }, lang);
  out[`${lang} fight's own ideas`] = info.own;
  await p.reload(); await p.waitForTimeout(2200);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns" } }))); await p.waitForTimeout(1500);
  await p.evaluate((id) => window.dispatchEvent(new CustomEvent("memap-open-thing", { detail: { id } })), info.fight); await p.waitForTimeout(2200);
  const btn = p.locator("[data-thing-try]");
  if (!(await btn.count())) { fails.push(`${lang}: no "What to try" on the fights page`); await p.close(); continue; }
  await btn.first().click(); await p.waitForTimeout(1600);
  await p.screenshot({ path: `${D}/${lang}-fights-try.png` });
  const txt = await p.evaluate(() => ([...document.querySelectorAll("[role=dialog]")].pop()?.innerText ?? "").replace(/\s+/g, " "));
  out[`${lang} picker`] = txt.slice(0, 420);
  const ideaNames = await p.evaluate(async (keys) => { const i18n = (await import("/src/lib/i18n.ts")).default; return keys.map((k) => i18n.t(`experiment.idea.${k}.change`)); }, info.friendsIdeas.filter((k) => !info.own.includes(k)));
  if (ideaNames.some((n) => txt.includes(n))) fails.push(`${lang}: an idea of another question is offered`);
  if (!(await p.locator("[data-pick-for]").count())) fails.push(`${lang}: the head doesn't say what it is for`);
  await p.close();
}
console.log(JSON.stringify({ fails, errs, out }, null, 1));
await b.close();
