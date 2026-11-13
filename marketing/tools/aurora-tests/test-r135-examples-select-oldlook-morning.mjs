// r135 (her notes, Nov 11 2026):
// 1. "под календарем все еще стоит этот example… нафига мне всегда… они должны всплывать и отсплывать": an example
//    is open the first time it's on screen, then folded into "See an example"; × folds it at once; the chip opens it.
// 2. "каждое слово в приложении можно скопировать… даже иконки внизу": no text selection outside the typing fields.
// 3. "не очевидна кнопка, как… вернуться в старую версию… барашка что-то пропела, я быстро это отключила": the
//    old-look card has two answers and no ×; Settings shows the way back at the top for whoever came from the old
//    look; the old users' tour ends with it too.
// 4. "сделала сброс с утра… должны были предложить ответить за вчера, а он мне предложил за сегодня": in the daytime
//    every onboarding starts with yesterday (A/B: yesterday first and picked; C: yesterday by itself).
// Run from marketing/tools: node aurora-tests/test-r135-examples-select-oldlook-morning.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r135`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const ok = (name, cond, info = "") => { out[name] = cond ? "ok" : `FAIL ${typeof info === "string" ? info : JSON.stringify(info)}`.slice(0, 600); if (!cond) fails.push(name); };
const newPage = async (tag, opts = {}) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "en-US", ...opts });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${tag}: ${e.message}`));
  return { ctx, p };
};
const seed = async (p, { days = 1, cohort = "new", extra = {} } = {}) => {
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  await p.evaluate(async ({ days, cohort, extra }) => {
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_cohort", cohort); localStorage.setItem("memap_ab_onb", "C");
    localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order"]));
    localStorage.setItem("memap_tour_seen", "true");
    const now = new Date(); now.setHours(20, 0, 0, 0);
    const day = (k) => { const d = new Date(now); d.setDate(d.getDate() - k); return d; };
    const start = day(days - 1); start.setHours(9, 0, 0, 0);
    const got = await dz.ensureTemplates(["slept-enough", "felt-happy", "felt-stressed", "exercised"]);
    await st.saveTrackers((await st.getTrackers()).map((t) => ({ ...t, createdAt: start.toISOString() })));
    localStorage.setItem("memap_onboarded_at", start.toISOString()); localStorage.setItem("memap_path_start", dz.isoLocal(start));
    const E = []; for (let k = days - 1; k >= 0; k--) got.forEach((id, i) => E.push({ id: `e${k}-${i}`, trackerId: id, date: dz.isoLocal(day(k)), value: (i + k) % 3 === 0, createdAt: day(k).toISOString() }));
    await st.saveEntries(E);
    for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
  }, { days, cohort, extra });
  const t20 = new Date(); t20.setHours(20, 30, 0, 0);
  await p.clock.install({ time: t20 });
  await p.reload(); await p.waitForTimeout(2600);
};
const closeSheets = async (p) => { for (let i = 0; i < 3; i++) { await p.keyboard.press("Escape"); await p.waitForTimeout(450); } };

// 1. examples pop up once, then fold
{
  const { ctx, p } = await newPage("examples");
  await seed(p);
  await closeSheets(p);
  await p.locator('[data-tour="tab-patterns"]').click(); await p.waitForTimeout(2400);
  await closeSheets(p);
  await p.locator('[data-tour="calendar"]').click(); await p.waitForTimeout(1800);
  ok("first time: the example month is open", (await p.locator("[data-example=month]").count()) === 1);
  await p.locator("[data-example=month]").scrollIntoViewIfNeeded(); await p.waitForTimeout(2300);
  await p.screenshot({ path: `${D}/1-month-first-time.png` });
  ok("on screen a moment: marked as seen", await p.evaluate(() => (localStorage.getItem("memap_examples_seen") ?? "").includes("month")));
  ok("while still there, it stays open", (await p.locator("[data-example=month]").count()) === 1);
  await closeSheets(p);
  await p.locator('[data-tour="calendar"]').click(); await p.waitForTimeout(1800);
  ok("next time: no open example under the calendar", (await p.locator("[data-example=month]").count()) === 0);
  const chip = p.locator("[data-example-folded=month]");
  ok("next time: a small 'See an example' instead", (await chip.count()) === 1 && /See an example/.test(await chip.innerText()), await chip.count());
  await chip.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  await p.screenshot({ path: `${D}/2-month-folded.png` });
  await chip.click(); await p.waitForTimeout(500);
  ok("the chip opens it again", (await p.locator("[data-example=month]").count()) === 1);
  await p.locator("[data-example=month] [data-example-hide]").click(); await p.waitForTimeout(400);
  ok("× folds it at once", (await p.locator("[data-example=month]").count()) === 0 && (await p.locator("[data-example-folded=month]").count()) === 1);
  await closeSheets(p);
  // × the first time it shows
  await p.locator('[data-tour="links-card"]').click(); await p.waitForTimeout(1800);
  ok("Links: open the first time", (await p.locator("[data-example=link]").count()) === 1);
  await p.locator("[data-example=link] [data-example-hide]").click(); await p.waitForTimeout(400);
  ok("Links: × folds it", (await p.locator("[data-example=link]").count()) === 0 && (await p.locator("[data-example-folded=link]").count()) === 1);
  await closeSheets(p);
  await p.locator('[data-tour="links-card"]').click(); await p.waitForTimeout(1800);
  ok("Links: stays folded next time", (await p.locator("[data-example=link]").count()) === 0 && (await p.locator("[data-example-folded=link]").count()) === 1);
  await closeSheets(p);

  // 2. nothing to select
  const sel = await p.evaluate(() => {
    const cs = (el) => el ? getComputedStyle(el).userSelect || getComputedStyle(el).webkitUserSelect : null;
    const tab = document.querySelector('[data-tour="tab-patterns"]');
    const para = [...document.querySelectorAll("p, h1, h2, span")].find((e) => e.offsetParent && e.innerText.trim().length > 5);
    const inp = document.createElement("input"), ta = document.createElement("textarea");
    document.body.append(inp, ta);
    const r = { body: cs(document.body), tab: cs(tab), text: cs(para), input: cs(inp), textarea: cs(ta), img: getComputedStyle(document.querySelector("img") ?? document.body).webkitUserDrag };
    inp.remove(); ta.remove();
    return r;
  });
  ok("text, tabs and icons can't be selected", sel.body === "none" && sel.tab === "none" && sel.text === "none", sel);
  ok("typing fields still can", sel.input === "text" && sel.textarea === "text", sel);
  // a real attempt: triple-click a line of text, then a long drag over the tab bar
  const line = p.locator("p:visible").first();
  await line.click({ clickCount: 3 }).catch(() => {}); await p.waitForTimeout(200);
  const s1 = await p.evaluate(() => window.getSelection()?.toString() ?? "");
  const bar = await p.locator('[data-tour="tab-patterns"]').boundingBox();
  if (bar) { await p.mouse.move(5, bar.y + bar.height / 2); await p.mouse.down(); await p.mouse.move(385, bar.y + bar.height / 2, { steps: 8 }); await p.mouse.up(); }
  const s2 = await p.evaluate(() => window.getSelection()?.toString() ?? "");
  ok("triple-click and drag select nothing", s1.trim() === "" && s2.trim() === "", { s1: s1.slice(0, 80), s2: s2.slice(0, 80) });
  await ctx.close();
}

// 3. the way back to the old look
const settingsOpen = async (p) => {
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-you"))); await p.waitForTimeout(1500);
  await p.locator("[role=dialog]").last().getByRole("button", { name: /^Settings$/ }).first().click(); await p.waitForTimeout(1200);
};
const settingsCards = (p) => p.evaluate(() => [...document.querySelectorAll("[role=dialog] .settings-card")].map((c) => (c.innerText || "").replace(/\s+/g, " ").trim()));
{
  const { ctx, p } = await newPage("old");
  const today = new Date(); const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  await seed(p, { days: 20, cohort: "old", extra: { memap_upgrade_invite: "accepted", memap_old_tour_done: "2026-11-01T00:00:00.000Z", memap_tour_completed: "1" } });
  await p.evaluate((iso) => localStorage.setItem("memap_path_start", iso), iso);
  await p.reload(); await p.waitForTimeout(4200);
  const card = p.locator("[role=note]", { hasText: /Miss the old look/ });
  ok("came from the old look: the card shows", (await card.count()) === 1);
  const btns = await card.locator("button").allInnerTexts().catch(() => []);
  const closeX = await card.locator('button[aria-label="Close"]').count().catch(() => -1);
  await p.screenshot({ path: `${D}/3-old-look-card.png` });
  ok("the card asks: back or keep, no ×", btns.some((x) => /Back to the old look/.test(x)) && btns.some((x) => /Keep the new look/.test(x)) && closeX === 0, { btns, closeX });
  ok("the card says where it is later", /any time in Settings/.test(await card.innerText()), await card.innerText());
  await card.getByRole("button", { name: /Keep the new look/ }).click(); await p.waitForTimeout(500);
  ok("Keep the new look: the card goes", (await p.locator("[role=note]", { hasText: /Miss the old look/ }).count()) === 0);
  await p.reload(); await p.waitForTimeout(4200);
  ok("…and doesn't come back", (await p.locator("[role=note]", { hasText: /Miss the old look/ }).count()) === 0);
  await settingsOpen(p);
  const cards = await settingsCards(p);
  await p.screenshot({ path: `${D}/4-settings-old-user.png` });
  ok("Settings: the way back is the first line for whoever came from the old look", /^Back to the old look/.test(cards[0] ?? "") && cards.filter((c) => c.includes("Back to the old look")).length === 1, cards);
  await ctx.close();
}
{
  const { ctx, p } = await newPage("new-settings");
  await seed(p, { days: 3 });
  await closeSheets(p);
  await settingsOpen(p);
  const cards = await settingsCards(p);
  ok("Settings: for others it stays at the end", !(cards[0] ?? "").includes("Back to the old look") && (cards[cards.length - 1] ?? "").includes("Back to the old look"), cards);
  await ctx.close();
}
{
  const { ctx, p } = await newPage("old-tour");
  await seed(p, { days: 20, cohort: "old", extra: { memap_upgrade_invite: "accepted", memap_old_tour: "1" } });
  for (let i = 0; i < 3; i++) { await p.getByRole("button", { name: /^Next/ }).first().click(); await p.waitForTimeout(700); }
  const back = p.locator("[data-tour-old]");
  await p.screenshot({ path: `${D}/5-old-tour-end.png` });
  ok("the old users' tour ends with the way back", (await back.count()) === 1 && /Back to the old look/.test(await back.innerText()) && await back.isVisible());
  await back.click(); await p.waitForTimeout(1500);
  ok("…and it goes back", await p.evaluate(() => localStorage.getItem("memap_ui")) === "classic");
  await ctx.close();
}

// 4. a reset in the morning: onboarding starts with yesterday
for (const [v, lang] of [["A", "en"], ["B", "en"], ["C", "en"], ["B", "ru"]]) {
  const tag = `${v}-${lang}`;
  const { ctx, p } = await newPage(tag, { locale: lang === "ru" ? "ru-RU" : "en-US" });
  await p.clock.install({ time: new Date("2026-11-11T09:10:00") });
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  // what "Reset All Data" does: localStorage.clear(), then a reload
  await p.evaluate(([lang, v]) => { localStorage.clear(); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_theme", "aurora-light"); localStorage.setItem("memap_ab_onb", v); }, [lang, v]);
  await p.reload(); await p.waitForTimeout(2200);
  await p.evaluate(() => { window.__fc = null; window.addEventListener("memap-first-checkin", (e) => { window.__fc = e.detail; }); });
  await p.getByRole("button", { name: lang === "ru" ? /^Начать/ : /^Get started/ }).first().click(); await p.waitForTimeout(700);
  if (v === "A") { await p.getByRole("button", { name: /bothering me|повторяется и мешает/i }).click(); await p.waitForTimeout(700); }
  const isl = (re) => p.getByRole("button", { name: re }).first();
  await isl(/^Health|^Здоровье/).click(); await p.waitForTimeout(300);
  await p.locator(".onb .flex-wrap [aria-pressed=false]").first().click();
  await p.getByRole("button", { name: /^Continue|^Дальше|^Продолжить/ }).first().click(); await p.waitForTimeout(1200);
  if (v !== "C") {
    await p.getByRole("button", { name: /^Continue|^Дальше|^Продолжить/ }).first().click(); await p.waitForTimeout(900);
    await p.locator(".onb button.raised-btn").last().click(); await p.waitForTimeout(800);
    const rows = await p.locator("[role=dialog] button[aria-pressed]").evaluateAll((els) => els.map((e) => ({ text: e.innerText.split("\n")[0], on: e.getAttribute("aria-pressed") === "true" })));
    await p.screenshot({ path: `${D}/6-${tag}-day-sheet.png` });
    ok(`${tag} 09:10: yesterday first and picked`, rows.length === 2 && /Yesterday|За вчера/.test(rows[0].text) && rows[0].on && !rows[1].on, rows);
    await p.locator("[role=dialog] button.raised-btn, [role=dialog] button", { hasText: /^Continue$|^Продолжить$|^Дальше$/ }).last().click(); await p.waitForTimeout(1200);
  }
  await p.waitForTimeout(900);
  const fc = await p.evaluate(() => window.__fc);
  const pick = await p.evaluate(() => localStorage.getItem("memap_first_day_pick"));
  await p.screenshot({ path: `${D}/7-${tag}-first-answers.png` });
  ok(`${tag} 09:10: the first answers are for yesterday`, fc?.date === "2026-11-10" && pick === "yesterday", { fc, pick });
  await ctx.close();
}

console.log(JSON.stringify({ fails, out, errs }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
