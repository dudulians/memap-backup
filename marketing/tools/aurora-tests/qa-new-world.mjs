// QA (Nov 8 2026): World tab (first visit), its 4 cards, an island sheet, Notes and You — from a saved state.
// usage: node aurora-tests/qa-new-world.mjs <tag> <stateTag> <lang> <hour> <theme> <dayOffset>
import { chromium } from "playwright-core";
import { writeFileSync, readFileSync } from "fs";
const [tag = "w1", stateTag = "s2p", lang = "en", hourS = "21", theme = "aurora-light", offS = "0"] = process.argv.slice(2);
const RU = lang === "ru", hour = Number(hourS), dayOff = Number(offS);
const D = `./aurora-tests/work/qa-new`;
const state = JSON.parse(readFileSync(`${D}/${stateTag}-state.json`, "utf8"));
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], log = [];
const ctx = await b.newContext({ storageState: state, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, locale: RU ? "ru-RU" : "en-US", timezoneId: RU ? "Europe/Moscow" : "Asia/Dubai" });
const p = await ctx.newPage();
p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && !/InAppReview|favicon|Failed to load resource/.test(m.text()) && errs.push(m.text()));
const t0 = new Date(2026, 10, 8 + dayOff); t0.setHours(Math.floor(hour), 10, 0, 0);
await p.clock.install({ time: t0 });
await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
await p.evaluate((theme) => localStorage.setItem("memap_theme", theme), theme);
await p.reload(); await p.waitForTimeout(2800);
let n = 0;
const shot = async (name) => {
  await p.waitForTimeout(900);
  const file = `${D}/${tag}-${String(++n).padStart(2, "0")}-${name}.png`;
  await p.screenshot({ path: file });
  log.push({ shot: file.split("/").pop(), dialogs: await p.evaluate(() => [...document.querySelectorAll("[role=dialog]")].filter((d) => d.getBoundingClientRect().height > 0).map((d) => d.innerText.replace(/\s+/g, " ").slice(0, 900))), text: await p.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 600)) });
};
const vis = async (loc) => loc.isVisible().catch(() => false);
const close = async () => {
  for (let k = 0; k < 4; k++) {
    const c = p.locator(`[role=dialog] button[aria-label="${RU ? "Закрыть" : "Close"}"], [role=dialog] button:text-is("${RU ? "Закрыть" : "Close"}"), [role=dialog] button:text-is("×")`).last();
    if (await vis(c)) { await c.click().catch(() => {}); await p.waitForTimeout(600); continue; }
    if (await p.locator("[role=dialog]").count()) { await p.keyboard.press("Escape"); await p.waitForTimeout(500); }
    else break;
  }
};
try {
  await close();
  await p.locator("nav button").nth(1).click(); await p.waitForTimeout(2600);
  await shot("world-first");
  await close();
  await shot("world");
  for (const re of RU ? [/Мои дни/, /Связи/, /Когда действовать/, /Что помогает/] : [/My days/, /Links/, /When to act/, /What helps/]) {
    const card = p.getByRole("button", { name: re }).first();
    if (!(await vis(card))) { log.push({ cardMissing: String(re) }); continue; }
    await card.click().catch((e) => log.push({ cardErr: String(re), e: e.message.slice(0, 100) })); await p.waitForTimeout(1400);
    const nm = String(re).replace(/[^a-zа-я]/gi, "").slice(0, 12);
    await shot(`card-${nm}`);
    await p.evaluate(() => { const d = [...document.querySelectorAll("[role=dialog]")].pop(); const sc = d && ([...d.querySelectorAll("*")].find((x) => x.scrollHeight > x.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(x).overflowY)) || d); sc?.scrollTo(0, 700); });
    await shot(`card-${nm}-scrolled`);
    await close();
  }
  // an island: its name on the globe
  const labels = await p.evaluate(() => [...document.querySelectorAll(".planet-label")].map((x) => x.textContent?.trim()).filter(Boolean));
  log.push({ islandLabels: labels });
  const isl = p.locator(".planet-label").filter({ hasText: RU ? /Здоровье/ : /Health/ }).first();
  if (await vis(isl)) {
    await isl.click({ force: true }).catch(() => {}); await p.waitForTimeout(1600); await shot("island");
    await p.evaluate(() => { const d = [...document.querySelectorAll("[role=dialog]")].pop(); const sc = d && ([...d.querySelectorAll("*")].find((x) => x.scrollHeight > x.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(x).overflowY)) || d); sc?.scrollTo(0, 800); });
    await shot("island-scrolled");
    await p.evaluate(() => { const d = [...document.querySelectorAll("[role=dialog]")].pop(); const sc = d && ([...d.querySelectorAll("*")].find((x) => x.scrollHeight > x.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(x).overflowY)) || d); sc?.scrollTo(0, 99999); });
    await shot("island-bottom");
    await close();
  } else log.push({ island: "Health label not visible" });
  await p.locator("nav button").nth(2).click(); await p.waitForTimeout(1600);
  await shot("notes");
  const add = p.getByRole("button", { name: RU ? /Написать|заметк/i : /Write a note|New note|note/i }).first();
  if (await vis(add)) { await add.click().catch(() => {}); await p.waitForTimeout(1200); await shot("notes-new"); await close(); }
  await p.locator("nav button").nth(0).click(); await p.waitForTimeout(1500);
  const you = p.locator("header button").last();
  await you.click().catch(() => {}); await p.waitForTimeout(1600);
  await shot("you");
  await p.mouse.wheel(0, 800); await p.waitForTimeout(800); await shot("you-2");
  await p.mouse.wheel(0, 800); await p.waitForTimeout(800); await shot("you-3");
} catch (e) { errs.push("SCRIPT: " + e.message.slice(0, 300)); await shot("crash").catch(() => {}); }
writeFileSync(`${D}/${tag}-log.json`, JSON.stringify({ log, errs }, null, 1));
console.log(`done ${tag}: ${n} shots, ${errs.length} errors`);
await ctx.close(); await b.close();
