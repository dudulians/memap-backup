// The week report after the treasures round (Nov 5 2026): "Your world grew"
// names islands that reached a stage (their pictures) and treasures with the
// island they stand on; a link is a link, not a bridge.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r26`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], texts = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const p = await ctx.newPage();
p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
await p.evaluate(async () => {
  const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
  for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
  const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
  const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId) && e.date !== iso(0));
  // a young world: 9 evenings, so the first weeks' reports have growth to tell
  E = E.filter((e) => e.date >= iso(9));
  localStorage.clear();
  localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
  localStorage.setItem("memap_path_start", [...E.map((e) => e.date)].sort()[0]);
  localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_avatar", "11_otter");
  localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
});
await p.reload(); await p.waitForTimeout(2000);
const earlier = p.getByRole("button", { name: /Earlier weeks/ });
if (await earlier.count()) { await earlier.first().click(); await p.waitForTimeout(1200); }
await p.getByRole("button", { name: /report/i }).first().click(); await p.waitForTimeout(1200);
await p.screenshot({ path: `${D}/report-0.png` });
await p.getByRole("button", { name: /See the report|Open your report/ }).first().click().catch(() => {}); await p.waitForTimeout(1500);
for (let i = 1; i <= 7; i++) {
  await p.screenshot({ path: `${D}/report-${i}.png` });
  texts.push((await p.locator("[role=dialog]").last().innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 400));
  const next = p.getByRole("button", { name: /^Next/ });
  if (!(await next.count())) break;
  await next.first().click(); await p.waitForTimeout(900);
}
console.log(JSON.stringify({ texts, errs: errs.filter((e) => !/InAppReview/.test(e)) }, null, 1));
await b.close();
