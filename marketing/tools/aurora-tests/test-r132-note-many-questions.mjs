// r132 (her note, Nov 10 2026): "когда делаю заметку и нужно отметить, к какому это вопросу, то я бы разрешила
// множественный выбор". A note can be about several questions: tap any number of them; the note shows all its
// questions; each question's calendar marks the day. Older notes with one question keep it. EN + RU.
// Run from marketing/tools: node aurora-tests/test-r132-note-many-questions.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r132`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const ok = (name, cond, info = "") => { out[name] = cond ? "ok" : `FAIL ${typeof info === "string" ? info : JSON.stringify(info)}`.slice(0, 600); if (!cond) fails.push(name); };

for (const lang of ["en", "ru"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: lang === "ru" ? "ru-RU" : "en-US" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  const ids = await p.evaluate(async (lang) => {
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1"); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_cohort", "old");
    const got = await dz.ensureTemplates(["slept-enough", "felt-happy", "felt-stressed"]);
    const start = new Date(); start.setDate(start.getDate() - 3);
    await st.saveTrackers((await st.getTrackers()).map((t) => ({ ...t, createdAt: start.toISOString() })));
    // an older note about one question
    const now = new Date().toISOString();
    localStorage.setItem("memap_notes", JSON.stringify([{ id: "old1", date: dz.daysAgoIso(1), text: "old note", linkedPatternId: got[2], createdAt: now, updatedAt: now }]));
    return got;
  }, lang);
  await p.reload(); await p.waitForTimeout(2200);
  await p.locator('[data-tour="tab-notes"]').click(); await p.waitForTimeout(1200);
  await p.getByRole("button", { name: lang === "ru" ? /Новая заметка|Написать/ : /New note|Write/ }).first().click(); await p.waitForTimeout(1000);
  const sheet = p.locator('[role="dialog"]').last();
  await sheet.locator("textarea").fill(lang === "ru" ? "Две темы сразу" : "Two topics at once");
  const chips = sheet.locator("button[data-note-q]");
  ok(`${lang}: every question is a chip`, (await chips.count()) === 3, await chips.count());
  await chips.nth(0).click(); await p.waitForTimeout(200);
  await chips.nth(1).click(); await p.waitForTimeout(200);
  const pressed = await sheet.locator(`button[data-note-q][aria-pressed="true"]`).count();
  await p.screenshot({ path: `${D}/${lang}-1-two-picked.png` });
  ok(`${lang}: two questions can be picked`, pressed === 2, pressed);
  await sheet.getByRole("button", { name: lang === "ru" ? /^Сохранить$/ : /^Save$/ }).click(); await p.waitForTimeout(1200);
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem("memap_notes") || "[]").find((n) => n.id !== "old1"));
  ok(`${lang}: saved with both questions, the first kept for older screens`, saved?.linkedPatternIds?.length === 2 && saved.linkedPatternIds.includes(ids[0]) && saved.linkedPatternIds.includes(ids[1]) && saved.linkedPatternId === saved.linkedPatternIds[0], saved);
  const card = p.locator("button.surface", { hasText: lang === "ru" ? "Две темы сразу" : "Two topics at once" }).first();
  const cardChips = await card.locator("span.rounded-full").count();
  await p.screenshot({ path: `${D}/${lang}-2-note-two-chips.png` });
  ok(`${lang}: the note shows both questions`, cardChips === 2, cardChips);
  // open again: both pressed; untap one, save: one left
  await card.click(); await p.waitForTimeout(1000);
  const again = p.locator('[role="dialog"]').last();
  ok(`${lang}: opened again, both are picked`, (await again.locator(`button[data-note-q][aria-pressed="true"]`).count()) === 2);
  await again.locator(`button[data-note-q][aria-pressed="true"]`).first().click(); await p.waitForTimeout(200);
  await again.getByRole("button", { name: lang === "ru" ? /^Сохранить$/ : /^Save$/ }).click(); await p.waitForTimeout(1200);
  const one = await p.evaluate(() => JSON.parse(localStorage.getItem("memap_notes") || "[]").find((n) => n.id !== "old1"));
  ok(`${lang}: untapped one, one is left`, one?.linkedPatternIds?.length === 1 && one.linkedPatternId === one.linkedPatternIds[0], one);
  // the older note: its question shows and is picked when opened
  const old = p.locator("button.surface", { hasText: "old note" }).first();
  ok(`${lang}: an older note keeps its question`, (await old.locator("span.rounded-full").count()) === 1);
  await old.click(); await p.waitForTimeout(900);
  ok(`${lang}: an older note opens with its question picked`, (await p.locator('[role="dialog"]').last().locator(`button[data-note-q][aria-pressed="true"]`).count()) === 1);
  await p.keyboard.press("Escape"); await p.waitForTimeout(500);
  // search finds a note by its second question's name
  await ctx.close();
}
// each question's calendar marks the day
{
  const ctx = await b.newContext(); const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`cal: ${e.message}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(1000);
  const r = await p.evaluate(async () => {
    const n = await import("/src/lib/notes.ts");
    localStorage.removeItem("memap_notes");
    await n.addNote({ date: "2026-11-09", text: "x", linkedPatternIds: ["a", "b"] });
    await n.addNote({ date: "2026-11-08", text: "y", linkedPatternId: "c" });
    const all = await n.getNotes();
    return { ids: all.map((x) => n.noteQuestionIds(x)), firsts: all.map((x) => x.linkedPatternId) };
  });
  ok("both kinds of notes give their questions", JSON.stringify(r.ids) === JSON.stringify([["a", "b"], ["c"]]) && r.firsts.join() === "a,c", r);
  await ctx.close();
}
console.log(JSON.stringify({ fails, out, errs }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
