// "Your answers in words" for her own question (Nov 7 2026): the form, and a link built from them.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r60`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
for (const lang of ["en", "ru"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  await p.evaluate(async (lang) => {
    localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1");
    const dz = await import("/src/lib/doors.ts"); await dz.ensureTemplates(["migraine"]);
  }, lang);
  await p.reload(); await p.waitForTimeout(2000);
  out[lang] = await p.evaluate(async () => {
    const T = await import("/src/lib/linkText.ts"); const { default: i18n } = await import("/src/lib/i18n.ts");
    const t = i18n.t.bind(i18n);
    const dog = { id: "x-own", title: "Walked the dog", problemWhen: "yes", words: { yes: "walk with the dog", no: "no walk" } };
    const mig = { id: "1793-migraine-0", title: "Migraine attack", problemWhen: "yes" };
    const of = T.trackerLookup([dog, mig]);
    const r = { first: "x-own", second: "1793-migraine-0", firstYes: false, secondYes: true, nextDay: false, k: 9, n: 10, other: { k: 2, n: 20 } };
    return [T.linkHead(t, r, of), T.linkCount(t, r)];
  });
  // the form
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "cards" } })));
  await p.waitForTimeout(500);
  await p.evaluate(async () => { const m = await import("/src/lib/pathSteps.ts"); });
  await ctx.close();
}
console.log(JSON.stringify({ out, errs }, null, 1));
await b.close();
