// Step 5/6 check: past weeks above (one shown + "Earlier weeks"), coming weeks below, old-user chip, chest opening.
import { chromium } from "playwright-core";
const D = "./aurora-tests/work";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true })).newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
const out = {};
const seed = async (mode) => {
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(900);
  await p.evaluate(async (mode) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
    for (const id of ["showcase", "relationship-reality", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId) && e.date !== iso(0));
    if (mode === "chest") {
      for (const t of T) E.push({ id: "x" + t.id, trackerId: t.id, date: iso(0), value: Math.random() < 0.3 });
      const days = [...new Set(E.map((e) => e.date))].sort().slice(0, 4);
      E = E.filter((e) => !days.includes(e.date));
    }
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    if (mode !== "old") localStorage.setItem("memap_path_start", [...E.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true");
    localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
  }, mode);
  await p.reload(); await p.waitForTimeout(2300);
};
const texts = () => p.evaluate(() => {
  const banners = [...document.querySelectorAll(".press3d")].map((e) => e.innerText.replace(/\n+/g, " ")).filter((x) => /WEEK/.test(x));
  const chip = [...document.querySelectorAll("p.surface, button.surface")].map((e) => e.innerText).join(" | ");
  return { banners, chip };
});

await seed("long");
out.long = await texts();
await p.evaluate(() => { document.querySelector("main").scrollTop = 0; }); await p.waitForTimeout(200);
await p.screenshot({ path: `${D}/endless-top.png` });
await p.evaluate(() => { const m = document.querySelector("main"); m.scrollTop = m.scrollHeight * 0.62; }); await p.waitForTimeout(300);
await p.screenshot({ path: `${D}/endless-coming.png` });

await seed("old");
out.old = await texts();

await seed("chest");
out.chestBanner = (await texts()).banners;
await p.locator('[aria-label="Open your reward"]').first().click(); await p.waitForTimeout(300);
await p.getByRole("button", { name: /^open$/i }).last().click(); await p.waitForTimeout(900);
out.sheetReady = await p.evaluate(() => document.querySelector('[aria-modal="true"]')?.innerText.replace(/\n+/g, " | "));
await p.screenshot({ path: `${D}/chest-ready.png` });
await p.locator('[aria-modal="true"] .press3d').click(); await p.waitForTimeout(700);
out.sheetOpen = await p.evaluate(() => document.querySelector('[aria-modal="true"]')?.innerText.replace(/\n+/g, " | "));
await p.screenshot({ path: `${D}/chest-open.png` });
for (let i = 0; i < 5; i++) { const nx = p.locator('[aria-modal="true"] .press3d', { hasText: /next/i }); if (await nx.count() === 0) break; await nx.click(); await p.waitForTimeout(400); }
await p.getByRole("button", { name: /put it on my map|see my map|see my treasures/i }).click(); await p.waitForTimeout(1200);
out.afterPut = await p.evaluate(() => ({ tab: document.querySelector("nav [aria-current], nav .bg-foreground\\/\\[0\\.08\\]")?.innerText, chests: localStorage.getItem("memap_week_chests")?.slice(0, 160) }));
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
