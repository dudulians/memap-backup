// r159 (Nov 14 2026): six things the older checks could not find are opened for real, on a phone-size screen.
// Not words in a file: each one is tapped and what opens is read and pictured (work/r159).
// 1 Write a note · 2 Your hunch · 3 Unload your mind · 4 Explore new questions · 5 Back to the old look (Settings)
// 6 "Something keeps bothering me" (onboarding A, second screen).
// Run from marketing/tools with the dev server on 8080; exit 1 when one does not open.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r159`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const check = (name, ok, info) => { out[name] = ok ? "ok" : `FAIL ${info !== undefined ? JSON.stringify(info).slice(0, 500) : ""}`; if (!ok) fails.push(name); };
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
const seed = async () => {
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async () => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); const r = g.generateDemoData("work-home");
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(r.newTrackers)); localStorage.setItem("memap_entries", JSON.stringify(r.newEntries));
    localStorage.setItem("memap_path_start", [...r.newEntries.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1");
    localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order", "report"]));
    localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(9) })); localStorage.setItem("memap_playful_asked", "seed");
    localStorage.setItem("memap_week_chests", JSON.stringify(Object.fromEntries(Array.from({ length: 9 }, (_, w) => [w, { openedAt: iso(1), lines: [], reward: "balloon" }]))));
  });
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(2200);
};
const mainText = () => p.evaluate(() => (document.querySelector("main")?.innerText ?? "").split("\n").filter(Boolean).join(" | "));
// tap a step of the path by its name, then the action of its card
const step = async (label) => {
  const found = await p.evaluate((label) => {
    const el = [...document.querySelectorAll("main button")].find((x) => (x.getAttribute("aria-label") ?? "") === label || x.innerText.trim() === label || x.innerText.includes(label));
    if (!el) return false; el.scrollIntoView({ block: "center" }); el.click(); return true;
  }, label);
  if (!found) return { found: false };
  await p.waitForTimeout(900);
  const acted = await p.evaluate(() => { const re = /^(Go|Start|Play|See it|Open|Pop bubbles|Check|Write|Begin)$/; const btn = [...document.querySelectorAll("button")].filter((x) => re.test(x.innerText.trim())); btn[btn.length - 1]?.click(); return btn.map((x) => x.innerText.trim()); });
  await p.waitForTimeout(1500);
  return { found: true, acted };
};
const top = async () => (await p.evaluate(() => { const d = [...document.querySelectorAll("[role=dialog]")].pop(); return (d?.innerText ?? "").split("\n").filter(Boolean).join(" | "); })).slice(0, 260);

await seed();
out["today"] = (await mainText()).slice(0, 700);

let r = await step("Write a note"); let t = await top(); await p.screenshot({ path: `${D}/1-note.png` });
check("1. Write a note opens the note", r.found && /note|Note/.test(t) , { r, t }); await p.keyboard.press("Escape"); await p.waitForTimeout(800);

await seed(); r = await step("Your hunch"); t = await top(); const body2 = (await p.evaluate(() => document.body.innerText)).slice(0, 4000); await p.screenshot({ path: `${D}/2-hunch.png` });
check("2. Your hunch opens the game", r.found && /hunch|Hunch|guess|Guess/.test(t + body2.slice(0, 1500)), { r, t });

// 3 and 4 live on the card of "The end of today's path" once the evening is answered (the bubbles are no step of their own)
const endCard = async (label) => {
  await p.evaluate(() => { const el = [...document.querySelectorAll("main button")].find((x) => ["The end of today", "Done for today", "Pop bubbles"].some((w) => x.innerText.includes(w) || (x.getAttribute("aria-label") ?? "").includes(w))); el?.scrollIntoView({ block: "center" }); el?.click(); });
  await p.waitForTimeout(1000);
  const card = (await p.evaluate(() => [...document.querySelectorAll("button")].map((x) => x.innerText.trim()).filter(Boolean))).join(" | ");
  const hit = await p.evaluate((label) => { const btn = [...document.querySelectorAll("button")].find((x) => x.innerText.trim() === label); btn?.click(); return !!btn; }, label);
  await p.waitForTimeout(1600);
  return { hit, card: card.slice(-400) };
};
await seed(); r = await endCard("Pop bubbles"); const body3 = (await p.evaluate(() => document.body.innerText)).split("\n").filter(Boolean).join(" | "); await p.screenshot({ path: `${D}/3-bubbles.png` });
out["3 screen"] = body3.slice(0, 260);
check("3. Pop bubbles (Unload your mind) opens from the end of today's path", r.hit && body3.includes("Unload your mind") && body3.includes("How it works"), r);

// "Explore new questions" is on that card only once every step of today is done: finish the day as r96 does
await seed();
await p.evaluate(async () => {
  const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const T = JSON.parse(localStorage.getItem("memap_trackers")), E = JSON.parse(localStorage.getItem("memap_entries"));
  const ps = await import("/src/lib/pathSteps.ts");
  for (const k of ["memap_hunch_day", "memap_act_seen"]) localStorage.setItem(k, iso(0));
  for (const s of ps.pathModel(T, E).steps) if (s.kind === "task") ps.markTaskDone(s.task);
  const rs = await import("/src/lib/reasons.ts");
  rs.markAsked(rs.pendingReasons(T, E, iso(0)).map(rs.reasonKey), "saved", iso(0), true);
  const ot = await import("/src/lib/observeTips.ts");
  const tip = ot.tipForToday(T, iso(0)); if (tip) ot.markTip(tip.tip.id, "later");
});
await p.goto("http://localhost:8080/"); await p.waitForTimeout(2200);
r = await endCard("Explore new questions"); t = await p.evaluate(() => document.body.innerText); await p.screenshot({ path: `${D}/4-explore.png` });
check("4. Explore new questions opens the questions to add", r.hit && t.includes("Add a question") && t.includes("Write my own"), { r });

await seed();
await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-you"))); await p.waitForTimeout(1400);
await p.evaluate(() => { const row = [...document.querySelectorAll("[role=dialog] button")].find((x) => x.innerText.trim() === "Settings"); row?.click(); }); await p.waitForTimeout(1500);
const settings = await p.evaluate(() => document.body.innerText);
await p.screenshot({ path: `${D}/5-settings.png` });
check("5. Settings shows \"Back to the old look\"", /Back to the old look/.test(settings), settings.replace(/\s+/g, " ").slice(0, 400));

// 6. onboarding A, second screen
await p.goto("http://localhost:8080/"); await p.waitForTimeout(600);
await p.evaluate(() => { localStorage.clear(); localStorage.setItem("memap_ab_onb_preview", "A"); localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); });
await p.goto("http://localhost:8080/"); await p.waitForTimeout(1600);
await p.locator("button").filter({ hasText: /^Get started/ }).last().click(); await p.waitForTimeout(1200);
const onb = (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
await p.screenshot({ path: `${D}/6-onboarding-a.png` });
check("6. Onboarding A: \"Something keeps bothering me\" on the second screen", /Something keeps bothering me/.test(onb), onb.slice(0, 300));

await b.close();
console.log(JSON.stringify(out, null, 1));
if (errs.length) console.log("PAGE ERRORS:", errs.slice(0, 5));
process.exit(fails.length || errs.length ? 1 : 0);
