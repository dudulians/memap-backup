// Her answer (Nov 7 2026): the 4 old intimacy questions go too. They are never offered
// (islands, related, random rounds, the switch); people who already track one keep it.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r64`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
const IDS = ["had-sex", "flirted", "thought-about-someone-else", "morning-libido"];
for (const who of ["new", "tracks"]) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  out[who] = await p.evaluate(async ({ who, IDS }) => {
    localStorage.clear();
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "1");
    localStorage.setItem("memap_tour_completed", "1"); localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" }));
    localStorage.setItem("memap_show_sensitive", "true"); // the old switch on: still nothing offered
    const d = await import("/src/lib/doors.ts");
    await d.ensureTemplates(who === "tracks" ? ["argued-with-partner", "had-sex"] : ["argued-with-partner", "slept-enough"]);
    const N = await import("/src/components/NewIslandSheet.tsx"), Q = await import("/src/lib/relatedQuestions.ts"), A = await import("/src/lib/answerPhrases.ts"), L = await import("/src/lib/lifeStreams.ts");
    const islands = ["me", "love", "kids", "health", "body", "pet", "parents", "world", "work"];
    const onIslands = islands.flatMap((i) => N.topicTemplates(i).map((t) => t.id)).filter((id) => IDS.includes(id));
    const related = Q.getRelatedQuestions(["Argued with partner", "Felt anxious", "Drank alcohol", "Slept enough"]).map((t) => t.id).filter((id) => IDS.includes(id));
    const ideas = Array.from({ length: 30 }, () => L.getRandomIdeas ? L.getRandomIdeas(5) : []).flat().map((t) => t.id ?? t).filter((id) => IDS.includes(id));
    const all = L.LIFE_STREAMS.flatMap((s) => s.templates);
    return { onIslands, related, ideas: [...new Set(ideas)], kept: IDS.filter((id) => all.some((t) => t.id === id)), phrased: IDS.filter((id) => A.phraseIds().includes(id) && A.sentenceIds().includes(id)), offered: all.filter((t) => !t.sensitive).length, total: all.length };
  }, { who, IDS });
  await p.reload(); await p.waitForTimeout(2200);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-you"))); await p.waitForTimeout(1200);
  await p.getByText("Settings").first().click(); await p.waitForTimeout(1200);
  await p.getByText("My questions", { exact: true }).first().click(); await p.waitForTimeout(1200);
  await p.screenshot({ path: `${D}/${who}-questions.png` });
  out[who].switch = await p.getByText("Intimacy & exes").count();
  await p.close();
}
console.log(JSON.stringify({ out, errs }, null, 1));
await b.close();
