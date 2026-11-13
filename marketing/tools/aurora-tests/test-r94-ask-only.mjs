// r94 (Nov 9 2026, her decision): the two partner-harm questions are never offered — not in the library, a new
// island, the demo or ideas — and come up only when someone types about it ("my partner yelled at me"). The help
// sheets show no phone numbers and no Find A Helpline link (its terms); since Nov 10 2026 "afraid at home" has no link either, only words.
// Run from marketing/tools.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r94`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: "Europe/London" });
const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
let n = 0; const shot = async (name) => { await p.waitForTimeout(600); await p.screenshot({ path: `${D}/${String(++n).padStart(2, "0")}-${name}.png` }); };
await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
await p.evaluate(async () => {
  localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order"])); localStorage.setItem("memap_tour_seen", "true");
  localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_theme", "aurora-light");
  localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" })); localStorage.setItem("memap_tour_completed", "1");
  const dz = await import("/src/lib/doors.ts");
  await dz.ensureTemplates(["argued-with-partner", "felt-depressed"]);
});
await p.reload(); await p.waitForTimeout(2500);
// module-level checks: ideas, the demo pack, the typed-words rule
out.modules = await p.evaluate(async () => {
  const ls = await import("/src/lib/lifeStreams.ts"), sl = await import("/src/lib/supportLines.ts"), demo = await import("/src/lib/demoDataGenerator.ts");
  const harm = new Set(["Partner raised their voice at me", "Partner said something hurtful"]);
  const ideas = Array.from({ length: 30 }, () => ls.getRandomIdeas(8)).flat().filter((x) => harm.has(x.title)).length;
  const pack = demo.generateDemoData("relationship-reality");
  return {
    ideasWithHarm: ideas,
    demoHasHarm: pack.newTrackers.some((t) => harm.has(t.title)),
    typed: ["My partner yelled at me", "Муж кричал на меня", "My child screams at bedtime", "Была ссора"].map((t) => [t, sl.writesAboutHomeHarm(t)]),
    // no helpline links at all since Nov 10 2026 (her note: "ссылок не будет, только инструкция")
    noLinkCode: !("helpLinks" in sl),
  };
});
// the add-question sheet
await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-add-question")));
await p.waitForTimeout(1500);
const dlg = p.locator("body");
await shot("add-open");
out.addOpenText = (await dlg.innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 400);
out.addInputs = await dlg.locator("input, textarea").evaluateAll((xs) => xs.map((x) => x.getAttribute("placeholder")));
const search = dlg.getByPlaceholder(/^Search$/).first();
out.searchFound = (await search.count()) > 0;
if (out.searchFound) {
  await search.fill("partner"); await p.waitForTimeout(700); await shot("search-partner");
  const t1 = (await dlg.innerText()).replace(/\s+/g, " ");
  out.partnerSearchHasHarm = /raise their voice|say something that genuinely hurt/i.test(t1);
  out.partnerSearchHasOrdinary = /fight with your partner|warm moment with your partner/i.test(t1);
  await search.fill("partner yelled at me"); await p.waitForTimeout(700); await shot("search-yelled");
  const t2 = (await dlg.innerText()).replace(/\s+/g, " ");
  out.yelledSearchHasHarm = /raise their voice|say something that genuinely hurt/i.test(t2);
  await search.fill(""); await p.waitForTimeout(500);
  out.browseHasHarm = /raise their voice|say something that genuinely hurt/i.test((await dlg.innerText()).replace(/\s+/g, " "));
  // write my own: the typed words bring the question up
  await p.getByRole("button", { name: /Write my own/ }).first().click(); await p.waitForTimeout(900);
  await shot("own-open");
  const own = p.locator("input:visible, textarea:visible").first();
  await own.fill("My partner yelled at me"); await p.waitForTimeout(900); await shot("own-yelled");
  out.ownYelledHasHarm = (await p.getByText(/raise their voice at you/i).count()) > 0;
  await own.fill("My child screams at bedtime"); await p.waitForTimeout(900);
  out.ownChildHasHarm = (await p.getByText(/raise their voice at you/i).count()) > 0;
}
await p.keyboard.press("Escape"); await p.waitForTimeout(700);
// the low-mood help sheet: no links, no numbers
await p.evaluate(async () => {
  const st = await import("/src/lib/storage.ts"), dz = await import("/src/lib/doors.ts");
  const T = await st.getTrackers(); const dep = T.find((x) => /down|empty|depress/i.test(x.title + x.questionText));
  window.__dep = !!dep;
});
await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-session"))); await p.waitForTimeout(1500);
for (let k = 0; k < 4; k++) {
  const chip = p.getByRole("button", { name: /^Talk to someone$/ });
  if (await chip.count()) { await chip.first().click(); await p.waitForTimeout(1000); break; }
  const no = p.getByRole("button", { name: /^No$/ }).last(); if (!(await no.count())) break;
  await no.click(); await p.waitForTimeout(800);
}
await shot("mood-sheet");
const sheet = p.locator("[role=dialog]").last();
out.moodSheet = (await sheet.innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 600);
out.moodLinks = await sheet.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href"))).catch(() => []);
out.moodNoNumbers = !/\b(999|116 123|0808|988|112|911)\b/.test(out.moodSheet);
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
