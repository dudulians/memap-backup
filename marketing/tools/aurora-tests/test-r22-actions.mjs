// Action points (Nov 5 2026, WORLD-BIBLE "Решения 5 ноября" #5): the action
// first, then why; "I'll try / Show / Not for me"; "I'll try" starts a week's
// test; no "all calm" before there is data. Usage: node test-r22-actions.mjs [tag] [theme]
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const tag = process.argv[2] || "after";
const theme = process.argv[3] || "aurora-light";
const D = `./aurora-tests/work/r22-actions`; mkdirSync(D, { recursive: true });
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
    if (setup === "new") {
      // a new user: three evenings, nothing reached
      E = E.filter((e) => e.date >= iso(3));
      for (const t of T) if (t.threshold > 0) E = E.filter((e) => !(e.trackerId === t.id && e.value === (t.problemWhen === "yes")));
    }
    if (setup === "calm") {
      // a month of answers, no rule reached
      for (const t of T) if (t.threshold > 0) E = E.filter((e) => !(e.trackerId === t.id && e.value === (t.problemWhen === "yes")));
    }
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    localStorage.setItem("memap_path_start", [...E.map((e) => e.date)].sort()[0] ?? iso(0));
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_avatar", "11_otter");
    localStorage.setItem("memap_language", setup === "ru" ? "ru" : "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", theme);
    localStorage.setItem("memap_map_view", "map");
  }, { theme, setup });
  await p.reload(); await p.waitForTimeout(1500);
  await p.locator("nav button").nth(1).click(); await p.waitForTimeout(1800);
  return { ctx, p };
};
const rules = (p) => p.evaluate(async () => {
  const T = JSON.parse(localStorage.getItem("memap_trackers")), E = JSON.parse(localStorage.getItem("memap_entries"));
  const L = await import("/src/lib/lighthouses.ts");
  return T.filter((t) => !t.archived && t.threshold > 0).map((t) => `${t.title} · ${L.ruleCount(t, E)}/${t.threshold} in ${t.periodDays} · plan: ${t.adviceAboveThreshold || "-"}`);
});
const openActions = async (p) => {
  await p.getByRole("button", { name: /Action points|Точки действия/ }).first().click(); await p.waitForTimeout(1200);
};

// 1. a month of answers, some rules reached
{
  const { ctx, p } = await open("full");
  out.rules = await rules(p);
  await p.screenshot({ path: `${D}/${tag}-0-map.png` });
  await openActions(p);
  await p.screenshot({ path: `${D}/${tag}-1-actions.png` });
  if (tag !== "before") {
    // Show: the pattern behind it
    await p.getByRole("button", { name: "Show" }).first().click(); await p.waitForTimeout(900);
    await p.screenshot({ path: `${D}/${tag}-2-show.png` });
    await p.keyboard.press("Escape"); await p.waitForTimeout(700);
    // Not for me: another plan
    await p.getByRole("button", { name: "Not for me" }).first().click(); await p.waitForTimeout(900);
    await p.screenshot({ path: `${D}/${tag}-3-not-for-me.png` });
    await p.keyboard.press("Escape"); await p.waitForTimeout(700);
    // I'll try: a week's test starts
    out.beforeTry = await p.evaluate(() => JSON.parse(localStorage.getItem("memap_experiments") || "[]").length);
    await p.getByRole("button", { name: "I'll try" }).first().click(); await p.waitForTimeout(1200);
    await p.screenshot({ path: `${D}/${tag}-4-pick.png` });
    await p.getByRole('button', { name: /Start/i }).last().click(); await p.waitForTimeout(1200);
    await p.screenshot({ path: `${D}/${tag}-4b-started.png` });
    out.experiments = await p.evaluate(() => JSON.parse(localStorage.getItem("memap_experiments") || "[]"));
    await p.getByRole("button", { name: /Continue/ }).first().click(); await p.waitForTimeout(1500);
    await p.screenshot({ path: `${D}/${tag}-5-after-try.png` });
    out.rulesAfter = await rules(p);
    // the test question is on its island in tonight's path
    out.testQ = await p.evaluate(async () => {
      const T = JSON.parse(localStorage.getItem("memap_trackers"));
      const x = JSON.parse(localStorage.getItem("memap_experiments") || "[]")[0];
      const t = T.find((t) => t.id === x?.trackerId);
      return t ? { q: t.questionText, island: t.island, threshold: t.threshold } : null;
    });
  }
  await ctx.close();
}
// 2. a new user, three evenings
if (tag !== "before") {
  const { ctx, p } = await open("new");
  await p.screenshot({ path: `${D}/${tag}-6-new-map.png` });
  await openActions(p);
  await p.screenshot({ path: `${D}/${tag}-7-new-actions.png` });
  await ctx.close();
}
// 3. a month of answers, nothing reached
if (tag !== "before") {
  const { ctx, p } = await open("calm");
  await p.screenshot({ path: `${D}/${tag}-8-calm-map.png` });
  await openActions(p);
  await p.screenshot({ path: `${D}/${tag}-9-calm-actions.png` });
  await ctx.close();
}
// 4. Russian
if (tag !== "before") {
  const { ctx, p } = await open("ru");
  await openActions(p);
  await p.screenshot({ path: `${D}/${tag}-10-ru.png` });
  await ctx.close();
}
console.log(JSON.stringify({ ...out, errs: errs.filter((e) => !/InAppReview/.test(e)) }, null, 1));
await b.close();
