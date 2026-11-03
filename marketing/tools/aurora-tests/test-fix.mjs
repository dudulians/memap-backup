// Her Nov 2 list: yesterday as a step, "Not today" on a task, change answers.
import { chromium } from "playwright-core";
const D = "./aurora-tests/work";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true })).newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
const seed = async (mode) => {
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(900);
  await p.evaluate(async (mode) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
    for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId) && e.date !== iso(0));
    if (mode === "missed") E = E.filter((e) => e.date !== iso(1));
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    localStorage.setItem("memap_path_start", [...E.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true");
    localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
  }, mode);
  await p.reload(); await p.waitForTimeout(2200);
};
const coins = () => p.evaluate(() => [...document.querySelectorAll("[data-path-stop]")].map((e) => e.getAttribute("aria-label")).filter(Boolean).join(" | "));
const dialog = () => p.evaluate(() => (document.querySelector('[role="dialog"]')?.innerText || "").split("\n").filter(Boolean).join(" | "));
const out = {};

await seed("missed");
out.missedCoins = await coins();
out.missedAction = await p.evaluate(() => [...document.querySelectorAll("section button")].map((b) => b.innerText.replace(/\n+/g, " ")).find((x) => /→/.test(x)));
await p.screenshot({ path: `${D}/fix-missed.png` });
await p.getByRole("button", { name: /^start$/i }).first().click(); await p.waitForTimeout(1500);
out.missedDeck = await p.evaluate(() => (document.body.innerText.match(/[^\n]*\d+ of \d+/) || [""])[0]);

await seed("plain");
// skip the task
await p.locator('[aria-label="Write a note"]').click(); await p.waitForTimeout(400);
out.taskBubble = await dialog();
await p.getByRole("button", { name: /^not today$/i }).click(); await p.waitForTimeout(500);
out.afterSkip = await p.evaluate(() => [...document.querySelectorAll("section")].map((s) => s.innerText).join(" ").match(/Write a note\s+Skipped/) ? "skipped shown" : "no");
// answer one topic, then change its answers
await p.getByRole("button", { name: /^start$/i }).first().click(); await p.waitForTimeout(1400);
const total = Number(((await p.evaluate(() => (document.body.innerText.match(/of (\d+)/) || [])[1])) || 0));
for (let k = 0; k < total; k++) { await p.getByRole("button", { name: /^no$/i }).last().click(); await p.waitForTimeout(420); }
await p.waitForTimeout(500); await p.getByRole("button", { name: /^continue$/i }).click(); await p.waitForTimeout(1400);
const firstDone = await p.evaluate(() => [...document.querySelectorAll("[data-path-stop]")].find((e) => e.querySelector(".lucide-check") && /Health|Me|Love/.test(e.getAttribute("aria-label") || ""))?.getAttribute("data-path-stop"));
await p.locator(`[data-path-stop="${firstDone}"]`).click(); await p.waitForTimeout(400);
out.doneBubble = await dialog();
await p.getByRole("button", { name: /change answers/i }).click(); await p.waitForTimeout(1400);
out.redoCard = await p.evaluate(() => (document.body.innerText.match(/Now: (Yes|No)/) || [""])[0]);
await p.screenshot({ path: `${D}/fix-redo.png` });
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
