// Her phone notes (Nov 8 2026): Links — "выбрано Все, связь подсвечивается одна; «ещё» не клацается;
// в топиках по одной, а во Все их нет; новые цвета и фигуры"; What helps opened an empty "Week
// summary". Demo data; Links in All and one island, a second link opened, What helps.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r76`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
const lang = process.argv[2] ?? "en";
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
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
  localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "true"); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1");
  localStorage.setItem("memap_theme", "aurora-light"); localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(1) }));
  // a test running (day 4) and one tried before
  localStorage.setItem("memap_experiments", JSON.stringify([
    { id: "1-test", island: "health", trackerId: "1-test", change: "In bed by 23:00", start: iso(3), remind: "22:00" },
    { id: "2-test", island: "body", trackerId: "2-test", change: "Walk for 20 minutes", start: iso(30), reviewed: iso(14), kept: false },
  ]));
}, lang);
await p.reload(); await p.waitForTimeout(2500);
let n = 0; const shot = async (name) => { await p.waitForTimeout(900); await p.screenshot({ path: `${D}/${lang}-${String(++n).padStart(2, "0")}-${name}.png` }); };
const links = async () => { await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "findings", back: true } }))); await p.waitForTimeout(2500); };
await links(); await shot("links-all");
const sc = p.locator("[role=dialog] .overflow-y-auto").last();
out.allCount = await p.locator("[role=dialog] button[aria-expanded]").count();
out.linkCard = await p.evaluate(async () => { const m = await import("/src/components/MapTab.tsx").catch(() => null); return !!m; });
// a second link opens
await p.locator("[role=dialog] button[aria-expanded]").nth(1).click(); await p.waitForTimeout(700);
out.secondOpen = await p.locator("[role=dialog] button[aria-expanded=true]").count();
await sc.evaluate((e) => e.scrollTo(0, 650)).catch(() => {}); await shot("links-second-open");
// one island: its links are among All's
await sc.evaluate((e) => e.scrollTo(0, 0)); await p.waitForTimeout(300);
await p.locator("[role=dialog] [role=tab]").nth(2).click(); await p.waitForTimeout(1500);
out.islandCount = await p.locator("[role=dialog] button[aria-expanded]").count();
await shot("links-island");
// What helps
await p.keyboard.press("Escape"); await p.waitForTimeout(700);
await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns" } }))); await p.waitForTimeout(2200); await p.evaluate(() => document.querySelector("[data-tour=helps]")?.click()); await p.waitForTimeout(1500);
await shot("what-helps");
out.helps = await p.evaluate(() => document.querySelector("[role=dialog]")?.innerText.replace(/\s+/g, " ").slice(0, 500));
// a running test opens with its reminder
await p.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].find((x) => /Go to bed|Ложиться спать/.test(x.textContent))?.click()); await p.waitForTimeout(1000);
await shot("what-helps-test");
console.log(JSON.stringify({ out, errs }, null, 1));
await b.close();
