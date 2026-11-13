// The answer phrases (her note, Nov 6 2026: links built from titles "выглядят жутко"):
// every library question has its yes/no words; sample links read like a person wrote them;
// her own question shows as it is with its answer. Then a real link card, EN and RU.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r57`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
for (const lang of ["en", "ru"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  await p.evaluate((lang) => { localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1"); }, lang);
  await p.reload(); await p.waitForTimeout(1500);
  out[lang] = await p.evaluate(async () => {
    const L = await import("/src/lib/lifeStreams.ts"), A = await import("/src/lib/answerPhrases.ts"), T = await import("/src/lib/linkText.ts");
    const { default: i18n } = await import("/src/lib/i18n.ts");
    const t = i18n.t.bind(i18n);
    const all = L.LIFE_STREAMS.flatMap((s) => s.templates);
    const missing = all.filter((x) => !A.phraseIds().includes(x.id) || !A.sentenceIds().includes(x.id)).map((x) => x.id);
    const tr = (id, title = id) => ({ id: `1793-${id}-0`, title, problemWhen: "yes" });
    const own = { id: "1793-own-ab12", title: "Walked the dog", problemWhen: "yes" };
    const ts = [tr("slept-enough"), tr("migraine"), tr("coffee-late"), tr("outside-30min"), tr("felt-fatigued"), tr("felt-anxious"), tr("wanted-leave-job"), tr("argued-with-partner"), own];
    const of = T.trackerLookup(ts);
    const R = (f, fy, s, sy, nextDay) => ({ first: `1793-${f}-0`, second: `1793-${s}-0`, firstYes: fy, secondYes: sy, nextDay, k: 4, n: 5, other: { k: 3, n: 24 } });
    const routes = [R("slept-enough", false, "migraine", true, false), R("coffee-late", true, "slept-enough", false, true), R("outside-30min", false, "felt-fatigued", true, true), R("felt-anxious", true, "slept-enough", false, false), R("argued-with-partner", true, "wanted-leave-job", true, false), { ...R("argued-with-partner", true, "slept-enough", true, false), k: 6, n: 10 }, { ...R("coffee-late", true, "migraine", true, true), k: 9, n: 10 }];
    routes.push({ ...R("x", false, "migraine", true, false), first: own.id });
    return { missing, total: all.length, lines: routes.map((r) => `${T.linkHead(t, r, of)}  |  ${T.linkCount(t, r)}`) };
  });
  await ctx.close();
}
// a real link card and the "steady" card (quit door, 16 days)
for (const lang of ["en", "ru"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  await p.evaluate(async (lang) => {
    localStorage.clear();
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1");
    localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" }));
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    const { trackerId, contextTrackerIds } = await dz.ensureDoorTrackers(dz.getDoor("migraine"));
    dz.saveDoorState({ id: "migraine", trackerId, contextTrackerIds, startedAt: dz.daysAgoIso(30) });
    const [sleep, anx, ate] = contextTrackerIds; const E = [];
    for (let d = 1; d <= 30; d++) {
      const date = dz.daysAgoIso(d), bad = d % 3 === 0;
      E.push({ id: `${d}a`, trackerId: sleep, date, value: !bad }, { id: `${d}b`, trackerId: anx, date, value: d % 4 === 0 }, { id: `${d}c`, trackerId: ate, date, value: d % 2 === 0 }, { id: `${d}m`, trackerId, date, value: bad ? d !== 12 : d === 5 });
    }
    await st.saveEntries(E);
  }, lang);
  await p.reload(); await p.waitForTimeout(2200);
  await p.locator("nav button").nth(1).click(); await p.waitForTimeout(2200);
  await p.locator("[data-tour='links-card']").click(); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${D}/${lang}-links.png` });
  out[`${lang} links`] = await p.evaluate(() => document.querySelector("[role=dialog]")?.innerText.replace(/\s+/g, " ").slice(0, 500));
  const first = p.locator("[role=dialog] button").filter({ hasText: /→/ }).first();
  if (await first.count()) { await first.click(); await p.waitForTimeout(1200); await p.screenshot({ path: `${D}/${lang}-link-sheet.png` }); out[`${lang} sheet`] = await p.evaluate(() => [...document.querySelectorAll("[role=dialog]")].pop()?.innerText.replace(/\s+/g, " ").slice(0, 400)); }
  await ctx.close();
}
console.log(JSON.stringify({ out, errs }, null, 1));
await b.close();
