// v111 (her "add all", Nov 8 2026): how an evening went, returns after a gap, the week and day on every
// event, a test's outcome, a tip's "not now". In dev, track() logs "[analytics:would-track]" lines.
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], logs = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => { const s = m.text(); if (s.includes("[analytics:")) logs.push(s); });
await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
await p.evaluate(async () => {
  const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
  localStorage.clear();
  localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "1");
  const ids = await dz.ensureTemplates(["migraine", "slept-enough", "felt-stressed"]);
  localStorage.setItem("memap_door", JSON.stringify({ id: "migraine", trackerId: ids[0], contextTrackerIds: [], startedAt: iso(20) }));
  localStorage.setItem("memap_path_start", iso(20)); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(19) }));
  localStorage.setItem("memap_last_active", iso(3)); // away for 3 days
  // a finished test to look at
  T0 = (await st.getTrackers());
  const E = []; for (let k = 1; k <= 18; k++) ids.forEach((id, i) => E.push({ id: `e${k}${i}`, trackerId: id, date: iso(k), value: (k + i) % 3 === 0 }));
  await st.saveTrackers([...(await st.getTrackers()), { id: "1-test", title: "Go to bed by 23:00", category: "Curious", questionText: "Did you go to bed by 23:00?", answerType: "boolean", periodDays: 30, threshold: 0, problemWhen: "no", adviceAboveThreshold: "", createdAt: new Date(Date.now() - 16 * 864e5).toISOString(), sortIndex: -1, island: "health" }]);
  for (let k = 2; k <= 15; k++) E.push({ id: `t${k}`, trackerId: "1-test", date: iso(k), value: k % 2 === 0 });
  await st.saveEntries(E);
  localStorage.setItem("memap_experiments", JSON.stringify([{ id: "1-test", island: "health", trackerId: "1-test", change: "Go to bed by 23:00", start: iso(15), remind: "22:00" }]));
}).catch(async () => {});
logs.length = 0;
await p.reload(); await p.waitForTimeout(3500);
const out = {};
out.gap = logs.find((l) => l.includes("returned_after_gap")) ?? "NONE";
out.register = logs.find((l) => l.includes("would-register")) ?? "NONE";
// an evening: open the questions and answer, one "Not sure"
await p.evaluate(() => window.dispatchEvent(new Event("memap-open-session"))); await p.waitForTimeout(1500);
for (let i = 0; i < 8; i++) {
  const ns = p.getByRole("button", { name: /^Not sure$/ }).first();
  const yes = p.getByRole("button", { name: /^Yes/ }).last();
  const btn = i === 1 ? ns : yes;
  if (!(await btn.isVisible().catch(() => false))) break;
  await btn.click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(700);
}
await p.waitForTimeout(1200);
out.evening = logs.find((l) => l.includes("daily_session_completed")) ?? "NONE";
await p.keyboard.press("Escape"); await p.waitForTimeout(600);
// a finished test: Yes, keep going
await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "signals", back: true } }))); await p.waitForTimeout(2200);
await p.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].find((x) => /23:00/.test(x.textContent))?.click()); await p.waitForTimeout(1500);
await p.evaluate(() => [...document.querySelectorAll("[aria-modal=true] button")].find((x) => /Yes, keep going/i.test(x.textContent))?.click()); await p.waitForTimeout(800);
out.test = logs.find((l) => l.includes("experiment_finished")) ?? "NONE";
const check = {
  gap: /returned_after_gap[\s\S]*days: 3/.test(out.gap),
  weekDay: /week: \d+[\s\S]*day: \d+/.test(out.register),
  evening: /answered: \d+[\s\S]*not_sure: 1[\s\S]*seconds: \d+[\s\S]*hour: \d+/.test(out.evening),
  testOutcome: /experiment_finished[\s\S]*kept: true[\s\S]*verdict: /.test(out.test),
};
console.log(JSON.stringify({ check, out, errs }, null, 1));
await b.close();
