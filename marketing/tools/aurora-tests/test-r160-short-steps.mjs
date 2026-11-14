// r160 (Nov 14 2026): her note «меня бесит 17 вопросов заполнять подряд.. надо делить в тудей».
// With 17 questions no step on Today asks more than 7 in a row: in the first week and after it.
// Run from marketing/tools with the dev server on 8080; exit 1 when a step is longer.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = "./aurora-tests/work/r160"; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const check = (name, ok, info) => { out[name] = ok ? "ok" : "FAIL " + JSON.stringify(info ?? "").slice(0, 500); if (!ok) fails.push(name); };
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));

for (const [name, daysAgo] of [["first week", 0], ["week 3", 16]]) {
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  const all = await p.evaluate(async (daysAgo) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
    const g = await import("/src/lib/demoDataGenerator.ts"); const r = g.generateDemoData("work-home");
    // 17 questions: the pack's own, then copies of them under new names (same islands)
    const T = [...r.newTrackers]; let i = 0;
    while (T.length < 17) { const src = r.newTrackers[i % r.newTrackers.length]; T.push({ ...src, id: src.id + "-copy" + i, name: src.name + " (" + (i + 2) + ")", sortIndex: 100 + i }); i++; }
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T));
    const keep = daysAgo > 0 ? r.newEntries.filter((e) => e.date >= iso(daysAgo) && e.date < iso(0)) : [];
    localStorage.setItem("memap_entries", JSON.stringify(keep));
    localStorage.setItem("memap_path_start", iso(daysAgo));
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1");
    localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_playful_asked", "seed");
    const ps = await import("/src/lib/pathSteps.ts");
    return ps.pathModel(T, keep).steps.filter((s) => s.kind === "questions" || s.kind === "fill").map((s) => ({ id: s.id, kind: s.kind, n: s.trackerIds.length }));
  }, daysAgo);
  const fill = all.filter((s) => s.kind === "fill"), steps = all.filter((s) => s.kind === "questions");
  if (fill.length) check(name + ": a missed day asks one short step (" + fill[0].n + ")", fill[0].n <= 7 && fill[0].n >= 2, fill);
  out[name + ": steps"] = steps.map((s) => s.id + " = " + s.n).join(", ");
  const total = steps.reduce((a, s) => a + s.n, 0);
  check(name + ": all 17 questions are asked", total === 17, total);
  check(name + ": no step asks more than 7 in a row", steps.length >= 3 && steps.every((s) => s.n <= 7), steps);
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(2400);
  await p.screenshot({ path: D + "/" + name.replace(" ", "-") + ".png" });
  // open the first question step and count what it asks
  const opened = await p.evaluate(() => { const go = [...document.querySelectorAll("main button")].find((x) => ["Go", "Start"].includes(x.innerText.trim())); go?.click(); return go ? go.innerText.trim() : false; });
  await p.waitForTimeout(1800);
  await p.screenshot({ path: D + "/" + name.replace(" ", "-") + "-open.png" });
  out[name + ": first step opens"] = opened + " -> " + (await p.evaluate(() => document.body.innerText)).split(String.fromCharCode(10)).filter(Boolean).slice(0, 14).join(" | ").slice(0, 300);
}

// the missed day goes on in short steps once it is begun from the path, until the day is whole
await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
const walk = await p.evaluate(async () => {
  const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const T = JSON.parse(localStorage.getItem("memap_trackers")); let E = [];
  localStorage.setItem("memap_entries", "[]"); localStorage.setItem("memap_path_start", iso(0)); localStorage.removeItem("memap_fill_day");
  const ps = await import("/src/lib/pathSteps.ts");
  const seen = [];
  for (let k = 0; k < 6; k++) {
    const f = ps.pathModel(T, E, new Date(new Date().setHours(10, 0, 0, 0))).steps.find((s) => s.kind === "fill");
    if (!f) break;
    seen.push((f.part ? f.part.join("/") : "one") + ":" + f.trackerIds.length);
    ps.markFillDay(f.date);
    E = E.concat(f.trackerIds.map((id) => ({ id: id + f.date, trackerId: id, date: f.date, value: 0 })));
  }
  return { seen, answered: new Set(E.map((e) => e.trackerId)).size };
});
out["missed day: steps in turn"] = walk.seen.join(", ");
check("missed day: every question of it gets asked, in short steps", walk.answered === 17 && walk.seen.length >= 3 && walk.seen.every((x) => Number(x.split(":")[1]) <= 7), walk);

await b.close();
console.log(JSON.stringify(out, null, 1));
if (errs.length) console.log("PAGE ERRORS:", errs.slice(0, 5));
process.exit(fails.length || errs.length ? 1 : 0);
