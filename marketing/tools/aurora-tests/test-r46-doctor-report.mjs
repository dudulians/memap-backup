// Reports (Nov 6 2026, two kinds): "For a specialist" (Doctor, 3 months, a name,
// notes) and "For me" (4 weeks, with islands and treasures), EN and RU. The sheet,
// every page as a picture, and a real PDF from the button.
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
const D = `./aurora-tests/work/r46`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
for (const lang of ["en", "ru"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async (lang) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
    for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId));
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    // her topic: the headache question, so the summary and calendar are about it
    const head = T.find((t) => /headache/i.test(t.title));
    if (head) localStorage.setItem("memap_door", JSON.stringify({ id: "migraine", trackerId: head.id, contextTrackerIds: [], startedAt: iso(60) }));
    localStorage.setItem("memap_treasures", JSON.stringify({ balloon: iso(20), camera: iso(12), moon: iso(5), books: iso(2) }));
    const now = new Date().toISOString();
    localStorage.setItem("memap_notes", JSON.stringify([
      { id: "n1", date: iso(3), text: lang === "ru" ? "Плохо спала, утром болела голова. Много работы перед дедлайном." : "Slept badly, headache in the morning. Lots of work before a deadline.", createdAt: now, updatedAt: now },
      { id: "n2", date: iso(10), text: lang === "ru" ? "Хороший день: гуляли с подругой два часа." : "Good day: a two-hour walk with a friend.", createdAt: now, updatedAt: now }]));
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", lang);
    localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(1) }));
  }, lang);
  await p.reload(); await p.waitForTimeout(2200);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-doctor-report"))); await p.waitForTimeout(1200);
  // for a specialist
  await p.getByRole("button", { name: lang === "ru" ? /^Врач$/ : /^Doctor$/ }).click();
  await p.getByRole("button", { name: lang === "ru" ? /3 месяца/ : /3 months/ }).click();
  await p.getByRole("textbox").fill(lang === "ru" ? "Ульяна" : "Uliana");
  await p.getByRole("switch").click(); await p.waitForTimeout(1800);
  await p.screenshot({ path: `${D}/${lang}-sheet-pro.png` });
  const dump = async (style, days) => p.evaluate(async ({ style, days, lang }) => {
    const r = await import("/src/lib/doctorReport.ts"), s = await import("/src/lib/storage.ts"), n = await import("/src/lib/notes.ts"), d = await import("/src/lib/doors.ts");
    const door = d.getDoorState();
    return r.drawReport({ trackers: await s.getTrackers(), entries: await s.getEntries(), notes: await n.getNotes(), style, audience: "doctor", islands: ["me", "health", "body", "love", "work"], days, withNotes: true, name: lang === "ru" ? "Ульяна" : "Uliana", mainId: door?.trackerId, daysLabel: lang === "ru" ? "Дни с мигренью" : "Your migraine days" });
  }, { style, days, lang });
  (await dump("pro", 91)).forEach((u, i) => writeFileSync(`${D}/${lang}-pro-p${i + 1}.jpg`, Buffer.from(u.split(",")[1], "base64")));
  await p.evaluate(() => { Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true }); });
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 20000 }), p.getByRole("button", { name: lang === "ru" ? /Сделать PDF/ : /Make PDF/ }).click()]);
  await dl.saveAs(`${D}/${lang}-pro.pdf`);
  // for me
  await p.getByRole("button", { name: lang === "ru" ? /^Для себя$/ : /^For me$/ }).click();
  await p.getByRole("button", { name: lang === "ru" ? /4 недели/ : /4 weeks/ }).click(); await p.waitForTimeout(1800);
  await p.screenshot({ path: `${D}/${lang}-sheet-me.png` });
  (await dump("me", 28)).forEach((u, i) => writeFileSync(`${D}/${lang}-me-p${i + 1}.jpg`, Buffer.from(u.split(",")[1], "base64")));
  out[lang] = { pdf: readFileSync(`${D}/${lang}-pro.pdf`).subarray(0, 8).toString() };
  await ctx.close();
}
console.log(JSON.stringify({ ...out, errs }, null, 1));
await b.close();
