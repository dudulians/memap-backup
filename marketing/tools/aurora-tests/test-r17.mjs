// The review's crash (Nov 3 2026): on some phone heights, with the "days so
// far" chip and/or "Earlier weeks", the spacer above the path flipped back
// and forth until React gave up and the app showed its error screen. Every
// combination the reviewers reproduced, plus neighbours, must render Today.
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const out = [];
const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const cases = [];
for (const [w, h] of [[414, 814], [414, 716], [375, 590], [375, 600], [375, 640], [390, 844], [428, 840], [414, 801], [375, 667]])
  for (const data of ["chip+weeks", "weeks", "chip", "day1"]) cases.push({ w, h, data });
for (const c of cases) {
  const ctx = await b.newContext({ viewport: { width: c.w, height: c.h }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 120)));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(500);
  await p.evaluate(async ({ data, start20, start0 }) => {
    const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
    for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId));
    localStorage.clear();
    if (data === "day1") { T = T.slice(0, 3); E = []; }
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    const first = [...E.map((e) => e.date)].sort()[0];
    localStorage.setItem("memap_path_start", data === "day1" ? start0 : data === "weeks" ? first : data === "chip" ? start0 : start20);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true");
    localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
  }, { data: c.data, start20: iso(20), start0: iso(0) });
  await p.reload(); await p.waitForTimeout(1800);
  const r = await p.evaluate(() => ({
    crashed: /something went wrong/i.test(document.body.innerText),
    path: document.querySelectorAll(".path-node").length,
    chip: /so far/i.test(document.querySelector("main")?.innerText ?? ""),
    earlier: !!([...document.querySelectorAll("main button")].find((x) => /earlier/i.test(x.innerText))),
  }));
  out.push(`${c.w}x${c.h} ${c.data}: ${r.crashed ? "CRASHED" : "ok"} nodes=${r.path} chip=${r.chip} earlier=${r.earlier}${errs.length ? " errs=" + errs.join(" / ") : ""}`);
  await ctx.close();
}
console.log(out.join("\n"));
console.log("crashes:", out.filter((l) => /CRASHED|Maximum update/.test(l)).length, "of", out.length);
await b.close();
