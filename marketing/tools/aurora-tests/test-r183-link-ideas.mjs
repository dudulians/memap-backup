// Her phone notes (Nov 15 2026 evening): a "coffee after 2 pm → tired" link offered the island's sleep ideas; and «к связи
// месячные → голова не было идей только про голову… идеи про связи». "What to try" under a link A → B:
//  - A can be changed (late coffee): A's own changes only;
//  - A is a state (a period): B's changes on A's days ("On days you have your period: …"), the try keeping those days.
// Run from marketing/tools.
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
});
// opens "What to try" the way the button under a link does: its first thing (the one that comes first) and its side
const openTry = async (firstRe, secondRe, yes, tag) => {
  await p.reload(); await p.waitForTimeout(2200);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns" } }))); await p.waitForTimeout(1500);
  const ok1 = await p.evaluate(async ({ firstRe, secondRe, yes }) => {
    const T = JSON.parse(localStorage.getItem("memap_trackers"));
    const a = T.find((t) => new RegExp(firstRe, "i").test(t.title)), c = T.find((t) => new RegExp(secondRe, "i").test(t.title));
    if (!a || !c) return false;
    const isl = await import("/src/lib/islands.ts");
    window.dispatchEvent(new CustomEvent("memap-link-try", { detail: { island: isl.islandOf(a), link: [a.id, c.id].sort().join("|"), ids: [a.id, c.id], about: a.id, aboutYes: yes } }));
    return true;
  }, { firstRe, secondRe, yes });
  if (!ok1) { fails.push(`${tag}: questions not found`); return ""; }
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${D}/${tag}-ideas.png` });
  return p.evaluate(() => ([...document.querySelectorAll("[role=dialog]")].pop()?.innerText ?? "").replace(/\s+/g, " "));
};
const coffee = await openTry("^Coffee after", "^Slept enough", true, "coffee");
out.coffee = coffee.slice(0, 500);
if (!/coffee|decaf/i.test(coffee)) fails.push("coffee: no idea about the coffee itself");
if (/phone outside|read or listen|same time|worries/i.test(coffee)) fails.push("coffee: ideas about the other question, not the link");
const headache = await openTry("^Period day", "headache", true, "headache");
out.headache = headache.slice(0, 500);
if (!/On days you have your period: /.test(headache)) fails.push("headache: the ideas should be for the period days");
// start the first one: the try keeps its days and its evening question
await p.locator("[role=dialog] button", { hasText: /^On days you have your period/ }).first().click().catch(() => {}); await p.waitForTimeout(400);
await p.locator("[role=dialog] button", { hasText: /^Start$/ }).first().click().catch(() => {}); await p.waitForTimeout(1500);
out.started = await p.evaluate(() => {
  const X = JSON.parse(localStorage.getItem("memap_experiments") || "[]"); const x = X[X.length - 1];
  const T = JSON.parse(localStorage.getItem("memap_trackers")); const tr = T.find((t) => t.id === x?.trackerId);
  return { change: x?.change, scope: x?.scope, ask: tr?.askAs };
});
if (!out.started?.scope || !/If not, answer/.test(out.started?.ask ?? "")) fails.push("headache: the try should keep its days and its question");
console.log(JSON.stringify({ fails, errs, out }, null, 1));
await b.close();
