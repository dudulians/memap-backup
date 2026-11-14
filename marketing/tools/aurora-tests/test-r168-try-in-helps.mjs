// r168 (Nov 14 2026, branch design/one-system): a try is picked and kept in What helps, wherever it starts.
// Her note: «когда ты из связи переходишь к действию… видно где-то в заголовках… все действия реально делаем там,
// где они подразумеваются».
// 1. "What to try" under a link opens the picker headed "What helps", with "From a link: …" under it.
// 2. Started, the person lands in What helps, the new try lit, saying it came from a link.
// 3. Closed without starting, the person is back on that link.
// Screenshots in work/r168. Run from marketing/tools with the dev server on 8080 (PORT env to change); exit 1 on a failure.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const PORT = process.env.PORT ?? "8080";
const URL = `http://localhost:${PORT}/`;
const D = `./aurora-tests/work/r168`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const check = (name, ok, info) => { out[name] = ok ? "ok" : `FAIL ${info !== undefined ? JSON.stringify(info).slice(0, 400) : ""}`; if (!ok) fails.push(name); };
let n = 0;
const shot = async (p, name) => { await p.waitForTimeout(500); await p.screenshot({ path: `${D}/${String(++n).padStart(2, "0")}-${name}.png` }); };
const seed = async (p, lang) => {
  await p.goto(URL); await p.waitForTimeout(800);
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
  await p.goto(URL); await p.waitForTimeout(1800);
};
// open a card and walk it to "What to try"
const toTry = async (card) => {
  if ((await card.locator("button").first().getAttribute("aria-expanded")) !== "true") { await card.locator("button").first().click(); await card.page().waitForTimeout(800); }
  for (let k = 0; k < 4; k++) {
    if (await card.locator('[data-link-try="ask"]').count()) return true;
    if (await card.locator("[data-order-ask]:not([data-order-done]) [data-order=first]").count()) { await card.locator("[data-order=first]").click(); await card.page().waitForTimeout(600); }
    const next = card.locator("[data-link-next]");
    if (!(await next.count())) break;
    await next.click(); await card.page().waitForTimeout(600);
  }
  return (await card.locator('[data-link-try="ask"]').count()) > 0;
};

for (const lang of ["en", "ru"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await seed(p, lang);
  await p.locator("button").filter({ hasText: lang === "en" ? /^World$/ : /^Мир$/ }).last().click(); await p.waitForTimeout(2200);
  await p.locator('[data-tour="links-card"]').click(); await p.waitForTimeout(1300);

  // closed without starting: back on the link
  const second = p.locator("[data-link-card]").nth(1);
  check(`${lang}: a link reaches "What to try"`, await toTry(second));
  // read after "What comes first?": the answer re-tells the link in the person's order
  const secondText = (await second.locator("[data-link-sentence]").innerText()).replace(/\s+/g, " ").trim();
  await second.locator('[data-link-try="ask"]').click(); await p.waitForTimeout(1200);
  const dlg = p.locator('[role="dialog"][aria-modal="true"]').last();
  const head = (await dlg.locator("[data-pick-head]").innerText().catch(() => "")).trim();
  const from = (await dlg.locator("[data-pick-from]").innerText().catch(() => "")).trim();
  check(`${lang}: the picker is headed What helps`, (lang === "en" ? /^what helps$/i : /^что помогает$/i).test(head), head);
  check(`${lang}: the picker says the try comes from the link`, (lang === "en" ? /^From a link: .+ (→|·) .+/ : /^Из связи: .+ (→|·) .+/).test(from), from);
  await shot(p, `${lang}-picker`);
  await dlg.locator("button[aria-label]").first().click(); await p.waitForTimeout(1500);
  const back = await p.evaluate(() => [...document.querySelectorAll("[data-link-card]")].filter((c) => c.querySelector("[aria-expanded=true]")).map((c) => c.querySelector("[data-link-sentence]").textContent.replace(/\s+/g, " ").trim()));
  check(`${lang}: closed without a try, back on that link`, back.includes(secondText), { back, secondText });

  // started: in What helps, the new try lit
  const card = p.locator("[data-link-card]").nth(1);
  if (!(await card.locator('[data-link-try="ask"]').count())) await toTry(card);
  await card.locator('[data-link-try="ask"]').click(); await p.waitForTimeout(1200);
  const d2 = p.locator('[role="dialog"][aria-modal="true"]').last();
  await d2.locator("button.surface[aria-pressed]").first().click(); await p.waitForTimeout(300);
  await d2.locator("button").filter({ hasText: /^(start|начать)$/i }).last().click(); await p.waitForTimeout(1200);
  const sw = d2.locator('[role="switch"]'); if (await sw.count() && (await sw.getAttribute("aria-checked")) === "true") await sw.click();
  await d2.locator("button").last().click(); await p.waitForTimeout(1800);
  const litRow = p.locator('[data-try-lit="1"]');
  const litFrom = (await litRow.locator("[data-try-from]").innerText().catch(() => "")).trim();
  check(`${lang}: started, What helps opens with the new try lit`, (await litRow.count()) === 1, await litRow.count());
  check(`${lang}: the lit try says it came from a link`, (lang === "en" ? /^From a link: / : /^Из связи: /).test(litFrom), litFrom);
  await shot(p, `${lang}-in-helps`);
  await ctx.close();
}
await b.close();
console.log(JSON.stringify(out, null, 1));
if (errs.length) console.log("PAGE ERRORS:", errs.slice(0, 5));
process.exit(fails.length || errs.length ? 1 : 0);
