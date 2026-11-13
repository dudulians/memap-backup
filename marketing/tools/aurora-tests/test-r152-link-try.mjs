// r152 (Nov 13 2026, branch design/one-system): a link is no longer a dead end, and its words carry no colour.
// 1. An opened same-day link shows no "What to try" before "What comes first?" is answered.
// 2. After an answer the card shows "What to try" (EN) / «Что попробовать» (RU).
// 3. It opens the try picker on the island of the thing put first; a try started there remembers the link.
// 4. Closing the picker goes back to Links with that link open, where the try shows as "Trying now" with "Day 1 of 14".
// 5. The lit words of a link have the text's own colour and no background.
// Screenshots in work/r152. Run from marketing/tools with the dev server on 8080; exit 1 when a check fails.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r152`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const check = (name, ok, info) => { out[name] = ok ? "ok" : `FAIL ${info !== undefined ? JSON.stringify(info).slice(0, 300) : ""}`; if (!ok) fails.push(name); };
let n = 0;
const seed = async (p, lang) => {
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async (lang) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); const r = g.generateDemoData("work-home");
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(r.newTrackers)); localStorage.setItem("memap_entries", JSON.stringify(r.newEntries));
    localStorage.setItem("memap_path_start", [...r.newEntries.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1");
    localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order", "report"]));
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(9) })); localStorage.setItem("memap_playful_asked", "seed");
    localStorage.setItem("memap_week_chests", JSON.stringify(Object.fromEntries(Array.from({ length: 9 }, (_, w) => [w, { openedAt: iso(1), lines: [], reward: "balloon" }]))));
  }, lang);
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(1800);
};
const shot = async (p, name) => { await p.waitForTimeout(500); await p.screenshot({ path: `${D}/${String(++n).padStart(2, "0")}-${name}.png` }); };

for (const lang of ["en", "ru"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await seed(p, lang);
  await p.locator("button").filter({ hasText: lang === "en" ? /^World$/ : /^Мир$/ }).last().click(); await p.waitForTimeout(2500);
  await p.locator('[data-tour="links-card"]').click(); await p.waitForTimeout(1300);
  const card = p.locator("[data-link-card]").first();
  await card.locator("button").first().click(); await p.waitForTimeout(900);
  check(`${lang}: no "What to try" before the answer`, (await card.locator("[data-link-try]").count()) === 0);
  const lit = await card.locator(".hl-a").first().evaluate((el) => { const cs = getComputedStyle(el), ps = getComputedStyle(el.parentElement); return { same: cs.color === ps.color, bg: cs.backgroundColor }; });
  check(`${lang}: the link's words have no colour of their own`, lit.same && /rgba\(0, 0, 0, 0\)|transparent/.test(lit.bg), lit);
  await card.locator('[data-order="first"]').click(); await p.waitForTimeout(700);
  const ask = card.locator('[data-link-try="ask"]');
  check(`${lang}: "What to try" after the answer`, (await ask.count()) === 1 && (await ask.innerText()).trim() === (lang === "en" ? "What to try" : "Что попробовать"), await ask.allInnerTexts());
  await ask.scrollIntoViewIfNeeded(); await shot(p, `${lang}-link-answered`);
  await ask.click(); await p.waitForTimeout(1500);
  const sheet = p.locator("[role=dialog]").last();
  const sheetText = await sheet.innerText();
  check(`${lang}: the try picker opens`, /14/.test(sheetText) && (lang === "en" ? /What will you try/i : /попроб/i).test(sheetText), sheetText.slice(0, 120));
  // the island of the thing put first ("drained after work" → Work) is the picked tab
  const onTab = await sheet.locator('[role=tab][aria-selected="true"], .chip.is-on').first().innerText().catch(() => "");
  check(`${lang}: the picker is on the island of the thing put first`, (lang === "en" ? /Work/ : /Работа/).test(onTab), onTab);
  await shot(p, `${lang}-picker`);
  // pick the first idea and start
  await sheet.evaluate((d) => { const rows = [...d.querySelectorAll("button")].filter((x) => x.offsetWidth > 250 && !x.disabled && !x.className.includes("press3d")); rows[0]?.click(); }); await p.waitForTimeout(500);
  await sheet.locator("button").filter({ hasText: lang === "en" ? /^Start$/ : /^Начать$/ }).first().click(); await p.waitForTimeout(1200);
  const saved = await p.evaluate(() => { const all = Object.keys(localStorage).map((k) => localStorage.getItem(k)).filter((v) => v && v.includes('"link":"')); return all.length ? all[0].slice(0, 400) : null; });
  check(`${lang}: the started try remembers its link`, !!saved && /"link":"[^"]+\|[^"]+"/.test(saved), saved);
  await shot(p, `${lang}-started`);
  // finish the picker (the reminder step), then the link shows the try
  await p.locator("[role=dialog]").last().locator("button.press3d").last().click().catch(() => undefined);
  await p.locator('[data-link-try="running"]').first().waitFor({ timeout: 8000 }).catch(() => undefined);
  const run = p.locator('[data-link-try="running"]').first();
  const runText = (await run.count()) ? await run.innerText() : "";
  check(`${lang}: back on the link, the try shows as running`, (lang === "en" ? /Trying now[\s\S]*Day 1 of 14/ : /Сейчас пробуешь[\s\S]*День 1 из 14/).test(runText), runText || (await p.locator("[role=dialog]").last().innerText().catch(() => "")).slice(0, 200));
  if (await run.count()) await run.scrollIntoViewIfNeeded();
  await shot(p, `${lang}-link-trying`);
  await ctx.close();
}
await b.close();
console.log(JSON.stringify(out, null, 1));
if (errs.length) console.log("PAGE ERRORS:", errs.slice(0, 5));
process.exit(fails.length || errs.length ? 1 : 0);
