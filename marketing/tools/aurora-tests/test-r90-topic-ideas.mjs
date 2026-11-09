// v113 (her notes, Nov 9 2026): changes on the question's own topic ("Not for me" on comparing oneself
// online offered sweets and stretching), no raw {{n}}, "Got recognition" advice for days WITHOUT praise,
// and Finding / Task / Question tags on When to act and the test sheets. EN and RU.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r90`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const out = {}, errs = [];
// 1) data: every library question with advice has a topic; every idea has its words in both languages
{
  const p = await b.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  out.data = await p.evaluate(async () => {
    const { LIFE_STREAMS } = await import("/src/lib/lifeStreams.ts");
    const { topicOf, ideasForQuestion } = await import("/src/lib/topicIdeas.ts");
    const { TOPIC_IDEAS } = await import("/src/lib/experiments.ts");
    const i18n = (await import("/src/lib/i18n.ts")).default;
    const noTopic = [], missing = [];
    for (const s of LIFE_STREAMS) for (const tpl of s.templates) {
      if (!tpl.threshold || !tpl.adviceAboveThreshold) continue;
      const tr = { id: `1-${tpl.id}-1`, title: tpl.title, category: tpl.category, problemWhen: tpl.problemWhen };
      if (!topicOf(tr)) noTopic.push(tpl.id);
    }
    for (const k of new Set(Object.values(TOPIC_IDEAS).flat())) for (const lng of ["en", "ru"]) for (const f of ["change", "q", "today"])
      if (!i18n.exists(`experiment.idea.${k}.${f}`, { lng })) missing.push(`${lng}:${k}.${f}`);
    const social = ideasForQuestion({ id: "1-compared-on-social-1", title: "Compared myself online", category: "Social" }).map((k) => i18n.t(`experiment.idea.${k}.change`, { lng: "en" }));
    return { noTopic, missing, social };
  });
  await p.close();
}
// 2) the screens
for (const lang of ["en", "ru"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  let n = 0; const shot = async (name) => { await p.waitForTimeout(500); await p.screenshot({ path: `${D}/${lang}-${++n}-${name}.png` }); };
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async (lang) => {
    const iso = (k) => { const d = new Date(); d.setDate(d.getDate() - k); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    localStorage.clear(); localStorage.setItem("memap_ab_onb", "A");
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_tour_completed", "1"); localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order", "old-look", "report", "block:world", "block:signals", "block:findings", "block:helps"]));
    const ids = await dz.ensureTemplates(["compared-on-social", "got-recognition", "slept-enough"]);
    localStorage.setItem("memap_door", JSON.stringify({ id: "mood", trackerId: ids[0], contextTrackerIds: ids.slice(1), startedAt: iso(30) }));
    localStorage.setItem("memap_path_start", iso(30)); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(29) }));
    // an old user's stored advice for "Got recognition" (to be replaced)
    const T = await st.getTrackers();
    await st.saveTrackers(T.map((x) => (x.id === ids[1] ? { ...x, adviceAboveThreshold: "Save what was said — for days I doubt myself" } : x)));
    const E = [];
    for (let k = 1; k <= 30; k++) { E.push({ id: `a${k}`, trackerId: ids[0], date: iso(k), value: k % 3 !== 0 }); E.push({ id: `b${k}`, trackerId: ids[1], date: iso(k), value: k % 5 === 0 }); E.push({ id: `c${k}`, trackerId: ids[2], date: iso(k), value: k % 2 === 0 }); }
    await st.saveEntries(E);
  }, lang);
  await p.reload(); await p.waitForTimeout(2500);
  out[`${lang} recognitionAdvice`] = await p.evaluate(async () => (await (await import("/src/lib/storage.ts")).getTrackers()).find((x) => x.id.includes("got-recognition"))?.adviceAboveThreshold);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "signals", back: true } }))); await p.waitForTimeout(2200);
  await shot("when-to-act");
  const dlg = p.locator("[role=dialog]").last();
  out[`${lang} cardTags`] = await dlg.locator(".kind-tag").allInnerTexts();
  // open the comparing card's details
  await dlg.locator("button[aria-expanded]").filter({ hasText: /compare|сравнива/i }).first().click(); await p.waitForTimeout(700);
  await shot("card-open");
  out[`${lang} openTags`] = (await dlg.locator(".kind-tag").allInnerTexts()).map((s) => s.replace(/\s+/g, " "));
  out[`${lang} rawBraces`] = /\{\{|\}\}/.test(await dlg.innerText());
  // unfollow / mute is done once: "I did it", not a 2-week test
  out[`${lang} onceButton`] = await p.getByRole("button", { name: /Try it for 2 weeks|Попробовать 2 недели/ }).count();
  // Not for me
  await p.getByRole("button", { name: /^Not for me$|^Не моё$/ }).first().click(); await p.waitForTimeout(900);
  await shot("not-for-me");
  out[`${lang} notForMe`] = (await p.locator("[role=dialog]").last().innerText()).replace(/\s+/g, " ").slice(0, 700);
  await p.keyboard.press("Escape"); await p.waitForTimeout(800);
  // the praise card: a daily task → Try it for 2 weeks → the test sheet
  await p.locator("button[aria-expanded]").filter({ hasText: /compare|сравнива/i }).first().click(); await p.waitForTimeout(500);
  await p.locator("button[aria-expanded]").filter({ hasText: /praise|похвал|признан/i }).first().click(); await p.waitForTimeout(700);
  await p.getByRole("button", { name: /Try it for 2 weeks|Попробовать 2 недели/ }).first().click(); await p.waitForTimeout(1300);
  await shot("test-pick");
  out[`${lang} testPick`] = (await p.locator("[aria-modal=true]").last().innerText()).replace(/\s+/g, " ").slice(0, 700);
  await ctx.close();
}
console.log(JSON.stringify({ out, errs }, null, 1));
await b.close();
