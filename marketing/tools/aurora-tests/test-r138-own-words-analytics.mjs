// r138 (Nov 11 2026, her worries about her own questions and the new events; "делай как нужно"):
// 1. Onboarding, own question: "A yes is… Good / Hard" must be picked before Continue; an idea brings its answer
//    (a lunch break is good); the question is saved with it (good → problemWhen "no"), not as "a yes is hard".
// 2. A link with her own question without words shows "Say … in your own words"; saved words change the sentence
//    to "On days you mark “…”".
// 3. Events (dev logs them as "[analytics:would-track]"): onboarding_day, example_opened / example_hidden,
//    reminder_permission, own_words_opened / own_words_saved, ui_switched with where from.
// 4. A few of the 164 wording fixes reach the screen ("outside work", «вы с партнёром ссоритесь»).
// Run from marketing/tools: node aurora-tests/test-r138-own-words-analytics.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r138`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const ok = (name, cond, info = "") => { out[name] = cond ? "ok" : `FAIL ${typeof info === "string" ? info : JSON.stringify(info)}`.slice(0, 500); if (!cond) fails.push(name); console.log(name, "→", out[name]); };
const events = [];
const newPage = async (opts = {}) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, locale: "en-US", timezoneId: "Asia/Dubai", ...opts });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => { const s = m.text(); if (s.includes("[analytics:would-track]")) events.push(s.replace(/^.*would-track\]\s*/, "")); });
  return { ctx, p };
};

// 1. onboarding, own question
{
  const { ctx, p } = await newPage();
  const at = new Date(); at.setHours(10, 5, 0, 0); await p.clock.install({ time: at });
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem("memap_ab_onb", "A"); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_theme", "aurora-light"); });
  await p.reload(); await p.waitForTimeout(2200);
  const btn = (re) => p.getByRole("button", { name: re }).first();
  await btn(/^Get started/).click(); await p.waitForTimeout(400);
  await btn(/bothering me/i).click(); await p.waitForTimeout(500);
  await btn(/^Write your own question/).click(); await p.waitForTimeout(500);
  await p.locator("input").first().fill("Did I call my family?"); await p.waitForTimeout(300);
  const cont = btn(/^Continue/);
  ok("own question: Continue waits for Good or Hard", await cont.isDisabled());
  ok("…the Good / Hard choice is there", (await p.locator("[data-yes-is]").count()) === 2);
  await p.screenshot({ path: `${D}/1-own-yes-is.png` });
  // an idea brings its answer
  await btn(/proper lunch break/).click(); await p.waitForTimeout(300);
  ok("an idea picks its answer (lunch break: good)", (await p.locator("[data-yes-is=good][aria-pressed=true]").count()) === 1 && !(await cont.isDisabled()));
  // typing again asks again
  await p.locator("input").first().fill("Did I call my family?"); await p.waitForTimeout(200);
  ok("typing anew asks again", await cont.isDisabled());
  await p.locator("[data-yes-is=good]").click(); await p.waitForTimeout(200);
  await cont.click(); await p.waitForTimeout(600);
  await btn(/^Continue/).click(); await p.waitForTimeout(900);
  // the questions step: a second own question needs its answer too
  await btn(/^Write your own$/).click().catch(() => {}); await p.waitForTimeout(300);
  const extra = p.locator("input[aria-label='Write your own']");
  if (await extra.count()) {
    await extra.fill("Did I spend over my budget?"); await p.waitForTimeout(200);
    const add = p.getByRole("button", { name: /^Add$/ }).first();
    ok("a second own question waits for Good or Hard too", await add.isDisabled());
    await p.locator("[data-yes-is=hard]").last().click(); await add.click(); await p.waitForTimeout(300);
  } else ok("a second own question waits for Good or Hard too", false, "no 'Write your own' field");
  await btn(/^Continue/).click(); await p.waitForTimeout(800);
  await btn(/Answer today's questions/).click(); await p.waitForTimeout(600);
  const sh = p.locator(".onb [role=dialog]");
  await sh.getByRole("button", { name: /^Yesterday/ }).click().catch(() => {}); await sh.getByRole("button", { name: /^Continue/ }).click().catch(() => {});
  await p.waitForTimeout(1500);
  const saved = await p.evaluate(async () => (await (await import("/src/lib/storage.ts")).getTrackers()).filter((t) => /-own-/.test(t.id)).map((t) => ({ q: t.questionText, pw: t.problemWhen })));
  ok("saved with her answer: a call home is good (problemWhen no)", saved.some((x) => /call my family/i.test(x.q) && x.pw === "no"), saved);
  ok("…and over budget is hard (problemWhen yes)", saved.some((x) => /over my budget/i.test(x.q) && x.pw === "yes"), saved);
  ok("event: onboarding_day (yesterday, not changed)", events.some((e) => /onboarding_day/.test(e) && /yesterday/.test(e)), events.filter((e) => /onboarding/.test(e)));
  await ctx.close();
}

// 2–4. a world with an own question linked to a library one; examples; reminders
{
  const { ctx, p } = await newPage();
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async () => {
    localStorage.clear(); localStorage.setItem("memap_ab_onb", "A"); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "1");
    localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1"); localStorage.setItem("memap_first_link_seen", "before");
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: dz.daysAgoIso(1) }));
    const [head, screens, argue] = await dz.ensureTemplates(["headache", "screen-time-long", "argued-with-partner"]);
    const own = await dz.addOwnTracker("Did my husband annoy me or not?", true);
    const E = [], add = (id, d, v) => E.push({ id: `${id}-${d}`, trackerId: id, date: dz.daysAgoIso(d), value: v });
    for (let d = 1; d <= 60; d++) { const a = d % 3 === 0; add(own, d, a); add(head, d, a || d % 13 === 0); add(screens, d, d % 4 === 0); add(argue, d, d % 4 === 0 || d % 7 === 0); }
    await st.saveEntries(E);
    localStorage.setItem("memap_path_start", dz.daysAgoIso(60));
    localStorage.setItem("memap_door", JSON.stringify({ id: "migraine", trackerId: head, contextTrackerIds: [own, screens, argue], startedAt: dz.daysAgoIso(60) }));
  });
  await p.reload(); await p.waitForTimeout(2500);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "findings", back: true } })));
  await p.waitForTimeout(2200);
  const dlg = p.locator("[role=dialog]").last();
  // the sentences open on tap since Nov 12 2026 (closed cards are two tags): open them all to read
  await p.evaluate(() => document.querySelectorAll("[data-link-card] button[aria-expanded=false]").forEach((x) => x.click())); await p.waitForTimeout(500);
  let text = (await dlg.innerText()).replace(/\s+/g, " ");
  ok("the own-question link reads in the plain safe form", /you answer “yes” to “Did my husband annoy me or not”/.test(text), text.slice(0, 400));
  ok("a fixed phrase: screens 'outside work'", !/screen/i.test(text) || /outside work/.test(text), text.slice(0, 600));
  // open that card and say it in her words
  await p.evaluate(() => { const c = [...document.querySelectorAll("[data-link-card]")].find((x) => /husband/.test(x.textContent)); c?.querySelector("button[aria-expanded=false]")?.click(); });
  await p.waitForTimeout(500);
  const prompt = p.locator("[data-own-words]").first();
  ok("'Say … in your own words' under the link", await prompt.isVisible().catch(() => false));
  await prompt.click(); await p.waitForTimeout(300);
  const fields = p.locator("[data-own-words-open] input");
  await fields.nth(0).fill("husband annoyed me"); await fields.nth(1).fill("husband was fine");
  await p.screenshot({ path: `${D}/2-own-words.png` });
  await p.locator("[data-own-words-open] button", { hasText: /^Save$/ }).click(); await p.waitForTimeout(1500);
  const words = await p.evaluate(async () => (await (await import("/src/lib/storage.ts")).getTrackers()).find((t) => /-own-/.test(t.id))?.words);
  ok("her words are saved on the question", words?.yes === "husband annoyed me" && words?.no === "husband was fine", words);
  const lt = await p.evaluate(async () => {
    const st = await import("/src/lib/storage.ts"), isl = await import("/src/lib/islands.ts"), L = await import("/src/lib/linkText.ts"), i18n = (await import("/src/lib/i18n.ts")).default;
    const T = await st.getTrackers(), E = await st.getEntries();
    const of = L.trackerLookup(T), own = T.find((t) => /-own-/.test(t.id));
    const r = isl.buildRoutes(T, E, isl.buildIslands(T, E)).find((x) => x.first === own.id || x.second === own.id);
    return r ? L.linkHead(i18n.t.bind(i18n), r, of) : "no route";
  });
  ok("the link now reads her way", /you mark “husband annoyed me”/.test(lt), lt);
  ok("events: own_words_opened, own_words_saved", events.some((e) => /own_words_opened/.test(e)) && events.some((e) => /own_words_saved/.test(e)));
  await p.keyboard.press("Escape"); await p.waitForTimeout(500);
  // Russian: «вы с партнёром ссоритесь»
  const ru = await p.evaluate(async () => {
    const ap = await import("/src/lib/answerPhrases.ts"), i18n = (await import("/src/lib/i18n.ts")), st = await import("/src/lib/storage.ts");
    i18n.setLanguage("ru");
    const T = await st.getTrackers(), tr = T.find((t) => ap.templateIdOf(t) === "argued-with-partner");
    const s = ap.answerClause(i18n.default.t.bind(i18n.default), tr, true, "result", "обычно");
    i18n.setLanguage("en");
    return s;
  });
  ok("RU: «вы с партнёром обычно ссоритесь»", ru === "вы с партнёром обычно ссоритесь", ru);
  // reminders: the phone's answer is counted
  await p.evaluate(async () => { await (await import("/src/lib/notifications.ts")).requestNotificationPermissionDetailed(); });
  await p.waitForTimeout(300);
  ok("event: reminder_permission", events.some((e) => /reminder_permission/.test(e)), events.slice(-5));
  await ctx.close();
}

// examples: opened and folded are counted
{
  const { ctx, p } = await newPage();
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem("memap_ab_onb", "A"); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1"); localStorage.setItem("memap_examples_seen", JSON.stringify(["link", "month", "rule", "test", "chart", "chart-one"])); });
  const dz = await p.evaluate(async () => { const dz = await import("/src/lib/doors.ts"); const [h] = await dz.ensureTemplates(["headache"]); localStorage.setItem("memap_door", JSON.stringify({ id: "migraine", trackerId: h, contextTrackerIds: [], startedAt: dz.daysAgoIso(1) })); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: dz.daysAgoIso(1) })); return true; });
  await p.reload(); await p.waitForTimeout(2500);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "findings", back: true } })));
  await p.waitForTimeout(2000);
  const folded = p.locator("[data-example-folded]").first();
  if (await folded.count()) {
    await folded.click(); await p.waitForTimeout(400);
    await p.locator("[data-example-hide]").first().click(); await p.waitForTimeout(300);
    ok("events: example_opened, example_hidden", events.some((e) => /example_opened/.test(e)) && events.some((e) => /example_hidden/.test(e)), events.slice(-6));
  } else ok("events: example_opened, example_hidden", false, "no folded example on Links");
  await ctx.close();
}

console.log(JSON.stringify({ fails, errs: errs.slice(0, 10) }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
