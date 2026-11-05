// Manrope + soft graphite (her pick, Nov 5 2026): walk the main screens in English and
// Russian, day and night; list the font in use and every text that no longer fits
// (cut off or squeezed), and take pictures.
// Usage: node aurora-tests/test-r28-font.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r28`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
const open = async (lang, theme) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async ({ lang, theme }) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
    for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId) && e.date !== iso(0));
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    localStorage.setItem("memap_path_start", [...E.map((e) => e.date)].sort()[0]);
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_avatar", "11_otter");
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", theme);
    localStorage.setItem("memap_map_view", "map");
  }, { lang, theme });
  await p.reload(); await p.waitForTimeout(2200);
  return { ctx, p };
};
// texts that are cut (ellipsis or hidden overflow) or wider than their box
const cut = (p) => p.evaluate(() => {
  const res = [];
  for (const el of document.querySelectorAll("body *")) {
    if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    if (!r.width || s.visibility === "hidden" || +s.opacity === 0) continue;
    if (el.scrollWidth > el.clientWidth + 1 && (s.overflow !== "visible" || s.textOverflow === "ellipsis")) res.push(el.textContent.trim().slice(0, 40));
  }
  return [...new Set(res)].slice(0, 12);
});
const font = (p) => p.evaluate(() => getComputedStyle(document.querySelector("h1, h2, p, span")).fontFamily.split(",")[0] + " · " + getComputedStyle(document.body).color);
const esc = async (p) => { await p.keyboard.press("Escape"); await p.waitForTimeout(700); };
for (const [lang, theme] of [["en", "aurora-light"], ["ru", "aurora-light"], ["ru", "aurora"]]) {
  const { ctx, p } = await open(lang, theme);
  const tag = `${lang}-${theme === "aurora" ? "night" : "day"}`;
  const step = async (name) => { await p.screenshot({ path: `${D}/${tag}-${name}.png` }); const c = await cut(p); if (c.length) out[`${tag} ${name}`] = c; };
  out[`${tag} font`] = await font(p);
  await step("1-today");
  await p.locator("nav button").nth(1).click(); await p.waitForTimeout(1800); await step("2-world");
  await p.locator(".planet-map-isle").first().click(); await p.waitForTimeout(1300); await step("3-island");
  await esc(p);
  await p.locator("nav button").nth(1).click(); await p.waitForTimeout(400);
  const ap = p.getByRole("button", { name: /Action points|Точки действия/ }).first();
  await ap.click(); await p.waitForTimeout(1200); await step("4-actions");
  await esc(p);
  await p.locator("nav button").nth(2).click(); await p.waitForTimeout(1200); await step("5-notes");
  await p.locator("nav button").nth(0).click(); await p.waitForTimeout(1500);
  await p.locator(".path-node.disc-current").first().click().catch(() => {}); await p.waitForTimeout(800);
  await p.getByRole("button", { name: /^(Start|Начать)/ }).last().click().catch(() => {}); await p.waitForTimeout(1500); await step("6-question");
  await ctx.close();
}
console.log(JSON.stringify({ ...out, errs }, null, 1));
await b.close();
