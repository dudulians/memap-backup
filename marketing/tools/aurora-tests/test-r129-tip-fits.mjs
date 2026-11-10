// r129 (her note, Nov 10 2026: a late-coffee tip came "because it may affect sleep" — "у меня что, есть вопрос
// про сон? … это просто рандомные штуки?"). "Worth watching" now comes only about something that may lead to a
// question she asks — what the tip's own words are about (TIP_ABOUT in observeTips.ts) — never by island alone and
// never the first tip in the list as a filler;
// the sheet says which of her questions it is for. EN + RU, 320×568 and 390×844.
// Run from marketing/tools: node aurora-tests/test-r129-tip-fits.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r129`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const ok = (name, cond, info = "") => { out[name] = cond ? "ok" : `FAIL ${typeof info === "string" ? info : JSON.stringify(info)}`.slice(0, 600); if (!cond) fails.push(name); };

// --- the rule, 30 days per person ---
{
  const ctx = await b.newContext(); const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(1200);
  const r = await p.evaluate(async () => {
    const o = await import("/src/lib/observeTips.ts"), dz = await import("/src/lib/doors.ts"), ap = await import("/src/lib/answerPhrases.ts");
    const mk = (id) => { const f = dz.findTemplate(id); return { id: `t-${id}`, title: f.template.title, questionText: f.template.questionText, category: f.template.category, cluster: f.clusterId, archived: false, createdAt: "2026-11-01T09:00:00.000Z" }; };
    const iso = (i) => { const d = new Date(2026, 10, 10 + i); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const people = {
      none: [], bodyOnly: ["exercised"], water: ["drank-water"], love: ["argued-with-partner", "felt-happy"], headache: ["headache"],
      sleep: ["slept-enough"], lonely: ["felt-lonely"], kids: ["yelled-at-kid"], calm: ["felt-calm"],
    };
    const res = {};
    for (const [name, ids] of Object.entries(people)) {
      localStorage.removeItem("memap_observe_tip");
      const T = ids.map(mk);
      const picks = [], bad = [];
      for (let i = 0; i < 30; i++) {
        const x = o.tipForToday(T, iso(i));
        if (!x) { picks.push(null); continue; }
        const forId = o.tipFor(x.tip.id);
        const her = T.find((t) => t.id === forId);
        const herTpl = her ? ap.templateIdOf(her) : null;
        if (!herTpl || !(o.TIP_ABOUT[x.tip.templateId] || []).includes(herTpl) || ids.includes(x.tip.templateId)) bad.push({ day: i, tip: x.tip.templateId, forId });
        picks.push(`${x.tip.templateId}<-${herTpl}`);
        o.markTip(x.tip.id, "later");
      }
      res[name] = { first: picks[0], kinds: [...new Set(picks.filter(Boolean))], nulls: picks.filter((x) => x === null).length, bad };
    }
    // an old saved pick (before v129): late coffee today, not looked at yet, for someone with no sleep question
    const today = iso(0);
    localStorage.setItem("memap_observe_tip", JSON.stringify({ day: today, id: "coffee-after-2pm", used: [] }));
    const stale = o.tipForToday([mk("exercised")], today);
    // one already looked at today stays (done), whatever it was
    localStorage.setItem("memap_observe_tip", JSON.stringify({ day: today, id: "coffee-after-2pm", used: [], done: "later" }));
    const doneKept = o.tipForToday([mk("exercised")], today);
    const missing = [...new Set(Object.values(o.TIP_ABOUT).flat())].filter((q) => !dz.findTemplate(q));
    const noAbout = (await import("/src/lib/observeTipsData.ts")).OBSERVE_TIPS.filter((x) => !o.TIP_ABOUT[x.templateId]?.length).map((x) => x.templateId);
    return { missing, noAbout, res, stale: stale ? stale.tip.templateId : null, doneKept: doneKept ? `${doneKept.tip.templateId}:${doneKept.done}` : null };
  });
  out.people = Object.fromEntries(Object.entries(r.res).map(([k, v]) => [k, `${v.first} · ${v.kinds.length} kinds · ${v.nulls} empty days`]));
  ok("every question a tip is for is in the library", r.missing.length === 0, r.missing);
  ok("every tip says what it is about", r.noAbout.length === 0, r.noAbout);
  ok("no questions: no tip at all", r.res.none.nulls === 30, r.res.none);
  ok("every tip is for one of her questions (its possible cause, not her own question)", Object.values(r.res).every((v) => v.bad.length === 0), Object.fromEntries(Object.entries(r.res).map(([k, v]) => [k, v.bad])));
  ok("Body & habits alone (exercised) no longer brings late coffee", !r.res.bodyOnly.kinds.some((x) => x.startsWith("coffee-late")), r.res.bodyOnly.kinds);
  ok("drank-water alone: no tip (no tip talks about water as an outcome)", r.res.water.nulls === 30, r.res.water.kinds);
  ok("exercised alone: only workout tips (walking, hard workouts)", r.res.bodyOnly.kinds.length > 0 && r.res.bodyOnly.kinds.every((x) => /^(walked-a-lot|trained-hard)</.test(x)), r.res.bodyOnly.kinds);
  ok("a sleep question brings a sleep tip first (late coffee)", (r.res.sleep.first || "").startsWith("coffee-late<-slept-enough"), r.res.sleep.first);
  ok("a lonely question brings a people tip", r.res.lonely.kinds.some((x) => /^(saw-friends|deep-conversation|social-media-hour)</.test(x)), r.res.lonely.kinds);
  ok("an old saved coffee pick is replaced when it fits none of her questions", r.stale !== "coffee-late", r.stale);
  ok("a tip already looked at today stays as it was", r.doneKept === "coffee-late:true", r.doneKept);
  await ctx.close();
}

// --- the sheet says which question it is for ---
for (const [lang, theme, w, h] of [["en", "aurora-light", 390, 844], ["ru", "aurora-light", 320, 568], ["en", "aurora", 320, 568], ["ru", "aurora", 390, 844]]) {
  const tag = `${lang}-${theme}-${w}`;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: lang === "ru" ? "ru-RU" : "en-US" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${tag}: ${e.message}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async ({ lang, theme }) => {
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", theme);
    localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order"]));
    const now = new Date(); now.setHours(11, 0, 0, 0);
    const day = (k) => { const d = new Date(now); d.setDate(d.getDate() - k); return d; };
    const start = day(2); start.setHours(9, 0, 0, 0);
    const ids = await dz.ensureTemplates(["slept-enough", "felt-happy"]);
    await st.saveTrackers((await st.getTrackers()).map((t) => ({ ...t, createdAt: start.toISOString() })));
    localStorage.setItem("memap_onboarded_at", start.toISOString()); localStorage.setItem("memap_path_start", dz.isoLocal(start));
    localStorage.setItem("memap_door", JSON.stringify({ id: "goodSleep", trackerId: ids[0], contextTrackerIds: [], startedAt: dz.isoLocal(start) }));
    const E = []; for (const k of [2, 1]) ids.forEach((id, i) => E.push({ id: `e${k}-${i}`, trackerId: id, date: dz.isoLocal(day(k)), value: (i + k) % 2 === 0, createdAt: day(k).toISOString() }));
    await st.saveEntries(E);
  }, { lang, theme });
  const t11 = new Date(); t11.setHours(11, 0, 0, 0);
  await p.clock.install({ time: t11 });
  await p.reload(); await p.waitForTimeout(2500);
  const stop = p.locator(`[data-path-stop][aria-label="${lang === "ru" ? "Стоит понаблюдать" : "Worth watching"}"]`).first();
  if (!(await stop.count())) { ok(`${tag}: the tip step is on the path`, false, await p.$$eval("[data-path-stop]", (els) => els.map((e) => e.getAttribute("aria-label")))); await ctx.close(); continue; }
  await stop.evaluate((el) => el.scrollIntoView({ block: "center" })); await p.waitForTimeout(500);
  await stop.click(); await p.waitForTimeout(600);
  await p.getByRole("button", { name: lang === "ru" ? /^Читать$/ : /^Read$/ }).first().click(); await p.waitForTimeout(900);
  const sheet = p.locator('[role="dialog"]').last();
  const because = (await sheet.locator("[data-tip-because]").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
  const geo = await sheet.evaluate((d) => {
    const btn = [...d.querySelectorAll("button")].find((x) => /^(watch it|наблюдать)$/i.test((x.textContent || "").trim()));
    const bb = btn?.getBoundingClientRect();
    return { overflow: d.scrollWidth > d.clientWidth + 1, btnBottom: bb ? Math.round(bb.bottom) : null, vh: window.innerHeight };
  });
  await p.screenshot({ path: `${D}/${tag}-tip.png` });
  out[`${tag}.because`] = because;
  ok(`${tag}: says which question it is for`, lang === "ru" ? /^К твоему вопросу: .*(спал|поспа|сна|сон|выспа)/i.test(because) : /^For your question: .*sleep/i.test(because), because);
  ok(`${tag}: the late-coffee tip (a sleep cause)`, (await sheet.innerText()).includes(lang === "ru" ? "Кофе ближе к вечеру" : "Late coffee"), (await sheet.innerText()).slice(0, 160));
  ok(`${tag}: nothing wider than the screen, button on screen`, !geo.overflow && geo.btnBottom !== null && geo.btnBottom <= geo.vh, geo);
  await ctx.close();
}
console.log(JSON.stringify({ fails, out, errs }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
