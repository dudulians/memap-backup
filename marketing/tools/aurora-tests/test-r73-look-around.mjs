// Her phone notes (Nov 8 2026): the calendar ("иногда плохо читаются вопросы"), When to act,
// a test from a plan, and Done for today. Demo data with three topics; screenshots in EN and RU.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r73`; mkdirSync(D, { recursive: true });
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
  const find = (re) => T.find((t) => re.test(t.title));
  const head = find(/headache/i), anx = find(/anxious/i), sleep = find(/Slept enough/i);
  localStorage.setItem("memap_door", JSON.stringify({ id: "migraine", trackerId: head.id, contextTrackerIds: [], startedAt: iso(60), extra: [{ id: "stress", trackerId: anx.id }, { id: "sleep", trackerId: sleep.id }] }));
  localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "true"); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1");
  localStorage.setItem("memap_theme", "aurora-light");
  localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(1) }));
}, lang);
await p.reload(); await p.waitForTimeout(2500);
const shot = async (name) => { await p.waitForTimeout(900); await p.screenshot({ path: `${D}/${lang}-${name}.png` }); };
// the calendar
await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "overview", back: true } })));
await p.waitForTimeout(2200); await shot("calendar-1");
const sc = p.locator("[role=dialog] .overflow-y-auto").last();
await sc.evaluate((e) => e.scrollTo(0, 600)).catch(() => {}); await shot("calendar-2");
await sc.evaluate((e) => e.scrollTo(0, 1300)).catch(() => {}); await shot("calendar-3");
// When to act
await p.evaluate(() => { const b = [...document.querySelectorAll("[role=dialog] button[role=tab]")]; });
await p.keyboard.press("Escape"); await p.waitForTimeout(600);
await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "signals", back: true } })));
await p.waitForTimeout(2200); await shot("act-1");
await sc.evaluate((e) => e.scrollTo(0, 700)).catch(() => {}); await shot("act-2");
console.log(JSON.stringify({ out, errs }, null, 1));
await b.close();
