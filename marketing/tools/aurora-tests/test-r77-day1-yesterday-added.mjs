// Her question (Nov 8 2026): day 1, she answered for yesterday; then the hunch added questions.
// Are they asked for yesterday or for today? Now: for yesterday first (one whole day), tonight for
// today. The path model at 11:00 and at 20:00, with and without "yesterday" picked.
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await b.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:8080/"); await p.waitForTimeout(1200);
const out = await p.evaluate(async () => {
  const ps = await import("/src/lib/pathSteps.ts"), dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
  const res = {};
  for (const [label, pick, hour] of [["yesterday 11:00", "yesterday", 11], ["yesterday 20:00", "yesterday", 20], ["tonight 11:00", "tonight", 11]]) {
    localStorage.clear(); localStorage.setItem("memap_ui", "new");
    const now = new Date(); now.setHours(hour, 0, 0, 0);
    const iso = (d) => dz.isoLocal(d);
    const today = iso(now), y = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    // onboarding this morning: three questions, answered for yesterday
    const onbAt = new Date(now); onbAt.setHours(hour - 1 < 0 ? 0 : Math.min(hour, 10) - 1, 0, 0, 0);
    const ids = await dz.ensureTemplates(["migraine", "slept-enough", "felt-stressed"]);
    let T = await st.getTrackers();
    T = T.map((t) => ({ ...t, createdAt: onbAt.toISOString() }));
    // the hunch, later that morning: two more
    const later = new Date(onbAt.getTime() + 30 * 60000);
    const more = await dz.ensureTemplates(["coffee-late", "skipped-meal"]);
    T = (await st.getTrackers()).map((t) => ({ ...t, createdAt: more.includes(t.id) ? later.toISOString() : onbAt.toISOString() }));
    await st.saveTrackers(T);
    localStorage.setItem("memap_onboarded_at", onbAt.toISOString());
    localStorage.setItem("memap_door", JSON.stringify({ id: "migraine", trackerId: ids[0], contextTrackerIds: [], startedAt: today }));
    localStorage.setItem("memap_first_day_pick", pick); localStorage.setItem("memap_first_day_at", today);
    await st.saveEntries(ids.map((id, i) => ({ id: `e${i}`, trackerId: id, date: y, value: false, createdAt: onbAt.toISOString() })));
    const m = ps.pathModel(await st.getTrackers(), await st.getEntries(), now);
    res[label] = m.steps.map((s) => `${s.id}${s.date ? "@" + (s.date === y ? "yesterday" : s.date === today ? "today" : s.date) : ""}${s.trackerIds?.length ? `[${s.answered}/${s.trackerIds.length}]` : ""}`);
  }
  return res;
});
console.log(JSON.stringify({ out, errs }, null, 1));
await b.close();
