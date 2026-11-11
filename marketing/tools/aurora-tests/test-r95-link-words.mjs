// r95. Nov 9 2026 (her note about "When you say yes when you mean no, the next day you often have a headache —
// 11 of 17 times": "так сложно читается") links became short headlines with the count under them. Nov 11 2026
// the headlines "резали глаза" ("Unwanted yes → headache the next day"), and after a page of real examples she
// chose sentences again ("Да, ставь"): a sentence ("The day after you agree to something you don't really want,
// you usually have a headache", «Если ты соглашаешься на то, чего не хочешь, на следующий день обычно болит
// голова») and the count on its own line ("17 of 20 times · on other days 12 of 39", "Every time — 15 of 15"),
// never glued on with a dash, no arrows. The Links screen, a link's sheet, When to act "Comes with it", the week
// report and the doctor's report (its canvas text), EN and RU.
// Run from marketing/tools:  node aurora-tests/test-r95-link-words.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r95`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const ok = (name, cond, info = "") => { out[name] = !!cond; if (!cond) fails.push(`${name} ${info}`.trim()); };
// the short headlines that are gone, and the old sentence with its count glued on
const SHORT = /→|come together|бывают вместе| — and |times\.|раз\./;
const SAY = { en: /The day after |On days you /, ru: /Если ты |В дни, когда / };
const FORCED = {
  en: /The day after you agree to something you don't really want, you [a-z ]*have a headache (\d+ of \d+ times|Every time — \d+ of \d+) · on other days \d+ of \d+/,
  ru: /Если ты соглашаешься на то, чего не хочешь, на следующий день [а-яё ]*болит голова (\d+ из \d+ раз(а)?|Каждый раз — \d+ из \d+) · в другие дни \d+ из \d+/,
};

for (const lang of ["en", "ru"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: "Europe/London" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  let n = 0; const shot = async (name) => { await p.waitForTimeout(600); await p.screenshot({ path: `${D}/${lang}-${String(++n).padStart(2, "0")}-${name}.png` }); };
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  // 60 evenings: a forced yes brings a headache the next day (mostly), every short night has a headache
  // the same day; the headache is her topic, so it has a When to act card with what comes with it
  await p.evaluate(async (lang) => {
    localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order"])); localStorage.setItem("memap_tour_seen", "true");
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" })); localStorage.setItem("memap_tour_completed", "1"); localStorage.setItem("memap_first_link_seen", "before");
    localStorage.setItem("memap_ab_onb", "A");
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    const [head, forced, sleep] = await dz.ensureTemplates(["headache", "said-yes-when-meant-no", "slept-enough"]);
    const forcedOn = (d) => d % 3 === 0, shortOn = (d) => d % 4 === 1;
    const E = [];
    const add = (id, d, v) => E.push({ id: `${id}-${d}`, trackerId: id, date: dz.daysAgoIso(d), value: v });
    for (let d = 1; d <= 60; d++) {
      add(forced, d, forcedOn(d));
      add(sleep, d, !shortOn(d));
      add(head, d, shortOn(d) || (forcedOn(d + 1) && d % 5 !== 0) || d % 11 === 0);
    }
    await st.saveEntries(E);
    localStorage.setItem("memap_path_start", dz.daysAgoIso(60));
    localStorage.setItem("memap_door", JSON.stringify({ id: "migraine", trackerId: head, contextTrackerIds: [], startedAt: dz.daysAgoIso(60) }));
  }, lang);
  await p.reload(); await p.waitForTimeout(2500);

  // 1. Links
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "findings", back: true } })));
  await p.waitForTimeout(2200); await shot("links");
  // words first, numbers on tap (her note, Nov 11 2026): no count until a card is opened; then open them all
  const closedCounts = await p.evaluate(() => document.querySelectorAll("[role=dialog] [data-link-count]").length);
  ok(`${lang}.links: words first, no numbers until a tap`, closedCounts === 0, closedCounts);
  await p.evaluate(() => document.querySelectorAll("[data-link-card] button[aria-expanded=false]").forEach((x) => x.click()));
  await p.waitForTimeout(600);
  const links = (await p.locator("[role=dialog]").last().innerText().catch(() => "")).replace(/\s+/g, " ");
  out[`${lang}.links`] = links.slice(0, 900);
  ok(`${lang}.links: forced yes, the next day, as a sentence`, FORCED[lang].test(links), links.slice(0, 300));
  ok(`${lang}.links: same day, every time`, lang === "en" ? /On days you sleep under 7 hours, you always have a headache Every time — (\d+) of \1/.test(links) : /В дни, когда ты спишь меньше 7 часов, всегда болит голова Каждый раз — (\d+) из \1/.test(links), links.slice(0, 400));
  ok(`${lang}.links: no short headline`, !SHORT.test(links), links.slice(0, 300));
  await p.keyboard.press("Escape"); await p.waitForTimeout(800);
  // a link's own sheet on the map (every time: the big count)
  const route = await p.evaluate(async () => {
    const isl = await import("/src/lib/islands.ts"), st = await import("/src/lib/storage.ts");
    const T = await st.getTrackers(), E = await st.getEntries();
    const rs = isl.buildRoutes(T, E, isl.buildIslands(T, E));
    const r = rs.find((x) => x.k === x.n) ?? rs[0];
    return r ? { a: r.a, b: r.b } : null;
  });
  if (route) {
    await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns" } })));
    await p.waitForTimeout(1800);
    await p.evaluate((d) => window.dispatchEvent(new CustomEvent("memap-open-link", { detail: d })), route);
    await p.waitForTimeout(1500); await shot("link-sheet");
    const sheet = (await p.locator("[role=dialog]").last().innerText().catch(() => "")).replace(/\s+/g, " ");
    out[`${lang}.sheet`] = sheet.slice(0, 500);
    ok(`${lang}.sheet: a sentence, no short headline`, SAY[lang].test(sheet) && !SHORT.test(sheet), sheet.slice(0, 300));
    await p.keyboard.press("Escape"); await p.waitForTimeout(800);
  }

  // 2. When to act: the headache card, opened, "Comes with it"
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "signals", back: true } })));
  await p.waitForTimeout(2200);
  const dlg = p.locator("[role=dialog]").last();
  const more = dlg.locator("button", { hasText: /more rules? (is|are) reached|more questions?: time to act|ещё/ });
  if (await more.count()) { await more.first().click().catch(() => {}); await p.waitForTimeout(400); }
  await p.evaluate(() => [...document.querySelectorAll("[role=dialog] button[aria-expanded=false]")].find((x) => /headache|голов/i.test(x.textContent))?.click());
  await p.waitForTimeout(900);
  const comes = await p.evaluate(() => { const h = [...document.querySelectorAll("[role=dialog] p")].find((x) => /Comes with it|Бывает вместе с этим/.test(x.textContent)); h?.scrollIntoView({ block: "center" }); return h ? h.parentElement.innerText.replace(/\s+/g, " ") : ""; });
  await shot("act-comes-with");
  out[`${lang}.act`] = comes.slice(0, 600);
  ok(`${lang}.act: comes with, a sentence and its count`, FORCED[lang].test(comes), comes.slice(0, 300));
  ok(`${lang}.act: no short headline`, comes.length > 0 && !SHORT.test(comes));
  await p.keyboard.press("Escape"); await p.waitForTimeout(800);

  // 3. The week report: last week's waits on Today as the first step
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "cards" } })));
  await p.waitForTimeout(1500);
  const openBtn = p.getByText(/^(Start|Начать|Старт)$/).first();
  if (await openBtn.count()) { await openBtn.click().catch(() => {}); await p.waitForTimeout(1500); }
  const see = p.getByRole("button", { name: lang === "en" ? /See the report/ : /Смотреть отч[её]т/ });
  if (await see.count()) { await see.first().click(); await p.waitForTimeout(2600); }
  await shot("week-report");
  const week = (await p.locator("[role=dialog]").last().innerText().catch(() => "")).replace(/\s+/g, " ");
  out[`${lang}.week`] = week.slice(0, 600);
  ok(`${lang}.week: insight, a sentence and its count`, lang === "en" ? /(The day after|On days you) [^·]*? (\d+ of \d+ times|Every time — \d+ of \d+) · on other days/.test(week) : /(Если ты|В дни, когда) [^·]*? (\d+ из \d+ раз(а)?|Каждый раз — \d+ из \d+) · в другие дни/.test(week), week.slice(0, 300));
  ok(`${lang}.week: no short headline`, week.length > 0 && !SHORT.test(week));

  // 4. The doctor's report: every word drawn on its pages
  const report = await p.evaluate(async ({ lang }) => {
    const drawn = [], orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (s, ...rest) { drawn.push(String(s)); return orig.call(this, s, ...rest); };
    const r = await import("/src/lib/doctorReport.ts"), s = await import("/src/lib/storage.ts"), nt = await import("/src/lib/notes.ts");
    const trackers = await s.getTrackers(), entries = await s.getEntries();
    const ids = r.reportQuestions(trackers, entries, 60, "doctor").flatMap((g) => g.qs.map((x) => x.q.id));
    const pages = await r.drawReport({ trackers, entries, notes: await nt.getNotes(), audience: "doctor", kind: "full", ids, mainIds: r.reportMainIds(), days: 60, withNotes: false, name: "", daysLabel: lang === "ru" ? "Дни с головной болью" : "Your headache days" });
    CanvasRenderingContext2D.prototype.fillText = orig;
    return { text: drawn.join("\n").replace(/ /g, " "), page: pages[pages.length - 1] };
  }, { lang });
  const { writeFileSync } = await import("fs");
  writeFileSync(`${D}/${lang}-report-text.txt`, report.text);
  writeFileSync(`${D}/${lang}-report-last.jpg`, Buffer.from(report.page.split(",")[1], "base64"));
  const lines = report.text.split("\n");
  const linkLines = lines.filter((l) => /^(The day after|On days you|Если ты|В дни, когда)/.test(l));
  out[`${lang}.report links`] = linkLines;
  out[`${lang}.report counts`] = lines.filter((l) => /times · |каждый раз|every time|раз(а)? · /.test(l));
  ok(`${lang}.report: sentence lines`, linkLines.length > 0, lines.slice(0, 60).join(" | "));
  ok(`${lang}.report: count lines`, out[`${lang}.report counts`].length > 0);
  // (the section title "What tended to come together in this period" stays)
  ok(`${lang}.report: no short headline`, !/→|often come together|more than usual|бывают вместе/.test(report.text));
  await ctx.close();
}
console.log(JSON.stringify({ fails, out, errs }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
