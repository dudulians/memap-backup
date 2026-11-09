// r96 (Nov 9 2026): "Games and rewards", a switch in Settings (her answer to a tester who called the bubbles,
// "You did great today!", ranks, "Play" and confetti "a kindergarten").
// 1. Settings has the switch (EN "Games and rewards" / RU «Игры и награды»), on by default; it turns it off.
// 2. Off: the Done card says "That's all for today." with no bubbles or next treasure, the last light is
//    "Done for today", no streak flame, the hunch button says "Check", the path end promises no bubbles,
//    You shows no treasure shelf and no "In a row" tile, finishing the evening drops no confetti.
// 3. On: as before ("Great work today!", "Pop bubbles", "Play", the flame, treasures, confetti).
// 4. The one-time question: not at 9 answered evenings; on the 10th "Games and rewards — keep them?";
//    "Keep" ends it for good (not after a reload); "Turn off" switches the games off.
// EN + RU screenshots in work/r96. Run from marketing/tools; exit 1 when a check fails.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r96`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const check = (name, ok, info) => { out[name] = ok ? "ok" : `FAIL ${info !== undefined ? JSON.stringify(info).slice(0, 300) : ""}`; if (!ok) fails.push(name); };
let n = 0;
const newPage = async () => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  p.__track = [];
  // track() in dev logs "[analytics:would-track] playful_choice {on, from}"
  p.on("console", async (m) => {
    if (!m.text().includes("would-track") || !m.text().includes("playful_choice")) return;
    p.__track.push(JSON.stringify(await m.args()[2]?.jsonValue().catch(() => null)));
  });
  return { ctx, p };
};
const shot = async (p, name) => { await p.waitForTimeout(700); const path = `${D}/${String(++n).padStart(2, "0")}-${name}.png`; await p.screenshot({ path }); return path; };
const countConfetti = (p) => p.evaluate(() => { window.__confetti = 0; new MutationObserver((m) => m.forEach((r) => r.addedNodes.forEach((x) => { if (x.tagName === "CANVAS") window.__confetti++; }))).observe(document.body, { childList: true }); });
const bubbleText = (p) => p.evaluate(() => document.querySelector(".path-bubble")?.innerText.replace(/\s+/g, " ") ?? "NO CARD");
const headerStart = (p) => p.evaluate(() => document.getElementById("memap-header-start")?.innerText.trim() ?? "");

// --- A long-time user (showcase + body demo, ~60 days): today answered (done) or not (open) ---------------
const seedDemo = async (p, { lang, playful, done }) => {
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async ({ lang, playful, done }) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
    for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId) && e.date !== iso(0));
    // the last 3 evenings answered in full: a run for the flame
    for (const d of [1, 2, 3]) for (const t of T) if (!t.archived && !E.some((e) => e.trackerId === t.id && e.date === iso(d))) E.push({ id: `r-${d}-${t.id}`, trackerId: t.id, date: iso(d), value: false });
    if (done) for (const t of T) if (!t.archived) E.push({ id: `today-${t.id}`, trackerId: t.id, date: iso(0), value: false });
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    localStorage.setItem("memap_path_start", [...E.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1");
    localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order", "report"]));
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_first_link_seen", "before");
    localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(9) }));
    localStorage.setItem("memap_week_chests", JSON.stringify(Object.fromEntries(Array.from({ length: 20 }, (_, w) => [w, { openedAt: iso(1), lines: [], reward: "balloon" }]))));
    // as if chosen in Settings: no one-time question on these screens
    localStorage.setItem("memap_playful_asked", "seed");
    if (!playful) localStorage.setItem("memap_playful", "off");
    const ps = await import("/src/lib/pathSteps.ts");
    if (done) {
      for (const k of ["memap_hunch_day", "memap_act_seen"]) localStorage.setItem(k, iso(0));
      for (const s of ps.pathModel(T, E).steps) if (s.kind === "task") ps.markTaskDone(s.task);
    } else {
      // an open day: no rule, task or tip in the way of the hunch
      localStorage.setItem("memap_act_seen", JSON.stringify({ date: iso(1), ids: T.map((t) => t.id) }));
      localStorage.setItem("memap_path_tasks", JSON.stringify(Object.fromEntries(["note", "calendar", "ownQuestion", "chart", "map", "newIsland", "experiment"].map((k) => [k, { shown: iso(20), done: iso(10) }]))));
    }
  }, { lang, playful, done });
  await p.reload(); await p.waitForTimeout(2600);
};

for (const [lang, playful] of [["en", false], ["ru", false], ["en", true]]) {
  const RU = lang === "ru", tag = `${lang}-${playful ? "on" : "off"}`;
  // the done day
  {
    const { ctx, p } = await newPage();
    await seedDemo(p, { lang, playful, done: true });
    await shot(p, `${tag}-today-done`);
    // the reminders' progress lines: a treasure only with the games on
    if (lang === "en" && !playful) {
      const lines = await p.evaluate(async () => {
        const st = await import("/src/lib/storage.ts"), rl = await import("/src/lib/reminderLines.ts");
        const [T, E] = await Promise.all([st.getTrackers(), st.getEntries()]);
        const off = rl.progressLines(T, E, 0);
        localStorage.removeItem("memap_playful");
        const on = rl.progressLines(T, E, 0);
        localStorage.setItem("memap_playful", "off");
        return { on, off };
      });
      out[`${tag} reminder lines`] = lines;
      const treasure = (l) => l.some((x) => /until you get the/.test(x));
      check(`${tag} reminders: a treasure line only with the games on`, treasure(lines.on) && !treasure(lines.off), lines);
    }
    const flame = await headerStart(p);
    check(`${tag} flame ${playful ? "shown" : "gone"}`, playful ? /\d/.test(flame) : flame === "", flame);
    const lastName = playful ? (RU ? "Полопать пузыри" : "Pop bubbles") : (RU ? "На сегодня всё" : "Done for today");
    const last = p.locator(`.path-node[aria-label*="${lastName}"]`).first();
    check(`${tag} last light "${lastName}"`, (await last.count()) > 0);
    if (await last.count()) { await last.click(); await p.waitForTimeout(900); }
    await shot(p, `${tag}-done-card`);
    const card = await bubbleText(p);
    out[`${tag} done card`] = card.slice(0, 260);
    if (playful) {
      check(`${tag} done card as before`, (RU ? /молодец/ : /Great work today!/).test(card) && (RU ? /Полопать пузыри/ : /Pop bubbles/).test(card), card);
    } else {
      check(`${tag} done card neutral`, (RU ? /На сегодня всё\./ : /That's all for today\./).test(card), card);
      check(`${tag} done card no games`, !/Great work|молодец|bubble|пузыр|treasure|сокровищ|Want more|Хочется ещё/i.test(card), card);
      check(`${tag} no next treasure`, (await p.locator(".next-treasure").count()) === 0);
    }
    // You: the treasure shelf and the "In a row" tile
    await p.keyboard.press("Escape"); await p.waitForTimeout(300);
    await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-you"))); await p.waitForTimeout(1800);
    const you = (await p.locator("[role=dialog]").last().innerText()).replace(/\s+/g, " ");
    await p.evaluate(() => { const d = [...document.querySelectorAll("[role=dialog]")].pop(); const s = [...d.querySelectorAll("*")].find((e) => getComputedStyle(e).overflowY === "auto" && e.scrollHeight > e.clientHeight); if (s) s.scrollTop = 420; });
    await shot(p, `${tag}-you`);
    // innerText is upper-case for the shelf's heading
    const shelf = RU ? /Твои сокровища/i : /Your treasures/i, row = RU ? /Подряд/ : /In a row/;
    check(`${tag} You ${playful ? "has" : "no"} treasures`, playful ? shelf.test(you) : !shelf.test(you), you.slice(0, 300));
    check(`${tag} You ${playful ? "has" : "no"} in-a-row`, playful ? row.test(you) : !row.test(you));
    // Settings: the switch, in the first card
    if (!playful) {
      const settingsRow = p.locator("[role=dialog]").last().getByRole("button", { name: RU ? /Настройки/ : /^Settings$/ }).first();
      await settingsRow.click(); await p.waitForTimeout(1300);
      const sw = p.locator("#playful-toggle");
      check(`${tag} settings switch`, (await sw.count()) > 0 && (await sw.getAttribute("aria-checked")) === "false");
      const label = await p.locator("label[for=playful-toggle]").innerText().catch(() => "");
      check(`${tag} settings label`, label === (RU ? "Игры и награды" : "Games and rewards"), label);
      await shot(p, `${tag}-settings`);
    }
    await ctx.close();
  }
  // an open day: the hunch button and the end of the path
  {
    const { ctx, p } = await newPage();
    await seedDemo(p, { lang, playful, done: false });
    await shot(p, `${tag}-today-open`);
    const hunch = p.locator(`.path-node[aria-label*="${RU ? "Твоя догадка" : "Your hunch"}"]`).first();
    check(`${tag} hunch light`, (await hunch.count()) > 0);
    if (await hunch.count()) {
      await hunch.click(); await p.waitForTimeout(900);
      await shot(p, `${tag}-hunch`);
      const card = await bubbleText(p);
      const btns = await p.locator(".path-bubble button").allInnerTexts();
      check(`${tag} hunch button ${playful ? "Play" : "Check"}`, btns.some((x) => x.trim() === (playful ? (RU ? "Играть" : "Play") : (RU ? "Проверить" : "Check"))), btns);
      if (!playful) check(`${tag} hunch no Play`, !btns.some((x) => /^(Play|Играть)$/.test(x.trim())), card);
      await hunch.click(); await p.waitForTimeout(500);
    }
    const end = p.locator(`.path-node[aria-label*="${RU ? "Конец сегодняшнего пути" : "The end of today"}"]`).first();
    check(`${tag} path end light`, (await end.count()) > 0);
    if (await end.count()) {
      await end.click(); await p.waitForTimeout(900);
      await shot(p, `${tag}-path-end`);
      const card = await bubbleText(p);
      out[`${tag} path end`] = card;
      check(`${tag} path end ${playful ? "promises" : "no"} bubbles`, playful ? /bubble|пузыр/i.test(card) : !/bubble|пузыр/i.test(card) && /step|шаг/i.test(card), card);
    }
    await ctx.close();
  }
}

// --- Last week's report: no ranks, rewards or treasures with the games off -------------------------------------
for (const playful of [false, true]) {
  const tag = `en-${playful ? "on" : "off"}`;
  const { ctx, p } = await newPage();
  await seedDemo(p, { lang: "en", playful, done: false });
  // last week's report not opened yet: it waits as the first step
  await p.evaluate(async () => {
    const st = await import("/src/lib/storage.ts"), ps = await import("/src/lib/pathSteps.ts");
    const m = ps.pathModel(await st.getTrackers(), await st.getEntries());
    const all = JSON.parse(localStorage.getItem("memap_week_chests") || "{}"); delete all[m.week - 1];
    localStorage.setItem("memap_week_chests", JSON.stringify(all));
  });
  await p.reload(); await p.waitForTimeout(2600);
  const rep = p.locator(`.path-node[aria-label*="Last week's report"]`).first();
  check(`${tag} report step`, (await rep.count()) > 0);
  if (await rep.count()) {
    await rep.click(); await p.waitForTimeout(700);
    await p.locator(".path-bubble").getByRole("button", { name: "Open" }).click(); await p.waitForTimeout(1200);
    await p.getByRole("button", { name: /See the report/i }).click(); await p.waitForTimeout(1200);
    for (let i = 0; i < 8; i++) {
      const next = p.getByRole("button", { name: /^Next$/i });
      if (!(await next.count())) break;
      await next.click(); await p.waitForTimeout(900);
    }
    const txt = (await p.locator("[role=dialog]").last().innerText()).replace(/\s+/g, " ");
    await p.evaluate(() => { const d = [...document.querySelectorAll("[role=dialog]")].pop(); const s = d.querySelector(".overflow-y-auto"); if (s) s.scrollTop = s.scrollHeight; });
    await shot(p, `${tag}-report-end`);
    out[`${tag} report`] = txt.slice(0, 700);
    const games = /New title|Your rewards|You earned|See my treasures/i;
    check(`${tag} report ${playful ? "has" : "no"} ranks and rewards`, playful ? games.test(txt) : !games.test(txt), txt.slice(-400));
    if (!playful) check(`${tag} report ends on the map`, /See my map/i.test(txt), txt.slice(-200));
  }
  await ctx.close();
}

// --- A new user on their 10th evening (3 questions, 9 evenings answered) -------------------------------------
const seedTen = async (p, { lang, playful, todayDone }) => {
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async ({ lang, playful, todayDone }) => {
    localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order", "report"])); localStorage.setItem("memap_tour_seen", "true");
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" })); localStorage.setItem("memap_tour_completed", "1"); localStorage.setItem("memap_first_link_seen", "before");
    if (!playful) localStorage.setItem("memap_playful", "off");
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    const ids = await dz.ensureTemplates(["slept-enough", "headache", "drank-water"]);
    const E = [];
    for (let d = todayDone ? 0 : 1; d <= 9; d++) for (const [i, id] of ids.entries()) E.push({ id: `${id}-${d}`, trackerId: id, date: dz.daysAgoIso(d), value: (d + i) % 3 === 0 });
    await st.saveEntries(E);
    localStorage.setItem("memap_door", JSON.stringify({ id: "sleep", trackerId: ids[0], contextTrackerIds: [], startedAt: dz.daysAgoIso(9) }));
    localStorage.setItem("memap_path_start", dz.daysAgoIso(9));
    localStorage.setItem("memap_week_chests", JSON.stringify({ 0: { openedAt: dz.daysAgoIso(1), lines: [], reward: "balloon" } }));
  }, { lang, playful, todayDone });
  await p.reload(); await p.waitForTimeout(2600);
};
const ask = (p) => p.locator("[data-playful-ask]");
/** Answer tonight's questions in one go (memap-open-session); the confetti canvases counted on the way. */
const answerTonight = async (p) => {
  await countConfetti(p);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-session"))); await p.waitForTimeout(1600);
  for (let i = 0; i < 12; i++) {
    const no = p.getByRole("button", { name: /^No$/ }).last();
    if (!(await no.count())) break;
    await no.click().catch(() => {}); await p.waitForTimeout(900);
  }
  await p.waitForTimeout(1200);
  const confetti = await p.evaluate(() => window.__confetti);
  const cont = p.getByRole("button", { name: /^Continue$/ }).last();
  if (await cont.count()) { await cont.click(); await p.waitForTimeout(1600); }
  return confetti;
};
// on, EN: no question at 9; the evening ends with confetti; the question; "Keep" ends it
{
  const { ctx, p } = await newPage();
  await seedTen(p, { lang: "en", playful: true, todayDone: false });
  check("9 evenings: no question", (await ask(p).count()) === 0);
  await shot(p, "en-on-9-evenings");
  const confetti = await answerTonight(p);
  check("on: confetti at the end of the evening", confetti >= 1, confetti);
  await p.waitForTimeout(800);
  check("10th evening: the question", (await ask(p).count()) === 1);
  const q = await ask(p).innerText().catch(() => "");
  check("question words EN", /Games and rewards — keep them\?/.test(q) && /Keep/.test(q) && /Turn off/.test(q) && /You can change this in Settings\./.test(q), q);
  await shot(p, "en-on-10th-question");
  await ask(p).getByRole("button", { name: "Keep" }).click(); await p.waitForTimeout(700);
  check("Keep: the question goes", (await ask(p).count()) === 0);
  check("Keep: games stay on", await p.evaluate(() => localStorage.getItem("memap_playful") !== "off"));
  check("Keep: tracked", p.__track.some((s) => /"on":true/.test(s) && /"from":"ask"/.test(s)), p.__track);
  await p.reload(); await p.waitForTimeout(2600);
  check("Keep: not again after a reload", (await ask(p).count()) === 0);
  await shot(p, "en-on-after-keep");
  await ctx.close();
}
// RU: the question, "Выключить" switches the games off
{
  const { ctx, p } = await newPage();
  await seedTen(p, { lang: "ru", playful: true, todayDone: true });
  check("RU 10th evening: the question", (await ask(p).count()) === 1);
  const q = await ask(p).innerText().catch(() => "");
  check("question words RU", /Игры и награды — оставить\?/.test(q) && /Оставить/.test(q) && /Выключить/.test(q) && /Это можно поменять в настройках\./.test(q), q);
  await shot(p, "ru-on-10th-question");
  await ask(p).getByRole("button", { name: "Выключить" }).click(); await p.waitForTimeout(900);
  check("Turn off: the question goes", (await ask(p).count()) === 0);
  check("Turn off: games off", await p.evaluate(() => localStorage.getItem("memap_playful") === "off"));
  check("Turn off: tracked", p.__track.some((s) => /"on":false/.test(s) && /"from":"ask"/.test(s)), p.__track);
  check("Turn off: no flame", (await headerStart(p)) === "");
  await shot(p, "ru-after-turn-off");
  await ctx.close();
}
// off, EN: the evening ends without confetti
{
  const { ctx, p } = await newPage();
  await seedTen(p, { lang: "en", playful: false, todayDone: false });
  const confetti = await answerTonight(p);
  check("off: no confetti at the end of the evening", confetti === 0, confetti);
  check("off: no question (nothing to keep)", (await ask(p).count()) === 0);
  await shot(p, "en-off-evening-end");
  await ctx.close();
}

out.errs = errs;
out.fails = fails;
console.log(JSON.stringify(out, null, 1));
await b.close();
if (fails.length || errs.length) process.exit(1);
