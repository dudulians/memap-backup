// r124 (her full content-audit brief, Nov 10 2026). Content: all 36 tips have the brief's copy and a review status;
// tips 6 (hobby) and 33 (IBS) are held and never picked; no 2 pm / four-cup / 7,000-step / 400 mg numbers in the copy;
// RU gender-free. UI: the tip sheet has no source line and no gap where it was, fits 320×568 and 390×844, light and
// dark; the general health note is in Settings → Help. EN + RU.
// Run from marketing/tools: node aurora-tests/test-r124-tips-audit.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r124`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const ok = (name, cond, info = "") => { out[name] = cond ? "ok" : `FAIL ${typeof info === "string" ? info : JSON.stringify(info)}`.slice(0, 500); if (!cond) fails.push(name); };

const TITLES = ["Late coffee", "Same wake-up time", "Worries at bedtime", "Morning daylight", "Sleep and mood", "Time for a hobby", "Time in nature",
  "Noticing good moments", "Water through the day", "Drained days", "Daytime naps", "Alcohol in the evening", "Several coffees a day",
  "Skipped meals and headaches", "Meals before bed", "Walking more", "Workouts and mood", "Hard workouts and sleep", "Screens before sleep",
  "Time on social media", "Too much news", "Stress that lingers", "Constant interruptions", "Drained after work", "A few calm minutes",
  "Seeing people in person", "Real conversations", "Arguments after bad nights", "Help with the kids", "Painkiller days", "Neck pain and migraine",
  "Headaches and periods", "Stress and your stomach", "Nicotine and sleep", "Putting things off", "Less coffee than usual"];

// --- content ---
{
  const ctx = await b.newContext(); const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(1200);
  const c = await p.evaluate(async () => {
    const d = await import("/src/lib/observeTipsData.ts"), o = await import("/src/lib/observeTips.ts");
    const T = d.OBSERVE_TIPS;
    // 60 days of picks for someone with no questions: held tips never come
    const picks = new Set();
    for (let i = 0; i < 60; i++) { const day = new Date(2026, 10, 10 + i); const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`; const r = o.tipForToday([], iso); if (r) { picks.add(r.tip.templateId); o.markTip(r.tip.id, "later"); } }
    return { n: T.length, titles: T.map((x) => x.en.title), reviewed: T.filter((x) => x.review?.status).length, held: T.filter((x) => x.review?.status === "held").map((x) => x.templateId),
      sources: T.every((x) => x.source?.name && x.source?.url), en: T.map((x) => `${x.en.title}. ${x.en.line}`).join(" | "), ru: T.map((x) => `${x.ru.title}. ${x.ru.line}`).join(" | "), picks: [...picks] };
  });
  ok("36 tips, in order, with the brief's titles", c.n === 36 && c.titles.join("|") === TITLES.join("|"), c.titles.filter((x, i) => x !== TITLES[i]));
  ok("every tip has a review status and keeps its source inside", c.reviewed === 36 && c.sources, { reviewed: c.reviewed, sources: c.sources });
  ok("tips 6 and 33 are held", c.held.join() === "hobby-time,stomach-issues", c.held);
  ok("held tips are never picked (60 days)", !c.picks.includes("hobby-time") && !c.picks.includes("stomach-issues") && c.picks.length >= 30, c.picks.length);
  ok("no 2 pm / four-cup / 7,000-step / 400 mg numbers in the copy", !/\b2 ?pm\b|14:00|four cups|4 cups|7,?000|400 ?mg/i.test(c.en + c.ru), (c.en + c.ru).match(/\b2 ?pm\b|14:00|four cups|4 cups|7,?000|400 ?mg/i));
  ok("no cause words (proves / will improve / causes)", !/\bproves?\b|will improve|\bcauses\b/i.test(c.en), c.en.match(/\bproves?\b|will improve|\bcauses\b/i));
  ok("RU copy is gender-free", !/\((а|ась|ла|ой)\)/.test(c.ru), c.ru.match(/\S+\((а|ась|ла|ой)\)/));
  await ctx.close();
}

// --- UI: the tip sheet, sizes, themes ---
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
    const ids = await dz.ensureTemplates(["migraine", "slept-enough", "felt-stressed", "skipped-meal", "drank-water", "exercised", "saw-friends", "screens-before-bed"]);
    await st.saveTrackers((await st.getTrackers()).map((t) => ({ ...t, createdAt: start.toISOString() })));
    localStorage.setItem("memap_onboarded_at", start.toISOString()); localStorage.setItem("memap_path_start", dz.isoLocal(start));
    localStorage.setItem("memap_door", JSON.stringify({ id: "migraine", trackerId: ids[0], contextTrackerIds: [], startedAt: dz.isoLocal(start) }));
    const E = []; for (const k of [2, 1]) ids.forEach((id, i) => E.push({ id: `e${k}-${i}`, trackerId: id, date: dz.isoLocal(day(k)), value: (i + k) % 3 === 0, createdAt: day(k).toISOString() }));
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
  const text = (await sheet.innerText()).replace(/\s+/g, " ");
  const geo = await sheet.evaluate((d) => {
    const q = [...d.querySelectorAll(".surface")].pop(); const btn = [...d.querySelectorAll("button")].find((x) => /^(watch it|наблюдать)$/i.test((x.textContent || "").trim()));
    const qb = q?.getBoundingClientRect(), bb = btn?.getBoundingClientRect();
    return { gap: qb && bb ? Math.round(bb.top - qb.bottom) : null, overflow: d.scrollWidth > d.clientWidth + 1, btnBottom: bb ? Math.round(bb.bottom) : null };
  });
  await p.screenshot({ path: `${D}/${tag}-tip.png` });
  ok(`${tag}: no source line`, !/Source:|Источник:|doi\.org/.test(text) && (await sheet.locator("a[href]").count()) === 0, text.slice(-200));
  ok(`${tag}: no gap where the source was`, geo.gap !== null && geo.gap <= 40, geo);
  ok(`${tag}: nothing wider than the screen`, !geo.overflow, geo);
  out[`${tag}.text`] = text.slice(0, 260);
  await ctx.close();
}

// --- the general health note in Settings → Help ---
for (const lang of ["en", "ru"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: lang === "ru" ? "ru-RU" : "en-US" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${lang} settings: ${e.message}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate((lang) => { localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1"); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_onboarded_at", new Date().toISOString()); localStorage.setItem("memap_path_start", "2026-11-01"); }, lang);
  await p.reload(); await p.waitForTimeout(2200);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-you"))); await p.waitForTimeout(1600);
  await p.locator("[role=dialog]").last().getByRole("button", { name: lang === "ru" ? /Настройки/ : /^Settings$/ }).first().click().catch(() => {}); await p.waitForTimeout(1200);
  await p.getByRole("button", { name: lang === "ru" ? /^Помощь/ : /^Help/ }).first().click().catch(() => {}); await p.waitForTimeout(1000);
  const note = (await p.locator("[data-health-note]").innerText().catch(() => "")).trim();
  await p.screenshot({ path: `${D}/${lang}-settings-help.png` });
  ok(`${lang}: the health note in Settings → Help`, lang === "ru" ? note.startsWith("MeMap помогает замечать закономерности") && note.includes("не ставит медицинских диагнозов") : note.startsWith("MeMap helps you notice patterns") && note.includes("doesn't diagnose medical conditions"), note);
  await ctx.close();
}
console.log(JSON.stringify({ fails, out, errs }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
