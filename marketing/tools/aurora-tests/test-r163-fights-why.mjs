// r163 (Nov 14 2026, branch design/one-system): the fights' task goes to "Why?" (agreed Nov 13).
// On the work-home demo the fights' rule is lit in When to act.
// 1. Its task reads "After each fight, answer “Why?”" (not "Write down what the fights usually start from").
// 2. With fights in the last days and no reasons, the button "Answer “Why?”" opens the same Why? sheet as the path.
// 3. Saved reasons stay with their days; from three answers the card says "Fights — most often: … (k of n)" and
//    offers "I did it"; with no fight waiting and fewer than three answers it says Why? comes after the next one.
// 4. The page of one thing never names "Other" as the most common reason.
// Run from marketing/tools with the dev server on 8080; exit 1 when a check fails.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r163`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const check = (name, ok, info) => { out[name] = ok ? "ok" : `FAIL ${info !== undefined ? JSON.stringify(info).slice(0, 500) : ""}`; if (!ok) fails.push(name); };
const W = { en: { world: /^World$/, act: /When to act/, plan: "After each fight, answer “Why?”", btn: "Answer “Why?”", told: /^Fights\s*\S\s*most often:\s*[a-z].*\(\d+\s+of\s+\d+\)$/, next: "After the next fight, “Why?” comes on your path", did: "I did it" },
  ru: { world: /^Мир$/, act: /Когда действовать/, plan: "После каждой ссоры отвечать на «Почему?»", btn: "Ответить на «Почему?»", told: /^Ссоры\s*\S\s*чаще всего:\s*[а-яё].*\(\d+\s+из\s+\d+\)$/, next: "После следующей ссоры «Почему?» появится на пути", did: "Сделано" } };
const seed = async (p, lang, reasons, quiet = false) => p.evaluate(async ({ lang, reasons, quiet }) => {
  const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const g = await import("/src/lib/demoDataGenerator.ts"); const r = g.generateDemoData("work-home");
  const ap = await import("/src/lib/answerPhrases.ts");
  const fights = r.newTrackers.find((t) => ap.templateIdOf(t) === "argued-with-partner");
  let entries = r.newEntries;
  // reasons on the fights before the last 3 days ("reasons" of them), none on the latest ones
  if (fights) {
    let left = reasons;
    entries = entries.map((e) => { delete e.tags; return e; })
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((e) => (e.trackerId === fights.id && e.value === true && e.date < iso(3) && left > 0 ? (left--, { ...e, tags: [left % 3 === 2 ? "money" : "tiredness"] }) : e));
    // one fight yesterday, so "Why?" has something to ask about
    const y = iso(1), has = entries.find((e) => e.trackerId === fights.id && e.date === y);
    if (has) has.value = true; else entries.push({ id: "r163-y", trackerId: fights.id, date: y, value: true });
  }
  localStorage.clear();
  // quiet: the last days' fights were already asked about (skipped once each, not on the path, so not resting)
  if (quiet && fights) localStorage.setItem("memap_reasons_asked", JSON.stringify(Object.fromEntries(entries
    .filter((e) => e.trackerId === fights.id && e.value === true && e.date >= iso(4)).map((e) => [`${fights.id}|${e.date}`, { at: iso(0), how: "skipped" }]))));
  localStorage.setItem("memap_trackers", JSON.stringify(r.newTrackers)); localStorage.setItem("memap_entries", JSON.stringify(entries));
  localStorage.setItem("memap_path_start", [...entries.map((e) => e.date)].sort()[0]);
  localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1");
  localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order", "report", "block:world"]));
  localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
  localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(9) })); localStorage.setItem("memap_playful_asked", "seed");
  localStorage.setItem("memap_links_view", "list");
  localStorage.setItem("memap_week_chests", JSON.stringify(Object.fromEntries(Array.from({ length: 9 }, (_, w) => [w, { openedAt: iso(1), lines: [], reward: "balloon" }]))));
  return fights ? fights.id : null;
}, { lang, reasons, quiet });
const openAct = async (p, w) => {
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(1800);
  await p.locator("button").filter({ hasText: w.world }).last().click(); await p.waitForTimeout(2600);
  await p.locator("button").filter({ hasText: w.act }).first().click(); await p.waitForTimeout(1500);
};
for (const lang of ["en", "ru"]) {
  const w = W[lang];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  // A: two earlier reasons, a fight yesterday with none
  const fid = await seed(p, lang, 2);
  check(`${lang}: the demo has the fights question`, !!fid);
  await openAct(p, w);
  const task = p.locator("[data-why-task]");
  check(`${lang}: the fights' task asks in Why?`, (await task.count()) === 1 && (await task.innerText()).trim() === w.plan, (await task.count()) ? await task.innerText() : "none");
  const btn = p.locator("[data-why-answer]");
  check(`${lang}: a fight waits, so the button opens Why?`, (await btn.count()) === 1 && (await btn.innerText()).trim() === w.btn);
  await btn.scrollIntoViewIfNeeded(); await p.screenshot({ path: `${D}/${lang}-1-card.png` });
  await btn.click(); await p.waitForTimeout(1200);
  const sheet = p.locator("[data-reason-sheet]");
  check(`${lang}: the Why? sheet opens with yesterday's fight`, (await sheet.count()) === 1 && (await sheet.locator("[data-reason-item]").count()) >= 1);
  await p.screenshot({ path: `${D}/${lang}-2-why.png` });
  // tick "Tiredness" and save
  await sheet.locator("[data-reason-item]").first().locator("button[aria-pressed]").nth(6).click(); await p.waitForTimeout(200);
  await p.locator("[data-reason-save]").click(); await p.waitForTimeout(1600);
  const saved = await p.evaluate((fid) => JSON.parse(localStorage.getItem("memap_entries") || "[]").filter((e) => e.trackerId === fid && (e.tags || []).length).length, fid);
  check(`${lang}: the reason is saved with its day (three answers now)`, saved === 3, saved);
  // the card now tells what comes up most and offers "I did it"
  const told = p.locator("[data-why-told]");
  check(`${lang}: from three answers the card says what comes up most`, (await told.count()) === 1 && w.told.test((await told.innerText()).trim()), (await told.count()) ? await told.innerText() : "none");
  const card = p.locator("[data-why-task]").locator("xpath=ancestor::div[contains(@class,'surface')][1]");
  check(`${lang}: then the card offers "${w.did}"`, (await card.locator("button", { hasText: w.did }).count()) === 1 && (await p.locator("[data-why-answer]").count()) === 0);
  if (await told.count()) await told.scrollIntoViewIfNeeded(); await p.screenshot({ path: `${D}/${lang}-3-told.png` });
  // the link with the fights shows the second voice: "In your words · Fights", the most common reason, "k of n times"
  await openAct(p, { ...w, act: lang === "en" ? /^Links/ : /^Связи/ });
  let words = p.locator("[data-link-words]");
  if (!(await words.count())) {
    const cards = p.locator("[data-link-card]");
    for (let i = 0; i < (await cards.count()) && !(await words.count()); i++) {
      const s = await cards.nth(i).locator("[data-link-sentence]").innerText();
      if (/argu|ссор/i.test(s)) { await cards.nth(i).locator("button[aria-expanded]").first().click(); await p.waitForTimeout(700); }
    }
    words = p.locator("[data-link-words]");
  }
  const wt = (await words.count()) ? (await words.first().innerText()).replace(/\s+/g, " ") : "none";
  check(`${lang}: the fights' link shows what was said in Why?`, lang === "en" ? /In your words · Fights Tiredness \d+ of \d+ times you said why/.test(wt) : /Твоими словами · Ссоры Усталость \d+ из \d+/.test(wt), wt);
  if (await words.count()) { await words.first().scrollIntoViewIfNeeded(); await p.screenshot({ path: `${D}/${lang}-5-link-words.png` }); }
  // B: one earlier reason, no fight in the last days → no button, the line says Why? comes after the next one
  await p.evaluate(() => localStorage.clear());
  await seed(p, lang, 1, true);
  await openAct(p, w);
  const next = p.locator("[data-why-next]");
  if ((await p.locator("[data-why-task]").count()) === 1) {
    check(`${lang}: no fight waiting → no button, the line says Why? comes next time`, (await next.count()) === 1 && (await next.innerText()).trim() === w.next && (await p.locator("[data-why-answer]").count()) === 0,
      (await next.count()) ? await next.innerText() : "none");
    out[`${lang} quiet card`] = (await p.locator("[data-why-task]").locator("xpath=ancestor::div[contains(@class,'surface')][1]").innerText()).replace(/\s+/g, " ").slice(0, 300);
    if (await next.count()) await next.scrollIntoViewIfNeeded(); await p.screenshot({ path: `${D}/${lang}-4-next.png` });
  } else out[`${lang}: no fight waiting`] = "skipped: the rule is not lit without the last days' fights";
  await ctx.close();
}
// 4: the page of one thing never says "Other" is the most common reason
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  const r = await p.evaluate(async () => {
    const m = await import("/src/lib/reasons.ts");
    const tr = { id: "1-argued-with-partner-1", title: "Argued with partner" };
    const es = [1, 2, 3, 4].map((i) => ({ id: `e${i}`, trackerId: "1-argued-with-partner-1", date: `2026-11-0${i}`, value: true, tags: i < 4 ? ["other"] : ["money"] }));
    return m.reasonTally(tr, es);
  });
  check(`the most common reason is never "other"`, r.top !== "other" && r.said === 4, r);
  await ctx.close();
}
await b.close();
console.log(JSON.stringify({ out, errs }, null, 1));
if (fails.length || errs.length) process.exit(1);
