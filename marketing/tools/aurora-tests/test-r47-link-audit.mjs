// Link audit (Nov 6 2026, her note: "После «Был(а) на свежем воздухе» на следующий день
// было «Чувствовал(а) усталость весь день» — 11 из 16" reads as if the walk brought the
// tiredness, while she had answered NO walk). Uses the phone link's own answers
// (work/r47-seed.json, moved so the last evening is yesterday, as the link does) and lists
// every link: stage, phi, chi², the four counts; then the routes the map draws, in words.
// Run from marketing/tools: node aurora-tests/test-r47-link-audit.mjs ru|en
import { chromium } from "playwright-core";
import { readFileSync } from "fs";
const seed = JSON.parse(readFileSync("./aurora-tests/work/r47-seed.json", "utf8"));
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await (await b.newContext()).newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
const lang = process.argv[2] ?? "ru";
const out = await p.evaluate(async ({ lang, seed }) => {
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const T = seed.T, E = seed.E.map((e) => ({ ...e }));
  const max = E.reduce((m, e) => (e.date > m ? e.date : m), "");
  const [y, mo, d] = max.split("-").map(Number), y1 = new Date(); y1.setDate(y1.getDate() - 1);
  const shift = Math.round((new Date(y1.getFullYear(), y1.getMonth(), y1.getDate()) - new Date(y, mo - 1, d)) / 864e5);
  for (const e of E) { const [a, b2, c2] = e.date.split("-").map(Number); const x = new Date(a, b2 - 1, c2); x.setDate(x.getDate() + shift); e.date = iso(x); }
  const c = await import("/src/lib/correlations.ts"), isl = await import("/src/lib/islands.ts"), i18n = (await import("/src/lib/i18n.ts")).default;
  const tt = await import("/src/lib/trackerLocalize.ts").catch(() => null);
  await i18n.changeLanguage(lang);
  const islands = isl.buildIslands(T, E);
  const all = c.computeCorrelations(T.filter((t) => !t.archived), E, 40).map((r) => ({
    a: r.trackerA.title + " [" + isl.islandOf(r.trackerA) + "]", b: r.trackerB.title + " [" + isl.islandOf(r.trackerB) + "]", show: isl.linkWorthShowing(r), lag: r.lag, stage: r.stage, phi: +r.phi.toFixed(2), chi: +r.chiSquare.toFixed(1),
    frame: c.correlationFrame(c.trackerPolarity(r.trackerA), c.trackerPolarity(r.trackerB), r.phi), counts: r.counts,
  }));
  const lt = await import("/src/lib/linkText.ts").catch(() => null);
  const title = (id) => T.find((x) => x.id === id); // linkText takes the question itself (answer phrases, v80)
  const routes = isl.buildRoutes(T, E, islands).map((r) => ({ a: r.a, b: r.b, k: r.k, n: r.n, other: r.other, text: lt ? lt.linkSentence(i18n.t, r, title) : `${r.first} → ${r.second}`, otherText: lt?.linkOther ? lt.linkOther(i18n.t, r) : "" }));
  // every link that may show, in words (the "without" ones too)
  const words = c.computeCorrelations(T.filter((t) => !t.archived), E, 40).filter(isl.linkWorthShowing).map((r) => {
    const l = isl.linkOf(r), rt = { ...l, first: l.first.id, second: l.second.id };
    return `${lt.linkArrow(i18n.t, rt, title)}  ·  ${lt.linkSentence(i18n.t, rt, title)} ${lt.linkOther(i18n.t, rt)}`;
  });
  return { all, routes, words };
}, { lang, seed });
const o = { ...out, errs };
for (const r of o.all) console.log([r.show ? "SHOW" : "hide", r.stage, r.lag, "phi", r.phi, "chi", r.chi, r.frame, JSON.stringify(r.counts), r.a, "→", r.b].join(" "));
console.log("\nROUTES");
for (const r of o.routes) console.log(`${r.a}–${r.b} ${r.k}/${r.n}  ${r.text}  ${r.otherText ?? ""}`);
console.log("\nIN WORDS");
for (const w of o.words) console.log(w);
console.log("errs", errs);
await b.close();
