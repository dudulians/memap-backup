// v70 (Nov 6 2026, her notes): "колор-кодинг на плохое и хорошее — красноватое,
// зеленоватое"; "дать возможность заполнять за прошлые дни, как у меня было, и если
// онбординг днём или утром — предлагать вопросы за вчера".
// A: day 1 at 10:00 — yesterday's questions are the first step; answering them makes
//    yesterday evening 1. B: day 1 at 19:00 — no yesterday step; the strip of past days.
// C: the demo world — calendar and a link card in the new colours. EN + RU.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r49`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
const at = (h) => { const d = new Date(); d.setHours(h, 0, 0, 0); return d; };
const dayOne = async (lang, hour, tag) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${tag}: ${e.message}`));
  await p.clock.install({ time: at(hour) });
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(900);
  await p.evaluate(async (lang) => {
    localStorage.clear();
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_avatar", "11_otter");
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
    const doors = await import("/src/lib/doors.ts");
    const door = doors.DOORS.find((d) => d.id === "energy");
    const ensured = await doors.ensureDoorTrackers(door);
    doors.saveDoorState({ id: "energy", trackerId: ensured.trackerId, contextTrackerIds: ensured.contextTrackerIds, startedAt: doors.isoLocal(new Date()), extra: [] });
    localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: doors.isoLocal(new Date()) }));
  }, lang);
  await p.reload(); await p.waitForTimeout(2600);
  await p.screenshot({ path: `${D}/${tag}-1-today.png` });
  const r = {};
  r.steps = await p.evaluate(() => [...document.querySelectorAll("[data-path-stop]")].map((x) => x.getAttribute("aria-label")).filter(Boolean).slice(0, 6));
  // the "Answer for Thursday" pill became the "Missed a few days?" card (calendar weeks, r97); none on day 1
  r.pill = await p.evaluate(() => document.querySelector("[data-fill-card]")?.textContent ?? null);
  r.start = await p.evaluate(() => document.querySelector(".path-start")?.getAttribute("aria-label"));
  return { p, ctx, r };
};
for (const lang of ["en", "ru"]) {
  // A · morning
  {
    const { p, ctx, r } = await dayOne(lang, 10, `${lang}-A`);
    await p.locator(".path-start").first().click(); await p.waitForTimeout(1300);
    await p.screenshot({ path: `${D}/${lang}-A-2-card.png` });
    // answer every card: tap Yes/No buttons in the deck until done
    r.title = await p.evaluate(() => document.querySelector("[role=dialog] button[aria-expanded]")?.textContent);
    r.datesShown = await p.evaluate(() => document.querySelectorAll("[role=dialog] .flex-1.flex.flex-col.items-center.justify-center").length);
    for (let i = 0; i < 8; i++) {
      const btn = p.getByRole("button", { name: lang === "ru" ? /^Нет$/ : /^No$/ }).first();
      if (!(await btn.isVisible().catch(() => false))) break;
      await btn.click(); await p.waitForTimeout(700);
    }
    await p.screenshot({ path: `${D}/${lang}-A-3-answered.png` });
    await p.goto("http://localhost:8080/"); await p.waitForTimeout(2400);
    await p.screenshot({ path: `${D}/${lang}-A-4-after.png` });
    r.after = await p.evaluate(async () => {
      const ps = await import("/src/lib/pathSteps.ts"), s = await import("/src/lib/storage.ts");
      const m = ps.pathModel(await s.getTrackers(), await s.getEntries());
      return { start: localStorage.getItem("memap_path_start"), counted: m.pastInWeek, steps: m.steps.map((x) => x.kind + (x.onPath ? "*" : "") + (x.done ? "✓" : "")).join(" ") };
    });
    out[`${lang} morning`] = r; await ctx.close();
  }
  // B · evening: no yesterday step, the strip instead
  {
    const { p, ctx, r } = await dayOne(lang, 19, `${lang}-B`);
    if (r.pill) {
      await p.locator("[data-fill-card] [data-fill-day]").first().click(); await p.waitForTimeout(1300);
      await p.screenshot({ path: `${D}/${lang}-B-2-past.png` });
      r.title = await p.evaluate(() => document.querySelector("[role=dialog] button[aria-expanded]")?.textContent);
    }
    out[`${lang} evening`] = r; await ctx.close();
  }
}
// C · colours on the demo world
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`C: ${e.message}`));
  await p.clock.install({ time: new Date() });
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async () => {
    const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
    for (const id of ["showcase", "relationship-reality", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId));
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_avatar", "11_otter");
    localStorage.setItem("memap_language", "ru"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" }));
  });
  await p.reload(); await p.waitForTimeout(2400);
  await p.screenshot({ path: `${D}/C-1-today.png` });
  await p.locator("nav button").nth(1).click(); await p.waitForTimeout(2600);
  await p.screenshot({ path: `${D}/C-2-world.png` });
  // every link card: its sentence and its dots (hard red, good green)
  out.links = [];
  const chips = await p.locator("button.link-chip").count();
  for (let i = 0; i < chips; i++) {
    await p.locator("button.link-chip").nth(i).click({ force: true }); await p.waitForTimeout(1100);
    await p.screenshot({ path: `${D}/C-3-link${i}.png` });
    out.links.push(await p.evaluate(() => { const d = document.querySelector("[role=dialog]"); const dots = [...(d?.querySelectorAll("span.h-3.w-3.rounded-full") ?? [])].map((x) => x.style.background); return { text: [...(d?.querySelectorAll("p") ?? [])].map((x) => x.textContent).slice(0, 3).join(" | "), first: dots[0], last: dots[dots.length - 1] }; }));
    await p.keyboard.press("Escape"); await p.waitForTimeout(700);
  }
  out.colours = await p.evaluate(() => ({ strong: getComputedStyle(document.documentElement).getPropertyValue("--strong"), balanced: getComputedStyle(document.documentElement).getPropertyValue("--balanced") }));
  await ctx.close();
}
console.log(JSON.stringify({ ...out, errs: errs.filter((e) => !e.includes("InAppReview")) }, null, 1));
await b.close();
