// The way back to the old look (Nov 6 2026): on the first Settings screen; tapping it
// switches to the classic screens with her answers kept.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r43`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
await p.evaluate(async () => {
  const d = await import("/src/lib/doors.ts"); localStorage.clear();
  await d.ensureTemplates(["migraine", "slept-enough", "felt-anxious"]);
  localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", "en");
});
await p.reload(); await p.waitForTimeout(2200);
await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-you"))); await p.waitForTimeout(1200);
await p.getByText("Settings").first().click(); await p.waitForTimeout(1200);
await p.screenshot({ path: `${D}/settings.png` });
out.row = await p.getByRole("button", { name: /Back to the old look/ }).count();
await p.getByRole("button", { name: /Back to the old look/ }).first().click(); await p.waitForTimeout(2500);
out.after = await p.evaluate(() => ({ ui: localStorage.getItem("memap_ui"), questions: JSON.parse(localStorage.getItem("memap_trackers") || "[]").length }));
await p.screenshot({ path: `${D}/classic.png` });
console.log(JSON.stringify({ ...out, errs }, null, 1));
await b.close();
