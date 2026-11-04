// The globe keeps working after many visits and after the phone drops its WebGL (Nov 4 2026: "вылетает глобус").
import { chromium } from "playwright-core";
const D = "./aurora-tests/work";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const errs = [], out = {};
const open = async (theme) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async (theme) => {
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
    localStorage.setItem("memap_map_view", "globe");
  }, theme);
  await p.reload(); await p.waitForTimeout(1500);
  await p.locator("nav button").nth(1).click(); await p.waitForTimeout(2200);
  return { ctx, p };
};
const labels = (p) => p.evaluate(() => [...document.querySelectorAll(".planet-label")].filter((l) => +l.style.opacity > 0.5).map((l) => { const r = l.querySelector("span").getBoundingClientRect(); return { n: l.textContent.trim(), x: Math.round(r.x + r.width / 2), y: Math.round(r.y) }; }));
const { ctx, p } = await open("aurora-light");
const drawn = () => p.evaluate(() => {
  const c = document.querySelector(".planet-canvas"); if (!c) return "no canvas";
  const gl = c.getContext("webgl"); return !gl ? "none" : gl.isContextLost() ? "lost" : c.width > 0 ? "ok" : "empty";
});
out.first = await drawn();
// twenty visits: Map → Today → Map
for (let k = 0; k < 20; k++) {
  await p.locator("nav button").nth(0).click(); await p.waitForTimeout(250);
  await p.locator("nav button").nth(1).click(); await p.waitForTimeout(450);
}
await p.waitForTimeout(800);
out.after20 = await drawn();
out.canvases = await p.evaluate(() => document.querySelectorAll("canvas").length);
// day and night, back and forth, on the globe
for (let k = 0; k < 4; k++) { await p.evaluate(() => { const c = document.querySelector("[aria-label*=\"theme\" i], header button"); }); }
for (let k = 0; k < 4; k++) {
  await p.evaluate((k) => { localStorage.setItem("memap_theme", k % 2 ? "aurora-light" : "aurora"); document.documentElement.dataset.theme = k % 2 ? "aurora-light" : "aurora"; window.dispatchEvent(new Event("memap-theme-changed")); }, k);
  await p.waitForTimeout(700);
}
out.afterNight = await drawn();
out.crashed = await p.evaluate(() => /Something went wrong/.test(document.body.innerText));
// the phone drops the context, then gives it back
await p.evaluate(() => { const c = document.querySelector(".planet-canvas"); window.__ext = c.getContext("webgl").getExtension("WEBGL_lose_context"); window.__ext.loseContext(); });
await p.waitForTimeout(400);
out.whileLost = await p.evaluate(() => document.querySelector(".planet-canvas").getContext("webgl").isContextLost());
await p.evaluate(() => window.__ext.restoreContext());
await p.waitForTimeout(1200);
out.restored = await drawn();
await p.screenshot({ path: `${D}/r21-after.png` });
console.log(JSON.stringify({ ...out, errs: errs.filter((e) => !/InAppReview/.test(e)) }, null, 1));
await b.close();
