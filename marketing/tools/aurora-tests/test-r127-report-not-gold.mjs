// r127 (her note, Nov 10 2026: "когда кнопка Report ready, она вроде уже сразу жёлтая становится? это путает, я как бы
// жёлтые вообще не хочу открывать"). Gold means done: a report that is ready but not opened is a step to do (not gold),
// its "Open report" buttons are teal; once opened, it turns gold. EN + RU.
// Run from marketing/tools: node aurora-tests/test-r127-report-not-gold.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r127`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const ok = (name, cond, info = "") => { out[name] = cond ? "ok" : `FAIL ${typeof info === "string" ? info : JSON.stringify(info)}`.slice(0, 400); if (!cond) fails.push(name); };
for (const lang of ["en", "ru"]) {
  const RU = lang === "ru";
  const W = RU ? { ready: "Отчёт готов", open: /Открыть отчёт/i } : { ready: "Report ready", open: /Open report/i };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: RU ? "ru-RU" : "en-US" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  await p.clock.install({ time: new Date(2026, 10, 10, 21, 0, 0) });
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async (lang) => {
    localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1");
    localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order"])); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1");
    localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" })); localStorage.setItem("memap_first_link_seen", "before");
    const seen = []; for (const isl of ["health", "body", "me", "love", "work", "world", "kids", "pet", "parents"]) for (let k = 0; k <= 4; k++) seen.push(`${isl}:${k}`);
    localStorage.setItem("memap_grow_seen", JSON.stringify(seen));
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    const ids = await dz.ensureTemplates(["headache", "slept-enough", "felt-stressed"]);
    const at = new Date("2026-11-04T09:00:00").toISOString();
    await st.saveTrackers((await st.getTrackers()).map((t) => ({ ...t, createdAt: at })));
    localStorage.setItem("memap_onboarded_at", at); localStorage.setItem("memap_path_start", "2026-11-04");
    localStorage.setItem("memap_door", JSON.stringify({ id: "migraine", trackerId: ids[0], contextTrackerIds: [], startedAt: "2026-11-04" }));
    const E = []; for (let d = 4; d <= 10; d++) { const iso = `2026-11-${String(d).padStart(2, "0")}`; ids.forEach((id, i) => E.push({ id: `${iso}-${i}`, trackerId: id, date: iso, value: (d + i) % 3 === 0, createdAt: `${iso}T20:00:00.000Z` })); }
    await st.saveEntries(E);
  }, lang);
  await p.reload(); await p.waitForTimeout(2800);
  const node = p.locator(`.path-node[aria-label="${W.ready}"]`).first();
  const n0 = await node.count();
  if (!n0) { ok(`${lang}: the Report ready node is on the path`, false, await p.$$eval(".path-node", (els) => els.map((e) => e.getAttribute("aria-label")))); await ctx.close(); continue; }
  await node.evaluate((el) => el.scrollIntoView({ block: "center" })); await p.waitForTimeout(700);
  const cls = await node.getAttribute("class");
  await p.screenshot({ path: `${D}/${lang}-ready.png` });
  ok(`${lang}: ready, not opened — not gold`, !/disc-gold|disc-done/.test(cls ?? ""), cls);
  // tapping it opens the report straight away
  await node.click(); await p.waitForTimeout(1500);
  // the report's own buttons are teal too
  const golds = await p.locator("[role=dialog] .tone-gold, .fixed .tone-gold").count();
  ok(`${lang}: the report's buttons are not gold`, golds === 0, String(golds));
  await p.screenshot({ path: `${D}/${lang}-report.png` });
  // open it (the report's own "Open"), then back: the node is gold (done)
  const inner = p.getByRole("button", { name: RU ? /Смотреть отчёт/i : /See the report/i }).last();
  ok(`${lang}: the report's Open button is teal`, /tone-teal/.test((await inner.getAttribute("class").catch(() => "")) ?? ""), await inner.getAttribute("class").catch(() => "none"));
  const badge = await p.evaluate(() => { const b = document.querySelector(".report-badge"); return b ? getComputedStyle(b).backgroundColor : null; });
  ok(`${lang}: the report badge is not gold`, !!badge && !/rgb\(2(4[0-9]|5[0-5]), (1[6-9][0-9]|2[0-2][0-9]), /.test(badge), badge);
  // (tapping it opens the cards with sparkles, which crashes headless Chrome under the fake clock; r98 covers that
  // flow): the week is marked opened the way WeekChest saves it
  await p.evaluate(() => localStorage.setItem("memap_week_chests", JSON.stringify({ 0: { openedAt: new Date().toISOString(), lines: [], reward: "balloon", dates: ["2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10"] } })));
  await p.reload(); await p.waitForTimeout(2600);
  const after = await p.$$eval(".path-node", (els) => els.filter((e) => /disc-gold/.test(e.className)).map((e) => e.getAttribute("aria-label")));
  ok(`${lang}: once opened, the report node is gold`, after.length >= 1, after);
  await ctx.close();
}
console.log(JSON.stringify({ fails, out, errs }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
