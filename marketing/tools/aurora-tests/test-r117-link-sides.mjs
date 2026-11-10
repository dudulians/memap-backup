// r117 (Nov 10 2026, her note: "Not drained → back pain the next day … что это вообще за вопрос такой? … явно что-то
// не так, сложности могут быть и с другими вопросами, где есть позитивные вопросы и негативные"). Every pair kind,
// through the app's own linkOf / linkWorthShowing / linkHead: a side told by its absence is only ever a good thing that
// was missing ("no workout", "short night"), never a hard or a neutral one ("not drained", "no wish to quit").
// Writes every shown headline (EN + RU) to work/r117/headlines.md for a read-through.
// Run from marketing/tools:  node aurora-tests/test-r117-link-sides.mjs
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "fs";
const D = "./aurora-tests/work/r117"; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await b.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:8080/"); await p.waitForTimeout(1500);
const res = await p.evaluate(async () => {
  const ls = await import("/src/lib/lifeStreams.ts");
  const isl = await import("/src/lib/islands.ts");
  const co = await import("/src/lib/correlations.ts");
  const lt = await import("/src/lib/linkText.ts");
  const { setLanguage } = await import("/src/lib/i18n.ts");
  const i18n = (await import("/src/lib/i18n.ts")).default;
  const seen = new Set(), T = [];
  for (const s of ls.LIFE_STREAMS) for (const tpl of s.templates) {
    if (seen.has(tpl.id) || tpl.answerType !== "boolean" || tpl.sensitive) continue; seen.add(tpl.id);
    T.push({ id: `t-${tpl.id}`, title: tpl.title, category: tpl.category, questionText: tpl.questionText, answerType: "boolean", periodDays: tpl.periodDays, threshold: tpl.threshold, problemWhen: tpl.problemWhen, adviceAboveThreshold: tpl.adviceAboveThreshold, createdAt: "2026-01-01T00:00:00Z", sortIndex: 0 });
  }
  const pol = (t) => co.trackerPolarity(t);
  // a few of each polarity, so every kind of pair is met (good × bad × neutral, both ways, same day and next day)
  const pick = (k, n) => T.filter((t) => pol(t) === k).filter((_, i) => i % 7 === 0).slice(0, n);
  const S = [...pick("bad", 14), ...pick("good", 10), ...pick("neutral", 6)];
  const strong = { bothYes: 14, aYesBNo: 3, aNoBYes: 3, bothNo: 14 }, weak = { bothYes: 3, aYesBNo: 14, aNoBYes: 14, bothNo: 3 };
  const fails = [], rows = [];
  for (const A of S) for (const B of S) {
    if (A === B) continue;
    for (const lag of [0, 1]) for (const phi of [0.5, -0.5]) {
      const c = { trackerA: A, trackerB: B, lag, phi, chiSquare: 20, sharedDays: 34, riskRatio: 2, semanticVerdict: "expected", counts: phi > 0 ? strong : weak, stage: "stable" };
      const l = isl.linkOf(c);
      const shown = isl.linkWorthShowing(c);
      // a side told by its absence is only a good thing that was missing
      const absentNotGood = (!l.firstYes && pol(l.first) !== "good") || (!l.secondYes && pol(l.second) !== "good");
      if (shown && absentNotGood) fails.push(`shown with an absent hard or neutral side: ${l.first.title} (${l.firstYes}) → ${l.second.title} (${l.secondYes})`);
      if (!shown) continue;
      const r = { first: l.first.id, second: l.second.id, firstYes: l.firstYes, secondYes: l.secondYes, nextDay: l.nextDay, k: l.k, n: l.n, other: l.other };
      const of = lt.trackerLookup(T);
      const row = { kind: `${pol(l.first)}${l.firstYes ? "+" : "−"} → ${pol(l.second)}${l.secondYes ? "+" : "−"}` };
      for (const lng of ["en", "ru"]) { setLanguage(lng); row[lng] = lt.linkHead(i18n.t.bind(i18n), r, of); }
      rows.push(row);
    }
  }
  setLanguage("en");
  return { fails, rows, sample: S.length };
});
const kinds = {};
for (const r of res.rows) (kinds[r.kind] ??= []).push(r);
const md = Object.entries(kinds).map(([k, rs]) => `## ${k} (${rs.length})\n` + [...new Map(rs.map((r) => [r.en, r])).values()].slice(0, 25).map((r) => `- ${r.en}  /  ${r.ru}`).join("\n")).join("\n\n");
writeFileSync(`${D}/headlines.md`, md);
console.log(JSON.stringify({ fails: res.fails.slice(0, 20), failCount: res.fails.length, shown: res.rows.length, kinds: Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, v.length])), errs }, null, 1));
await b.close();
process.exit(res.fails.length || errs.length ? 1 : 0);
