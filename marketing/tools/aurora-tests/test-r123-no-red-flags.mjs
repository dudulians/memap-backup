// r123 (her content audit, Nov 10 2026: "Medical Red Flags — REMOVE … Scientific source labels — REMOVE from UI …
// Worth Watching — KEEP, with corrections"). Body cards have no "Something worrying?" chip, a panic attack keeps
// "Talk to someone", the red-flag strings are gone, the hobby tip is held, tips 1–7 have the new words. EN + RU.
// Run from marketing/tools: node aurora-tests/test-r123-no-red-flags.mjs
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const ok = (name, cond, info = "") => { out[name] = cond ? "ok" : `FAIL ${typeof info === "string" ? info : JSON.stringify(info)}`.slice(0, 400); if (!cond) fails.push(name); };
const cardNow = (p) => p.evaluate(() => [...document.querySelectorAll("p")].filter((x) => x.className.includes("[text-wrap:balance]") && x.className.includes("font-bold") && !x.closest('[aria-hidden="true"]')).map((x) => x.textContent.trim()).pop() ?? null);
for (const lang of ["en", "ru"]) {
  const RU = lang === "ru";
  const W = RU ? { flag: /Что-то тревожит/, talk: /^Поговорить с кем-то$/, panic: /паническ/i, no: /^Нет$/ } : { flag: /Something worrying/, talk: /^Talk to someone$/, panic: /panic/i, no: /^No$/ };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: RU ? "ru-RU" : "en-US" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  await p.clock.install({ time: new Date(2026, 10, 10, 20, 0, 0) });
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async (lang) => {
    localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1");
    localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order"])); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1");
    localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" })); localStorage.setItem("memap_first_link_seen", "before");
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    const ids = await dz.ensureTemplates(["headache", "heart-palpitations", "panic-attack", "period-day", "stomach-issues"]);
    const at = new Date("2026-11-02T09:00:00").toISOString();
    await st.saveTrackers((await st.getTrackers()).map((t) => ({ ...t, createdAt: at, sortIndex: ids.indexOf(t.id) })));
    localStorage.setItem("memap_onboarded_at", at); localStorage.setItem("memap_path_start", "2026-11-02");
  }, lang);
  await p.reload(); await p.waitForTimeout(2500);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-session"))); await p.waitForTimeout(1500);
  let flags = 0, cards = 0, panicTalk = null;
  for (let i = 0; i < 7; i++) {
    const q = await cardNow(p); if (!q) break; cards++;
    flags += await p.getByRole("button", { name: W.flag }).count();
    if (W.panic.test(q)) panicTalk = await p.getByRole("button", { name: W.talk }).count();
    await p.getByRole("button", { name: W.no }).last().tap(); await p.waitForTimeout(800);
  }
  ok(`${lang}: no "Something worrying?" on body cards`, cards >= 4 && flags === 0, { cards, flags });
  ok(`${lang}: a panic attack keeps "Talk to someone"`, panicTalk === 1, String(panicTalk));
  const strings = await p.evaluate(async () => { const { default: i18n } = await import("/src/lib/i18n.ts"); return { flags: i18n.exists("redFlags.now"), source: i18n.exists("tipDay.source") }; });
  ok(`${lang}: the red-flag and source strings are gone`, !strings.flags && !strings.source, strings);
  await ctx.close();
}
// tips: the hobby tip is held; tips 1–7 have the new words; every tip keeps its source inside
const ctx = await b.newContext(); const p = await ctx.newPage();
await p.goto("http://localhost:8080/"); await p.waitForTimeout(1200);
const t = await p.evaluate(async () => {
  const d = await import("/src/lib/observeTipsData.ts"), o = await import("/src/lib/observeTips.ts");
  // someone who asks every tip's question except the hobby one: no tip left to show
  const T = d.OBSERVE_TIPS.filter((x) => x.templateId !== "hobby-time").map((x, i) => ({ id: `t${i}`, title: x.templateId, templateId: x.templateId, archived: false }));
  localStorage.removeItem("memap_observe_tip");
  const pick = o.tipForToday(T.map((x) => ({ ...x, id: `1-${x.templateId}-0` })));
  return { held: d.OBSERVE_TIPS.filter((x) => x.review?.status === "held").map((x) => x.templateId), pick: pick?.tip.templateId ?? null,
    first7: d.OBSERVE_TIPS.slice(0, 7).map((x) => x.en.title), sources: d.OBSERVE_TIPS.every((x) => x.source?.name && x.source?.url), ru: d.OBSERVE_TIPS.slice(0, 7).map((x) => x.ru.line).join(" ") };
});
// since the full brief (v125) tip 33 (IBS) is held too
ok("the hobby tip is held", t.held.includes("hobby-time") && t.pick !== "hobby-time", t);
ok("tips 1–7 have the new titles", t.first7.join("|") === "Late coffee|Same wake-up time|Worries at bedtime|Morning daylight|Sleep and mood|Time for a hobby|Time in nature", t.first7);
ok("every tip keeps its source inside", t.sources);
ok("RU copy is gender-free", !/\((а|ась|ла)\)/.test(t.ru), t.ru);
await ctx.close();
console.log(JSON.stringify({ fails, out, errs }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
