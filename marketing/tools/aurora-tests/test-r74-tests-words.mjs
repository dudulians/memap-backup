// v96 (her phone notes, Nov 8 2026): a test's evening question is a whole question; a weekly
// goal ("3 workouts a week") uses the question she has; the reminder time can be changed;
// When to act says the question and the answer that counts; names follow the language;
// the calendar shows the whole question; bubbles are the end of the day, not a step.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r74`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
let n = 0; const shot = async (name) => { await p.waitForTimeout(900); await p.screenshot({ path: `${D}/${String(++n).padStart(2, "0")}-${name}.png` }); };
await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
await p.evaluate(async () => {
  const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
  for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
  const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
  const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId));
  const find = (re) => T.find((t) => re.test(t.title));
  // "Worked out": no workout on the last 6 days, so its weekly goal is reached
  const ex = find(/Worked out/);
  E = E.filter((e) => !(e.trackerId === ex.id && e.date >= iso(6)));
  for (let i = 0; i <= 6; i++) E.push({ id: `x${i}`, trackerId: ex.id, date: iso(i), value: i === 6, createdAt: new Date().toISOString() });
  localStorage.clear();
  localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
  const head = find(/headache/i), anx = find(/anxious/i), sleep = find(/Slept enough/i);
  localStorage.setItem("memap_door", JSON.stringify({ id: "migraine", trackerId: head.id, contextTrackerIds: [], startedAt: iso(60), extra: [{ id: "stress", trackerId: anx.id }, { id: "sleep", trackerId: sleep.id }] }));
  localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "true"); localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "1");
  localStorage.setItem("memap_theme", "aurora-light"); localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(1) }));
});
await p.reload(); await p.waitForTimeout(2500);
const openAct = async () => { await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "signals", back: true } }))); await p.waitForTimeout(2200); };
await openAct(); await shot("act-lit");
out.workoutCard = await p.evaluate(() => { const c = [...document.querySelectorAll("[role=dialog] .surface")].find((x) => /3 workouts a week/.test(x.textContent)); return c ? c.innerText.replace(/\s+/g, " ") : null; });
// Try it for 2 weeks on "3 workouts a week": the question she has, with a goal
await p.evaluate(() => { const c = [...document.querySelectorAll("[role=dialog] .surface")].find((x) => /3 workouts a week/.test(x.textContent)); [...c.querySelectorAll("button")].find((x) => /Try it for 2 weeks/.test(x.textContent))?.click(); });
await p.waitForTimeout(1500); await shot("goal-start");
out.goalStart = await p.evaluate(() => document.querySelector("[role=dialog][aria-modal=true]")?.innerText.replace(/\s+/g, " ").slice(0, 400));
await p.getByRole("button", { name: /^Start$/i }).last().click(); await p.waitForTimeout(1200); await shot("goal-started");
await p.getByRole("button", { name: /^Continue$/i }).last().click().catch(() => {}); await p.waitForTimeout(1200);
// two more tests: a ready idea and a library plan
out.started = await p.evaluate(async () => {
  const x = await import("/src/lib/experiments.ts"), w = await import("/src/lib/testWords.ts");
  await x.startExperiment("me", "In bed by 23:00", w.testQuestionOf("In bed by 23:00"));
  const plan = "Write tomorrow's worries on paper an hour before bed";
  await x.startExperiment("love", plan, w.testQuestionOf(plan));
  return x.runningExperiments().map((e) => ({ change: e.change, same: !!e.same, perWeek: e.perWeek ?? null, tracker: e.trackerId.slice(-5) }));
});
await p.reload(); await p.waitForTimeout(2200);
await openAct(); await shot("act-tests");
// a test opens: its question, its week, its reminder; change the time
await p.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].find((x) => /Go to bed by 23:00/.test(x.textContent))?.click());
await p.waitForTimeout(1000); await shot("test-sheet");
await p.locator("[role=dialog] [role=switch]").last().click(); await p.waitForTimeout(400);
await p.locator("[role=dialog] input[type=time]").last().fill("21:45"); await p.waitForTimeout(500);
out.remind = await p.evaluate(() => JSON.parse(localStorage.getItem("memap_experiments")).map((e) => `${e.change}: ${e.remind ?? "-"}`));
await shot("test-sheet-21-45");
// the evening questions, EN then RU
const cards = () => p.evaluate(async () => {
  const s = await import("/src/lib/storage.ts"), c = await import("/src/lib/cardText.ts"), x = await import("/src/lib/experiments.ts"), w = await import("/src/lib/testWords.ts"), L = await import("/src/lib/trackerLocalize.ts");
  const ts = await s.getTrackers();
  return x.runningExperiments().map((e) => { const tr = ts.find((t) => t.id === e.trackerId); return { name: w.testNameOf(e.change), title: tr ? L.localizeTrackerTitle(tr.title) : null, q: tr ? c.cardQuestion(tr) : null }; });
});
out.en = await cards();
// the calendar: the whole question
await p.keyboard.press("Escape"); await p.waitForTimeout(500); await p.keyboard.press("Escape"); await p.waitForTimeout(500);
await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "overview", back: true } })));
await p.waitForTimeout(2200); await shot("calendar");
await p.locator("[role=dialog] button[aria-expanded]").last().click(); await p.waitForTimeout(600); await shot("calendar-list");
// Today: no bubbles step in the middle
await p.keyboard.press("Escape"); await p.waitForTimeout(600);
await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "today" } }))); await p.waitForTimeout(1500);
out.unloadStepOnToday = await p.evaluate(() => /Unload your mind/.test(document.body.innerText));
// Russian
await p.evaluate(() => localStorage.setItem("memap_language", "ru")); await p.reload(); await p.waitForTimeout(2500);
out.ru = await cards();
await openAct(); await shot("ru-act");
await p.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].find((x) => /Ложиться спать до 23:00/.test(x.textContent))?.click());
await p.waitForTimeout(1000); await shot("ru-test-sheet");
console.log(JSON.stringify({ out, errs }, null, 1));
await b.close();
