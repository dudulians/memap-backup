// "Unload your mind" step card (her note, Nov 5 2026: "почему при нажатии пишет 0 answers").
// Before and after playing it today, in English and Russian; and the week's-test card.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r29`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
for (const [lang, played] of [["en", false], ["en", true], ["ru", true]]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async ({ lang, played }) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
    for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId) && e.date !== iso(0));
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    localStorage.setItem("memap_path_start", [...E.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_avatar", "11_otter");
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
    if (played) localStorage.setItem("memap_unload_played", iso(0));
  }, { lang, played });
  await p.reload(); await p.waitForTimeout(2200);
  const name = lang === "ru" ? "Разгрузи голову" : "Unload your mind";
  const node = p.locator(`.path-node[aria-label*="${name}"]`).first();
  if (await node.count()) { await node.scrollIntoViewIfNeeded(); await p.waitForTimeout(400); await node.click(); }
  else { await p.getByRole("button", { name: new RegExp(name) }).first().click(); }
  await p.waitForTimeout(900);
  const tag = `${lang}-${played ? "played" : "new"}`;
  await p.screenshot({ path: `${D}/${tag}.png` });
  out[tag] = await p.evaluate(() => document.querySelector(".path-bubble")?.innerText.replace(/\s+/g, " ") ?? "no card");
  await ctx.close();
}
console.log(JSON.stringify({ ...out, errs }, null, 1));
await b.close();
