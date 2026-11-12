// r143 (Nov 12 2026, her note: «почему не все календари выходят… так у нас вроде для этого и есть полный репорт», then
// «отчеты ок»): the full report draws a calendar for every question in it, three to a page, and every link worth
// showing (was 3 calendars and the 6 strongest links); the short one stays one page with no calendar.
// Run from marketing/tools:  node aurora-tests/test-r143-report-calendars.mjs
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const fails = [], errs = [];
const ok = (name, cond, info = "") => { console.log(name, "→", cond ? "ok" : `FAIL ${JSON.stringify(info)}`.slice(0, 600)); if (!cond) fails.push(name); };
const p = await (await b.newContext({ locale: "en-US" })).newPage(); p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:8080/"); await p.waitForTimeout(1000);
await p.evaluate(async () => {
  localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "1");
  const g = await import("/src/lib/demoDataGenerator.ts"), st = await import("/src/lib/storage.ts"), dz = await import("/src/lib/doors.ts");
  const r = g.generateDemoData("work-home"); await st.saveTrackers(r.newTrackers); await st.saveEntries(r.newEntries);
  localStorage.setItem("memap_path_start", dz.daysAgoIso(59));
});
await p.reload(); await p.waitForTimeout(2500);
const r = await p.evaluate(async () => {
  const rep = await import("/src/lib/doctorReport.ts"), s = await import("/src/lib/storage.ts"), co = await import("/src/lib/correlations.ts"), isl = await import("/src/lib/islands.ts");
  const trackers = await s.getTrackers(), entries = await s.getEntries();
  const ids = rep.reportQuestions(trackers, entries, 60, "doctor").flatMap((g) => g.qs.map((x) => x.q.id));
  const draw = async (kind) => {
    const drawn = [], orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (str, ...rest) { drawn.push(String(str)); return orig.call(this, str, ...rest); };
    const pages = await rep.drawReport({ trackers, entries, notes: [], audience: "doctor", kind, ids, mainIds: [], days: 60, withNotes: false, name: "" });
    CanvasRenderingContext2D.prototype.fillText = orig;
    return { pages: pages.length, drawn };
  };
  const full = await draw("full"), short = await draw("short");
  const qs = trackers.filter((t) => ids.includes(t.id));
  const links = co.computeCorrelations(qs, entries, isl.LINKS_TOP).filter(isl.linkWorthShowing).length;
  return {
    questions: ids.length, calendars: full.drawn.filter((x) => x.startsWith("Calendar: ")).length, fullPages: full.pages,
    // a link's count line ("12 of 14 times · on other days …"; its spaces are no-break ones)
    counts: full.drawn.map((x) => x.replace(/ /g, " ")).filter((x) => /\d+ of \d+ times|Every time — \d+ of \d+/.test(x)).length, links,
    sample: full.drawn.filter((x) => /\d/.test(x) && /of/.test(x)).slice(0, 4),
    shortPages: short.pages, shortCalendars: short.drawn.filter((x) => x.startsWith("Calendar: ")).length,
  };
});
console.log(JSON.stringify(r));
ok("full: a calendar for every question", r.calendars === r.questions && r.questions >= 8, r);
ok("full: three calendars to a page (no more pages than a third of them plus the rest)", r.fullPages <= Math.ceil(r.questions / 3) + 4, r);
ok("full: every link, more than the old 6", r.links > 6 && r.counts >= r.links, r);
ok("short: one page, no calendar", r.shortPages === 1 && r.shortCalendars === 0, r);
console.log(JSON.stringify({ fails, errs: errs.slice(0, 3) }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
