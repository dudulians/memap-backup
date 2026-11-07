// Her ask (Nov 7 2026): whoever went back to the old look can come back to the new one any time —
// the first row of the old Settings.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r68`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const out = {}, errs = [];
for (const lang of ["en", "ru"]) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  await p.evaluate(async (lang) => {
    localStorage.clear(); const d = await import("/src/lib/doors.ts"); await d.ensureTemplates(["migraine", "slept-enough"]);
    localStorage.setItem("memap_ui", "classic"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1");
    localStorage.setItem("memap_upgrade_invite", "declined:" + d.isoLocal(new Date()));
  }, lang);
  await p.reload(); await p.waitForTimeout(2200);
  // the gear in the old header
  const gear = p.locator("header button, button[aria-label*='etting'], button[aria-label*='астрой']").last();
  await gear.click(); await p.waitForTimeout(1200);
  await p.screenshot({ path: `${D}/${lang}-classic-settings.png` });
  const row = p.getByRole("button", { name: /Try the new MeMap|Попробовать новый MeMap/ });
  out[`${lang} row`] = await row.count();
  if (out[`${lang} row`]) { await row.first().click(); await p.waitForTimeout(2500); out[`${lang} after`] = await p.evaluate(() => localStorage.getItem("memap_ui")); }
  await p.close();
}
console.log(JSON.stringify({ out, errs }, null, 1));
await b.close();
