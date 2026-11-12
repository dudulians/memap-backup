// r141 (Nov 12 2026, her ask: new demo data on different topics, to try everything): each new pack, loaded as the
// owner's demo button does, shows the findings it is made for in the Links list (EN).
// Run from marketing/tools: node aurora-tests/test-r141-demo-packs.mjs
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "fs";
const D = `./aurora-tests/work/r141`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const ok = (name, cond, info = "") => { out[name] = cond ? "ok" : `FAIL ${typeof info === "string" ? info : JSON.stringify(info)}`.slice(0, 700); if (!cond) fails.push(name); console.log(name, "→", out[name]); };

const EXPECT = {
  // same-day links are two tags and when the days fall, no order (her pick, Nov 12 2026); the next day keeps its order
  "work-home": [
    [/STRONGEST SO FAR (Drained after work Argument with partner|Argument with partner Drained after work) Mostly the same days On other days almost never/, "the store's pair first, large, the calm days in words"],
    [/^(?!.*On those days)/, "no chain until the person sets an order"],
    [/Argument with partner Most often the same days as/, "two things next to the arguments"],
    [/Looks like it.s something else. .* on days you don.t drink too/, "something else: not the alcohol"],
    [/(30 min outside Calm|Calm 30 min outside) Mostly the same days/, "calm with time outside (the good side)"],
    [/“Did I check work email after 8 pm”/, "her own question, as typed"],
  ],
  "migraine-cycle": [
    [/Headache Most often the same days as (Period day Stress|Stress Period day)/, "two things next to the headache: period or stress"],
    [/Coffee after 2 pm next day Short night/, "next day: late coffee → short night"],
  ],
  parenting: [
    [/(Yelling at the kid Feeling like a bad parent|Feeling like a bad parent Yelling at the kid) (Almost only|Mostly) the same days/, "bad parent and yelling: the same days"],
    [/(No me-time Yelling at the kid|Yelling at the kid No me-time) Mostly the same days/, "yelling with no time for yourself"],
    [/(Me-time Calm|Calm Me-time) (Almost only|Mostly) the same days/, "calm with me-time (the good side)"],
  ],
  "good-days": [
    [/Happy day Most often the same days as/, "two things next to the happy days"],
    [/(Meditation Calm|Calm Meditation) Mostly the same days/, "calm on meditation days"],
    [/“Did I call my mom”/, "her own good question"],
  ],
};

for (const pack of Object.keys(EXPECT)) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, locale: "en-US" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${pack}: ${e.message}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  const info = await p.evaluate(async (pack) => {
    localStorage.clear(); localStorage.setItem("memap_ab_onb", "A"); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "1");
    localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_tour_completed", "1"); localStorage.setItem("memap_first_link_seen", "before");
    localStorage.setItem("memap_examples_seen", JSON.stringify(["link", "month", "rule", "test", "chart", "chart-one"]));
    const g = await import("/src/lib/demoDataGenerator.ts"), st = await import("/src/lib/storage.ts"), dz = await import("/src/lib/doors.ts");
    localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: dz.daysAgoIso(1) }));
    const r = g.generateDemoData(pack);
    await st.saveTrackers(r.newTrackers); await st.saveEntries(r.newEntries);
    localStorage.setItem("memap_path_start", dz.daysAgoIso(59));
    return { trackers: r.trackerCount, entries: r.generatedCount, listed: g.DEMO_PACK_IDS.includes(pack) };
  }, pack);
  ok(`${pack}: a demo button for it, all its questions`, info.listed && info.trackers >= 8, info);
  await p.reload(); await p.waitForTimeout(2500);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-switch-tab", { detail: { tab: "patterns", open: "all", section: "findings", back: true } })));
  await p.waitForTimeout(2200);
  // the whole list, folded links too
  await p.evaluate(() => document.querySelector("[data-more-links]")?.click()); await p.waitForTimeout(400);
  const text = (await p.locator("[role=dialog]").last().innerText()).replace(/\s+/g, " ");
  out[`${pack} text`] = text.slice(0, 1500); writeFileSync(`${D}/${pack}.txt`, text.replace(/(Looks like|On days|The day after|You )/g, "\n$1"));
  await p.screenshot({ path: `${D}/${pack}.png`, fullPage: false });
  for (const [re, what] of EXPECT[pack]) ok(`${pack}: ${what}`, re.test(text), text.slice(0, 900));
  await ctx.close();
}
// "always" before a "no" says "never" (found in the good-days pack: "you always don't meditate"), EN and RU
{
  const ctx = await b.newContext(); const p = await ctx.newPage();
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  for (const lang of ["en", "ru"]) {
    const got = await p.evaluate(async (lang) => {
      localStorage.setItem("memap_language", lang);
      const i18n = (await import("/src/lib/i18n.ts")).default, ap = await import("/src/lib/answerPhrases.ts");
      await i18n.changeLanguage(lang); const t = i18n.t.bind(i18n);
      const tr = (id) => ({ id: `1-${id}-1`, title: id });
      return ["meditated", "partner-raised-voice", "good-time-together", "saw-friends"].map((id) =>
        [t("link.advAll"), t("link.adv0"), t("link.adv1")].map((w) => ap.answerClause(t, tr(id), false, "result", w)).join(" | "));
    }, lang);
    const want = lang === "en"
      ? ["you never meditate | you almost never meditate | you usually don't meditate", "your partner never raises their voice | your partner almost never raises their voice", "there's never any fun time with your partner", "you never see friends"]
      : ["ты никогда не медитируешь | ты почти никогда не медитируешь", "партнёр никогда не повышает голос", "приятного времени вдвоём никогда нет", "встреч с друзьями никогда нет"];
    ok(`${lang}: "always" + no says "never"`, want.every((w, i) => got[i].startsWith(w)) && !/always don.t|always doesn.t|всегда не /.test(got.join(" ")), got);
  }
  await ctx.close();
}
console.log(JSON.stringify({ fails, errs: errs.slice(0, 5) }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
