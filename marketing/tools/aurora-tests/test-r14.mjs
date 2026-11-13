// Her notes 5 and 7 (Nov 3 2026): the otter by default (never Malu), and the
// "You" sheet (her animal + Change, My questions, Settings, her week and
// treasures) opened from the header, the map's boat and her step; the map's
// header keeps only its title and Map | Globe.
import { chromium } from "playwright-core";
const D = "./aurora-tests/work";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const p = await ctx.newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
const out = {};
await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
await p.evaluate(async () => {
  const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
  for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
  const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
  const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId) && e.date !== iso(0));
  localStorage.clear();
  localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
  localStorage.setItem("memap_path_start", [...E.map((e) => e.date)].sort()[0]);
  localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true");
  localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
});
await p.reload(); await p.waitForTimeout(2400);
const pics = () => p.evaluate(() => ({
  header: document.querySelector("header button[aria-label='You'] img")?.getAttribute("src")?.match(/\d\d_\w+/)?.[0] ?? "none",
  step: document.querySelector(".path-avatar img")?.getAttribute("src")?.match(/\d\d_\w+/)?.[0] ?? "none",
  stored: localStorage.getItem("memap_avatar"),
}));
out.newUser = await pics();
// the animal beside her step opens You
await p.locator(".path-avatar").click(); await p.waitForTimeout(900);
out.youFromStep = await p.evaluate(() => document.querySelector('[role="dialog"]')?.innerText.split("\n").filter(Boolean).slice(0, 12).join(" | ") ?? "none");
await p.screenshot({ path: `${D}/r14-you.png` });
// My questions -> the list; Back returns to Today
await p.locator('[role="dialog"]').getByRole("button", { name: /my questions/i }).click(); await p.waitForTimeout(1200);
out.questions = await p.evaluate(() => document.querySelector("main")?.innerText.split("\n").filter(Boolean).slice(0, 3).join(" | "));
await p.getByRole("button", { name: /back/i }).first().click(); await p.waitForTimeout(1200);
out.backTo = await p.evaluate(() => (document.querySelector(".path-band") ? "Today (path)" : document.querySelector("main")?.innerText.slice(0, 40)));
// header animal -> You -> Settings
await p.locator("header").getByRole("button", { name: /^you$/i }).click(); await p.waitForTimeout(900);
await p.locator('[role="dialog"]').getByRole("button", { name: /^settings$/i }).click(); await p.waitForTimeout(1200);
out.settings = await p.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].map((d) => d.querySelector("h2")?.innerText).filter(Boolean).join(" / "));
await p.keyboard.press("Escape"); await p.waitForTimeout(700);
// the map: no row under the title; the boat opens You
await p.getByRole("button", { name: /^map$/i }).first().click(); await p.waitForTimeout(1800);
await p.getByRole("tab", { name: /^map$/i }).click().catch(() => {}); await p.waitForTimeout(800);
out.mapHead = await p.evaluate(() => ({ h: Math.round(document.querySelector(".map-head").getBoundingClientRect().height), links: [...document.querySelectorAll(".map-head button")].map((x) => x.innerText.trim()) }));
const boat = p.locator("main button[aria-label='You']").first();
out.boat = await boat.count();
if (out.boat) { await boat.click(); await p.waitForTimeout(900); out.youFromBoat = await p.evaluate(() => !!document.querySelector('[role="dialog"]') && /settings/i.test(document.querySelector('[role="dialog"]').innerText)); }
await p.screenshot({ path: `${D}/r14-map.png` });
await p.keyboard.press("Escape"); await p.waitForTimeout(600);
// No avatar: gone everywhere, also after a reload; Malu when chosen
await p.evaluate(async () => { const m = await import("/src/lib/avatar.ts"); m.setAvatar(null); });
await p.reload(); await p.waitForTimeout(2200);
out.declined = await p.evaluate(() => ({ header: document.querySelector("header button[aria-label='You'] img") ? "img" : "icon", stored: localStorage.getItem("memap_avatar") }));
await p.evaluate(async () => { const m = await import("/src/lib/avatar.ts"); m.setAvatar("01_malu"); });
await p.waitForTimeout(400);
out.malu = await p.evaluate(() => document.querySelector("header button[aria-label='You'] img")?.getAttribute("src")?.match(/\d\d_\w+/)?.[0]);
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
