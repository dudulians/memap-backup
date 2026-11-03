// The picker drum (her note, Nov 3 2026): her step lies flat in the band in
// the middle; away from it the steps turn away, close up and fade; the road
// bends with them; the scroll rests on a step; a soft tick only for her own
// scrolling; the week card's line moves to the header; Reduce Motion is flat.
import { chromium } from "playwright-core";
const D = "./aurora-tests/work";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const out = {};
const errs = [];
const open = async (w, h, { reduce = false, theme = "aurora-light", fresh = false } = {}) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, reducedMotion: reduce ? "reduce" : "no-preference" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async ({ theme, fresh }) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
    for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId) && e.date !== iso(0));
    if (fresh) { T = T.slice(0, 3); E = []; }
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    localStorage.setItem("memap_path_start", fresh ? iso(0) : [...E.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_avatar", "08_fox");
    localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", theme);
  }, { theme, fresh });
  await p.reload(); await p.waitForTimeout(2200);
  // count the light taps (web fallback: navigator.vibrate(4))
  await p.evaluate(() => { window.__taps = 0; const v = navigator.vibrate?.bind(navigator); navigator.vibrate = (x) => { if (x === 4) window.__taps++; return v ? v(x) : true; }; });
  return { ctx, p };
};
const state = (p) => p.evaluate(() => {
  const main = document.querySelector("main"); const mr = main.getBoundingClientRect();
  const off = (main.clientHeight - parseFloat(getComputedStyle(main).scrollPaddingBottom || "0")) / 2; const mid = mr.top + off;
  const band = document.querySelector(".path-band")?.getBoundingClientRect();
  const dots = [...document.querySelectorAll(".path-snap")].map((d) => { const r = d.getBoundingClientRect(); return r.top + r.height / 2; });
  const nearestDot = dots.reduce((a, y) => (Math.abs(y - mid) < Math.abs(a - mid) ? y : a), 1e9);
  // the steps in view: flat layout distance vs where they are drawn
  const steps = [...document.querySelectorAll("[data-wheel][data-cy]")].map((el) => {
    const box = el.closest(".path-box").getBoundingClientRect(); const flat = box.top + Number(el.dataset.cy) - mid;
    const r = el.querySelector(".path-node").getBoundingClientRect();
    return { flat: Math.round(flat), drawn: Math.round(r.top + r.height / 2 - mid), h: Math.round(r.height), op: Number(el.style.opacity || 1) };
  }).filter((s) => Math.abs(s.flat) < 700);
  // does the road go through each visible step's centre?
  let roadGap = 0;
  for (const box of document.querySelectorAll(".path-box")) {
    const svg = box.querySelector("svg.path-road"); if (!svg) continue; const path = svg.querySelector("path[data-from]"); const sr = svg.getBoundingClientRect();
    const L = path.getTotalLength(); const pts = []; for (let s = 0; s <= L; s += 3) { const q = path.getPointAtLength(s); pts.push([sr.left + q.x, sr.top + q.y]); }
    for (const el of box.querySelectorAll("[data-wheel][data-cy]")) {
      if (Number(el.style.opacity || 1) < 0.35) continue;
      const r = el.querySelector(".path-node").getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const gap = Math.min(...pts.map(([x, y]) => Math.hypot(x - cx, y - cy)));
      roadGap = Math.max(roadGap, gap);
    }
  }
  return {
    bandMid: band ? Math.round(band.top + band.height / 2 - mid) : null,
    restsOnStep: Math.round(Math.abs(nearestDot - mid)),
    sideways: main.scrollWidth - main.clientWidth,
    header: document.getElementById("memap-header-center")?.innerText || "",
    titleShown: getComputedStyle(document.querySelector("header h1")).opacity,
    roadGap: Math.round(roadGap * 10) / 10,
    steps: steps.map((s) => `${s.flat}->${s.drawn} h${s.h} o${s.op.toFixed(2)}`).join(" | "),
  };
});

for (const [w, h] of [[390, 844], [375, 667]]) {
  const { ctx, p } = await open(w, h);
  out[`load${w}`] = await state(p);
  await p.screenshot({ path: `${D}/r12-drum-${w}.png` });
  // her own scrolling: a few notches, then it settles on a step
  await p.mouse.move(w / 2, h * 0.55);
  for (let i = 0; i < 3; i++) { await p.mouse.wheel(0, 120); await p.waitForTimeout(90); }
  await p.waitForTimeout(1100);
  out[`rolled${w}`] = await state(p);
  out[`taps${w}`] = await p.evaluate(() => window.__taps);
  await p.screenshot({ path: `${D}/r12-rolled-${w}.png` });
  await ctx.close();
}

// "My step": silent roll back; tapping a past day rolls it to the band and opens its bubble
{
  const { ctx, p } = await open(390, 844);
  await p.mouse.move(195, 470);
  for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, 200); await p.waitForTimeout(80); }
  await p.waitForTimeout(1200);
  out.pill = await p.getByRole("button", { name: /my step/i }).count();
  await p.evaluate(() => { window.__taps = 0; });
  if (out.pill) { await p.getByRole("button", { name: /my step/i }).click(); await p.waitForTimeout(1400); }
  out.back = await state(p);
  out.tapsOnBack = await p.evaluate(() => window.__taps);
  // a done day above: tap its node
  const day = p.locator('.path-node[data-path-stop="0"]').first();
  const label = await day.getAttribute("aria-label").catch(() => null);
  if (label) {
    await day.click({ force: true }); await p.waitForTimeout(1200);
    out.tappedDay = { label, bubble: await p.evaluate(() => !!document.querySelector("[data-wheel] .path-bubble")), ...(await state(p)) };
    await p.screenshot({ path: `${D}/r12-tap-day.png` });
  }
  await ctx.close();
}

// night
{
  const { ctx, p } = await open(390, 844, { theme: "aurora" });
  out.night = await state(p);
  await p.screenshot({ path: `${D}/r12-night.png` });
  await ctx.close();
}

// a first day: her first step can come to the band too
{
  const { ctx, p } = await open(390, 844, { fresh: true });
  out.fresh = await state(p);
  await p.screenshot({ path: `${D}/r12-fresh.png` });
  await ctx.close();
}

// Reduce Motion: flat, no band, no snap, the road as drawn
{
  const { ctx, p } = await open(390, 844, { reduce: true });
  out.reduce = await p.evaluate(() => ({
    transforms: [...document.querySelectorAll("[data-wheel]")].filter((e) => e.style.transform).length,
    band: !!document.querySelector(".path-band"),
    snap: getComputedStyle(document.querySelector("main")).scrollSnapType,
    masks: [...document.querySelectorAll("svg.path-road")].filter((s) => s.style.maskImage && s.style.maskImage !== "none").length,
  }));
  await ctx.close();
}
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
