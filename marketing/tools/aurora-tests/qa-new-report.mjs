// QA (Nov 8 2026): day 8 morning — open the first week's report from its light on Today and read it.
import { chromium } from "playwright-core";
import { writeFileSync, readFileSync } from "fs";
const D = `./aurora-tests/work/qa-new`, tag = "rep2";
const state = JSON.parse(readFileSync(`${D}/d7pm-state.json`, "utf8"));
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], log = [];
const ctx = await b.newContext({ storageState: state, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, locale: "en-US", timezoneId: "Asia/Dubai" });
const p = await ctx.newPage();
p.on("pageerror", (e) => errs.push(e.message));
const t0 = new Date(2026, 10, 15); t0.setHours(10, 10, 0, 0);
await p.clock.install({ time: t0 });
await p.goto("http://localhost:8080/"); await p.waitForTimeout(3000);
let n = 0;
const shot = async (name) => { await p.waitForTimeout(900); const f = `${D}/${tag}-${String(++n).padStart(2, "0")}-${name}.png`; await p.screenshot({ path: f }); log.push({ shot: f.split("/").pop(), dialogs: await p.evaluate(() => [...document.querySelectorAll("[role=dialog]")].filter((d) => d.getBoundingClientRect().height > 0).map((d) => d.innerText.replace(/\s+/g, " ").slice(0, 1500))) }); };
try {
  await shot("today-on-open");
  const node = p.locator(".path-node[aria-label='Week report']").first();
  await node.scrollIntoViewIfNeeded(); await node.click(); await p.waitForTimeout(1200);
  await shot("report-splash");
  await p.getByRole("button", { name: /See the report/ }).first().click(); await p.waitForTimeout(2000);
  await shot("report");
  for (let k = 0; k < 10; k++) {
    const nx = p.getByRole("button", { name: /^(Next|Done|Finish|Close report)/ }).last();
    if (!(await nx.isVisible().catch(() => false))) break;
    await nx.click().catch(() => {}); await p.waitForTimeout(1300);
    await shot(`slide${k}`);
  }
  const close = p.locator("[role=dialog] button[aria-label='Close']").last();
  if (await close.isVisible().catch(() => false)) { await close.click(); await p.waitForTimeout(1500); }
  await shot("after-report");
  log.push({ chest: await p.evaluate(() => document.body.innerText.match(/Chest[^\n]{0,60}/)?.[0] ?? "") });
} catch (e) { errs.push("SCRIPT: " + e.message.slice(0, 300)); await shot("crash").catch(() => {}); }
writeFileSync(`${D}/${tag}-log.json`, JSON.stringify({ log, errs }, null, 1));
console.log(`done ${tag}: ${n} shots, ${errs.length} errors`);
await ctx.close(); await b.close();
