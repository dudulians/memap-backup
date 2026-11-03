// Her progress ideas (Nov 2 2026): growth on islands, bridges, special items,
// a test of one change (→ garden), the chest's "world grew" and mission.
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
    for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId) && e.date !== iso(0));
    if (mode === "chest") {
      for (const t of T) E.push({ id: "x" + t.id, trackerId: t.id, date: iso(0), value: Math.random() < 0.3 });
      const days = [...new Set(E.map((e) => e.date))].sort().slice(0, 4);
      E = E.filter((e) => !days.includes(e.date));
    }
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    localStorage.setItem("memap_path_start", [...E.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true");
    localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
  }, mode);
  await p.reload(); await p.waitForTimeout(2300);
};
const toMap = async () => { await p.getByRole("button", { name: /^map$/i }).first().click(); await p.waitForTimeout(2200); };

// 1. The map shows growth, bridges and special items.
await seed("plain");
await toMap();
out.mapPics = await p.evaluate(() => {
  const srcs = [...document.querySelectorAll("main img")].map((i) => (i.getAttribute("src") || "").split("/").pop().split("-")[0].replace(".webp", ""));
  const count = (n) => srcs.filter((s) => s === n).length;
  return { house: count("house"), flowers: count("flowering_bush"), flag: count("marker_flag"), bridge: count("wooden_bridge"), balloon: count("hot_air_balloon"), camera: count("camera"), books: count("books"), bicycle: count("bicycle"), airplane: count("airplane") };
});
await p.screenshot({ path: `${D}/g-map.png` });
await p.evaluate(() => { const m = document.querySelector(".map-sea"); m.scrollTop = 420; }); await p.waitForTimeout(300);
await p.screenshot({ path: `${D}/g-map-2.png` });
await p.evaluate(() => { const m = document.querySelector(".map-sea"); m.scrollTop = 0; });

// 2. The treasures shelf, in You since Nov 3 2026 (the header animal).
await p.locator("header").getByRole("button", { name: /^you$/i }).click(); await p.waitForTimeout(1200);
out.shelf = await p.evaluate(() => (document.querySelector('[role="dialog"]')?.innerText || "").split("\n").filter(Boolean).slice(0, 34).join(" | "));
await p.evaluate(() => { const d = document.querySelector('[role="dialog"] .overflow-y-auto'); if (d) d.scrollTop = 0; });
await p.screenshot({ path: `${D}/g-shelf.png` });
await p.keyboard.press("Escape"); await p.waitForTimeout(700);

// 3. An island: what grew, and "Test one change here".
await p.locator("main button[aria-label^='Health']").first().click(); await p.waitForTimeout(1300);
out.islandSheet = await p.evaluate(() => (document.querySelector('[role="dialog"]')?.innerText || "").split("\n").filter(Boolean).slice(0, 14).join(" | "));
await p.screenshot({ path: `${D}/g-island.png` });
await p.getByRole("button", { name: /test one change here/i }).click(); await p.waitForTimeout(900);
await p.screenshot({ path: `${D}/g-test-pick.png` });
out.testPick = await p.evaluate(() => (document.querySelector('[aria-modal="true"]')?.innerText || "").split("\n").filter(Boolean).slice(0, 10).join(" | "));
await p.locator('[aria-modal="true"] button.surface').first().click(); await p.waitForTimeout(300);
await p.locator('[aria-modal="true"] .press3d').click(); await p.waitForTimeout(1200);
out.testStarted = await p.evaluate(() => (document.querySelector('[aria-modal="true"]')?.innerText || "").split("\n").filter(Boolean).slice(0, 4).join(" | "));
await p.screenshot({ path: `${D}/g-test-started.png` });

// 4. A week later: the result, then a garden.
await p.evaluate(() => {
  const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const xs = JSON.parse(localStorage.getItem("memap_experiments"));
  xs[0].start = iso(8);
  localStorage.setItem("memap_experiments", JSON.stringify(xs));
  const E = JSON.parse(localStorage.getItem("memap_entries"));
  for (let n = 8; n >= 2; n--) E.push({ id: "t" + n, trackerId: xs[0].trackerId, date: iso(n), value: n % 3 !== 0 });
  localStorage.setItem("memap_entries", JSON.stringify(E));
});
await p.reload(); await p.waitForTimeout(2300);
out.testStep = await p.evaluate(() => [...document.querySelectorAll("[data-path-stop]")].map((e) => e.getAttribute("aria-label")).filter((x) => /test/i.test(x || "")).join(" | "));
await p.locator('[aria-label="Your test is done"]').click(); await p.waitForTimeout(900);
out.testResult = await p.evaluate(() => (document.querySelector('[aria-modal="true"]')?.innerText || "").split("\n").filter(Boolean).join(" | "));
await p.screenshot({ path: `${D}/g-test-result.png` });
await p.locator('[aria-modal="true"] .press3d').click(); await p.waitForTimeout(900);
await toMap();
out.garden = await p.evaluate(() => [...document.querySelectorAll("main img")].filter((i) => /orange_tree/.test(i.getAttribute("src") || "")).length);
await p.screenshot({ path: `${D}/g-map-garden.png` });

// 5. The chest: what grew, the mission.
await seed("chest");
await p.locator('[aria-label="Open your reward"]').first().click(); await p.waitForTimeout(400);
await p.getByRole("button", { name: /^open$/i }).last().click(); await p.waitForTimeout(900);
await p.locator('[aria-modal="true"] .press3d').click(); await p.waitForTimeout(900);
for (let i = 0; i < 6; i++) {
  const nx = p.locator('[aria-modal="true"] .press3d', { hasText: /next/i });
  if (await nx.count() === 0) break;
  await nx.click(); await p.waitForTimeout(450);
}
out.chest = await p.evaluate(() => (document.querySelector('[aria-modal="true"]')?.innerText || "").split("\n").filter(Boolean).join(" | "));
await p.evaluate(() => { const d = document.querySelector('[aria-modal="true"] .overflow-y-auto'); if (d) d.scrollTop = d.scrollHeight; });
await p.screenshot({ path: `${D}/g-chest-end.png` });
await p.evaluate(() => { const d = document.querySelector('[aria-modal="true"] .overflow-y-auto'); if (d) d.scrollTop = d.scrollHeight * 0.45; });
await p.screenshot({ path: `${D}/g-chest-mid.png` });
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
