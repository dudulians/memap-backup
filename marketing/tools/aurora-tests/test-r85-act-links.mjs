// v104: the card details show what comes with it and the possible cause. (Copied from r84.) v103 (her notes, Nov 8 2026): a When to act card says the advice and how often in words; the question,
// the meter and the suggested test sit under "Details", and the whole card opens. New words for
// "partner said something hurtful" and "felt nauseous" (old ones refresh for people who have them).
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r85`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
let n = 0; const shot = async (name) => { await p.waitForTimeout(800); await p.screenshot({ path: `${D}/${String(++n).padStart(2, "0")}-${name}.png` }); };
await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);

const seed = (lang) => p.evaluate(async (lang) => {
  const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const T = [
    // stored with the OLD advice, as a 1.7.x install would have it
    { id: "n1", title: "Felt nauseous", category: "Body", subcategory: "Nausea", questionText: "Did you feel nauseous today (without an obvious food cause)?", answerType: "boolean", periodDays: 30, threshold: 5, problemWhen: "yes", adviceAboveThreshold: "Log time of day and what was happening just before", createdAt: new Date(Date.now() - 40 * 864e5).toISOString(), sortIndex: 0 },
    { id: "h1", title: "Partner said something hurtful", category: "Connections", subcategory: "Partner", questionText: "Did your partner say something that genuinely hurt today?", answerType: "boolean", periodDays: 30, threshold: 3, problemWhen: "yes", adviceAboveThreshold: "Name how those words landed — be specific with my partner", createdAt: new Date(Date.now() - 40 * 864e5).toISOString(), sortIndex: 1 },
  ];
  const E = [];
  for (let i = 1; i <= 30; i++) {
    E.push({ id: `n${i}`, trackerId: "n1", date: iso(i), value: i % 5 === 0 });
    E.push({ id: `h${i}`, trackerId: "h1", date: iso(i), value: i % 5 === 1 });
  }
  localStorage.clear(); localStorage.setItem("memap_ab_onb", "A");
  localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
  localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "true");
  localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_theme", "aurora-light");
  localStorage.setItem("memap_first_link_seen", "before"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: iso(1) })); localStorage.setItem("memap_path_start", iso(30));
}, lang);

for (const lang of ["en", "ru"]) {
  await seed(lang); await p.reload(); await p.waitForTimeout(2800);
  out[`${lang}.advice`] = await p.evaluate(() => JSON.parse(localStorage.getItem("memap_trackers")).map((t) => t.adviceAboveThreshold));
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "signals", back: true } })));
  await p.waitForTimeout(2200); await shot(`${lang}-cards`);
  out[`${lang}.collapsed`] = await p.evaluate(() => [...document.querySelectorAll("[role=dialog] button[aria-expanded]")].map((x) => x.innerText.replace(/\s+/g, " ")));
  // open the nausea card by tapping its text
  await p.evaluate(() => [...document.querySelectorAll("[role=dialog] button[aria-expanded]")].find((x) => /nause|тошн/i.test(x.textContent))?.click());
  await p.waitForTimeout(800); await shot(`${lang}-nausea-open`);
  out[`${lang}.open`] = await p.evaluate(() => { const b = [...document.querySelectorAll("[role=dialog] button[aria-expanded=true]")][0]; return b?.parentElement?.innerText.replace(/\s+/g, " ") ?? "NONE"; });
}
const check = {
  // v116: the link in two parts (headline, then the count); v115: no possible cause from a partner's words
  linkShown: /COMES WITH IT IN YOUR DAYS Hurtful words from partner → nausea the next day (every time — \d+ of \d+|\d+ of \d+ times) · on other days/.test(out["en.open"]),
  noPartnerCause: !/Possible cause: Hurtful words from partner/.test(out["en.open"]),
  linkShownRu: /БЫВАЕТ ВМЕСТЕ С ЭТИМ Обидные слова партнёра → тошнота на следующий день (каждый раз — \d+ из \d+|\d+ из \d+ раза?) · в другие дни/.test(out["ru.open"]) && !/Возможная причина: Обидные слова партнёра/.test(out["ru.open"]),
};
console.log(JSON.stringify({ check, out, errs }, null, 1));
await b.close();
