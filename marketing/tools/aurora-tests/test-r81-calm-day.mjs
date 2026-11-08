// v100 (her notes, Nov 8 2026): a calm path (one questions step up to 10, at most 3 other steps),
// today's questions wait for the evening before 17:00, "Worth watching" tip a day, any-order hint,
// You → this calendar week. Model checks at 11:00 / 20:00, then the real screen at 11:00.
import { chromium } from "playwright-core";
const SHOTS = "aurora-tests/work/r81";
import fs from "fs"; fs.mkdirSync(SHOTS, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:8080/"); await p.waitForTimeout(1200);

// a person on day 3: 9 questions over 3 islands, two evenings answered
const seed = async (hour) => p.evaluate(async (hour) => {
  const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
  localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light"); localStorage.setItem("memap_avatar", "11_otter");
  const now = new Date(); now.setHours(hour, 0, 0, 0);
  const day = (k) => { const d = new Date(now); d.setDate(d.getDate() - k); return d; };
  const start = day(2); start.setHours(9, 0, 0, 0);
  const ids = await dz.ensureTemplates(["migraine", "slept-enough", "felt-stressed", "skipped-meal", "drank-water", "exercised", "argued-with-partner", "saw-friends", "screens-before-bed"]);
  const T = (await st.getTrackers()).map((t) => ({ ...t, createdAt: start.toISOString() }));
  await st.saveTrackers(T);
  localStorage.setItem("memap_onboarded_at", start.toISOString());
  localStorage.setItem("memap_path_start", dz.isoLocal(start));
  localStorage.setItem("memap_door", JSON.stringify({ id: "migraine", trackerId: ids[0], contextTrackerIds: [], startedAt: dz.isoLocal(start) }));
  const E = [];
  for (const k of [2, 1]) ids.forEach((id, i) => E.push({ id: `e${k}-${i}`, trackerId: id, date: dz.isoLocal(day(k)), value: (i + k) % 3 === 0, createdAt: day(k).toISOString() }));
  await st.saveEntries(E);
  return ids;
}, hour);

const model = async (hour) => p.evaluate(async (hour) => {
  const ps = await import("/src/lib/pathSteps.ts"), st = await import("/src/lib/storage.ts");
  const now = new Date(); now.setHours(hour, 0, 0, 0);
  const m = ps.pathModel(await st.getTrackers(), await st.getEntries(), now);
  return m.steps.map((s) => `${s.id}${s.tonight ? " (tonight)" : ""}${s.done ? " ✓" : ""}${s.trackerIds?.length ? ` [${s.answered}/${s.trackerIds.length}]` : ""}`);
}, hour);

const out = {};
await seed(11); out.at11 = await model(11);
await seed(20); out.at20 = await model(20);
const check = {
  oneQuestionsStep: out.at11.filter((s) => s.startsWith("q:")).length === 1,
  questionsLastAt11: out.at11[out.at11.length - 1].startsWith("q:") && out.at11[out.at11.length - 1].includes("tonight"),
  tipStep: out.at11.some((s) => s.startsWith("tip:")),
  extrasAtMost3: out.at11.filter((s) => /^(report|test|act|link|task|game|tip)/.test(s)).length <= 3,
  questionsFirstAt20: out.at20.findIndex((s) => s.startsWith("q:")) < out.at20.findIndex((s) => s.startsWith("tip:")),
};

// the real screen at 11:00
await seed(11);
const t11 = new Date(); t11.setHours(11, 0, 0, 0);
await p.clock.install({ time: t11 });
await p.reload(); await p.waitForTimeout(2500);
await p.screenshot({ path: `${SHOTS}/01-today-11am.png` });
const labels = await p.$$eval("[data-path-stop]", (els) => els.map((e) => e.getAttribute("aria-label")));
const hint = await p.getByText("Go in any order").count();
// open "Worth watching"
await p.locator('[data-path-stop][aria-label="Worth watching"]').first().click(); await p.waitForTimeout(600);
await p.screenshot({ path: `${SHOTS}/02-tip-card.png` });
await p.getByRole("button", { name: "Read" }).first().click(); await p.waitForTimeout(900);
await p.screenshot({ path: `${SHOTS}/03-tip-sheet.png` });
const sheet = await p.locator('[role="dialog"]').last().innerText();
const before = await p.evaluate(async () => (await (await import("/src/lib/storage.ts")).getTrackers()).length);
await p.getByText("Watch it", { exact: false }).first().click(); await p.waitForTimeout(900);
await p.screenshot({ path: `${SHOTS}/04-tip-added.png` });
const after = await p.evaluate(async () => (await (await import("/src/lib/storage.ts")).getTrackers()).length);
check.tipAddsQuestion = after === before + 1;
// the tonight step's card
await p.keyboard.press("Escape"); await p.waitForTimeout(600);
const q = p.locator('[data-path-stop]').filter({ has: p.locator("svg") });
const qLabel = labels.find((l) => /questions/i.test(l ?? ""));
if (qLabel) { await p.locator(`[data-path-stop][aria-label="${qLabel}"]`).first().click(); await p.waitForTimeout(600); }
await p.screenshot({ path: `${SHOTS}/05-tonight-card.png` });
const tonightCard = await p.locator('[role="dialog"]').last().innerText().catch(() => "");
check.tonightCard = /this evening/i.test(tonightCard) && /Answer now/.test(tonightCard);
console.log(JSON.stringify({ out, check, labels, hint, sheet, tonightCard, errs }, null, 1));
await b.close();
