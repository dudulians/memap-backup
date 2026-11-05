// Tonight is done (her idea, Nov 5 2026): when every step is done, a card says
// "Great work today!" and offers bubbles or new questions. EN/RU, day/night,
// and before/after Unload was played; both buttons open what they say.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r30`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
for (const [lang, theme, played] of [["en", "aurora-light", false], ["ru", "aurora-light", true], ["ru", "aurora", true]]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
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
    const ps = await import("/src/lib/pathSteps.ts");
    for (const s of ps.pathModel(T, E).steps) if (s.kind === "task") ps.markTaskDone(s.task);
  }, { lang, theme, played });
  await p.reload(); await p.waitForTimeout(2500);
  const tag = `${lang}-${theme === "aurora" ? "night" : "day"}-${played ? "played" : "new"}`;
  await p.screenshot({ path: `${D}/${tag}.png` });
  out[tag] = await p.evaluate(() => document.querySelector(".path-done")?.innerText.replace(/\s+/g, " ") ?? "NO CARD");
  if (tag === "en-day-new") {
    // the card is on screen, not under the tab bar
    out.cardBox = await p.evaluate(() => { const r = document.querySelector(".path-done")?.getBoundingClientRect(); return r ? [Math.round(r.top), Math.round(r.bottom)] : null; });
    await p.getByRole("button", { name: "Pop bubbles" }).click(); await p.waitForTimeout(1200);
    await p.screenshot({ path: `${D}/${tag}-bubbles.png` });
    out.bubblesOpen = await p.evaluate(() => document.body.innerText.includes("How it works"));
    await p.keyboard.press("Escape"); await p.waitForTimeout(600);
    await p.reload(); await p.waitForTimeout(2200);
    await p.getByRole("button", { name: "Explore new questions" }).click(); await p.waitForTimeout(1400);
    await p.screenshot({ path: `${D}/${tag}-questions.png` });
    out.questionsOpen = await p.evaluate(() => document.body.innerText.includes("Add a question"));
  }
  await ctx.close();
}
console.log(JSON.stringify({ ...out, errs }, null, 1));
await b.close();
