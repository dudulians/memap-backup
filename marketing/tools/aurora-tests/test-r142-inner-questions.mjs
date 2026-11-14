// r142 (Nov 12 2026): the five "inner" questions from the research (marketing/research/inner-questions-brief.md),
// added after her «если он согласится их добавить, то пусть добавляет и проверяет». Checks the brief's list:
// words in EN and RU (no "today" on cards, no "(а)", no raw {{…}}), islands, question 5 neutral, the natural pairs
// suppressed, 1 and 2 never switched on for everyone (starter packs, ideas of the day, hunches), and the Links list
// with an inner question in a "mostly" sentence, a chain with an inner middle link, a link with question 5 that
// reads neutral, a link with question 4, in EN and RU.
// Run from marketing/tools:  node aurora-tests/test-r142-inner-questions.mjs
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "fs";
const D = `./aurora-tests/work/r142`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], fails = [];
const ok = (name, cond, info = "") => { const s = cond ? "ok" : `FAIL ${typeof info === "string" ? info : JSON.stringify(info)}`.slice(0, 900); if (!cond) fails.push(name); console.log(name, "→", s); };
const IDS = ["kept-going-over-it", "scolded-myself", "switched-off-from-work", "felt-understood", "let-it-pass"];
const CARDS = {
  en: ["Did you keep going over something in your head?", "Did you scold yourself for something?", "Did you manage to switch off from work in the evening?", "Did you feel understood by someone?", "Did you let something pass to avoid an argument?"],
  ru: ["Крутилась в голове одна и та же ситуация?", "Приходилось себя ругать?", "Удалось вечером отключиться от работы?", "Было чувство, что тебя понимают?", "Пришлось промолчать, чтобы не было ссоры?"],
};

// 1. the library: words, islands, polarity, pairs, never switched on for everyone
{
  const ctx = await b.newContext(); const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  for (const lang of ["en", "ru"]) {
    const got = await p.evaluate(async ({ lang, IDS }) => {
      const i18nMod = await import("/src/lib/i18n.ts"); i18nMod.setLanguage(lang); await i18nMod.default.changeLanguage(lang);
      const t = i18nMod.default.t.bind(i18nMod.default);
      const ls = await import("/src/lib/lifeStreams.ts"), ct = await import("/src/lib/cardText.ts"), ap = await import("/src/lib/answerPhrases.ts");
      const isl = await import("/src/lib/islands.ts"), co = await import("/src/lib/correlations.ts"), tl = await import("/src/lib/trackerLocalize.ts");
      const all = ls.LIFE_STREAMS.flatMap((s) => s.templates);
      return IDS.map((id) => {
        const tpl = all.find((x) => x.id === id);
        if (!tpl) return { id, missing: true };
        const tr = { id: `1-${id}-1`, title: tpl.title, questionText: tpl.questionText, category: tpl.category, problemWhen: tpl.problemWhen, answerType: "boolean" };
        return {
          id, card: ct.cardQuestion(tr), title: tl.localizeTrackerTitle(tpl.title), question: tl.localizeTrackerQuestion(tpl.questionText, tpl.title),
          chips: [ap.answerPhrase(t, tr, true), ap.answerPhrase(t, tr, false)],
          clauses: [true, false].flatMap((y) => [ap.answerClause(t, tr, y, "cause"), ap.answerClause(t, tr, y, "result", t("link.adv1")), ap.answerClause(t, tr, y, "result", t("link.advAll"))]),
          island: isl.islandOf(tr), polarity: co.trackerPolarity(tr), threshold: tpl.threshold,
        };
      });
    }, { lang, IDS });
    writeFileSync(`${D}/${lang}-words.json`, JSON.stringify(got, null, 1));
    ok(`${lang}: all five in the library`, got.every((x) => !x.missing), got.filter((x) => x.missing));
    ok(`${lang}: cards, option A`, got.every((x, i) => x.card === CARDS[lang][i]), got.map((x) => x.card));
    const words = JSON.stringify(got);
    ok(`${lang}: no "today" on cards`, got.every((x) => !/today|сегодня/i.test(x.card)));
    ok(`${lang}: no "(а)", no raw {{…}}, no "always don't"`, !/\(а\)|\{\{|always don.t|always doesn.t|всегда не /.test(words), words.slice(0, 300));
    ok(`${lang}: every clause and chip filled`, got.every((x) => x.chips.every(Boolean) && x.clauses.every((c) => c && c.length > 6)), got.map((x) => [x.chips, x.clauses]));
    ok(`${lang}: islands (3 on Work, the rest on Me)`, got.map((x) => x.island).join() === "me,me,work,me,me", got.map((x) => x.island));
    ok(`${lang}: 5 neutral, 1–2 hard on yes, 3–4 hard on no`, got.map((x) => x.polarity).join() === "bad,bad,good,good,neutral", got.map((x) => x.polarity));
    ok(`${lang}: no "When to act" until she OKs numbers (threshold 0)`, got.every((x) => x.threshold === 0));
  }
  const rest = await p.evaluate(async (IDS) => {
    const bt = await import("/src/lib/bodyTemplates.ts"), ls = await import("/src/lib/lifeStreams.ts"), sg = await import("/src/lib/starterGenerator.ts");
    const rq = await import("/src/lib/relatedQuestions.ts");
    const pairs = [["kept-going-over-it", "felt-anxious"], ["scolded-myself", "felt-bad-parent"], ["scolded-myself", "felt-useless"], ["scolded-myself", "felt-not-like-others"], ["felt-understood", "deep-conversation"], ["felt-understood", "felt-lonely"], ["let-it-pass", "said-yes-when-meant-no"]];
    const natural = pairs.map(([a, c]) => bt.isNaturalPair(a, c) && bt.isNaturalPair(c, a));
    // ideas of the day: many draws
    const ideaIds = new Set(); for (let i = 0; i < 400; i++) for (const x of ls.getRandomIdeas(6)) ideaIds.add(x.title);
    // starter packs: every card the generator would ever show for these answers (regenerating until it runs dry)
    const starterTitles = new Set();
    for (const answers of [{ focus: ["mood", "stress"], goal: ["understand"] }, { focus: ["work"], hasKids: true, goal: ["patterns"] }, { focus: ["relationships", "mood"], hasPartner: true }, {}]) {
      const seen = [];
      for (let k = 0; k < 60; k++) { const pack = sg.generateStarterPack(answers, 5, seen); if (!pack.length) break; for (const s of pack) { starterTitles.add(s.title); seen.push(s.title.toLowerCase()); } }
    }
    const tpl = (id) => ls.LIFE_STREAMS.flatMap((s) => s.templates).find((x) => x.id === id);
    const chosenTitles = ["kept-going-over-it", "scolded-myself"].flatMap((id) => [tpl(id).title, tpl(id).titleRu]);
    // typed words find them
    const typed = ["I keep going over it in my head", "ругаю себя за всё", "не могу отключиться от работы", "меня поняли", "пришлось промолчать"].map((w) => rq.matchTemplateIdByTitle ? (rq.suggestTemplatesForText?.(w) ?? null) : null);
    return { natural, inIdeas: chosenTitles.filter((x) => [...ideaIds].includes(x)), inStarters: chosenTitles.filter((x) => starterTitles.has(x)), starters: starterTitles.size, ideas: ideaIds.size };
  }, IDS);
  ok("natural pairs suppressed (both ways)", rest.natural.every(Boolean), rest.natural);
  ok("1 and 2 never in ideas of the day", rest.inIdeas.length === 0 && rest.ideas > 30, rest);
  ok("1 and 2 never in starter packs", rest.inStarters.length === 0 && rest.starters > 10, rest);
  // hunches: "Ate sweets" lists "Scolded myself" as a possible cause; it is offered only once she tracks it
  const hunch = await p.evaluate(async () => {
    const h = await import("/src/lib/hunches.ts"), dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    localStorage.clear();
    const [sweets] = await dz.ensureTemplates(["ate-sweets"]);
    const T = await st.getTrackers();
    const before = h.suspectsFor(T.find((x) => x.id === sweets), T).map((s) => s.kind === "template" ? s.template.id : s.tracker.title);
    const [scold] = await dz.ensureTemplates(["scolded-myself"]);
    const T2 = await st.getTrackers();
    const after = h.suspectsFor(T2.find((x) => x.id === sweets), T2).map((s) => s.kind === "template" ? s.template.id : s.tracker.title);
    return { before, after };
  });
  ok("hunches: 'scolded myself' not offered as a new suspect", !hunch.before.includes("scolded-myself"), hunch);
  ok("hunches: once she tracks it, it is a suspect", hunch.after.some((x) => /Scolded myself|Ругаю себя/.test(x)), hunch);
  await ctx.close();
}

// 2. the Links list with inner questions, EN and RU
for (const lang of ["en", "ru"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async (lang) => {
    localStorage.clear(); localStorage.setItem("memap_ab_onb", "A"); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1");
    localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1"); localStorage.setItem("memap_first_link_seen", "before");
    localStorage.setItem("memap_examples_seen", JSON.stringify(["link", "month", "rule", "test", "chart", "chart-one"]));
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: dz.daysAgoIso(1) }));
    const ids = ["criticized-by-close", "kept-going-over-it", "racing-thoughts-in-bed", "partner-irritated-me", "let-it-pass", "saw-friends", "felt-understood", "scolded-myself", "felt-useless"];
    const tr = await dz.ensureTemplates(ids);
    // a fixed scatter of days (index 0 = 59 days ago)
    let seed = 7; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const pick = (from, k) => { const a = [...from]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return new Set(a.slice(0, k)); };
    const N = 60, all = [...Array(N).keys()], not = (s) => all.filter((i) => !s.has(i));
    const crit = pick(all, 13);
    const over = new Set([...pick([...crit], 11), ...pick(not(crit), 3)]);                 // mostly on criticised days
    const nightAfter = new Set([...over].filter((i) => i + 1 < N).map((i) => i + 1));
    const racing = new Set([...pick([...nightAfter], 10), ...pick(not(nightAfter), 3)]);   // the night after going over it
    const irritated = pick(all, 16);
    const letPass = new Set([...pick([...irritated], 12), ...pick(not(irritated), 3)]);
    const friends = pick(all, 18);
    const understood = new Set([...pick([...friends], 14), ...pick(not(friends), 4)]);
    const scold = pick(all, 14), useless = new Set([...scold]);                           // two sides of one thing
    const S = [crit, over, racing, irritated, letPass, friends, understood, scold, useless];
    const E = [];
    for (let i = 0; i < N; i++) tr.forEach((id, k) => E.push({ id: `${id}-${i}`, trackerId: id, date: dz.daysAgoIso(N - 1 - i), value: S[k].has(i) }));
    await st.saveEntries(E);
    localStorage.setItem("memap_path_start", dz.daysAgoIso(N - 1));
  }, lang);
  await p.reload(); await p.waitForTimeout(2500);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "findings", back: true } })));
  await p.waitForTimeout(2200);
  await p.evaluate(() => document.querySelector("[data-more-links]")?.click()); await p.waitForTimeout(400);
  // the sentences open on tap (Nov 12 2026): open every link; then say what came first on "criticized ↔ going over it"
  // (a chain needs an order: the person's, or the next day's)
  await p.evaluate(() => document.querySelectorAll("[data-link-card] button[aria-expanded=false]").forEach((x) => x.click())); await p.waitForTimeout(500);
  const text = (await p.locator("[role=dialog]").last().innerText()).replace(/\s+/g, " ");
  // r161: the card goes in steps; the question is behind Next
  await p.evaluate(() => document.querySelectorAll("[data-link-card]").forEach((c) => { if (!c.querySelector("[data-order]")) c.querySelector("[data-link-next]")?.click(); })); await p.waitForTimeout(600);
  await p.evaluate(() => { const b = [...document.querySelectorAll("[data-order]")].find((x) => /critic|критик/i.test(x.textContent)); b?.click(); }); await p.waitForTimeout(900);
  await p.evaluate(() => document.querySelectorAll("[data-link-card] button[aria-expanded=false], [data-story] button[aria-expanded=false]").forEach((x) => x.click())); await p.waitForTimeout(500);
  const text2 = (await p.locator("[role=dialog]").last().innerText()).replace(/\s+/g, " ");
  writeFileSync(`${D}/${lang}-links.txt`, text.replace(/(Looks like|Похоже|On days|В дни|The day after|На следующий день|You |Ты |Если )/g, "\n$1"));
  await p.screenshot({ path: `${D}/${lang}-links.png` });
  const W = lang === "en"
    ? { mostly: /The days you keep going over something in your head (mostly|almost only) fall on days someone close criticizes or hurts you/, chain: /someone close criticizes or hurts you, you (usually|often|almost always|mostly)[^.]*keep going over something in your head. The day after,? [^.]*thoughts/i, pass: /(your partner irritates you[^.]*let something pass to avoid an argument|let something pass to avoid an argument[^.]*your partner irritates you)/, understood: /(see friends in person[^.]*feel understood|feel understood[^.]*see friends in person)/, pair: /scold yourself[^.]*did nothing useful|did nothing useful[^.]*scold yourself/ }
    : { mostly: /Дни, когда в голове крутится одна и та же ситуация, (в основном приходятся|приходятся почти только) на дни, когда кто-то близкий критикует или задевает тебя/, chain: /критикует или задевает тебя[^.]*крутится одна и та же ситуация. На следующий день[^.]*мысли/i, pass: /партн[её]р раздражает[^.]*молчишь, чтобы не было ссоры|молчишь, чтобы не было ссоры[^.]*партн[её]р раздражает/, understood: /видишься с друзьями вживую[^.]*чувство, что тебя понимают|чувство, что тебя понимают[^.]*видишься с друзьями вживую/, pair: /ругаешь себя[^.]*зря|зря[^.]*ругаешь себя/ };
  ok(`${lang} links: an inner question in a "mostly" sentence`, W.mostly.test(text), text.slice(0, 700));
  ok(`${lang} links: a chain with an inner middle link, once the person set the order`, W.chain.test(text2), text2.slice(0, 900));
  ok(`${lang} links: question 5 next to a partner's irritation, neutral words`, W.pass.test(text) && !/should|speak up|wrong|скажи|неправильно/.test(text), text.slice(0, 700));
  ok(`${lang} links: question 4 with friends`, W.understood.test(text), text.slice(0, 700));
  ok(`${lang} links: scolding yourself and "did nothing useful" are one thing, never a link`, !W.pair.test(text));
  ok(`${lang} links: no "(а)", no raw {{…}}`, !/\(а\)|\{\{/.test(text));
  await ctx.close();
}
console.log(JSON.stringify({ fails, errs: errs.slice(0, 5) }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
