// r118 (Nov 10 2026, her note: "drained" 20 days, slept well 20 days, and MeMap says "try to sleep better" — "вы
// дебилы, я же отмечал, что сплю хорошо, откуда эта рекомендация?"). A change her own answers say she already does is
// never offered, and a plan that is one says so on its card. EN and RU.
//  1. drained often, sleeps well: "Go to bed by 23:00" is not among the changes ("Not for me" sheet, the test picker);
//  2. heartburn often, never eats late: the card's plan "Finish dinner 3 hours before bed" says "you already do this".
// Run from marketing/tools:  node aurora-tests/test-r118-already-doing.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r118`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const ok = (name, cond, info = "") => { out[name] = !!cond; if (!cond) fails.push(`${name} ${typeof info === "string" ? info : JSON.stringify(info)}`.trim()); };

for (const lang of ["en", "ru"]) {
  const W = lang === "ru"
    ? { bed: "Ложиться спать до 23:00", walk: "Гулять 20 минут", already: /^По твоим ответам ты это уже делаешь: (\d+) из последних \1 ответов\.$/, notForMe: /^Не моё$|^Не для меня$/, drained: /нет сил|усталост|выжат/i, heart: /изжог/i }
    : { bed: "Go to bed by 23:00", walk: "Walk for 20 minutes", already: /^Your answers say you already do this: (\d+) of your last \1 answers\.$/, notForMe: /^Not for me$/, drained: /drained|exhausted/i, heart: /heartburn/i };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: "Europe/London" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  let n = 0; const shot = async (name) => { await p.waitForTimeout(500); await p.screenshot({ path: `${D}/${lang}-already-${String(++n).padStart(2, "0")}-${name}.png` }); };
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  const ids = await p.evaluate(async (lang) => {
    localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order"])); localStorage.setItem("memap_tour_seen", "true");
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" })); localStorage.setItem("memap_tour_completed", "1"); localStorage.setItem("memap_first_link_seen", "before");
    localStorage.setItem("memap_ab_onb", "A");
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    const [drained, sleep, heart, late] = await dz.ensureTemplates(["felt-fatigued", "slept-enough", "heartburn", "ate-late"]);
    const E = [];
    for (let d = 1; d <= 30; d++) {
      E.push({ id: `d-${d}`, trackerId: drained, date: dz.daysAgoIso(d), value: d % 3 !== 0 }); // drained 20 of 30
      E.push({ id: `s-${d}`, trackerId: sleep, date: dz.daysAgoIso(d), value: true });         // slept 7+ every night
      E.push({ id: `h-${d}`, trackerId: heart, date: dz.daysAgoIso(d), value: d % 2 === 0 });  // heartburn often
      E.push({ id: `l-${d}`, trackerId: late, date: dz.daysAgoIso(d), value: false });         // never ate late
    }
    await st.saveEntries(E);
    localStorage.setItem("memap_path_start", dz.daysAgoIso(30));
    localStorage.setItem("memap_door", JSON.stringify({ id: "energy", trackerId: drained, contextTrackerIds: [], startedAt: dz.daysAgoIso(30) }));
    return { drained, sleep, heart, late };
  }, lang);
  await p.reload(); await p.waitForTimeout(2500);

  // the rule itself, through the app's own function
  const logic = await p.evaluate(async () => {
    const a = await import("/src/lib/alreadyDoing.ts"), st = await import("/src/lib/storage.ts");
    const T = await st.getTrackers(), E = await st.getEntries();
    return { bed23: a.alreadyDoing("bed23", T, E), walk20: a.alreadyDoing("walk20", T, E), dinnerEarly: a.alreadyDoing("dinnerEarly", T, E) };
  });
  out[`${lang}.logic`] = logic;
  ok(`${lang}.0 sleeps well: bed by 23:00 counts as done`, !!logic.bed23 && logic.bed23.k === logic.bed23.n && logic.bed23.n >= 5, logic.bed23);
  ok(`${lang}.0 no walk question: walking isn't judged`, logic.walk20 === null, logic.walk20);

  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "signals", back: true } })));
  await p.waitForTimeout(2200);
  await shot("act");
  const card = (re) => p.locator("[role=dialog] div.surface.scroll-mt-4", { hasText: re }).first();

  // 2. heartburn: the plan is done already, the card says so
  const heart = card(W.heart);
  ok(`${lang}.2 heartburn card lit`, (await heart.count()) > 0);
  const already = (await heart.locator("[data-already]").innerText().catch(() => "")).trim();
  out[`${lang}.heartLine`] = already;
  ok(`${lang}.2 the card says it's done already`, W.already.test(already), already);
  const tryLabel = (await heart.locator("button.raised-btn").last().innerText().catch(() => "")).trim();
  ok(`${lang}.2 its button offers another change`, tryLabel === (lang === "ru" ? "Попробовать другое" : "Try another change"), tryLabel);

  // 1. drained: "Not for me" → no bedtime among the changes
  const dr = card(W.drained);
  ok(`${lang}.1 drained card lit`, (await dr.count()) > 0);
  await dr.locator("button[aria-expanded]").click(); await p.waitForTimeout(700);
  const nfm = dr.getByRole("button", { name: W.notForMe });
  if (await nfm.count()) {
    await nfm.first().click(); await p.waitForTimeout(1400);
    await shot("instead");
    const sheet = (await p.locator("[role=dialog]").last().innerText()).replace(/\s+/g, " ");
    out[`${lang}.instead`] = sheet.slice(0, 500);
    ok(`${lang}.1 "Not for me": no bedtime change`, !sheet.includes(W.bed), sheet.slice(0, 300));
    ok(`${lang}.1 "Not for me": other changes still there`, sheet.includes(W.walk), sheet.slice(0, 300));
  } else ok(`${lang}.1 "Not for me" button`, false);
  await ctx.close();
}
console.log(JSON.stringify({ fails, out, errs }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
