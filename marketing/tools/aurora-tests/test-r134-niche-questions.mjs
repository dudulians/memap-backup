// r134 (her notes, Nov 10 2026):
// 1. "Давай нишевые вопросы тоже убирать и заменять чем-то простым"; about "Screenshotted a chat": "я даже не понимаю
//    почему вообще это нужно отслеживать". 24 niche questions are no longer offered to new people; anyone who has one
//    keeps it (nicheArchive.ts, marketing/research/niche-questions-review-2026-11-10.md).
// 2. Simpler words, her picks: «Удалось сегодня посмеяться?» (was «смех до слёз»), «Удалось сегодня кому-то помочь или
//    кого-то порадовать?» (was a compliment to a stranger), «Сегодня был кальян?». Who tracks the old question keeps
//    its old words and meaning.
// Run from marketing/tools: node aurora-tests/test-r134-niche-questions.mjs
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const ok = (name, cond, info = "") => { out[name] = cond ? "ok" : `FAIL ${typeof info === "string" ? info : JSON.stringify(info)}`.slice(0, 700); if (!cond) fails.push(name); };

const NICHE = ["screenshotted-chat", "deleted-own-post", "rewatched-stories", "didnt-like-friend-post", "deleted-message",
  "looped-one-song", "wore-same-shirt", "ate-by-fridge", "liked-my-selfie", "talked-to-pet", "danced-or-sang-alone",
  "cried-from-something-small", "skipped-cleaning", "bought-on-sale", "paid-to-skip-effort", "less-caffeine-than-usual",
  "watched-course-lecture", "wanted-learn-new", "pill-free-day", "pelvic-floor-exercises", "thought-third-country",
  "missed-familiar-weather", "local-institution-contact", "tried-local-food"];

const ctx = await b.newContext(); const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:8080/"); await p.waitForTimeout(1200);
const r = await p.evaluate(async (NICHE) => {
  const L = await import("/src/lib/lifeStreams.ts"), sg = await import("/src/lib/starterGenerator.ts");
  const ct = await import("/src/lib/cardText.ts"), tl = await import("/src/lib/trackerLocalize.ts");
  const ap = await import("/src/lib/answerPhrases.ts"), rq = await import("/src/lib/relatedQuestions.ts");
  const ex = await import("/src/lib/experiments.ts"), i18n = (await import("/src/lib/i18n.ts")).default;
  const all = L.LIFE_STREAMS.flatMap((s) => s.templates);
  const offered = all.filter((t) => !t.sensitive && !t.askOnly && !t.quiet);
  const tr = (id, title, questionText) => ({ id: `1-${id}-1`, title, questionText, category: "Emotions", answerType: "boolean", periodDays: 30, threshold: 25, problemWhen: "no", adviceAboveThreshold: "", createdAt: "2026-10-01" });
  const laughNew = tr("laughed-uncontrollably", "Laughed today", "Did you laugh today?");
  const laughOld = tr("laughed-uncontrollably", "Couldn't stop laughing", "Did you laugh so hard you couldn't stop today?");
  const laughOldRu = tr("laughed-uncontrollably", "Смеялся(ась) до слёз", "Сегодня было «ржал(а) до слёз»?");
  const kindNew = tr("complimented-stranger", "Did something kind for someone", "Did you help someone or make someone happy today?");
  const kindOld = tr("complimented-stranger", "Complimented a stranger", "Did you say something kind to someone outside your circle?");
  const hookah = tr("smoked-hookah", "Smoked hookah", "Did you smoke hookah today?");
  const shot = tr("screenshotted-chat", "Screenshotted a chat", "Did you screenshot a conversation today?");
  const T = i18n.t.bind(i18n);
  const view = () => ({
    laughNew: ct.cardQuestion(laughNew), laughOld: ct.cardQuestion(laughOld), laughOldRu: ct.cardQuestion(laughOldRu),
    kindNew: ct.cardQuestion(kindNew), kindOld: ct.cardQuestion(kindOld), hookah: ct.cardQuestion(hookah), shot: ct.cardQuestion(shot),
    titleLaughNew: tl.localizeTrackerTitle("Смеялся(ась) сегодня"), titleLaughOld: tl.localizeTrackerTitle("Смеялся(ась) до слёз"),
    titleKindNew: tl.localizeTrackerTitle("Сделал(а) доброе дело для кого-то"), titleKindOld: tl.localizeTrackerTitle("Сделал(а) комплимент незнакомому человеку"),
    phraseLaughNew: ap.answerPhrase(T, laughNew, true), phraseLaughOld: ap.answerPhrase(T, laughOld, true),
    phraseKindNew: ap.answerPhrase(T, kindNew, false), phraseKindOld: ap.answerPhrase(T, kindOld, false),
  });
  i18n.changeLanguage("en"); const en = view();
  i18n.changeLanguage("ru"); const ru = view();
  i18n.changeLanguage("en");
  // starters for a broad set of goals never bring a niche question
  let starterIds = [];
  try {
    const FOCUS = ["stress", "sleep", "relationships", "work", "body", "mood", "energy", "money", "hobbies", "environment"];
    for (const focus of [...FOCUS.map((f) => [f]), FOCUS]) for (const extra of [{}, { hasKids: true, hasPets: true, hasPartner: true, isExpat: true, pol: "female" }])
      for (const goal of [["patterns"], ["habit"], ["understand"], ["doctor"]]) {
        const pack = sg.generateStarterPack({ focus, goal, ...extra }, 12);
        starterIds.push(...pack.map((x) => rq.matchTemplateIdByTitle(x.title) ?? x.title));
      }
    starterIds = [...new Set(starterIds)];
  } catch (e) { starterIds = ["error: " + e.message]; }
  const ideas = Array.from({ length: 40 }, () => L.getRandomIdeas(8).map((x) => x.id)).flat();
  return {
    quietMissing: NICHE.filter((id) => !all.find((t) => t.id === id)?.quiet),
    unknown: NICHE.filter((id) => !all.find((t) => t.id === id)),
    offeredCount: offered.length,
    offeredNiche: offered.filter((t) => NICHE.includes(t.id)).map((t) => t.id),
    randomIdeasNiche: [...new Set(ideas.filter((id) => NICHE.includes(id)))],
    starterNiche: starterIds.filter((id) => NICHE.includes(id)), starterIds,
    stillKnown: NICHE.filter((id) => { const t = all.find((x) => x.id === id); return t && rq.matchTemplateIdByTitle(t.title) === id; }),
    shotIdeas: ex.QUESTION_IDEAS["screenshotted-chat"],
    matchOld: [rq.matchTemplateIdByTitle("Couldn't stop laughing"), rq.matchTemplateIdByTitle("Complimented a stranger"), rq.matchTemplateIdByTitle("Смеялся(ась) до слёз")],
    libRu: Object.fromEntries(["laughed-uncontrollably", "complimented-stranger", "smoked-hookah"].map((id) => [id, all.find((t) => t.id === id).questionTextRu])),
    kindIdeas: ex.QUESTION_IDEAS["complimented-stranger"], smallHelpTime: ex.smartRemindTime("smallHelp"),
    en, ru,
  };
}, NICHE);
out.r = r;
ok("all 24 niche questions are in the library and archived (quiet)", r.unknown.length === 0 && r.quietMissing.length === 0, { unknown: r.unknown, notQuiet: r.quietMissing });
ok("none of them is offered: 225 - 25 = 200 left (Nov 11 2026: + the morning promise)", r.offeredNiche.length === 0 && r.offeredCount === 200, { count: r.offeredCount, niche: r.offeredNiche });
ok("never among the ideas of the day", r.randomIdeasNiche.length === 0, r.randomIdeasNiche);
ok("never in a starter pack (every focus, goal, kids/pets/partner/abroad)", r.starterNiche.length === 0 && r.starterIds.length > 30 && !String(r.starterIds[0] ?? "").startsWith("error"), { niche: r.starterNiche, n: r.starterIds.length, first: r.starterIds.slice(0, 3) });
ok("people who have one keep it: still recognised by its title, with its card and ideas", r.stillKnown.length === 24 && r.en.shot === "Did you screenshot a conversation?" && r.shotIdeas.length > 0, { known: r.stillKnown.length, card: r.en.shot, ideas: r.shotIdeas });
ok("library Russian: her picks", r.libRu["laughed-uncontrollably"] === "Удалось сегодня посмеяться?" && r.libRu["complimented-stranger"] === "Удалось сегодня кому-то помочь или кого-то порадовать?" && r.libRu["smoked-hookah"] === "Сегодня был кальян?", r.libRu);
ok("new laugh question on the card", r.en.laughNew === "Did you laugh?" && r.ru.laughNew === "Удалось посмеяться?", { en: r.en.laughNew, ru: r.ru.laughNew });
ok("new kind-deed question on the card", r.en.kindNew === "Did you help someone or make someone happy?" && r.ru.kindNew === "Удалось кому-то помочь или кого-то порадовать?", { en: r.en.kindNew, ru: r.ru.kindNew });
ok("old laugh question keeps its words (EN and RU)", r.en.laughOld === "Did you laugh so hard you couldn't stop?" && r.ru.laughOld === "Был смех до слёз?" && r.ru.laughOldRu === "Был смех до слёз?", { en: r.en.laughOld, ru: r.ru.laughOld, ruStored: r.ru.laughOldRu });
ok("old kind question keeps its words", r.en.kindOld === "Did you say something kind to someone outside your circle?" && r.ru.kindOld === "Было приятное слово кому-то не из своих?", { en: r.en.kindOld, ru: r.ru.kindOld });
ok("short titles: new and old", r.ru.titleLaughNew === "Смех" && r.ru.titleLaughOld === "Смех до слёз" && r.ru.titleKindNew === "Доброе дело для другого" && r.ru.titleKindOld === "Комплимент незнакомцу", { l: [r.ru.titleLaughNew, r.ru.titleLaughOld], k: [r.ru.titleKindNew, r.ru.titleKindOld] });
ok("link phrases: new and old", /^laughing$/i.test(r.en.phraseLaughNew) && /to tears/i.test(r.en.phraseLaughOld) && /kind deed/i.test(r.en.phraseKindNew) && /stranger/i.test(r.en.phraseKindOld) && /^смех$/i.test(r.ru.phraseLaughNew), { en: [r.en.phraseLaughNew, r.en.phraseLaughOld, r.en.phraseKindNew, r.en.phraseKindOld], ru: [r.ru.phraseLaughNew, r.ru.phraseKindNew] });
ok("old titles still match their question", r.matchOld.every((x) => x === "laughed-uncontrollably" || x === "complimented-stranger"), r.matchOld);
ok("kind deed ideas: a kind word and a small help, with a reminder time", r.kindIdeas.join() === "kindStranger,smallHelp" && r.smallHelpTime === "09:00", { ideas: r.kindIdeas, time: r.smallHelpTime });
await ctx.close();
console.log(JSON.stringify({ fails, out, errs }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
