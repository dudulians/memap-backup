// r164 (Nov 14 2026, branch design/one-system): her four decisions after the first-days walks.
// 1. A typed question is kept exactly as typed: no capital letter, no "?", and its card keeps "today" in it.
// 2. No near-copies: the hunch never offers "Feeling drained" beside "Drained after work"; a Worth watching tip never
//    suggests a near-copy of a question she asks; her own words ("a glass of wine") name the alcohol questions.
// 3. Her own typed question (ids "…-own") lives on "My own", in both languages, whatever its words.
// 4. "A report for your doctor" shows on Today three evenings, then steps back on its own.
// Run from marketing/tools with the dev server on 8080; exit 1 when a check fails.
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const check = (name, ok, info) => { out[name] = ok ? "ok" : `FAIL ${info !== undefined ? JSON.stringify(info).slice(0, 500) : ""}`; if (!ok) fails.push(name); };
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);

// 1–3 through the app's own modules
const r = await p.evaluate(async () => {
  const card = await import("/src/lib/cardText.ts");
  const isl = await import("/src/lib/islands.ts");
  const tw = await import("/src/lib/nearTwins.ts");
  const hu = await import("/src/lib/hunches.ts");
  const g = await import("/src/lib/demoDataGenerator.ts");
  const ap = await import("/src/lib/answerPhrases.ts");
  const own = (id, text) => ({ id, title: text.replace(/[?？]+$/, "").slice(0, 60), questionText: text, category: "Curious", answerType: "boolean", periodDays: 30, threshold: 10, problemWhen: "yes", adviceAboveThreshold: "", createdAt: "2026-11-14T10:00:00Z" });
  const typed = card.asQuestion("  бокал   вина вечером ");
  const husband = card.cardQuestion(own("1-own-a1", "Меня сегодня бесил муж"));
  const wineEn = isl.islandOf(own("2-own-b2", "Had a glass of wine in the evening"));
  const bedEn = isl.islandOf(own("3-own-c3", "Slept in the same bed"));
  const wineRu = isl.islandOf(own("4-own-d4", "бокал вина вечером"));
  const named = [...tw.namedBy("бокал вина вечером")], namedEn = [...tw.namedBy("Had a glass of wine in the evening?")], water = [...tw.namedBy("drank enough water")];
  // the hunch about the fights, for someone asked "drained after work"
  const d = g.generateDemoData("work-home");
  const fights = d.newTrackers.find((t) => ap.templateIdOf(t) === "argued-with-partner");
  const drained = d.newTrackers.find((t) => ap.templateIdOf(t) === "burned-out-after-work");
  const sus = fights ? hu.suspectsFor(fights, d.newTrackers) : [];
  const fresh = sus.filter((s) => s.kind === "template").map((s) => s.template.id);
  return { typed, husband, wineEn, bedEn, wineRu, named, namedEn, water, hasDrained: !!drained, fresh, covered: [...tw.coveredIds(d.newTrackers)] };
});
check("1: a typed question is kept as typed", r.typed === "бокал вина вечером", r.typed);
check("1: her own card keeps «сегодня»", r.husband === "Меня сегодня бесил муж", r.husband);
check("2: her own words name the alcohol questions (both languages), water names none", r.named.includes("drank-alcohol") && r.namedEn.includes("drank-alcohol") && r.water.length === 0, r);
check("2: with drained-after-work asked, the hunch offers no 'Feeling drained'", r.hasDrained && !r.fresh.includes("felt-fatigued") && !r.fresh.includes("had-energy"), r.fresh);
check("2: the covered list has the twins of what she asks", r.covered.includes("felt-fatigued"), r.covered);
check("3: her own questions live on My own, whatever the words, in both languages", r.wineEn === "mine" && r.bedEn === "mine" && r.wineRu === "mine", { wineEn: r.wineEn, bedEn: r.bedEn, wineRu: r.wineRu });

// 4: the doctor-report card on Today: shown while fewer than three evenings had it, then gone
const today = async (days, lang = "en") => {
  await p.evaluate(async ({ days, lang }) => {
    const iso = (n) => { const x = new Date(); x.setDate(x.getDate() - n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); const d = g.generateDemoData("work-home");
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(d.newTrackers)); localStorage.setItem("memap_entries", JSON.stringify(d.newEntries));
    localStorage.setItem("memap_path_start", [...d.newEntries.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1");
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_report_tip_days", JSON.stringify(days.map(iso)));
  }, { days, lang });
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(2600);
  // the card's own line (Malu's tips may name the report too)
  return p.evaluate(() => /links and notes on one page|связи и заметки на одной странице/.test(document.body.innerText));
};
check("4: first evening: the card shows", await today([]) === true);
check("4: after two other evenings: still shows (the third)", await today([1, 2]) === true);
check("4: after three other evenings: gone", await today([1, 2, 3]) === false);
check("4: on an evening it already showed: stays that evening", await today([0, 1, 2]) === true);
await b.close();
console.log(JSON.stringify({ out, errs }, null, 1));
if (fails.length || errs.length) process.exit(1);
