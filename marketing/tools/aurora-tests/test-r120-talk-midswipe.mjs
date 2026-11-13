// r120 (her note, Nov 10 2026: "когда свайпаешь вопросы — кнопка Talk to someone не работает, нужно чтоб открылась
// подсказка и можно было потом вернуться к свайпу других вопросов"). On a phone (touch), in the middle of the deck:
//  1. a mood card's "Talk to someone" chip opens the sheet on top; closing it returns to the same card, which still answers;
//  2. a partner "yes" → the calm window → "Talk to someone" opens the sheet on top; closing it returns to the next card.
// The afraid-at-home sheet has no link, only words (her note, same day: "мы вроде договорились что ссылок не будет").
// EN + RU. Run from marketing/tools: node aurora-tests/test-r120-talk-midswipe.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r120`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const ok = (name, cond, info = "") => { out[name] = cond ? "ok" : `FAIL ${typeof info === "string" ? info : JSON.stringify(info)}`.slice(0, 400); if (!cond) fails.push(name); };
const cardNow = (p) => p.evaluate(() => [...document.querySelectorAll("p")].filter((x) => x.className.includes("[text-wrap:balance]") && x.className.includes("font-bold") && !x.closest('[aria-hidden="true"]')).map((x) => x.textContent.trim()).pop() ?? null);
/** the support sheet is open and really on top: the point in the middle of its title belongs to it */
const sheetOnTop = (p, title) => p.evaluate((title) => {
  const h = [...document.querySelectorAll("h2")].find((x) => x.textContent.trim() === title);
  if (!h) return { open: false };
  const r = h.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + 20, r.top + r.height / 2);
  const dlg = h.closest("[role=dialog]");
  return { open: true, onTop: !!hit && !!dlg && dlg.contains(hit), visible: r.top >= 0 && r.top < innerHeight, hit: hit?.tagName + "." + (hit?.className || "").toString().slice(0, 40) };
}, title);
const closeSheet = async (p, title) => {
  const dlg = p.locator("[role=dialog]", { has: p.locator("h2", { hasText: title }) }).last();
  const x = dlg.getByRole("button", { name: /close|закрыть/i }).first();
  if (await x.count()) await x.tap(); else await p.keyboard.press("Escape");
  await p.waitForTimeout(1000);
};

for (const lang of ["en", "ru"]) {
  const RU = lang === "ru";
  const W = RU ? { talk: /^Поговорить с кем-то$/, title: "Поговорить с кем-то", yes: /^Да$/, no: /^Нет$/, voiceQ: /голос/i, anxQ: /тревож|тревог|беспоко/i, find: "Найти линию помощи" }
    : { talk: /^Talk to someone$/, title: "Talk to someone", yes: /^Yes$/, no: /^No$/, voiceQ: /voice/i, anxQ: /anxious|worried/i, find: "Find a helpline" };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: "Asia/Dubai", locale: RU ? "ru-RU" : "en-US" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  await p.clock.install({ time: new Date(2026, 10, 10, 20, 0, 0) });
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(900);
  await p.evaluate(async (lang) => {
    localStorage.clear();
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1");
    localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order"])); localStorage.setItem("memap_avatar", "11_otter");
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" })); localStorage.setItem("memap_first_link_seen", "before");
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    const ids = await dz.ensureTemplates(["felt-anxious", "argued-with-partner", "partner-raised-voice", "headache", "slept-enough"]);
    const at = new Date("2026-11-02T09:00:00").toISOString();
    await st.saveTrackers((await st.getTrackers()).map((t) => ({ ...t, createdAt: at, sortIndex: ids.indexOf(t.id) })));
    localStorage.setItem("memap_onboarded_at", at); localStorage.setItem("memap_path_start", "2026-11-02");
    localStorage.setItem("memap_door", JSON.stringify({ id: "fights", trackerId: ids[1], contextTrackerIds: [], startedAt: "2026-11-02" }));
    const E = []; for (const d of ["2026-11-02", "2026-11-03", "2026-11-04"]) ids.forEach((id, i) => E.push({ id: `${d}-${i}`, trackerId: id, date: d, value: false, createdAt: new Date(`${d}T21:00:00`).toISOString() }));
    await st.saveEntries(E);
  }, lang);
  await p.reload(); await p.waitForTimeout(2600);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-session"))); await p.waitForTimeout(1600);

  let sawAnx = false, sawVoice = false;
  for (let i = 0; i < 7; i++) {
    const q = await cardNow(p);
    if (!q) break;
    if (!sawAnx && W.anxQ.test(q)) {
      sawAnx = true;
      // 1. the chip under a mood card
      await p.getByRole("button", { name: W.talk }).last().tap(); await p.waitForTimeout(1200);
      const s1 = await sheetOnTop(p, W.title);
      await p.screenshot({ path: `${D}/${lang}-1-chip-sheet.png` });
      ok(`${lang}: mood chip opens the sheet on top`, s1.open && s1.onTop && s1.visible, s1);
      await closeSheet(p, W.title);
      const back = await cardNow(p);
      ok(`${lang}: after closing, the same card is back`, back === q, { back, q });
      await p.screenshot({ path: `${D}/${lang}-2-back-to-card.png` });
      await p.getByRole("button", { name: W.no }).last().tap(); await p.waitForTimeout(1000);
      const next = await cardNow(p);
      ok(`${lang}: the deck goes on after the chip`, !!next && next !== q, { next, q });
    } else if (!sawVoice && W.voiceQ.test(q)) {
      sawVoice = true;
      // 2. a partner "yes": the calm window, then the sheet
      await p.getByRole("button", { name: W.yes }).last().tap(); await p.waitForTimeout(1000);
      ok(`${lang}: the calm window`, (await p.locator("[data-care-window]").count()) === 1);
      await p.screenshot({ path: `${D}/${lang}-3-care-window.png` });
      await p.locator("[data-care-window]").getByRole("button", { name: W.talk }).tap(); await p.waitForTimeout(1300);
      const s2 = await sheetOnTop(p, W.title);
      await p.screenshot({ path: `${D}/${lang}-4-care-sheet.png` });
      ok(`${lang}: calm window → the sheet on top`, s2.open && s2.onTop && s2.visible, s2);
      const sheetText = await p.locator("[role=dialog]", { has: p.locator("h2", { hasText: W.title }) }).last().innerText().catch(() => "");
      const links = await p.locator("[role=dialog]", { has: p.locator("h2", { hasText: W.title }) }).last().locator("a[href]").count();
      ok(`${lang}: afraid-at-home: no link, words only`, links === 0 && !sheetText.includes(W.find), { links, sheetText: sheetText.slice(0, 500) });
      out[`${lang}.homeSheet`] = sheetText.replace(/\s+/g, " ").slice(0, 600);
      await closeSheet(p, W.title);
      const next = await cardNow(p);
      ok(`${lang}: after the sheet, the next card waits`, !!next && next !== q && (await p.locator("[data-care-window]").count()) === 0, { next, q });
      await p.screenshot({ path: `${D}/${lang}-5-next-card.png` });
      if (next) { await p.getByRole("button", { name: W.no }).last().tap(); await p.waitForTimeout(1000); }
      const after = await cardNow(p);
      ok(`${lang}: and it still answers`, after !== next, { after, next });
    } else {
      await p.getByRole("button", { name: W.no }).last().tap(); await p.waitForTimeout(1000);
    }
  }
  ok(`${lang}: deck had both cards`, sawAnx && sawVoice, { sawAnx, sawVoice });
  await ctx.close();
}
console.log(JSON.stringify({ fails, out, errs }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
