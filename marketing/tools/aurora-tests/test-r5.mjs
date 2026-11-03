// Her Nov 3 notes: add/untick questions, plain rules, action points first,
// a simpler island sheet with remove, island filters, one chart style,
// open vs not-yet on the path, ASMR bubbles.
import { chromium } from "playwright-core";
const D = "./aurora-tests/work";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true })).newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
const out = {};
const seed = async (extra) => {
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(900);
  await p.evaluate(async (extra) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
    for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId) && e.date !== iso(0));
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    localStorage.setItem("memap_path_start", [...E.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_unload_intro", "seen"); localStorage.setItem("memap_tour_seen", "true");
    localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
    if (extra === "addTask") localStorage.setItem("memap_path_tasks", JSON.stringify({ note: { done: iso(5) }, calendar: { done: iso(5) } }));
  }, extra);
  await p.reload(); await p.waitForTimeout(2300);
};
const count = () => p.evaluate(() => JSON.parse(localStorage.getItem("memap_trackers")).filter((t) => !t.archived).length);
const toMap = async () => { await p.getByRole("button", { name: /^map$/i }).first().click(); await p.waitForTimeout(2200); };

// 1. Add a question: add, take back; one she has; her own with a plain rule.
await seed("addTask");
await p.screenshot({ path: `${D}/r5-path.png` });
out.pathLooks = await p.evaluate(() => [...document.querySelectorAll("[data-path-stop][data-shape]")].slice(0, 16).map((e) => `${e.getAttribute("aria-label")}:${getComputedStyle(e).borderTopStyle}`).join(" | "));
await p.locator('[aria-label="Add a question"]').click(); await p.waitForTimeout(1200);
const before = await count();
await p.getByPlaceholder(/search/i).fill("close to partner"); await p.waitForTimeout(500);
const row = p.locator("button", { hasText: /warm moment with your partner|close to partner|close to my partner/i }).first();
out.rowFound = await row.count();
await row.click(); await p.waitForTimeout(600);
out.afterAdd = (await count()) - before;
await p.screenshot({ path: `${D}/r5-add-ticked.png` });
await row.click(); await p.waitForTimeout(600);
out.afterUndo = (await count()) - before;
await p.getByPlaceholder(/search/i).fill("argued"); await p.waitForTimeout(500);
out.argued = await p.evaluate(() => [...document.querySelectorAll("button")].map((x) => x.innerText).find((x) => /argued|fight with your partner/i.test(x)) || "");
await p.screenshot({ path: `${D}/r5-already.png` });
await p.getByPlaceholder(/search/i).fill(""); await p.waitForTimeout(300);
await p.getByRole("button", { name: /write my own|своё/i }).click(); await p.waitForTimeout(600);
await p.locator("#questionText").fill("Did I drink coffee after 4 pm?");
await p.getByRole("button", { name: /^bad$|^hard$/i }).first().click(); await p.waitForTimeout(300);
await p.getByRole("button", { name: /^3 days a week$/i }).click(); await p.waitForTimeout(300);
await p.getByPlaceholder(/go to bed earlier/i).fill("No coffee after lunch");
await p.screenshot({ path: `${D}/r5-own-rule.png` });
await p.getByRole("button", { name: /^add$/i }).last().click(); await p.waitForTimeout(900);
out.ownRule = await p.evaluate(() => { const t = JSON.parse(localStorage.getItem("memap_trackers")).find((x) => /coffee after 4/i.test(x.questionText)); return t ? `${t.threshold}/${t.periodDays} · ${t.adviceAboveThreshold}` : "missing"; });

// 2. Action points: the action first.
await seed();
await toMap();
await p.getByRole("button", { name: /^action points/i }).click(); await p.waitForTimeout(1300);
out.actionPoints = await p.evaluate(() => (document.querySelector('[role="dialog"]')?.innerText || "").split("\n").filter(Boolean).slice(0, 14).join(" | "));
await p.screenshot({ path: `${D}/r5-action-points.png` });
await p.locator('[role="dialog"] button', { hasText: /time to act/i }).first().click(); await p.waitForTimeout(800);
out.apSheet = await p.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].pop()?.innerText.split("\n").filter(Boolean).slice(0, 12).join(" | "));
await p.screenshot({ path: `${D}/r5-action-sheet.png` });
await p.keyboard.press("Escape"); await p.waitForTimeout(600);
await p.keyboard.press("Escape"); await p.waitForTimeout(600);

// 3. The island: plain week, questions with remove, its views.
await p.locator("main button[aria-label^='Health']").first().click(); await p.waitForTimeout(1300);
out.island = await p.evaluate(() => (document.querySelector('[role="dialog"]')?.innerText || "").split("\n").filter(Boolean).slice(0, 12).join(" | "));
await p.screenshot({ path: `${D}/r5-island.png` });
const qBefore = await count();
await p.locator('[role="dialog"] button[aria-label="More"]').first().click(); await p.waitForTimeout(400);
await p.getByRole("button", { name: /^remove question$/i }).click(); await p.waitForTimeout(300);
await p.screenshot({ path: `${D}/r5-remove-ask.png` });
await p.getByRole("button", { name: /^remove$/i }).click(); await p.waitForTimeout(900);
out.removed = qBefore - (await count());
await p.evaluate(() => { const d = document.querySelector('[role="dialog"] .overflow-y-auto'); if (d) d.scrollTop = d.scrollHeight; }); await p.waitForTimeout(300);
await p.screenshot({ path: `${D}/r5-island-end.png` });
await p.locator('[role="dialog"] button', { hasText: /^chart$/i }).first().click(); await p.waitForTimeout(1500);
out.filter = await p.evaluate(() => [...document.querySelectorAll('[role="dialog"] [role="tab"][aria-selected="true"]')].map((x) => x.innerText).join(" | "));
await p.screenshot({ path: `${D}/r5-chart-filtered.png` });
await p.getByRole("tab", { name: /each question/i }).click(); await p.waitForTimeout(500);
await p.locator('[role="dialog"] .grid button.surface').first().click(); await p.waitForTimeout(900);
const chartBox = await p.locator('[role="dialog"] div.select-none').first().boundingBox();
if (chartBox) { await p.mouse.click(chartBox.x + chartBox.width * 0.5, chartBox.y + chartBox.height * 0.5); await p.waitForTimeout(400); }
out.detail = await p.evaluate(() => (document.querySelector('[role="dialog"]')?.innerText || "").split("\n").filter(Boolean).slice(0, 12).join(" | "));
await p.screenshot({ path: `${D}/r5-chart-detail.png` });
await p.keyboard.press("Escape"); await p.waitForTimeout(600);

// 4. Bubbles.
await p.getByRole("button", { name: /^today$/i }).first().click(); await p.waitForTimeout(1500);
await p.locator('[aria-label="Unload your mind"]').first().click(); await p.waitForTimeout(1200);
for (const s of ["Work deadline on Friday", "Call the dentist"]) { await p.locator('[aria-modal="true"] input').fill(s); await p.keyboard.press("Enter"); await p.waitForTimeout(400); }
await p.waitForTimeout(3800);
await p.screenshot({ path: `${D}/r5-bubbles.png` });
const box = await p.locator('[aria-modal="true"] canvas').boundingBox();
const smalls = await p.evaluate(() => window.__unload().filter((x) => !x.text).slice(0, 2).map((x) => ({ x: x.x, y: x.y })));
for (const s of smalls) await p.mouse.click(box.x + s.x, box.y + s.y);
await p.waitForTimeout(140);
await p.screenshot({ path: `${D}/r5-bubbles-pop.png` });
out.popped = await p.evaluate(() => [...document.querySelectorAll('[aria-modal="true"] [aria-live]')].map((x) => x.innerText).join(""));
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
