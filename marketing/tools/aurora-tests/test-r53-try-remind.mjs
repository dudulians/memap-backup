// A try asks "Remind me?" with a time that fits the change (board 65); the plan holds one a day.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r53`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
await p.evaluate(async () => {
  const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
  for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
  const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
  const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId));
  localStorage.clear(); localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
  localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "1");
  localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" }));
});
await p.reload(); await p.waitForTimeout(2200);
await p.locator("nav button").nth(1).click(); await p.waitForTimeout(2400);
await p.locator("[data-tour='helps']").click(); await p.waitForTimeout(1200);
await p.screenshot({ path: `${D}/1-pick.png` });
await p.getByRole("button", { name: /In bed by 23|bed/i }).first().click(); await p.waitForTimeout(400);
await p.getByRole("button", { name: /^Start/ }).last().click(); await p.waitForTimeout(1500);
await p.screenshot({ path: `${D}/2-started.png` });
out.time = await p.locator("input[type=time]").inputValue().catch(() => null);
await p.getByRole("button", { name: /Continue/i }).last().click(); await p.waitForTimeout(800);
out.plan = await p.evaluate(async () => { const x = (await import("/src/lib/experiments.ts")).currentExperiment(); const n = await import("/src/lib/notifications.ts"); return { remind: x?.remind, days: n.tryPlan().length, first: n.tryPlan()[0]?.body, title: n.tryPlan()[0]?.title }; });
await p.locator("[data-tour='helps']").click().catch(() => {}); await p.waitForTimeout(1000);
await p.screenshot({ path: `${D}/3-tile-after.png` });
out.tile = await p.evaluate(() => document.querySelector("[data-tour='helps']")?.innerText.replace(/\s+/g, " "));
console.log(JSON.stringify({ ...out, errs }, null, 1));
await b.close();
