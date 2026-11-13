// r98 (Nov 10 2026, her answer Nov 9: "давай… чтоб они не усложняли само приложение, можно скипать, может отдельно
// шагом сделать? … сможешь добавить причину позже … и чтоб это где-то ещё хранилось, как заметки"): "Why?" reasons.
// A. Path start Mon Nov 2; week 1 answered Mon, Tue, Wed, Thu, Sat; fights on Tue (money), Thu (money, chores) and Sat
//    (no reasons); a headache on Mon Nov 9 (no reasons); the partner raised their voice on Sat. Today Tue Nov 10, 20:00:
//    - the deck: "Yes" to the fight card → "Fight: you can add the reason later." under the buttons; "Yes" to the partner card →
//      no such line (no reasons for the partner-harm questions); after that partner "yes" the Done card doesn't say it (C: it does);
//    - the path: a "Why?" step (Fight · Headache) → its sheet lists Today · Fight, Yesterday · Headache, Saturday ·
//      Fight (never the partner card); the headache chips are the research ones (no screens, alcohol, weather);
//      chips + a few words → Save: tags on the answers, the words a note on that day, the step done;
//    - Notes: "Reasons" with the chips and the words (not twice), a row opens the same sheet to change it;
//    - last week's report: "Fights — most often: money (3 of 3)";
//    - the calendar day (Patterns → My days): the fight's chips right there, a tap saves.
// B. Skip: a fight today, "Why?" → Skip (EN from the path's card, RU from the sheet) → done, skipped; not asked again
//    after a reload or the next day.
// EN + RU. Run from marketing/tools: node aurora-tests/test-r98-reasons.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r98`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const ok = (name, cond, info = "") => { out[name] = cond ? "ok" : `FAIL ${typeof info === "string" ? info : JSON.stringify(info)}`.slice(0, 500); if (!cond) fails.push(name); };

const START = "2026-11-02"; // a Monday
const open = async (lang, when) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: "Asia/Dubai", locale: lang === "ru" ? "ru-RU" : "en-US" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  await p.clock.install({ time: when });
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(900);
  return { ctx, p };
};
/** fights, the partner shouting, headaches, sleep; `plan`: { date: { fight, voice, head, tags } } */
const seed = (p, lang, plan, extra = {}, order = ["fight", "head", "sleep", "voice"]) => p.evaluate(async ({ lang, plan, START, extra, order }) => {
  localStorage.clear();
  localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1");
  localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order"])); localStorage.setItem("memap_avatar", "11_otter");
  localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_theme", "aurora-light");
  localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" })); localStorage.setItem("memap_first_link_seen", "before");
  // the missed-days card stays away (it's pinned at the top; this test taps lights on the path)
  localStorage.setItem("memap_fill_card_hidden", JSON.stringify(["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10"]));
  for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
  const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
  const [fight, voice, head, sleep] = await dz.ensureTemplates(["argued-with-partner", "partner-raised-voice", "headache", "slept-enough"]);
  const at = new Date(`${START}T09:00:00`).toISOString();
  // the deck's order: the partner card last, unless a part needs it right after the fight
  const byName = { fight, voice, head, sleep };
  await st.saveTrackers((await st.getTrackers()).map((t) => ({ ...t, createdAt: at, sortIndex: order.findIndex((k) => byName[k] === t.id) })));
  localStorage.setItem("memap_onboarded_at", at);
  localStorage.setItem("memap_path_start", START);
  localStorage.setItem("memap_door", JSON.stringify({ id: "fights", trackerId: fight, contextTrackerIds: [], startedAt: START }));
  const E = [];
  for (const [d, x] of Object.entries(plan)) {
    const c = new Date(`${d}T21:00:00`).toISOString();
    E.push({ id: `${d}-f`, trackerId: fight, date: d, value: !!x.fight, ...(x.tags ? { tags: x.tags } : {}), createdAt: c });
    E.push({ id: `${d}-v`, trackerId: voice, date: d, value: !!x.voice, createdAt: c });
    E.push({ id: `${d}-h`, trackerId: head, date: d, value: !!x.head, createdAt: c });
    E.push({ id: `${d}-s`, trackerId: sleep, date: d, value: d.endsWith("2") || d.endsWith("5"), createdAt: c });
  }
  await st.saveEntries(E);
  return { fight, voice, head, sleep };
}, { lang, plan, START, extra, order });
const model = (p) => p.evaluate(async () => {
  const ps = await import("/src/lib/pathSteps.ts"), st = await import("/src/lib/storage.ts"), rs = await import("/src/lib/reasons.ts"), dz = await import("/src/lib/doors.ts");
  const T = await st.getTrackers(), E = await st.getEntries();
  const m = ps.pathModel(T, E);
  const why = m.steps.find((s) => s.kind === "why");
  return { steps: m.steps.map((s) => `${s.id}${s.done ? "+" : ""}${s.skipped ? "~" : ""}`), why: why ? { done: why.done, skipped: !!why.skipped } : null,
    pending: rs.pendingReasons(T, E, dz.isoLocal(new Date())).map((e) => `${e.trackerId.split("-")[1]}|${e.date}`) };
});
const entryOf = (p, trackerId, date) => p.evaluate(async ({ trackerId, date }) => (await (await import("/src/lib/storage.ts")).getEntries()).find((e) => e.trackerId === trackerId && e.date === date) ?? null, { trackerId, date });
/** the question on the card in front (the two behind it are aria-hidden) */
const cardNow = (p) => p.evaluate(() => [...document.querySelectorAll("p")].filter((x) => x.className.includes("[text-wrap:balance]") && x.className.includes("font-bold") && !x.closest('[aria-hidden="true"]')).map((x) => x.textContent.trim()).pop() ?? null);
const text = async (loc) => (await loc.innerText().catch(() => "")).replace(/\s+/g, " ").trim();
const tapLight = async (p, name) => {
  const node = p.locator(`.path-node[aria-label="${name}"]`).first();
  await node.evaluate((el) => el.scrollIntoView({ block: "center" })); await p.waitForTimeout(900);
  await node.click(); await p.waitForTimeout(700);
};

const WEEK1 = {
  "2026-11-02": {},
  "2026-11-03": { fight: true, tags: ["money"] },
  "2026-11-04": {},
  "2026-11-05": { fight: true, tags: ["money", "chores"] },
  "2026-11-07": { fight: true, voice: true },
  "2026-11-09": { head: true },
};

for (const lang of ["en", "ru"]) {
  const RU = lang === "ru";
  const W = RU
    ? { yes: /^Да$/, no: /^Нет$/, later: "Ссора: причину можно добавить потом — шаг «Почему?» на пути.", doneLater: "Причину можно добавить потом: шаг «Почему?» на пути.", step: "Почему?", add: /^Добавить$/, skip: /^Пропустить$/, save: /^Сохранить$/, fightQ: /ссор/i, voiceQ: /голос/i, cont: /^Дальше$/,
      sub: "Ссора · Головная боль", heads: ["Сегодня · Ссора", "Вчера · Головная боль", "Суббота · Ссора"], money: "Деньги", together: "Время вместе", stress: "Стресс", chores: "Быт", kids: "Дети",
      headChips: "Плохой сон|Стресс|Пропуск еды|Месячные|Другое|Не знаю", words: "Из-за праздников", reasons: "ПРИЧИНЫ", report: "Отчёт прошлой недели", openReport: /^Открыть$/, seeReport: /Смотреть отчёт/i, next: /^Дальше$/,
      line: "Ссоры — чаще всего: деньги (3 из 3)", skipped: "Пропущено" }
    : { yes: /^Yes$/, no: /^No$/, later: "Fight: you can add the reason later — “Why?” on your path.", doneLater: "You can add the reason later: “Why?” on your path.", step: "Why?", add: /^Add$/, skip: /^Skip$/, save: /^Save$/, fightQ: /fight|argument/i, voiceQ: /voice/i, cont: /^Continue$/,
      sub: "Fight · Headache", heads: ["Today · Fight", "Yesterday · Headache", "Saturday · Fight"], money: "Money", together: "Time together", stress: "Stress", chores: "Chores", kids: "Kids",
      headChips: "Poor sleep|Stress|Skipped a meal|Period|Other|Don't know", words: "About the holidays", reasons: "REASONS", report: "Last week's report", openReport: /^Open$/, seeReport: /See the report/i, next: /^Next$/,
      line: "Fights — most often: money (3 of 3)", skipped: "Skipped" };
  // --- A ---------------------------------------------------------------------------------------------------------
  {
    const { ctx, p } = await open(lang, new Date(2026, 10, 10, 20, 0, 0));
    const ids = await seed(p, lang, WEEK1);
    await p.reload(); await p.waitForTimeout(2800);
    const m0 = await model(p);
    out[`${lang}.A.before`] = m0;
    ok(`${lang}.A partner card never asked why`, !m0.pending.some((x) => x.startsWith("partner")), m0.pending);
    ok(`${lang}.A before the deck: Sat fight + Mon headache wait`, m0.pending.join() === "headache|2026-11-09,argued|2026-11-07", m0.pending);
    const harmFree = await p.evaluate(async (ids) => {
      const rs = await import("/src/lib/reasons.ts"), st = await import("/src/lib/storage.ts");
      const T = await st.getTrackers();
      return { voice: rs.reasonTemplate(T.find((x) => x.id === ids.voice)), fight: rs.reasonTemplate(T.find((x) => x.id === ids.fight)), head: rs.REASON_CHIPS.headache.join(), hurt: rs.reasonTemplate({ id: "1-partner-said-hurtful-0", title: "x" }) };
    }, ids);
    ok(`${lang}.A no reasons for partner harm`, harmFree.voice === null && harmFree.hurt === null && harmFree.fight === "argued-with-partner", harmFree);
    ok(`${lang}.A headache chips by the research`, !/screens|alcohol|weather/i.test(harmFree.head), harmFree.head);

    // 1. the deck
    await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-session"))); await p.waitForTimeout(1600);
    let sawFight = false, sawVoice = false;
    for (let i = 0; i < 8; i++) {
      const q = await cardNow(p);
      if (!q) break;
      if (W.fightQ.test(q)) {
        await p.getByRole("button", { name: W.yes }).last().click(); await p.waitForTimeout(900);
        sawFight = true;
        const line = await text(p.locator("[data-why-later]").first());
        out[`${lang}.A.lineAfterFight`] = line;
        ok(`${lang}.A fight yes: the later line`, line === W.later, line);
        await p.screenshot({ path: `${D}/${lang}-A1-deck-fight-yes.png` });
      } else if (W.voiceQ.test(q)) {
        await p.getByRole("button", { name: W.yes }).last().click(); await p.waitForTimeout(900);
        sawVoice = true;
        const n = await p.locator("p[data-why-later][role=status]").count();
        ok(`${lang}.A partner yes: no later line`, n === 0, String(n));
        // the calm line is a window of its own, once (her note, Nov 10 2026: under the buttons it squeezed the cards)
        const win = p.locator("[data-care-window]");
        const careTxt = await text(win);
        ok(`${lang}.A partner yes: the calm window`, careTxt.startsWith(lang === "ru" ? "Это тяжело." : "That sounds hard."), careTxt);
        const fixed = await p.evaluate(() => { const w = document.querySelector("[data-care-window]")?.parentElement; return !!w && getComputedStyle(w).position === "fixed" && Number(getComputedStyle(w).zIndex) > 60; });
        ok(`${lang}.A calm window: over the cards and the Done card`, fixed, String(fixed));
        await p.screenshot({ path: `${D}/${lang}-A2-deck-partner-yes.png` });
        // "Talk to someone" closes the window and opens the support sheet on top
        await win.getByRole("button", { name: lang === "ru" ? /^Поговорить с кем-то$/ : /^Talk to someone$/ }).click(); await p.waitForTimeout(1200);
        const sheetOnTop = await p.evaluate(() => {
          const d = [...document.querySelectorAll("[role=dialog]")].pop();
          return !!d && !d.hasAttribute("data-care-window") && /Talk to someone|Поговорить с кем-то/.test(d.textContent || "") && !document.querySelector("[data-care-window]");
        });
        ok(`${lang}.A Talk to someone: the window closes, the sheet opens`, sheetOnTop, String(sheetOnTop));
        await p.screenshot({ path: `${D}/${lang}-A2b-support.png` });
        await p.keyboard.press("Escape"); await p.waitForTimeout(900);
      } else {
        await p.getByRole("button", { name: W.no }).last().click(); await p.waitForTimeout(900);
      }
    }
    ok(`${lang}.A deck had both cards`, sawFight && sawVoice, { sawFight, sawVoice });
    await p.waitForTimeout(800);
    // a partner-harm "yes" came this sitting: the Done card doesn't say the reason line (Nov 10 2026)
    const doneCard = p.locator("div.fixed.inset-0", { has: p.getByRole("button", { name: W.cont }) }).last();
    const done = await text(doneCard);
    out[`${lang}.A.doneCard`] = done.slice(0, 200);
    ok(`${lang}.A Done card: no reason line after a partner-harm yes`, done.length > 0 && !done.includes(W.doneLater) && (await doneCard.locator("[data-why-later]").count()) === 0, done);
    await p.screenshot({ path: `${D}/${lang}-A3-done-card.png` });
    // the window was shown once, under the cards; the Done card doesn't repeat it
    ok(`${lang}.A Done card: no second calm window`, (await p.locator("[data-care-window]").count()) === 0);
    await p.getByRole("button", { name: W.cont }).last().click(); await p.waitForTimeout(2200);

    // 2. the path: "Why?"
    const m1 = await model(p);
    out[`${lang}.A.after`] = m1;
    ok(`${lang}.A Why? step to do`, !!m1.why && !m1.why.done, m1.steps);
    ok(`${lang}.A three answers wait`, m1.pending.join() === "argued|2026-11-10,headache|2026-11-09,argued|2026-11-07", m1.pending);
    await tapLight(p, W.step);
    const bubble = await text(p.locator(".path-bubble"));
    out[`${lang}.A.bubble`] = bubble;
    ok(`${lang}.A step card`, bubble.includes(W.step) && bubble.includes(W.sub), bubble);
    await p.screenshot({ path: `${D}/${lang}-A4-why-step.png` });
    await p.locator(".path-bubble button", { hasText: W.add }).click(); await p.waitForTimeout(1200);
    const sheet = p.locator("[data-reason-sheet]");
    const heads = await sheet.locator("[data-reason-item] > p").allInnerTexts();
    out[`${lang}.A.heads`] = heads;
    ok(`${lang}.A sheet lists day · name`, heads.join("|") === W.heads.join("|"), heads);
    const headChips = await sheet.locator(`[data-reason-item="${ids.head}|2026-11-09"] button`).allInnerTexts();
    ok(`${lang}.A headache chips`, headChips.join("|") === W.headChips, headChips);
    await p.screenshot({ path: `${D}/${lang}-A5-why-sheet.png` });
    const item = (id, d) => sheet.locator(`[data-reason-item="${id}|${d}"]`);
    await item(ids.fight, "2026-11-10").locator("button", { hasText: W.money }).click();
    await item(ids.fight, "2026-11-10").locator("button", { hasText: W.together }).click();
    await item(ids.fight, "2026-11-10").locator("input").fill(W.words);
    await item(ids.head, "2026-11-09").locator("button", { hasText: W.stress }).click();
    await item(ids.fight, "2026-11-07").locator("button", { hasText: W.money }).click();
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${D}/${lang}-A6-why-filled.png` });
    await sheet.getByRole("button", { name: W.save }).scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${D}/${lang}-A7-why-save.png` });
    await sheet.getByRole("button", { name: W.save }).click(); await p.waitForTimeout(1800);
    const eT = await entryOf(p, ids.fight, "2026-11-10"), eH = await entryOf(p, ids.head, "2026-11-09"), eS = await entryOf(p, ids.fight, "2026-11-07");
    ok(`${lang}.A tags saved`, eT?.tags?.join() === "money,timeTogether" && eH?.tags?.join() === "stress" && eS?.tags?.join() === "money", { eT: eT?.tags, eH: eH?.tags, eS: eS?.tags });
    const notes = await p.evaluate(async () => (await (await import("/src/lib/notes.ts")).getNotes()).map((n) => ({ date: n.date, text: n.text, reasonFor: n.reasonFor, linked: n.linkedPatternId })));
    out[`${lang}.A.notes`] = notes;
    ok(`${lang}.A words saved as a note of that day`, notes.length === 1 && notes[0].text === W.words && notes[0].date === "2026-11-10" && notes[0].reasonFor === `${ids.fight}|2026-11-10` && notes[0].linked === ids.fight, notes);
    const m2 = await model(p);
    ok(`${lang}.A step done`, !!m2.why && m2.why.done && !m2.why.skipped && m2.pending.length === 0, m2);
    await p.locator(`.path-node[aria-label="${W.step}"]`).first().evaluate((el) => el.scrollIntoView({ block: "center" })); await p.waitForTimeout(800);
    await p.screenshot({ path: `${D}/${lang}-A8-why-done.png` });

    // 3. Notes: "Reasons"
    await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-notes", { detail: {} }))); await p.waitForTimeout(1800);
    const rs = await text(p.locator("[data-reasons]"));
    out[`${lang}.A.notesReasons`] = rs;
    ok(`${lang}.A Notes: Reasons section`, rs.startsWith(W.reasons) && rs.includes(`${W.money} · ${W.together}`) && rs.includes(W.words) && rs.includes(W.stress), rs);
    const rows = await p.locator("[data-reason-row]").count();
    ok(`${lang}.A Notes: three shown (of the 5 with reasons)`, rows === 3, String(rows));
    const twice = await p.evaluate((w) => document.body.innerText.split(w).length - 1, W.words);
    ok(`${lang}.A Notes: the words not twice`, twice === 1, String(twice));
    await p.screenshot({ path: `${D}/${lang}-A9-notes-reasons.png` });
    await p.locator("[data-reason-row]").first().click(); await p.waitForTimeout(1200);
    const editSheet = p.locator("[data-reason-sheet]");
    ok(`${lang}.A Notes: edit has no Skip`, (await editSheet.getByRole("button", { name: W.skip }).count()) === 0);
    const words = await editSheet.locator("input").inputValue().catch(() => "");
    ok(`${lang}.A Notes: edit keeps the words`, words === W.words, words);
    await editSheet.locator("button", { hasText: W.chores }).click(); await p.waitForTimeout(300);
    await p.screenshot({ path: `${D}/${lang}-A10-notes-edit.png` });
    await editSheet.getByRole("button", { name: W.save }).click(); await p.waitForTimeout(1500);
    const eT2 = await entryOf(p, ids.fight, "2026-11-10");
    ok(`${lang}.A Notes: edit saved`, eT2?.tags?.join() === "money,timeTogether,chores", eT2?.tags);
    const rs2 = await text(p.locator("[data-reason-row]").first());
    ok(`${lang}.A Notes: row updated`, rs2.includes(W.chores), rs2);
    await p.screenshot({ path: `${D}/${lang}-A11-notes-after-edit.png` });

    // 4. last week's report
    await p.reload(); await p.waitForTimeout(2800);
    await tapLight(p, W.report);
    await p.locator(".path-bubble button", { hasText: W.openReport }).click(); await p.waitForTimeout(1200);
    await p.getByRole("button", { name: W.seeReport }).click(); await p.waitForTimeout(1500);
    await p.getByRole("button", { name: W.next }).click(); await p.waitForTimeout(2200);
    const line = await text(p.locator("[data-reason-line]").first());
    out[`${lang}.A.reportLine`] = line;
    ok(`${lang}.A report line`, line === W.line, line);
    await p.locator("[data-reason-line]").first().evaluate((el) => el.scrollIntoView({ block: "center" })).catch(() => {}); await p.waitForTimeout(500);
    await p.screenshot({ path: `${D}/${lang}-A12-report-line.png` });
    const saved = await p.evaluate(() => JSON.parse(localStorage.getItem("memap_week_chests") || "{}")[0]?.reasons ?? null);
    ok(`${lang}.A report keeps the line`, Array.isArray(saved) && saved[0]?.replace(/ /g, " ") === W.line, saved);
    // "(3 of 3)" never breaks before "3)"
    ok(`${lang}.A report line: k of n kept together`, /\d+ (of|из) \d+\)/.test(saved?.[0] ?? ""), saved);

    // 5. the calendar day: the chips right there
    await p.reload(); await p.waitForTimeout(2600);
    await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "overview", back: true } }))); await p.waitForTimeout(2200);
    // "Love life island grew!" may come first (the evening's answers): close it, then My days again
    for (let i = 0; i < 4; i++) {
      const grow = p.locator(".tour[role=dialog]");
      if (!(await grow.count())) break;
      await grow.locator("button").first().click().catch(() => {}); await p.waitForTimeout(1200);
      await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "overview", back: true } }))); await p.waitForTimeout(2200);
    }
    await p.screenshot({ path: `${D}/${lang}-A13a-my-days.png` });
    await p.locator(".grid.grid-cols-7 button", { hasText: /^3$/ }).first().click({ timeout: 8000 }); await p.waitForTimeout(1200);
    const inline = p.locator("[data-reason-inline]");
    const inlineOn = await inline.locator('button[aria-pressed="true"]').allInnerTexts();
    ok(`${lang}.A calendar: the day's chips`, (await inline.count()) === 1 && inlineOn.join() === W.money, inlineOn);
    await inline.locator("button", { hasText: W.kids }).click(); await p.waitForTimeout(1000);
    const e3 = await entryOf(p, ids.fight, "2026-11-03");
    ok(`${lang}.A calendar: a tap saves`, e3?.tags?.join() === "money,kids", e3?.tags);
    await p.screenshot({ path: `${D}/${lang}-A13-calendar-day.png` });
    await ctx.close();
  }
  // --- B: Skip -------------------------------------------------------------------------------------------------------
  {
    const plan = { ...WEEK1, "2026-11-07": {}, "2026-11-09": {}, "2026-11-10": { fight: true } };
    const { ctx, p } = await open(lang, new Date(2026, 10, 10, 20, 0, 0));
    const ids = await seed(p, lang, plan);
    await p.reload(); await p.waitForTimeout(2800);
    const m0 = await model(p);
    ok(`${lang}.B a fight today: Why? waits`, !!m0.why && !m0.why.done && m0.pending.join() === "argued|2026-11-10", m0);
    await tapLight(p, W.step);
    if (RU) {
      // from the sheet
      await p.locator(".path-bubble button", { hasText: W.add }).click(); await p.waitForTimeout(1200);
      await p.screenshot({ path: `${D}/${lang}-B1-sheet-before-skip.png` });
      await p.locator("[data-reason-sheet]").getByRole("button", { name: W.skip }).click(); await p.waitForTimeout(1200);
    } else {
      // from the path's card
      await p.screenshot({ path: `${D}/${lang}-B1-card-before-skip.png` });
      await p.locator(".path-bubble button", { hasText: W.skip }).click(); await p.waitForTimeout(900);
    }
    const m1 = await model(p);
    ok(`${lang}.B skipped: done, not asked`, !!m1.why && m1.why.done && m1.why.skipped && m1.pending.length === 0, m1);
    const e = await entryOf(p, ids.fight, "2026-11-10");
    ok(`${lang}.B skipped: no tags`, !e?.tags, e?.tags);
    await p.locator(`.path-node[aria-label="${W.step}"]`).first().evaluate((el) => el.scrollIntoView({ block: "center" })); await p.waitForTimeout(800);
    const label = await text(p.locator(`.path-node[aria-label="${W.step}"]`).first());
    await p.screenshot({ path: `${D}/${lang}-B2-skipped.png` });
    await p.reload(); await p.waitForTimeout(2600);
    const m2 = await model(p);
    ok(`${lang}.B not again after a reload`, m2.pending.length === 0 && !!m2.why?.skipped, m2);
    const asked = await p.evaluate(() => localStorage.getItem("memap_reasons_asked"));
    out[`${lang}.B.asked`] = asked;
    void label;
    await ctx.close();
    // the next evening: still not asked
    const next = await open(lang, new Date(2026, 10, 11, 20, 0, 0));
    const ids2 = await seed(next.p, lang, plan);
    // the same answer (a fresh seed makes a new id for the same question)
    await next.p.evaluate(({ v }) => localStorage.setItem("memap_reasons_asked", v), { v: (asked ?? "{}").split(ids.fight).join(ids2.fight) });
    await next.p.reload(); await next.p.waitForTimeout(2600);
    const m3 = await model(next.p);
    ok(`${lang}.B not again the next day`, m3.pending.length === 0 && !m3.why, m3);
    await next.ctx.close();
  }
  // --- C: the partner card right after a fight: the line is not under it ---------------------------------------------
  {
    const { ctx, p } = await open(lang, new Date(2026, 10, 10, 20, 0, 0));
    await seed(p, lang, WEEK1, {}, ["fight", "voice", "head", "sleep"]);
    await p.reload(); await p.waitForTimeout(2800);
    await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-session"))); await p.waitForTimeout(1600);
    const first = await cardNow(p);
    ok(`${lang}.C the fight first`, W.fightQ.test(first ?? ""), first);
    await p.getByRole("button", { name: W.yes }).last().click(); await p.waitForTimeout(900);
    const second = await cardNow(p);
    ok(`${lang}.C then the partner card`, W.voiceQ.test(second ?? ""), second);
    const n = await p.locator("p[data-why-later][role=status]").count();
    ok(`${lang}.C no "why later" under the partner card`, n === 0, String(n));
    await p.screenshot({ path: `${D}/${lang}-C1-partner-after-fight.png` });
    // it comes back on the Done card
    for (let i = 0; i < 6; i++) {
      if (!(await cardNow(p))) break;
      await p.getByRole("button", { name: W.no }).last().click(); await p.waitForTimeout(900);
    }
    await p.waitForTimeout(600);
    const done = await text(p.locator("div.fixed.inset-0", { has: p.locator("[data-why-later]") }).last());
    ok(`${lang}.C the Done card says it`, done.includes(W.doneLater), done);
    await p.screenshot({ path: `${D}/${lang}-C2-done-card.png` });
    await ctx.close();
  }
  // --- D: the rules behind the line and the step (Nov 10 2026) ------------------------------------------------------
  // the line only for a day the step still asks about (today and 3 days back); after 3 skips in a row for a question
  // the step stops asking about it (and the deck stops promising), until a reason is saved for it elsewhere
  {
    const { ctx, p } = await open(lang, new Date(2026, 10, 10, 20, 0, 0));
    const ids = await seed(p, lang, { ...WEEK1, "2026-11-08": { head: true }, "2026-11-10": { head: true, fight: true } });
    const r = await p.evaluate(async (ids) => {
      const rs = await import("/src/lib/reasons.ts"), st = await import("/src/lib/storage.ts");
      const T = await st.getTrackers(), E = await st.getEntries();
      const head = T.find((x) => x.id === ids.head), fight = T.find((x) => x.id === ids.fight);
      const today = "2026-11-10";
      const out = { lineToday: rs.reasonAskedLater(head, today, today), line3: rs.reasonAskedLater(head, "2026-11-07", today), line5: rs.reasonAskedLater(head, "2026-11-05", today) };
      const pend = () => rs.pendingReasons(T, E, today).map((e) => `${e.trackerId === ids.head ? "head" : "fight"}|${e.date}`).join();
      out.before = pend();
      // three evenings skipped for the headache (Nov 5, 6, 7), the fight saved once in between
      rs.markAsked([`${ids.head}|2026-11-04`], "skipped", "2026-11-05", true);
      rs.markAsked([`${ids.head}|2026-11-06`], "skipped", "2026-11-06", true);
      rs.markAsked([`${ids.fight}|2026-11-07`], "saved", "2026-11-07", true);
      out.twoSkips = pend();
      rs.markAsked([`${ids.head}|2026-11-07`], "skipped", "2026-11-07", true);
      out.threeSkips = pend();
      out.lineResting = rs.reasonAskedLater(head, today, today);
      out.fightStill = rs.reasonAskedLater(fight, today, today);
      // a reason saved for it from the calendar day: back
      rs.markAsked([`${ids.head}|2026-11-02`], "saved", "2026-11-09");
      out.back = pend();
      return out;
    }, ids);
    out[`${lang}.D`] = r;
    ok(`${lang}.D line: today and 3 days back, not older`, r.lineToday && r.line3 && !r.line5, r);
    ok(`${lang}.D two skips: still asked`, r.before.includes("head|2026-11-10") && r.twoSkips.includes("head|2026-11-10"), r);
    ok(`${lang}.D three skips: the headache rests`, !r.threeSkips.includes("head") && r.threeSkips.includes("fight|2026-11-10") && !r.lineResting && r.fightStill, r);
    ok(`${lang}.D a saved reason brings it back`, r.back.includes("head|2026-11-10") && r.back.includes("head|2026-11-08"), r);
    await ctx.close();
  }
}
console.log(JSON.stringify({ out, fails, errs: errs.filter((e) => !/InAppReview|sentry/i.test(e)) }, null, 1));
await b.close();
process.exit(fails.length ? 1 : 0);
