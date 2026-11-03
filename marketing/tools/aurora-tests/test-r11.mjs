// The review's fixes: no sideways pan; the light, the wheel and the snap share
// one middle; an island scroll gives no tap feedback; Reduce Motion; focus
// after "My step".
import { chromium } from "playwright-core";
const D = "./aurora-tests/work";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const out = {};
const errs = [];
const open = async (w, h, reduce = false) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, reducedMotion: reduce ? "reduce" : "no-preference" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async () => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
    for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId) && e.date !== iso(0));
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    localStorage.setItem("memap_path_start", [...E.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_avatar", "08_fox");
    localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
  });
  await p.reload(); await p.waitForTimeout(2600);
  return { ctx, p };
};
const middles = (p) => p.evaluate(() => {
  const main = document.querySelector("main"); const mr = main.getBoundingClientRect();
  const lens = document.querySelector(".path-band")?.getBoundingClientRect(); const off = (main.clientHeight - parseFloat(getComputedStyle(main).scrollPaddingBottom || "0")) / 2;
  const mid = mr.top + off; let best = null;
  for (const el of document.querySelectorAll("[data-wheel][data-cy]")) {
    const r = el.querySelector(".path-node").getBoundingClientRect(); const c = r.top + r.height / 2;
    if (!best || Math.abs(c - mid) < Math.abs(best.c - mid)) best = { c, s: (el.style.transform.match(/scale\(([\d.]+)\)/) || [])[1] };
  }
  return { mainMid: Math.round(mid), bandMid: lens ? Math.round(lens.top + lens.height / 2) : null, nearestStep: best && Math.round(best.c), opacity: best && best.s, sideways: `${main.scrollWidth}/${main.clientWidth}` };
});

for (const [w, h] of [[375, 812], [390, 844]]) {
  const { ctx, p } = await open(w, h);
  out[`m${w}`] = await middles(p);
  await p.evaluate(() => { document.querySelector("main").dispatchEvent(new Event("touchstart")); });
  for (let i = 0; i < 4; i++) { await p.mouse.move(w / 2, h * 0.6); await p.mouse.wheel(0, 220); await p.waitForTimeout(120); }
  await p.waitForTimeout(900);
  out[`m${w}rolled`] = await middles(p);
  await ctx.close();
}

// "My step": back to the middle, focus on her step
{
  const { ctx, p } = await open(390, 844);
  for (let i = 0; i < 6; i++) { await p.mouse.move(195, 600); await p.mouse.wheel(0, 260); await p.waitForTimeout(120); }
  await p.waitForTimeout(700);
  await p.getByRole("button", { name: /my step/i }).click(); await p.waitForTimeout(1300);
  out.back = await middles(p);
  out.focus = await p.evaluate(() => document.activeElement?.getAttribute("aria-label") + " · " + (document.activeElement?.classList.contains("path-node") ? "a path step" : document.activeElement?.tagName));
  // islands: a scroll that starts on an island gives no ripple; a tap does
  await p.getByRole("button", { name: /^map$/i }).first().click(); await p.waitForTimeout(2200);
  const isl = await p.locator("main button.island-press").first().boundingBox();
  await p.mouse.move(isl.x + isl.width / 2, isl.y + 70); await p.mouse.down();
  for (let i = 1; i <= 8; i++) { await p.mouse.move(isl.x + isl.width / 2, isl.y + 70 - i * 20); await p.waitForTimeout(16); }
  await p.mouse.up(); await p.waitForTimeout(150);
  out.rippleOnDrag = await p.evaluate(() => document.querySelectorAll(".island-ripple").length);
  out.sheetAfterDrag = await p.evaluate(() => !!document.querySelector('[role="dialog"] h2'));
  await ctx.close();
}

// Reduce Motion: no drum, no snap
{
  const { ctx, p } = await open(390, 844, true);
  out.reduce = await p.evaluate(() => ({ transforms: [...document.querySelectorAll("[data-wheel]")].filter((e) => e.style.transform).length, snap: getComputedStyle(document.querySelector("main")).scrollSnapType }));
  await ctx.close();
}
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
