// Her Nov 3 night notes: the chosen change shows; swipe sounds; bubble speed
// and "To Notes"; questions from the Map as questions; the picture scrolls.
import { chromium } from "playwright-core";
const D = "./aurora-tests/work";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true })).newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
const sounds = new Map();
p.on("response", (r) => { const u = r.url(); if (/\.mp3(\?|$)/.test(u)) sounds.set(u.split("/").pop().split("?")[0], r.status()); });
const out = {};
const seed = async (theme = "aurora-light") => {
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(900);
  await p.evaluate(async (theme) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
    for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId) && e.date !== iso(0));
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    localStorage.setItem("memap_path_start", [...E.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_unload_intro", "seen"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_avatar", "08_fox");
    localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", theme);
  }, theme);
  await p.reload(); await p.waitForTimeout(2300);
};

// 1. The picture scrolls with the path; the header frosts.
await seed();
const bgAt = () => p.evaluate(() => { const el = [...document.querySelectorAll("main div[aria-hidden='true']")].find((d) => /path-day-top|path-night-top/.test(d.style.backgroundImage)); if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height), header: getComputedStyle(document.querySelector("header")).backdropFilter }; });
out.bg0 = await bgAt();
await p.screenshot({ path: `${D}/r8-path-top.png` });
await p.evaluate(() => { document.querySelector("main").scrollTop = 700; }); await p.waitForTimeout(500);
out.bg700 = await bgAt();
await p.screenshot({ path: `${D}/r8-path-scrolled.png` });
// back to her step on the drum ("My step"), the way a user does
{ const pill = p.getByRole("button", { name: /my step/i }); if (await pill.count()) { await pill.click(); await p.waitForTimeout(1300); } }

// 2. Swipe sounds load with the deck.
await p.getByRole("button", { name: /^start/i }).first().click(); await p.waitForTimeout(1500);
await p.keyboard.press("Escape"); await p.waitForTimeout(800);
out.swipeSounds = [...sounds.keys()].filter((k) => /swipe/.test(k)).join(" ");

// 3. Questions: three tabs; from the Map; written as questions; Back.
out.tabs = await p.evaluate(() => [...document.querySelectorAll("nav button")].map((x) => x.innerText.trim()).join(" | "));
await p.getByRole("button", { name: /^map$/i }).first().click(); await p.waitForTimeout(2000);
await p.locator("header").getByRole("button", { name: /^you$/i }).click(); await p.waitForTimeout(900);
await p.locator('[role="dialog"]').getByRole("button", { name: /^my questions/i }).click(); await p.waitForTimeout(1500);
out.questions = await p.evaluate(() => document.querySelector("main").innerText.split("\n").filter(Boolean).slice(0, 8).join(" | "));
out.navLit = await p.evaluate(() => document.querySelector('nav button[aria-current="page"]')?.innerText.trim());
await p.screenshot({ path: `${D}/r8-questions.png` });
await p.getByRole("button", { name: /^back$/i }).first().click(); await p.waitForTimeout(1500);
out.backTo = await p.evaluate(() => document.querySelector('nav button[aria-current="page"]')?.innerText.trim() + " · " + (document.querySelector(".map-head")?.innerText.split("\n")[0] || ""));

// 4. Test one change: the chosen one shows.
await p.locator("main button[aria-label^='Health']").first().click(); await p.waitForTimeout(1300);
const test = p.locator('[role="dialog"] button', { hasText: /test one change/i }).first();
await test.scrollIntoViewIfNeeded(); await test.click(); await p.waitForTimeout(1200);
const ideas = p.locator('[aria-modal="true"] button[aria-pressed]');
const n = await ideas.count();
await ideas.nth(n - 2).click(); await p.waitForTimeout(400);
out.chosen = await p.evaluate(() => { const b = [...document.querySelectorAll('[aria-modal="true"] button[aria-pressed="true"]')].pop(); return `${b.innerText.trim()} · shadow=${getComputedStyle(b).boxShadow.slice(0, 40)} · tick=${!!b.querySelector(".lucide-check")}`; });
await p.screenshot({ path: `${D}/r8-test-change.png` });
await p.locator('[aria-modal="true"] button[aria-label="Close"]').first().click(); await p.waitForTimeout(600);

// 5. Bubbles: speed, and "To Notes" for a long thought.
await p.goto("http://localhost:8080/"); await p.waitForTimeout(2300);
await p.locator('[aria-label="Unload your mind"]').first().click(); await p.waitForTimeout(1200);
const speed = p.locator('[aria-modal="true"] button[aria-label^="Speed"]');
out.speed = [await speed.innerText()];
await speed.click(); await p.waitForTimeout(200); out.speed.push(await speed.innerText());
await speed.click(); await p.waitForTimeout(200); out.speed.push(await speed.innerText());
out.speed = out.speed.map((s) => s.trim()).join(" → ");
await p.locator('[aria-modal="true"] input').fill("I keep thinking about the talk with my manager tomorrow");
await p.keyboard.press("Enter"); await p.waitForTimeout(600);
out.offer = await p.evaluate(() => [...document.querySelectorAll('[aria-modal="true"] button')].some((x) => /to notes/i.test(x.innerText)));
await p.screenshot({ path: `${D}/r8-bubbles-offer.png` });
await p.getByRole("button", { name: /^to notes$/i }).click(); await p.waitForTimeout(600);
out.offerSaved = await p.evaluate(() => /Saved/.test(document.querySelector('[aria-modal="true"]').innerText));
out.notes = await p.evaluate(async () => { const m = await import("/src/lib/notes.ts"); return (await m.getNotes()).map((n) => n.text).filter((t) => /manager/.test(t)).length; });
await p.waitForTimeout(2500);
await p.screenshot({ path: `${D}/r8-bubbles-fast.png` });

// 6. Night picture scrolls too.
await seed("aurora");
await p.evaluate(() => { document.querySelector("main").scrollTop = 500; }); await p.waitForTimeout(500);
await p.screenshot({ path: `${D}/r8-night-scrolled.png` });
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
