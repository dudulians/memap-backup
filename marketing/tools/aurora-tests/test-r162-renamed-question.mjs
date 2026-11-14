// r162 (Nov 14 2026): her rule «её слова выигрывают». A library question she renamed ("Did you fight with
// Kristina?") speaks in her words in links; an untouched one keeps the library's living sentence.
// 1. Every library question as the app stores it (now and legacy wording, EN and RU, in both app languages) is
//    still read as the library's: no question loses its sentence by mistake.
// 2. A renamed one: the link says her question, never "your partner"; Why?, and what it is about, still work.
// 3. Her own question and her own short words read as before.
// Run from marketing/tools with the dev server on 8080; exit 1 when a check fails.
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const check = (name, ok, info) => { out[name] = ok ? "ok" : "FAIL " + JSON.stringify(info ?? "").slice(0, 600); if (!ok) fails.push(name); };
for (const lang of ["en", "ru"]) {
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate((lang) => { localStorage.clear(); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_ui", "new"); }, lang);
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(2000);
  const r = await p.evaluate(async (lang) => {
    const ap = await import("/src/lib/answerPhrases.ts"); const lt = await import("/src/lib/linkText.ts");
    const ls = await import("/src/lib/lifeStreams.ts"); const rs = await import("/src/lib/reasons.ts");
    const i18n = (await import("/src/lib/i18n.ts")).default; const t = i18n.t.bind(i18n);
    const ru = lang === "ru";
    const tpls = ls.LIFE_STREAMS.flatMap((s) => s.templates);
    const base = { answerType: "yesno", periodDays: 30, threshold: 5, problemWhen: "yes", category: "health" };
    // 1. every way the app has stored a library question
    const lost = [];
    for (const tpl of tpls) {
      if (!ap.phraseIds().includes(tpl.id)) continue;
      const forms = [[tpl.title, tpl.questionText], [tpl.titleRu, tpl.questionTextRu], [tpl.title, ""], [tpl.title, tpl.questionTextRu]];
      if (tpl.legacy) forms.push([tpl.legacy.title, tpl.legacy.questionText], [tpl.legacy.titleRu, tpl.legacy.questionTextRu]);
      for (const [title, questionText] of forms) {
        if (!title) continue;
        const tr = { ...base, id: "1793000000000-" + tpl.id + "-0", title, questionText: questionText ?? "" };
        if (ap.wordsIdOf(tr) !== tpl.id) lost.push(tpl.id + ": " + title + " / " + questionText);
      }
    }
    // 2-3. the link's sentence
    const drained = { ...base, id: "1793000000000-burned-out-after-work-0", title: "Burned out after work", questionText: "" };
    const lib = tpls.find((x) => x.id === "argued-with-partner");
    const say = (tr) => { const of = lt.trackerLookup([drained, tr]); const r = { first: drained.id, second: tr.id, firstYes: true, secondYes: true, nextDay: false, together: false, k: 12, n: 14, other: { k: 2, n: 45 }, mostly: "mostly", a: "work", b: "love", secondHard: true }; return lt.linkHead(t, r, of); };
    const untouched = { ...base, id: "1793000000000-argued-with-partner-0", title: lib.title, questionText: ru ? lib.questionTextRu : lib.questionText };
    const renamed = { ...untouched, questionText: ru ? "Была ссора с Кристиной?" : "Did you fight with Kristina?" };
    const named = { ...renamed, words: ru ? { yes: "Ссора с Кристиной", no: "Без ссоры с Кристиной" } : { yes: "Fight with Kristina", no: "No fight with Kristina" } };
    const own = { ...base, id: "own-1", title: ru ? "Буся сегодня опять описалась" : "Did Busya pee on the floor again", questionText: "" };
    return { lost, count: tpls.length,
      untouched: say(untouched), renamed: say(renamed), named: say(named), own: say(own),
      renamedPhrase: ap.answerPhrase(t, renamed, true), about: ap.templateIdOf(renamed), words: ap.wordsIdOf(renamed), why: !!rs.reasonTemplate(renamed), oldRu: ap.templateIdOf({ ...base, id: "c1e9e40b", title: "Ссорился(ась) с партнёром", questionText: "" }) };
  }, lang);
  out[lang + " sentences"] = { untouched: r.untouched, renamed: r.renamed, named: r.named, own: r.own, phrase: r.renamedPhrase };
  check(lang + ": no library question loses its sentence (" + r.count + " questions, every stored wording)", r.lost.length === 0, r.lost.slice(0, 8));
  check(lang + ": untouched, the library's living sentence", lang === "en" ? r.untouched.includes("argue with your partner") : r.untouched.includes("ссоритесь"), r.untouched);
  check(lang + ": renamed, the link says her question", r.renamed.includes(lang === "en" ? "Did you fight with Kristina?" : "Была ссора с Кристиной") && !r.renamed.includes(lang === "en" ? "your partner" : "партнёр"), r.renamed);
  check(lang + ": renamed, with her short words", r.named.includes(lang === "en" ? "Fight with Kristina" : "Ссора с Кристиной") && !r.named.includes(lang === "en" ? "your partner" : "партнёр"), r.named);
  check(lang + ": renamed, the app still knows it is about arguments (Why? works)", r.about === "argued-with-partner" && r.words === null && r.why, { about: r.about, words: r.words, why: r.why });
  check(lang + ": her own question reads as before", r.own.includes(lang === "en" ? "Did Busya pee on the floor again?" : "Буся сегодня опять описалась"), r.own);
  check(lang + ": a question stored under an older Russian title is still the library one", r.oldRu === "argued-with-partner", r.oldRu);
  await p.context().close();
}
await b.close();
console.log(JSON.stringify(out, null, 1));
if (errs.length) console.log("PAGE ERRORS:", errs.slice(0, 5));
process.exit(fails.length || errs.length ? 1 : 0);
