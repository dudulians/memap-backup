// r126 (her note, Nov 10 2026: "экспорт эксель не нужно; а бэкап в каком будет файле, это безопасно?"). Settings → Data &
// privacy has Backup and Restore, no CSV row; the backup is one memap-backup-<date>.json file with questions, answers,
// notes and a few settings — nothing else; a file that isn't a MeMap backup is refused. EN + RU.
// Run from marketing/tools: node aurora-tests/test-r126-backup.mjs
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync } from "fs";
const D = `./aurora-tests/work/r126`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const ok = (name, cond, info = "") => { out[name] = cond ? "ok" : `FAIL ${typeof info === "string" ? info : JSON.stringify(info)}`.slice(0, 400); if (!cond) fails.push(name); };
for (const lang of ["en", "ru"]) {
  const RU = lang === "ru";
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: RU ? "ru-RU" : "en-US", acceptDownloads: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async (lang) => {
    localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1"); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_onboarded_at", new Date().toISOString()); localStorage.setItem("memap_path_start", "2026-11-01");
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    const [h] = await dz.ensureTemplates(["headache"]);
    await st.saveEntries([{ id: "e1", trackerId: h, date: "2026-11-09", value: true, createdAt: new Date().toISOString() }]);
    localStorage.setItem("memap_notes", JSON.stringify([{ id: "n1", text: "a private note", date: "2026-11-09" }]));
  }, lang);
  await p.reload(); await p.waitForTimeout(2200);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-you"))); await p.waitForTimeout(1500);
  await p.locator("[role=dialog]").last().getByRole("button", { name: RU ? /Настройки/ : /^Settings$/ }).first().click(); await p.waitForTimeout(1200);
  await p.getByRole("button", { name: RU ? /Данные и приватность/ : /Data & privacy/i }).first().click(); await p.waitForTimeout(1000);
  const text = (await p.locator("[role=dialog]").last().innerText()).replace(/\s+/g, " ");
  await p.screenshot({ path: `${D}/${lang}-data.png` });
  ok(`${lang}: Backup and Restore are there`, (await p.locator("[data-row=backup]").count()) === 1 && /Restore from backup|Восстановить/i.test(text), text.slice(0, 300));
  ok(`${lang}: no CSV / Excel row`, (await p.locator("[data-row=csv]").count()) === 0 && !/CSV|Excel/i.test(text), text.slice(0, 300));
  // the backup file (the web path downloads it; on a phone it goes to the share sheet, then the cache copy is deleted)
  await p.evaluate(() => Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true }));
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 8000 }).catch(() => null), p.locator("[data-row=backup]").click()]);
  if (dl) {
    const path = `${D}/${lang}-${dl.suggestedFilename()}`; await dl.saveAs(path);
    const j = JSON.parse(readFileSync(path, "utf8"));
    out[`${lang}.file`] = dl.suggestedFilename();
    out[`${lang}.keys`] = Object.keys(j).join(", ");
    out[`${lang}.settings`] = Object.keys(j.settings || {}).join(", ");
    ok(`${lang}: one memap-backup-<date>.json file`, /^memap-backup-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), dl.suggestedFilename());
    ok(`${lang}: questions, answers, notes and a few settings — nothing else`, Object.keys(j).sort().join() === "entries,exportedAt,notes,settings,trackers,version" && j.entries.length === 1 && j.notes.length === 1, Object.keys(j));
  } else ok(`${lang}: the backup downloads`, false, "no download");
  // a file that isn't a MeMap backup is refused
  await p.locator("input[type=file][accept*=json]").setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ hello: 1 })) });
  await p.waitForTimeout(700);
  ok(`${lang}: a stranger's file is refused`, /isn't a MeMap backup|не бэкап MeMap/i.test((await p.locator("[role=dialog]").last().innerText())), (await p.locator("[role=dialog]").last().innerText()).slice(0, 300));
  await ctx.close();
}
console.log(JSON.stringify({ fails, out, errs }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
