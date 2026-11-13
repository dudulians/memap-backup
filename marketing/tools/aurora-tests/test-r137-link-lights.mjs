// r137 (her "Да, добавляем", Nov 11 2026, from reel 16 «Целый мир», asked via the App Store page session):
// 1. A new link: on the open globe a warm light runs along its route, both islands light up, the link's sign comes
//    at the end; once lit, it doesn't run again.
// 2. At night the islands that have links keep their small light; the others don't.
// 3. Day and night change softly (about 1.7 s), not in a jump.
// 4. By hand, for filming: memap-route-light {a, b}, memap-routes-light (all, strongest first), memap-daynight.
// 5. Games and rewards off: no light runs, the link is just there. Reduced motion: no running light, islands still lit.
// 6. The first link plays on the open globe: no dimmed box, no count pill.
// Run from marketing/tools: node aurora-tests/test-r137-link-lights.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r137`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const ok = (name, cond, info = "") => { out[name] = cond ? "ok" : `FAIL ${typeof info === "string" ? info : JSON.stringify(info)}`.slice(0, 600); if (!cond) fails.push(name); console.log(name, "→", out[name]); };

const seed = (p, extra = {}) => p.evaluate(async (extra) => {
  const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
  for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
  const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
  const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId));
  localStorage.clear(); localStorage.setItem("memap_ab_onb", "A");
  localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
  localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1");
  localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_theme", "aurora-light");
  localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(1) }));
  localStorage.setItem("memap_path_start", iso(60)); localStorage.setItem("memap_globe_turned", "1");
  for (const [k, v] of Object.entries(extra)) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
}, extra);
const toWorld = async (p) => {
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns" } })));
  await p.waitForTimeout(400);
  for (let i = 0; i < 3; i++) { await p.keyboard.press("Escape"); await p.waitForTimeout(250); }
};
const lightsNow = (p) => p.evaluate(() => ({
  glow: document.querySelectorAll(".planet-light-glow").length,
  warm: document.querySelectorAll(".planet-route.is-warm").length,
  lit: [...document.querySelectorAll(".planet-isle.is-lit")].map((x) => x.getAttribute("data-isle")),
  chips: [...document.querySelectorAll(".planet-link-chip")].map((x) => Number(getComputedStyle(x).opacity)),
  state: window.__planet?.state?.() ?? null,
}));

// 1. a new link runs its light once
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`new: ${e.message}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await seed(p, { memap_links_lit: "[]" });
  await p.reload(); await p.waitForTimeout(2400);
  const pairs = await p.evaluate(async () => {
    const st = await import("/src/lib/storage.ts"), is = await import("/src/lib/islands.ts");
    const [T, E] = await Promise.all([st.getTrackers(), st.getEntries()]);
    // links between two islands (a link inside one island has no route to run along)
    return is.buildRoutes(T, E, is.buildIslands(T, E)).filter((r) => r.a !== r.b).map((r) => [r.a, r.b]);
  });
  ok("the demo has links between islands", pairs.length > 0, pairs);
  await toWorld(p);
  // the light starts about 0.9 s after World opens, the globe turns first (0.6 s)
  let mid = null, maxWarm = 0;
  for (let i = 0; i < 14 && !(mid && mid.glow); i++) { await p.waitForTimeout(150); mid = await lightsNow(p); maxWarm = Math.max(maxWarm, mid.warm); }
  await p.screenshot({ path: `${D}/1-light-running.png` });
  ok("a warm light runs along the new link's route", !!mid && mid.glow > 0, mid);
  ok("…the sign of the link waits for the end", !!mid && mid.chips.some((o) => o === 0), mid?.chips);
  await p.waitForTimeout(450);
  const passing = await lightsNow(p);
  await p.waitForTimeout(1050);
  const end = await lightsNow(p);
  await p.screenshot({ path: `${D}/2-islands-lit.png` });
  ok("both islands light up", end.lit.length >= 2, end);
  ok("the dots it passed are warm", Math.max(maxWarm, mid?.warm ?? 0, passing.warm, end.warm) > 0, { maxWarm, passing: passing.warm, end: end.warm });
  await p.waitForTimeout(4200);
  const calm = await lightsNow(p);
  ok("then calm: no light, the day islands go dark again", calm.glow === 0 && calm.lit.length === 0, calm);
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem("memap_links_lit") || "[]"));
  ok("the link is remembered as lit", stored.length > 0, stored);
  // again: no run
  await p.reload(); await p.waitForTimeout(2400); await toWorld(p); await p.waitForTimeout(2600);
  const again = await lightsNow(p);
  ok("opening World again: no light runs", again.glow === 0 && again.lit.length === 0 && (again.state?.lights ?? 0) === 0, again);

  // 4. by hand: one route, all routes
  const [a, bb] = pairs[0];
  await p.evaluate(([a, b]) => window.dispatchEvent(new CustomEvent("memap-route-light", { detail: { a, b } })), [a, bb]);
  await p.waitForTimeout(1300);
  const one = await lightsNow(p);
  ok("memap-route-light: the light runs on that route", one.glow > 0 || one.lit.includes(a), one);
  await p.waitForTimeout(4500);
  await p.evaluate(() => window.dispatchEvent(new Event("memap-routes-light")));
  await p.waitForTimeout(500);
  const all = await lightsNow(p);
  await p.screenshot({ path: `${D}/3-all-routes.png` });
  ok("memap-routes-light: lights along her links in turn", (all.state?.lights ?? 0) >= 1 && all.glow > 0, all);
  await p.waitForTimeout(4500);

  // 3. soft day and night (and 2. the linked islands keep their light at night)
  await p.evaluate(() => window.dispatchEvent(new Event("memap-daynight")));
  // watch the change: a soft one passes through the middle (the page's own theme change comes first, ~0.3 s)
  const t0 = Date.now(), samples = [];
  let shot = false;
  while (Date.now() - t0 < 2600) {
    const s1 = await p.evaluate(() => ({ nv: window.__planet?.state?.().night ?? 0, sky: Math.max(...[...document.querySelectorAll(".planet-sky.night")].map((x) => Number(getComputedStyle(x).opacity))) }));
    samples.push({ ms: Date.now() - t0, ...s1 });
    if (!shot && s1.nv > 0.3 && s1.nv < 0.7) { shot = true; await p.screenshot({ path: `${D}/4-dusk.png` }); }
    await p.waitForTimeout(90);
  }
  // (the test browser draws WebGL in software and can stall for a second, so it counts in-between values, not time)
  const midBall = samples.filter((x) => x.nv > 0.05 && x.nv < 0.95), midSky = samples.filter((x) => x.sky > 0.05 && x.sky < 0.95);
  ok("day to night is soft: the ball and the sky pass through in-between values, not a jump", midBall.length >= 2 && midSky.length >= 2, { midBall: midBall.map((x) => x.nv.toFixed(2)), midSky: midSky.map((x) => x.sky.toFixed(2)) });
  await p.waitForTimeout(200);
  const night = await p.evaluate(() => ({
    nv: window.__planet?.state?.().night,
    on: [...document.querySelectorAll(".planet-isle.has-link .isle-light")].map((x) => Number(getComputedStyle(x).opacity)),
    off: [...document.querySelectorAll(".planet-isle[data-isle]:not(.has-link) .isle-light")].map((x) => Number(getComputedStyle(x).opacity)),
    skies: [...document.querySelectorAll(".planet-sky.night")].map((x) => Number(getComputedStyle(x).opacity)),
  }));
  await p.waitForTimeout(1200);
  const later = await p.evaluate(() => [...document.querySelectorAll(".planet-sky.night")].map((x) => Number(getComputedStyle(x).opacity)));
  await p.screenshot({ path: `${D}/5-night-lights.png` });
  ok("night has come", night.nv === 1, night.nv);
  // the World page draws its own sky under the globe too (App Store session, Nov 11 2026: it faded away after a live change)
  ok("the night sky stays (every sky layer, 2.5 s and 3.7 s after the change)", night.skies.length > 0 && night.skies.every((o) => o > 0.95) && later.every((o) => o > 0.95), { at25: night.skies, at37: later });
  ok("at night the islands with links keep their light", night.on.length > 0 && night.on.every((o) => o > 0.9), night.on);
  ok("…the others don't", night.off.every((o) => o < 0.05), night.off);
  await p.evaluate(() => window.dispatchEvent(new Event("memap-daynight")));
  await p.waitForTimeout(2300);
  ok("and back to day", await p.evaluate(() => window.__planet?.state?.().night) === 0);
  await ctx.close();
}

// 5. games and rewards off: no run, the link is just there
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`off: ${e.message}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await seed(p, { memap_links_lit: "[]", memap_playful: "off" });
  const playful = await p.evaluate(async () => (await import("/src/lib/playful.ts")).isPlayful());
  await p.reload(); await p.waitForTimeout(2400); await toWorld(p); await p.waitForTimeout(2600);
  const off = await lightsNow(p);
  ok("games and rewards off: no light runs", !playful && off.glow === 0 && off.lit.length === 0, { playful, off });
  ok("…the links are marked as seen", (await p.evaluate(() => JSON.parse(localStorage.getItem("memap_links_lit") || "[]"))).length > 0);
  await ctx.close();
}
// reduced motion: islands lit, no running light
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`reduce: ${e.message}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await seed(p, { memap_links_lit: "[]" });
  await p.reload(); await p.waitForTimeout(2400); await toWorld(p);
  let seenGlow = 0, lit = [];
  for (let i = 0; i < 12; i++) { await p.waitForTimeout(150); const s = await lightsNow(p); seenGlow += s.glow; if (s.lit.length) lit = s.lit; }
  ok("reduced motion: no running light, the islands still light up", seenGlow === 0 && lit.length >= 2, { seenGlow, lit });
  await ctx.close();
}
// 6. the first link on the open globe
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`first: ${e.message}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await seed(p, { memap_first_link_seen: null, memap_links_known: "0", memap_links_lit: "[]" });
  await p.reload(); await p.waitForTimeout(2400);
  const first = await p.evaluate(async () => {
    const st = await import("/src/lib/storage.ts"), is = await import("/src/lib/islands.ts");
    const [T, E] = await Promise.all([st.getTrackers(), st.getEntries()]);
    const r = is.buildRoutes(T, E, is.buildIslands(T, E))[0];
    return r ? [r.a, r.b] : null;
  });
  await p.evaluate(() => window.dispatchEvent(new Event("memap-link-moment")));
  let s = null;
  const inside = !!first && first[0] === first[1];
  for (let i = 0; i < 20 && !(s && (inside ? s.lit.length : s.glow)); i++) { await p.waitForTimeout(200); s = await lightsNow(p); }
  const veil = await p.evaluate(() => ({ moment: !!document.querySelector("[data-link-moment]"), shade: document.querySelectorAll(".tour-shade, .tour-veil, .tour-link-under, .tour-link-count").length }));
  await p.screenshot({ path: `${D}/6-first-link-light.png` });
  ok(`first link (${inside ? "inside one island: it lights up" : "between two islands: the light runs"}) on the open globe`, !!s && (inside ? s.lit.includes(first[0]) : s.glow > 0), { first, s });
  ok("first link: no dimmed box, no count pill", veil.shade === 0, veil);
  await p.waitForTimeout(2600);
  const card = await p.evaluate(() => document.querySelector("[data-link-moment]")?.innerText.replace(/\s+/g, " ").slice(0, 160) ?? null);
  await p.screenshot({ path: `${D}/7-first-link-card.png` });
  ok("first link: then the card with the link in words", !!card && /first link|link/i.test(card), card);
  await ctx.close();
}

console.log(JSON.stringify({ fails, out, errs }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
