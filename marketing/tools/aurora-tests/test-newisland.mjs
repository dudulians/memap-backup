// New island: topics list → Pet → its questions (3 ticked) → Add → the Pet island opens; ideas inside Health.
import { chromium } from "playwright-core";
const D = "./aurora-tests/work";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true })).newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:8080/"); await p.waitForTimeout(900);
await p.evaluate(async () => {
  const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
  for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
  const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
  const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId));
  localStorage.clear();
  localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
  localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true");
  localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
});
await p.reload(); await p.waitForTimeout(1600);
await p.getByRole("button", { name: /^map$/i }).click(); await p.waitForTimeout(1400);
const dialog = () => p.evaluate(() => (document.querySelector('[role="dialog"]')?.innerText || "").split("\n").filter(Boolean).slice(0, 26).join(" | "));
const out = {};
await p.getByRole("button", { name: /new island/i }).first().click(); await p.waitForTimeout(900);
out.topics = await dialog();
await p.screenshot({ path: `${D}/newisland-topics.png` });
await p.getByRole("button", { name: /^pet/i }).first().click(); await p.waitForTimeout(700);
out.questions = await dialog();
await p.screenshot({ path: `${D}/newisland-questions.png` });
await p.getByRole("button", { name: /^add \d+ question/i }).click(); await p.waitForTimeout(1500);
out.petSheet = await dialog();
await p.keyboard.press("Escape"); await p.waitForTimeout(700);
out.map = await p.evaluate(() => [...document.querySelectorAll("main button[aria-label]")].map((e) => e.getAttribute("aria-label")).join(" | "));
await p.locator("main button", { hasText: "Health" }).first().click(); await p.waitForTimeout(1200);
await p.evaluate(() => { const d = document.querySelector('[role="dialog"] .overflow-y-auto'); if (d) d.scrollTop = 1200; }); await p.waitForTimeout(300);
out.ideas = await p.evaluate(() => (document.querySelector('[role="dialog"]')?.innerText || "").match(/IDEAS FOR THIS ISLAND[\s\S]{0,200}/)?.[0]?.replace(/\n+/g, " | "));
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
