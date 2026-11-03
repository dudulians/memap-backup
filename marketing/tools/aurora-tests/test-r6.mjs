// Her Nov 3 evening notes: tap the label too; open vs not-yet obvious; her
// day/night picture behind the path; back where she came from; even icons.
import { chromium } from "playwright-core";
const D = "./aurora-tests/work";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true })).newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
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
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_avatar", "08_fox");
    localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", theme);
  }, theme);
  await p.reload(); await p.waitForTimeout(2300);
};
const tab = () => p.evaluate(() => document.querySelector('nav button[aria-current="page"]')?.innerText.trim());
const sheet = () => p.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].map((d) => (d.innerText || "").split("\n").filter(Boolean).slice(0, 3).join(" / ")).join(" || "));

// 1. Today: her picture, nothing scattered, open vs locked.
await seed();
out.bg = await p.evaluate(() => getComputedStyle(document.querySelector(".memap-sea-bg")).backgroundImage.split("/").pop());
out.scenery = await p.evaluate(() => [...document.querySelectorAll("section img")].filter((i) => !/avatars|08_fox|chest/.test(i.src)).length);
out.locks = await p.evaluate(() => document.querySelectorAll("[data-path-stop] .lucide-lock").length);
out.looks = await p.evaluate(() => [...document.querySelectorAll("section [data-path-stop]")].map((e) => `${e.getAttribute("aria-label")}${e.querySelector(".lucide-lock") ? "🔒" : ""}`).join(" | "));
await p.screenshot({ path: `${D}/r6-path.png` });
await p.evaluate(() => { document.querySelector("main").scrollTop += 420; }); await p.waitForTimeout(300);
await p.screenshot({ path: `${D}/r6-path-2.png` });
await p.evaluate(() => { document.querySelector("main").scrollTop = 0; }); await p.waitForTimeout(200);

// 2. Tap the label, not the circle: a locked one says when; an open one starts.
const pillOf = (label) => p.evaluate((label) => {
  const node = [...document.querySelectorAll("section [data-path-stop]")].find((e) => e.getAttribute("aria-label") === label);
  if (!node) return null;
  node.scrollIntoView({ block: "center" });
  const r = node.getBoundingClientRect();
  return { x: r.right + 40, y: r.top + r.height / 2 };
}, label);
const tomorrow = await pillOf("Tomorrow");
if (tomorrow) { await p.waitForTimeout(400); const t2 = await pillOf("Tomorrow"); await p.screenshot({ path: `${D}/r6-before-pill.png` }); await p.mouse.click(t2.x, t2.y); await p.waitForTimeout(500); out.lockedPill = await p.evaluate(() => document.querySelector(".path-bubble")?.innerText || "no bubble"); }
if (false) { await p.mouse.click(tomorrow.x, tomorrow.y); await p.waitForTimeout(500); out.lockedPill = await p.evaluate(() => document.querySelector(".path-bubble")?.innerText || "no bubble"); }
await p.mouse.click(10, 300); await p.waitForTimeout(300);
const unload = await pillOf("Unload your mind");
if (unload) {
  await p.waitForTimeout(400); const u2 = await pillOf("Unload your mind");
  await p.mouse.click(u2.x, u2.y); await p.waitForTimeout(900);
  out.openPill = await p.evaluate(() => !!document.querySelector('[aria-modal="true"] canvas'));
  await p.getByRole("button", { name: /^done$|^close$/i }).first().click().catch(() => {}); await p.waitForTimeout(700);
}

// 3. A step's sheet on the Map: closing it comes back to Today.
await seed();
await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "overview", back: true } })));
await p.waitForTimeout(1800);
out.tripOpen = `${await tab()} · ${await sheet()}`;
await p.keyboard.press("Escape"); await p.waitForTimeout(1200);
out.tripBack = await tab();

// 4. An island's "Answer now": its questions on Today, then back to the island.
await p.getByRole("button", { name: /^map$/i }).first().click(); await p.waitForTimeout(2000);
await p.locator("main button[aria-label^='Health']").first().click(); await p.waitForTimeout(1300);
await p.getByRole("button", { name: /^answer now$/i }).click(); await p.waitForTimeout(2200);
out.deck = `${await tab()} · ${await p.evaluate(() => (document.body.innerText.match(/[^\n]*\d+ of \d+/) || [""])[0])}`;
const closeBtn = p.locator('[aria-label="Close"], [aria-label="close"]').first();
await closeBtn.click().catch(async () => { await p.keyboard.press("Escape"); });
await p.waitForTimeout(2000);
out.answerBack = `${await tab()} · ${await sheet()}`;
await p.screenshot({ path: `${D}/r6-answer-back.png` });

// 5. New island: even icons.
await p.keyboard.press("Escape"); await p.waitForTimeout(800);
await p.getByRole("button", { name: /new island/i }).first().click(); await p.waitForTimeout(1200);
await p.screenshot({ path: `${D}/r6-new-island.png` });
await p.keyboard.press("Escape"); await p.waitForTimeout(600);

// 6. Night.
await seed("aurora");
out.bgNight = await p.evaluate(() => getComputedStyle(document.querySelector(".memap-sea-bg")).backgroundImage.split("/").pop());
await p.screenshot({ path: `${D}/r6-night.png` });
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
