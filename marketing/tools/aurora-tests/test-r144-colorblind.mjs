// r144 (Nov 12 2026, her idea «режим для дальтоников отдельным», her pick «O: оранжевый и голубой»): off by default (her
// colours E, good days filled); on: orange and sky blue, good days as rings in the app, and the report draws them too; the report draws good days as rings always (black-and-white printing).
// Run from marketing/tools:  node aurora-tests/test-r144-colorblind.mjs
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const fails = [], errs = [];
const ok = (name, cond, info = "") => { console.log(name, "→", cond ? "ok" : `FAIL ${JSON.stringify(info)}`.slice(0, 500)); if (!cond) fails.push(name); };
for (const on of [false, true]) {
  const p = await (await b.newContext({ viewport: { width: 400, height: 860 } })).newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async (on) => {
    localStorage.clear(); localStorage.setItem("memap_ab_onb", "A"); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "1"); if (on) localStorage.setItem("memap_colorblind", "1");
    localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1"); localStorage.setItem("memap_first_link_seen", "before");
    localStorage.setItem("memap_examples_seen", JSON.stringify(["link", "month", "rule", "test", "chart", "chart-one"]));
    const g = await import("/src/lib/demoDataGenerator.ts"), st = await import("/src/lib/storage.ts"), dz = await import("/src/lib/doors.ts");
    localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: dz.daysAgoIso(1) }));
    const r = g.generateDemoData("good-days"); await st.saveTrackers(r.newTrackers); await st.saveEntries(r.newEntries);
    localStorage.setItem("memap_path_start", dz.daysAgoIso(59));
  }, on);
  await p.reload(); await p.waitForTimeout(2500);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "findings", back: true } })));
  await p.waitForTimeout(2200);
  await p.evaluate(() => document.querySelectorAll("[data-link-card] button[aria-expanded=false]").forEach((x) => x.click())); await p.waitForTimeout(500);
  const r = await p.evaluate(async () => {
    const css = getComputedStyle(document.documentElement);
    const dot = [...document.querySelectorAll('.rounded-full[style*="var(--balanced)"]')][0];
    const ds = dot ? getComputedStyle(dot) : null;
    // the report: is a good day drawn as a ring (stroke) or a disc (fill)
    let strokes = 0; const orig = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke = function (...a) { strokes++; return orig.apply(this, a); };
    const rep = await import("/src/lib/doctorReport.ts"), s = await import("/src/lib/storage.ts");
    const trackers = await s.getTrackers(), entries = await s.getEntries();
    const ids = rep.reportQuestions(trackers, entries, 60, "doctor").flatMap((g) => g.qs.map((x) => x.q.id));
    await rep.drawReport({ trackers, entries, notes: [], audience: "doctor", kind: "full", ids, mainIds: [], days: 60, withNotes: false, name: "" });
    CanvasRenderingContext2D.prototype.stroke = orig;
    return { cb: document.documentElement.getAttribute("data-cb"), strong: css.getPropertyValue("--strong").trim(), balanced: css.getPropertyValue("--balanced").trim(), dot: !!dot, bg: ds?.backgroundColor, shadow: ds?.boxShadow, strokes };
  });
  const tag = on ? "on" : "off";
  ok(`${tag}: the page knows the mode`, r.cb === (on ? "1" : "0"), r);
  ok(`${tag}: colours`, on ? r.strong === "24 100% 42%" && r.balanced === "202 77% 63%" : r.strong === "335 68% 63%" && r.balanced === "162 48% 50%", r);
  ok(`${tag}: a good day's dot ${on ? "is a ring" : "is filled"}`, r.dot && (on ? r.bg === "rgba(0, 0, 0, 0)" && /inset/.test(r.shadow) : r.bg !== "rgba(0, 0, 0, 0)" && !/inset/.test(r.shadow ?? "")), r);
  // rings on paper always, for black-and-white printing (her «Да, всегда», Nov 12 2026)
  ok(`${tag}: the report draws good days as rings`, r.strokes > 50, r);
  await p.context().close();
}
console.log(JSON.stringify({ fails, errs: errs.slice(0, 3) }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
