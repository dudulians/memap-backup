// v102 (her "и все другие слабые места пофикси", Nov 8 2026): test results (14 of 14 compares with the
// two weeks before; a goal by week; the biggest difference on any island), reminders (a day done, a
// week's goal met, a finished evening, the real count) and You / Settings (Settings last, no More, the
// old look once, no avatar row).
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r83`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
let n = 0; const shot = async (name) => { await p.waitForTimeout(900); await p.screenshot({ path: `${D}/${String(++n).padStart(2, "0")}-${name}.png` }); };
await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);

const base = (lang) => `
  localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "true");
  localStorage.setItem("memap_language", "${lang}"); localStorage.setItem("memap_language_chosen", "1");
  localStorage.setItem("memap_theme", "aurora-light"); localStorage.setItem("memap_first_link_seen", "before");`;

// 1) results: a 14-of-14 test and a weekly goal met one week of two
const seedResults = (lang) => p.evaluate(async ([lang, baseJs]) => {
  const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
  for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
  const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
  T = T.filter((t) => !/worked out|workout/i.test(t.title));
  const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId));
  // "Go to bed by 23:00": every day of the two weeks
  T.push({ id: "1-test", title: "Go to bed by 23:00", category: "Curious", questionText: "Did you go to bed by 23:00?", answerType: "boolean", periodDays: 30, threshold: 0, problemWhen: "no", adviceAboveThreshold: "", createdAt: new Date(Date.now() - 16 * 864e5).toISOString(), sortIndex: -1, island: "health" });
  for (let i = 2; i <= 15; i++) E.push({ id: `t${i}`, trackerId: "1-test", date: iso(i), value: true, createdAt: new Date().toISOString() });
  // a weekly goal on her own "Worked out": 3 the first week, 2 the second
  T.push({ id: "ex1", title: "Worked out", category: "Health", questionText: "Did you do a real workout today (gym, run, sport, yoga)?", answerType: "boolean", periodDays: 7, threshold: 5, problemWhen: "no", adviceAboveThreshold: "3 workouts a week", createdAt: new Date(Date.now() - 60 * 864e5).toISOString(), sortIndex: 1 });
  const yes1 = new Set([15, 13, 11]), yes2 = new Set([8, 5]);
  for (let i = 2; i <= 15; i++) E.push({ id: `x${i}`, trackerId: "ex1", date: iso(i), value: yes1.has(i) || yes2.has(i), createdAt: new Date().toISOString() });
  localStorage.clear(); localStorage.setItem("memap_ab_onb", "A"); eval(baseJs);
  localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
  localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(1) })); localStorage.setItem("memap_path_start", iso(60));
  localStorage.setItem("memap_experiments", JSON.stringify([
    { id: "1-test", island: "health", trackerId: "1-test", change: "Go to bed by 23:00", start: iso(15), remind: "22:00" },
    { id: "2-goal", island: "body", trackerId: "ex1", change: "3 workouts a week", start: iso(15), from: "ex1", same: true, perWeek: 3, remind: "18:00" },
  ]));
}, [lang, base(lang)]);

const resultOf = async (re) => {
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns" } }))); await p.waitForTimeout(2000);
  await p.evaluate(() => document.querySelector("[data-tour=helps]")?.click()); await p.waitForTimeout(1300);
  await p.evaluate((src) => { const r = new RegExp(src, "i"); [...document.querySelectorAll("[role=dialog] button")].find((x) => r.test(x.textContent))?.click(); }, re);
  await p.waitForTimeout(1500);
  return p.evaluate(() => document.querySelector("[aria-modal=true]")?.innerText.replace(/\s+/g, " ") ?? "NO RESULT");
};
for (const lang of ["en", "ru"]) {
  await seedResults(lang); await p.reload(); await p.waitForTimeout(2500);
  out[`${lang}.all14`] = await resultOf(lang === "en" ? "bed by 23:00" : "до 23:00"); await shot(`${lang}-all14`);
  await p.evaluate(() => [...document.querySelectorAll("[aria-modal=true] button")].find((x) => /close|закрыть/i.test(x.getAttribute("aria-label") ?? ""))?.click()); await p.waitForTimeout(700);
  await p.keyboard.press("Escape"); await p.waitForTimeout(500);
  out[`${lang}.goal`] = await resultOf(lang === "en" ? "3 workouts" : "3 тренировки"); await shot(`${lang}-goal`);
}

// 2) reminders
out.reminders = await p.evaluate(async (baseJs) => {
  const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts"), nt = await import("/src/lib/notifications.ts");
  localStorage.clear(); localStorage.setItem("memap_ab_onb", "A"); eval(baseJs);
  const [period, flow, slept] = await dz.ensureTemplates(["period-day", "heavy-flow-day", "slept-enough"]);
  // today: no period (so "heavy flow?" isn't asked), slept well; the follow-up stays unanswered
  await st.saveEntries([{ id: "a", trackerId: period, date: iso(0), value: false }, { id: "b", trackerId: slept, date: iso(0), value: true }]);
  const s = { enabled: true, time: "23:59", thresholdAlerts: false };
  const done = await nt.reminderPlan(s);
  await st.saveEntries([{ id: "b", trackerId: slept, date: iso(0), value: true }]);
  const notDone = await nt.reminderPlan(s);
  // tests: one done today, one weekly goal met this week
  const E = [{ id: "y", trackerId: "1-test", date: iso(0), value: true }];
  for (let i = 0; i < 3; i++) E.push({ id: `g${i}`, trackerId: slept, date: iso(0), value: true });
  localStorage.setItem("memap_experiments", JSON.stringify([
    { id: "1-test", island: "health", trackerId: "1-test", change: "Go to bed by 23:00", start: iso(2), remind: "23:58" },
    { id: "2-goal", island: "health", trackerId: slept, change: "3 workouts a week", start: iso(2), same: true, perWeek: 3, remind: "23:57" },
  ]));
  const plan = nt.tryPlan(E);
  const today = iso(0);
  const dayOf = (x) => `${x.schedule.at.getFullYear()}-${String(x.schedule.at.getMonth() + 1).padStart(2, "0")}-${String(x.schedule.at.getDate()).padStart(2, "0")}`;
  const now = new Date(), sun = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - ((now.getDay() + 6) % 7)));
  const sunday = `${sun.getFullYear()}-${String(sun.getMonth() + 1).padStart(2, "0")}-${String(sun.getDate()).padStart(2, "0")}`;
  return {
    eveningSkippedWhenPathDone: !done.some((x) => dayOf(x) === today),
    eveningKeptWhenNotDone: notDone.some((x) => dayOf(x) === today),
    countLine: done[0]?.body ?? "",
    testTodaySkipped: !plan.some((x) => dayOf(x) === today && /23:00/.test(x.title + x.body)),
    goalWeekSkipped: !plan.some((x) => dayOf(x) <= sunday && x.schedule.at.getHours() === 23 && x.schedule.at.getMinutes() === 57),
    goalNextWeekKept: plan.some((x) => dayOf(x) > sunday && x.schedule.at.getMinutes() === 57),
  };
}, base("en"));

// 3) You and Settings
await seedResults("en"); await p.reload(); await p.waitForTimeout(2500);
await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-you"))); await p.waitForTimeout(1500);
out.youRows = await p.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].map((x) => x.innerText.trim()).filter((s) => s && s.length < 40).slice(0, 8));
await shot("you");
await p.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].find((x) => /^Settings$/.test(x.innerText.trim()))?.click()); await p.waitForTimeout(1800);
await shot("settings");
out.settings = await p.evaluate(() => [...document.querySelectorAll("[role=dialog]")].map((d) => d.innerText.replace(/\s+/g, " ")).find((s) => /Settings/.test(s)) ?? "");
const i18n = await p.evaluate(async () => { const m = (await import("/src/lib/i18n.ts")).default; return { old: m.t("upgrade.oldLook"), more: m.t("settings.more"), avatar: m.t("avatar.title"), settings: m.t("common.settings") }; });
const count = (s, w) => s.split(w).length - 1;
const check = {
  all14Before: /every day, all 14/.test(out["en.all14"]) && /two weeks before/i.test(out["en.all14"]) && !/Too few days/.test(out["en.all14"]),
  all14RuBefore: /все 14/.test(out["ru.all14"]) && /за две недели до/i.test(out["ru.all14"]),
  goalWeeks: /Week 1: 3 of 3\. Week 2: 2 of 3\./.test(out["en.goal"]) && /Goal met one week of the two/.test(out["en.goal"]),
  goalWeeksRu: /Неделя 1: 3 из 3\. Неделя 2: 2 из 3\./.test(out["ru.goal"]),
  mostLine: /biggest difference/i.test(out["en.all14"] + out["en.goal"]),
  ...out.reminders,
  countIsTwo: /\b2 short questions|2 коротких вопроса/.test(out.reminders.countLine),
  settingsLastInYou: out.youRows.indexOf(i18n.settings) > out.youRows.findIndex((s) => /How MeMap works/.test(s)),
  noMore: count(out.settings, i18n.more + " ") === 0 || !new RegExp(`\\b${i18n.more}\\b`).test(out.settings),
  oldLookOnce: count(out.settings, i18n.old) === 1,
  noAvatarRow: !out.settings.includes(i18n.avatar),
};
console.log(JSON.stringify({ check, out, errs }, null, 1));
await b.close();
