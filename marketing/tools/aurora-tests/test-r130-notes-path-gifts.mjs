// r130 (her notes, Nov 10 2026):
// 1. "Said yes when meant no" still showed in New note → the title is "Agreed to something I didn't want", for
//    trackers that have it too; RU stays «Согласие против желания».
// 2. New note: putting the keyboard away left the sheet short until the text was tapped again → with no text
//    field in focus the sheet takes its own height back (vaul's inline height and bottom cleared).
// 3. Today: her step sat below the middle and an opened card was cut by the tabs → the step comes back to the
//    middle when what stands above it settles late, and an opened card scrolls whole above the tabs.
// 4. The camera came first as a gift → moon and stars at 3 evenings, the plane at 7, the camera last (100 days).
// 5. My days: the calendar didn't fit → a tighter top, the month and Month | Year on one row; the sheet keeps its height.
// Run from marketing/tools: node aurora-tests/test-r130-notes-path-gifts.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r130`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const ok = (name, cond, info = "") => { out[name] = cond ? "ok" : `FAIL ${typeof info === "string" ? info : JSON.stringify(info)}`.slice(0, 600); if (!cond) fails.push(name); };

const seed = async (p, { lang = "en", days = 3, ids = ["slept-enough", "felt-happy", "felt-stressed", "said-yes-when-meant-no"], oldTitle = false } = {}) => {
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  await p.evaluate(async ({ lang, days, ids, oldTitle }) => {
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order"]));
    const now = new Date(); now.setHours(20, 0, 0, 0);
    const day = (k) => { const d = new Date(now); d.setDate(d.getDate() - k); return d; };
    const start = day(days); start.setHours(9, 0, 0, 0);
    const got = await dz.ensureTemplates(ids);
    await st.saveTrackers((await st.getTrackers()).map((t) => ({ ...t, createdAt: start.toISOString(), ...(oldTitle && /agreed to something/i.test(t.title) ? { title: "Said yes when meant no" } : {}) })));
    localStorage.setItem("memap_onboarded_at", start.toISOString()); localStorage.setItem("memap_path_start", dz.isoLocal(start));
    localStorage.setItem("memap_door", JSON.stringify({ id: "goodSleep", trackerId: got[0], contextTrackerIds: [], startedAt: dz.isoLocal(start) }));
    const E = []; for (let k = days; k >= 1; k--) got.forEach((id, i) => E.push({ id: `e${k}-${i}`, trackerId: id, date: dz.isoLocal(day(k)), value: (i + k) % 2 === 0, createdAt: day(k).toISOString() }));
    await st.saveEntries(E);
  }, { lang, days, ids, oldTitle });
  const t20 = new Date(); t20.setHours(20, 0, 0, 0);
  await p.clock.install({ time: t20 });
};

// --- 1. the title, data level ---
{
  const ctx = await b.newContext(); const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await seed(p, { oldTitle: true });
  const r = await p.evaluate(async () => {
    const st = await import("/src/lib/storage.ts"), ap = await import("/src/lib/answerPhrases.ts"), rq = await import("/src/lib/relatedQuestions.ts"), ls = await import("/src/lib/lifeStreams.ts");
    const before = (await st.getTrackers()).map((t) => t.title);
    await st.runStartupMigrations();
    const after = await st.getTrackers();
    const t = after.find((x) => /agreed to something|said yes/i.test(x.title));
    const lib = ls.LIFE_STREAMS.flatMap((s) => s.templates).map((x) => x.title);
    return { hadOld: before.includes("Said yes when meant no"), title: t?.title, id: t ? ap.templateIdOf(t) : null,
      oldMatches: rq.matchTemplateIdByTitle("Said yes when meant no"), newMatches: rq.matchTemplateIdByTitle("Agreed to something I didn't want"),
      libOld: lib.filter((x) => /when meant|yes when/i.test(x)) };
  });
  ok("the old title was there before", r.hadOld, r);
  ok("a tracker with the old title gets the new one", r.title === "Agreed to something I didn't want", r.title);
  ok("it is still the same question", r.id === "said-yes-when-meant-no" && r.oldMatches === "said-yes-when-meant-no" && r.newMatches === "said-yes-when-meant-no", r);
  ok("no library title says 'yes when meant no'", r.libOld.length === 0, r.libOld);
  await ctx.close();
}

// --- 1 + 2. New note: the chip's words, and the sheet's height after the keyboard ---
for (const lang of ["en", "ru"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: lang === "ru" ? "ru-RU" : "en-US" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${lang} notes: ${e.message}`));
  await seed(p, { lang, oldTitle: true });
  await p.reload(); await p.waitForTimeout(2400);
  await p.locator('[data-tour="tab-notes"]').click(); await p.waitForTimeout(1200);
  const add = p.getByRole("button", { name: lang === "ru" ? /Новая заметка|Написать|Добавить/ : /New note|Write|Add/ }).first();
  await add.click(); await p.waitForTimeout(1200);
  const sheet = p.locator('[role="dialog"]').last();
  const chips = (await sheet.innerText()).replace(/\s+/g, " ");
  ok(`${lang}: New note names the question in plain words`, lang === "ru" ? /Согласие против желания/.test(chips) && !/Said yes/i.test(chips) : /Agreed to something I didn't want/.test(chips) && !/Said yes|meant no/i.test(chips), chips.slice(0, 400));
  const full = await sheet.evaluate((el) => Math.round(el.getBoundingClientRect().height));
  // what vaul does while the keyboard is up: an inline height and bottom above it
  const typing = await sheet.evaluate(async (el) => {
    const ta = el.querySelector("textarea"); ta.focus();
    el.style.height = "380px"; el.style.bottom = "300px";
    window.visualViewport?.dispatchEvent(new Event("resize")); window.dispatchEvent(new Event("resize"));
    await new Promise((r) => setTimeout(r, 300));
    return { h: el.style.height, focused: document.activeElement === ta };
  });
  ok(`${lang}: while typing the sheet stays above the keyboard`, typing.h === "380px" && typing.focused, typing);
  const after = await sheet.evaluate(async (el) => {
    document.activeElement?.blur();
    window.visualViewport?.dispatchEvent(new Event("resize"));
    await new Promise((r) => setTimeout(r, 350));
    return { h: el.style.height, bottom: el.style.bottom, px: Math.round(el.getBoundingClientRect().height) };
  });
  await p.screenshot({ path: `${D}/${lang}-note-after-keyboard.png` });
  ok(`${lang}: keyboard away → the sheet takes its own height back`, after.h === "" && after.bottom === "" && Math.abs(after.px - full) <= 2, { ...after, full });
  await ctx.close();
}

// --- 3. Today: her step in the middle after a late change above it; an opened card above the tabs ---
for (const [w, h] of [[390, 844], [375, 667]]) {
  const tag = `${w}x${h}`;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "en-US" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${tag} path: ${e.message}`));
  await seed(p, { days: 3 });
  await p.reload(); await p.waitForTimeout(250);
  // something above the path settles late (a picture, the week's card)
  await p.evaluate(() => { const m = document.querySelector("main"); const d = document.createElement("div"); d.style.height = "150px"; d.setAttribute("data-late", ""); m?.firstElementChild?.prepend(d); });
  await p.waitForTimeout(2200);
  const geo = () => p.evaluate(() => {
    const main = document.querySelector("main"), mr = main.getBoundingClientRect();
    const nav = document.querySelector("nav").getBoundingClientRect();
    const boat = document.querySelector(".path-boat")?.getBoundingClientRect();
    const stops = [...document.querySelectorAll("[data-path-stop]")].map((e) => ({ i: e.getAttribute("data-path-stop"), r: e.getBoundingClientRect() }));
    const s = boat ? stops.sort((a, c) => Math.abs(a.r.top - boat.top) - Math.abs(c.r.top - boat.top))[0] : null;
    return { mid: Math.round((mr.top + nav.top) / 2), stop: s ? Math.round((s.r.top + s.r.bottom) / 2) : null, i: s?.i, navTop: Math.round(nav.top), mainTop: Math.round(mr.top) };
  });
  const g = await geo();
  ok(`${tag}: her step is back in the middle after a late change above it`, g.stop !== null && Math.abs(g.stop - g.mid) <= 14, g);
  // she scrolls so her step is low, then taps it: the card opens whole above the tabs
  await p.mouse.move(w / 2, h / 2); await p.mouse.wheel(0, -Math.round(h * 0.3)); await p.waitForTimeout(700);
  const low = await geo();
  await p.locator(`[data-path-stop="${g.i}"]`).click(); await p.waitForTimeout(1300);
  const card = await p.evaluate(() => {
    const c = document.querySelector(".path-bubble")?.parentElement?.getBoundingClientRect();
    const nav = document.querySelector("nav").getBoundingClientRect();
    return c ? { top: Math.round(c.top), bottom: Math.round(c.bottom), navTop: Math.round(nav.top) } : null;
  });
  await p.screenshot({ path: `${D}/${tag}-card.png` });
  ok(`${tag}: an opened card is whole above the tabs and the bottom fade`, !!card && card.bottom <= Math.min(card.navTop, h - 120) && card.top >= 40, { card, low });
  await ctx.close();
}

// --- 4. gifts: moon and stars first, the plane next, the camera last ---
{
  const ctx = await b.newContext(); const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(1000);
  const r = await p.evaluate(async () => {
    const g = await import("/src/lib/growth.ts");
    const f = (o) => ({ days: 0, streak: 0, links: 0, ownIslands: 0, notes: 0, hunches: 0, tests: 0, cleared: null, reports: 0, calm: null, top: null, topDays: 0, unloads: 0, ...o });
    const earned = (o) => g.ITEMS.filter((it) => g.itemEarned(it.id, f(o))).map((it) => it.id);
    return { order: g.ITEMS.map((x) => x.id), d3: earned({ days: 3, streak: 3 }), d7: earned({ days: 7, streak: 7 }), d99: earned({ days: 99, streak: 3 }), d100: earned({ days: 100, streak: 3 }) };
  });
  const en = await p.evaluate(async () => (await import("/src/locales/en.ts")).default?.items ?? (await import("/src/locales/en.ts")).en?.items);
  out.gifts = r;
  ok("the camera is the last treasure", r.order[r.order.length - 1] === "camera", r.order);
  ok("3 evenings in a row: moon and stars, no camera", r.d3.includes("moon") && !r.d3.includes("camera"), r.d3);
  ok("7 evenings in a row: the plane", r.d7.includes("airplane") && !r.d7.includes("camera"), r.d7);
  ok("the camera comes at 100 days", !r.d99.includes("camera") && r.d100.includes("camera"), { d99: r.d99, d100: r.d100 });
  if (en) ok("EN 'how' words match", en.camera.how === "100 days" && en.moon.how === "3 evenings in a row" && en.airplane.how === "7 evenings in a row" && en.suitcase.how === "60 days", { camera: en.camera, moon: en.moon, airplane: en.airplane, suitcase: en.suitcase });
  await ctx.close();
}

// --- 5. My days: the whole month fits under the question (her note, Nov 10 2026: "календарь не полностью влезает") ---
for (const lang of ["en", "ru"]) {
  const tag = `${lang}-mydays`;
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: lang === "ru" ? "ru-RU" : "en-US" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${tag}: ${e.message}`));
  await seed(p, { lang, days: 10 });
  await p.evaluate(async () => { const n = await import("/src/lib/notes.ts"); const dz = await import("/src/lib/doors.ts"); await n.addNote({ date: dz.daysAgoIso(2), text: "a note" }); localStorage.setItem("memap_tour_completed", "1"); });
  await p.reload(); await p.waitForTimeout(2400);
  const openDays = () => p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "overview", back: true } })));
  await openDays(); await p.waitForTimeout(2200);
  for (let i = 0; i < 3; i++) { const g = p.locator(".tour[role=dialog]"); if (!(await g.count())) break; await g.locator("button").first().click().catch(() => {}); await p.waitForTimeout(1000); await openDays(); await p.waitForTimeout(2000); }
  const m = await p.evaluate(() => {
    const sheet = [...document.querySelectorAll("[role=dialog]")].pop();
    const sr = sheet.getBoundingClientRect();
    const grids = [...sheet.querySelectorAll(".grid.grid-cols-7")].map((g) => g.getBoundingClientRect());
    const days = grids[grids.length - 1];
    const legend = [...sheet.querySelectorAll("p")].find((x) => /Day with a note|День с заметкой/.test(x.textContent || ""))?.getBoundingClientRect();
    const row = sheet.querySelector("[data-month-title]")?.parentElement?.parentElement;
    return { sheetTop: Math.round(sr.top), sheetBottom: Math.round(sr.bottom), daysBottom: Math.round(days.bottom), legendBottom: legend ? Math.round(legend.bottom) : null,
      rowOverflow: row ? row.scrollWidth > row.clientWidth + 1 : null, seg: (() => { const s = row?.querySelector(".seg")?.getBoundingClientRect(); return s ? Math.round(s.left) : null; })() };
  });
  await p.screenshot({ path: `${D}/${tag}.png` });
  ok(`${tag}: the sheet stays as high as before (the icons above stay clear)`, m.sheetTop >= 95, m);
  ok(`${tag}: the whole month and the note key fit`, m.daysBottom <= m.sheetBottom - 8 && m.legendBottom !== null && m.legendBottom <= m.sheetBottom, m);
  ok(`${tag}: month and Month | Year share one row, nothing cut`, m.rowOverflow === false, m);
  // the switch stays in its place in the Year view
  await p.locator("[role=dialog] .seg button", { hasText: lang === "ru" ? /^Год$/ : /^Year$/ }).click(); await p.waitForTimeout(700);
  const segYear = await p.evaluate(() => { const s = [...document.querySelectorAll("[role=dialog] .seg")].find((x) => /Year|Год/.test(x.textContent || "")); return s ? Math.round(s.getBoundingClientRect().left) : null; });
  await p.screenshot({ path: `${D}/${tag}-year.png` });
  ok(`${tag}: Month | Year doesn't move in the Year view`, segYear !== null && Math.abs(segYear - m.seg) <= 2, { month: m.seg, year: segYear });
  await ctx.close();
}

console.log(JSON.stringify({ fails, out, errs }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
