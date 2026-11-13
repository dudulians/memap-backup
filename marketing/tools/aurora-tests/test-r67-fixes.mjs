// Fixes before TestFlight (Nov 7 2026): Back after a passed-by follow-up returns to the right
// card; natural pairs are no link; a covered question isn't suggested; plainer words match
// their questions; private questions aren't random ideas.
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const out = {}, errs = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
await p.evaluate(async () => {
  localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "1");
  localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" })); localStorage.setItem("memap_tour_completed", "1");
  const dz = await import("/src/lib/doors.ts"); await dz.ensureTemplates(["period-day", "heavy-flow-day", "pooped-today"]);
});
await p.reload(); await p.waitForTimeout(2200);
await p.locator(".path-start").first().click(); await p.waitForTimeout(1500);
const card = () => p.evaluate(() => [...document.querySelectorAll("[role=dialog] p, [role=dialog] h2, [role=dialog] h3")].map((x) => x.textContent?.trim() ?? "").filter((s) => s.endsWith("?")).slice(-1)[0] ?? "");
const seq = [];
for (let k = 0; k < 1; k++) { const q = await card(); seq.push(q.slice(0, 40)); await p.getByRole("button", { name: /^No$/ }).last().click(); await p.waitForTimeout(800); }
seq.push((await card()).slice(0, 40));
await p.getByRole("button", { name: "Go back to previous question" }).click(); await p.waitForTimeout(900);
seq.push("BACK → " + (await card()).slice(0, 40));
seq.push("period answer kept? " + await p.evaluate(async () => { const st = await import("/src/lib/storage.ts"); const E = await st.getEntries(); return E.length; }));
await p.getByRole("button", { name: /^Yes$/ }).last().click(); await p.waitForTimeout(900);
seq.push("after YES → " + (await card()).slice(0, 40));
out.backSequence = seq;
out.logic = await p.evaluate(async () => {
  const B = await import("/src/lib/bodyTemplates.ts"), Q = await import("/src/lib/relatedQuestions.ts"), L = await import("/src/lib/lifeStreams.ts");
  const ideas = Array.from({ length: 40 }, () => L.getRandomIdeas(6)).flat().map((t) => t.id);
  const priv = new Set(L.LIFE_STREAMS.flatMap((s) => s.templates).filter((t) => t.private).map((t) => t.id));
  return {
    natural: B.isNaturalPair("period-day", "heavy-flow-day") && B.isNaturalPair("heavy-flow-day", "period-day") && !B.isNaturalPair("slept-enough", "migraine"),
    covered: B.isCovered("breast-tender", ["pms-signs"]) && !B.isCovered("breast-tender", ["migraine"]),
    titles: ["Stomach ache", "Болел живот", "Itch or rash", "Зуд или сыпь", "Skin allergy / reaction", "Stomach / GI issues"].map((x) => `${x} → ${Q.matchTemplateIdByTitle(x)}`),
    privateIdeas: [...new Set(ideas.filter((id) => priv.has(id)))],
  };
});
// a strong period ↔ heavy period pattern draws no link
out.noNaturalLink = await p.evaluate(async () => {
  const st = await import("/src/lib/storage.ts"), dz = await import("/src/lib/doors.ts"), C = await import("/src/lib/correlations.ts");
  const T = await st.getTrackers(); const per = T.find((x) => x.title === "Period day"), heavy = T.find((x) => x.title === "Heavy period day"), poo = T.find((x) => x.title === "Pooped today");
  const E = [];
  for (let d = 1; d <= 40; d++) { const on = d % 4 === 0 || d % 4 === 1; E.push({ id: `p${d}`, trackerId: per.id, date: dz.daysAgoIso(d), value: on }, { id: `h${d}`, trackerId: heavy.id, date: dz.daysAgoIso(d), value: on && d % 8 < 5 }, { id: `o${d}`, trackerId: poo.id, date: dz.daysAgoIso(d), value: d % 3 !== 0 }); }
  const pairs = C.computeCorrelations(T, E, 12).map((c) => `${c.trackerA.title} ~ ${c.trackerB.title}`);
  return { pairs };
});
console.log(JSON.stringify({ out, errs }, null, 1));
await b.close();
