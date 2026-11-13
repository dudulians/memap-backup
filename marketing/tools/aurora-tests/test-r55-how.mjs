// "How MeMap works" in You: the 4 parts, the map signs, "Add a question" opens the add sheet.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r55`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
for (const lang of ["en", "ru"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  await p.evaluate(async (lang) => {
    const g = await import("/src/lib/demoDataGenerator.ts"); const r = g.generateDemoData("showcase");
    localStorage.clear(); localStorage.setItem("memap_trackers", JSON.stringify(r.newTrackers)); localStorage.setItem("memap_entries", JSON.stringify(r.newEntries));
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1");
    localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" }));
  }, lang);
  await p.reload(); await p.waitForTimeout(2200);
  await p.locator("nav button").nth(1).click(); await p.waitForTimeout(2000);
  const you = p.locator("header button img, button[aria-label*='You'], button[aria-label*='Ты']").last();
  await you.click({ timeout: 4000 }).catch(async () => { await p.mouse.click(362, 22); });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${D}/${lang}-1-you.png` });
  await p.getByRole("button", { name: /How MeMap works|Как устроен MeMap/ }).click(); await p.waitForTimeout(1200);
  await p.screenshot({ path: `${D}/${lang}-2-how.png` });
  out[lang] = await p.evaluate(() => document.querySelector("[role=dialog]:last-of-type")?.innerText.replace(/\s+/g, " ").slice(0, 700));
  await p.getByRole("button", { name: /Add a question|Добавить вопрос/ }).last().click(); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${D}/${lang}-3-add.png` });
  out[lang + "-add"] = await p.evaluate(() => [...document.querySelectorAll("[role=dialog]")].map((d) => d.innerText.replace(/\s+/g, " ").slice(0, 80)));
  await ctx.close();
}
console.log(JSON.stringify({ ...out, errs }, null, 1));
await b.close();
