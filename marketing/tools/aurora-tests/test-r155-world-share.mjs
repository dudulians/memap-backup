// r155 (Nov 13 2026, branch design/one-system): the report and the picture of the world open from "Share" on the World,
// not from the avatar. 1. World has "Share". 2. It offers the PDF report and the picture. 3. The report opens from it.
// 4. The avatar sheet no longer lists them (My questions, How MeMap works and Settings stay).
// Run from marketing/tools with the dev server on 8080; exit 1 when a check fails.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r155`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const check = (name, ok, info) => { out[name] = ok ? "ok" : `FAIL ${info !== undefined ? JSON.stringify(info).slice(0, 400) : ""}`; if (!ok) fails.push(name); };
for (const lang of ["en", "ru"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async (lang) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); const r = g.generateDemoData("work-home");
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(r.newTrackers)); localStorage.setItem("memap_entries", JSON.stringify(r.newEntries));
    localStorage.setItem("memap_path_start", [...r.newEntries.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1");
    localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order", "report", "block:world"]));
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(9) })); localStorage.setItem("memap_playful_asked", "seed");
    localStorage.setItem("memap_week_chests", JSON.stringify(Object.fromEntries(Array.from({ length: 9 }, (_, w) => [w, { openedAt: iso(1), lines: [], reward: "balloon" }]))));
  }, lang);
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(1800);
  await p.locator("button").filter({ hasText: lang === "en" ? /^World$/ : /^Мир$/ }).last().click(); await p.waitForTimeout(3000);
  const share = p.locator("[data-world-share]");
  check(`${lang}: World has Share`, (await share.count()) === 1 && (await share.innerText()).trim() === (lang === "en" ? "Share" : "Поделиться"), await share.allInnerTexts());
  await p.screenshot({ path: `${D}/${lang}-1-world.png` });
  await share.click(); await p.waitForTimeout(900);
  const rows = await p.locator("[data-share-sheet] [data-share]").allInnerTexts();
  check(`${lang}: Share offers the report and the picture`, rows.length === 2 && (lang === "en" ? /PDF for a doctor/.test(rows[0]) && /Picture of my world/.test(rows[1]) : /PDF для врача/.test(rows[0]) && /Картинка моего мира/.test(rows[1])), rows);
  await p.screenshot({ path: `${D}/${lang}-2-share.png` });
  await p.locator('[data-share="report"]').click(); await p.waitForTimeout(1600);
  const rep = await p.locator("[role=dialog]").last().innerText().catch(() => "");
  check(`${lang}: the report opens from Share`, (lang === "en" ? /Report of my days/ : /Отч[её]т/).test(rep), rep.slice(0, 120));
  await p.keyboard.press("Escape"); await p.waitForTimeout(700); await p.keyboard.press("Escape"); await p.waitForTimeout(500);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-you"))); await p.waitForTimeout(1500);
  const you = await p.locator("[role=dialog]").last().innerText().catch(() => "");
  check(`${lang}: the avatar no longer lists the report or sharing`, !(lang === "en" ? /Report of my days|Share my world/ : /Отч[её]т о моих днях|Поделиться миром/).test(you) && (lang === "en" ? /My questions[\s\S]*How MeMap works[\s\S]*Settings/ : /вопрос[\s\S]*Настройки/i).test(you), you.slice(0, 260));
  await p.screenshot({ path: `${D}/${lang}-3-you.png` });
  await ctx.close();
}
await b.close();
console.log(JSON.stringify(out, null, 1));
if (errs.length) console.log("PAGE ERRORS:", errs.slice(0, 5));
process.exit(fails.length || errs.length ? 1 : 0);
