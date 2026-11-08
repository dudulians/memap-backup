// v109 (her note, Nov 8 2026: "онбординг для старых обязательно — это первые, кто получит обновление"):
// an old user (old onboarding done, no topic) gets the invite over the old screens with their own numbers,
// "Show me" opens the new look with four screens from their answers (world, four parts, path, who sails),
// then Today. EN and RU.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r86`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
let n = 0; const shot = async (name) => { await p.waitForTimeout(900); await p.screenshot({ path: `${D}/${String(++n).padStart(2, "0")}-${name}.png` }); };
await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);

for (const lang of ["en", "ru"]) {
  await p.evaluate(async (lang) => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
    for (const id of ["showcase", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
    const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
    const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId));
    localStorage.clear();
    localStorage.setItem("memap_trackers", JSON.stringify(T)); localStorage.setItem("memap_entries", JSON.stringify(E));
    // a 1.7.x install: the old onboarding done, no topic, no screen mode yet
    localStorage.setItem("memap_tour_seen", "true");
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1");
  }, lang);
  await p.reload(); await p.waitForTimeout(3200);
  out[`${lang}.mode`] = await p.evaluate(() => localStorage.getItem("memap_ui"));
  await shot(`${lang}-invite`);
  out[`${lang}.invite`] = await p.evaluate(() => document.querySelector("[role=dialog]")?.innerText.replace(/\s+/g, " ") ?? "NONE");
  await p.getByRole("button", { name: lang === "en" ? /Show me/i : /Показать/i }).first().click();
  await p.waitForTimeout(3500);
  const texts = [];
  for (let s = 0; s < 4; s++) {
    await shot(`${lang}-tour-${s + 1}`);
    texts.push(await p.evaluate(() => document.querySelector(".onb")?.innerText.replace(/\s+/g, " ").slice(0, 400) ?? "NONE"));
    if (s < 3) await p.getByRole("button", { name: lang === "en" ? /^Next/ : /^Дальше|^Далее/ }).first().click();
    else {
      await p.locator("button[aria-label='cat'], button[aria-label='fox']").first().click().catch(() => {});
      await p.waitForTimeout(400); await shot(`${lang}-tour-4-picked`);
      await p.getByRole("button", { name: lang === "en" ? /Set sail/i : /Поплыли/i }).first().click();
    }
    await p.waitForTimeout(700);
  }
  await p.waitForTimeout(1500); await shot(`${lang}-today`);
  out[`${lang}.tour`] = texts;
  out[`${lang}.after`] = await p.evaluate(() => ({ ui: localStorage.getItem("memap_ui"), done: !!localStorage.getItem("memap_old_tour_done"), pending: localStorage.getItem("memap_old_tour"), avatar: localStorage.getItem("memap_avatar"), overlay: !!document.querySelector(".onb") }));
}
const check = {
  classicFirst: out["en.mode"] === "classic" && out["ru.mode"] === "classic",
  inviteNumbers: /Your answers built a world/.test(out["en.invite"]) && /days/.test(out["en.invite"]) && /Show me/i.test(out["en.invite"]),
  inviteRu: /Твои ответы построили мир/.test(out["ru.invite"]),
  fourScreens: /Here is your world/.test(out["en.tour"][0]) && /four parts/.test(out["en.tour"][1]) && /path/.test(out["en.tour"][2]) && /Who sails/.test(out["en.tour"][3]),
  fourScreensRu: /Вот твой мир/.test(out["ru.tour"][0]) && /четыре части/.test(out["ru.tour"][1]) && /путь/.test(out["ru.tour"][2]) && /Кто поплывёт/.test(out["ru.tour"][3]),
  endsOnNewLook: out["en.after"].ui === "new" && out["en.after"].done && !out["en.after"].pending && !out["en.after"].overlay,
  avatarPicked: /cat|fox/.test(out["en.after"].avatar ?? ""),
};
console.log(JSON.stringify({ check, out, errs }, null, 1));
await b.close();
