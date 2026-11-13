// Her Nov 3 late notes: the bubble game explains itself, one way out (the X),
// one clear way to save; a past day opens its answers and she changes only
// the ones she taps; questions read as questions everywhere.
import { chromium } from "playwright-core";
const D = "./aurora-tests/work";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true })).newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
const out = {};
const seed = async () => {
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(900);
  await p.evaluate(async () => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
    for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId) && e.date !== iso(0));
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    localStorage.setItem("memap_path_start", [...E.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_avatar", "08_fox");
    localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light");
  });
  await p.reload(); await p.waitForTimeout(2300);
};
const modal = () => p.evaluate(() => ([...document.querySelectorAll('[aria-modal="true"]')].pop()?.innerText || "").split("\n").filter(Boolean).join(" | "));
const notes = () => p.evaluate(() => JSON.parse(localStorage.getItem("memap_notes") || localStorage.getItem("memap-notes") || "[]").map((n) => n.text).join(" ¦ "));

// 1. The bubbles: how it works, the first time.
await seed();
await p.locator('[aria-label="Unload your mind"]').first().click(); await p.waitForTimeout(1300);
out.intro = await modal();
await p.screenshot({ path: `${D}/r9-intro.png` });
await p.locator('[aria-modal="true"]').getByRole("button", { name: /^start$/i }).click(); await p.waitForTimeout(500);
for (const s of ["Work deadline on Friday", "Call the dentist"]) { await p.locator('[aria-modal="true"] input').fill(s); await p.keyboard.press("Enter"); await p.waitForTimeout(500); }
out.chip = await p.evaluate(() => [...document.querySelectorAll('[aria-modal="true"] button')].some((x) => /to notes/i.test(x.innerText)));
out.doneGone = await p.evaluate(() => ![...document.querySelectorAll('[aria-modal="true"] button')].some((x) => /^done$/i.test(x.innerText.trim())));
await p.getByRole("button", { name: /^to notes$/i }).click(); await p.waitForTimeout(500);
await p.waitForTimeout(2500);
await p.screenshot({ path: `${D}/r9-playing.png` });
// the X: the one thought not saved yet is offered
await p.locator('[aria-modal="true"] button[aria-label="Close"]').first().click(); await p.waitForTimeout(700);
out.end = await modal();
await p.screenshot({ path: `${D}/r9-end.png` });
await p.getByRole("button", { name: /^save to notes/i }).click(); await p.waitForTimeout(900);
out.closed = await p.evaluate(() => !document.querySelector('[aria-modal="true"] canvas'));
out.notes = await notes();
// again: no intro, and the X with nothing written just closes
await p.locator('[aria-label="Unload your mind"]').first().click(); await p.waitForTimeout(1200);
out.introAgain = await p.evaluate(() => /How it works/.test(document.querySelector('[aria-modal="true"]')?.innerText || ""));
await p.locator('[aria-modal="true"] button[aria-label="Close"]').first().click(); await p.waitForTimeout(700);
out.closedAtOnce = await p.evaluate(() => !document.querySelector('[aria-modal="true"] canvas'));

// 2. A past day: its answers; change just one.
// the first day of this week rolls to the band first (on the drum, far rows are not tappable)
await p.evaluate(() => document.querySelector("section [data-path-stop]").scrollIntoView({ block: "center" })); await p.waitForTimeout(900);
const past = p.locator("section [data-path-stop]").first();
out.pastLabel = await past.getAttribute("aria-label");
await past.click(); await p.waitForTimeout(500);
out.pastBubble = await p.evaluate(() => document.querySelector(".path-bubble")?.innerText.split("\n").filter(Boolean).join(" | "));
await p.getByRole("button", { name: /see or change answers/i }).click(); await p.waitForTimeout(1200);
out.daySheet = await p.evaluate(() => ([...document.querySelectorAll('[role="dialog"]')].pop()?.innerText || "").split("\n").filter(Boolean).slice(0, 9).join(" | "));
await p.screenshot({ path: `${D}/r9-day.png` });
const before = await p.evaluate(() => JSON.parse(localStorage.getItem("memap_entries")).length);
// the first answer not chosen yet: tap it, it becomes the answer; tap it again: nothing
const off = p.locator('[role="dialog"] button[aria-pressed="false"]').first();
const label = await off.getAttribute("aria-pressed");
const row = await off.evaluate((el) => el.closest(".surface")?.querySelector("p")?.textContent || "");
await off.click(); await p.waitForTimeout(600);
const pressedNow = await p.evaluate((row) => { const card = [...document.querySelectorAll('[role="dialog"] .surface')].find((c) => c.querySelector("p")?.textContent === row); return [...card.querySelectorAll("button")].map((b) => `${b.textContent}:${b.getAttribute("aria-pressed")}`).join(" "); }, row);
const after1 = await p.evaluate(() => JSON.parse(localStorage.getItem("memap_entries")).length);
out.changed = `${row} · was ${label} → ${pressedNow} · entries ${before} → ${after1}`;
await p.keyboard.press("Escape"); await p.waitForTimeout(700);

// 3. Questions everywhere: the library, her list, what she types.
await p.locator('[aria-label="Add a question"]').click().catch(() => {});
await p.waitForTimeout(1000);
if (await p.getByPlaceholder(/search/i).count() === 0) {
  await p.getByRole("button", { name: /^map$/i }).first().click(); await p.waitForTimeout(1800);
  await p.locator("header").getByRole("button", { name: /^you$/i }).click(); await p.waitForTimeout(900);
await p.locator('[role="dialog"]').getByRole("button", { name: /^my questions/i }).click(); await p.waitForTimeout(1200);
  await p.locator('[data-coachmark="add-button"]').click(); await p.waitForTimeout(1000);
}
out.library = await p.evaluate(() => [...document.querySelectorAll('[role="dialog"] button.text-left')].map((x) => x.innerText.split("\n")[0]).filter(Boolean).slice(0, 6).join(" | "));
await p.screenshot({ path: `${D}/r9-library.png` });
await p.getByRole("button", { name: /write my own|своё/i }).click(); await p.waitForTimeout(500);
out.placeholder = await p.locator("#questionText").getAttribute("placeholder");
await p.locator("#questionText").fill("drank coffee after 4 pm");
await p.getByRole("button", { name: /^add$/i }).last().click(); await p.waitForTimeout(900);
out.saved = await p.evaluate(() => JSON.parse(localStorage.getItem("memap_trackers")).find((x) => /coffee after 4/i.test(x.questionText))?.questionText || "missing");
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
