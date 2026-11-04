// Pinch to zoom on the globe (Nov 4 2026): two fingers spread zoom in around their middle, pinch in zooms out, the wheel zooms, "Back to me" puts it back.
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
  await p.getByRole("button", { name: /^Map$/ }).last().click(); await p.waitForTimeout(2200);
  return { ctx, p };
};
const labels = (p) => p.evaluate(() => [...document.querySelectorAll(".planet-label")].filter((l) => +l.style.opacity > 0.5).map((l) => { const r = l.querySelector("span").getBoundingClientRect(); return { n: l.textContent.trim(), x: Math.round(r.x + r.width / 2), y: Math.round(r.y) }; }));
const { ctx, p } = await open("aurora-light");
const cdp = await ctx.newCDPSession(p);
const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
const z = () => p.evaluate(() => window.__planet.state().zoom);
out.z0 = await z();
await p.screenshot({ path: `${D}/r20-1-start.png` });
// spread two fingers around (195, 360): 60 px apart → 200 px apart
await touch("touchStart", [[165, 360], [225, 360]]);
for (let k = 1; k <= 10; k++) { const h = 30 + k * 7; await touch("touchMove", [[195 - h, 360], [195 + h, 360]]); await p.waitForTimeout(16); }
await touch("touchEnd", []); await p.waitForTimeout(400);
out.zIn = await z();
await p.screenshot({ path: `${D}/r20-2-zoomed-in.png` });
out.backPill = await p.getByRole("button", { name: "Back to me" }).evaluate((b) => getComputedStyle(b).opacity);
// pinch in hard: past the smallest
await touch("touchStart", [[95, 400], [295, 400]]);
for (let k = 1; k <= 12; k++) { const h = 100 - k * 8; await touch("touchMove", [[195 - h, 400], [195 + h, 400]]); await p.waitForTimeout(16); }
await touch("touchEnd", []); await p.waitForTimeout(400);
out.zOut = await z();
await p.screenshot({ path: `${D}/r20-3-zoomed-out.png` });
// the wheel
await p.mouse.move(195, 380); await p.mouse.wheel(0, -400); await p.waitForTimeout(300);
out.zWheel = await z();
// zoom in again, then the way back
await touch("touchStart", [[165, 360], [225, 360]]);
for (let k = 1; k <= 10; k++) { const h = 30 + k * 7; await touch("touchMove", [[195 - h, 360], [195 + h, 360]]); await p.waitForTimeout(16); }
await touch("touchEnd", []); await p.waitForTimeout(400);
await p.getByRole("button", { name: "Back to me" }).click(); await p.waitForTimeout(900);
out.zHome = await z();
// a single-finger drag still turns it after all that
const s0 = await p.evaluate(() => window.__planet.state().yaw);
await touch("touchStart", [[120, 400]]); for (let k = 1; k <= 8; k++) { await touch("touchMove", [[120 + k * 15, 400]]); await p.waitForTimeout(16); } await touch("touchEnd", []);
await p.waitForTimeout(300);
out.turned = +((await p.evaluate(() => window.__planet.state().yaw)) - s0).toFixed(3);
console.log(JSON.stringify({ ...out, errs: errs.filter((e) => !/InAppReview/.test(e)) }, null, 1));
await b.close();
