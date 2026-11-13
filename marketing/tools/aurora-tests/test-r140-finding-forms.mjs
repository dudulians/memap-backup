// r140 (Nov 11 2026, her pick "Да, A и числа", then "Делай" and "words first, numbers on tap"): the new findings.
// 1. "Mostly on such days" on the store's pair: 12 of her 14 arguments on drained-after-work days, 2 on the other 45:
//    "You mostly argue with your partner on days you feel drained after work"; RU «Вы с партнёром в основном
//    ссоритесь в дни, когда после работы не остаётся сил».
// 2. Words first: the count opens on tap ("12 of 14 times · on other days almost never: 2 of 45").
// 3. A chain on top (short night → drained → arguments), "two things next to it" (arguments: drained or short night),
//    "looks like it's something else" at the end (headache as often with alcohol as without), with what to watch.
// 4. The rules: a thing that comes almost every day never gets "mostly"; anything with the cycle needs 8 weeks.
// Run from marketing/tools: node aurora-tests/test-r140-finding-forms.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r140`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const ok = (name, cond, info = "") => { out[name] = cond ? "ok" : `FAIL ${typeof info === "string" ? info : JSON.stringify(info)}`.slice(0, 600); if (!cond) fails.push(name); console.log(name, "→", out[name]); };

const seed = (p, lang) => p.evaluate(async (lang) => {
  localStorage.clear(); localStorage.setItem("memap_ab_onb", "A"); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_theme", "aurora-light");
  localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1");
  localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1"); localStorage.setItem("memap_first_link_seen", "before");
  localStorage.setItem("memap_examples_seen", JSON.stringify(["link", "month", "rule", "test", "chart", "chart-one"]));
  const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
  localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: dz.daysAgoIso(1) }));
  const [drained, argued, slept, head, alcohol] = await dz.ensureTemplates(["burned-out-after-work", "argued-with-partner", "slept-enough", "headache", "drank-alcohol"]);
  const E = [], add = (id, d, v) => E.push({ id: `${id}-${d}`, trackerId: id, date: dz.daysAgoIso(d), value: v });
  for (let d = 1; d <= 59; d++) {
    const dr = d % 4 === 0;                                  // 14 drained days
    const arg = (dr && d !== 52 && d !== 56) || d === 3 || d === 21; // 12 on drained days, 2 on the other 45
    const shortNight = dr || d === 5 || d === 10;            // short nights mostly on drained days
    const alc = d % 3 === 0;                                 // 19 alcohol days
    const hd = (alc && d % 9 === 0) || (!alc && d % 3 === 1 && d % 2 === 1); // about the same share with and without
    add(drained, d, dr); add(argued, d, arg); add(slept, d, !shortNight); add(alcohol, d, alc); add(head, d, hd);
  }
  await st.saveEntries(E);
  localStorage.setItem("memap_path_start", dz.daysAgoIso(59));
}, lang);
const toLinks = async (p) => {
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "findings", back: true } })));
  await p.waitForTimeout(2200);
};

for (const lang of ["en", "ru"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, locale: lang === "ru" ? "ru-RU" : "en-US" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await seed(p, lang); await p.reload(); await p.waitForTimeout(2500);
  await toLinks(p);
  const dlg = p.locator("[role=dialog]").last();
  const text = (await dlg.innerText()).replace(/\s+/g, " ");
  out[`${lang} links`] = text.slice(0, 900);
  await p.screenshot({ path: `${D}/${lang}-1-links.png` });
  // same day: two tags and when, no order claimed (her pick, Nov 12 2026); the sentence opens on tap
  // v151: one sentence per link (her pick): the card is found by its words
  const PAIR = lang === "en" ? ["argue with your partner", "drained after work"] : ["ссоритесь", "после работы не остаётся сил"];
  const BTN = lang === "en" ? "drained after work" : "без сил после работы";
  const FALL = lang === "en" ? "The days you argue with your partner mostly fall on days you feel drained after work" : "Дни, когда вы с партнёром ссоритесь, в основном приходятся на дни, когда после работы не остаётся сил";
  const MOSTLY = lang === "en" ? "You mostly argue with your partner on days you feel drained after work" : "Вы с партнёром в основном ссоритесь в дни, когда после работы не остаётся сил";
  const cardOf = (pair) => p.evaluate((pair) => { const c = [...document.querySelectorAll("[data-link-card]")].find((x) => pair.every((w) => x.textContent.includes(w))); return !!c; }, pair);
  ok(`${lang}: the store's pair in one sentence, its answers lit`, await cardOf(PAIR) && (await p.locator("[data-link-card] .hl-a").count()) > 0 && (await p.locator("[data-tag]").count()) === 0, text.slice(0, 500));
  ok(`${lang}: no order claimed on a closed card`, !text.includes(MOSTLY) && text.includes(FALL), text.slice(0, 300));
  // words first: no numbers on the closed cards (since v148 a typed question without short words is a sentence there)
  const shownCounts = await p.evaluate(() => document.querySelectorAll("[role=dialog] [data-link-numbers], [role=dialog] [data-story-numbers]").length);
  ok(`${lang}: words first, no numbers until a tap`, shownCounts === 0, shownCounts);
  // tap the card: the sentence, its count, the question
  const open = (pair) => p.evaluate((pair) => { const c = [...document.querySelectorAll("[data-link-card]")].find((x) => pair.every((w) => x.textContent.includes(w))); const b = c?.querySelector("button[aria-expanded]"); if (b?.getAttribute("aria-expanded") === "false") b.click(); }, pair);
  const read = (pair) => p.evaluate((pair) => { const c = [...document.querySelectorAll("[data-link-card]")].find((x) => pair.every((w) => x.textContent.includes(w))); return { s: c?.querySelector("[data-link-sentence]")?.textContent ?? "", count: [c?.querySelector("[data-link-times]")?.textContent ?? "", (c?.querySelector("[data-link-other]")?.textContent ?? "").replace(/^./, (x) => x.toLocaleLowerCase())].join(" · ").replace(/\s+/g, " "), ask: !!c?.querySelector("[data-order-ask]") }; }, pair);
  await open(PAIR); await p.waitForTimeout(500);
  const o1 = await read(PAIR);
  ok(`${lang}: on tap, when the days fall, no order`, o1.s === FALL, o1);
  ok(`${lang}: its count from the arguments, the other days in words`, lang === "en" ? o1.count === "12 of 14 times · on other days almost never: 2 of 45" : o1.count === "12 из 14 раз · в другие дни почти никогда: 2 из 45", o1.count);
  ok(`${lang}: "What comes first?" under the sentence`, o1.ask, o1);
  await p.screenshot({ path: `${D}/${lang}-2-open.png` });
  // the person's answer orders it: drained first = the store's sentence
  const pick = (pair, which) => p.evaluate(({ pair, which }) => { const c = [...document.querySelectorAll("[data-link-card]")].find((x) => pair.slice(0, 2).every((w) => x.textContent.includes(w))); const b = [...(c?.querySelectorAll("[data-order]") ?? [])].find((x) => x.textContent.toLowerCase().includes(which.toLowerCase())); b?.click(); return !!b; }, { pair, which });
  await pick(PAIR, BTN); await p.waitForTimeout(700);
  const o2 = await p.evaluate((pair) => { const c = [...document.querySelectorAll("[data-link-card]")].find((x) => pair.every((w) => x.textContent.includes(w))); return c?.querySelector("[data-link-sentence]")?.textContent ?? ""; }, PAIR.slice(0, 2));
  ok(`${lang}: "drained first" gives the store's sentence`, o2 === MOSTLY, o2);
  // a chain needs an order: short night first, then drained first (already) → short night → drained → arguments
  const SHORT = lang === "en" ? "under 7 hours" : "меньше 7 часов", SHORT_BTN = lang === "en" ? "short night" : "короткая ночь";
  await open([SHORT, PAIR[1]]); await p.waitForTimeout(400); await pick([SHORT, PAIR[1]], SHORT_BTN); await p.waitForTimeout(800);
  const stories = await p.evaluate(() => [...document.querySelectorAll("[data-story]")].map((x) => ({ kind: x.getAttribute("data-story"), text: x.textContent.replace(/\s+/g, " ").trim() })));
  out[`${lang} stories`] = stories;
  const chain = stories.find((x) => x.kind === "chain"), two = stories.find((x) => x.kind === "two"), notits = stories.filter((x) => x.kind === "notit");
  ok(`${lang}: a chain once the person set the order (short night → drained → arguments)`, !!chain && (lang === "en" ? /under 7 hours.*drained after work\. On those days .*argue/.test(chain.text) : /меньше 7 часов.*не остаётся сил\. В такие дни .*ссоритесь/.test(chain.text)), stories);
  // r153 (Nov 13 2026): the long "two things" sentence is gone; links about one thing are rows on its card (test-r153)
  ok(`${lang}: no long "two things" card (its links are rows on the card of their thing)`, !two, stories);
  ok(`${lang}: "something else" for headache and alcohol`, notits.some((n) => (lang === "en" ? /Looks like it.s something else\. .*headache on days you don.t drink too/i : /Похоже, дело в другом\. .*голова и в дни, когда ты не пьёшь алкоголь/i).test(n.text)), stories);
  ok(`${lang}: at most 3 "something else" cards, one per question`, notits.length > 0 && notits.length <= 3, notits.length);
  // its numbers and what to watch open on tap
  await p.evaluate(() => document.querySelector("[data-story=notit] button[aria-expanded]")?.click()); await p.waitForTimeout(400);
  const notitOpen = await p.evaluate(() => ({ body: document.querySelector("[data-story=notit] [data-story-numbers]")?.textContent.replace(/\s+/g, " ") ?? "", watch: [...document.querySelectorAll("[data-story=notit] [data-watch]")].map((x) => x.getAttribute("data-watch")) }));
  ok(`${lang}: "something else" numbers on tap, with what to watch`, /\(\d+ (of|из) \d+\)/.test(notitOpen.body) && notitOpen.watch.length > 0, notitOpen);
  await p.screenshot({ path: `${D}/${lang}-3-notit.png` });
  if (lang === "en") {
    const before = await p.evaluate(async () => (await (await import("/src/lib/storage.ts")).getTrackers()).length);
    await p.locator("[data-story=notit] [data-watch]").first().click(); await p.waitForTimeout(1200);
    const after = await p.evaluate(async () => (await (await import("/src/lib/storage.ts")).getTrackers()).length);
    ok("a tap on what to watch adds that question", after === before + 1, { before, after });
  }
  await ctx.close();
}

// 4. the rules on their own
{
  const ctx = await b.newContext(); const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  const r = await p.evaluate(async () => {
    const ff = await import("/src/lib/findingForms.ts");
    const tr = (id, problemWhen = "yes") => ({ id: `1700000000000-${id}-0`, title: id, problemWhen });
    const drained = tr("burned-out-after-work"), argued = tr("argued-with-partner"), period = tr("period-day"), head = tr("headache");
    const base = { first: drained.id, second: argued.id, firstYes: true, secondYes: true, nextDay: false, secondHard: true };
    return {
      store: ff.mostlyOf({ ...base, k: 12, n: 14, other: { k: 2, n: 45 } }, drained, argued),
      almostOnly: ff.mostlyOf({ ...base, k: 13, n: 14, other: { k: 1, n: 45 } }, drained, argued),
      // drained almost every day: 50 of 59 days, 13 of 14 arguments on them, 9 other days
      everyday: ff.mostlyOf({ ...base, k: 13, n: 50, other: { k: 1, n: 9 } }, drained, argued),
      // arguments common on the other days too
      busyOther: ff.mostlyOf({ ...base, k: 12, n: 14, other: { k: 14, n: 45 } }, drained, argued),
      // the cycle: 40 days is one month, 60 days two
      cycle40: ff.mostlyOf({ first: period.id, second: head.id, firstYes: true, secondYes: true, nextDay: false, secondHard: true, k: 6, n: 7, other: { k: 1, n: 33 } }, period, head),
      cycle60: ff.mostlyOf({ first: period.id, second: head.id, firstYes: true, secondYes: true, nextDay: false, secondHard: true, k: 8, n: 10, other: { k: 1, n: 50 } }, period, head),
      neutral: ff.mostlyOf({ ...base, secondHard: null, k: 12, n: 14, other: { k: 2, n: 45 } }, drained, argued),
      good: ff.mostlyOf({ ...base, secondHard: false, k: 12, n: 14, other: { k: 2, n: 45 } }, drained, argued),
      calm: [ff.calmOf(0, 20), ff.calmOf(2, 45), ff.calmOf(5, 30), ff.calmOf(12, 39)],
    };
  });
  ok("rules: the store's pair is 'mostly'", r.store === "mostly", r);
  ok("rules: 13 of 14 is 'almost only'", r.almostOnly === "almostOnly", r);
  ok("rules: a thing that comes almost every day never gets 'mostly'", r.everyday === null, r);
  ok("rules: not when it's common on the other days too", r.busyOther === null, r);
  ok("rules: the cycle needs two cycles (8 weeks)", r.cycle40 === null && r.cycle60 === "mostly", r);
  ok("rules: good things too, never a neutral one", r.good === "mostly" && r.neutral === null, r);
  ok("rules: calm words", JSON.stringify(r.calm) === JSON.stringify(["never", "almostNever", "rarely", null]), r.calm);
  await ctx.close();
}
console.log(JSON.stringify({ fails, errs: errs.slice(0, 5) }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
