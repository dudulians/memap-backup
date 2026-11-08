// QA (Nov 8 2026): open Today from a saved state (qa-new-onb.mjs), tap every light on the path and read
// its card, then walk the path by its Start bubble to the end: decks, the hunch game, notes, the end card.
// usage: node aurora-tests/qa-new-path.mjs <tag> <stateTag> <lang> <hour> <theme> [walk=1]
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
const [tag = "s1p", stateTag = "s1a", lang = "en", hourS = "10", theme = "aurora-light", walk = "1", offS = "0", world = "0"] = process.argv.slice(2);
const hour = Number(hourS), RU = lang === "ru", dayOff = Number(offS);
const D = `./aurora-tests/work/qa-new`; mkdirSync(D, { recursive: true });
const state = JSON.parse(readFileSync(`${D}/${stateTag}-state.json`, "utf8"));
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], log = [];
const ctx = await b.newContext({ storageState: state, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, locale: RU ? "ru-RU" : "en-US", timezoneId: RU ? "Europe/Moscow" : "Asia/Dubai" });
const p = await ctx.newPage();
p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && !/InAppReview|favicon|Failed to load resource/.test(m.text()) && errs.push(m.text()));
const at = (h) => { const d = new Date(2026, 10, 8 + dayOff); d.setHours(Math.floor(h), Math.round((h % 1) * 60) || 20, 0, 0); return d; };
await p.clock.install({ time: at(hour) });
await p.goto("http://localhost:8080/"); await p.waitForTimeout(2600);
await p.evaluate((theme) => localStorage.setItem("memap_theme", theme), theme);
if (dayOff > 0) {
  // seed every day before today that has no answers yet: a believable pattern (short nights before the
  // main problem), every active question answered; "today" stays open
  log.push({ seeded: await p.evaluate(async () => {
    const s = await import("/src/lib/storage.ts"), dz = await import("/src/lib/doors.ts");
    const T = (await s.getTrackers()).filter((t) => !t.archived), E = await s.getEntries();
    const today = dz.isoLocal(new Date());
    const have = new Set(E.map((e) => `${e.trackerId}@${e.date}`));
    const start = new Date(2026, 10, 9), out = [...E]; let added = 0;
    for (let d = new Date(start), i = 1; dz.isoLocal(d) < today; d.setDate(d.getDate() + 1), i++) {
      const iso = dz.isoLocal(d), shortNight = i % 3 === 0 || i === 4;
      for (const t of T) {
        if (have.has(`${t.id}@${iso}`)) continue;
        if (new Date(t.createdAt) > new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59)) continue;
        const ti = (t.title || "").toLowerCase();
        let v = (i + t.id.length) % 2 === 0;
        if (/slept enough|спал/.test(ti)) v = !shortNight;
        else if (/migraine|headache|голов|мигрен/.test(ti)) v = shortNight;
        else if (/anx|тревог|stress|стресс/.test(ti)) v = shortNight || i % 4 === 1;
        out.push({ id: `seed-${iso}-${t.id}`, trackerId: t.id, date: iso, value: v, createdAt: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 21, 0).toISOString() });
        added++;
      }
    }
    await s.saveEntries(out);
    return { today, added, trackers: T.length };
  }) });
  await p.reload(); await p.waitForTimeout(2800);
}
p.on("framenavigated", (f) => f === p.mainFrame() && errs.push("NAVIGATED " + f.url()));
let n = 0;
const audit = () => p.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.opacity !== "0"; };
  const cut = [], off = [];
  for (const e of document.querySelectorAll("body *")) {
    if (!vis(e)) continue;
    if (![...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) continue;
    const s = getComputedStyle(e);
    if ((s.overflow.includes("hidden") || s.textOverflow === "ellipsis" || s.overflowX === "hidden") && (e.scrollWidth > e.clientWidth + 2 || e.scrollHeight > e.clientHeight + 4)) cut.push(e.textContent.trim().slice(0, 60));
    const r = e.getBoundingClientRect(); if (r.right > window.innerWidth + 2 || r.left < -2) off.push(e.textContent.trim().slice(0, 50));
  }
  const dialogs = [...document.querySelectorAll("[role=dialog], .path-bubble")].filter(vis).map((d) => d.innerText.replace(/\s+/g, " ").slice(0, 700));
  return { dialogs: [...new Set(dialogs)], cut: cut.slice(0, 8), off: off.slice(0, 8) };
});
const shot = async (name, extra = {}) => {
  await p.waitForTimeout(800);
  const file = `${D}/${tag}-${String(++n).padStart(2, "0")}-${name}.png`;
  await p.screenshot({ path: file });
  log.push({ shot: file.split("/").pop(), ...extra, ...(await audit().catch((e) => ({ auditErr: e.message }))) });
};
const vis = async (loc) => loc.isVisible().catch(() => false);
const closeAll = async () => { for (let k = 0; k < 3; k++) { await p.keyboard.press("Escape"); await p.waitForTimeout(250); } await p.mouse.click(30, 420); await p.waitForTimeout(400); };
try {
  await shot("today");
  // the header: streak, week label, the banner
  log.push({ header: await p.evaluate(() => document.querySelector("header, .path-week-label")?.innerText?.replace(/\s+/g, " ") ?? "") });
  const streak = p.locator("[aria-label*=streak i], [aria-label*=подряд i], [aria-label*=серия i]").first();
  if (await vis(streak)) { const ok = await streak.click({ timeout: 2500 }).then(() => true).catch((e) => (log.push({ streakClick: e.message.split("\n").slice(0, 6).join(" | ").slice(0, 400) }), false)); if (ok) { await shot("streak-tap"); await closeAll(); } }
  const banner = p.getByText(RU ? /отчёт|Отчёт/ : /report in/i).first();
  if (await vis(banner)) { await banner.click().catch(() => {}); await shot("banner-tap"); await closeAll(); }
  // every light on the path, top to bottom
  const count = await p.locator(".path-node").count();
  log.push({ nodes: count, labels: await p.evaluate(() => [...document.querySelectorAll(".path-node")].map((x) => x.getAttribute("aria-label"))) });
  for (let i = 0; i < Math.min(count, 14); i++) {
    const node = p.locator(".path-node").nth(i);
    const label = await node.getAttribute("aria-label");
    await node.scrollIntoViewIfNeeded().catch(() => {}); await p.waitForTimeout(300);
    const ok = await node.click({ timeout: 2500 }).then(() => true).catch((e) => (log.push({ nodeErr: label, e: e.message.split("\n")[0].slice(0, 160) }), false));
    if (!ok) continue;
    await p.waitForTimeout(700);
    // did it open a card, or navigate somewhere?
    await shot(`node${i}`, { node: label });
    // if a full screen opened (deck, game, tab change), go back
    const tabOn = await p.evaluate(() => document.querySelector("nav [aria-current=page]")?.textContent ?? "");
    if (!/Today|Сегодня/.test(tabOn)) { await p.locator("nav button").nth(0).click().catch(() => {}); await p.waitForTimeout(800); }
    await closeAll();
  }
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(500);
  if (walk === "1") {
    // walk by the Start bubble
    for (let move = 0; move < 14; move++) {
      await p.evaluate(() => document.querySelector(".path-start")?.scrollIntoView({ block: "center" })); await p.waitForTimeout(500);
      const start = p.locator(".path-start").first();
      if (!(await start.count())) { await shot(`walk${move}-nostart`); log.push({ move, note: "no start bubble" }); break; }
      const label = (await start.getAttribute("aria-label")) || (await start.innerText());
      await shot(`walk${move}-at`, { start: label });
      await start.click(); await p.waitForTimeout(1300);
      await shot(`walk${move}-opened`, { start: label });
      // a deck of cards?
      const no = p.getByRole("button", { name: RU ? /^Нет$/ : /^No$/ });
      if (await vis(no.last())) {
        for (let k = 0; k < 24; k++) {
          const yes = p.getByRole("button", { name: RU ? /^Да$/ : /^Yes$/ }).last(), nn = no.last();
          if (!(await vis(nn))) break;
          if (k === 1) await shot(`walk${move}-deck`);
          await (k % 3 === 1 ? yes : nn).click().catch(() => {}); await p.waitForTimeout(750);
        }
        await p.waitForTimeout(1200); await shot(`walk${move}-deck-end`);
        for (let k = 0; k < 4; k++) {
          const nxt = p.getByRole("button", { name: RU ? /^(Дальше|Готово|Продолжить|Не сейчас|Закрыть)/ : /^(Continue|Done|Next|Not now|Close|Back to Today)/ }).last();
          if (await vis(nxt)) { await shot(`walk${move}-after-deck${k}`); await nxt.click().catch(() => {}); await p.waitForTimeout(1200); } else break;
        }
        continue;
      }
      // the hunch game
      if (await p.getByRole("checkbox").count()) {
        await shot(`walk${move}-hunch`);
        await p.getByRole("checkbox").first().click(); await p.waitForTimeout(300);
        await p.getByRole("checkbox").nth(1).click().catch(() => {}); await p.waitForTimeout(300);
        await shot(`walk${move}-hunch-picked`);
        await p.getByRole("button", { name: RU ? /^Проверить|^Провер/ : /^Check/ }).first().click().catch((e) => log.push({ hunchErr: e.message.slice(0, 100) }));
        await p.waitForTimeout(1500); await shot(`walk${move}-hunch-result`);
        for (let k = 0; k < 4; k++) {
          const nxt = p.getByRole("button", { name: RU ? /^(Дальше|Готово|Продолжить)/ : /^(Continue|Done|Next)/ }).last();
          if (await vis(nxt)) { await nxt.click().catch(() => {}); await p.waitForTimeout(1200); await shot(`walk${move}-hunch-after${k}`); } else break;
        }
        continue;
      }
      // the tour
      if (await p.locator("[data-tour-card]").count()) {
        for (let k = 0; k < 12 && await p.locator("[data-tour-card]").count(); k++) { await p.waitForTimeout(900); await p.locator("[data-tour-card] button").last().click().catch(() => {}); }
        continue;
      }
      // a card with a button (bubble) — press its main button
      const pop = p.locator(".path-bubble").getByRole("button", { name: RU ? /пузыр/i : /Pop bubbles/i }).first();
      if (await vis(pop)) {
        await shot(`walk${move}-endcard-full`);
        await p.locator(".path-bubble").first().evaluate((e) => e.scrollIntoView({ block: "end" })).catch(() => {});
        await shot(`walk${move}-endcard-scrolled`);
        await pop.click().catch(() => {}); await p.waitForTimeout(1800);
        await shot(`walk${move}-bubbles`);
        await p.mouse.click(195, 400); await p.waitForTimeout(400); await p.mouse.click(120, 300); await p.waitForTimeout(400); await p.mouse.click(260, 550); await p.waitForTimeout(900);
        await shot(`walk${move}-bubbles-popped`);
        for (let k = 0; k < 4; k++) { const x = p.getByRole("button", { name: RU ? /^(Готово|Закрыть|Дальше|Хватит)/ : /^(Done|Close|Continue|Enough|Finish)/ }).last(); if (await vis(x)) { await x.click().catch(() => {}); await p.waitForTimeout(1000); await shot(`walk${move}-bubbles-after${k}`); } else break; }
        await p.keyboard.press("Escape"); await p.waitForTimeout(600);
        break;
      }
      const bubbleBtn = p.locator(".path-bubble button").last();
      if (await vis(bubbleBtn)) {
        const bl = await bubbleBtn.innerText().catch(() => "");
        log.push({ move, bubbleButton: bl });
        await bubbleBtn.click().catch(() => {}); await p.waitForTimeout(1300);
        await shot(`walk${move}-after-bubble`, { pressed: bl });
        if (await p.locator("textarea").count()) { await p.locator("textarea").first().fill(RU ? "Долго не могла уснуть" : "Slept badly"); await shot(`walk${move}-note`); await p.keyboard.press("Escape"); await p.waitForTimeout(800); }
        // if it is a full-screen thing, try to close it
        const tabOn = await p.evaluate(() => document.querySelector("nav [aria-current=page]")?.textContent ?? "");
        if (!/Today|Сегодня/.test(tabOn)) { await p.locator("nav button").nth(0).click().catch(() => {}); await p.waitForTimeout(900); }
        // end card: stop after it
        if (/Done for today|end of today|На сегодня|Конец/i.test(label)) break;
        continue;
      }
      await closeAll();
      if (move > 10) break;
    }
  }
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(600);
  await shot("today-end");
  if (world === "1") {
    await closeAll();
    await p.locator("nav button").nth(1).click().catch(() => {}); await p.waitForTimeout(2200);
    await shot("world");
    for (const re of RU ? [/^Мои дни/, /^Связи/, /^Когда действовать/, /^Что помогает/] : [/^My days/, /^Links/, /^When to act/, /^What helps/]) {
      const card = p.getByRole("button", { name: re }).first();
      if (!(await vis(card))) { log.push({ worldCardMissing: String(re) }); continue; }
      await card.click().catch(() => {}); await p.waitForTimeout(1300);
      await shot(`world-${String(re).replace(/[^a-zа-я]/gi, "").slice(0, 12)}`);
      const sc = p.locator("[role=dialog] .overflow-y-auto, [role=dialog]").first();
      await sc.evaluate((e) => e.scrollTo(0, 600)).catch(() => {}); await p.waitForTimeout(500);
      await shot(`world-${String(re).replace(/[^a-zа-я]/gi, "").slice(0, 12)}-scrolled`);
      await closeAll();
    }
    // an island: tap its name on the globe
    const isl = p.locator(".planet-label").filter({ hasText: RU ? /Здоровье/ : /Health/ }).first();
    if (await vis(isl)) { await isl.click().catch(() => {}); await p.waitForTimeout(1500); await shot("island"); const sc = p.locator("[role=dialog]").first(); await sc.evaluate((e) => { const x = e.querySelector(".overflow-y-auto") || e; x.scrollTo(0, 700); }).catch(() => {}); await p.waitForTimeout(500); await shot("island-scrolled"); await closeAll(); }
    else log.push({ islandLabel: "not visible" });
    await p.locator("nav button").nth(2).click().catch(() => {}); await p.waitForTimeout(1500);
    await shot("notes");
    await p.locator("header button, [aria-label*=You], [aria-label*=Ты]").last().click().catch(() => {}); await p.waitForTimeout(1500);
    await shot("you");
    await p.mouse.wheel(0, 900); await p.waitForTimeout(700); await shot("you-scrolled");
    await closeAll();
  }
  log.push({ model: await p.evaluate(async () => {
    const ps = await import("/src/lib/pathSteps.ts"), s = await import("/src/lib/storage.ts");
    const T = await s.getTrackers(), E = await s.getEntries(); const m = ps.pathModel(T, E);
    return { trackers: T.filter((t) => !t.archived).length, entries: E.length, steps: m.steps.map((x) => `${x.id}${x.done ? "✓" : ""}${x.skipped ? "(skip)" : ""}`), week: m.week, streak: m.streak };
  }).catch((e) => e.message) });
  writeFileSync(`${D}/${tag}-state.json`, JSON.stringify(await ctx.storageState()));
} catch (e) { errs.push("SCRIPT: " + e.message.slice(0, 300)); await shot("crash").catch(() => {}); }
writeFileSync(`${D}/${tag}-log.json`, JSON.stringify({ log, errs }, null, 1));
console.log(`done ${tag}: ${n} shots, ${errs.length} errors`);
await ctx.close(); await b.close();
