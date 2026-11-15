// Her note (Nov 16 2026): «в русском всё равно попадается английское: «Сделано: look back at what came before the headache
// days»… проверять все подобные ситуации». Every library plan (a rule's advice) and every ready try, stored in English,
// reads in Russian on a Russian phone (and the other way round). Run from marketing/tools.
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await (await b.newContext()).newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
const r = await p.evaluate(async () => {
  localStorage.setItem("memap_language", "ru");
  const i18n = (await import("/src/lib/i18n.ts")).default, tw = await import("/src/lib/testWords.ts"), ls = await import("/src/lib/lifeStreams.ts");
  const cyr = (s) => /[а-яё]/i.test(s) && !/[a-z]{4,}/i.test(s.replace(/MeMap|SMS|TV|PDF|GP|Wi-?Fi/gi, ""));
  await i18n.changeLanguage("ru");
  const tpls = ls.LIFE_STREAMS.flatMap((s) => s.templates).filter((t) => t.adviceAboveThreshold && t.adviceAboveThresholdRu);
  const badAdvice = tpls.filter((t) => !cyr(tw.testNameOf(t.adviceAboveThreshold))).map((t) => `${t.id}: ${t.adviceAboveThreshold} → ${tw.testNameOf(t.adviceAboveThreshold)}`);
  await i18n.changeLanguage("en");
  const ideas = Object.keys(i18n.getResourceBundle("en", "translation").experiment.idea);
  const enChanges = ideas.map((k) => [k, i18n.t(`experiment.idea.${k}.change`)]);
  await i18n.changeLanguage("ru");
  const badIdeas = enChanges.filter(([, c]) => !cyr(tw.testNameOf(c))).map(([k, c]) => `${k}: ${c} → ${tw.testNameOf(c)}`);
  return { advice: tpls.length, badAdvice, ideas: ideas.length, badIdeas };
});
console.log(JSON.stringify({ errs, ...r, badAdvice: r.badAdvice.slice(0, 30), badIdeas: r.badIdeas.slice(0, 30), badAdviceN: r.badAdvice.length, badIdeasN: r.badIdeas.length }, null, 1));
if (r.badAdvice.length || r.badIdeas.length || errs.length) process.exitCode = 1;
await b.close();
