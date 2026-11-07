// Rewordings only for new questions (her yes, Nov 7 2026): an old question keeps its words
// and is still known (island, phrases, translation, no twin on a replayed onboarding).
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
for (const lang of ["en", "ru"]) {
  const p = await (await b.newContext()).newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  await p.evaluate((lang) => { localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1"); }, lang);
  await p.reload(); await p.waitForTimeout(1500);
  out[lang] = await p.evaluate(async (lang) => {
    const A = await import("/src/lib/answerPhrases.ts"), I = await import("/src/lib/islands.ts"), L = await import("/src/lib/trackerLocalize.ts"), D = await import("/src/lib/doors.ts"), S = await import("/src/lib/storage.ts");
    const { default: i18n } = await import("/src/lib/i18n.ts"); const t = i18n.t.bind(i18n);
    const old = { id: "9b1f-old", title: lang === "ru" ? "Болела спина или шея" : "Back or neck pain", problemWhen: "yes", category: "Body" };
    const oldFriends = { id: "7c2e-old", title: lang === "ru" ? "Виделся(ась) или списывался(ась) с друзьями" : "Saw or messaged friends", questionText: "x", problemWhen: "no", category: "Connections", answerType: "boolean", periodDays: 30, threshold: 0, adviceAboveThreshold: "", createdAt: new Date().toISOString() };
    await S.saveTrackers([oldFriends]);
    const [newBack, friends] = await D.ensureTemplates(["back-or-neck-pain", "saw-friends"]);
    const T = await S.getTrackers(); const nb = T.find((x) => x.id === newBack);
    return {
      oldId: A.templateIdOf(old), oldIsland: I.islandOf(old), oldPhrase: A.answerPhrase(t, old, true), oldClause: A.answerClause(t, old, true, "result", "usually"),
      oldTitleOther: L.localizeTrackerTitle(lang === "ru" ? "Back or neck pain" : "Болела спина или шея"),
      newTitle: nb?.title, newQuestion: nb?.questionText, newPhrase: A.answerPhrase(t, nb, true), newClause: A.answerClause(t, nb, true, "result", "usually"),
      friendsReused: friends === oldFriends.id, trackers: T.length,
    };
  }, lang);
}
console.log(JSON.stringify({ out, errs }, null, 1));
await b.close();
