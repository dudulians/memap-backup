// r91 (Nov 9 2026): When to act folded — her note "непонятное и слишком много всего" + the GPT brief.
// Lit cards collapsed by default (island · what MeMap noticed · the days), one opens at a time with the
// small step and one main button; three at most; the calm rules in one line. EN + RU screenshots.
import { launch, seed } from "./qa-old-lib.mjs";
import { mkdirSync } from "fs";
const D = "./aurora-tests/work/r91"; mkdirSync(D, { recursive: true });
const b = await launch();
const out = {};
for (const lang of ["en", "ru"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  await seed(p, { lang, theme: "aurora-light" });
  await p.reload(); await p.waitForTimeout(2500);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "signals", back: true } })));
  await p.waitForTimeout(2200);
  const dlg = p.locator("[role=dialog]").last();
  await p.screenshot({ path: `${D}/${lang}-1-collapsed.png` });
  out[`${lang} cards`] = await dlg.locator("button[aria-expanded]").count();
  out[`${lang} collapsedText`] = (await dlg.innerText()).replace(/\s+/g, " ").slice(0, 900);
  // open the first card, then the second: only one open
  const heads = dlg.locator("button[aria-expanded]");
  await heads.nth(0).click(); await p.waitForTimeout(700);
  await p.screenshot({ path: `${D}/${lang}-2-expanded.png` });
  out[`${lang} expandedText`] = (await dlg.innerText()).replace(/\s+/g, " ").slice(0, 1200);
  await heads.nth(1).click(); await p.waitForTimeout(700);
  out[`${lang} openAtOnce`] = await dlg.locator("button[aria-expanded=true]").count();
  // the calm line opens the rest
  const calm = dlg.locator("button[aria-expanded]").filter({ hasText: /calm|спокойно/i }).last();
  if (await calm.count()) { await calm.click(); await p.waitForTimeout(600); await p.screenshot({ path: `${D}/${lang}-3-calm-open.png` }); }
  out[`${lang} rawBraces`] = /\{\{|\}\}/.test(await dlg.innerText());
  out[`${lang} errs`] = errs;
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await b.close();
