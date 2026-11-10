// r120 (her note, Nov 10 2026: "Source: Bei et al., Sleep Med Rev 2016 — no direct links, the source in very light text").
// The "Worth watching" sheet shows its source as small faint text, not a link.
// Run from marketing/tools:  node aurora-tests/test-r120-tip-source.mjs
import { chromium } from "playwright-core";
import fs from "fs";
const SHOTS = "aurora-tests/work/r120"; fs.mkdirSync(SHOTS, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:8080/"); await p.waitForTimeout(1200);
await p.evaluate(async () => {
  const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
  localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
  localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order"]));
  const now = new Date(); now.setHours(11, 0, 0, 0);
  const day = (k) => { const d = new Date(now); d.setDate(d.getDate() - k); return d; };
  const start = day(2); start.setHours(9, 0, 0, 0);
  const ids = await dz.ensureTemplates(["migraine", "slept-enough", "felt-stressed", "skipped-meal", "drank-water", "exercised", "saw-friends", "screens-before-bed"]);
  await st.saveTrackers((await st.getTrackers()).map((t) => ({ ...t, createdAt: start.toISOString() })));
  localStorage.setItem("memap_onboarded_at", start.toISOString());
  localStorage.setItem("memap_path_start", dz.isoLocal(start));
  localStorage.setItem("memap_door", JSON.stringify({ id: "migraine", trackerId: ids[0], contextTrackerIds: [], startedAt: dz.isoLocal(start) }));
  const E = []; for (const k of [2, 1]) ids.forEach((id, i) => E.push({ id: `e${k}-${i}`, trackerId: id, date: dz.isoLocal(day(k)), value: (i + k) % 3 === 0, createdAt: day(k).toISOString() }));
  await st.saveEntries(E);
});
const t11 = new Date(); t11.setHours(11, 0, 0, 0);
await p.clock.install({ time: t11 });
await p.reload(); await p.waitForTimeout(2500);
await p.locator('[data-path-stop][aria-label="Worth watching"]').first().click(); await p.waitForTimeout(600);
await p.getByRole("button", { name: "Read" }).first().click(); await p.waitForTimeout(900);
const sheet = p.locator('[role="dialog"]').last();
const info = { sourceLines: await sheet.locator("[data-tip-source]").count() };
const links = await sheet.locator("a[href*='doi.org']").count();
await p.screenshot({ path: `${SHOTS}/tip-sheet.png` });
// since her content audit (Nov 10 2026) no source line at all; the source stays in observeTipsData.ts
const sheetText = await sheet.innerText();
const check = {
  noSourceLine: (await sheet.locator("[data-tip-source]").count()) === 0 && !/Source:|Источник:/.test(sheetText),
  noLink: links === 0,
  newCopy: /Late coffee/.test(sheetText),
};
console.log(JSON.stringify({ check, info, errs }, null, 1));
await b.close();
process.exit(Object.values(check).every(Boolean) && !errs.length ? 0 : 1);
