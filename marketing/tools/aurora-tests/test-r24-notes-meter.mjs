// Her notes (Nov 5 2026): "в ноутс должен быть такой же фон, как и везде";
// "в экшн идёт оранжевая полоска, потом переходишь — там фиолетовые кружочки,
// и уже не найти эту оранжевую полоску". Notes on the same sea as Today; one
// meter for an action point in the list, on the card and in Show.
// Usage: node aurora-tests/test-r24-notes-meter.mjs [theme]
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const theme = process.argv[2] || "aurora-light";
const D = `./aurora-tests/work/r24`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
const open = async (withNotes) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async ({ theme, withNotes }) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
    for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId) && e.date !== iso(0));
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    localStorage.setItem("memap_path_start", [...E.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_avatar", "11_otter");
    localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", theme);
    localStorage.setItem("memap_map_view", "map");
    if (withNotes) {
      const now = new Date().toISOString();
      localStorage.setItem("memap_notes", JSON.stringify([
        { id: "n1", date: iso(0), text: "Slept badly again. The neighbours were loud until 2.", createdAt: now, updatedAt: now },
        { id: "n2", date: iso(1), text: "Long walk with Momo, felt calm after.", createdAt: now, updatedAt: now },
        { id: "n3", date: iso(3), text: "Headache after the meeting.", createdAt: now, updatedAt: now },
      ]));
    }
  }, { theme, withNotes });
  await p.reload(); await p.waitForTimeout(1800);
  return { ctx, p };
};
const tag = (s) => `${D}/${theme}-${s}.png`;
{
  const { ctx, p } = await open(false);
  await p.screenshot({ path: tag("1-today") });
  await p.locator("nav button").nth(2).click(); await p.waitForTimeout(1200);
  await p.screenshot({ path: tag("2-notes-empty") });
  out.bg = await p.evaluate(() => { const el = document.querySelector(".memap-sea-bg"); const s = getComputedStyle(el); return { cls: el.className, img: s.backgroundImage.slice(-40), size: s.backgroundSize }; });
  // Action points
  await p.locator("nav button").nth(1).click(); await p.waitForTimeout(1800);
  await p.getByRole("button", { name: /Action points/ }).first().click(); await p.waitForTimeout(1200);
  await p.screenshot({ path: tag("3-actions-top") });
  // a reached one: its meter, then Show
  await p.getByRole("button", { name: "Show" }).first().click(); await p.waitForTimeout(900);
  await p.screenshot({ path: tag("4-show-reached") });
  // the meter's filled pieces = the dark dots
  out.reached = await p.evaluate(() => {
    const sheet = [...document.querySelectorAll("[role=dialog]")].pop();
    const dots = [...sheet.querySelectorAll(".flex-wrap > span")].filter((d) => getComputedStyle(d).backgroundColor === getComputedStyle(document.documentElement).getPropertyValue("--strong") || true);
    return sheet.innerText.split("\n").slice(0, 4).join(" | ");
  });
  await p.keyboard.press("Escape"); await p.waitForTimeout(700);
  // scroll to the watching list
  await p.getByText("Watching").scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
  await p.screenshot({ path: tag("5-watching") });
  // a watching one in Show: filled pieces and dark dots match
  await p.locator("button").filter({ hasText: / of \d+$/ }).first().click(); await p.waitForTimeout(900);
  await p.screenshot({ path: tag("6-show-watching") });
  out.match = await p.evaluate(() => {
    const sheet = [...document.querySelectorAll("[role=dialog]")].pop();
    const strong = (el) => getComputedStyle(el).backgroundColor;
    const meter = sheet.querySelector("[aria-hidden=true].flex.min-w-0");
    const ref = document.createElement("span"); ref.style.background = "hsl(var(--strong))"; document.body.appendChild(ref); const indigo = getComputedStyle(ref).backgroundColor; ref.remove();
    const filled = meter ? [...meter.children].filter((s) => strong(s) === indigo).length : -1;
    const dots = [...sheet.querySelectorAll(".flex-wrap > span")].filter((s) => strong(s) === indigo && getComputedStyle(s).opacity === "1").length;
    return { filled, dots, head: sheet.innerText.split("\n").slice(0, 4).join(" | ") };
  });
  await ctx.close();
}
{
  const { ctx, p } = await open(true);
  await p.locator("nav button").nth(2).click(); await p.waitForTimeout(1200);
  await p.screenshot({ path: tag("7-notes") });
  await ctx.close();
}
console.log(JSON.stringify({ ...out, errs: errs.filter((e) => !/InAppReview/.test(e)) }, null, 1));
await b.close();
