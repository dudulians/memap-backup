// Her question (Nov 7 2026): an old user tries the new look, adds questions from the new
// library (research, body with a follow-up, a marker, a private one, a reworded one, a test,
// her own question with answer words, a door), answers for 20 days, then goes back to the
// old look. Does everything still work there, and is nothing lost when coming back?
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r66`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const out = {}, errs = [];
const BAD = /undefined|NaN|\{\{|\b(link|tips|support|redFlags|onb7|path)\.[a-z]+[A-Za-z]*\b/;
const scan = async (p, where) => {
  const txt = await p.evaluate(() => document.body.innerText);
  const m = txt.match(BAD); if (m) out[`BAD ${where}`] = txt.slice(Math.max(0, m.index - 80), m.index + 80).replace(/\s+/g, " ");
};
for (const lang of ["en", "ru"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, timezoneId: "Asia/Dubai" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  const before = await p.evaluate(async (lang) => {
    localStorage.clear();
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1");
    localStorage.setItem("memap_tour_completed", "1"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" }));
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts"), ex = await import("/src/lib/experiments.ts");
    const { trackerId, contextTrackerIds } = await dz.ensureDoorTrackers(dz.getDoor("migraine"));
    dz.saveDoorState({ id: "migraine", trackerId, contextTrackerIds, startedAt: dz.daysAgoIso(20) });
    await dz.ensureTemplates(["lost-interest", "caffeine-4-plus", "period-day", "heavy-flow-day", "medicine-change", "pooped-today", "back-or-neck-pain", "felt-depressed"]);
    await ex.startExperiment("health", "No coffee after 14:00", "Did you skip coffee after 14:00?");
    const T = await st.getTrackers();
    T.push({ id: `${Date.now()}-own`, title: "Walked the dog", category: "Curious", questionText: "Did you walk the dog?", answerType: "boolean", periodDays: 30, threshold: 5, problemWhen: "no", adviceAboveThreshold: "", createdAt: new Date().toISOString(), words: { yes: "walked the dog", no: "no dog walk" }, island: "me" });
    await st.saveTrackers(T);
    const T2 = await st.getTrackers(); const E = [];
    for (let d = 1; d <= 20; d++) for (const tr of T2) E.push({ id: `${tr.id}-${d}`, trackerId: tr.id, date: dz.daysAgoIso(d), value: (d + tr.title.length) % 3 === 0 });
    await st.saveEntries(E);
    return { trackers: T2.length, entries: E.length, titles: T2.map((x) => x.title) };
  }, lang);
  out[`${lang} before`] = before;
  // the new look renders
  await p.reload(); await p.waitForTimeout(2400); await scan(p, `${lang} new today`);
  // → the old look
  await p.evaluate(() => { localStorage.setItem("memap_ui", "classic"); localStorage.setItem("memap_upgrade_invite", "declined:" + new Date().toISOString().slice(0, 10)); });
  await p.reload(); await p.waitForTimeout(2600);
  await p.screenshot({ path: `${D}/${lang}-classic-today.png` }); await scan(p, `${lang} classic today`);
  // the evening session in the old look: answer everything
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-session"))); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${D}/${lang}-classic-session.png` });
  const asked = [];
  for (let k = 0; k < 30; k++) {
    const q = await p.evaluate(() => [...document.querySelectorAll("[role=dialog] h2, [role=dialog] h3, [role=dialog] p")].map((x) => x.textContent?.trim() ?? "").filter((s) => s.endsWith("?")).slice(-1)[0] ?? "");
    const btn = p.getByRole("button", { name: k % 2 ? (lang === "ru" ? /^Да$/ : /^Yes$/) : (lang === "ru" ? /^Нет$/ : /^No$/) });
    if (!q || !(await btn.count())) break;
    asked.push(q.slice(0, 60)); await btn.last().click(); await p.waitForTimeout(650);
  }
  out[`${lang} classic asked`] = asked.length; out[`${lang} classic questions`] = asked;
  await p.screenshot({ path: `${D}/${lang}-classic-session-end.png` }); await scan(p, `${lang} classic session end`);
  await p.keyboard.press("Escape"); await p.waitForTimeout(800);
  // patterns and notes tabs
  const navs = p.locator("nav button");
  const n = await navs.count();
  for (let i = 0; i < n; i++) {
    await navs.nth(i).click({ timeout: 4000 }).catch(() => {}); await p.waitForTimeout(1600);
    await p.screenshot({ path: `${D}/${lang}-classic-tab${i}.png` }); await scan(p, `${lang} classic tab${i}`);
    await p.keyboard.press("Escape"); await p.waitForTimeout(500);
  }
  // back to the new look the way the invite does it: nothing lost, and the way back is shown
  await p.evaluate(async () => { const dz = await import("/src/lib/doors.ts"); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_upgrade_invite", "accepted"); localStorage.setItem("memap_path_start", dz.isoLocal(new Date())); });
  await p.reload(); await p.waitForTimeout(4200); await scan(p, `${lang} new again`);
  await p.screenshot({ path: `${D}/${lang}-new-again.png` });
  out[`${lang} old-look card`] = await p.getByText(/Miss the old look?|Скучаешь по старому виду?/).count();
  out[`${lang} settings row`] = null;
  out[`${lang} after`] = await p.evaluate(async () => { const st = await import("/src/lib/storage.ts"); const T = await st.getTrackers(); const E = await st.getEntries(); return { trackers: T.length, entries: E.length, ownWords: T.find((x) => x.title === "Walked the dog")?.words ?? null, door: !!localStorage.getItem("memap_door") }; });
  await p.locator("nav button").nth(1).click().catch(() => {}); await p.waitForTimeout(2200);
  await p.screenshot({ path: `${D}/${lang}-new-world.png` }); await scan(p, `${lang} new world`);
  // the card button takes them back
  await p.locator("nav button").nth(0).click().catch(() => {}); await p.waitForTimeout(4000);
  const back = p.getByRole("button", { name: /Back to the old look|Вернуть старый вид/ });
  if (await back.count()) { await back.first().click(); await p.waitForTimeout(2500); out[`${lang} back to`] = await p.evaluate(() => localStorage.getItem("memap_ui")); }
  await ctx.close();
}
console.log(JSON.stringify({ out, errs }, null, 1));
await b.close();
