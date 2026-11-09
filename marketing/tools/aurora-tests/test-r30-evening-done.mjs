// Tonight is done (her idea, Nov 5 2026; then "не нравится эта табличка на постоянке"):
// no card stays on the path; tapping tonight's last light opens "Great work today!" with
// bubbles or new questions. EN/RU, day/night; both buttons open what they say.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r30`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
const setup = async (p, lang, theme, played) => {
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async ({ lang, theme, played }) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
    for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId) && e.date !== iso(0));
    for (const t of T) if (!t.archived) E.push({ id: `today-${t.id}`, trackerId: t.id, date: iso(0), value: false });
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    localStorage.setItem("memap_path_start", [...E.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_avatar", "11_otter");
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", theme);
    for (const k of ["memap_hunch_day", "memap_act_seen"]) localStorage.setItem(k, iso(0));
    if (played) localStorage.setItem("memap_unload_played", iso(0));
    localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(9) })); // the day-1 look around, long seen
    localStorage.setItem("memap_week_chests", JSON.stringify(Object.fromEntries(Array.from({ length: 20 }, (_, w) => [w, { openedAt: iso(1), lines: [], reward: "balloon" }])))); // past reports opened
    const ps = await import("/src/lib/pathSteps.ts");
    for (const s of ps.pathModel(T, E).steps) if (s.kind === "task") ps.markTaskDone(s.task);
    // the demo's headaches and fights of the last days: their "Why?" step done too (r98, Nov 10 2026)
    const rs = await import("/src/lib/reasons.ts");
    rs.markAsked(rs.pendingReasons(T, E, iso(0)).map(rs.reasonKey), "saved", iso(0), true);
  }, { lang, theme, played });
  await p.reload(); await p.waitForTimeout(2500);
};
const tapLast = async (p, lang, played = false) => {
  const name = lang === "ru" ? (played ? "На сегодня всё" : "Полопать пузыри") : (played ? "Done for today" : "Pop bubbles"); // v96/v99: the last light of a done day (done after the bubbles)
  await p.locator(`.path-node[aria-label*="${name}"]`).first().click(); await p.waitForTimeout(900);
};
for (const [lang, theme, played] of [["en", "aurora-light", false], ["ru", "aurora-light", true], ["ru", "aurora", true]]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await setup(p, lang, theme, played);
  const tag = `${lang}-${theme === "aurora" ? "night" : "day"}-${played ? "played" : "new"}`;
  await p.screenshot({ path: `${D}/${tag}.png` });
  out[`${tag} card on the path`] = await p.locator(".path-done").count();
  out[`${tag} start bubble`] = await p.locator(".path-start").count();
  await tapLast(p, lang, played);
  await p.screenshot({ path: `${D}/${tag}-tap.png` });
  out[tag] = await p.evaluate(() => document.querySelector(".path-bubble")?.innerText.replace(/\s+/g, " ") ?? "NO CARD");
  if (tag === "en-day-new") {
    await p.getByRole("dialog").getByRole("button", { name: "Pop bubbles" }).click(); await p.waitForTimeout(1200);
    out.bubblesOpen = await p.evaluate(() => document.body.innerText.includes("How it works") || document.body.innerText.includes("popped"));
    await p.reload(); await p.waitForTimeout(2200);
    await tapLast(p, lang, true); // after the bubbles the day is done
    await p.getByRole("button", { name: "Explore new questions" }).click(); await p.waitForTimeout(1400);
    out.questionsOpen = await p.evaluate(() => document.body.innerText.includes("Add a question"));
  }
  await ctx.close();
}
console.log(JSON.stringify({ ...out, errs }, null, 1));
await b.close();
