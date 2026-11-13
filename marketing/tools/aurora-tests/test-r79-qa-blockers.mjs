// QA blockers (qa-old-user.md, Nov 8 2026): B1 old look and back keeps the path; B2 a new test on a
// busy island warns first; B3 "I did it" says the count starts again; B4 a finished test opens its
// result (When to act, Today's step); C9 a link's days show both questions; C14 no "today" on cards.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r79`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
let n = 0; const shot = async (name) => { await p.waitForTimeout(900); await p.screenshot({ path: `${D}/${String(++n).padStart(2, "0")}-${name}.png` }); };
await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
await p.evaluate(async () => {
  const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
  for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
  const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
  const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId));
  const find = (re) => T.find((t) => re.test(t.title));
  // a headache rule reached for sure
  const head = find(/headache/i);
  T = T.map((t) => (t.id === head.id ? { ...t, threshold: 3, periodDays: 30, adviceAboveThreshold: "See a GP and ask for a check-up", planKind: "once" } : t));
  E = E.filter((e) => !(e.trackerId === head.id && e.date >= iso(5)));
  for (let i = 0; i < 5; i++) E.push({ id: `h${i}`, trackerId: head.id, date: iso(i), value: true, createdAt: new Date().toISOString() });
  localStorage.clear();
  localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
  localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "true"); localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "1");
  localStorage.setItem("memap_theme", "aurora-light"); localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(1) }));
  localStorage.setItem("memap_path_start", iso(60));
  localStorage.setItem("memap_experiments", JSON.stringify([
    { id: "1-test", island: "health", trackerId: "1-test", change: "Go to bed by 23:00", start: iso(4), remind: "22:00" },
    { id: "2-test", island: "body", trackerId: "2-test", change: "Skip coffee after 14:00", start: iso(16), remind: "13:30" },
  ]));
}, null);
await p.reload(); await p.waitForTimeout(2500);
// B4 on Today: the finished test is a step
out.todayTestStep = await p.evaluate(async () => { const ps = await import("/src/lib/pathSteps.ts"), st = await import("/src/lib/storage.ts"); return ps.pathModel(await st.getTrackers(), await st.getEntries()).steps.some((s) => s.kind === "test"); });
// When to act
const act = async () => { await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "signals", back: true } }))); await p.waitForTimeout(2200); };
await act(); await shot("act");
// B4: the done test row opens its result
await p.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].find((x) => /Skip coffee after 14:00/.test(x.textContent) && /done/i.test(x.textContent))?.click());
await p.waitForTimeout(1300); await shot("done-test-result");
out.result = await p.evaluate(() => document.querySelector("[aria-modal=true]")?.innerText.replace(/\s+/g, " ").slice(0, 300) ?? "NO RESULT");
await p.evaluate(() => [...document.querySelectorAll("[aria-modal=true] button")].find((x) => /close/i.test(x.getAttribute("aria-label") ?? ""))?.click()); await p.waitForTimeout(800);
// B3: I did it → counting again
await p.evaluate(() => { const c = [...document.querySelectorAll("[role=dialog] .surface")].find((x) => /Did you have a headache/.test(x.textContent) && /I did it/.test(x.textContent)); [...(c?.querySelectorAll("button") ?? [])].find((x) => /I did it/.test(x.textContent))?.click(); });
await p.waitForTimeout(1500); await shot("after-i-did-it");
out.afterDid = await p.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].map((x) => x.innerText.replace(/\s+/g, " ")).find((s) => /headache/i.test(s) && /Counting|At d/.test(s)) ?? "NO ROW: " + [...document.querySelectorAll("[role=dialog] button")].map((x) => x.innerText.replace(/s+/g, " ")).filter((s) => /headache/i.test(s)).join(" | "));
// B2: What helps → Test one change on Health warns
await p.keyboard.press("Escape"); await p.waitForTimeout(600);
await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns" } }))); await p.waitForTimeout(2200);
await p.evaluate(() => document.querySelector("[data-tour=helps]")?.click()); await p.waitForTimeout(1200);
await p.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].find((x) => /Test one change/.test(x.textContent))?.click()); await p.waitForTimeout(1500);
await p.evaluate(() => [...document.querySelectorAll("[aria-modal=true] button")].find((x) => /^Health$/.test(x.textContent.trim()))?.click()); await p.waitForTimeout(500);
await p.evaluate(() => [...document.querySelectorAll("[aria-modal=true] button[aria-pressed]")].find((x) => /water/i.test(x.textContent))?.click()); await p.waitForTimeout(600);
await shot("replace-warning");
out.replace = await p.evaluate(() => document.querySelector("[aria-modal=true]")?.innerText.replace(/\s+/g, " ").slice(-260));
out.offersRunning = await p.evaluate(() => [...document.querySelectorAll("[aria-modal=true] button[aria-pressed]")].some((x) => /Go to bed by 23:00/.test(x.textContent)));
await p.evaluate(() => [...document.querySelectorAll("[aria-modal=true] button")].find((x) => /close/i.test(x.getAttribute("aria-label") ?? ""))?.click()); await p.waitForTimeout(800);
// C9: a link's "See the days"
await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "findings", back: true } }))); await p.waitForTimeout(2200);
await p.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].find((x) => /See the days|^Chart$/.test(x.textContent.trim()))?.click()); await p.waitForTimeout(1800);
await shot("link-days");
out.linkDays = await p.evaluate(() => document.querySelector("[role=dialog] h2")?.textContent);
// C14
out.noToday = await p.evaluate(async () => { const c = await import("/src/lib/cardText.ts"), s = await import("/src/lib/storage.ts"); return (await s.getTrackers()).map((t) => c.cardQuestion(t)).filter((q) => /\btoday\b/i.test(q)); });
// B1: old look and back keeps the path start
await p.evaluate(async () => { (await import("/src/components/UpgradeInvite.tsx")).switchToOld(); }).catch(() => {});
await p.waitForTimeout(2500);
await p.evaluate(async () => { (await import("/src/components/UpgradeInvite.tsx")).switchToNew(); }).catch(() => {});
await p.waitForTimeout(2500);
out.pathStartAfterRoundTrip = await p.evaluate(() => localStorage.getItem("memap_path_start"));
console.log(JSON.stringify({ out, errs }, null, 1));
await b.close();
