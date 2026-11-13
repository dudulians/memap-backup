// r125 (her pick, Nov 10 2026: "Минимум медицины" — "только ты не удаляй, а как бы архивируй"). While
// MINIMAL_MEDICINE is on: no library plan mentions a doctor (therapists for couples/family and the vet stay); the 11
// clinical body questions are never offered (ideas, related, starters) but someone who has one keeps it and answers it;
// a saved doctor plan becomes the calm one on start; the 5 illness tips are never picked; the originals are still in the
// source files. EN + RU.  Run from marketing/tools: node aurora-tests/test-r125-minimal-medicine.mjs
import { chromium } from "playwright-core";
import { readFileSync } from "fs";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const ok = (name, cond, info = "") => { out[name] = cond ? "ok" : `FAIL ${typeof info === "string" ? info : JSON.stringify(info)}`.slice(0, 500); if (!cond) fails.push(name); };
const QUIET = ["pee-burning", "bladder-urgency", "bladder-leak", "piles-bothered", "night-sweats", "dizzy", "fingers-white-cold", "tinnitus-louder", "heavy-flow-day", "medicine-change", "hot-flushes"];
const KEEP_THERAPIST = new Set(["thought-about-leaving", "thought-divorce", "parent-pressured"]);

const ctx = await b.newContext(); const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:8080/"); await p.waitForTimeout(1500);
const lib = await p.evaluate(async ({ QUIET, KEEP }) => {
  const ls = await import("/src/lib/lifeStreams.ts"), ma = await import("/src/lib/medicalArchive.ts"), rq = await import("/src/lib/relatedQuestions.ts");
  const all = ls.LIFE_STREAMS.flatMap((s) => s.templates);
  const doctorPlans = all.filter((t) => !KEEP.includes(t.id) && /\b(doctor|GP|therapist|psychologist|dentist|counsell?or)\b|врач|терапевт|психолог|стоматолог/i.test(`${t.adviceAboveThreshold} ${t.adviceAboveThresholdRu}`)).map((t) => `${t.id}: ${t.adviceAboveThreshold}`);
  const ideas = new Set(); for (let i = 0; i < 300; i++) for (const x of ls.getRandomIdeas(8)) ideas.add(x.id);
  // someone who asks every other question: what would be suggested next to them
  const related = new Set(rq.getRelatedQuestions(all.filter((t) => !QUIET.includes(t.id)).map((t) => t.title)).map((r) => r.id));
  for (const t of all.slice(0, 120)) for (const r of rq.getRelatedQuestions([t.title])) related.add(r.id);
  const calm = all.filter((t) => ma.CALM_PLANS[t.id]).map((t) => ({ id: t.id, en: t.adviceAboveThreshold, ru: t.adviceAboveThresholdRu, kind: t.planKind }));
  const niche = (await import("/src/lib/nicheArchive.ts")).NICHE_IDS;
  // v131: the niche questions are quiet too (nicheArchive.ts); this test checks the medical ones
  return { on: ma.MINIMAL_MEDICINE, quiet: all.filter((t) => t.quiet && !niche.has(t.id)).map((t) => t.id).sort(), doctorPlans, ideasQuiet: QUIET.filter((id) => ideas.has(id)), relatedQuiet: QUIET.filter((id) => related.has(id)), calm, archived: ma.ARCHIVED_PLANS.size };
}, { QUIET, KEEP: [...KEEP_THERAPIST] });
ok("the switch is on", lib.on === true);
ok("the 11 clinical questions are quiet", lib.quiet.join() === [...QUIET].sort().join(), lib.quiet);
ok("no library plan mentions a doctor (couples/family therapists and the vet stay)", lib.doctorPlans.length === 0, lib.doctorPlans);
ok("quiet questions never come as ideas", lib.ideasQuiet.length === 0, lib.ideasQuiet);
ok("quiet questions never come as related questions", lib.relatedQuiet.length === 0, lib.relatedQuiet);
ok("every calm plan is one step, EN and RU, gender-free", lib.calm.every((c) => c.kind === "once" && c.en && c.ru && !/\((а|ась|ла)\)/.test(c.ru)) && lib.calm.length === 40, lib.calm.filter((c) => c.kind !== "once" || !c.en || !c.ru));
ok("the doctor plans are kept (archived) in memory, not lost", lib.archived >= 70, String(lib.archived));
// the originals are still in the source files
const src = ["../../src/lib/lifeStreams.ts", "../../src/lib/bodyTemplates.ts", "../../src/lib/researchTemplates.ts"].map((f) => readFileSync(f, "utf8")).join("\n");
ok("the original doctor plans are still in the source", ["See a GP about the bloating", "See a doctor and show your migraine days", "Talk to a therapist and show your days", "Сходить к терапевту из-за жжения"].every((x) => src.includes(x)));
await ctx.close();

// someone who already has a quiet question and a saved doctor plan
for (const lang of ["en", "ru"]) {
  const RU = lang === "ru";
  const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: RU ? "ru-RU" : "en-US" });
  const q = await c2.newPage(); q.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  await q.clock.install({ time: new Date(2026, 10, 10, 20, 0, 0) });
  await q.goto("http://localhost:8080/"); await q.waitForTimeout(800);
  await q.evaluate(async (lang) => {
    localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1");
    localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order"])); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1");
    localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" })); localStorage.setItem("memap_first_link_seen", "before");
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    const [burn, bloat] = await dz.ensureTemplates(["pee-burning", "bloated"]);
    const at = new Date("2026-11-02T09:00:00").toISOString();
    // the bloating question saved with the old doctor plan, as an old install would have it
    await st.saveTrackers((await st.getTrackers()).map((t) => ({ ...t, createdAt: at, ...(t.id === bloat ? { adviceAboveThreshold: lang === "ru" ? "Сходить к терапевту из-за вздутия" : "See a GP about the bloating" } : {}) })));
    localStorage.setItem("memap_onboarded_at", at); localStorage.setItem("memap_path_start", "2026-11-02");
    const E = []; for (const d of ["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09"]) { E.push({ id: `${d}-b`, trackerId: burn, date: d, value: false, createdAt: `${d}T21:00:00.000Z` }, { id: `${d}-l`, trackerId: bloat, date: d, value: true, createdAt: `${d}T21:00:00.000Z` }); }
    await st.saveEntries(E);
  }, lang);
  await q.reload(); await q.waitForTimeout(2600);
  const st = await q.evaluate(async () => {
    const s = await import("/src/lib/storage.ts"), dz = await import("/src/lib/doors.ts");
    const T = await s.getTrackers();
    return { titles: T.map((t) => t.title), bloatPlan: T.find((t) => /bloat|вздути/i.test(t.title))?.adviceAboveThreshold ?? "", burnKept: T.some((t) => /burn|жжени/i.test(t.title) && !t.archived) };
  });
  ok(`${lang}: a quiet question someone has stays`, st.burnKept, st.titles);
  ok(`${lang}: a saved doctor plan became the calm one`, st.bloatPlan === (RU ? "Посмотреть, что было в еде перед вздутием" : "Look back at what you ate before the bloating"), st.bloatPlan);
  // and it is still asked in the evening
  await q.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-session"))); await q.waitForTimeout(1500);
  const cards = [];
  for (let i = 0; i < 4; i++) { const c = await q.evaluate(() => [...document.querySelectorAll("p")].filter((x) => x.className.includes("[text-wrap:balance]") && x.className.includes("font-bold") && !x.closest('[aria-hidden="true"]')).map((x) => x.textContent.trim()).pop() ?? null); if (!c) break; cards.push(c); await q.getByRole("button", { name: RU ? /^Нет$/ : /^No$/ }).last().tap(); await q.waitForTimeout(800); }
  ok(`${lang}: the quiet question is still asked`, cards.some((c) => /burn|жжен|жгло/i.test(c)), cards);
  await c2.close();
}

// tips: the 5 illness tips are never picked
{
  const c3 = await b.newContext(); const r = await c3.newPage();
  await r.goto("http://localhost:8080/"); await r.waitForTimeout(1200);
  const picks = await r.evaluate(async () => {
    const o = await import("/src/lib/observeTips.ts"); const got = new Set();
    const dz = await import("/src/lib/doors.ts");
    // since v129 a tip comes only for a question of hers it talks about: someone with a wide set of questions
    const W = ["woke-at-night", "felt-happy", "headache", "heartburn", "felt-anxious", "outside-30min", "felt-lonely", "felt-close-to-partner", "felt-overwhelmed-parenting", "main-thing-done", "smoked-hookah", "had-energy"]
      .map((q) => { const f = dz.findTemplate(q); return { id: `w-${q}`, title: f.template.title, questionText: f.template.questionText, category: f.template.category, cluster: f.clusterId, archived: false }; });
    for (let i = 0; i < 70; i++) { const d = new Date(2026, 10, 10 + i); const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; const x = o.tipForToday(W, iso); if (x) { got.add(x.tip.templateId); o.markTip(x.tip.id, "later"); } }
    return [...got];
  });
  const banned = ["skipped-meal", "took-painkiller", "neck-pain", "period-day", "stomach-issues", "hobby-time"];
  ok("illness tips are never picked", banned.every((x) => !picks.includes(x)) && picks.length >= 25, { bad: picks.filter((x) => banned.includes(x)), n: picks.length });
  await c3.close();
}
console.log(JSON.stringify({ fails, out, errs }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
