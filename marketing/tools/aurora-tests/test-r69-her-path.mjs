// Her phone test (Nov 7 2026): a new person in the daytime, three topics, answers for YESTERDAY,
// then Today. What does Today offer when today isn't answered, and do the labels float?
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
// variant A (Nov 7 2026): "What brings you here?", then the islands open to show their topics
const whyStep = async (p, good = false) => {
  await p.getByRole("button", { name: good ? /more good days|хороших дней/i : /bothering me|повторяется и мешает/i }).first().click(); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelectorAll(".onb [aria-expanded=false]").forEach((b) => b.click())); await p.waitForTimeout(400);
};
const D = `./aurora-tests/work/r69`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], log = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
let n = 0;
const shot = async (name) => { await p.waitForTimeout(700); await p.screenshot({ path: `${D}/${String(++n).padStart(2, "0")}-${name}.png` }); };
const click = async (re) => { await p.getByRole("button", { name: re }).first().click(); await p.waitForTimeout(500); };
// real time (her test was at 15:27, daytime)
await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
await p.evaluate(() => { localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_theme", "aurora-light"); });
await p.reload(); await p.waitForTimeout(2200);
await shot("welcome");
await click(/^Get started/); await whyStep(p);
await click(/Migraine/); await click(/^Stress/); await click(/Low energy/);
await shot("topics");
// the list scrolls, the question stays
await p.locator(".onb-scroll").first().evaluate((e) => e.scrollTo(0, 9999)).catch(() => {});
log.push({ titleTopAfterScroll: await p.locator(".onb h1").first().evaluate((h) => Math.round(h.getBoundingClientRect().top)) });
await shot("topics-scrolled");
await click(/^Continue/); await p.waitForTimeout(500);
await shot("questions");
await p.locator(".onb-scroll").first().evaluate((e) => e.scrollTo(0, 9999)).catch(() => {});
log.push({ qTitleTopAfterScroll: await p.locator(".onb h1").first().evaluate((h) => Math.round(h.getBoundingClientRect().top)) });
await shot("questions-scrolled");
await click(/^Continue/); await p.waitForTimeout(800);
await shot("value");
await click(/Answer today's questions/); await p.waitForTimeout(900);
await shot("which-day");
const sheet = p.locator("div.fixed.inset-0.items-end").last(); await sheet.getByRole("button", { name: /Yesterday/ }).first().click(); await p.waitForTimeout(400); await sheet.getByRole("button", { name: /^Continue/ }).first().click(); await p.waitForTimeout(1800);
for (let i = 0; i < 14; i++) {
  const tgt = p.getByRole("button", { name: i % 2 ? /^No$/ : /^Yes$/ }).last();
  if (!(await tgt.isVisible().catch(() => false))) break;
  if (!(await tgt.click({ timeout: 3000 }).then(() => true).catch(() => false))) break; await p.waitForTimeout(650);
}
await p.waitForTimeout(1500); await shot("after-answers");
// "Show me around", then the tour to its end ("My next step")
await p.waitForTimeout(2000);
const notNow = p.getByRole("button", { name: /^Not now$/ }).last();
if (await notNow.isVisible().catch(() => false)) { await shot("reminder"); await notNow.click(); await p.waitForTimeout(800); }
log.push({ around: await p.getByRole("button", { name: /Show me around/ }).count() });
await p.getByRole("button", { name: /Show me around/ }).last().click({ timeout: 8000 }).catch((e) => log.push({ aroundErr: e.message.split(/\r?\n/).filter((l) => /intercepts|not stable|outside|detached/.test(l)).slice(0, 3).join(" | ") }));
await p.waitForTimeout(2500); await shot("after-around");
for (let k = 0; k < 14; k++) {
  const nx = p.getByRole("button", { name: /^(Next|My next step)/ }).last();
  if (!(await nx.isVisible().catch(() => false))) break;
  const label = (await nx.innerText()).trim(); await nx.click().catch(() => {}); await p.waitForTimeout(1300);
  if (/My next step/.test(label)) break;
}
// skip the reminder/tour if asked, reach Today
for (let k = 0; k < 6; k++) {
  const btn = p.getByRole("button", { name: /^(Not now|Later|Skip|See your world|Close|Got it|Done)$/ }).first();
  if (await btn.isVisible().catch(() => false)) { await btn.click().catch(() => {}); await p.waitForTimeout(900); } else break;
}
await p.waitForTimeout(1500); await shot("today");
log.push({ todaySteps: await p.evaluate(() => [...document.querySelectorAll("[data-wheel] *, .path-label, .path-step-label, [class*=label]")].map((x) => x.textContent?.trim()).filter((s) => s && s.length < 40).slice(0, 30)) });
// scroll the path a bit, then look again
await p.mouse.move(195, 600); await p.mouse.wheel(0, 400); await p.waitForTimeout(250); await shot("today-scrolling");
await p.waitForTimeout(1200); await shot("today-scrolled");
await p.mouse.wheel(0, -800); await p.waitForTimeout(1200); await shot("today-top");
// Done for today before today is answered: what does it say?
const done = p.locator("button[aria-label*=\"Done for today\"]").first();
if (true) { const box = await p.getByText("The end of today's path", { exact: true }).first().boundingBox(); if (box) await p.mouse.click(box.x + box.width / 2, box.y - 60); await p.waitForTimeout(1200); await shot("done-card"); log.push({ doneCard: await p.evaluate(() => document.querySelector("[role=dialog], .path-card, [class*=bubble]")?.innerText?.replace(/s+/g, " ").slice(0, 200) ?? "") }); }
console.log(JSON.stringify({ log, errs }, null, 1));
await b.close();
