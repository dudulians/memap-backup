// Her Nov 3 night note: back to my step; the path rolls like a picker wheel
// with a light; islands press in like buttons with a ring on the water.
import { chromium } from "playwright-core";
const D = "./aurora-tests/work";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true })).newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
const out = {};
await p.goto("http://localhost:8080/"); await p.waitForTimeout(900);
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
const wheel = () => p.evaluate(() => [...document.querySelectorAll("[data-wheel][data-cy]")].map((el) => {
  const r = el.querySelector(".path-node").getBoundingClientRect();
  return { y: Math.round(r.top + r.height / 2), s: (el.style.transform.match(/scale\(([\d.]+)\)/) || [])[1], o: el.style.opacity };
}).filter((x) => x.y > 0 && x.y < 844).map((x) => `${x.y}:${x.s}/${x.o}`).join(" "));
out.snap = await p.evaluate(() => document.querySelector("main").className.match(/snap-\S+/g)?.join(" "));
out.wheelAtStep = await wheel();
out.band = await p.evaluate(() => { const l = document.querySelector(".path-band"); return l ? l.getAttribute("style") : "none"; });
await p.screenshot({ path: `${D}/r10-wheel.png` });
// roll down by hand
await p.mouse.move(195, 600);
await p.evaluate(() => document.querySelector("main").dispatchEvent(new Event("pointerdown")));
for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, 260); await p.waitForTimeout(120); }
await p.waitForTimeout(700);
out.wheelRolled = await wheel();
out.pill = await p.evaluate(() => [...document.querySelectorAll("body > button")].map((x) => x.innerText.trim()).find((x) => /my step/i.test(x)) || "none");
await p.screenshot({ path: `${D}/r10-rolled.png` });
if (out.pill !== "none") {
  await p.getByRole("button", { name: /my step/i }).click(); await p.waitForTimeout(1200);
  out.afterBack = await p.evaluate(() => [...document.querySelectorAll("body > button")].some((x) => /my step/i.test(x.innerText)) ? "pill still shown" : "back at the step, pill gone");
}
// islands press in
await p.getByRole("button", { name: /^map$/i }).first().click(); await p.waitForTimeout(2200);
const isl = p.locator("main button.island-press").first();
const box = await isl.boundingBox();
await p.mouse.move(box.x + box.width / 2, box.y + 60); await p.mouse.down(); await p.waitForTimeout(110);
out.pressed = await p.evaluate(() => getComputedStyle(document.querySelector("main button.island-press")).transform);
out.ripple = await p.evaluate(() => document.querySelectorAll(".island-ripple").length);
await p.screenshot({ path: `${D}/r10-press.png` });
await p.mouse.up(); await p.waitForTimeout(900);
out.opened = await p.evaluate(() => (document.querySelector('[role="dialog"] h2')?.innerText || "none"));
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
