// v112: the owner's switch (Settings → Data & privacy; in a store build after 7 taps on the version): see A, B or C from the start.
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], logs = [], out = {};
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => { const s = m.text(); if (s.includes("onb_variant")) logs.push(s); });
await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
// an old user (answers from before), Settings open
await p.evaluate(async () => {
  const dz = await import("/src/lib/doors.ts");
  localStorage.clear();
  localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_cohort", "old");
  const ids = await dz.ensureTemplates(["migraine", "slept-enough"]);
  localStorage.setItem("memap_door", JSON.stringify({ id: "migraine", trackerId: ids[0], contextTrackerIds: [], startedAt: "2026-10-01" }));
});
logs.length = 0;
await p.reload(); await p.waitForTimeout(2500);
out.oldUser = logs.slice(0, 1);
await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-you"))); await p.waitForTimeout(1000);
await p.getByRole("button", { name: /^Settings/ }).last().click(); await p.waitForTimeout(900);
await p.getByRole("button", { name: /^Data/ }).first().click().catch(() => {}); await p.waitForTimeout(900);
await p.screenshot({ path: "./aurora-tests/work/r89/switch-help.png" }); out.switchShown = await p.getByText(/Onboarding test/).isVisible().catch(() => false);
out.lineBefore = await p.getByText(/This phone:/).innerText().catch(() => "NONE");
await p.getByRole("button", { name: /^C$/ }).click({ timeout: 5000 }).catch(() => {}); await p.waitForTimeout(1500);
out.onboardingOpen = (await p.locator(".onb").count()) > 0;
await p.getByRole("button", { name: /^Get started/ }).first().click(); await p.waitForTimeout(700);
out.cTopicTitle = await p.locator(".onb h1").first().innerText();
out.label = logs.slice(-1);
out.stored = await p.evaluate(() => ({ preview: localStorage.getItem("memap_ab_onb_preview"), group: localStorage.getItem("memap_ab_onb") }));
console.log(JSON.stringify({ out, errs }, null, 1));
await b.close();
