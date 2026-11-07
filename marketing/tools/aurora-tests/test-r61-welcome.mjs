// The first screen (her note, Nov 7 2026: "рандомные острова… никакой концепции"): her
// world as the picture — the globe with three islands, a link and the boat. Day and night.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r61`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [];
for (const [lang, theme] of [["en", "aurora-light"], ["ru", "aurora"]]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  await p.evaluate(({ lang, theme }) => { localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_theme", theme); }, { lang, theme });
  await p.reload(); await p.waitForTimeout(3000);
  await p.screenshot({ path: `${D}/${lang}-${theme}-welcome.png` });
  await ctx.close();
}
console.log(JSON.stringify({ errs }));
await b.close();
