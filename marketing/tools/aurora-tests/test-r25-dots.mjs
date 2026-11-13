// A day is a dot (her note, Nov 5 2026: "то зелёными кружками, то
// фиолетовыми, то квадратиками"). Walks every place that shows days and
// lists the shapes and colours of the day markers it finds.
// Usage: node aurora-tests/test-r25-dots.mjs [theme]
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const theme = process.argv[2] || "aurora-light";
const D = `./aurora-tests/work/r25`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
const open = async (setup) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async ({ theme, setup }) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
    for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId) && e.date !== iso(0));
    if (setup === "new") { E = E.filter((e) => e.date >= iso(3)); for (const t of T) if (t.threshold > 0) E = E.filter((e) => !(e.trackerId === t.id && e.value === (t.problemWhen === "yes"))); }
    if (setup === "full") { const ps = await import("/src/lib/pathSteps.ts"); const q = ps.pathModel(T, E).steps.find((st) => st.kind === "questions" && st.trackerIds.length >= 3); for (const id of q.trackerIds.slice(0, 2)) E.push({ id: "t-" + id, trackerId: id, date: iso(0), value: Math.random() < 0.5 }); }
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    localStorage.setItem("memap_path_start", [...E.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_avatar", "11_otter");
    localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", theme);
    localStorage.setItem("memap_map_view", "map");
    localStorage.setItem("memap_notes", JSON.stringify([{ id: "n1", date: iso(2), text: "Headache after the meeting.", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]));
  }, { theme, setup });
  await p.reload(); await p.waitForTimeout(1800);
  return { ctx, p };
};
// small round-or-square coloured markers on screen: shape and colour
const markers = (p) => p.evaluate(() => {
  const seen = {};
  for (const el of document.querySelectorAll("span")) {
    const r = el.getBoundingClientRect(); if (r.width < 5 || r.width > 16 || Math.abs(r.width - r.height) > 1 || el.children.length) continue;
    const s = getComputedStyle(el); if (s.visibility === "hidden") continue;
    const bg = s.backgroundColor; if (/rgba\(0, 0, 0, 0\)/.test(bg) && s.borderStyle === "none") continue;
    const shape = parseFloat(s.borderRadius) >= r.width / 2 - 0.5 ? "dot" : "square";
    const key = `${shape} ${bg}`; seen[key] = (seen[key] || 0) + 1;
  }
  return seen;
});
const shot = async (p, name) => { await p.screenshot({ path: `${D}/${theme}-${name}.png` }); out[name] = await markers(p); };
const esc = async (p) => { await p.keyboard.press("Escape"); await p.waitForTimeout(700); };
{
  const { ctx, p } = await open("full");
  // her step today, part answered: its card shows a dot per question
  await p.locator(".path-node.disc-current").first().click(); await p.waitForTimeout(900);
  await shot(p, "0-step-card");
  await esc(p);
  // a done evening's card on Today
  await p.getByRole("button", { name: /Wednesday/ }).first().click(); await p.waitForTimeout(900);
  await shot(p, "1-evening-card");
  await p.getByRole("button", { name: /answers/i }).last().click().catch(() => {}); await p.waitForTimeout(1000);
  await shot(p, "1b-day-sheet");
  await esc(p);
  await p.locator("nav button").nth(1).click(); await p.waitForTimeout(1800);
  await shot(p, "2-world");
  await p.getByRole("button", { name: /Calendar/ }).first().click(); await p.waitForTimeout(1200);
  await shot(p, "3-calendar-month");
  await p.getByRole("button", { name: "Year" }).first().click(); await p.waitForTimeout(900);
  await shot(p, "4-calendar-year");
  await esc(p);
  await p.getByRole("button", { name: /Action points/ }).first().click(); await p.waitForTimeout(1200);
  await p.getByText("Watching").scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  await shot(p, "5-actions");
  await p.locator("button").filter({ hasText: / of \d+$/ }).first().click(); await p.waitForTimeout(900);
  await shot(p, "6-show");
  await ctx.close();
}
{
  const { ctx, p } = await open("new");
  await p.locator("nav button").nth(1).click(); await p.waitForTimeout(1800);
  await p.getByRole("button", { name: /Action points/ }).first().click(); await p.waitForTimeout(1200);
  await shot(p, "7-taking-shape");
  await ctx.close();
}
console.log(JSON.stringify({ ...out, errs: errs.filter((e) => !/InAppReview/.test(e)) }, null, 1));
await b.close();
