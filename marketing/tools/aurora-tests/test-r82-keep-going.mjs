// v101 (her note, Nov 8 2026): after a test's two weeks MeMap asks "Keep going like this?". Yes keeps the
// question and the reminder (it goes on past day 14); No ends both. A kept one can be stopped later in
// What helps. EN and RU.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r82`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
let n = 0; const shot = async (name) => { await p.waitForTimeout(900); await p.screenshot({ path: `${D}/${String(++n).padStart(2, "0")}-${name}.png` }); };
await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);

const seed = (lang) => p.evaluate(async (lang) => {
  const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
  for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
  const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
  const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId));
  // a finished two-week test "Go to bed by 23:00" with its own question, answered most days
  T.push({ id: "1-test", title: "Go to bed by 23:00", category: "Curious", questionText: "Did you go to bed by 23:00?", answerType: "boolean", periodDays: 30, threshold: 0, problemWhen: "no", adviceAboveThreshold: "", createdAt: new Date(Date.now() - 16 * 864e5).toISOString(), sortIndex: -1, island: "health" });
  for (let i = 2; i <= 15; i++) E.push({ id: `t${i}`, trackerId: "1-test", date: iso(i), value: i % 3 !== 0, createdAt: new Date().toISOString() });
  localStorage.clear(); localStorage.setItem("memap_ab_onb", "A");
  localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
  localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "true");
  localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1");
  localStorage.setItem("memap_theme", "aurora-light"); localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(1) }));
  localStorage.setItem("memap_path_start", iso(60));
  localStorage.setItem("memap_experiments", JSON.stringify([{ id: "1-test", island: "health", trackerId: "1-test", change: "Go to bed by 23:00", start: iso(15), remind: "22:00" }]));
}, lang);

const state = () => p.evaluate(async () => {
  const x = JSON.parse(localStorage.getItem("memap_experiments") || "[]")[0];
  const n = await import("/src/lib/notifications.ts");
  const tr = JSON.parse(localStorage.getItem("memap_trackers") || "[]").find((t) => t.id === "1-test");
  const plan = n.tryPlan();
  return { kept: x?.kept ?? null, reviewed: !!x?.reviewed, remind: x?.remind ?? null, questionArchived: !!tr?.archived, pushes: plan.length, first: plan[0] ? `${plan[0].title} | ${plan[0].body}` : null };
});

const openResult = async () => {
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "signals", back: true } })));
  await p.waitForTimeout(2200);
  await p.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].find((x) => /23:00/.test(x.textContent))?.click());
  await p.waitForTimeout(1500);
};

for (const lang of ["en", "ru"]) {
  await seed(lang); await p.reload(); await p.waitForTimeout(2500);
  out[`${lang}.before`] = await state();
  await openResult(); await shot(`${lang}-result`);
  out[`${lang}.result`] = await p.evaluate(() => document.querySelector("[aria-modal=true]")?.innerText.replace(/\s+/g, " ").slice(-320) ?? "NO RESULT");
  // Yes, keep going
  const yes = lang === "en" ? /Yes, keep going/i : /Да, продолжим/i;
  await p.evaluate((src) => { const re = new RegExp(src, "i"); [...document.querySelectorAll("[aria-modal=true] button")].find((x) => re.test(x.textContent))?.click(); }, yes.source);
  await p.waitForTimeout(1200);
  out[`${lang}.afterYes`] = await state();
  // What helps: the kept one, opened, then stopped
  await p.keyboard.press("Escape"); await p.waitForTimeout(500);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns" } }))); await p.waitForTimeout(2200);
  await p.evaluate(() => document.querySelector("[data-tour=helps]")?.click()); await p.waitForTimeout(1300);
  await shot(`${lang}-helps-kept`);
  out[`${lang}.helps`] = await p.evaluate(() => [...document.querySelectorAll("[role=dialog]")].map((d) => d.innerText.replace(/\s+/g, " ")).find((s) => /23:00/.test(s))?.slice(0, 400) ?? "NONE");
  await p.evaluate(() => [...document.querySelectorAll("[role=dialog] [role=button]")].find((x) => /23:00/.test(x.textContent))?.click()); await p.waitForTimeout(1200);
  await shot(`${lang}-kept-sheet`);
  const stop = lang === "en" ? "^Stop it$" : "^Остановить$";
  await p.evaluate((src) => { const re = new RegExp(src); [...document.querySelectorAll("[role=dialog] button")].find((x) => re.test(x.textContent.trim()))?.click(); }, stop);
  await p.waitForTimeout(1200);
  out[`${lang}.afterStop`] = await state();
  await shot(`${lang}-after-stop`);
}
// No: ends the question and the reminder at once
await seed("en"); await p.reload(); await p.waitForTimeout(2500);
await openResult();
await p.evaluate(() => [...document.querySelectorAll("[aria-modal=true] button")].find((x) => /No, that's enough/i.test(x.textContent))?.click());
await p.waitForTimeout(1200);
out["en.afterNo"] = await state();
const check = {
  resultAsks: /Keep going like this\?/.test(out["en.result"]) && /Продолжим в том же духе\?/.test(out["ru.result"]),
  yesKeeps: out["en.afterYes"].kept === true && out["en.afterYes"].remind === "22:00" && !out["en.afterYes"].questionArchived && out["en.afterYes"].pushes > 0,
  stopEnds: out["en.afterStop"].kept === false && !out["en.afterStop"].remind && out["en.afterStop"].questionArchived && out["en.afterStop"].pushes === 0,
  noEnds: out["en.afterNo"].kept === false && !out["en.afterNo"].remind && out["en.afterNo"].questionArchived && out["en.afterNo"].pushes === 0,
  ruYesKeeps: out["ru.afterYes"].kept === true && out["ru.afterYes"].pushes > 0,
};
console.log(JSON.stringify({ check, out, errs }, null, 1));
await b.close();
