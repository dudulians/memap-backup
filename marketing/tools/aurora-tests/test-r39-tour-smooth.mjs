// "Look around" without jumps (her note, Nov 5 2026: "сначала появляется пояснение,
// потом резко показывается где это, всё с лагом"). Every move between stops is sampled
// each frame: the card may only change place while it's invisible, the dim never goes
// away, and how long until the next card is fully there. Pictures mid-move too.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r39`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = { moves: [] };
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
await p.evaluate(async () => {
  const d = await import("/src/lib/doors.ts");
  localStorage.clear();
  await d.ensureTemplates(["migraine", "slept-enough", "felt-anxious", "ate-by-2pm", "felt-happy", "had-energy", "saw-friends"]);
  localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", "en");
  localStorage.setItem("memap_theme", "aurora-light"); localStorage.setItem("memap_map_view", "globe");
});
await p.reload(); await p.waitForTimeout(2200);
const sample = () => p.evaluate(() => {
  window.__s = []; const t0 = performance.now();
  const tick = () => {
    const c = document.querySelector("[data-tour-card]"), cut = document.querySelector(".tour-cut"), tour = document.querySelector(".tour");
    window.__s.push({ t: Math.round(performance.now() - t0), op: c ? +getComputedStyle(c).opacity : -1, top: c ? Math.round(c.getBoundingClientRect().top) : null,
      cut: cut ? +getComputedStyle(cut).opacity : null, dim: !!tour?.querySelector(".tour-veil") });
    if (performance.now() - t0 < 1600) requestAnimationFrame(tick);
  };
  tick();
});
const read = async (label) => {
  await p.waitForTimeout(1700);
  const s = await p.evaluate(() => window.__s);
  let jumps = 0, noDim = 0, shownAt = null;
  for (let i = 1; i < s.length; i++) {
    if (s[i].top !== null && s[i - 1].top !== null && Math.abs(s[i].top - s[i - 1].top) > 12 && s[i].op > 0.05 && s[i - 1].op > 0.05) jumps++;
    if (!s[i].dim) noDim++;
    if (shownAt === null && s[i].op >= 0.99 && s.slice(0, i).some((x) => x.op < 0.5)) shownAt = s[i].t;
  }
  out.moves.push({ label, frames: s.length, jumpsWhileSeen: jumps, framesWithoutDim: noDim, cardFullyThereMs: shownAt });
};
// start the tour as the path does
await sample();
await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-start-tour")));
await p.waitForTimeout(250); await p.screenshot({ path: `${D}/start-250ms.png` });
await read("start");
for (let k = 0; k < 7; k++) {
  await p.screenshot({ path: `${D}/stop${k}.png` });
  await sample();
  await p.locator("[data-tour-card] button").last().click();
  await p.waitForTimeout(140); await p.screenshot({ path: `${D}/stop${k}-to-${k + 1}-140ms.png` });
  await read(`stop ${k} → ${k + 1}`);
}
await p.screenshot({ path: `${D}/stop7.png` });
await p.locator("[data-tour-card] button").last().click(); await p.waitForTimeout(900);
out.after = await p.evaluate(() => ({ tour: !!document.querySelector(".tour"), view: localStorage.getItem("memap_map_view"), tab: document.querySelector("nav [aria-current=page]")?.textContent }));
console.log(JSON.stringify({ ...out, errs }, null, 1));
await b.close();
