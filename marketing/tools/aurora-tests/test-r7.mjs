// Her Nov 3 late notes: the deck says "About today"; nothing below the path;
// her questions on their own tab (always open, edit, reorder, reminder).
import { chromium } from "playwright-core";
const D = "./aurora-tests/work";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true })).newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
const out = {};
await p.goto("http://localhost:8080/"); await p.waitForTimeout(900);
await p.evaluate(async () => {
  const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
  for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
  const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
  const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId) && e.date !== iso(0));
  localStorage.clear();
  localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
  localStorage.setItem("memap_path_start", [...E.map((e) => e.date)].sort()[0]);
  localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_avatar", "08_fox");
  localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
});
await p.reload(); await p.waitForTimeout(2300);

// 1. Today ends with the path.
out.tabs = await p.evaluate(() => [...document.querySelectorAll("nav button")].map((x) => x.innerText.trim()).join(" | "));
await p.evaluate(() => { const m = document.querySelector("main"); m.scrollTop = m.scrollHeight; }); await p.waitForTimeout(400);
out.belowPath = await p.evaluate(() => /My questions|Turn on|reminder/i.test(document.querySelector("main").innerText));
await p.screenshot({ path: `${D}/r7-today-end.png` });

// 2. The deck says which day.
// back to her step on the drum (the way a user does: "My step")
await p.getByRole("button", { name: /my step/i }).click(); await p.waitForTimeout(1300);
await p.getByRole("button", { name: /^start/i }).first().click(); await p.waitForTimeout(1500);
out.deckHead = await p.evaluate(() => (document.querySelector('[role="dialog"]')?.innerText || "").split("\n").filter(Boolean).slice(0, 4).join(" | "));
await p.screenshot({ path: `${D}/r7-deck.png` });
await p.keyboard.press("Escape"); await p.waitForTimeout(900);

// 3. Questions: its own tab, open, with edit and add.
await p.getByRole("button", { name: /^map$/i }).first().click(); await p.waitForTimeout(2000);
// My questions live in You since Nov 3 2026 (the header animal)
await p.locator("header").getByRole("button", { name: /^you$/i }).click(); await p.waitForTimeout(900);
await p.locator('[role="dialog"]').getByRole("button", { name: /^my questions/i }).click(); await p.waitForTimeout(1500);
out.questions = await p.evaluate(() => document.querySelector("main").innerText.split("\n").filter(Boolean).slice(0, 12).join(" | "));
out.rows = await p.evaluate(() => document.querySelectorAll('[data-coachmark="cards-list"] [data-tracker-id], [data-coachmark="cards-list"] button').length);
await p.screenshot({ path: `${D}/r7-questions.png` });
await p.evaluate(() => { const m = document.querySelector("main"); m.scrollTop = m.scrollHeight; }); await p.waitForTimeout(400);
await p.screenshot({ path: `${D}/r7-questions-end.png` });
// Edit mode (reorder / delete)
const edit = p.getByRole("button", { name: /^edit$|^select$/i }).first();
if (await edit.count()) { await p.evaluate(() => { document.querySelector("main").scrollTop = 0; }); await edit.click(); await p.waitForTimeout(500); out.editMode = await p.evaluate(() => document.querySelector("main").innerText.split("\n").filter(Boolean).slice(0, 6).join(" | ")); await p.screenshot({ path: `${D}/r7-edit.png` }); }
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
