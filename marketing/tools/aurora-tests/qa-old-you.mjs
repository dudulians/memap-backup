// QA (old user): You, settings, language live switch, How MeMap works, old look and back, Notes,
// Today steps, support + red flags, the report sheet and its pages. Usage: node aurora-tests/qa-old-you.mjs en aurora-light
import { writeFileSync } from "fs";
import { launch, page, seed, shooter, installHelpers, toWorld, toSection, esc, ev, buttons, clickText, log, ROOT } from "./qa-old-lib.mjs";
const lang = process.argv[2] ?? "en", theme = process.argv[3] ?? "aurora-light";
const dir = `you-${lang}-${theme === "aurora" ? "night" : "day"}`;
const RU = lang === "ru";
const b = await launch();
const { ctx, p, errs } = await page(b, { lang });
await installHelpers(p);
const info = await seed(p, { lang, theme });
const { shot, text, save, scrollShots } = shooter(p, dir);
const step = async (name, fn) => { try { await fn(); } catch (e) { log(dir, { [`FAIL ${name}`]: e.message.slice(0, 300) }); } };
const BAD = /undefined|NaN|\{\{|\b[a-z]+\.[a-z]+[A-Z][A-Za-z]*\b/;
const scan = async (where) => { const t = await p.evaluate(() => document.body.innerText); const m = t.match(BAD); if (m) log(dir, { [`BAD ${where}`]: t.slice(Math.max(0, m.index - 80), m.index + 80).replace(/\s+/g, " ") }); if (RU) { const lat = t.split("\n").filter((l) => /[A-Za-z]{4,}/.test(l) && !/MeMap|PDF|Malu|GP/.test(l)); if (lat.length) log(dir, { [`LATIN in RU ${where}`]: lat.slice(0, 15) }); } };

// ---------- Today ----------
await step("today", async () => {
  await shot("today"); await scan("today");
  // tap "My step" pill
  const my = await clickText(p, RU ? /Мой шаг/ : /My step/, null); log(dir, { myStep: my }); await p.waitForTimeout(1200); await shot("today-my-step"); await scan("today my step");
  // the step labels on today's part
  log(dir, { todayButtons: await buttons(p, "main") });
  // tap "Write a note" step
  const note = await clickText(p, RU ? /Написать заметку|заметк/i : /Write a note/, null); log(dir, { noteStep: note }); await p.waitForTimeout(1300);
  await shot("today-note-step"); await text("today note step"); await esc(p, 1);
  // tap "Time to act" step
  const act = await clickText(p, RU ? /Пора действовать|Когда действовать/ : /Time to act/, null); log(dir, { actStep: act }); await p.waitForTimeout(1500);
  await shot("today-time-to-act"); await text("today time to act"); await esc(p, 2);
  await p.reload(); await p.waitForTimeout(2500);
  const h = await clickText(p, RU ? /Твоя догадка|Догадка|догадк/i : /Your hunch/, null); log(dir, { hunchStep: h }); await p.waitForTimeout(1500);
  await shot("today-hunch"); await text("today hunch"); await scrollShots("today-hunch", 3); await esc(p, 2);
  await p.reload(); await p.waitForTimeout(2500);
  const r = await clickText(p, RU ? /Отчёт недели|Отчет недели/ : /Week report/, null); log(dir, { weekReport: r }); await p.waitForTimeout(1500);
  await shot("today-week-report"); await text("today week report"); await scrollShots("today-week-report", 4); await esc(p, 2);
});
// ---------- the evening: answer mood questions to reach "Need to talk?" ----------
await step("evening", async () => {
  await p.reload(); await p.waitForTimeout(2500);
  // start the Mind & mood step
  const s = await clickText(p, RU ? /Голова и настроение|Разум и настроение|Настроение/ : /^Mind & mood$/, null); log(dir, { moodStep: s });
  await p.waitForTimeout(1500); await shot("evening-mood-start"); await text("evening mood start");
  for (let k = 0; k < 10; k++) {
    const chip = p.getByRole("button", { name: RU ? /Хочется поговорить\?/ : /Need to talk\?/ });
    if (await chip.count()) {
      await shot(`evening-q-with-chip`);
      await chip.first().click(); await p.waitForTimeout(1300); await shot("support-sheet"); await text("support sheet"); await scrollShots("support-sheet", 3);
      await esc(p, 1); break;
    }
    const no = p.getByRole("button", { name: RU ? /^Нет$/ : /^No$/ });
    if (!(await no.count())) break;
    await shot(`evening-q${k}`, { wait: 300 });
    await no.last().click(); await p.waitForTimeout(800);
  }
  await esc(p, 2);
  // body step for the red flags chip
  await p.reload(); await p.waitForTimeout(2500);
  await clickText(p, RU ? /^Здоровье$/ : /^Health$/, null); await p.waitForTimeout(1500);
  for (let k = 0; k < 10; k++) {
    const chip = p.getByRole("button", { name: RU ? /Когда к врачу|врач/i : /When to see a doctor|doctor/i });
    if (await chip.count()) { await shot("evening-q-flag-chip"); await chip.first().click(); await p.waitForTimeout(1300); await shot("redflags-sheet"); await text("red flags sheet"); await scrollShots("redflags-sheet", 4); await esc(p, 1); break; }
    const no = p.getByRole("button", { name: RU ? /^Нет$/ : /^No$/ });
    if (!(await no.count())) break;
    await shot(`evening-h${k}`, { wait: 300 }); await text(`evening h${k}`);
    await no.last().click(); await p.waitForTimeout(800);
  }
  await shot("evening-after-health"); await text("evening after health");
  await esc(p, 2);
});
// ---------- Notes ----------
await step("notes", async () => {
  await ev(p, "memap-open-notes", {}); await p.waitForTimeout(1800);
  await shot("notes"); await text("notes"); await scan("notes"); await scrollShots("notes", 3);
  log(dir, { notesButtons: await buttons(p, "main") });
  await esc(p, 1);
});
// ---------- You ----------
await step("you", async () => {
  await ev(p, "memap-open-you", {}); await p.waitForTimeout(1500);
  await shot("you"); await text("you"); await scan("you"); log(dir, { youButtons: await buttons(p) });
  await scrollShots("you", 6);
  // How MeMap works
  await p.evaluate(() => { const s = window.__qaScroller(); if (s) s.scrollTop = 0; });
  await clickText(p, RU ? /Как устроен MeMap|Как работает MeMap/ : /How MeMap works/); await p.waitForTimeout(1300);
  await shot("how"); await text("how it works"); await scrollShots("how", 6); await esc(p, 1);
  // a treasure tap
  await ev(p, "memap-open-you", {}); await p.waitForTimeout(1200);
  const tr = await clickText(p, RU ? /Воздушный шар|Шар/ : /Balloon/); log(dir, { treasureTap: tr }); await p.waitForTimeout(1000);
  await shot("you-treasure-tap"); await text("you treasure tap"); await esc(p, 2);
});
// ---------- Settings + language live ----------
await step("settings", async () => {
  await ev(p, "memap-open-you", {}); await p.waitForTimeout(1200);
  await clickText(p, RU ? /^Настройки$/ : /^Settings$/); await p.waitForTimeout(1300);
  await shot("settings"); await text("settings"); await scan("settings"); log(dir, { settingsButtons: await buttons(p) });
  await scrollShots("settings", 6);
  // language screen
  await p.evaluate(() => { const s = window.__qaScroller(); if (s) s.scrollTop = 0; });
  await clickText(p, RU ? /^Язык/ : /^Language/); await p.waitForTimeout(1000);
  await shot("settings-language"); await text("settings language"); log(dir, { langButtons: await buttons(p) });
  await clickText(p, RU ? /English/ : /Русский/); await p.waitForTimeout(2000);
  await shot("settings-after-switch"); await text("settings after switch"); await scan("settings after switch");
  await esc(p, 3); await p.waitForTimeout(800);
  // everything follows?
  await shot("today-after-switch"); await text("today after switch");
  await toWorld(p); await shot("world-after-switch"); await text("world after switch");
  for (const s of ["overview", "findings", "signals"]) { await toSection(p, s); await shot(`after-switch-${s}`); await text(`after switch ${s}`); await esc(p, 1); }
  await p.evaluate(() => document.querySelector("[data-tour=helps]")?.click()); await p.waitForTimeout(1300); await shot("after-switch-helps"); await text("after switch helps"); await esc(p, 1);
  await ev(p, "memap-open-island", { island: "health" }); await p.waitForTimeout(1500); await shot("after-switch-island"); await text("after switch island"); await scrollShots("after-switch-island", 5); await esc(p, 1);
  // switch back
  await ev(p, "memap-open-you", {}); await p.waitForTimeout(1200);
  await clickText(p, /^(Settings|Настройки)$/); await p.waitForTimeout(1200);
  await clickText(p, /^(Language|Язык)/); await p.waitForTimeout(800);
  await clickText(p, RU ? /Русский/ : /English/); await p.waitForTimeout(1500);
  await esc(p, 3);
});
// ---------- Old look and back ----------
await step("old look", async () => {
  await ev(p, "memap-open-you", {}); await p.waitForTimeout(1200);
  await clickText(p, /^(Settings|Настройки)$/); await p.waitForTimeout(1200);
  await p.evaluate(() => { const s = window.__qaScroller(); if (s) s.scrollTop = 99999; }); await p.waitForTimeout(500);
  await shot("settings-bottom");
  const old = await clickText(p, RU ? /Вернуть старый вид|старый вид/i : /Back to the old look/); log(dir, { oldLookTap: old });
  await p.waitForTimeout(2500); await shot("old-look-1"); await text("old look 1"); await scan("old look");
  log(dir, { uiAfterOld: await p.evaluate(() => localStorage.getItem("memap_ui")) });
  // confirm dialog, if any
  const conf = await p.evaluate(() => [...document.querySelectorAll("[role=dialog], [role=alertdialog]")].pop()?.innerText.slice(0, 300));
  log(dir, { oldConfirm: conf });
  const navs = await p.locator("nav button").count();
  for (let i = 0; i < navs; i++) { await p.locator("nav button").nth(i).click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(1500); await shot(`old-tab${i}`); await scan(`old tab${i}`); }
  // back to the new: settings → Try the new MeMap
  const gear = await clickText(p, /settings|настройки/i, null); log(dir, { oldGear: gear }); await p.waitForTimeout(1300);
  await shot("old-settings"); await text("old settings");
  await p.evaluate(() => { const s = window.__qaScroller(); if (s) s.scrollTop = 99999; }); await p.waitForTimeout(400); await shot("old-settings-bottom");
  const back = await clickText(p, RU ? /Попробовать новый|новый MeMap/i : /Try the new MeMap/); log(dir, { tryNewTap: back });
  await p.waitForTimeout(2500); await shot("new-again"); await text("new again");
  const conf2 = await p.evaluate(() => [...document.querySelectorAll("[role=dialog], [role=alertdialog]")].pop()?.innerText.slice(0, 400));
  log(dir, { newConfirm: conf2, uiAfterNew: await p.evaluate(() => localStorage.getItem("memap_ui")) });
  await scrollShots("new-again", 3);
});
// ---------- Report ----------
await step("report", async () => {
  await p.evaluate(() => { localStorage.setItem("memap_ui", "new"); }); await p.reload(); await p.waitForTimeout(2500);
  await ev(p, "memap-doctor-report", {}); await p.waitForTimeout(1500);
  await shot("report-sheet"); await text("report sheet"); log(dir, { reportButtons: await buttons(p) });
  await scrollShots("report-sheet", 6);
  // open the first island list
  await p.evaluate(() => { const s = window.__qaScroller(); if (s) s.scrollTop = 0; });
  const isl = p.locator("[role=dialog] button[aria-expanded]").first(); if (await isl.count()) { await isl.evaluate((e) => e.click()); await p.waitForTimeout(500); }
  await text("report sheet island open"); await scrollShots("report-island-open", 6);
  // pages
  const dump = (audience, kind, days) => p.evaluate(async ({ audience, kind, days, lang }) => {
    const r = await import("/src/lib/doctorReport.ts"), s = await import("/src/lib/storage.ts"), n = await import("/src/lib/notes.ts");
    const trackers = await s.getTrackers(), entries = await s.getEntries();
    const off = new Set(JSON.parse(localStorage.getItem("memap_report_off") ?? "[]"));
    const ids = r.reportQuestions(trackers, entries, days, audience).flatMap((g) => g.qs.map((x) => x.q.id)).filter((id) => !off.has(id));
    return r.drawReport({ trackers, entries, notes: await n.getNotes(), audience, kind, ids, mainIds: r.reportMainIds(), days, withNotes: true, name: audience === "me" ? "" : lang === "ru" ? "Ульяна" : "Uliana", daysLabel: lang === "ru" ? "Дни с мигренью" : "Your migraine days" });
  }, { audience, kind, days, lang });
  const runs = RU ? [["doctor", "short", 28], ["me", "full", 28]] : [["doctor", "short", 28], ["doctor", "full", 91], ["me", "short", 28], ["therapist", "full", 28]];
  for (const [a, k, d] of runs) { const pages = await dump(a, k, d); log(dir, { [`pages ${a}-${k}-${d}`]: pages.length }); pages.forEach((u, i) => writeFileSync(`${ROOT}/${dir}/report-${a}-${k}-${d}-p${i + 1}.jpg`, Buffer.from(u.split(",")[1], "base64"))); }
});

// ---------- a new test on an island that already has one ----------
await step("replace test", async () => {
  await p.reload(); await p.waitForTimeout(2200);
  const before = await p.evaluate(() => JSON.parse(localStorage.getItem("memap_experiments")).filter((e) => !e.reviewed).map((e) => `${e.island}:${e.change}`));
  await toWorld(p);
  await p.evaluate(() => document.querySelector("[data-tour=helps]")?.click()); await p.waitForTimeout(1300);
  await clickText(p, RU ? /изменени/i : /Test one change/); await p.waitForTimeout(1300);
  // Health is preselected; pick the third idea
  const picked = await p.evaluate(() => { const d = [...document.querySelectorAll("[role=dialog]")].pop(); const bs = [...d.querySelectorAll("button")].filter((x) => x.querySelector("span") && x.textContent.trim().length > 12); bs[2]?.click(); return bs.map((x) => x.textContent.trim()); });
  await p.waitForTimeout(600); await shot("replace-picked"); await text("replace picked");
  await clickText(p, RU ? /^Начать$/ : /^Start$/); await p.waitForTimeout(1500);
  await shot("replace-after-start"); await text("replace after start"); log(dir, { afterStartButtons: await buttons(p) });
  await scrollShots("replace-after-start", 3);
  const after = await p.evaluate(() => JSON.parse(localStorage.getItem("memap_experiments")).filter((e) => !e.reviewed).map((e) => `${e.island}:${e.change}`));
  log(dir, { replace: { picked, before, after } });
});

save();
log(dir, { errs: errs.filter((e) => !/InAppReview/.test(e)) });
console.log(JSON.stringify({ errs: errs.filter((e) => !/InAppReview/.test(e)).slice(0, 10) }, null, 1));
await ctx.close(); await b.close();
