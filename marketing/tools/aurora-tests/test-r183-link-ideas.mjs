// Her phone note (Nov 15 2026 evening): a "coffee after 2 pm → drained all day" link offered "charge your phone outside
// the bedroom" and "read or listen in bed instead of the feed" (the island's sleep ideas). "What to try" under a link
// offers only the two linked questions' own changes. Run from marketing/tools.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r183`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const out = {}, fails = [], errs = [];
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
await p.evaluate(async () => {
  const g = await import("/src/lib/demoDataGenerator.ts"); const r = g.generateDemoData("migraine-cycle");
  localStorage.clear();
  for (const [k, v] of Object.entries({ memap_ui: "new", memap_tour_seen: "true", memap_tour_completed: "1", memap_tour_world: "1", memap_tour_today: "1", memap_language: "en", memap_language_chosen: "true", memap_theme: "aurora-light", memap_first_link_seen: "before", memap_playful_asked: "seed", memap_tips_seen: JSON.stringify(["any-order", "report", "block:world", "you", "notes", "block:helps"]), memap_examples_seen: JSON.stringify(["link", "month", "rule", "test", "chart", "chart-one"]) })) localStorage.setItem(k, v);
  localStorage.setItem("memap_trackers", JSON.stringify(r.newTrackers)); localStorage.setItem("memap_entries", JSON.stringify(r.newEntries));
  localStorage.setItem("memap_path_start", new Date(Date.now() - 59 * 864e5).toISOString().slice(0, 10));
  // she said the period comes first (so the headache link has its "What to try")
  const lo = await import("/src/lib/linkOrder.ts").catch(() => null);
  const T = r.newTrackers, per = T.find((t) => /period/i.test(t.title) && !/pain|heavy/i.test(t.title)), head = T.find((t) => /headache/i.test(t.title));
  if (lo?.setLinkOrder && per && head) lo.setLinkOrder(per.id, head.id, per.id);
});
await p.reload(); await p.waitForTimeout(2400);
const ideasOf = async (re, tag) => {
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "findings", back: true } }))); await p.waitForTimeout(2000);
  await p.evaluate(() => document.querySelector("[data-more-links]")?.click()); await p.waitForTimeout(400);
  const opened = await p.evaluate((src) => { const re = new RegExp(src, "i"); const card = [...document.querySelectorAll("[role=dialog] [data-link-card]")].find((c) => re.test(c.textContent)); const btn = card?.querySelector("button[aria-expanded=false]") ?? card?.querySelector("button"); btn?.click(); return !!card; }, re);
  if (!opened) { fails.push(`${tag}: no such link card`); return null; }
  await p.waitForTimeout(900);
  for (let k = 0; k < 4 && !(await p.locator("[data-link-try=ask]").count()); k++) { await p.locator("[role=dialog] button", { hasText: /^Next/ }).first().click().catch(() => {}); await p.waitForTimeout(700); }
  if (!(await p.locator("[data-link-try=ask]").count())) { fails.push(`${tag}: no "What to try" button`); await p.screenshot({ path: `${D}/${tag}-no-try.png` }); return null; }
  await p.locator("[data-link-try=ask]").first().click(); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${D}/${tag}-ideas.png` });
  const txt = await p.evaluate(() => ([...document.querySelectorAll("[role=dialog]")].pop()?.innerText ?? "").replace(/\s+/g, " "));
  for (let i = 0; i < 4; i++) { await p.keyboard.press("Escape"); await p.waitForTimeout(400); }
  return txt;
};
const coffee = await ideasOf("coffee after 2 pm.*drained|drained.*coffee after 2 pm", "coffee");
out.coffee = coffee?.slice(0, 600);
if (coffee && /phone outside|charge|read or listen|instead of the feed|scroll/i.test(coffee)) fails.push("coffee: sleep ideas from the island are offered");
if (coffee && !/coffee|caffeine/i.test(coffee)) fails.push("coffee: no idea about the coffee itself");
const headache = await ideasOf("period.*headache|headache.*period", "headache");
out.headache = headache?.slice(0, 600);
console.log(JSON.stringify({ fails, errs, out }, null, 1));
await b.close();
