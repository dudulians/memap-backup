// QA walk as an experienced user (~60 days of answers). Shared seed + helpers for qa-old-*.mjs.
// Read-only for the app: only localStorage seeding and window events.
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync, appendFileSync } from "fs";

export const ROOT = "./aurora-tests/work/qa-old";
mkdirSync(ROOT, { recursive: true });

export const launch = () => chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });

/** Seed the experienced user: showcase+body demo (60 days), a door with three topics,
 *  two running tests (day 5 and day 10), one over and waiting, two finished, treasures, notes. */
export const seed = async (p, { lang = "en", theme = "aurora-light" } = {}) => {
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(900);
  const info = await p.evaluate(async ({ lang, theme }) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
    for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId));
    // today not answered yet (evening still ahead): drop today's entries
    E = E.filter((e) => e.date !== iso(0));
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    const find = (re) => T.find((t) => re.test(t.title) || re.test(t.questionText ?? ""));
    const head = find(/headache|голов/i), anx = find(/anxious|тревог/i), sleep = find(/Slept enough|7+|Спал/i);
    localStorage.setItem("memap_door", JSON.stringify({ id: "migraine", trackerId: head.id, contextTrackerIds: [], startedAt: iso(60), extra: [{ id: "stress", trackerId: anx.id }, { id: "sleep", trackerId: sleep.id }] }));
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1");
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1");
    localStorage.setItem("memap_theme", theme); localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(1) }));
    localStorage.setItem("memap_path_start", iso(60));
    localStorage.setItem("memap_treasures", JSON.stringify({ balloon: iso(40), camera: iso(30), moon: iso(20), books: iso(9), kite: iso(3) }));
    const now = new Date().toISOString();
    localStorage.setItem("memap_notes", JSON.stringify([
      { id: "n1", date: iso(3), text: lang === "ru" ? "Плохо спала, утром болела голова. Много работы перед дедлайном." : "Slept badly, headache in the morning. Lots of work before a deadline.", createdAt: `${iso(3)}T18:00:00.000Z`, updatedAt: `${iso(3)}T18:00:00.000Z` },
      { id: "n2", date: iso(10), text: lang === "ru" ? "Хороший день: гуляли с подругой два часа." : "Good day: a two-hour walk with a friend.", createdAt: `${iso(10)}T18:00:00.000Z`, updatedAt: `${iso(10)}T18:00:00.000Z` },
      { id: "n3", date: iso(25), text: lang === "ru" ? "Новая подушка." : "New pillow.", createdAt: `${iso(25)}T18:00:00.000Z`, updatedAt: `${iso(25)}T18:00:00.000Z` }]));
    // tests: two running (day 5, day 10), one over and waiting for a look, two finished
    const x = await import("/src/lib/experiments.ts"), w = await import("/src/lib/testWords.ts"), st = await import("/src/lib/storage.ts");
    const mk = async (island, change, startAgo, extra = {}) => {
      const e = await x.startExperiment(island, change, w.testQuestionOf(change));
      const list = x.getExperiments().map((y) => (y.id === e.id ? { ...y, start: iso(startAgo), ...extra } : y));
      x.replaceExperiments(list);
      const es = await st.getEntries();
      const days = extra.reviewed ? 14 : Math.min(startAgo, 14);
      for (let i = 1; i <= days; i++) es.push({ id: `${e.id}-${i}`, trackerId: e.trackerId, date: iso(startAgo - i + 1), value: i % 3 !== 0, createdAt: now });
      await st.saveEntries(es);
      await new Promise((r) => setTimeout(r, 5));
      return e;
    };
    await mk("body", "Walk for 20 minutes", 40, { reviewed: iso(25), kept: true });
    await mk("me", lang === "ru" ? "Писать 3 строчки перед сном" : "Write 3 lines before bed", 35, { reviewed: iso(20), kept: false });
    await mk("health", "In bed by 23:00", 4, { remind: "22:00" });
    await mk("me", "10 minutes outside in the morning", 9, { remind: "08:00" });
    await mk("body", "No coffee after 14:00", 16);
    const T2 = await st.getTrackers();
    const I = await import("/src/lib/islands.ts");
    const byIsland = {}; for (const t of T2) { const k = I.islandOf(t); (byIsland[k] ??= []).push(t.title.slice(0, 40)); }
    return { trackers: T2.length, islands: Object.keys(byIsland), byIsland, tests: x.getExperiments().map((e) => `${e.island}:${e.change}:${e.start}:${e.reviewed ?? "-"}`) };
  }, { lang, theme });
  await p.reload(); await p.waitForTimeout(2600);
  return info;
};

export const page = async (b, opts = {}) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: false, timezoneId: opts.tz ?? "Asia/Dubai", locale: opts.lang === "ru" ? "ru-RU" : "en-US" });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); });
  return { ctx, p, errs };
};

export const shooter = (p, dir) => {
  mkdirSync(`${ROOT}/${dir}`, { recursive: true });
  let n = 0;
  const texts = [];
  const shot = async (name, { wait = 800, full = false } = {}) => {
    await p.waitForTimeout(wait);
    const path = `${ROOT}/${dir}/${String(++n).padStart(2, "0")}-${name}.png`;
    await p.screenshot({ path, fullPage: full });
    return path;
  };
  const text = async (label) => {
    const t = await p.evaluate(() => { const d = [...document.querySelectorAll("[role=dialog]")].pop(); return (d ?? document.body).innerText.replace(/\n{2,}/g, "\n"); });
    texts.push(`\n===== ${label} =====\n${t}`);
    return t;
  };
  const save = () => writeFileSync(`${ROOT}/${dir}/texts.txt`, texts.join("\n"));
  /** screenshot the top dialog (or page) and scroll its biggest scroller page by page */
  const scrollShots = async (name, max = 6) => {
    const paths = [];
    await p.evaluate(() => { const s = window.__qaScroller(); if (s) s.scrollTop = 0; }).catch(() => {});
    for (let i = 0; i < max; i++) {
      paths.push(await shot(`${name}-s${i}`, { wait: 600 }));
      const more = await p.evaluate(() => { const s = window.__qaScroller(); if (!s) return false; const before = s.scrollTop; s.scrollTop = before + s.clientHeight * 0.8; return s.scrollTop > before + 4; });
      if (!more) break;
    }
    return paths;
  };
  return { shot, text, save, scrollShots };
};

/** install a helper that finds the biggest scroller inside the top dialog (or the page) */
export const installHelpers = async (p) => {
  await p.addInitScript(() => {
    window.__qaScroller = () => {
      const root = [...document.querySelectorAll("[role=dialog]")].pop() ?? document.body;
      const all = [root, ...root.querySelectorAll("*")].filter((e) => { const cs = getComputedStyle(e); return /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 8; });
      all.sort((a, b) => b.clientHeight - a.clientHeight);
      return all[0] ?? null;
    };
  });
};

export const ev = (p, name, detail) => p.evaluate(({ name, detail }) => window.dispatchEvent(new CustomEvent(name, { detail })), { name, detail });
export const toWorld = async (p) => { await ev(p, "memap-switch-tab", { tab: "patterns" }); await p.waitForTimeout(2200); };
export const toSection = async (p, section) => { await ev(p, "memap-switch-tab", { tab: "patterns", open: "all", section, back: true }); await p.waitForTimeout(2400); };
export const esc = async (p, k = 1) => { for (let i = 0; i < k; i++) { await p.keyboard.press("Escape"); await p.waitForTimeout(500); } };
export const clickText = (p, re, scope = "[role=dialog]") => p.evaluate(({ src, flags, scope }) => {
  const re = new RegExp(src, flags);
  const roots = scope ? [...document.querySelectorAll(scope)] : [document];
  const root = roots.pop() ?? document;
  const el = [...root.querySelectorAll("button, [role=button], [role=tab], a, [role=switch]")].find((x) => re.test(x.textContent ?? "") || re.test(x.getAttribute("aria-label") ?? ""));
  if (el) { el.click(); return (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 80); }
  return null;
}, { src: re.source, flags: re.flags, scope });
export const buttons = (p, scope = "[role=dialog]") => p.evaluate((scope) => {
  const root = [...document.querySelectorAll(scope)].pop() ?? document;
  return [...root.querySelectorAll("button, [role=button], [role=tab], [role=switch], [role=checkbox]")].map((x) => (x.textContent?.trim() || `[${x.getAttribute("aria-label") ?? "?"}]`).replace(/\s+/g, " ").slice(0, 70));
}, scope);
export const log = (dir, obj) => { mkdirSync(`${ROOT}/${dir}`, { recursive: true }); appendFileSync(`${ROOT}/${dir}/log.json`, JSON.stringify(obj, null, 1) + "\n"); };
