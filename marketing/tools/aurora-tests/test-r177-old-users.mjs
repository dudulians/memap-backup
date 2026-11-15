// Her ask (Nov 15 2026): «проверять, что онбординг для старых у нас нормальный, что переход от старого к новому,
// к старому будет смузли». Someone who used 1.7.9 for two months updates: the old screens with the invite,
// "Show me", the four tour screens, Today, World, an island; then back to the old look and to the new one again.
// At every step: nothing lost (answers, notes, questions, reminder), nothing popping over anything.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r177`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const out = {}, errs = [], fails = [];
const ok = (cond, what) => { if (!cond) fails.push(what); };
const BAD = /undefined|NaN|\{\{|\b(link|tips|support|redFlags|onb7|onb8|path|upgrade|tour|islandQ|thingNow)\.[a-z]+[A-Za-z]*\b/;
const scan = async (p, where) => {
  const txt = await p.evaluate(() => document.body.innerText);
  const m = txt.match(BAD); if (m) fails.push(`text ${where}: …${txt.slice(Math.max(0, m.index - 60), m.index + 60).replace(/\s+/g, " ")}…`);
};
// everything that sits over the screen right now
const overlays = (p) => p.evaluate(() => [...document.querySelectorAll("[role=dialog], [data-top-card], .tour-ring, [data-world-ready], [data-today-next], [data-tip]")]
  .filter((el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden"; })
  .map((el) => (el.getAttribute("aria-label") || el.getAttribute("data-tip") || el.className.toString().slice(0, 40) || el.tagName) + " :: " + (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 70)));
// a step's name that runs under another light (the label of light k against every other light)
const namesUnderLights = (p) => p.evaluate(() => {
  const labels = [...document.querySelectorAll(".path-label span")].map((el) => ({ r: el.getBoundingClientRect(), n: el.textContent }));
  const lights = [...document.querySelectorAll("[data-path-stop] > *:first-child, [data-path-stop]")].map((el) => ({ r: el.getBoundingClientRect(), n: el.closest("[data-path-stop]")?.getAttribute("aria-label") }));
  const hit = (a, b) => a.left < b.right - 4 && b.left < a.right - 4 && a.top < b.bottom - 4 && b.top < a.bottom - 4;
  const out = new Set();
  labels.forEach((l) => lights.forEach((x) => { if (x.n !== l.n && hit(l.r, x.r)) out.add(`${l.n} × ${x.n}`); }));
  return [...out];
});
const snapshot = (p) => p.evaluate(() => {
  const T = JSON.parse(localStorage.getItem("memap_trackers") || "[]");
  const E = JSON.parse(localStorage.getItem("memap_entries") || "[]");
  const N = JSON.parse(localStorage.getItem("memap_notes") || "[]");
  const key = E.map((e) => `${e.trackerId}|${e.date}|${e.value}|${e.note ?? ""}|${(e.tags ?? []).join(",")}`).sort().join("\n");
  let h = 0; for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return {
    questions: T.filter((t) => !t.archived).map((t) => t.id).sort().join(","),
    rule: T.filter((t) => t.adviceAboveThreshold === "Leave work on time twice this week").map((t) => `${t.threshold}/${t.periodDays}`).join(""),
    answers: E.length, answersHash: h,
    notes: N.map((n) => n.id + ":" + n.text.length).sort().join(","),
    reminder: `${localStorage.getItem("memap_notification_enabled")}@${localStorage.getItem("memap_notification_time")}`,
  };
});
const same = (a, b0, where) => { for (const k of Object.keys(b0)) ok(a[k] === b0[k], `${where}: ${k} changed (${String(b0[k]).slice(0, 40)} → ${String(a[k]).slice(0, 40)})`); };
const shot = (p, name) => p.screenshot({ path: `${D}/${name}.png` });

for (const lang of ["en", "ru"]) {
  const W = lang === "ru"
    ? { show: /^Показать$/, sail: /Поплыли/, next: /Далее|Дальше/, old: /Вернуть старый вид/, go: /^Перейти$/, tryRow: /Попробовать новый MeMap/, you: "Ты", settings: /^Настройки$/ }
    : { show: /^Show me$/, sail: /Set sail/, next: /^Next/, old: /Back to the old look/, go: /^Switch$/, tryRow: /Try the new MeMap/, you: "You", settings: /^Settings$/ };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, timezoneId: "Asia/Dubai" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  // ---- a 1.7.9 install: two months of answers, an own question, a rule with her words, notes, a reminder
  await p.evaluate(async (lang) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); const r = g.generateDemoData("work-home");
    localStorage.clear();
    const created = new Date(Date.now() - 62 * 864e5).toISOString();
    // 1.7.9 questions had no island, no answer words, no first evening
    const T = r.newTrackers.map((t) => { const { island, words, askFrom, planKind, ...rest } = t; return { ...rest, createdAt: created }; });
    T[1] = { ...T[1], threshold: 4, periodDays: 14, adviceAboveThreshold: "Leave work on time twice this week" };
    T.push({ id: "1690000000000", title: lang === "ru" ? "Позвонила маме" : "Called my mom", category: "Connections", questionText: lang === "ru" ? "Звонила ли я маме?" : "Did I call my mom today?", answerType: "boolean", periodDays: 30, threshold: 0, problemWhen: "no", adviceAboveThreshold: "", createdAt: created });
    const E = r.newEntries.filter((e) => e.date !== iso(0)).map((e, i) => (i % 17 === 0 ? { ...e, note: "long day" } : e));
    for (let d = 1; d <= 55; d++) E.push({ id: `own-${d}`, trackerId: "1690000000000", date: iso(d), value: d % 3 === 0 });
    localStorage.setItem("memap_trackers", JSON.stringify(T));
    localStorage.setItem("memap_entries", JSON.stringify(E));
    localStorage.setItem("memap_notes", JSON.stringify([3, 11, 25].map((d) => ({ id: `n${d}`, date: iso(d), text: lang === "ru" ? "Поругались из-за денег, потом помирились" : "Argued about money, made up later", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }))));
    localStorage.setItem("memap_tour_seen", "true");
    localStorage.setItem("memap_notification_enabled", "true"); localStorage.setItem("memap_notification_time", "21:30");
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "true");
    localStorage.setItem("memap_patterns_tour_seen", "true"); localStorage.setItem("memap_first_swipe_seen", "true");
  }, lang);
  const start = await snapshot(p);
  out[`${lang} start`] = { answers: start.answers, questions: start.questions.split(",").length, notes: start.notes.split(",").length };

  // ---- 1. the update: the old screens, then the invite over them
  await p.reload(); await p.waitForTimeout(900);
  out[`${lang} ui`] = await p.evaluate(() => document.documentElement.getAttribute("data-ui"));
  ok(out[`${lang} ui`] === "classic", `${lang}: an old user should start on the old look`);
  await p.waitForTimeout(1800);
  await shot(p, `${lang}-1-classic-invite`); await scan(p, `${lang} invite`);
  out[`${lang} invite`] = (await p.locator("[role=dialog]").last().innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 200);
  ok(/\d/.test(out[`${lang} invite`]), `${lang}: the invite should show their numbers`);
  same(await snapshot(p), start, `${lang} classic`);

  // ---- 2. "Show me": the four tour screens
  await p.getByRole("button", { name: W.show }).click(); await p.waitForTimeout(2600);
  out[`${lang} ui after show`] = await p.evaluate(() => document.documentElement.getAttribute("data-ui"));
  for (let s = 0; s < 4; s++) {
    await shot(p, `${lang}-2-tour-${s + 1}`); await scan(p, `${lang} tour ${s + 1}`);
    const ov = await overlays(p);
    out[`${lang} tour ${s + 1}`] = ov.length;
    ok(ov.filter((x) => !/Here is your world|Вот твой мир|Your answers built|Твои ответы/.test(x)).length <= 1, `${lang} tour ${s + 1}: something else open: ${ov.join(" | ")}`);
    if (s < 3) { await p.getByRole("button", { name: W.next }).last().click(); await p.waitForTimeout(700); }
  }
  out[`${lang} tour 4 text`] = (await p.locator("[role=dialog]").last().innerText()).replace(/\s+/g, " ").slice(0, 160);
  await p.getByRole("button", { name: W.sail }).click(); await p.waitForTimeout(1500);

  // ---- 3. Today right after: what is on screen, and does anything pop up in the next seconds
  await shot(p, `${lang}-3-today`); await scan(p, `${lang} today`);
  out[`${lang} today overlays now`] = await overlays(p);
  await p.waitForTimeout(4000);
  await shot(p, `${lang}-3-today-4s`);
  out[`${lang} today overlays 4s`] = await overlays(p);

  // the day of the switch: only her first step, nothing pinned at the top; no step name under the next light
  out[`${lang} day0 top cards`] = await p.locator("[data-top-card]").count();
  ok(out[`${lang} day0 top cards`] === 0, `${lang}: a card is pinned over Today on the day of the switch`);
  ok(!(await p.locator("[data-tip]").filter({ hasText: /report|отчёт/i }).count()), `${lang}: the report card shows on the day of the switch`);
  out[`${lang} names under lights`] = await namesUnderLights(p);
  ok(!out[`${lang} names under lights`].length, `${lang}: a step name runs under a light: ${out[`${lang} names under lights`].join(", ")}`);
  // the next day: "Miss the old look?" at once, and her step stays in the room under it
  await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 1); localStorage.setItem("memap_ui_new_since", `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`); });
  await p.reload(); await p.waitForTimeout(1200);
  out[`${lang} day1 card`] = await p.locator("[data-top-card]").count();
  ok(out[`${lang} day1 card`] === 1, `${lang}: the old-look card should show the next day`);
  await p.waitForTimeout(1200);
  await shot(p, `${lang}-3-today-day1`);
  out[`${lang} day1 lights under the card`] = await p.evaluate(() => {
    const c = document.querySelector("[data-top-card]")?.getBoundingClientRect(); if (!c) return [];
    return [...document.querySelectorAll("[data-path-stop]")].filter((el) => { const r = el.getBoundingClientRect(); return r.bottom > c.top && r.top < c.bottom; }).map((el) => el.getAttribute("aria-label"));
  });
  ok(!out[`${lang} day1 lights under the card`].length, `${lang}: lights under the old-look card: ${out[`${lang} day1 lights under the card`].join(", ")}`);
  out[`${lang} today steps`] = await p.evaluate(() => [...document.querySelectorAll("[data-path-stop]")].map((el) => el.getAttribute("aria-label")).slice(0, 12));
  out[`${lang} keys`] = await p.evaluate(() => Object.fromEntries(["memap_ui", "memap_path_start", "memap_upgrade_invite", "memap_old_tour", "memap_old_tour_done", "memap_tour_completed", "memap_tour_world", "memap_tour_today", "memap_cohort", "memap_door"].map((k) => [k, localStorage.getItem(k)])));
  same(await snapshot(p), start, `${lang} new today`);

  // ---- 4. World, then an island
  await p.locator("nav button").nth(1).click(); await p.waitForTimeout(2400);
  await shot(p, `${lang}-4-world`); await scan(p, `${lang} world`);
  out[`${lang} world overlays`] = await overlays(p);
  // a tour may be running: walk it to the end with its own buttons
  for (let k = 0; k < 8; k++) {
    const nx = p.locator(".tour-card button, [data-tour-card] button").filter({ hasText: /Next|Got it|Done|Далее|Понятно|Готово/ }).last();
    if (!(await nx.count())) break;
    await nx.click().catch(() => {}); await p.waitForTimeout(700);
    if (k === 0) await shot(p, `${lang}-4-world-tour`);
  }
  const isl = p.locator("[data-island-tile], [data-isle], [data-island]").first();
  if (await isl.count()) {
    await isl.click({ force: true }).catch(() => {}); await p.waitForTimeout(1500);
    await shot(p, `${lang}-5-island`); await scan(p, `${lang} island`);
    out[`${lang} island text`] = (await p.locator("[role=dialog]").last().innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 300);
    ok(/Yours|Твой|Твоё|Твои/.test(out[`${lang} island text`]) && !/MeMap suggested|Предложил MeMap/.test(out[`${lang} island text`]), `${lang}: an old user's question should read as theirs`);
    await p.keyboard.press("Escape"); await p.waitForTimeout(700);
  } else out[`${lang} island`] = "no island found";
  same(await snapshot(p), start, `${lang} world`);

  // ---- 5. back to the old look from Settings
  await p.locator("nav button").nth(0).click(); await p.waitForTimeout(1200);
  await p.getByRole("button", { name: W.you, exact: true }).first().click(); await p.waitForTimeout(1200);
  await p.getByRole("button", { name: W.settings }).first().click(); await p.waitForTimeout(1400);
  await shot(p, `${lang}-6-settings`);
  out[`${lang} settings first rows`] = (await p.locator("[role=dialog]").last().innerText()).split("\n").filter(Boolean).slice(0, 6);
  await p.getByRole("button", { name: W.old }).first().click(); await p.waitForTimeout(600);
  await shot(p, `${lang}-6-settings-ask`);
  await p.getByRole("button", { name: W.go }).first().click(); await p.waitForTimeout(3000);
  out[`${lang} ui after old`] = await p.evaluate(() => document.documentElement.getAttribute("data-ui"));
  ok(out[`${lang} ui after old`] === "classic", `${lang}: Settings → old look should open the old look`);
  await shot(p, `${lang}-7-classic-again`); await scan(p, `${lang} classic again`);
  out[`${lang} classic again overlays`] = await overlays(p);
  same(await snapshot(p), start, `${lang} classic again`);

  // ---- 6. the old Settings row back to the new look: no tour again, the same path
  const pathStart = out[`${lang} keys`].memap_path_start;
  const gear = p.locator("header button, button[aria-label*='etting'], button[aria-label*='астрой']").last();
  await gear.click(); await p.waitForTimeout(1200);
  await shot(p, `${lang}-8-classic-settings`);
  await p.getByRole("button", { name: W.tryRow }).first().click(); await p.waitForTimeout(3200);
  out[`${lang} ui after new again`] = await p.evaluate(() => document.documentElement.getAttribute("data-ui"));
  await shot(p, `${lang}-9-new-again`); await scan(p, `${lang} new again`);
  out[`${lang} new again overlays`] = await overlays(p);
  out[`${lang} new again tour`] = await p.locator("[role=dialog][aria-label]").filter({ hasText: W.sail }).count();
  ok(out[`${lang} new again tour`] === 0, `${lang}: the old users' tour should not open twice`);
  ok((await p.evaluate(() => localStorage.getItem("memap_path_start"))) === pathStart, `${lang}: the path should keep its start`);
  same(await snapshot(p), start, `${lang} new again`);
  await ctx.close();
}
console.log(JSON.stringify({ fails, errs, out }, null, 1));
await b.close();
