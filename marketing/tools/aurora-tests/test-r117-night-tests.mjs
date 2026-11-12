// r117 (Nov 10 2026, her note: a bedtime test asked "Did you set a reminder to go to bed 8 hours before you get up?"
// every evening — "не забудь сегодня лечь так, чтоб было 8 часов… во сколько надо лечь? … и вопрос на след день в
// карточках — Спала 8 часов? если его ещё не было"). Checks, EN and RU:
//  1. "I'll try" on the sleep card: no second question (the test watches "Did you sleep 7+ hours last night?"),
//     "When do you get up?" → "In bed by …", the reminder half an hour before, the push says tonight's bedtime;
//  2. the Done card of today's check-in says tonight's step;
//  3. a night idea's own question waits for its first night (askFrom tomorrow), the push says "tomorrow evening";
//  4. a watched hard question ("Smoked hookah?"): its "no" is the step done; morning steps; every plan has words.
// Run from marketing/tools:  node aurora-tests/test-r117-night-tests.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r117`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const ok = (name, cond, info = "") => { out[name] = !!cond; if (!cond) fails.push(`${name} ${typeof info === "string" ? info : JSON.stringify(info)}`.trim()); };

for (const lang of ["en", "ru"]) {
  const W = lang === "ru"
    ? { tryBtn: /^Попробовать 2 недели$/, start: /^Начать/i, cont: /^Дальше$/, no: /^Нет$/, sleepQ: "7+ часов", bed: "Лечь до 22:30: за 8 часов до подъёма.", push: "Сегодня ляг до 22:30: за 8 часов до подъёма в 06:30", startNight: "Завтра вечером MeMap спросит, как прошла ночь." }
    : { tryBtn: /Try it for 2 weeks/, start: /^Start/i, cont: /^Continue$/, no: /^No$/, sleepQ: "Did you sleep 7+ hours?", bed: "In bed by 10:30 PM: 8 hours before you get up.", push: "Tonight: in bed by 10:30 PM, 8 hours before your 6:30 AM wake-up", startNight: "Tomorrow evening MeMap will ask how the night went." };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: "Europe/London" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  // the afternoon, London time: the night-test push depends on the hour (run late at night it read as day 3; Nov 12 2026)
  const afternoon = new Date(); afternoon.setUTCHours(14, 0, 0, 0); await p.clock.install({ time: afternoon });
  let n = 0; const shot = async (name) => { await p.waitForTimeout(500); await p.screenshot({ path: `${D}/${lang}-night-${String(++n).padStart(2, "0")}-${name}.png` }); };
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  // three weeks: short nights on most days, so the sleep rule is lit; sleep is the topic
  const ids = await p.evaluate(async (lang) => {
    localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order"])); localStorage.setItem("memap_tour_seen", "true");
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" })); localStorage.setItem("memap_tour_completed", "1"); localStorage.setItem("memap_first_link_seen", "before");
    localStorage.setItem("memap_ab_onb", "A");
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    const [sleep, head, hookah] = await dz.ensureTemplates(["slept-enough", "headache", "smoked-hookah"]);
    const E = [];
    for (let d = 1; d <= 21; d++) {
      E.push({ id: `s-${d}`, trackerId: sleep, date: dz.daysAgoIso(d), value: d % 4 === 0 });
      E.push({ id: `h-${d}`, trackerId: head, date: dz.daysAgoIso(d), value: d % 3 === 0 });
      E.push({ id: `k-${d}`, trackerId: hookah, date: dz.daysAgoIso(d), value: d % 2 === 0 });
    }
    await st.saveEntries(E);
    localStorage.setItem("memap_path_start", dz.daysAgoIso(21));
    localStorage.setItem("memap_door", JSON.stringify({ id: "sleep", trackerId: sleep, contextTrackerIds: [], startedAt: dz.daysAgoIso(21) }));
    return { sleep, head, hookah };
  }, lang);
  await p.reload(); await p.waitForTimeout(2500);

  // 1. When to act → the sleep card → I'll try
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "signals", back: true } })));
  await p.waitForTimeout(2200);
  await p.evaluate(() => [...document.querySelectorAll("[role=dialog] button[aria-expanded=false]")].find((x) => /sleep|сна|сон/i.test(x.textContent))?.click());
  await p.waitForTimeout(800);
  const tryBtn = p.locator("[role=dialog]").last().getByRole("button", { name: W.tryBtn }).first();
  ok(`${lang}.1 I'll try on the sleep card`, (await tryBtn.count()) > 0);
  if (await tryBtn.count()) {
    await tryBtn.click(); await p.waitForTimeout(1500);
    await shot("try-sheet");
    const sheet = (await p.locator("div[role=dialog].fixed").last().innerText()).replace(/\s+/g, " ");
    out[`${lang}.sheet`] = sheet.slice(0, 400);
    ok(`${lang}.1 asks her own sleep question, nothing about a reminder`, sheet.includes(W.sleepQ) && !/reminder|напоминани/i.test(sheet.split(W.sleepQ)[0].slice(-200)), sheet.slice(0, 300));
    ok(`${lang}.1 "When do you get up?"`, (await p.locator("[data-wake]").count()) === 1);
    await p.locator("[data-wake] input[type=time]").fill("06:30"); await p.waitForTimeout(400);
    const bedAt = await p.locator("[data-bed-at]").innerText().catch(() => "");
    ok(`${lang}.1 bedtime counted back`, bedAt === W.bed, bedAt);
    await shot("wake-0630");
    const trackersBefore = await p.evaluate(() => JSON.parse(localStorage.getItem("memap_trackers") || "[]").length);
    await p.locator("div[role=dialog].fixed").last().getByRole("button", { name: W.start }).last().click(); await p.waitForTimeout(1500);
    const remind = await p.locator("div[role=dialog].fixed input[type=time]").last().inputValue().catch(() => "");
    ok(`${lang}.1 reminder half an hour before bed`, remind === "22:00", remind);
    await shot("started");
    await p.locator("div[role=dialog].fixed").last().getByRole("button", { name: W.cont }).click(); await p.waitForTimeout(1500);
    const st = await p.evaluate(async () => {
      const x = JSON.parse(localStorage.getItem("memap_experiments") || "[]").pop();
      const n = await import("/src/lib/notifications.ts");
      const plan = n.tryPlan();
      return { x, trackers: JSON.parse(localStorage.getItem("memap_trackers") || "[]").length, push: plan[0] ? `${plan[0].title} | ${plan[0].body}` : "", at: plan[0]?.schedule.at };
    });
    out[`${lang}.experiment`] = st;
    ok(`${lang}.1 watches the sleep question, no new one`, st.x?.same === true && st.x?.trackerId === ids.sleep && st.trackers === trackersBefore, st);
    ok(`${lang}.1 night + wake-up saved`, st.x?.night === true && st.x?.wake === "06:30", st.x);
    // the step is in the body since Nov 12 2026 (a title is one line on the lock screen and cut the step)
    ok(`${lang}.1 push says tonight's bedtime`, (st.push.split(" | ")[1] ?? "").startsWith(W.push), st.push);
  }
  await p.keyboard.press("Escape"); await p.waitForTimeout(800);

  // 2. today's check-in ends on Done with tonight's step
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "cards" } }))); await p.waitForTimeout(1200);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-session"))); await p.waitForTimeout(1600);
  for (let i = 0; i < 10; i++) {
    const no = p.getByRole("button", { name: W.no }).last();
    if (!(await no.count()) || !(await no.isVisible().catch(() => false))) break;
    await no.click().catch(() => {}); await p.waitForTimeout(700);
  }
  await p.waitForTimeout(900);
  const tonight = await p.locator("[data-tonight]").innerText().catch(() => "");
  out[`${lang}.tonight`] = tonight;
  ok(`${lang}.2 Done card: tonight's step`, tonight.replace(/\s+/g, " ").includes(W.push), tonight);
  await shot("done-tonight");

  // 3. a night idea's own question waits for its first night; 4. hookah watched: "no" is done; morning steps
  const logic = await p.evaluate(async (ids) => {
    const ex = await import("/src/lib/experiments.ts"), ps = await import("/src/lib/pathSteps.ts"), tw = await import("/src/lib/testWords.ts");
    const n = await import("/src/lib/notifications.ts"), st = await import("/src/lib/storage.ts"), ty = await import("/src/types/tracker.ts");
    const i18n = (await import("/src/lib/i18n.ts")).default;
    const x = await ex.startExperiment("health", i18n.t("experiment.idea.phoneAway.change"), i18n.t("experiment.idea.phoneAway.q"), undefined, { night: true });
    ex.setExperimentRemind(x.id, "21:00");
    const T = await st.getTrackers();
    const tr = T.find((t) => t.id === x.trackerId);
    const d = new Date(); d.setDate(d.getDate() + 1);
    const tomorrow = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const push = n.tryPlan().find((q) => q.body.startsWith(tw.testTodayOf(x.change) ?? "-"));
    // hookah, watched: 3 days without it, 1 with
    const h = { id: "h", island: "health", trackerId: ids.hookah, change: "x", start: "2026-11-01", same: true, doneWhen: false };
    const E = [["2026-11-01", false], ["2026-11-02", false], ["2026-11-03", true], ["2026-11-04", false]].map(([date, value], i) => ({ id: `e${i}`, trackerId: ids.hookah, date, value }));
    const r = ex.experimentResult(h, T, E);
    return {
      q: tr?.questionText, askFrom: tr?.askFrom, tomorrow, inToday: ps.activeQuestions(T).some((t) => t.id === tr?.id), askedTomorrow: ty.askedOn(tr, tomorrow),
      push: push ? `${push.title} | ${push.body}` : "", hookahDid: r.did, hookahAnswered: r.answered,
      morning: { outsideMorning: tw.morningStep("outsideMorning"), noPhoneMorning: tw.morningStep("noPhoneMorning"), walk20: tw.morningStep("walk20"), breakfastReady: tw.morningStep("breakfastReady"), bed23: tw.morningStep("bed23") },
      outsidePush: { title: tw.testTodayOf(i18n.t("experiment.idea.outsideMorning.change")), at: ex.smartRemindTime("outsideMorning") },
    };
  }, ids);
  out[`${lang}.logic`] = logic;
  ok(`${lang}.3 night question about last night`, /^(Last night|Вчера)/.test(logic.q ?? ""), logic.q);
  ok(`${lang}.3 not asked tonight, asked tomorrow`, logic.askFrom === logic.tomorrow && !logic.inToday && logic.askedTomorrow, logic);
  ok(`${lang}.3 push says tomorrow evening`, logic.push.includes(W.startNight) || logic.push === "", logic.push);
  ok(`${lang}.4 hookah watched: "no" days are done`, logic.hookahDid === 3 && logic.hookahAnswered === 4, logic);
  ok(`${lang}.4 morning steps`, logic.morning.outsideMorning && logic.morning.noPhoneMorning && !logic.morning.walk20 && !logic.morning.breakfastReady && !logic.morning.bed23, logic.morning);
  await ctx.close();
}

// 5. every daily library plan: its own step words (no "Did you set a reminder", no "Did you do this: “…”")
{
  const p = await b.newPage(); await p.goto("http://localhost:8080/"); await p.waitForTimeout(1200);
  const rows = await p.evaluate(async () => {
    const ls = await import("/src/lib/lifeStreams.ts"), tw = await import("/src/lib/testWords.ts"), { planKindOf } = await import("/src/lib/actionPoints.ts");
    const { setLanguage } = await import("/src/lib/i18n.ts");
    const out = [], seen = new Set();
    for (const s of ls.LIFE_STREAMS) for (const tpl of s.templates) {
      if (seen.has(tpl.id) || !tpl.adviceAboveThreshold) continue; seen.add(tpl.id);
      const tr = { id: `x-${tpl.id}`, title: tpl.title, questionText: tpl.questionText, problemWhen: tpl.problemWhen, adviceAboveThreshold: tpl.adviceAboveThreshold };
      if (planKindOf(tr) !== "daily") continue;
      for (const lng of ["en", "ru"]) { setLanguage(lng); const a = lng === "en" ? tpl.adviceAboveThreshold : tpl.adviceAboveThresholdRu; out.push({ id: tpl.id, lng, idea: tw.ideaOf(a), goal: tw.goalTemplateOf(a), q: tw.testQuestionOf(a), today: tw.testTodayOf(a) }); }
    }
    setLanguage("en");
    return out;
  });
  const bad = rows.filter((r) => (!r.idea && !r.goal) || !r.today || /set a reminder|set an? .*alarm|Did you do this|поставить напоминание|Получилось сделать это/i.test(r.q));
  out.plans = rows.length / 2;
  ok("5 every daily plan has its own step words", bad.length === 0, bad.slice(0, 8));
  await p.close();
}
console.log(JSON.stringify({ fails, out, errs }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
