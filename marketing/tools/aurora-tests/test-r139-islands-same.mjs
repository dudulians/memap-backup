// r139 (Nov 11 2026, her notes): islands look the same and grow the same everywhere, and no camera.
// 1. An island's card shows the island exactly as on the globe: its treasures stand on it (header and the ladder's
//    stage it is at); the ladder's "In bloom" flag stands on the ground (no flag hanging in the air).
// 2. Making her own island shows her pack's island (the first stage) and the same ladder, no old flat-map looks to
//    flip through.
// 3. The camera treasure is gone: not in the treasures, never promised in the progress lines.
// Run from marketing/tools: node aurora-tests/test-r139-islands-same.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r139`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const ok = (name, cond, info = "") => { out[name] = cond ? "ok" : `FAIL ${typeof info === "string" ? info : JSON.stringify(info)}`.slice(0, 500); if (!cond) fails.push(name); console.log(name, "→", out[name]); };
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
await p.evaluate(async () => {
  const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
  for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
  const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
  const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId));
  localStorage.clear(); localStorage.setItem("memap_ab_onb", "A");
  localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
  localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1");
  localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_theme", "aurora-light");
  localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(1) }));
  localStorage.setItem("memap_path_start", iso(60)); localStorage.setItem("memap_globe_turned", "1"); localStorage.setItem("memap_links_lit", "[]");
});
await p.reload(); await p.waitForTimeout(2500);
await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns" } })));
await p.waitForTimeout(500); for (let i = 0; i < 3; i++) { await p.keyboard.press("Escape"); await p.waitForTimeout(250); }
await p.waitForTimeout(4500);

// 1. the island card
const onGlobe = await p.evaluate(() => [...document.querySelectorAll('.planet-things [data-isle="me"] .treasure')].map((x) => [...x.classList].find((c) => c.startsWith("it-"))).sort());
await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-island", { detail: { island: "me" } })));
await p.waitForTimeout(1500);
const card = await p.evaluate(() => {
  const d = [...document.querySelectorAll("[role=dialog]")].pop();
  const head = d.querySelector(".island-pic");
  const steps = [...d.querySelectorAll(".grid-cols-4 .island-pic")];
  const ringed = d.querySelector(".grid-cols-4 .pick-on .island-pic");
  const kinds = (el) => [...(el?.querySelectorAll(".treasure") ?? [])].map((x) => [...x.classList].find((c) => c.startsWith("it-"))).sort();
  return { head: kinds(head), ringed: kinds(ringed), steps: steps.length, flagStands: !!d.querySelector(".grid-cols-4 .island-pic .stand.flag"), floating: d.querySelectorAll(".grid-cols-4 img.absolute").length };
});
await p.screenshot({ path: `${D}/1-card.png` });
ok("the card's island has the globe's treasures", onGlobe.length > 0 && JSON.stringify(card.head) === JSON.stringify(onGlobe), { onGlobe, card });
ok("…and so does the ladder's stage it is at", JSON.stringify(card.ringed) === JSON.stringify(onGlobe), card);
ok("four stages, the flag standing on the ground, nothing hanging", card.steps === 4 && card.flagStands && card.floating === 0, card);
await p.keyboard.press("Escape"); await p.waitForTimeout(700);

// 2. her own island
await p.getByRole("button", { name: /New island/ }).first().click(); await p.waitForTimeout(800);
await p.getByRole("button", { name: /own/i }).first().click(); await p.waitForTimeout(900);
const ed = await p.evaluate(() => {
  const d = [...document.querySelectorAll("[role=dialog]")].pop();
  return { art: d.querySelector("[data-new-island] .island-pic")?.getAttribute("data-art"), ladder: d.querySelectorAll(".grid-cols-4 .island-pic").length, arrows: d.querySelectorAll("[aria-label='Another look']").length, oldBase: [...d.querySelectorAll("img")].some((i) => /island_(plain|rocky)/.test(i.src)) };
});
await p.screenshot({ path: `${D}/2-own.png` });
ok("own island: her pack's first stage, the same ladder, no old looks", ed.art === "03_flower_hill" && ed.ladder === 4 && ed.arrows === 0 && !ed.oldBase, ed);
await p.keyboard.press("Escape"); await p.waitForTimeout(500);

// 3. no camera
const cam = await p.evaluate(async () => {
  const g = await import("/src/lib/growth.ts"), rl = await import("/src/lib/reminderLines.ts"), en = (await import("/src/locales/en.ts")).default;
  const lines = JSON.stringify(Object.values(rl)).toLowerCase();
  return { items: g.ITEMS.map((x) => x.id), inTexts: JSON.stringify(en).toLowerCase().includes("camera"), lines: lines.includes("camera") };
});
ok("no camera among the treasures or in any English text", !cam.items.includes("camera") && !cam.inTexts && !cam.lines, cam);
console.log(JSON.stringify({ fails, errs: errs.slice(0, 5) }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
