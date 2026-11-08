// Her note (Nov 8 2026): a push said «Внеси 3 тренировки в неделю» — it should say «Не забудь
// потренироваться сегодня». As on her phone: a test started from the old plan, with its own copy
// of the question. After the start-up move: her own question with a weekly goal, today's step in
// the push; ideas and her own plans too. RU and EN.
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await b.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:8080/"); await p.waitForTimeout(1200);
const out = {};
for (const lang of ["ru", "en"]) {
  out[lang] = await p.evaluate(async (lang) => {
    const i18n = (await import("/src/lib/i18n.ts")).default; await i18n.changeLanguage(lang);
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts"), n = await import("/src/lib/notifications.ts"), c = await import("/src/lib/cardText.ts"), x = await import("/src/lib/experiments.ts");
    const iso = (k) => { const d = new Date(); d.setDate(d.getDate() - k); return dz.isoLocal(d); };
    localStorage.clear(); localStorage.setItem("memap_ui", "new");
    const [worked] = await dz.ensureTemplates(["exercised"]);
    // the old-style test: its own question «Внести 3 тренировки…?»
    const old = "Внести 3 тренировки в календарь на эту неделю";
    const ts = await st.getTrackers();
    await st.saveTrackers([...ts, { id: "111-test", title: old, category: "Curious", questionText: `${old}?`, answerType: "boolean", periodDays: 30, threshold: 0, problemWhen: "no", adviceAboveThreshold: "", createdAt: new Date().toISOString(), sortIndex: -1, island: "body" }]);
    localStorage.setItem("memap_try_time_fixed", "1");
    localStorage.setItem("memap_experiments", JSON.stringify([
      { id: "111-test", island: "body", trackerId: "111-test", change: old, start: iso(1), remind: "18:00" },
      { id: "222-test", island: "health", trackerId: "222-test", change: "In bed by 23:00", start: iso(1), remind: "22:00" },
      { id: "333-test", island: "me", trackerId: "333-test", change: "Walk the dog after work", start: iso(1), remind: "19:00" },
    ]));
    await st.runStartupMigrations();
    const after = x.getExperiments().map((e) => ({ change: e.change, same: !!e.same, perWeek: e.perWeek ?? null, onHerQuestion: e.trackerId === worked }));
    const copyAway = (await st.getTrackers()).find((t) => t.id === "111-test")?.archived ?? false;
    const her = (await st.getTrackers()).find((t) => t.id === worked);
    return {
      after, copyAway, herQuestion: c.cardQuestion(her),
      pushes: n.tryPlan().filter((_, i) => i % 3 === 0).slice(0, 12).map((q) => `${q.title} — ${q.body}`),
    };
  }, lang);
}
console.log(JSON.stringify({ out, errs }, null, 1));
await b.close();
