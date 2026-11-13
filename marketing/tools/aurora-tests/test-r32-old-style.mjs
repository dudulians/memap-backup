// Old-style leftovers (her note, Nov 5 2026: "вот тут старый дизайн ещё остался?" on Edit note).
// Opens every sheet reachable in the new screens, takes a picture, and lists buttons that
// are not in the kit (flat, square-ish, mint) and selected chips with a tinted fill.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r32`; mkdirSync(D, { recursive: true });
const theme = process.argv[2] || "aurora-light";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const p = await ctx.newPage();
const errs = [], out = {};
p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
await p.evaluate(async (theme) => {
  const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const g = await import("/src/lib/demoDataGenerator.ts"); const r = g.generateDemoData("showcase");
  localStorage.clear();
  localStorage.setItem("memap_trackers", JSON.stringify(r.newTrackers)); localStorage.setItem("memap_entries", JSON.stringify(r.newEntries.filter((e) => e.date !== iso(0))));
  localStorage.setItem("memap_path_start", [...r.newEntries.map((e) => e.date)].sort()[0]);
  localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_avatar", "05_panda");
  localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", theme);
  const now = new Date().toISOString();
  localStorage.setItem("memap_notes", JSON.stringify([{ id: "n1", date: iso(24), text: "Slept badly, long day.", createdAt: now, updatedAt: now }]));
}, theme);
await p.reload(); await p.waitForTimeout(2000);
// buttons not in the kit, and tinted selected chips, in the open sheet (or page)
const scan = (name) => p.evaluate((name) => {
  const root = [...document.querySelectorAll("[role=dialog]")].pop() || document.body;
  const bad = [];
  for (const el of root.querySelectorAll("button")) {
    const r = el.getBoundingClientRect(); if (r.width < 60 || r.height < 30) continue;
    const s = getComputedStyle(el), bg = s.backgroundColor, rad = parseFloat(s.borderTopLeftRadius);
    const m = bg.match(/rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)/); if (!m) continue;
    const [R, G, B] = [+m[1], +m[2], +m[3]], A = m[4] === undefined ? 1 : +m[4];
    const teal = G > R + 40 && B > R + 20 && A > 0.05;
    const txt = el.textContent.trim().slice(0, 24);
    if (teal && A < 0.6) bad.push(`tinted: ${txt}`);
    else if (teal && s.boxShadow === "none") bad.push(`flat teal: ${txt}`);
    else if (teal && Math.abs(R - 60) + Math.abs(G - 154) + Math.abs(B - 145) > 60 && Math.abs(R - 30) + Math.abs(G - 165) + Math.abs(B - 150) > 60) bad.push(`other teal ${bg}: ${txt}`);
    if (rad < 12 && r.height >= 40 && s.backgroundColor !== "rgba(0, 0, 0, 0)") bad.push(`square: ${txt}`);
  }
  return [...new Set(bad)];
}, name);
const shot = async (name) => { await p.screenshot({ path: `${D}/${theme}-${name}.png` }); const s = await scan(name); if (s.length) out[name] = s; };
const esc = async () => { await p.keyboard.press("Escape"); await p.waitForTimeout(700); };
const tab = async (i) => { await p.locator("nav button").nth(i).click(); await p.waitForTimeout(1500); };

// Notes: edit a note, a new note
await tab(2);
await p.getByText("Slept badly, long day.").click(); await p.waitForTimeout(1000); await shot("1-edit-note"); await esc();
await p.getByRole("button", { name: /Write|New note/i }).first().click().catch(() => {}); await p.waitForTimeout(1000); await shot("2-new-note"); await esc();
// You, Settings
await p.locator("header button").last().click().catch(() => {}); await p.waitForTimeout(1200); await shot("3-you");
await p.getByRole("button", { name: /Settings/i }).first().click().catch(() => {}); await p.waitForTimeout(1200); await shot("4-settings");
await esc(); await esc();
// Add a question
await tab(0);
await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "questions" } }))); await p.waitForTimeout(1500);
await shot("5-questions");
await p.getByRole("button", { name: /Add|New question/i }).first().click().catch(() => {}); await p.waitForTimeout(1200); await shot("6-add-question");
await p.getByRole("button", { name: /Write my own/i }).first().click().catch(() => {}); await p.waitForTimeout(1200); await shot("7-own-question");
await esc(); await esc();
// a question's settings
await p.locator("button[aria-label*='More'], button[aria-label*='options' i]").first().click().catch(() => {}); await p.waitForTimeout(1000); await shot("8-question-menu");
console.log(JSON.stringify({ ...out, errs }, null, 1));
await b.close();
