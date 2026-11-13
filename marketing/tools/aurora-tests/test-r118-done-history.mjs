// r118 (Nov 10 2026, her notes on a When to act card: "а когда действие сделано, оно будет вот так висеть? или куда-то
// пойдёт" — "надо, чтоб человек где-то видел историю своих действий" — and the pop-up "Noted." window). Done on a task:
// no pop-up; the card leaves Time to act and a quiet line says where it went; "See" opens What helps, where the task
// is under "Done" with its question and day (and, for a one-time task, when its before-and-after comes). A partner
// step: the next step takes its place; the done one is in the history too. EN and RU.
// Run from marketing/tools:  node aurora-tests/test-r118-done-history.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r118`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const ok = (name, cond, info = "") => { out[name] = !!cond; if (!cond) fails.push(`${name} ${typeof info === "string" ? info : JSON.stringify(info)}`.trim()); };
const toasts = (p) => p.evaluate(() => document.querySelectorAll("[data-sonner-toast], ol li[data-state=open]").length);

for (const lang of ["en", "ru"]) {
  const W = lang === "ru"
    ? { done: /^Сделано$/, see: /^Открыть$/, doneTag: "Сделано", saved: "Сохранено в «Что помогает»", joint: /сустав/i, voice: /голос/i, head: "СДЕЛАНО", soon: /Через \d+ (день|дня|дней) — ответы до и после\./ }
    : { done: /^I did it$/, see: /^See$/, doneTag: "Done", saved: "It's saved in What helps", joint: /joint/i, voice: /voice/i, head: "DONE", soon: /In \d+ days?: your answers before and after\./ };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: "Europe/London" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  let n = 0; const shot = async (name) => { await p.waitForTimeout(500); await p.screenshot({ path: `${D}/${lang}-${String(++n).padStart(2, "0")}-${name}.png` }); };
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  const ids = await p.evaluate(async (lang) => {
    localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order"])); localStorage.setItem("memap_tour_seen", "true");
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" })); localStorage.setItem("memap_tour_completed", "1"); localStorage.setItem("memap_first_link_seen", "before");
    localStorage.setItem("memap_ab_onb", "A");
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    const [joint, voice, sleep] = await dz.ensureTemplates(["joint-pain", "partner-raised-voice", "slept-enough"]);
    const E = [];
    for (let d = 1; d <= 30; d++) {
      E.push({ id: `j-${d}`, trackerId: joint, date: dz.daysAgoIso(d), value: d % 3 === 0 });
      E.push({ id: `v-${d}`, trackerId: voice, date: dz.daysAgoIso(d), value: d % 4 === 0 });
      E.push({ id: `s-${d}`, trackerId: sleep, date: dz.daysAgoIso(d), value: true });
    }
    await st.saveEntries(E);
    localStorage.setItem("memap_path_start", dz.daysAgoIso(30));
    localStorage.setItem("memap_door", JSON.stringify({ id: "pain", trackerId: joint, contextTrackerIds: [], startedAt: dz.daysAgoIso(30) }));
    return { joint, voice };
  }, lang);
  await p.reload(); await p.waitForTimeout(2500);
  const openAct = async () => {
    await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "signals", back: true } })));
    await p.waitForTimeout(2200);
  };
  const cardOf = (re) => p.locator("[role=dialog] div.surface.scroll-mt-4", { hasText: re }).first();

  // 1. a one-time task: Done
  await openAct();
  await shot("act-before");
  const joint = cardOf(W.joint);
  ok(`${lang}.joint card lit`, (await joint.count()) > 0);
  const plan = (await joint.locator("p.text-\\[21px\\]").innerText().catch(() => "")).trim();
  out[`${lang}.plan`] = plan;
  await joint.getByRole("button", { name: W.done }).click(); await p.waitForTimeout(1500);
  await shot("joint-done");
  ok(`${lang}.no pop-up after Done`, (await toasts(p)) === 0, String(await toasts(p)));
  const line = (await p.locator("[data-just-done]").innerText().catch(() => "")).replace(/\s+/g, " ");
  out[`${lang}.justDone`] = line;
  ok(`${lang}.quiet line: done + where it went`, line.includes(plan) && line.includes(W.saved), line);
  ok(`${lang}.the joint card left Time to act`, (await cardOf(W.joint).count()) === 0);

  // 2. the partner step: Done → the next step, no pop-up
  const voice = cardOf(W.voice);
  if (await voice.count()) {
    const step1 = (await voice.locator("p.text-\\[21px\\]").innerText().catch(() => "")).trim();
    await voice.getByRole("button", { name: W.done }).click(); await p.waitForTimeout(1500);
    await shot("voice-done");
    ok(`${lang}.no pop-up after a partner step`, (await toasts(p)) === 0);
    const step2 = (await cardOf(W.voice).locator("p.text-\\[21px\\]").innerText().catch(() => "")).trim();
    out[`${lang}.steps`] = [step1, step2];
    ok(`${lang}.the next step takes its place`, !!step2 && step2 !== step1, { step1, step2 });
    out[`${lang}.step1`] = step1;
    // the step just done says so right in its card (her note, Nov 10 2026: "не показалось, что это куда-то ушло")
    const inCard = (await cardOf(W.voice).locator("[data-just-done]").innerText().catch(() => "")).replace(/\s+/g, " ");
    out[`${lang}.inCard`] = inCard;
    ok(`${lang}.in the card: the step just done`, inCard.includes(step1.replace(/[.!]+$/, "")) && inCard.includes(W.saved), inCard);
    // the second step too: now the card leaves, and the line above says where it went
    await cardOf(W.voice).getByRole("button", { name: W.done }).click(); await p.waitForTimeout(1500);
    await shot("voice-all-done");
    ok(`${lang}.all steps done: the partner card left`, (await cardOf(W.voice).count()) === 0);
    const top = (await p.locator("[data-just-done]").innerText().catch(() => "")).replace(/\s+/g, " ");
    ok(`${lang}.all steps done: the line says it`, top.includes(step2.replace(/[.!]+$/, "")), top);
    out[`${lang}.step2`] = step2;
  } else ok(`${lang}.partner card lit`, false);

  // 3. "See": What helps, Done list
  await p.locator("[data-just-done]").getByRole("button", { name: W.see }).click(); await p.waitForTimeout(1800);
  await shot("what-helps");
  const list = (await p.locator("[data-done-list]").innerText().catch(() => "")).replace(/\s+/g, " ");
  out[`${lang}.doneList`] = list;
  ok(`${lang}.What helps: Done list`, list.startsWith(W.head) || list.toUpperCase().startsWith(W.head), list.slice(0, 80));
  ok(`${lang}.the task is in it, with its day`, list.includes(plan) && /\d{1,2}\s?\S+/.test(list), list);
  ok(`${lang}.the partner steps are in it`, !out[`${lang}.step1`] || (list.includes(out[`${lang}.step1`]) && list.includes(out[`${lang}.step2`])), list);
  ok(`${lang}.before and after: when it comes`, W.soon.test(list), list);
  await ctx.close();
}

// 4. a week and more on: did it help? in words (her note, Nov 10 2026: "непонятно, помогло это или нет")
for (const lang of ["en", "ru"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: "Europe/London" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async (lang) => {
    localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order"])); localStorage.setItem("memap_tour_seen", "true");
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" })); localStorage.setItem("memap_tour_completed", "1"); localStorage.setItem("memap_first_link_seen", "before");
    localStorage.setItem("memap_ab_onb", "A");
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    const [joint] = await dz.ensureTemplates(["joint-pain"]);
    const E = [];
    // before the task: 10 of 30 days; since it (10 days ago): 1 of 10
    for (let d = 1; d <= 40; d++) E.push({ id: `j-${d}`, trackerId: joint, date: dz.daysAgoIso(d), value: d <= 10 ? d === 5 : d % 3 === 0 });
    await st.saveEntries(E);
    const T = await st.getTrackers();
    await st.saveTrackers(T.map((t) => t.id === joint ? { ...t, planKind: "once", cycleStartDate: dz.daysAgoIso(10), cycles: [{ id: "c1", startDate: dz.daysAgoIso(40), endDate: dz.daysAgoIso(10), periodDays: 30, threshold: 8, significantDays: 10, totalTrackedDays: 10 }] } : t));
    localStorage.setItem("memap_actions_done", JSON.stringify([{ id: "a1", trackerId: joint, plan: T.find((t) => t.id === joint).adviceAboveThreshold, date: dz.daysAgoIso(10), kind: "once" }]));
    localStorage.setItem("memap_path_start", dz.daysAgoIso(40));
  }, lang);
  await p.reload(); await p.waitForTimeout(2500);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns" } }))); await p.waitForTimeout(1800);
  await p.evaluate(() => window.dispatchEvent(new Event("memap-open-helps"))); await p.waitForTimeout(1800);
  const verdict = await p.locator("[data-done-verdict]").innerText().catch(() => "");
  const row = (await p.locator("[data-done-row]").first().innerText().catch(() => "")).replace(/\s+/g, " ");
  out[`${lang}.week-on`] = row;
  ok(`${lang}.4 a week on: did it help, in words`, verdict === (lang === "ru" ? "С тех пор тяжёлых ответов меньше. Возможно, это помогает." : "Fewer hard answers since. It may be helping."), row);
  await p.screenshot({ path: `${D}/${lang}-05-week-on.png` });
  await ctx.close();
}
// 5. her phone (Nov 10 2026): "Tell someone you trust…" marked done in an earlier version hung on with a "Done" pill and
// no button. Now it moves on: one step left → that step; none left → the card leaves and both are in the history.
for (const lang of ["en", "ru"]) for (const both of [false, true]) {
  const W = lang === "ru" ? { place: "Заранее решить, куда можно отойти", tell: "Рассказать человеку, которому доверяешь", voice: /голос/i }
    : { place: "Decide where you can go when it gets loud", tell: "Tell someone you trust how often", voice: /voice/i };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: "Europe/London" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async ({ lang, both }) => {
    localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order"])); localStorage.setItem("memap_tour_seen", "true");
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" })); localStorage.setItem("memap_tour_completed", "1"); localStorage.setItem("memap_first_link_seen", "before");
    localStorage.setItem("memap_ab_onb", "A");
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    const i18n = (await import("/src/lib/i18n.ts")).default;
    const [voice, sleep] = await dz.ensureTemplates(["partner-raised-voice", "slept-enough"]);
    const E = [];
    for (let d = 1; d <= 30; d++) { E.push({ id: `v-${d}`, trackerId: voice, date: dz.daysAgoIso(d), value: d % 4 === 0 }); E.push({ id: `s-${d}`, trackerId: sleep, date: dz.daysAgoIso(d), value: true }); }
    await st.saveEntries(E);
    const T = await st.getTrackers();
    await st.saveTrackers(T.map((t) => (t.id === voice ? { ...t, adviceAboveThreshold: i18n.t("rules.home.voiceTell"), planKind: "once" } : t)));
    localStorage.setItem("memap_home_steps", JSON.stringify({ [voice]: both ? ["rules.home.voicePlace", "rules.home.voiceTell"] : ["rules.home.voiceTell"] }));
    localStorage.setItem("memap_path_start", dz.daysAgoIso(30));
  }, { lang, both });
  await p.reload(); await p.waitForTimeout(2500);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "signals", back: true } })));
  await p.waitForTimeout(2600);
  const card = p.locator("[role=dialog] div.surface.scroll-mt-4", { hasText: W.voice }).first();
  const text = (await card.innerText().catch(() => "")).replace(/\s+/g, " ");
  await p.screenshot({ path: `${D}/${lang}-06-old-done-${both ? "both" : "one"}.png` });
  if (!both) ok(`${lang}.5 one step done before: the card moves to the other step`, text.includes(W.place) && !text.includes(W.tell), text.slice(0, 200));
  else {
    ok(`${lang}.5 both done before: the card leaves`, (await card.count()) === 0, text.slice(0, 200));
    const log = await p.evaluate(() => JSON.parse(localStorage.getItem("memap_actions_done") || "[]").map((a) => a.plan));
    ok(`${lang}.5 both done before: in the history`, log.includes("rules.home.voiceTell"), log);
  }
  await ctx.close();
}
console.log(JSON.stringify({ fails, out, errs }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
