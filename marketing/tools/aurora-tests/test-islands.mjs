// Islands: Work + My own appear for old questions; make "Dog", add a question, move one there.
import { chromium } from "playwright-core";
const D = "./aurora-tests/work";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true })).newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:8080/"); await p.waitForTimeout(900);
await p.evaluate(async () => {
  const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
  for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
  const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
  const base = { answerType: "boolean", periodDays: 30, threshold: 10, adviceAboveThreshold: "", createdAt: new Date().toISOString() };
  T.push({ ...base, id: "own-typed-1", title: "Called my sister", questionText: "Called my sister?", category: "Curious", problemWhen: "no" });
  T.push({ ...base, id: "work-1", title: "Boss was difficult", questionText: "Was your boss difficult today?", category: "Social", problemWhen: "yes" });
  const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId));
  localStorage.clear();
  localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
  localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true");
  localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
});
await p.reload(); await p.waitForTimeout(1600);
await p.getByRole("button", { name: /^map$/i }).click(); await p.waitForTimeout(1500);
const out = {};
out.islands = await p.evaluate(() => [...document.querySelectorAll("main button[aria-label]")].map((e) => e.getAttribute("aria-label")).join(" | "));
// make "Dog"
await p.getByRole("button", { name: /new island/i }).first().click(); await p.waitForTimeout(800);
await p.getByRole("button", { name: /my own topic/i }).click(); await p.waitForTimeout(800);
await p.getByLabel("Island name").fill("Dog"); await p.waitForTimeout(200);
out.dogIcon = await p.evaluate(() => document.querySelector('[aria-pressed="true"][aria-label]')?.getAttribute("aria-label"));
await p.screenshot({ path: `${D}/islands-editor.png` });
await p.getByRole("button", { name: /^create island$/i }).click(); await p.waitForTimeout(1200);
out.dogSheet = await p.evaluate(() => (document.querySelector('[role="dialog"]')?.innerText || "").split("\n").filter(Boolean).slice(0, 12).join(" | "));
await p.getByLabel("Add a question here").fill("walked the dog"); await p.waitForTimeout(100);
await p.getByRole("button", { name: /^add$/i }).click(); await p.waitForTimeout(400);
out.asked = await p.evaluate(() => (document.querySelector('[role="dialog"]')?.innerText || "").includes("Good or hard?"));
await p.getByRole("button", { name: /^good$/i }).click(); await p.getByRole("button", { name: /^add$/i }).click(); await p.waitForTimeout(1000);
out.afterAdd = await p.evaluate(() => (document.querySelector('[role="dialog"]')?.innerText || "").split("\n").filter(Boolean).slice(0, 10).join(" | "));
await p.screenshot({ path: `${D}/islands-dog.png` });
await p.keyboard.press("Escape"); await p.waitForTimeout(800);
out.mapAfter = await p.evaluate(() => [...document.querySelectorAll("main button[aria-label]")].map((e) => e.getAttribute("aria-label")).join(" | "));
await p.screenshot({ path: `${D}/islands-map.png` });
// stored question
out.stored = await p.evaluate(() => JSON.parse(localStorage.getItem("memap_trackers")).filter((t) => t.island).map((t) => `${t.questionText} → ${t.island} (${t.problemWhen})`));
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
