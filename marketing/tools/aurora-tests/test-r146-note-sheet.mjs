// r146 (Nov 12 2026, her notes on the note sheet): the "about what" chips show a question's whole name (no cut piece),
// Save is in sight without scrolling even with many questions, and leaving the sheet saves the note (an empty one is
// not saved). EN and RU.
// Run from marketing/tools:  node aurora-tests/test-r146-note-sheet.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r146`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const fails = [], errs = [];
const ok = (name, cond, info = "") => { console.log(name, "→", cond ? "ok" : `FAIL ${JSON.stringify(info)}`.slice(0, 500)); if (!cond) fails.push(name); };
for (const lang of ["en", "ru"]) {
  const p = await (await b.newContext({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2, hasTouch: true })).newPage();
  p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async (lang) => {
    localStorage.clear(); localStorage.setItem("memap_ab_onb", "A"); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1");
    localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1");
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: dz.daysAgoIso(1) }));
    // many questions, long names among them
    await dz.ensureTemplates(["said-yes-when-meant-no", "felt-not-like-others", "burned-out-after-work", "argued-with-partner", "slept-enough", "outside-30min", "felt-calm", "headache", "compared-on-social", "kept-going-over-it", "switched-off-from-work", "felt-understood", "let-it-pass", "drank-alcohol"]);
    localStorage.setItem("memap_path_start", dz.daysAgoIso(10));
  }, lang);
  await p.reload(); await p.waitForTimeout(2500);
  const open = async () => {
    await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "notes" } }))); await p.waitForTimeout(1200);
    await p.locator("button.raised-btn").filter({ hasNotText: /^$/ }).first().click().catch(async () => { await p.locator("button.raised-btn.is-icon").first().click(); });
    await p.waitForTimeout(900);
  };
  await open();
  const look = await p.evaluate(() => {
    const chips = [...document.querySelectorAll("[data-note-q]")];
    const cut = chips.filter((c) => c.scrollWidth > c.clientWidth + 1 || getComputedStyle(c).textOverflow === "ellipsis").map((c) => c.textContent);
    const save = document.querySelector("[data-note-save]")?.getBoundingClientRect();
    return { chips: chips.length, cut, saveVisible: !!save && save.bottom <= innerHeight && save.top >= 0, longest: chips.map((c) => c.textContent).sort((a, b) => b.length - a.length)[0] };
  });
  await p.screenshot({ path: `${D}/${lang}-sheet.png` });
  ok(`${lang}: every question named in full`, look.chips >= 10 && look.cut.length === 0, look);
  ok(`${lang}: Save in sight without scrolling`, look.saveVisible, look);
  // leaving saves what was written
  await p.locator("textarea").first().fill(lang === "en" ? "Quiet evening, long walk" : "Тихий вечер, долгая прогулка");
  await p.keyboard.press("Escape"); await p.waitForTimeout(1200);
  const saved = await p.evaluate(async () => (await (await import("/src/lib/notes.ts")).getNotes()).map((n) => n.text));
  ok(`${lang}: leaving saves the note`, saved.some((x) => /Quiet evening|Тихий вечер/.test(x)), saved);
  // an empty note is not saved on leaving
  await open();
  await p.keyboard.press("Escape"); await p.waitForTimeout(1000);
  const after = await p.evaluate(async () => (await (await import("/src/lib/notes.ts")).getNotes()).length);
  ok(`${lang}: an empty note is not saved`, after === saved.length, { before: saved.length, after });
  await p.context().close();
}
console.log(JSON.stringify({ fails, errs: errs.slice(0, 3) }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
