// r161 (Nov 14 2026): her note «в связи слишком длинное полотно… давай всё-таки делать next: вопрос, сообщение,
// дальше to try». The opened link card goes in short steps with Next and Back:
// 1 what was found (sentence, chart, other days, "Also with it") · 2 What comes first? · 3 What to try.
// Each step fits one phone screen without scrolling the card. EN and RU.
// Run from marketing/tools with the dev server on 8080; exit 1 when a check fails.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = "./aurora-tests/work/r161"; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const check = (name, ok, info) => { out[name] = ok ? "ok" : "FAIL " + JSON.stringify(info ?? "").slice(0, 400); if (!ok) fails.push(name); };
for (const lang of ["en", "ru"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async (lang) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
    const g = await import("/src/lib/demoDataGenerator.ts"); const r = g.generateDemoData("work-home");
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(r.newTrackers)); localStorage.setItem("memap_entries", JSON.stringify(r.newEntries));
    localStorage.setItem("memap_path_start", [...r.newEntries.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1");
    localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order", "report"]));
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(9) })); localStorage.setItem("memap_playful_asked", "seed");
    localStorage.setItem("memap_week_chests", JSON.stringify(Object.fromEntries(Array.from({ length: 9 }, (_, w) => [w, { openedAt: iso(1), lines: [], reward: "balloon" }]))));
  }, lang);
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(2200);
  await p.locator("button").filter({ hasText: lang === "en" ? /^World$/ : /^Мир$/ }).last().click(); await p.waitForTimeout(2500);
  await p.locator('[data-tour="links-card"]').click(); await p.waitForTimeout(1600);
  const card = p.locator("[data-link-card]").first();
  // how far the card's bottom is below the screen: a step must not need scrolling past its Next button
  const fits = async () => { await card.locator("[data-link-steps]").scrollIntoViewIfNeeded(); await p.waitForTimeout(300); return card.evaluate((el) => { const r = el.getBoundingClientRect(); return { h: Math.round(r.height), screen: window.innerHeight }; }); };
  const stepName = () => card.locator("[data-link-steps]").getAttribute("data-link-steps");

  check(lang + ": the card opens on what was found", (await stepName()) === "found" && (await card.locator("[data-link-chart-inline]").count()) === 1);
  check(lang + ": step 1 has no question and no try yet", (await card.locator("[data-order]").count()) === 0 && (await card.locator("[data-link-try]").count()) === 0);
  await p.screenshot({ path: D + "/" + lang + "-1-found.png" });
  out[lang + " step 1 size"] = await fits();

  await card.locator("[data-link-next]").click(); await p.waitForTimeout(700);
  check(lang + ": Next shows What comes first?, alone", (await stepName()) === "order" && (await card.locator('[data-order="first"]').count()) === 1 && (await card.locator("[data-link-chart-inline]").count()) === 0);
  check(lang + ": no Next before an answer", (await card.locator("[data-link-next]").count()) === 0);
  await p.screenshot({ path: D + "/" + lang + "-2-order.png" });
  await card.locator('[data-order="first"]').click(); await p.waitForTimeout(900);
  check(lang + ": after the answer Next appears", (await card.locator("[data-link-next]").count()) === 1);
  const s2 = await fits(); out[lang + " step 2 size"] = s2;
  check(lang + ": step 2 fits one screen", s2.h < s2.screen, s2);
  await p.screenshot({ path: D + "/" + lang + "-3-answered.png" });

  await card.locator("[data-link-next]").click(); await p.waitForTimeout(700);
  check(lang + ": Next shows What to try", (await stepName()) === "try" && (await card.locator("[data-link-try]").count()) === 1);
  const s3 = await fits(); out[lang + " step 3 size"] = s3;
  check(lang + ": step 3 fits one screen", s3.h < s3.screen, s3);
  await p.screenshot({ path: D + "/" + lang + "-4-try.png" });

  await card.locator("[data-link-back]").click(); await p.waitForTimeout(500);
  await card.locator("[data-link-back]").click(); await p.waitForTimeout(500);
  check(lang + ": Back returns to what was found", (await stepName()) === "found" && (await card.locator("[data-link-chart-inline]").count()) === 1);
  await ctx.close();
}
await b.close();
console.log(JSON.stringify(out, null, 1));
if (errs.length) console.log("PAGE ERRORS:", errs.slice(0, 5));
process.exit(fails.length || errs.length ? 1 : 0);
