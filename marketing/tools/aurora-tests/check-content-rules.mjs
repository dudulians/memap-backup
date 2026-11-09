// Her rules as one automatic check over ALL the content (Nov 9 2026, her ask: "как сделать так, чтобы
// ты находил реальные ошибки"). Walks see a few screens; this reads every library question, every
// test idea and every plan in EN and RU through the app's own functions, and fails on a broken rule.
// Run from marketing/tools:  node aurora-tests/check-content-rules.mjs [baseUrl]
// Prints a list of problems (rule · id · text) and exits 1 when there are any.
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "fs";

const BASE = process.argv[2] || "http://localhost:8080";
const OUT = "./aurora-tests/work/content-rules";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const page = await browser.newPage();
await page.goto(BASE + "/");
await page.waitForTimeout(1500);

const problems = await page.evaluate(async () => {
  const ls = await import("/src/lib/lifeStreams.ts");
  const i18nMod = await import("/src/lib/i18n.ts");
  const i18n = i18nMod.default, setLanguage = i18nMod.setLanguage;
  const { cardQuestion } = await import("/src/lib/cardText.ts");
  const { answerPhrase, answerClause } = await import("/src/lib/answerPhrases.ts");
  const tl = await import("/src/lib/trackerLocalize.ts");
  const { topicOf, ideasForQuestion } = await import("/src/lib/topicIdeas.ts");
  const ex = await import("/src/lib/experiments.ts");
  const { testNameOf, testQuestionOf } = await import("/src/lib/testWords.ts");
  const en = (await import("/src/locales/en.ts")).default ?? (await import("/src/locales/en.ts")).en;
  const ru = (await import("/src/locales/ru.ts")).default ?? (await import("/src/locales/ru.ts")).ru;

  const out = [];
  const bad = (rule, id, text) => out.push({ rule, id, text });
  const GENDER = /[а-яё]\((а|ась|ла|ой|на|ы|ая|легла|прошла|одна|довольна)\)/i;
  const LATIN_IN_RU = /\b(?!MeMap\b|SMS\b|PDF\b|OK\b|GP\b)[A-Za-z]{3,}\b/;
  const FIRST_PERSON_EN = /\b(my|myself|I|me|I'll|I'm)\b/;
  const TODAY_EN = /\b(today|last night|tonight)\b/i;
  const TODAY_RU = /\bсегодня\b/i;
  const NO_SPACE_TIME = /\b\d{1,2}(am|pm)\b/;
  const RAW = /\{\{|\}\}|undefined|null|\[object/;

  // 1. Every library question, both languages
  const seen = new Set();
  const NO_TOPIC_OK = new Set(["took-meds", "period-day", "early-migraine-signs", "pill-free-day", "medicine-change", "noisy-neighbors", "construction-nearby", "long-commute", "transport-issue", "internet-down", "travel-or-night-away", "hot-day", "weather-change", "dealt-with-paperwork", "local-institution-contact", "climate-drained-me"]);
  for (const s of ls.LIFE_STREAMS) for (const tpl of s.templates) {
    if (seen.has(tpl.id) || tpl.sensitive) continue; seen.add(tpl.id);
    const tr = { id: `1700000000000-${tpl.id}-0`, title: tpl.title, category: tpl.category, cluster: s.id, questionText: tpl.questionText, answerType: tpl.answerType, periodDays: tpl.periodDays, threshold: tpl.threshold, problemWhen: tpl.problemWhen, adviceAboveThreshold: tpl.adviceAboveThreshold, createdAt: "", sortIndex: 0 };
    // a topic, and ideas only from that topic
    const topic = topicOf(tr);
    if (!topic && !NO_TOPIC_OK.has(tpl.id)) bad("question has no topic", tpl.id, tpl.title);
    if (topic) {
      // its own list (QUESTION_IDEAS) wins; else the topic's
      const ideas = ideasForQuestion(tr), own = ex.QUESTION_IDEAS?.[tpl.id] ?? ex.TOPIC_IDEAS[topic] ?? [];
      for (const k of ideas) if (!own.includes(k)) bad("test idea from another topic", tpl.id, k);
    }
    for (const lng of ["en", "ru"]) {
      setLanguage(lng);
      const t = i18n.t.bind(i18n);
      const card = cardQuestion(tr), title = tl.localizeTrackerTitle(tr.title);
      const yes = answerPhrase(t, tr, true), no = answerPhrase(t, tr, false);
      const plan = tpl.adviceAboveThreshold ? testNameOf(tpl.adviceAboveThreshold) : "";
      const clauses = [answerClause(t, tr, true, "cause"), answerClause(t, tr, false, "cause"), answerClause(t, tr, true, "result", t("link.adv2")), answerClause(t, tr, false, "result", t("link.adv2"))];
      for (const [what, x] of [["card", card], ["title", title], ["yes words", yes], ["no words", no], ["plan", plan], ...clauses.map((c) => ["link clause", c])]) {
        if (!x && what !== "plan") bad(`${lng}: empty ${what}`, tpl.id, "");
        if (RAW.test(x)) bad(`${lng}: raw placeholder in ${what}`, tpl.id, x);
        if (lng === "ru" && GENDER.test(x)) bad(`ru: gender brackets in ${what}`, tpl.id, x);
        if (lng === "ru" && LATIN_IN_RU.test(x)) bad(`ru: English words in ${what}`, tpl.id, x);
        if (lng === "en" && /[А-Яа-яЁё]/.test(x)) bad(`en: Russian letters in ${what}`, tpl.id, x);
      }
      if (lng === "en" && TODAY_EN.test(card)) bad("en: card says today / last night", tpl.id, card);
      if (lng === "ru" && TODAY_RU.test(card)) bad("ru: card says сегодня", tpl.id, card);
      if (lng === "en" && NO_SPACE_TIME.test(card)) bad("en: time written as 2pm", tpl.id, card);
      if (lng === "en" && plan && FIRST_PERSON_EN.test(plan)) bad("en: plan in first person", tpl.id, plan);
      if (lng === "ru" && plan && /\b(мне|меня|мой|моя|моё|мои|себе)\b/i.test(plan) && /\bмо[йяеи]\b/i.test(plan)) bad("ru: plan in first person", tpl.id, plan);
    }
  }

  // 2. Every test idea has its name, evening question and today's line in both languages
  const ideaKeys = [...new Set([...Object.values(ex.IDEAS).flat(), ...ex.PLAN_IDEAS, ...Object.values(ex.TOPIC_IDEAS).flat(), ...Object.values(ex.QUESTION_IDEAS ?? {}).flat(), ...(ex.OLD_IDEAS ?? [])])];
  for (const k of ideaKeys) for (const lng of ["en", "ru"]) {
    setLanguage(lng);
    for (const part of ["change", "q", "today"]) {
      const key = `experiment.idea.${k}.${part}`;
      if (!i18n.exists(key)) { bad(`${lng}: idea missing ${part}`, k, key); continue; }
      const x = i18n.t(key);
      if (lng === "ru" && (GENDER.test(x) || LATIN_IN_RU.test(x))) bad(`ru: idea ${part} not clean Russian`, k, x);
    }
    const q = testQuestionOf(i18n.t(`experiment.idea.${k}.change`));
    if (!/[?？]$/.test(q)) bad(`${lng}: idea question is not a question`, k, q);
  }

  // 3. Every English key has a Russian one (a missing one shows English in RU)
  const flat = (o, p = "", m = new Map()) => { for (const [k, v] of Object.entries(o ?? {})) { const key = p ? `${p}.${k}` : k; if (v && typeof v === "object") flat(v, key, m); else m.set(key, v); } return m; };
  const E = flat(en), R = flat(ru);
  const base = (k) => k.replace(/_(one|other|few|many|zero|two)$/, "");
  const rBases = new Set([...R.keys()].map(base));
  for (const k of E.keys()) if (!rBases.has(base(k))) bad("ru: text missing (shows English)", k, String(E.get(k)).slice(0, 80));
  for (const [k, v] of R) if (typeof v === "string" && GENDER.test(v)) bad("ru: gender brackets in app text", k, v);

  setLanguage("en");
  return out;
});

writeFileSync(`${OUT}/problems.json`, JSON.stringify(problems, null, 1));
const byRule = {};
for (const p of problems) (byRule[p.rule] ??= []).push(p);
for (const [rule, list] of Object.entries(byRule)) {
  console.log(`\n${rule}: ${list.length}`);
  for (const p of list.slice(0, 12)) console.log(`  ${p.id}  ${p.text}`);
  if (list.length > 12) console.log(`  … ${list.length - 12} more in ${OUT}/problems.json`);
}
console.log(`\nTOTAL ${problems.length}`);
await browser.close();
process.exit(problems.length ? 1 : 0);
