// Add questions (her note, Nov 5 2026): tapping "+" did nothing, only the question
// worked. Touch taps: the "+" of one row, the words of another; each adds one question;
// a second tap on the "+" takes it back.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = "./aurora-tests/work/r35"; mkdirSync(D, { recursive: true });
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
    localStorage.setItem("memap_discover_seen", JSON.stringify({ links: iso(1), calendar: iso(1), chart: iso(1) }));
    const ps = await import("/src/lib/pathSteps.ts");
    for (const s of ps.pathModel(T, E).steps) if (s.kind === "task") ps.markTaskDone(s.task);
  }, { lang, theme });
  await p.reload(); await p.waitForTimeout(2500);
};

const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
await setup(p, "en", "aurora-light");
const count = () => p.evaluate(() => JSON.parse(localStorage.getItem("memap_trackers") || "[]").filter((t) => !t.archived).length);
await p.locator(".path-start").first().tap(); await p.waitForTimeout(900);
await p.getByRole("button", { name: "Explore new questions" }).tap(); await p.waitForTimeout(1500);
const rows = p.locator("button[aria-pressed=false][aria-label^='Add']");
out.rows = await rows.count();
out.before = await count();
const plusTap = async (row) => { const bx = await row.boundingBox(); await row.tap({ position: { x: bx.width - 30, y: bx.height / 2 } }); await p.waitForTimeout(900); };
const r1 = rows.nth(0), name1 = await r1.getAttribute("aria-label");
await plusTap(r1);
out.afterPlus = await count();
out.plusShowsTick = await p.locator(`button[aria-label="${name1}"]`).getAttribute("aria-pressed");
await p.screenshot({ path: `${D}/after-plus.png` });
const r2 = p.locator("button[aria-pressed=false][aria-label^='Add']").nth(0);
const bx2 = await r2.boundingBox(); await r2.tap({ position: { x: 40, y: bx2.height / 2 } }); await p.waitForTimeout(900);
out.afterWords = await count();
await plusTap(p.locator(`button[aria-label="${name1}"]`));
out.afterUndo = await count();
console.log(JSON.stringify({ ...out, errs }, null, 1));
await b.close();
