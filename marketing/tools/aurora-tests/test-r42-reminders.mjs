// Reminders that say how close she is (Nov 6 2026). What the app would schedule for
// the next days (reminderPlan, the same code that feeds the phone's notifications),
// for a new user on day 1 and for a long-time user, in English and Russian; and a
// lock screen picture with the first three.
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync } from "fs";
const D = `./aurora-tests/work/r42`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
const plan = async (who, lang) => {
  const p = await b.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  const rows = await p.evaluate(async ({ who, lang }) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    localStorage.clear();
    localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", lang);
    if (who === "new") {
      // day 1 after onboarding (Migraines): seven questions, yesterday answered
      const d = await import("/src/lib/doors.ts");
      const ids = await d.ensureTemplates(["migraine", "slept-enough", "felt-anxious", "ate-by-2pm", "felt-happy", "had-energy", "saw-friends"]);
      localStorage.setItem("memap_door", JSON.stringify({ id: "migraine", trackerId: ids[0], contextTrackerIds: ids.slice(1, 4), startedAt: iso(0) }));
      localStorage.setItem("memap_entries", JSON.stringify(ids.slice(0, 4).map((id, i) => ({ id: "e" + i, trackerId: id, date: iso(1), value: i === 0 }))));
    } else {
      const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
      for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
      const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
      const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId) && e.date !== iso(0));
      localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
      localStorage.setItem("memap_path_start", [...E.map((e) => e.date)].sort()[0]);
    }
    const i18n = (await import("/src/lib/i18n.ts")).default; await i18n.changeLanguage(lang);
    const n = await import("/src/lib/notifications.ts");
    const list = await n.reminderPlan({ enabled: true, time: "21:00", thresholdAlerts: false });
    return list.slice(0, 8).map((x) => ({ at: new Date(x.schedule.at).toDateString(), title: x.title, body: x.body }));
  }, { who, lang });
  await p.close();
  return rows;
};
for (const who of ["new", "old"]) for (const lang of ["en", "ru"]) out[`${who}-${lang}`] = await plan(who, lang);

// the lock screen: the first three of the new user, English and Russian
const icon = `data:image/png;base64,${readFileSync("../app-icon/memap-icon-1024.png").toString("base64")}`;
const screen = (rows, time, date) => `<div class="ph"><div class="time">${time}</div><div class="date">${date}</div>${rows.slice(0, 3).map((r, i) => `<div class="n"><img src="${icon}"><div class="tx"><div class="hd"><b>${r.title}</b><span>${["now", "1d ago", "2d ago"][i]}</span></div><div class="bd">${r.body.replace(/\n/g, "<br>")}</div></div></div>`).join("")}</div>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700&display=swap" rel="stylesheet"><style>
body{margin:0;background:#eef1f8;font-family:Inter,sans-serif;padding:36px;display:flex;gap:30px}
.ph{width:390px;height:844px;border-radius:44px;background:linear-gradient(170deg,#9fb6ee,#c9b8ea 55%,#f2c6d6);padding:70px 14px 0;box-sizing:border-box;box-shadow:0 22px 50px -20px rgba(30,40,90,.5)}
.time{font-size:84px;font-weight:700;color:#fff;text-align:center;letter-spacing:-2px}.date{font-size:20px;font-weight:600;color:#fff;text-align:center;margin:-6px 0 40px}
.n{display:flex;gap:10px;background:rgba(255,255,255,.72);backdrop-filter:blur(20px);border-radius:22px;padding:12px;margin-bottom:10px}
.n img{width:38px;height:38px;border-radius:9px}.tx{flex:1;min-width:0}.hd{display:flex;justify-content:space-between;font-size:15px;color:#222}.hd span{color:#555;font-size:13px}
.bd{font-size:15px;line-height:1.3;color:#222;margin-top:2px}</style></head><body>
${screen(out["new-en"], "21:00", "Friday, 6 November")}${screen(out["new-ru"], "21:00", "Пятница, 6 ноября")}${screen(out["old-en"], "21:00", "Friday, 6 November")}</body></html>`;
const p = await b.newPage({ viewport: { width: 1340, height: 920 } });
await p.setContent(html); await p.waitForTimeout(1500);
await p.screenshot({ path: `${D}/lock-screens.png`, fullPage: true });
console.log(JSON.stringify({ ...out, errs }, null, 1));
await b.close();
