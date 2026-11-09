// r97 (Nov 9 2026, her note: "надо сделать так, чтоб людям было спокойно и хорошо в приложении, и если
// чего-то не хватает, можно попросить их дозаполнить"): weeks follow the calendar from the path start.
// A. Path start Mon Nov 2; answered Mon, Wed, Thu of week 1 and Tue Nov 10 (today, calendar day 9, 20:00):
//    "Week 2 · 1 of 7", empty dots for the missed days (Mon 9 this week; Tue 3, Fri 6, Sat 7, Sun 8 in week 1),
//    week 1 has its report (3 evenings), the card "Missed a few days?…" with chips Tue 3 · Fri 6 · Sat 7 ·
//    Sun 8 · Mon 9; the Fri 6 chip opens that day's questions and the answers are saved on Nov 6;
//    "Not now" hides the card until another day is missed.
// B. Only Mon and Wed of week 1, nothing since, today Sat Nov 14: week 1 is "A quiet week." (no report,
//    no "Last week's report" step), this week can't reach 3 evenings either: "A quiet week." again.
// C. Reports opened before calendar weeks move to their calendar week (no second report, no "A quiet week." over
//    an opened one); the push's "report in N evenings" is counted for the evening it fires (Nov 10 2026).
// EN + RU. Run from marketing/tools: node aurora-tests/test-r97-calendar-weeks.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r97`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const ok = (name, cond, info = "") => { out[name] = cond ? "ok" : `FAIL ${info}`.slice(0, 400); if (!cond) fails.push(name); };

const START = "2026-11-02"; // a Monday
const open = async (lang, when) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: "Asia/Dubai", locale: lang === "ru" ? "ru-RU" : "en-US" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  await p.clock.install({ time: when });
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(900);
  return { ctx, p };
};
const seed = (p, lang, answered, extra = {}) => p.evaluate(async ({ lang, answered, START, extra }) => {
  localStorage.clear();
  localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1");
  localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order"])); localStorage.setItem("memap_avatar", "11_otter");
  localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_theme", "aurora-light");
  localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" })); localStorage.setItem("memap_first_link_seen", "before");
  for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
  const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
  const ids = await dz.ensureTemplates(["migraine", "slept-enough", "felt-stressed", "drank-water"]);
  const at = new Date(`${START}T09:00:00`).toISOString();
  await st.saveTrackers((await st.getTrackers()).map((t) => ({ ...t, createdAt: at })));
  localStorage.setItem("memap_onboarded_at", at);
  localStorage.setItem("memap_path_start", START);
  localStorage.setItem("memap_door", JSON.stringify({ id: "migraine", trackerId: ids[0], contextTrackerIds: [], startedAt: START }));
  const E = [];
  for (const d of answered) ids.forEach((id, i) => E.push({ id: `${d}-${i}`, trackerId: id, date: d, value: i % 2 === 0, createdAt: new Date(`${d}T21:00:00`).toISOString() }));
  await st.saveEntries(E);
}, { lang, answered, START, extra });
const model = (p) => p.evaluate(async () => {
  const ps = await import("/src/lib/pathSteps.ts"), st = await import("/src/lib/storage.ts");
  const m = ps.pathModel(await st.getTrackers(), await st.getEntries());
  return { week: m.week, dayInWeek: m.dayInWeek, pastInWeek: m.pastInWeek, todayCounted: m.todayCounted, reportIn: m.reportIn, quietWeek: m.quietWeek, weekComplete: m.weekComplete,
    missed: m.missedDays, pastWeeks: m.pastWeeks.map((w) => ({ answered: w.answered, quiet: w.quiet })), steps: m.steps.map((s) => s.id) };
});
const header = (p) => p.evaluate(() => document.getElementById("memap-header-center")?.innerText.replace(/\s+/g, " ").trim() ?? "");
const chips = (p) => p.$$eval("[data-fill-card] [data-fill-day]", (els) => els.map((e) => `${e.getAttribute("data-fill-day")}=${e.textContent.trim()}`));

for (const lang of ["en", "ru"]) {
  const RU = lang === "ru";
  // --- A: calendar day 9 -----------------------------------------------------------------------------------
  {
    const { ctx, p } = await open(lang, new Date(2026, 10, 10, 20, 0, 0));
    await seed(p, lang, ["2026-11-02", "2026-11-04", "2026-11-05", "2026-11-10"]);
    await p.reload(); await p.waitForTimeout(2800);
    const m = await model(p);
    out[`${lang}.A.model`] = m;
    ok(`${lang}.A week 2 on day 9`, m.week === 1 && m.dayInWeek === 1, JSON.stringify(m));
    ok(`${lang}.A 1 of 7 (today)`, m.pastInWeek.length === 0 && m.todayCounted);
    ok(`${lang}.A week 1 has its report`, m.pastWeeks.length === 1 && !m.pastWeeks[0].quiet && m.pastWeeks[0].answered.join() === "2026-11-02,2026-11-04,2026-11-05", JSON.stringify(m.pastWeeks));
    ok(`${lang}.A report in 5 evenings`, m.reportIn === 5, String(m.reportIn));
    // (today's answered questions stand before it: done steps go first, the path only goes forward)
    ok(`${lang}.A last week's report waits`, m.steps.find((s) => !s.startsWith("q:")) === "report", m.steps.join());
    ok(`${lang}.A missed days`, m.missed.join() === "2026-11-03,2026-11-06,2026-11-07,2026-11-08,2026-11-09", m.missed.join());
    const h = await header(p);
    out[`${lang}.A.header`] = h;
    ok(`${lang}.A header`, RU ? /Неделя 2 · 1 из 7/.test(h) : /Week 2 · 1 of 7/.test(h), h);
    const c = await chips(p);
    out[`${lang}.A.chips`] = c;
    const want = RU ? ["Вт 3", "Пт 6", "Сб 7", "Вс 8", "Пн 9"] : ["Tue 3", "Fri 6", "Sat 7", "Sun 8", "Mon 9"];
    ok(`${lang}.A chips`, c.map((x) => x.split("=")[1]).join("|") === want.join("|"), c.join("|"));
    const card = (await p.locator("[data-fill-card]").innerText().catch(() => "")).replace(/\s+/g, " ");
    out[`${lang}.A.card`] = card;
    ok(`${lang}.A card words`, RU ? /Пропущено несколько дней\? Ничего страшного\. Можно заполнить, если помнишь\./.test(card) && /Не сейчас/.test(card)
      : /Missed a few days\? That's fine\. Fill them in if you remember\./.test(card) && /Not now/.test(card), card);
    ok(`${lang}.A no guilt words`, !/you didn.t|you missed|не заполнил|забыл/i.test(card), card);
    ok(`${lang}.A old pill gone`, (await p.locator(".past-pill").count()) === 0);
    await p.screenshot({ path: `${D}/${lang}-A1-today.png` });
    // empty dots: Mon 9 on this week's path, Tue 3 / Fri 6 / Sat 7 / Sun 8 in week 1
    const empties = await p.$$eval(".path-node.disc-empty", (els) => els.map((e) => e.getAttribute("aria-label")));
    out[`${lang}.A.empties`] = empties;
    ok(`${lang}.A five empty dots`, empties.length === 5, empties.join());
    const reds = await p.$$eval(".path-node.disc-empty", (els) => els.filter((e) => e.querySelector("svg")).length);
    ok(`${lang}.A empty dots have no icon`, reds === 0);
    // today's step stands below the card, clear of it
    const room = await p.evaluate(() => {
      const card = document.querySelector("[data-fill-card]")?.getBoundingClientRect();
      const start = document.querySelector(".path-start")?.getBoundingClientRect();
      return card && start ? Math.round(start.top - card.bottom) : null;
    });
    out[`${lang}.A.startBelowCard`] = room;
    ok(`${lang}.A Start bubble below the card`, room !== null && room > 0, String(room));
    // this week's empty Monday: its card fills it in
    await p.evaluate(() => document.querySelector(".path-node.disc-empty[data-path-stop]")?.scrollIntoView({ block: "center" })); await p.waitForTimeout(900);
    await p.locator(".path-node.disc-empty[data-path-stop]").first().click(); await p.waitForTimeout(700);
    const bubble = (await p.locator(".path-bubble").innerText().catch(() => "")).replace(/\s+/g, " ");
    out[`${lang}.A.mondayCard`] = bubble;
    ok(`${lang}.A Monday card`, RU ? /Понедельник, 9 ноября/.test(bubble) && /Заполнить/.test(bubble) : /Monday, November 9/.test(bubble) && /Fill it in/.test(bubble), bubble);
    await p.screenshot({ path: `${D}/${lang}-A2-monday-card.png` });
    await p.mouse.click(30, 420); await p.waitForTimeout(400);
    // week 1 in view
    await p.evaluate(() => document.querySelector(".path-node.disc-empty:not([data-path-stop])")?.scrollIntoView({ block: "center" })); await p.waitForTimeout(900);
    await p.screenshot({ path: `${D}/${lang}-A3-week1.png` });
    // Fri 6 from the card: that evening's questions, saved on Nov 6
    await p.locator('[data-fill-card] [data-fill-day="2026-11-06"]').click(); await p.waitForTimeout(1500);
    await p.screenshot({ path: `${D}/${lang}-A4-friday-deck.png` });
    out[`${lang}.A.deck`] = (await p.locator("[role=dialog]").last().innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 200);
    for (let i = 0; i < 12; i++) {
      const no = p.getByRole("button", { name: RU ? /^Нет$/ : /^No$/ }).first();
      if (!(await no.isVisible().catch(() => false))) break;
      await no.click(); await p.waitForTimeout(700);
    }
    await p.waitForTimeout(1500);
    const saved = await p.evaluate(async () => (await (await import("/src/lib/storage.ts")).getEntries()).filter((e) => e.date === "2026-11-06").length);
    out[`${lang}.A.savedOnFri`] = saved;
    ok(`${lang}.A Friday saved on Nov 6`, saved === 4, String(saved));
    await p.reload(); await p.waitForTimeout(2600);
    const m2 = await model(p);
    ok(`${lang}.A Friday counted in week 1`, m2.pastWeeks[0].answered.includes("2026-11-06") && !m2.missed.includes("2026-11-06"), JSON.stringify(m2.pastWeeks));
    const c2 = await chips(p);
    ok(`${lang}.A Fri chip gone`, c2.length === 4 && !c2.some((x) => x.startsWith("2026-11-06")), c2.join("|"));
    ok(`${lang}.A still 1 of 7`, RU ? /Неделя 2 · 1 из 7/.test(await header(p)) : /Week 2 · 1 of 7/.test(await header(p)));
    await p.screenshot({ path: `${D}/${lang}-A5-after-friday.png` });
    // Not now: gone, and it stays gone after a reload
    await p.locator("[data-fill-card] button", { hasText: RU ? "Не сейчас" : "Not now" }).click(); await p.waitForTimeout(500);
    ok(`${lang}.A Not now hides`, (await p.locator("[data-fill-card]").count()) === 0);
    await p.reload(); await p.waitForTimeout(2400);
    ok(`${lang}.A still hidden after reload`, (await p.locator("[data-fill-card]").count()) === 0);
    const hidden = await p.evaluate(() => localStorage.getItem("memap_fill_card_hidden"));
    await p.screenshot({ path: `${D}/${lang}-A6-not-now.png` });
    await ctx.close();
    // two days later, Wed Nov 11 not answered: a new missed day brings the card back
    const later = await open(lang, new Date(2026, 10, 12, 20, 0, 0));
    await seed(later.p, lang, ["2026-11-02", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-10"], { memap_fill_card_hidden: hidden ?? "[]" });
    await later.p.reload(); await later.p.waitForTimeout(2600);
    const c3 = await chips(later.p);
    out[`${lang}.A.later`] = c3;
    ok(`${lang}.A back for a new missed day`, c3.some((x) => x.startsWith("2026-11-11")), c3.join("|"));
    await later.p.screenshot({ path: `${D}/${lang}-A7-two-days-later.png` });
    await later.ctx.close();
  }
  // --- B: quiet weeks ----------------------------------------------------------------------------------------
  {
    const { ctx, p } = await open(lang, new Date(2026, 10, 14, 20, 0, 0));
    await seed(p, lang, ["2026-11-02", "2026-11-04"]);
    await p.reload(); await p.waitForTimeout(2800);
    const m = await model(p);
    out[`${lang}.B.model`] = m;
    ok(`${lang}.B week 1 quiet`, m.pastWeeks[0]?.quiet === true);
    ok(`${lang}.B no last week's report`, !m.steps.includes("report"), m.steps.join());
    ok(`${lang}.B this week quiet`, m.quietWeek && m.reportIn === null, JSON.stringify(m));
    const h = await header(p);
    ok(`${lang}.B header`, RU ? /Неделя 2 · 0 из 7/.test(h) : /Week 2 · 0 of 7/.test(h), h);
    const quiet = await p.$$eval("[data-quiet-week]", (els) => els.map((e) => e.textContent.trim()));
    out[`${lang}.B.quiet`] = quiet;
    ok(`${lang}.B "A quiet week." twice`, quiet.length === 2 && quiet.every((q) => q === (RU ? "Тихая неделя." : "A quiet week.")), quiet.join("|"));
    // (the two coming weeks, faded below, keep theirs)
    const reports = await p.$$eval(".path-node", (els) => els.filter((n) => !n.closest(".path-coming") && /Week report|First report|Last week|Отч[её]т/.test(n.getAttribute("aria-label") ?? "")).length);
    ok(`${lang}.B no report node`, reports === 0, String(reports));
    const chip = (await p.locator("[data-tour=week] button").innerText().catch(() => "")).trim();
    out[`${lang}.B.weekChip`] = chip;
    await p.screenshot({ path: `${D}/${lang}-B1-today.png` });
    await p.evaluate(() => document.querySelectorAll("[data-quiet-week]")[0]?.scrollIntoView({ block: "center" })); await p.waitForTimeout(900);
    await p.screenshot({ path: `${D}/${lang}-B2-quiet-week1.png` });
    await p.evaluate(() => document.querySelectorAll("[data-quiet-week]")[1]?.scrollIntoView({ block: "center" })); await p.waitForTimeout(900);
    await p.screenshot({ path: `${D}/${lang}-B3-quiet-this-week.png` });
    await ctx.close();
  }
  // --- C: reports opened before calendar weeks (Nov 10 2026) --------------------------------------------------------
  // Two reports saved under the old numbers (no dates): one opened Mon Nov 9 (the first day of week 2: last week's,
  // so week 1), one opened Mon Nov 16 (week 2's). Week 1 has only 2 answered evenings by the calendar. Today Wed Nov 18:
  // each moves to its calendar week, no "Last week's report" step for evenings already reported, and week 1 shows
  // its opened report, not "A quiet week.".
  {
    const { ctx, p } = await open(lang, new Date(2026, 10, 18, 20, 0, 0));
    const rec = (openedAt) => JSON.stringify({ openedAt, lines: [{ label: "x", k: 1, n: 7 }], reward: "rainbow" });
    await seed(p, lang, ["2026-11-02", "2026-11-04", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-17"],
      { memap_week_chests: `{"0":${rec("2026-11-09")},"1":${rec("2026-11-16")}}`, memap_fill_card_hidden: JSON.stringify(["2026-11-15", "2026-11-16"]) });
    await p.reload(); await p.waitForTimeout(2800);
    const m = await model(p);
    const chests = await p.evaluate(() => Object.fromEntries(Object.entries(JSON.parse(localStorage.getItem("memap_week_chests") || "{}")).map(([k, r]) => [k, `${r.dates?.[0]}..${r.dates?.[6]}${r.legacy ? " legacy" : ""}`])));
    out[`${lang}.C.chests`] = chests;
    ok(`${lang}.C old reports on their calendar weeks`, chests[0] === "2026-11-02..2026-11-08 legacy" && chests[1] === "2026-11-09..2026-11-15 legacy" && Object.keys(chests).length === 2, JSON.stringify(chests));
    ok(`${lang}.C no second report for the same evenings`, !m.steps.includes("report"), m.steps.join());
    // week 1 sits behind "1 earlier week": open it
    await p.getByRole("button", { name: RU ? /Прошлых недель: 1/ : /1 earlier week/ }).click(); await p.waitForTimeout(1200);
    const strips = await p.$$eval(".path-week-label", (els) => els.map((e) => e.textContent.trim()));
    out[`${lang}.C.strips`] = strips;
    await p.evaluate(() => document.querySelector(".path-week-label")?.scrollIntoView({ block: "start" })); await p.waitForTimeout(900);
    const quiet = await p.$$eval("[data-quiet-week]", (els) => els.length);
    const gold = await p.$$eval(".path-node", (els) => els.filter((n) => !n.closest(".path-coming") && /Week report|Отчёт недели/.test(n.getAttribute("aria-label") ?? "")).length);
    ok(`${lang}.C an opened report, never "A quiet week." over it`, strips.length >= 2 && quiet === 0 && gold >= 2, JSON.stringify({ strips, quiet, gold }));
    await p.screenshot({ path: `${D}/${lang}-C1-old-reports.png` });
    // the push's report line is for the evening it fires: on a week's last day after the reminder time, tomorrow's
    const r = await p.evaluate(async () => {
      const ps = await import("/src/lib/pathSteps.ts"), st = await import("/src/lib/storage.ts");
      const T = await st.getTrackers(), E = await st.getEntries();
      return { thu: ps.reportInOn(T, E, new Date(2026, 10, 19, 21, 0, 0)), sun: ps.reportInOn(T, E, new Date(2026, 10, 22, 21, 0, 0)), mon: ps.reportInOn(T, E, new Date(2026, 10, 23, 21, 0, 0)) };
    });
    out[`${lang}.C.reportIn`] = r;
    // Thu: 4 evenings left; Sun: this week can't reach 3 evenings any more (none); Mon: a new week, 7
    ok(`${lang}.C report count on the push's own day`, r.thu === 4 && r.sun === null && r.mon === 7, JSON.stringify(r));
    await ctx.close();
  }
}
console.log(JSON.stringify({ out, fails, errs: errs.filter((e) => !/InAppReview|sentry/i.test(e)) }, null, 1));
await b.close();
process.exit(fails.length ? 1 : 0);
