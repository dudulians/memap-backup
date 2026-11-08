// v110 (her note, Nov 8 2026: "откуда пришли пользователи, на каком моменте закрыли приложение…").
// In dev nothing is sent: track() logs "[analytics:would-track]" — this test reads those lines.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r87`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], logs = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => { const s = m.text(); if (s.includes("[analytics:would-track]")) logs.push(s); });
await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
await p.evaluate(async () => {
  const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
  localStorage.clear();
  localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "1");
  localStorage.setItem("memap_cohort", "new"); localStorage.setItem("memap_first_open", new Date(Date.now() - 2 * 864e5).toISOString());
  const ids = await dz.ensureTemplates(["migraine", "slept-enough", "felt-stressed"]);
  localStorage.setItem("memap_door", JSON.stringify({ id: "migraine", trackerId: ids[0], contextTrackerIds: [], startedAt: iso(2) }));
  localStorage.setItem("memap_path_start", iso(2)); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(1) }));
  const E = []; for (const k of [2, 1]) ids.forEach((id, i) => E.push({ id: `e${k}${i}`, trackerId: id, date: iso(k), value: i % 2 === 0 }));
  await st.saveEntries(E);
});
logs.length = 0; // from here on: a returning user (the first load had the real onboarding open)
await p.reload(); await p.waitForTimeout(3000);
const hide = () => p.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" }); document.dispatchEvent(new Event("visibilitychange")); Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" }); });
const out = {};
out.onbOnStart = logs.filter((l) => l.includes("onboarding_screen")).length;
await hide(); await p.waitForTimeout(300);
out.leftToday = logs.filter((l) => l.includes("app_left")).pop() ?? "NONE";
await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-you"))); await p.waitForTimeout(1200);
await hide(); await p.waitForTimeout(300);
out.leftYou = logs.filter((l) => l.includes("app_left")).pop() ?? "NONE";
await p.keyboard.press("Escape"); await p.waitForTimeout(800);
// "Where did you hear about MeMap?" — on "Your world has begun", the end of onboarding
await p.evaluate(async () => { const d = new Date(); const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; const st = await import("/src/lib/storage.ts"); const T = await st.getTrackers(); const E = await st.getEntries(); await st.saveEntries([...E, { id: "today1", trackerId: T[0].id, date: iso, value: true }]); window.dispatchEvent(new CustomEvent("memap-world-begun", { detail: { date: iso } })); });
await p.waitForTimeout(1200);
out.cardShown = await p.getByText("Where did you hear about MeMap?").count();
// the reminder sheet comes up after a moment: close it first
await p.waitForTimeout(1200); await p.getByRole("button", { name: /Not now/i }).first().click().catch(() => {}); await p.waitForTimeout(500);
await p.screenshot({ path: `${D}/01-source-on-begun.png` });
if (out.cardShown) await p.getByRole("button", { name: "Instagram" }).first().click();
await p.waitForTimeout(500);
await p.screenshot({ path: `${D}/02-source-picked.png` });
out.source = await p.evaluate(() => localStorage.getItem("memap_source"));
out.sourceLog = logs.filter((l) => l.includes("source_answered")).pop() ?? "NONE";
out.cardGone = await p.getByText("Thank you!").count() === 1 ? 0 : 1;
out.screens = logs.filter((l) => l.includes("screen_viewed")).slice(0, 3);
const check = {
  noOnboardingScreenOnStart: out.onbOnStart === 0,
  leftOnToday: /app_left[\s\S]*tab:cards/.test(out.leftToday),
  leftOnYou: /app_left[\s\S]*"you"|screen: 'you'|you/.test(out.leftYou) && !/tab:cards/.test(out.leftYou),
  sourceCard: out.cardShown === 1 && out.source === "instagram" && /instagram/.test(out.sourceLog) && out.cardGone === 0,
};
console.log(JSON.stringify({ check, out, errs }, null, 1));
await b.close();
