// Steps, not evenings: a topic step opens only its questions, ends on "Done!", and the next step becomes current.
// Also: a new user (door, first answer 2 days ago) sees day-1 steps done, one question step, a note task.
import { chromium } from "playwright-core";
const D = "./aurora-tests/work";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true })).newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
const out = {};
const seed = async (who) => {
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(900);
  await p.evaluate(async (who) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    localStorage.clear();
    if (who === "demo") {
      const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
      for (const id of ["showcase", "relationship-reality", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
      const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
      const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId) && e.date !== iso(0));
      localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    } else {
      const dz = await import("/src/lib/doors.ts");
      const { trackerId, contextTrackerIds } = await dz.ensureDoorTrackers(dz.getDoor("fights"));
      dz.saveDoorState({ id: "fights", trackerId, contextTrackerIds, startedAt: iso(0) });
      localStorage.setItem("memap_entries", JSON.stringify([{ id: "first", trackerId, date: iso(2), value: true }]));
    }
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true");
    localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
  }, who);
  await p.reload(); await p.waitForTimeout(2200);
};
const labels = () => p.evaluate(() => [...document.querySelectorAll("[data-path-stop]")].map((e) => e.getAttribute("aria-label")).filter(Boolean).join(" | "));

await seed("new");
out.newCoins = await labels();
out.newBanner = await p.evaluate(() => (document.getElementById("memap-header-center")?.innerText ?? "none").replace(/\n+/g, " "));
await p.screenshot({ path: `${D}/steps-new.png` });

await seed("demo");
out.demoCoins = await labels();
await p.getByRole("button", { name: /^(start|старт)$/i }).first().click(); await p.waitForTimeout(1500);
out.deckHeader = await p.evaluate(() => (document.body.innerText.match(/[^\n]*\d+ of \d+/) || [""])[0]);
const total = Number((out.deckHeader.match(/of (\d+)/) || [])[1] || 0);
for (let k = 0; k < total; k++) { await p.getByRole("button", { name: /^yes$/i }).last().click(); await p.waitForTimeout(450); }
await p.waitForTimeout(600);
out.doneCard = await p.evaluate(() => document.body.innerText.split("\n").filter(Boolean).slice(0, 4).join(" | "));
await p.screenshot({ path: `${D}/steps-done-card.png` });
await p.getByRole("button", { name: /^continue$/i }).click(); await p.waitForTimeout(1500);
out.afterCoins = await labels();
out.currentLabel = await p.evaluate(() => [...document.querySelectorAll("section .absolute.z-10")].map((e) => e.innerText.replace(/\n+/g, " ")).join(" | "));
out.flame = await p.evaluate(() => document.getElementById("memap-header-start")?.innerText);
await p.screenshot({ path: `${D}/steps-after.png` });
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
