// r136 (her picks, Nov 11 2026: "1 да · 2 A · 3 да · 4 A · 5 да · 6 да" on the "Простые слова MeMap" page):
// 1. A test's result says one human line: "Looks like walks together help: you argue with your partner less often.",
//    its count under it; "don't help" when worse; "it helps" for her own plan; "more often" for a good answer.
// 2. Praise for the effort: 10–13 of 14 "Well done!", 7–9 "Good effort!", fewer: nothing.
// 3. Worse / same / too few in plain words; "on one side" is gone.
// 4. When to act counts questions, never "rules".
// 5. The island card says the hard answer in words: "No compliment from partner · 5 days".
// 6. The report's "In short": no question names in quotes.
// Run from marketing/tools: node aurora-tests/test-r136-human-words.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r136`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const ok = (name, cond, info = "") => { out[name] = cond ? "ok" : `FAIL ${typeof info === "string" ? info : JSON.stringify(info)}`.slice(0, 700); if (!cond) fails.push(name); console.log(name, "→", out[name]); };
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:8080/"); await p.waitForTimeout(1200);

// --- 1–4, 6: the words themselves, EN and RU ---
const words = await p.evaluate(async () => {
  const i18n = (await import("/src/lib/i18n.ts")).default;
  const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
  const { resultWords, praiseFor } = await import("/src/lib/testResult.ts");
  localStorage.clear();
  await dz.ensureTemplates(["argued-with-partner", "partner-complimented-me", "noisy-neighbors"]);
  const T = await st.getTrackers();
  const id = (re) => T.find((x) => re.test(x.title)).id;
  const argue = id(/argued/i), compl = id(/compliment/i), noisy = id(/neighbo/i);
  const res = (during, before, most) => ({ answered: 14, did: 12, withChange: [3, 12], without: [0, 2], during, before, most });
  const x = (change) => ({ id: "x", island: "love", trackerId: "q", change, start: "2026-10-28" });
  const out = {};
  for (const lng of ["en", "ru"]) {
    await i18n.changeLanguage(lng);
    const t = i18n.t.bind(i18n);
    const walk = t("experiment.idea.walkTogether.change"), thanks = t("experiment.idea.thankYou.change");
    out[lng] = {
      better: resultWords(t, x(walk), res([3, 14], [8, 14], { trackerId: argue, hardYes: true, by: "before", a: [2, 14], b: [8, 14] }), T),
      worse: resultWords(t, x(walk), res([9, 14], [3, 14], { trackerId: argue, hardYes: true, by: "before", a: [8, 14], b: [2, 14] }), T),
      own: resultWords(t, x("My own little plan"), res([3, 14], [8, 14], { trackerId: argue, hardYes: true, by: "before", a: [2, 14], b: [8, 14] }), T),
      good: resultWords(t, x(thanks), res([3, 14], [8, 14], { trackerId: compl, hardYes: false, by: "before", a: [2, 14], b: [9, 14] }), T),
      same: resultWords(t, x(walk), res([5, 14], [5, 14], { trackerId: argue, hardYes: true, by: "before", a: [2, 14], b: [8, 14] }), T),
      few: resultWords(t, x(walk), { answered: 4, did: 4, withChange: [1, 4], without: [0, 0], during: [1, 4], before: [0, 0] }, T),
      outside: resultWords(t, x(walk), res([3, 14], [8, 14], { trackerId: noisy, hardYes: true, by: "before", a: [2, 14], b: [8, 14] }), T),
      praise: [12, 8, 5].map((k) => praiseFor(t, k)),
      act: [t("act.sub", { count: 3 }), t("rules.moreLit", { count: 7 }), t("rules.calmMore", { count: 14 }), t("rules.calmAll", { count: 5 }), t("path.next4.lit", { count: 1 }), t("world4.noneYet"), t("how.litLine")],
      report: [t("report.find.calmWords", { what: "No headache", count: 6 }), t("report.find.good", { what: "compliment from partner", k: 4, count: 14 })],
    };
  }
  return out;
});
const W = words;
ok("EN better: names the test and says what changed", W.en.better.human && W.en.better.head === "Looks like walks together help: you argue with your partner less often.", W.en.better);
ok("EN better: the count under it", W.en.better.count === "2 of 14 days during the test, 8 of 14 in the two weeks before.", W.en.better.count);
ok("RU better", W.ru.better.head === "Похоже, прогулки вместе помогают: вы с партнёром реже ссоритесь." && W.ru.better.count === "2 из 14 дней во время проверки, 8 из 14 за две недели до.", W.ru.better);
ok("worse: don't help, more often", W.en.worse.head === "Looks like walks together don't help: you argue with your partner more often." && W.ru.worse.head === "Похоже, прогулки вместе не помогают: вы с партнёром чаще ссоритесь.", [W.en.worse.head, W.ru.worse.head]);
ok("her own plan: it helps", W.en.own.head === "Looks like it helps: you argue with your partner less often." && W.ru.own.head === "Похоже, это помогает: вы с партнёром реже ссоритесь.", [W.en.own.head, W.ru.own.head]);
ok("a good answer: more often, counted as good days", W.en.good.head === "Looks like saying thank you helps: your partner pays you a real compliment more often." && W.en.good.count === "12 of 14 days during the test, 5 of 14 in the two weeks before." && W.ru.good.head === "Похоже, слова благодарности помогают: партнёр чаще говорит что-то по-настоящему доброе.", W.en.good);
ok("same: plain words, the change under it", W.en.same.head === "No difference yet: about as many hard days as before." && !W.en.same.human && W.en.same.most === "You argue with your partner less often: 2 of 14 days during the test, 8 of 14 in the two weeks before.", W.en.same);
ok("RU same", W.ru.same.head === "Пока без разницы: тяжёлых дней примерно столько же, сколько раньше." && W.ru.same.most === "Вы с партнёром реже ссоритесь: 2 из 14 дней во время проверки, 8 из 14 за две недели до.", W.ru.same);
ok("too few: no 'on one side'", W.en.few.head === "Not enough answered days to compare yet." && W.ru.few.head === "Пока мало отвеченных дней, чтобы сравнить.", [W.en.few.head, W.ru.few.head]);
ok("something no change can move (neighbours): the old plain line", !W.en.outside.human && /^Fewer hard days/.test(W.en.outside.head), W.en.outside);
ok("praise: 12 → Well done!, 8 → Good effort!, 5 → nothing", JSON.stringify(W.en.praise) === JSON.stringify(["Well done!", "Good effort!", null]) && JSON.stringify(W.ru.praise) === JSON.stringify(["Отлично!", "Уже немало!", null]), [W.en.praise, W.ru.praise]);
ok("When to act counts questions, never rules", W.en.act.every((s) => !/\brules?\b/i.test(s)) && W.ru.act.every((s) => !/правил/i.test(s)) && W.en.act[1] === "7 more questions: time to act" && W.ru.act[1] === "Ещё 7 вопросов: пора действовать" && W.en.act[0] === "Time to act on 3 questions", W.en.act.concat(W.ru.act));
ok("report: no names in quotes", W.en.report.every((s) => !/[“”«»]/.test(s)) && W.ru.report.every((s) => !/[“”«»]/.test(s)) && W.en.report[0] === "No headache: 6 days in a row, your longest stretch.", W.en.report.concat(W.ru.report));

// --- 1, 2 on the screen: a finished "Go for a walk together" on Love life ---
const seed = (lang) => p.evaluate(async (lang) => {
  const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
  const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return dz.isoLocal(d); };
  localStorage.clear();
  localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1");
  localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_theme", "aurora-light");
  localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(1) }));
  localStorage.setItem("memap_path_start", iso(40)); localStorage.setItem("memap_ab_onb", "A");
  const [argue, compl] = await dz.ensureTemplates(["argued-with-partner", "partner-complimented-me"]);
  const T = (await st.getTrackers()).map((t) => ({ ...t, createdAt: new Date(Date.now() - 40 * 864e5).toISOString() }));
  T.push({ id: "walk-q", title: "Go for a walk together", category: "Curious", questionText: "Did you go for a walk together?", answerType: "boolean", periodDays: 30, threshold: 0, problemWhen: "no", adviceAboveThreshold: "", createdAt: new Date(Date.now() - 16 * 864e5).toISOString(), sortIndex: -1, island: "love" });
  await st.saveTrackers(T);
  const E = [];
  // the two weeks before (16..29 days ago): an argument on 8 of 14; the test (2..15): on 2 of 14, walks on 12
  for (let i = 16; i <= 29; i++) { E.push({ id: `a${i}`, trackerId: argue, date: iso(i), value: i % 7 < 4, createdAt: new Date().toISOString() }); E.push({ id: `c${i}`, trackerId: compl, date: iso(i), value: i % 2 === 0, createdAt: new Date().toISOString() }); }
  for (let i = 2; i <= 15; i++) { E.push({ id: `a${i}`, trackerId: argue, date: iso(i), value: i === 4 || i === 11, createdAt: new Date().toISOString() }); E.push({ id: `c${i}`, trackerId: compl, date: iso(i), value: i % 2 === 0, createdAt: new Date().toISOString() }); E.push({ id: `w${i}`, trackerId: "walk-q", date: iso(i), value: i !== 6 && i !== 9, createdAt: new Date().toISOString() }); }
  // the last week: no compliment on 5 days, an argument on 3, so the island card has rows
  for (let i = 0; i <= 1; i++) { E.push({ id: `a${i}`, trackerId: argue, date: iso(i), value: true, createdAt: new Date().toISOString() }); E.push({ id: `c${i}`, trackerId: compl, date: iso(i), value: false, createdAt: new Date().toISOString() }); }
  await st.saveEntries(E);
  localStorage.setItem("memap_experiments", JSON.stringify([{ id: "walk-x", island: "love", trackerId: "walk-q", change: "Go for a walk together", start: iso(15) }]));
}, lang);
const openResult = async () => {
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "signals", back: true } })));
  await p.waitForTimeout(2400);
  await p.evaluate(() => [...document.querySelectorAll("[role=dialog] button, [role=dialog] [role=button]")].find((x) => /walk together|Гулять вместе/i.test(x.textContent))?.click());
  await p.waitForTimeout(1600);
};
for (const lang of ["en", "ru"]) {
  await seed(lang); await p.reload(); await p.waitForTimeout(2600);
  for (let i = 0; i < 2; i++) { await p.keyboard.press("Escape"); await p.waitForTimeout(300); }
  await openResult();
  const r = await p.evaluate(() => ({
    head: document.querySelector("[data-result-head]")?.textContent ?? null,
    count: document.querySelector("[data-result-count]")?.textContent ?? null,
    praise: document.querySelector("[data-praise]")?.textContent ?? null,
    did: document.querySelector("[data-praise]")?.parentElement?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    text: ([...document.querySelectorAll("[aria-modal=true]")].pop()?.innerText ?? "").replace(/\s+/g, " "),
  }));
  await p.locator("[data-result-head]").first().scrollIntoViewIfNeeded().catch(() => {});
  await p.screenshot({ path: `${D}/${lang}-1-result.png` });
  if (lang === "en") {
    ok("screen EN: the human line", r.head === "Looks like walks together help: you argue with your partner less often.", r);
    ok("screen EN: its count", r.count === "2 of 14 days during the test, 8 of 14 in the two weeks before.", r.count);
    ok("screen EN: 12 of 14 days. Well done!", r.did === "You did it on 12 of 14 days. Well done!", r.did);
    ok("screen EN: no old lines", !/biggest difference|It may help you|“/.test(r.text), r.text.slice(0, 400));
  } else {
    ok("screen RU: the human line", r.head === "Похоже, прогулки вместе помогают: вы с партнёром реже ссоритесь.", r);
    ok("screen RU: 12 из 14 дней. Отлично!", r.did === "Получилось 12 из 14 дней. Отлично!", r.did);
  }
  // "No, that's enough": the test goes to What helps, with the same first line
  await p.evaluate(() => [...document.querySelectorAll("[aria-modal=true] button")].find((x) => /No, that's enough|Нет, хватит|Нет/i.test(x.textContent))?.click());
  await p.waitForTimeout(1200);
  await p.keyboard.press("Escape"); await p.waitForTimeout(500);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns" } }))); await p.waitForTimeout(2200);
  await p.evaluate(() => document.querySelector("[data-tour=helps]")?.click()); await p.waitForTimeout(1500);
  const helps = await p.evaluate(() => [...document.querySelectorAll("[data-result-head]")].map((x) => x.textContent));
  await p.screenshot({ path: `${D}/${lang}-2-what-helps.png` });
  ok(`What helps ${lang}: the same first line`, helps.includes(lang === "en" ? "Looks like walks together help: you argue with your partner less often." : "Похоже, прогулки вместе помогают: вы с партнёром реже ссоритесь."), helps);
  for (let i = 0; i < 3; i++) { await p.keyboard.press("Escape"); await p.waitForTimeout(400); }

  // 5. the island card
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns" } }))); await p.waitForTimeout(1800);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-island", { detail: { island: "love" } }))); await p.waitForTimeout(1800);
  const rows = await p.evaluate(() => [...document.querySelectorAll("[data-hard-row]")].map((x) => x.textContent.replace(/\s+/g, " ").trim()));
  const foot = await p.evaluate(() => /a “yes” to a hard question|«да» на трудный вопрос/.test(document.body.innerText));
  await p.locator("[data-hard-row]").first().scrollIntoViewIfNeeded().catch(() => {});
  await p.screenshot({ path: `${D}/${lang}-3-island.png` });
  ok(`island card ${lang}: the hard answer in words, no quotes`, rows.length > 0 && rows.every((s) => !/[“”«»]/.test(s)) && rows.some((s) => (lang === "en" ? /^No compliment from partner\s?\d+ days?$/ : /^Без доброго слова от партнёра\s?\d+ (день|дня|дней)$/).test(s)), rows);
  ok(`island card ${lang}: no yes/no footnote when every row is in words`, !foot);
  for (let i = 0; i < 3; i++) { await p.keyboard.press("Escape"); await p.waitForTimeout(400); }
}

console.log(JSON.stringify({ fails, out, errs }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
