// Her round-4 notes: where to answer a new island's questions; tidy "?"
// marks; the avatar takes part; charts without the web.
import { chromium } from "playwright-core";
const D = "./aurora-tests/work";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true })).newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
const out = {};
const seed = async (avatar) => {
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(900);
  await p.evaluate(async (avatar) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
    for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    // her questions are from her first day, two months ago
    T = T.map((t) => ({ ...t, createdAt: new Date(Date.now() - 62 * 86400000).toISOString() }));
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId) && e.date !== iso(0));
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    localStorage.setItem("memap_path_start", [...E.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true");
    localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
    if (avatar) localStorage.setItem("memap_avatar", avatar);
  }, avatar);
  await p.reload(); await p.waitForTimeout(2300);
};
const dialog = () => p.evaluate(() => (document.querySelector('[role="dialog"]')?.innerText || "").split("\n").filter(Boolean).slice(0, 16).join(" | "));
const toMap = async () => { await p.getByRole("button", { name: /^map$/i }).first().click(); await p.waitForTimeout(2200); };

// 1. Avatar on the path and on the map; "?" marks.
await seed("08_fox");
await p.screenshot({ path: `${D}/r4-path-avatar.png` });
out.pathAvatar = await p.evaluate(() => !!document.querySelector(".path-avatar img"));
await toMap();
out.you = await p.evaluate(() => [...document.querySelectorAll("main button")].map((x) => x.getAttribute("aria-label")).filter((x) => x === "You").length);
out.maybeMarks = await p.evaluate(() => document.querySelectorAll('[aria-label*="maybe linked"]').length);
await p.screenshot({ path: `${D}/r4-map.png` });
await p.evaluate(() => { document.querySelector(".map-sea").scrollTop = 380; }); await p.waitForTimeout(300);
await p.screenshot({ path: `${D}/r4-map-2.png` });
await p.evaluate(() => { document.querySelector(".map-sea").scrollTop = 0; });

// 2. Charts: links first, then each question; a card opens the full chart.
await p.getByRole("button", { name: /^chart/i }).click(); await p.waitForTimeout(1500);
out.chartLinks = await dialog();
await p.screenshot({ path: `${D}/r4-chart-links.png` });
await p.getByRole("tab", { name: /each question/i }).click(); await p.waitForTimeout(600);
await p.screenshot({ path: `${D}/r4-chart-each.png` });
await p.locator('[role="dialog"] .grid button.surface').first().click(); await p.waitForTimeout(900);
out.chartDetail = await p.evaluate(() => /8 weeks/.test(document.querySelector('[role="dialog"]')?.innerText || ""));
await p.screenshot({ path: `${D}/r4-chart-detail.png` });
await p.keyboard.press("Escape"); await p.waitForTimeout(700);

// 3. A new island: its sheet says where and when; "Answer now" opens the deck.
await p.getByRole("button", { name: /new island/i }).first().click(); await p.waitForTimeout(900);
await p.getByRole("button", { name: /^pet/i }).first().click(); await p.waitForTimeout(700);
await p.getByRole("button", { name: /^add \d+ question/i }).click(); await p.waitForTimeout(1500);
out.petSheet = await dialog();
await p.screenshot({ path: `${D}/r4-new-island-sheet.png` });
await p.getByRole("button", { name: /^answer now$/i }).click(); await p.waitForTimeout(2500);
out.deck = await p.evaluate(() => (document.body.innerText.match(/[^\n]*\d+ of \d+/) || [""])[0]);
await p.screenshot({ path: `${D}/r4-answer-now.png` });
// back on Today: the island has its own step
await p.goto("http://localhost:8080/"); await p.waitForTimeout(2300);
out.pathSteps = await p.evaluate(() => [...document.querySelectorAll("[data-path-stop]")].map((e) => e.getAttribute("aria-label")).join(" | "));
out.newSub = await p.evaluate(() => [...document.querySelectorAll("section")].map((x) => x.innerText).join(" ").replace(/\s+/g, " ").includes("Pet New island"));

// 4. No avatar picked yet: the otter sails (Nov 3 2026), and the boat opens You.
await seed(null);
await toMap();
out.boatYou = await p.evaluate(() => [...document.querySelectorAll("main button")].some((x) => x.getAttribute("aria-label") === "You"));
await p.locator('main [aria-label="You"]').first().click(); await p.waitForTimeout(900);
out.you = await p.evaluate(() => (document.querySelector('[role="dialog"]')?.innerText || "").split(/\n/).filter(Boolean).slice(0, 4).join(" | "));
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
