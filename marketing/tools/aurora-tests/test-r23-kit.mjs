// One look everywhere (her note, Nov 5 2026: "стили отличаются… оранжевая
// обводка, тёмно-зелёные кнопки, зелёный фон… формат кнопок и переключателей
// должен быть везде одинаковый, шрифты проверить"). Walks the screens, takes
// pictures, and lists every font family and every green-tinted background it
// finds. Usage: node aurora-tests/test-r23-kit.mjs [theme]
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const theme = process.argv[2] || "aurora-light";
const D = `./aurora-tests/work/r23-kit`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], fonts = {}, tints = {}, caps = {};
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const p = await ctx.newPage();
p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
await p.evaluate(async (theme) => {
  const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
  for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
  const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
  const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId) && e.date !== iso(0));
  localStorage.clear();
  localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
  localStorage.setItem("memap_path_start", [...E.map((e) => e.date)].sort()[0]);
  localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_avatar", "11_otter");
  localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", theme);
  localStorage.setItem("memap_map_view", "map");
}, theme);
await p.reload(); await p.waitForTimeout(2000);
// fonts and green backgrounds on what is on screen now
const scan = async (name) => {
  const r = await p.evaluate(() => {
    const fam = {}, tint = [], up = [];
    for (const el of document.querySelectorAll("body *")) {
      const s = getComputedStyle(el), box = el.getBoundingClientRect();
      if (!box.width || !box.height || s.visibility === "hidden" || s.display === "none") continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (own) fam[s.fontFamily.split(",")[0].trim()] = (fam[s.fontFamily.split(",")[0].trim()] || 0) + 1;
      if (own && s.textTransform === "uppercase") up.push(el.textContent.trim().slice(0, 30));
      // a green/teal-ish background (hue 140-185, some colour) on anything bigger than a dot
      const m = s.backgroundColor.match(/rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)/);
      if (m && box.width > 20 && box.height > 20) {
        const [R, G, B] = [m[1], m[2], m[3]].map(Number), A = m[4] === undefined ? 1 : +m[4];
        const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
        if (A > 0.04 && mx - mn > 25) {
          let h = 0; const d = mx - mn;
          if (mx === R) h = ((G - B) / d) % 6; else if (mx === G) h = (B - R) / d + 2; else h = (R - G) / d + 4;
          h = (h * 60 + 360) % 360;
          if (h >= 140 && h <= 185 && !/BUTTON/.test(el.tagName) && !el.closest("button.raised-btn, .press3d, .path-node")) tint.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 50)} ${s.backgroundColor}`);
        }
      }
    }
    return { fam, tint: [...new Set(tint)].slice(0, 8), up: [...new Set(up)].slice(0, 10) };
  });
  fonts[name] = r.fam; if (r.tint.length) tints[name] = r.tint; if (r.up.length) caps[name] = r.up;
};
const shot = async (name) => { await p.screenshot({ path: `${D}/${theme}-${name}.png` }); await scan(name); };
const esc = async () => { await p.keyboard.press("Escape"); await p.waitForTimeout(700); };

await shot("01-today");
await p.locator("nav button").nth(1).click(); await p.waitForTimeout(1800);
await shot("02-world");
// Action points
await p.getByRole("button", { name: /Action points/ }).first().click(); await p.waitForTimeout(1200);
await shot("03-actions");
await p.getByRole("button", { name: "Show" }).first().click(); await p.waitForTimeout(900);
await shot("04-show");
await esc();
await p.getByRole("button", { name: "Not for me" }).first().click(); await p.waitForTimeout(900);
await p.locator("[aria-pressed]").filter({ hasText: /minutes|bed|lines|walk|water|coffee/i }).first().click().catch(() => {});
await p.waitForTimeout(300);
await shot("05-not-for-me");
await esc();
await p.getByRole("button", { name: "I'll try" }).first().click(); await p.waitForTimeout(1300);
await shot("06-test-pick");
await p.getByRole("button", { name: "Close" }).first().click().catch(async () => { await esc(); }); await p.waitForTimeout(1500);
await esc(); await p.waitForTimeout(400);
// the calendar, then a day in it
await p.getByRole("button", { name: /Calendar/ }).first().click(); await p.waitForTimeout(1200);
await shot("07-calendar");
await esc();
await p.getByRole("button", { name: /Chart/ }).first().click(); await p.waitForTimeout(1500);
await shot("08-chart");
await esc();
// an island sheet
await p.locator(".planet-map-isle").first().click(); await p.waitForTimeout(1400);
await shot("09-island");
await p.mouse.wheel(0, 600); await p.waitForTimeout(500);
await shot("10-island-more");
await esc();
await p.locator("nav button").nth(2).click(); await p.waitForTimeout(1200);
await shot("11-notes");
console.log(JSON.stringify({ fonts, tints, caps, errs: errs.filter((e) => !/InAppReview/.test(e)) }, null, 1));
await b.close();
