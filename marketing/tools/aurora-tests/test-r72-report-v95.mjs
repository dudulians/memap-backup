// Report v95 (Nov 7 2026, her notes): every question in by default, untick to leave a
// question and its links out; all her topics are main; short (1 page) or full; the app's
// colours by meaning. The sheet, then every kind's pages, EN and RU, and a real PDF.
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
const D = `./aurora-tests/work/r72`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
for (const lang of ["en", "ru"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async (lang) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
    for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId));
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    // three topics from onboarding: headache first, anxiety and sleep with it
    const find = (re) => T.find((t) => re.test(t.title));
    const head = find(/headache/i), anx = find(/anxious/i), sleep = find(/Slept enough/i);
    localStorage.setItem("memap_door", JSON.stringify({ id: "migraine", trackerId: head.id, contextTrackerIds: [], startedAt: iso(60), extra: [{ id: "stress", trackerId: anx.id }, { id: "sleep", trackerId: sleep.id }] }));
    localStorage.setItem("memap_treasures", JSON.stringify({ balloon: iso(20), camera: iso(12), moon: iso(5), books: iso(2) }));
    const now = new Date().toISOString();
    localStorage.setItem("memap_notes", JSON.stringify([
      { id: "n1", date: iso(3), text: lang === "ru" ? "Плохо спала, утром болела голова. Много работы перед дедлайном." : "Slept badly, headache in the morning. Lots of work before a deadline.", createdAt: now, updatedAt: now },
      { id: "n2", date: iso(10), text: lang === "ru" ? "Хороший день: гуляли с подругой два часа." : "Good day: a two-hour walk with a friend.", createdAt: now, updatedAt: now }]));
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1");
    localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(1) }));
  }, lang);
  await p.reload(); await p.waitForTimeout(2200);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-doctor-report"))); await p.waitForTimeout(1500);
  const sheet = p.locator(".overflow-y-auto").filter({ has: p.locator("h2") }).last();
  await p.screenshot({ path: `${D}/${lang}-sheet-1.png` });
  // open the first island, untick one question
  const isl = p.locator("[role=dialog] button[aria-expanded]").first(); await isl.evaluate((e) => e.click()); await p.waitForTimeout(400);
  await sheet.evaluate((e) => e.scrollTo(0, 520)); await p.waitForTimeout(400);
  await p.screenshot({ path: `${D}/${lang}-sheet-2.png` });
  const back = p.getByRole("checkbox", { name: lang === "ru" ? /Болела спина|Боль в спине/ : /Back pain/ }).first();
  if (await back.count()) { await back.evaluate((e) => e.click()); await p.waitForTimeout(300); }
  out[`${lang} off`] = await p.evaluate(() => localStorage.getItem("memap_report_off"));
  out[`${lang} header`] = await p.locator("p", { hasText: /Questions ·|Вопросы ·/ }).first().innerText();
  await sheet.evaluate((e) => e.scrollTo(0, 99999)); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${D}/${lang}-sheet-3.png` });
  out[`${lang} button`] = await p.getByRole("button", { name: /Make PDF|Сделать PDF/ }).innerText();
  // every kind's pages, with what she left out
  const dump = (audience, kind, days) => p.evaluate(async ({ audience, kind, days, lang }) => {
    const r = await import("/src/lib/doctorReport.ts"), s = await import("/src/lib/storage.ts"), n = await import("/src/lib/notes.ts");
    const trackers = await s.getTrackers(), entries = await s.getEntries();
    const off = new Set(JSON.parse(localStorage.getItem("memap_report_off") ?? "[]"));
    const ids = r.reportQuestions(trackers, entries, days, audience).flatMap((g) => g.qs.map((x) => x.q.id)).filter((id) => !off.has(id));
    return r.drawReport({ trackers, entries, notes: await n.getNotes(), audience, kind, ids, mainIds: r.reportMainIds(), days, withNotes: true, name: audience === "me" ? "" : lang === "ru" ? "Ульяна" : "Uliana", daysLabel: lang === "ru" ? "Дни с мигренью" : "Your migraine days" });
  }, { audience, kind, days, lang });
  const runs = lang === "en" ? [["doctor", "short", 91], ["doctor", "full", 91], ["me", "short", 28], ["me", "full", 28], ["therapist", "short", 28]] : [["doctor", "short", 28], ["me", "full", 28]];
  for (const [a, k, d] of runs) { const pages = await dump(a, k, d); out[`${lang} ${a}-${k}-${d} pages`] = pages.length; pages.forEach((u, i) => writeFileSync(`${D}/${lang}-${a}-${k}-${d}-p${i + 1}.jpg`, Buffer.from(u.split(",")[1], "base64"))); }
  if (lang === "en") {
    await p.evaluate(() => { Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true }); });
    const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 20000 }), p.getByRole("button", { name: /Make PDF/ }).click()]);
    await dl.saveAs(`${D}/${lang}-short.pdf`); out.pdf = readFileSync(`${D}/${lang}-short.pdf`).subarray(0, 8).toString();
  }
  await ctx.close();
}
console.log(JSON.stringify({ out, errs }, null, 1));
await b.close();
