// QA words (Nov 8 2026): every library question's card and title, EN and RU — no gender brackets in
// Russian, no "today" on a card; the first hunch is about her own topic; a link brings no treasure line.
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await b.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:8080/"); await p.waitForTimeout(1500);
const out = await p.evaluate(async () => {
  const i18n = (await import("/src/lib/i18n.ts")).default, L = await import("/src/lib/lifeStreams.ts"), C = await import("/src/lib/cardText.ts"), T = await import("/src/lib/trackerLocalize.ts");
  const res = {};
  for (const lng of ["en", "ru"]) {
    await i18n.changeLanguage(lng); localStorage.setItem("memap_language", lng);
    const bad = [];
    for (const s of L.LIFE_STREAMS) for (const t of s.templates) {
      if (t.sensitive) continue;
      // as stored by an English user and by a Russian user
      for (const stored of [{ title: t.title, q: t.questionText }, { title: t.titleRu, q: t.questionTextRu }]) {
        if (!stored.title) continue;
        const tr = { id: "x", title: stored.title, questionText: stored.q, category: t.category, answerType: "boolean", problemWhen: t.problemWhen, threshold: 0, periodDays: 30, adviceAboveThreshold: "", createdAt: "" };
        const card = C.cardQuestion(tr), title = T.localizeTrackerTitle(tr.title);
        if (lng === "ru" && /[а-яё]\((а|ась|ла|ой|на|ы|ая|ёл|ла)\)/i.test(card + " " + title)) bad.push(`${t.id}: ${card} | ${title}`);
        if (lng === "en" && /\btoday\b/i.test(card)) bad.push(`${t.id}: ${card}`);
        if (lng === "ru" && /(^|\s)[Сс]егодня[\s?]/.test(card) && !/сегодня [а-я]/.test(card)) bad.push(`${t.id}: ${card}`);
      }
    }
    res[lng] = { bad: [...new Set(bad)].slice(0, 30), count: new Set(bad).size };
  }
  return res;
});
console.log(JSON.stringify({ out, errs }, null, 1));
await b.close();
