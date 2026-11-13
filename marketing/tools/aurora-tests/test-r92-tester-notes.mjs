// r92 (Nov 9 2026): the six testers on the folded When to act.
// 1. a question onboarding added (not hers) never lights, even after 3 weeks; its calm row says why;
// 2. calm rows are named by the question's hard answer, not the task;
// 3. no "Yes"/"No" in the card numbers; 4. no possible cause with a once plan (GP, therapist);
// 5. a "yes" to "partner shouted" gets one talk button, and the evening finishes without confetti.
// Run from marketing/tools.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r92`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
let n = 0; const shot = async (name) => { await p.waitForTimeout(700); await p.screenshot({ path: `${D}/${String(++n).padStart(2, "0")}-${name}.png` }); };
await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
await p.evaluate(async () => {
  const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
  for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
  const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
  const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId));
  const find = (re) => T.find((t) => re.test(t.title));
  const ex = find(/Worked out/);
  E = E.filter((e) => !(e.trackerId === ex.id && e.date >= iso(6)));
  for (let i = 0; i <= 6; i++) E.push({ id: `x${i}`, trackerId: ex.id, date: iso(i), value: false, createdAt: new Date().toISOString() });
  localStorage.clear();
  localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
  const head = find(/headache/i), sleep = find(/Slept enough/i);
  // "Worked out" came with onboarding (context), 40 days ago: past the old 3 quiet weeks
  localStorage.setItem("memap_door", JSON.stringify({ id: "sleep", trackerId: sleep.id, contextTrackerIds: [ex.id], startedAt: iso(40), extra: [{ id: "migraine", trackerId: head.id }] }));
  localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "true"); localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "1");
  localStorage.setItem("memap_theme", "aurora-light"); localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(1) }));
});
await p.reload(); await p.waitForTimeout(2500);
for (const lang of ["en", "ru"]) {
  if (lang === "ru") { await p.evaluate(() => localStorage.setItem("memap_language", "ru")); await p.reload(); await p.waitForTimeout(2500); }
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "signals", back: true } })));
  await p.waitForTimeout(2200);
  const dlg = p.locator("[role=dialog]").last();
  const more = dlg.locator("button", { hasText: /more rules? (is|are) reached|more questions?: time to act|правил[ао]? сработал|вопрос\S*: пора действовать/ });
  if (await more.count()) { await more.first().click(); await p.waitForTimeout(400); }
  await shot(`${lang}-lit`);
  const lit = (await dlg.innerText()).replace(/\s+/g, " ");
  out[`${lang} workoutLit`] = /don.t work out|не тренируешься/.test(lit.split(/calm for now|пока спокойно/)[0]);
  out[`${lang} yesNoInNumbers`] = /“(Yes|No)” on|Ответ «(Да|Нет)» —/.test(lit);
  // open every lit card: no possible cause with "I did it"
  const heads = dlg.locator(".surface > button[aria-expanded]");
  const causes = [];
  for (let i = 0; i < await heads.count(); i++) {
    await heads.nth(i).click(); await p.waitForTimeout(500);
    const c = dlg.locator(".surface", { has: p.locator("button[aria-expanded=true]") }).first();
    const txt = (await c.innerText()).replace(/\s+/g, " ");
    const m = txt.match(/(Possible cause:|Возможная причина:)(.*)$/);
    if (m) causes.push(m[2].slice(0, 160));
    if (i === 0) await shot(`${lang}-open-first`);
  }
  out[`${lang} causes`] = causes;
  out[`${lang} causeWithOnce`] = causes.some((c) => /I did it|Сделано|GP|therapist|врач|психотерапевт/.test(c));
  // the calm rows
  const calm = dlg.locator("button[aria-expanded]", { hasText: /calm for now|пока спокойно|rules? (is|are) calm/ }).last();
  await calm.click(); await p.waitForTimeout(500); await shot(`${lang}-calm`);
  const calmText = (await dlg.innerText()).replace(/\s+/g, " ");
  out[`${lang} calm`] = calmText.split(/calm for now|пока спокойно/)[1]?.slice(0, 900);
  out[`${lang} notYourTopic`] = /Not your topic, so no task|Это не твоя тема — без задания/.test(calmText);
  await p.keyboard.press("Escape"); await p.waitForTimeout(600);
}
// 5. the hurt evening: "partner raised their voice" answered every day for 6 days, today "yes" = a 7-day streak
await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
await p.evaluate(async () => {
  localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order"])); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "1");
  localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" })); localStorage.setItem("memap_tour_completed", "1");
  const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
  await dz.ensureTemplates(["partner-raised-voice", "felt-depressed"]);
  const T = await st.getTrackers(); const E = [];
  for (const tr of T) for (let d = 1; d <= 6; d++) E.push({ id: `${tr.id}-${d}`, trackerId: tr.id, date: dz.daysAgoIso(d), value: d % 2 === 0 });
  await st.saveEntries(E);
});
await p.reload(); await p.waitForTimeout(2400);
// count confetti: canvas-confetti adds a fixed canvas to <body> when it fires
await p.evaluate(() => { window.__confetti = 0; new MutationObserver((m) => m.forEach((r) => r.addedNodes.forEach((x) => { if (x.tagName === "CANVAS") window.__confetti++; }))).observe(document.body, { childList: true }); });
// straight to today's cards (the path may first offer another step)
await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-session"))); await p.waitForTimeout(1600);
out.cards = [];
for (let i = 0; i < 12; i++) {
  const yes = p.getByRole("button", { name: /^Yes$/ }).last();
  if (!(await yes.count())) break;
  const txt = (await p.locator("[role=dialog]").last().innerText()).replace(/\s+/g, " ");
  const hurt = /raise.*voice|shout/i.test(txt);
  out.cards.push(hurt ? "hurt" : "other");
  await yes.click().catch(() => {}); await p.waitForTimeout(800);
  if (hurt) {
    await shot("hurt-care");
    out.careLine = await p.locator("[role=status]").first().innerText().catch(() => null);
    out.talkButtons = await p.locator("[role=dialog] button", { hasText: /^Talk to someone$/ }).count();
  }
}
await p.waitForTimeout(1500); await shot("evening-end");
out.confetti = await p.evaluate(() => window.__confetti);
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
