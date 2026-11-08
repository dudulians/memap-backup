// v96 pushes (her note, Nov 8 2026: a 9:00 push "In bed by 23:00 · Day 2 of 14 · one small step
// today" — "полная лажа"): an old test with the 9:00 default moves to 22:00 once; the test's
// pushes change over the two weeks; the daily reminder has a warm title; EN and RU.
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await b.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:8080/"); await p.waitForTimeout(1200);
const out = {};
for (const lang of ["en", "ru"]) {
  out[lang] = await p.evaluate(async (lang) => {
    const i18n = (await import("/src/lib/i18n.ts")).default; await i18n.changeLanguage(lang);
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    // as on her phone: an old-name test from a plan, the 9:00 default, started yesterday; and a goal
    localStorage.removeItem("memap_try_time_fixed");
    localStorage.setItem("memap_experiments", JSON.stringify([
      { id: "1-test", island: "health", trackerId: "1-test", change: "In bed by 23:00", start: iso(1), remind: "09:00" },
      { id: "2-goal", island: "body", trackerId: "x", change: "3 workouts a week", start: iso(5), remind: "18:00", same: true, perWeek: 3 },
      { id: "3-test", island: "me", trackerId: "3-test", change: "Write tomorrow's worries on paper an hour before bed", start: iso(0), remind: "09:00" },
    ]));
    const n = await import("/src/lib/notifications.ts"), w = await import("/src/lib/testWords.ts");
    const plan = n.tryPlan();
    const times = JSON.parse(localStorage.getItem("memap_experiments")).map((x) => `${x.change} → ${x.remind}`);
    const pick = (i) => plan.filter((_, j) => j % 1 === 0).filter((x) => x.id % 1 === 0);
    return {
      times,
      names: ["In bed by 23:00", "В кровати до 23:00", "Phone away an hour before bed"].map((s) => `${s} → ${w.testNameOf(s)} | ${w.testQuestionOf(s)}`),
      pushes: plan.slice(0, 40).map((x) => `${x.schedule.at.toISOString().slice(5, 16)} ${x.title} — ${x.body}`),
      days: [1, 2, 3, 4, 5].map((k) => i18n.t(`notifications.dayTitle${k}`)),
      body: i18n.t("notifications.privateBody", { count: 3, min: 1 }),
    };
  }, lang);
}
console.log(JSON.stringify({ out, errs }, null, 1));
await b.close();
