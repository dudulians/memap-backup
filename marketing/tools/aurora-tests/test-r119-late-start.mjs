// r119 (Nov 10 2026, her yes to: "if a test is started late in the evening, once the day's answers are in, its
// question comes at once — about a day the step couldn't be done"). A test started in the evening after today's
// answers asks from tomorrow evening: the sheet says so before Start, the question isn't in tonight's questions, the
// first push says "from tomorrow evening". Started in the evening before any answer: asked tonight. EN and RU.
// Run from marketing/tools:  node aurora-tests/test-r119-late-start.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r119`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const ok = (name, cond, info = "") => { out[name] = !!cond; if (!cond) fails.push(`${name} ${typeof info === "string" ? info : JSON.stringify(info)}`.trim()); };

for (const lang of ["en", "ru"]) for (const answered of [true, false]) {
  const W = lang === "ru" ? { title: /Проверь одно изменение/, start: /^Начать/i, tag: "каждый вечер, с завтрашнего дня", every: "каждый вечер", cont: /^Дальше$/ }
    : { title: /Test one change/, start: /^Start/i, tag: "every evening, from tomorrow", every: "every evening", cont: /^Continue$/ };
  const tag = `${lang}.${answered ? "answered" : "not-yet"}`;
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: "Europe/London", locale: lang === "ru" ? "ru-RU" : "en-US" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  await p.clock.install({ time: new Date("2026-11-10T20:30:00Z") });
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(900);
  await p.evaluate(async ({ lang, answered }) => {
    localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order"])); localStorage.setItem("memap_tour_seen", "true");
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" })); localStorage.setItem("memap_tour_completed", "1"); localStorage.setItem("memap_first_link_seen", "before");
    localStorage.setItem("memap_ab_onb", "A");
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    const [head, fat] = await dz.ensureTemplates(["headache", "felt-fatigued"]);
    const E = [];
    for (let d = answered ? 0 : 1; d <= 20; d++) { E.push({ id: `h-${d}`, trackerId: head, date: dz.daysAgoIso(d), value: d % 3 === 0 }); E.push({ id: `f-${d}`, trackerId: fat, date: dz.daysAgoIso(d), value: d % 2 === 0 }); }
    await st.saveEntries(E);
    localStorage.setItem("memap_path_start", dz.daysAgoIso(20));
    // the islands grew long ago: no "island grew" moment over the sheets
    const seen = []; for (const isl of ["health", "body", "me", "love", "work", "world", "kids", "pet", "parents"]) for (let k = 0; k <= 4; k++) seen.push(`${isl}:${k}`);
    localStorage.setItem("memap_grow_seen", JSON.stringify(seen));
  }, { lang, answered });
  await p.reload(); await p.waitForTimeout(2500);
  // What helps → Test one change → the first change → Start
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns" } }))); await p.waitForTimeout(1800);
  await p.evaluate(() => window.dispatchEvent(new Event("memap-open-helps"))); await p.waitForTimeout(1500);
  await p.locator("[role=dialog]").last().getByRole("button", { name: W.title }).click(); await p.waitForTimeout(1500);
  const sheet = p.locator("div[role=dialog].fixed").last();
  // a daytime step (a night step starts tomorrow anyway)
  await sheet.locator("button[aria-pressed]", { hasText: lang === "ru" ? "Есть три раза в день, в привычные часы" : "Eat three meals at regular times" }).click();
  await p.waitForTimeout(500);
  const tagText = (await sheet.innerText()).replace(/\s+/g, " ");
  await p.screenshot({ path: `${D}/${tag}-1-picker.png` });
  ok(`${tag}: the sheet says when the question starts`, answered ? tagText.includes(W.tag) : tagText.includes(W.every) && !tagText.includes(W.tag), tagText.slice(-260));
  await sheet.getByRole("button", { name: W.start }).last().click(); await p.waitForTimeout(1500);
  await sheet.getByRole("button", { name: W.cont }).click().catch(() => {}); await p.waitForTimeout(1200);
  const st = await p.evaluate(async () => {
    const ps = await import("/src/lib/pathSteps.ts"), s = await import("/src/lib/storage.ts"), n = await import("/src/lib/notifications.ts");
    const x = JSON.parse(localStorage.getItem("memap_experiments") || "[]").pop();
    const T = await s.getTrackers(), tr = T.find((t) => t.id === x?.trackerId);
    const first = n.tryPlan()[0];
    return { x, askFrom: tr?.askFrom ?? null, inToday: ps.activeQuestions(T).some((t) => t.id === tr?.id), push: first ? `${first.title} | ${first.body}` : "" };
  });
  out[tag] = st;
  if (answered) {
    ok(`${tag}: asked from tomorrow`, st.x?.later === true && st.askFrom === "2026-11-11" && !st.inToday, st);
  } else {
    ok(`${tag}: asked tonight`, !st.x?.later && st.askFrom === null && st.inToday, st);
  }
  await ctx.close();
}
console.log(JSON.stringify({ fails, out, errs }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
