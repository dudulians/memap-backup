// r120 (her note, Nov 10 2026: "свайпнула, что поссорилась, внизу мелко написано, что смогу добавить причину позже,
// а ничего не вышло… не понимаю, где их добавлять"). On a busy day (last week's report, a finished test, a lit rule:
// the three extras of the day) a fight answered "yes" today still gets its "Why?" step on the path, and the deck's
// line says where it is. EN + RU. Run from marketing/tools: node aurora-tests/test-r120-why-busy-day.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r120`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const ok = (name, cond, info = "") => { out[name] = cond ? "ok" : `FAIL ${typeof info === "string" ? info : JSON.stringify(info)}`.slice(0, 500); if (!cond) fails.push(name); };
const cardNow = (p) => p.evaluate(() => [...document.querySelectorAll("p")].filter((x) => x.className.includes("[text-wrap:balance]") && x.className.includes("font-bold") && !x.closest('[aria-hidden="true"]')).map((x) => x.textContent.trim()).pop() ?? null);

for (const lang of ["en", "ru"]) {
  const RU = lang === "ru";
  const W = RU ? { yes: /^Да$/, no: /^Нет$/, fightQ: /ссор/i, line: "Ссора: причину можно добавить потом — шаг «Почему?» на пути.", step: "Почему?" }
    : { yes: /^Yes$/, no: /^No$/, fightQ: /fight|argument/i, line: "Fight: you can add the reason later — “Why?” on your path.", step: "Why?" };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: "Asia/Dubai", locale: RU ? "ru-RU" : "en-US" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  await p.clock.install({ time: new Date(2026, 10, 10, 20, 0, 0) });
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(900);
  const ids = await p.evaluate(async (lang) => {
    localStorage.clear();
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1");
    localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order"])); localStorage.setItem("memap_avatar", "11_otter");
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" })); localStorage.setItem("memap_first_link_seen", "before");
    const days = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09"];
    localStorage.setItem("memap_fill_card_hidden", JSON.stringify([...days, "2026-11-10"]));
    const seen = []; for (const isl of ["health", "body", "me", "love", "work", "world", "kids", "pet", "parents"]) for (let k = 0; k <= 4; k++) seen.push(`${isl}:${k}`);
    localStorage.setItem("memap_grow_seen", JSON.stringify(seen));
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    const [fight, head, sleep] = await dz.ensureTemplates(["argued-with-partner", "headache", "slept-enough"]);
    const at = new Date("2026-11-02T09:00:00").toISOString();
    // a rule on headaches that is reached: "When to act" is on the path
    await st.saveTrackers((await st.getTrackers()).map((t) => ({ ...t, createdAt: at, ...(t.id === head ? { threshold: 3, periodDays: 7, problemWhen: "yes" } : {}) })));
    localStorage.setItem("memap_onboarded_at", at); localStorage.setItem("memap_path_start", "2026-11-02");
    localStorage.setItem("memap_door", JSON.stringify({ id: "fights", trackerId: fight, contextTrackerIds: [], startedAt: "2026-11-02" }));
    const E = [];
    for (const d of days) {
      const c = new Date(`${d}T21:00:00`).toISOString();
      E.push({ id: `${d}-f`, trackerId: fight, date: d, value: false, createdAt: c }, { id: `${d}-h`, trackerId: head, date: d, value: true, createdAt: c }, { id: `${d}-s`, trackerId: sleep, date: d, value: true, createdAt: c });
    }
    await st.saveEntries(E);
    // a test whose two weeks are over: "See how it went" is on the path
    localStorage.setItem("memap_experiments", JSON.stringify([{ id: "x-1", island: "body", trackerId: sleep, change: "Go to bed at the same time", start: "2026-10-20" }]));
    return { fight, head, sleep };
  }, lang);
  await p.reload(); await p.waitForTimeout(2600);
  const model = () => p.evaluate(async () => {
    const ps = await import("/src/lib/pathSteps.ts"), st = await import("/src/lib/storage.ts");
    return ps.pathModel(await st.getTrackers(), await st.getEntries()).steps.map((s) => `${s.id}${s.done ? "+" : ""}`);
  });
  const before = await model();
  out[`${lang}.before`] = before.join(" ");
  ok(`${lang}: a busy day — report, test and act are on the path`, ["report", "test", "act"].every((k) => before.includes(k)), before);

  // the deck: "Yes" to the fight, "No" to the rest
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-session"))); await p.waitForTimeout(1600);
  for (let i = 0; i < 6; i++) {
    const q = await cardNow(p);
    if (!q) break;
    if (W.fightQ.test(q)) {
      await p.getByRole("button", { name: W.yes }).last().tap(); await p.waitForTimeout(700);
      const line = (await p.locator("p[data-why-later][role=status]").first().innerText().catch(() => "")).trim();
      ok(`${lang}: the deck says where to add the reason`, line === W.line, line);
      await p.screenshot({ path: `${D}/${lang}-why-1-deck-line.png` });
    } else {
      await p.getByRole("button", { name: W.no }).last().tap(); await p.waitForTimeout(800);
    }
  }
  await p.waitForTimeout(800);
  const cont = p.getByRole("button", { name: RU ? /^Дальше$/ : /^Continue$/ }).last();
  if (await cont.count()) { await cont.tap(); await p.waitForTimeout(2200); }
  const after = await model();
  out[`${lang}.after`] = after.join(" ");
  ok(`${lang}: the "Why?" step is on the path`, after.includes("why"), after);
  const stop = await p.locator(`[data-path-stop][aria-label="${W.step}"]`).count();
  ok(`${lang}: and on the screen`, stop > 0, String(stop));
  if (stop) { await p.locator(`[data-path-stop][aria-label="${W.step}"]`).first().evaluate((el) => el.scrollIntoView({ block: "center" })); await p.waitForTimeout(800); }
  await p.screenshot({ path: `${D}/${lang}-why-2-path.png` });
  await ctx.close();
}
console.log(JSON.stringify({ fails, out, errs }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
