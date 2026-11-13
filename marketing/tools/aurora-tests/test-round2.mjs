// Her Nov 2 list, round 2: Predict, note step opens the sheet, calendar note
// dots, map header/links/globe, chest cards, night mode.
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
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true");
    localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
    if (mode === "chest") {
      // two days of guesses this week, so the chest has a "Predict" card
      localStorage.setItem("memap_predictions", JSON.stringify({ [iso(1)]: { guesses: Object.fromEntries(T.slice(0, 3).map((t) => [t.id, false])), revealed: true } }));
    }
  }, mode);
  await p.reload(); await p.waitForTimeout(2300);
};
const labels = () => p.evaluate(() => [...document.querySelectorAll("[data-path-stop]")].map((e) => e.getAttribute("aria-label")).filter(Boolean).join(" | "));

// 2. Note step: tap → the sheet with the keyboard; save → done.
await seed("plain");
await p.locator('[aria-label="Write a note"]').click(); await p.waitForTimeout(600);
out.noteFocused = await p.evaluate(() => document.activeElement?.tagName);
await p.screenshot({ path: `${D}/r2-note-sheet.png` });
await p.keyboard.type("Walked by the sea, calm evening");
await p.getByRole("button", { name: /^save$/i }).click(); await p.waitForTimeout(900);
out.noteDone = await p.evaluate(() => !!document.querySelector('[aria-label="Write a note"] .lucide-check'));

// 3. Calendar: a gold dot on today (the note), tap → the note shows.
await p.getByRole("button", { name: /^map$/i }).first().click(); await p.waitForTimeout(2200);
await p.screenshot({ path: `${D}/r2-map.png` });
out.mapHead = await p.evaluate(() => { const h = document.querySelector(".map-head"); const r = h?.getBoundingClientRect(); return h ? `${Math.round(r.height)}px · ${h.innerText.replace(/\n+/g, " | ")}` : null; });
out.maybeLinks = await p.evaluate(() => document.querySelectorAll('[aria-label*="maybe linked"]').length);
out.linked = await p.evaluate(() => [...document.querySelectorAll("[data-map-link]")].filter((e) => /Linked/.test(e.innerText)).length);
await p.getByRole("button", { name: /^calendar/i }).click(); await p.waitForTimeout(1300);
out.noteDots = await p.evaluate(() => document.querySelectorAll('[role="dialog"] .ring-background').length);
await p.screenshot({ path: `${D}/r2-calendar.png` });
await p.keyboard.press("Escape"); await p.waitForTimeout(700);
// action points card
out.actionCard = await p.evaluate(() => [...document.querySelectorAll("main button")].map((x) => x.innerText.replace(/\n+/g, " ")).find((x) => /Action points/.test(x)));
// globe reaches the bottom
await p.getByRole("tab", { name: /^globe$/i }).click(); await p.waitForTimeout(1800);
out.globeBottom = await p.evaluate(() => Math.round(document.querySelector("main canvas").getBoundingClientRect().bottom));
await p.screenshot({ path: `${D}/r2-globe.png` });

// 4. Chest: card by card.
await seed("chest");
await p.locator('[aria-label="Open your reward"]').first().click(); await p.waitForTimeout(400);
await p.getByRole("button", { name: /^open$/i }).last().click(); await p.waitForTimeout(900);
await p.locator('[aria-modal="true"] .press3d').click(); await p.waitForTimeout(800);
const steps = [];
for (let i = 0; i < 5; i++) {
  const next = p.locator('[aria-modal="true"] .press3d', { hasText: /next/i });
  if (await next.count() === 0) break;
  await next.click(); await p.waitForTimeout(450); steps.push(i);
}
out.chest = await p.evaluate(() => (document.querySelector('[aria-modal="true"]')?.innerText || "").split("\n").filter(Boolean).join(" | "));
await p.evaluate(() => { const d = document.querySelector('[aria-modal="true"] .overflow-y-auto'); if (d) d.scrollTop = 0; });
await p.screenshot({ path: `${D}/r2-chest-top.png` });
await p.evaluate(() => { const d = document.querySelector('[aria-modal="true"] .overflow-y-auto'); if (d) d.scrollTop = d.scrollHeight; });
await p.screenshot({ path: `${D}/r2-chest-end.png` });
await p.locator('[aria-modal="true"] button[aria-label="Close"]').click(); await p.waitForTimeout(500);

// 5. Night: the moon in the header.
await seed("plain");
await p.getByRole("button", { name: /^night$/i }).click(); await p.waitForTimeout(1500);
out.night = await p.evaluate(() => document.documentElement.getAttribute("data-theme"));
await p.screenshot({ path: `${D}/r2-night-today.png` });
await p.getByRole("button", { name: /^map$/i }).first().click(); await p.waitForTimeout(2200);
await p.screenshot({ path: `${D}/r2-night-map.png` });
out.nightPic = await p.evaluate(() => [...document.querySelectorAll("main img")].map((i) => i.getAttribute("src")).filter((s) => /island_/.test(s || "")).slice(0, 1).join(""));
await p.getByRole("button", { name: /^notes$/i }).first().click(); await p.waitForTimeout(1200);
await p.screenshot({ path: `${D}/r2-night-notes.png` });
await p.getByRole("button", { name: /^day$/i }).click(); await p.waitForTimeout(800);
out.dayAgain = await p.evaluate(() => document.documentElement.getAttribute("data-theme"));

out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
