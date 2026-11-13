// "Your hunch", Nov 3 2026: tick several (and untick), her own idea inline,
// one Check; results shown together; real sound files load.
import { chromium } from "playwright-core";
const D = "./aurora-tests/work";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true })).newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 160)); });
const sounds = new Map();
p.on("response", (r) => { const u = r.url(); if (/\.mp3(\?|$)/.test(u)) sounds.set(u.split("/").pop().split("?")[0], r.status()); });
const out = {};
const seed = async (mode) => {
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(900);
  await p.evaluate(async (mode) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
    for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId) && e.date !== iso(0));
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    localStorage.setItem("memap_path_start", [...E.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_unload_intro", "seen"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_avatar", "08_fox");
    localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
    if (mode === "checked") {
      const h = T.find((t) => /headache/i.test(t.title));
      const sus = T.filter((t) => t.id !== h.id && !t.archived).slice(0, 2);
      localStorage.setItem("memap_hunches", JSON.stringify(sus.map((s, i) => ({ id: "h" + i, target: h.id, suspect: s.id, made: iso(30) }))));
    }
  }, mode);
  await p.reload(); await p.waitForTimeout(2300);
};
const modal = () => p.evaluate(() => (document.querySelector('[aria-modal="true"]')?.innerText || "").split("\n").filter(Boolean).join(" | "));
const btn = () => p.evaluate(() => [...document.querySelectorAll('[aria-modal="true"] .press3d')].map((x) => `${x.innerText.trim()}${x.disabled ? " (off)" : ""}`).join(" / "));

await seed("plain");
const before = await p.evaluate(() => JSON.parse(localStorage.getItem("memap_trackers")).filter((t) => !t.archived).length);
await p.locator('[aria-label="Your hunch"]').click(); await p.waitForTimeout(900);
out.ask = await modal();
out.btnNone = await btn();
const rows = p.locator('[aria-modal="true"] [role="checkbox"]');
out.rows = await rows.count();
await p.screenshot({ path: `${D}/h2-ask.png` });
// tick the first three, untick the second
for (const i of [0, 1, 2]) { await rows.nth(i).click(); await p.waitForTimeout(150); }
await rows.nth(1).click(); await p.waitForTimeout(150);
out.checked = await p.evaluate(() => [...document.querySelectorAll('[aria-modal="true"] [role="checkbox"]')].map((x) => x.getAttribute("aria-checked")).join(","));
// her own idea, inline
await p.getByRole("button", { name: /my own idea/i }).click(); await p.waitForTimeout(300);
await p.keyboard.type("Too much screen time");
out.btnThree = await btn();
await p.screenshot({ path: `${D}/h2-picked.png` });
await p.locator('[aria-modal="true"] .press3d').first().click(); await p.waitForTimeout(1300);
out.noted = await modal();
await p.screenshot({ path: `${D}/h2-noted.png` });
out.hunches = await p.evaluate(() => JSON.parse(localStorage.getItem("memap_hunches") || "[]").map((h) => `${h.target.slice(-6)}<-${h.suspect.slice(-10)}`).join(" , "));
out.newQuestions = (await p.evaluate(() => JSON.parse(localStorage.getItem("memap_trackers")).filter((t) => !t.archived).length)) - before;
await p.locator('[aria-modal="true"] .press3d').first().click(); await p.waitForTimeout(800);
out.doneNode = await p.evaluate(() => !!document.querySelector('[aria-label="Your hunch"] .lucide-check'));

// two hunches about one question, both checked: shown together
await seed("checked");
await p.locator('[aria-label="Your hunch"]').click(); await p.waitForTimeout(1000);
out.result = await modal();
await p.screenshot({ path: `${D}/h2-result.png` });
await p.locator('[aria-modal="true"] .press3d').first().click(); await p.waitForTimeout(700);
out.seen = await p.evaluate(() => JSON.parse(localStorage.getItem("memap_hunches")).map((h) => !!h.seen).join(","));
out.afterResult = await modal();

// bubbles: the pop files load
await p.keyboard.press("Escape"); await p.goto("http://localhost:8080/"); await p.waitForTimeout(2300);
await p.locator('[aria-label="Unload your mind"]').first().click(); await p.waitForTimeout(2500);
out.sounds = [...sounds.entries()].map(([k, v]) => `${k}:${v}`).join(" ");
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
