// r122 (her answers, Nov 10 2026: "1. ок … 3. давай … 4. давай"): the first screen says "By continuing, you agree to
// the Terms of Use and the Privacy Policy", both words open the site's pages; statistics carry no topic names.
// EN + RU. Run from marketing/tools: node aurora-tests/test-r122-consent.mjs
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
const D = `./aurora-tests/work/r122`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const ok = (name, cond, info = "") => { out[name] = cond ? "ok" : `FAIL ${typeof info === "string" ? info : JSON.stringify(info)}`.slice(0, 400); if (!cond) fails.push(name); };

for (const lang of ["en", "ru"]) {
  const RU = lang === "ru";
  const W = RU ? { line: "Продолжая, ты соглашаешься с условиями использования и политикой конфиденциальности.", terms: "условиями использования", privacy: "политикой конфиденциальности" }
    : { line: "By continuing, you agree to the Terms of Use and the Privacy Policy.", terms: "Terms of Use", privacy: "Privacy Policy" };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: RU ? "ru-RU" : "en-US", timezoneId: RU ? "Europe/Moscow" : "Europe/London" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate((lang) => { localStorage.clear(); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_ab_onb", "A"); }, lang);
  await p.reload(); await p.waitForTimeout(2500);
  await p.evaluate(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; });
  const line = (await p.locator("[data-agree]").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
  ok(`${lang}: the consent line on the first screen`, line === W.line, line);
  const box = await p.locator("[data-agree]").boundingBox();
  // above both buttons, so it's on screen whenever they are
  const btn = await p.getByRole("button", { name: RU ? /^Не знаешь/ : /^Not sure yet/ }).boundingBox();
  ok(`${lang}: it stands above the buttons`, !!box && !!btn && box.y + box.height <= btn.y + 1, { box, btn });
  const main = await p.getByRole("button", { name: RU ? /^Начать/ : /^Get started/ }).boundingBox();
  ok(`${lang}: "Get started" is whole on a 390×844 screen`, !!main && main.y + main.height <= 844, main);
  await p.screenshot({ path: `${D}/${lang}-welcome.png` });
  await p.locator("[data-agree]").getByRole("button", { name: W.terms }).tap(); await p.waitForTimeout(300);
  await p.locator("[data-agree]").getByRole("button", { name: W.privacy }).tap(); await p.waitForTimeout(300);
  const opened = await p.evaluate(() => window.__opened);
  ok(`${lang}: the words open the terms and the policy`, opened[0]?.endsWith("/TERMS.html") && opened[1]?.endsWith("/PRIVACY_POLICY.html"), opened);
  await ctx.close();
}

// statistics: no topic names in any event (a source check over every track() call)
const files = []; const walk = (d) => { for (const f of readdirSync(d)) { const x = join(d, f); if (statSync(x).isDirectory()) walk(x); else if (/\.(ts|tsx)$/.test(f)) files.push(x); } };
walk("../../src");
const bad = [];
for (const f of files) {
  const s = readFileSync(f, "utf8");
  for (const m of s.matchAll(/track\("[a-z_]+",\s*\{([^}]*)\}/g)) if (/\b(door|topic|tip|template|templateId)\s*:/.test(m[1]) && !/door:\s*(alt|"own"|"curious")/.test(m[1])) bad.push(`${f}: ${m[0].slice(0, 120)}`);
  if (/(?<!un)setUserProperty\("topic"/.test(s)) bad.push(`${f}: setUserProperty topic`);
}
ok("no topic names in statistics", bad.length === 0, bad);
console.log(JSON.stringify({ fails, out, errs }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
