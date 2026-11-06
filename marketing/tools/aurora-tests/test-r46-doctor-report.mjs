// Report for a specialist (Nov 6 2026): open from You, pick Therapist, 3 months, with
// notes; the first page shows; "Make PDF" downloads a real PDF (saved here to look at).
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
    const now = new Date().toISOString();
    localStorage.setItem("memap_notes", JSON.stringify([
      { id: "n1", date: iso(3), text: lang === "ru" ? "Плохо спала, утром болела голова. Много работы перед дедлайном." : "Slept badly, headache in the morning. Lots of work before a deadline.", createdAt: now, updatedAt: now },
      { id: "n2", date: iso(10), text: lang === "ru" ? "Хороший день: гуляли с подругой два часа." : "Good day: a two-hour walk with a friend.", createdAt: now, updatedAt: now }]));
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", lang);
    localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(1) }));
  }, lang);
  await p.reload(); await p.waitForTimeout(2200);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-doctor-report"))); await p.waitForTimeout(1200);
  await p.getByRole("button", { name: lang === "ru" ? /^Психолог$/ : /^Therapist$/ }).click();
  await p.getByRole("button", { name: lang === "ru" ? /3 месяца/ : /3 months/ }).click();
  await p.getByRole("switch").click(); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${D}/${lang}-sheet.png` });
  await p.locator("[role=dialog] .overflow-y-auto").evaluate((el) => el.scrollTo(0, 9999)); await p.waitForTimeout(500);
  await p.screenshot({ path: `${D}/${lang}-sheet-bottom.png` });
  const prev = await p.evaluate(() => document.querySelector("[role=dialog] img[src^='data:image/jpeg']")?.getAttribute("src"));
  if (prev) writeFileSync(`${D}/${lang}-page1.jpg`, Buffer.from(prev.split(",")[1], "base64"));
  await p.evaluate(() => { Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true }); });
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 15000 }), p.getByRole("button", { name: lang === "ru" ? /Сделать PDF/ : /Make PDF/ }).click()]);
  await dl.saveAs(`${D}/${lang}-report.pdf`);
  const head = readFileSync(`${D}/${lang}-report.pdf`).subarray(0, 8).toString();
  out[lang] = { preview: !!prev, pdf: head, bytes: readFileSync(`${D}/${lang}-report.pdf`).length };
  const all = await p.evaluate(async () => { const r = await import("/src/lib/doctorReport.ts"); const s = await import("/src/lib/storage.ts"); const n = await import("/src/lib/notes.ts"); return r.drawReport({ trackers: await s.getTrackers(), entries: await s.getEntries(), notes: await n.getNotes(), audience: "therapist", islands: ["me", "love", "health", "body", "work"], days: 91, withNotes: true }); });
  all.forEach((u, i) => writeFileSync(`${D}/${lang}-p${i + 1}.jpg`, Buffer.from(u.split(",")[1], "base64")));
  await ctx.close();
}
console.log(JSON.stringify({ ...out, errs }, null, 1));
await b.close();
