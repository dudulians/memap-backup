// r145 (Nov 12 2026, her pick «Луна + как в телефоне»): a new install starts in the phone's own dark or light; the first
// onboarding screen has a moon (sun at night) next to the language button that switches it; someone who already has
// questions is never switched.
// Run from marketing/tools:  node aurora-tests/test-r145-night-onboarding.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r145`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const fails = [], errs = [];
const ok = (name, cond, info = "") => { console.log(name, "→", cond ? "ok" : `FAIL ${JSON.stringify(info)}`.slice(0, 400)); if (!cond) fails.push(name); };
const fresh = async (scheme, seed) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, locale: "en-US" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(600);
  await p.evaluate((seed) => { localStorage.clear(); localStorage.setItem("memap_ab_onb", "A"); localStorage.setItem("memap_ui", "new"); if (seed) localStorage.setItem("memap_trackers", JSON.stringify([{ id: "x", title: "Had a headache", questionText: "Did you have a headache today?", category: "Body", answerType: "boolean", problemWhen: "yes", periodDays: 30, threshold: 0, adviceAboveThreshold: "", createdAt: new Date().toISOString() }])); }, seed);
  await p.reload(); await p.waitForTimeout(2200);
  return { ctx, p };
};
const state = (p) => p.evaluate(() => ({ stored: localStorage.getItem("memap_theme"), attr: document.documentElement.getAttribute("data-theme"), moon: !!document.querySelector("[data-night-toggle]") }));

{ const { ctx, p } = await fresh("dark", false);
  const s = await state(p);
  ok("dark phone, new install: starts at night", s.stored === "aurora" && s.attr === "aurora", s);
  ok("the moon is on the first screen", s.moon, s);
  await p.screenshot({ path: `${D}/1-dark-phone-welcome.png` });
  await p.locator("[data-night-toggle]").click(); await p.waitForTimeout(900);
  const s2 = await state(p);
  ok("a tap switches to day", s2.stored === "aurora-light" && s2.attr === "aurora-light", s2);
  await p.screenshot({ path: `${D}/2-switched-to-day.png` });
  await ctx.close(); }
{ const { ctx, p } = await fresh("light", false);
  const s = await state(p);
  ok("light phone, new install: starts in day", s.stored === "aurora-light" && s.attr === "aurora-light", s);
  await p.locator("[data-night-toggle]").click(); await p.waitForTimeout(900);
  const s2 = await state(p);
  ok("a tap switches to night", s2.stored === "aurora" && s2.attr === "aurora", s2);
  await p.screenshot({ path: `${D}/3-switched-to-night.png` });
  await ctx.close(); }
{ const { ctx, p } = await fresh("dark", true);
  const s = await state(p);
  ok("someone with questions already is not switched by the phone", s.stored === null, s);
  await ctx.close(); }
console.log(JSON.stringify({ fails, errs: errs.slice(0, 3) }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
