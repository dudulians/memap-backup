// Old user, every step done (demo data, as test-r30): "Done for today" is lit,
// and its card's buttons open what they say. Night theme.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r34b`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
const setup = async (p, lang, theme) => {
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async ({ lang, theme }) => {
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
    const ps = await import("/src/lib/pathSteps.ts");
    for (const s of ps.pathModel(T, E).steps) if (s.kind === "task") ps.markTaskDone(s.task);
  }, { lang, theme });
  await p.reload(); await p.waitForTimeout(2500);
};
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
const openEnd = async () => { await p.locator(".path-start").first().click(); await p.waitForTimeout(900); };
await setup(p, "en", "aurora");
out.bubble = await p.evaluate(() => document.querySelector(".path-start")?.getAttribute("aria-label"));
out.model = await p.evaluate(async () => {
  const ps = await import("/src/lib/pathSteps.ts");
  const m = ps.pathModel(JSON.parse(localStorage.getItem("memap_trackers")), JSON.parse(localStorage.getItem("memap_entries")));
  return m.steps.map((s) => s.id + (s.done ? " ✓" : "")).join(" / ") + ` | weekComplete=${m.weekComplete}`;
});
await p.screenshot({ path: `${D}/night-path.png` });
await openEnd(); await p.screenshot({ path: `${D}/night-card.png` });
out.card = await p.evaluate(() => document.querySelector(".path-bubble")?.innerText.replace(/\s+/g, " "));
for (const [name, look] of [["See your links", /Globe|Links show up|Link/], ["Your calendar", /Calendar/], ["Explore new questions", /Add a question/]]) {
  await p.reload(); await p.waitForTimeout(2400); await openEnd();
  await p.getByRole("button", { name }).click(); await p.waitForTimeout(1600);
  await p.screenshot({ path: `${D}/${name.replace(/ /g, "-")}.png` });
  out[name] = look.test(await p.evaluate(() => document.body.innerText));
}
console.log(JSON.stringify({ ...out, errs }, null, 1));
await b.close();
