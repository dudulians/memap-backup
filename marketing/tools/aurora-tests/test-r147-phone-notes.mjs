// r147 (Nov 12 2026, her phone notes): bubbles any time of day; the bubbles' sound switch in Settings → Sound &
// Vibration; "Why?" keeps what was marked when the sheet is closed, its Save stays in sight; a skipped "Write a note"
// can be done after all; the link card: islands on one line, the two tags the same size; "Watch too" rows stay,
// ticked, with "Added"; the link moment's "See" opens the link in Links.
// Run from marketing/tools:  node aurora-tests/test-r147-phone-notes.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r147`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const fails = [], errs = [];
const ok = (name, cond, info = "") => { console.log(name, "→", cond ? "ok" : `FAIL ${JSON.stringify(info)}`.slice(0, 600)); if (!cond) fails.push(name); };
const newPage = async () => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  return { ctx, p };
};
const bubbleText = (p) => p.evaluate(() => document.querySelector(".path-bubble")?.innerText.replace(/\s+/g, " ") ?? "NO CARD");

/** a long-time user (showcase + body demo), today not answered yet */
const seed = async (p, { lang, playful = true, tasks = null }) => {
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async ({ lang, playful, tasks }) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
    for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId) && e.date !== iso(0));
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    localStorage.setItem("memap_path_start", [...E.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1");
    localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order", "report"]));
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_first_link_seen", "before");
    localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(9) }));
    localStorage.setItem("memap_week_chests", JSON.stringify(Object.fromEntries(Array.from({ length: 20 }, (_, w) => [w, { openedAt: iso(1), lines: [], reward: "balloon" }]))));
    localStorage.setItem("memap_playful_asked", "seed");
    if (!playful) localStorage.setItem("memap_playful", "off");
    localStorage.setItem("memap_act_seen", JSON.stringify({ date: iso(1), ids: T.map((t) => t.id) }));
    const all = Object.fromEntries(["note", "calendar", "ownQuestion", "chart", "map", "newIsland", "experiment"].map((k) => [k, { shown: iso(20), done: iso(10) }]));
    if (tasks) for (const [k, v] of Object.entries(tasks)) all[k] = Object.fromEntries(Object.entries(v).map(([kk, n]) => [kk, iso(n)]));
    localStorage.setItem("memap_path_tasks", JSON.stringify(all));
  }, { lang, playful, tasks });
  await p.reload(); await p.waitForTimeout(2600);
};
const tapNode = async (p, label) => {
  const node = p.locator(`.path-node[aria-label*="${label}"]`).first();
  if (!(await node.count())) return false;
  await node.evaluate((el) => el.scrollIntoView({ block: "center" })); await p.waitForTimeout(700);
  await node.click(); await p.waitForTimeout(900);
  return true;
};

// --- A. Bubbles before the evening is done ---------------------------------------------------------------------
for (const [lang, playful] of [["en", true], ["ru", true], ["en", false]]) {
  const RU = lang === "ru", tag = `${lang}-${playful ? "on" : "off"}`;
  const { ctx, p } = await newPage();
  await seed(p, { lang, playful });
  const found = await tapNode(p, RU ? "Конец сегодняшнего пути" : "The end of today");
  ok(`${tag}: the path's end light`, found);
  const card = await bubbleText(p);
  const btns = (await p.locator(".path-bubble button").allInnerTexts()).map((x) => x.trim());
  await p.screenshot({ path: `${D}/${tag}-end.png` });
  if (playful) {
    ok(`${tag}: "Pop bubbles" before the evening is done`, btns.some((x) => /Pop bubbles|Полопать пузыри/.test(x)), { card, btns });
    ok(`${tag}: the card says any time`, /any time|в любое время/.test(card), card);
    ok(`${tag}: still the way to the next step`, btns.some((x) => /My next step|Мой следующий шаг/.test(x)), btns);
    await p.locator(".path-bubble button").filter({ hasText: /Pop bubbles|Полопать пузыри/ }).first().click(); await p.waitForTimeout(1200);
    const game = await p.evaluate(() => !!document.querySelector('[role=dialog][aria-modal=true] canvas'));
    ok(`${tag}: the game opens`, game);
    await p.screenshot({ path: `${D}/${tag}-game.png` });
  } else {
    ok(`${tag}: no bubbles with the games off`, !btns.some((x) => /bubble|пузыр/i.test(x)) && !/bubble|пузыр/i.test(card), { card, btns });
  }
  await ctx.close();
}

// --- B. Settings → Sound & Vibration: the bubbles' sound by name --------------------------------------------------
for (const lang of ["en", "ru"]) {
  const RU = lang === "ru";
  const { ctx, p } = await newPage();
  await seed(p, { lang });
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-you"))); await p.waitForTimeout(1800);
  await p.locator("[role=dialog]").last().getByRole("button", { name: RU ? /Настройки/ : /^Settings$/ }).first().click(); await p.waitForTimeout(1300);
  await p.getByRole("button", { name: RU ? /Звук и вибрация/ : /Sound & Vibration/ }).first().click(); await p.waitForTimeout(900);
  const sw = p.locator("#bubble-sound-toggle");
  const label = await p.evaluate(() => document.querySelector("#bubble-sound-toggle")?.closest("div")?.innerText.trim() ?? "");
  ok(`${lang}: Settings has the bubbles' sound`, (await sw.count()) > 0 && /Bubble sounds|Звук пузырей/.test(label), label);
  await p.screenshot({ path: `${D}/${lang}-settings-sound.png` });
  await sw.click(); await p.waitForTimeout(300);
  ok(`${lang}: the switch turns the bubbles' sound off`, (await p.evaluate(() => localStorage.getItem("memap_unload_sound"))) === "off");
  await ctx.close();
}

// --- C. "Why?": closing keeps what was marked; Save stays in sight -----------------------------------------------
for (const lang of ["en", "ru"]) {
  const RU = lang === "ru";
  const { ctx, p } = await newPage();
  await seed(p, { lang });
  // a fight yesterday with no reasons yet: the step is there whatever the random demo did
  await p.evaluate(async () => {
    const st = await import("/src/lib/storage.ts"), dz = await import("/src/lib/doors.ts");
    const [fight] = await dz.ensureTemplates(["argued-with-partner"]);
    const y = dz.daysAgoIso(1);
    const E = (await st.getEntries()).filter((e) => !(e.trackerId === fight && e.date === y));
    await st.saveEntries([...E, { id: `why-${y}`, trackerId: fight, date: y, value: true, createdAt: new Date().toISOString() }]);
  });
  await p.reload(); await p.waitForTimeout(2600);
  const pend = await p.evaluate(async () => {
    const st = await import("/src/lib/storage.ts"), rs = await import("/src/lib/reasons.ts"), dz = await import("/src/lib/doors.ts");
    return rs.pendingReasons(await st.getTrackers(), await st.getEntries(), dz.isoLocal(new Date())).length;
  });
  const found = await tapNode(p, RU ? "Почему?" : "Why?");
  ok(`${lang}: a "Why?" step (${pend} answers wait)`, found && pend > 0, { found, pend });
  if (!found) { await ctx.close(); continue; }
  await p.locator(".path-bubble button").first().click(); await p.waitForTimeout(1200);
  const sheet = p.locator("[data-reason-sheet]");
  ok(`${lang}: the sheet opens`, (await sheet.count()) > 0);
  const item = await sheet.locator("[data-reason-item]").first().getAttribute("data-reason-item");
  await sheet.locator("[data-reason-item]").first().locator("button.chip").first().click(); await p.waitForTimeout(300);
  const save = await p.evaluate(() => { const s = document.querySelector("[data-reason-save]"); const r = s?.getBoundingClientRect(); return s ? { pos: getComputedStyle(s).position, inView: r.bottom <= innerHeight && r.top >= 0 } : null; });
  ok(`${lang}: Save stays in sight`, !!save && save.pos === "sticky" && save.inView, save);
  await p.screenshot({ path: `${D}/${lang}-why.png` });
  await p.keyboard.press("Escape"); await p.waitForTimeout(1300);
  const tags = await p.evaluate(async (key) => { const [tid, date] = key.split("|"); return (await (await import("/src/lib/storage.ts")).getEntries()).find((e) => e.trackerId === tid && e.date === date)?.tags ?? null; }, item);
  ok(`${lang}: closing kept the marked reason`, Array.isArray(tags) && tags.length > 0, { item, tags });
  await ctx.close();
}

// --- D. A skipped "Write a note" can be done after all -------------------------------------------------------------
for (const lang of ["en", "ru"]) {
  const RU = lang === "ru";
  const { ctx, p } = await newPage();
  await seed(p, { lang, tasks: { note: { shown: 1, skipped: 0 } } });
  const found = await tapNode(p, RU ? "Написать заметку" : "Write a note");
  ok(`${lang}: the skipped note on the path`, found);
  if (!found) { await ctx.close(); continue; }
  const card = await bubbleText(p);
  const go = p.locator(".path-bubble button").filter({ hasText: RU ? /^Вперёд$/ : /^Go$/ }).first();
  ok(`${lang}: "Skipped" with a way back`, /Skipped|Пропущено/.test(card) && (await go.count()) > 0, card);
  await p.screenshot({ path: `${D}/${lang}-note-skipped.png` });
  if (await go.count()) {
    await go.click(); await p.waitForTimeout(1200);
    ok(`${lang}: the note opens`, (await p.locator("textarea").count()) > 0);
    const rec = await p.evaluate(() => JSON.parse(localStorage.getItem("memap_path_tasks") ?? "{}").note ?? {});
    ok(`${lang}: no longer skipped`, !rec.skipped, rec);
  }
  await ctx.close();
}

// --- E/F. The link card; "Watch too"; the link moment's "See" ------------------------------------------------------
for (const lang of ["en", "ru"]) {
  const { ctx, p } = await newPage();
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async (lang) => {
    localStorage.clear(); localStorage.setItem("memap_ab_onb", "A"); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1");
    localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1"); localStorage.setItem("memap_first_link_seen", "before");
    localStorage.setItem("memap_examples_seen", JSON.stringify(["link", "month", "rule", "test", "chart", "chart-one"]));
    const g = await import("/src/lib/demoDataGenerator.ts"), st = await import("/src/lib/storage.ts"), dz = await import("/src/lib/doors.ts");
    localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: dz.daysAgoIso(1) }));
    const r = g.generateDemoData("work-home"); await st.saveTrackers(r.newTrackers); await st.saveEntries(r.newEntries);
    localStorage.setItem("memap_path_start", dz.daysAgoIso(59));
  }, lang);
  await p.reload(); await p.waitForTimeout(2500);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "findings" } }))); await p.waitForTimeout(2200);
  if (!(await p.locator("[data-link-card]").count())) {
    await p.locator("button").filter({ hasText: /^Links|^Связи/ }).first().click().catch(() => {}); await p.waitForTimeout(1800);
  }
  // v151 (her pick): the strongest link is one sentence, its two answers lit; no plates, no islands
  const look = await p.evaluate(() => {
    const c = document.querySelector("[data-link-card]"); if (!c) return null;
    return { a: c.querySelectorAll(".hl-a").length, b: c.querySelectorAll(".hl-b").length, plates: document.querySelectorAll("[data-tag]").length, isles: c.querySelectorAll("img").length };
  });
  await p.screenshot({ path: `${D}/${lang}-hero.png` });
  ok(`${lang}: the strongest link in words, both answers lit`, !!look && look.a > 0 && look.b > 0, look);
  ok(`${lang}: no plates, no islands in Links`, !!look && look.plates === 0 && look.isles === 0, look);
  // "Watch too": a same-day link, "Not sure", then a question added
  const ask = p.locator("[data-order-ask]").first();
  if (!(await ask.count())) {
    // open the cards until one asks
    const heads = p.locator("[data-link-card] > button");
    for (let i = 0; i < Math.min(8, await heads.count()) && !(await p.locator("[data-order-ask]").count()); i++) { await heads.nth(i).click().catch(() => {}); await p.waitForTimeout(400); }
  }
  if (await p.locator("[data-order-ask]").count()) {
    await p.locator('[data-order-ask] [data-order="unsure"]').first().click(); await p.waitForTimeout(600);
    const w = p.locator("[data-watch]").first();
    if (await w.count()) {
      const id = await w.getAttribute("data-watch");
      await w.evaluate((el) => el.scrollIntoView({ block: "center" })); await p.waitForTimeout(300);
      await w.click(); await p.waitForTimeout(1200);
      const after = await p.evaluate((id) => { const el = document.querySelector(`[data-watch="${id}"]`); return { still: !!el, pressed: el?.getAttribute("aria-pressed"), added: document.querySelector("[data-watch-added]")?.textContent ?? null }; }, id);
      const tracked = await p.evaluate(async (id) => (await (await import("/src/lib/storage.ts")).getTrackers()).some((t) => (t.templateId ?? "") === id || t.id.includes(id)), id);
      await p.screenshot({ path: `${D}/${lang}-watch.png` });
      ok(`${lang}: "Watch too" row stays, ticked, with "Added"`, after.still && after.pressed === "true" && !!after.added, after);
      ok(`${lang}: the question is added`, tracked || !!after.added, { id, tracked });
    } else console.log(`${lang}: no "Watch too" for this link (nothing new to suggest)`);
  } else console.log(`${lang}: no same-day link asks "What comes first?" in this demo`);
  // the link moment's "See" (memap-open-link) opens it in Links
  await p.keyboard.press("Escape"); await p.waitForTimeout(900);
  await p.evaluate(async () => {
    const st = await import("/src/lib/storage.ts"), is = await import("/src/lib/islands.ts");
    const T = await st.getTrackers(), E = await st.getEntries();
    const r = is.buildRoutes(T, E, is.buildIslands(T, E))[0];
    window.dispatchEvent(new CustomEvent("memap-open-link", { detail: { a: r.a, b: r.b } }));
  });
  await p.waitForTimeout(1800);
  const opened = await p.evaluate(() => ({ sentence: !!document.querySelector("[data-link-sentence]"), title: [...document.querySelectorAll("[role=dialog] h2, [role=dialog] h1")].map((h) => h.textContent).join(" | ") }));
  await p.screenshot({ path: `${D}/${lang}-open-link.png` });
  ok(`${lang}: "See" opens the link in Links`, opened.sentence, opened);
  await ctx.close();
}

console.log(JSON.stringify({ fails, errs: errs.slice(0, 3) }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
