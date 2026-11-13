// r93 (Nov 9 2026): her three answers.
// 1. days with no answer don't count: someone who answered 4 of the last 8 days, all without a workout, gets
//    "No workout 5 of 7" lit, the card says "4 of your 4 answers in the last 7 days."; a question answered every
//    evening keeps the old words ("9 of the last 14 days.");
// 2. a partner who raised their voice: a step for the person ("Decide where you can go when it gets loud."),
//    no possible cause, "Need to talk?" opens links (no phone numbers), "I did it" → "Noted." and the next step;
// 3. Links: one number (10 answered evenings) on the empty Links screen.
// Run from marketing/tools.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r93`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: "Europe/London" });
const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
let n = 0; const shot = async (name) => { await p.waitForTimeout(600); await p.screenshot({ path: `${D}/${String(++n).padStart(2, "0")}-${name}.png` }); };
await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
await p.evaluate(async () => {
  localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order"])); localStorage.setItem("memap_tour_seen", "true");
  localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_theme", "aurora-light");
  localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" })); localStorage.setItem("memap_tour_completed", "1"); localStorage.setItem("memap_first_link_seen", "before");
  const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
  const [ex, sleep, voice] = await dz.ensureTemplates(["exercised", "slept-enough", "partner-raised-voice"]);
  const E = [];
  const add = (id, d, v) => E.push({ id: `${id}-${d}`, trackerId: id, date: dz.daysAgoIso(d), value: v });
  // workouts: answered every day long ago, then only days 0, 2, 4, 6 lately — all "no workout"
  for (let d = 10; d <= 30; d++) add(ex, d, d % 2 === 0);
  for (const d of [0, 2, 4, 6]) add(ex, d, false);
  // sleep: every evening for 30 days; short nights on 9 of the last 14
  for (let d = 0; d <= 30; d++) add(sleep, d, d <= 13 ? d % 3 === 0 : d % 2 === 0);
  // a partner raised their voice on 3 of the last 30 days, every evening answered
  for (let d = 0; d <= 30; d++) add(voice, d, [1, 5, 9].includes(d));
  await st.saveEntries(E);
  localStorage.setItem("memap_door", JSON.stringify({ id: "move", trackerId: ex, contextTrackerIds: [], startedAt: dz.daysAgoIso(30), extra: [{ id: "sleep", trackerId: sleep }] }));
});
await p.reload(); await p.waitForTimeout(2500);
await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "signals", back: true } })));
await p.waitForTimeout(2200);
const dlg = p.locator("[role=dialog]").last();
const more = dlg.locator("button", { hasText: /more rules? (is|are) reached|more questions?: time to act/ });
if (await more.count()) { await more.first().click(); await p.waitForTimeout(400); }
await shot("act");
const txt = (await dlg.innerText()).replace(/\s+/g, " ");
out.actText = txt.slice(0, 1200);
out.workoutLit = /don.t work out 4 of your 4 answers in the last 7 days\./.test(txt);
out.sleepWords = /sleep under 7 hours \d+ of the last 14 days\./.test(txt);
out.noNumbersInAct = !/\b(999|116 123|0808|988|112)\b/.test(txt);
// the partner card
const voiceCard = dlg.locator(".surface", { hasText: /raises their voice/ }).first();
out.voiceCardFound = (await voiceCard.count()) > 0;
if (out.voiceCardFound) {
  await voiceCard.locator("button[aria-expanded]").first().click(); await p.waitForTimeout(700);
  await shot("voice-open");
  const v = (await voiceCard.innerText()).replace(/\s+/g, " ");
  out.voiceCard = v;
  out.voicePlan = /Decide where you can go when it gets loud\./.test(v);
  out.voiceSuggest = /A step for you\. It.s not on you to fix this\./.test(v);
  out.voiceNoCause = !/Possible cause|Comes with it/i.test(v);
  out.voiceNoTest = !/Try it for 2 weeks/.test(v);
  // Need to talk?
  await voiceCard.getByRole("button", { name: /^Talk to someone$/ }).click(); await p.waitForTimeout(1000);
  await shot("voice-support");
  const sheet = p.locator("[role=dialog]").last();
  out.supportText = (await sheet.innerText()).replace(/\s+/g, " ").slice(0, 700);
  out.supportLinks = await sheet.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  out.supportNoTel = !out.supportLinks.some((h) => (h ?? "").startsWith("tel:"));
  await p.keyboard.press("Escape"); await p.waitForTimeout(700);
  // I did it → Noted. and the next step
  await voiceCard.getByRole("button", { name: /I did it/ }).click(); await p.waitForTimeout(1500);
  await shot("voice-did");
  out.toast = (await p.locator("[role=status], li[role=status], [data-sonner-toast]").allInnerTexts().catch(() => [])).join(" | ").slice(0, 200);
  out.voiceAfter = (await dlg.locator(".surface", { hasText: /raises their voice/ }).first().innerText()).replace(/\s+/g, " ").slice(0, 400);
  out.nextStep = /Tell someone you trust how often your partner raises their voice\./.test(out.voiceAfter);
}
await p.keyboard.press("Escape"); await p.waitForTimeout(700);
// 3. Links empty state (a fresh start: no links yet)
await p.evaluate(async () => {
  const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
  const T = await st.getTrackers(); const E = [];
  for (const tr of T) for (let d = 0; d < 4; d++) E.push({ id: `${tr.id}-n${d}`, trackerId: tr.id, date: dz.daysAgoIso(d), value: d % 2 === 0 });
  await st.saveEntries(E);
});
await p.reload(); await p.waitForTimeout(2400);
await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "findings", back: true } })));
await p.waitForTimeout(2000);
await shot("links-empty");
out.linksEmpty = (await p.locator("[role=dialog]").last().innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 1500);
out.linksTen = /of 10 evenings with answers/.test(out.linksEmpty);
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
