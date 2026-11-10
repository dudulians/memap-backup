// r133 (her notes, Nov 10 2026):
// 1. Bubbles stayed silent after she unmuted the phone, until the app was restarted: iOS leaves the AudioContext
//    "interrupted"; now any state but "running" is woken, and a context still stuck is replaced.
// 2. Test ideas: "Пить столько же кофе, сколько обычно, и в выходные" for a headache — "что это вообще за вопрос?";
//    ideas whose link to the question is invisible, niche ones ("подождать час перед скриншотом") and doctor/vet
//    bits are out, simple everyday ones in; clearer words; running tests and saved plans keep their idea.
// Run from marketing/tools: node aurora-tests/test-r133-ideas-sound.mjs
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const ok = (name, cond, info = "") => { out[name] = cond ? "ok" : `FAIL ${typeof info === "string" ? info : JSON.stringify(info)}`.slice(0, 700); if (!cond) fails.push(name); };

// --- 1. sound: a stuck context is woken or replaced ---
{
  const ctx = await b.newContext(); const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.addInitScript(() => {
    const Real = window.AudioContext;
    window.__made = 0; window.__last = null;
    window.AudioContext = class extends Real { constructor(...a) { super(...a); window.__made++; window.__last = this; } };
  });
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(1200);
  const r = await p.evaluate(async () => {
    const fb = await import("/src/lib/feedback.ts");
    const stop = fb.startSea();
    await new Promise((x) => setTimeout(x, 300));
    const first = window.__last, made1 = window.__made;
    // iOS after Control Center: "interrupted", and resume() doesn't bring it back
    Object.defineProperty(first, "state", { get: () => "interrupted" });
    first.resume = () => Promise.resolve();
    fb.playPop?.(0.5, 0); // a tap on a bubble
    const made2 = window.__made;
    await new Promise((x) => setTimeout(x, 700));
    fb.playPop?.(0.5, 0); // the next tap a moment later
    const made3 = window.__made, replaced = window.__last !== first;
    stop();
    return { made1, made2, made3, replaced, hasPop: typeof fb.playPop === "function", exports: Object.keys(fb).filter((k) => /^play|^start/.test(k)) };
  });
  out.sound = r;
  ok("a bubble sound function is there", r.hasPop, r.exports);
  ok("the first tap on a stuck context tries to wake it (no new one yet)", r.made2 === r.made1, r);
  ok("still stuck a moment later: a new context plays the sound", r.made3 === r.made1 + 1 && r.replaced, r);
  await ctx.close();
}

// --- 2. ideas ---
{
  const ctx = await b.newContext(); const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(1200);
  const r = await p.evaluate(async () => {
    const ex = await import("/src/lib/experiments.ts"), tw = await import("/src/lib/testWords.ts"), i18n = (await import("/src/lib/i18n.ts")).default;
    const en = (await import("/src/locales/en.ts")).default.experiment.idea, ru = (await import("/src/locales/ru.ts")).default.experiment.idea;
    const offered = new Set([...Object.values(ex.IDEAS).flat(), ...Object.values(ex.TOPIC_IDEAS).flat(), ...Object.values(ex.QUESTION_IDEAS).flat(), ...ex.PLAN_IDEAS]);
    const retired = ["waitScreenshot", "homeSounds", "antiperspirantNight", "kettleSquats", "halfCupStep", "bottleTwice", "toiletAfterBreakfast", "urgeWaitMinute", "worryTime", "waitReply", "balanceOnce", "localProduct", "thankByName", "parentWater", "nightAwakeUp", "fallAsleepUp", "morningLight", "walkingCall", "vegNeverSkip", "talkOutLoud", "smallStart"];
    const NEW = ["noChatShare", "noGum", "quieterSound", "squatsDaily", "smallestStep"];
    const all = [...offered].map((k) => ({ k, en: en[k], ru: ru[k] }));
    // pill reminders for the questions "took my meds" / "parent took meds" remember what was already prescribed: not advice
    const medical = all.filter((x) => !["pillCheck", "pillsWithHabit"].includes(x.k)).filter((x) => /doctor|\bvet\b|veterinar|врач|ветеринар|pill|таблет/i.test(`${x.en?.change} ${x.en?.q} ${x.en?.today} ${x.ru?.change} ${x.ru?.q} ${x.ru?.today}`)).map((x) => x.k);
    const gendered = all.filter((x) => /[а-яё]\((а|ась|ла|на)\)/i.test(`${x.ru?.change} ${x.ru?.q} ${x.ru?.today}`)).map((x) => x.k);
    const missingText = all.filter((x) => !x.en?.change || !x.ru?.change || !x.en?.q || !x.ru?.q).map((x) => x.k);
    // a test running with the old words is still that idea
    const legacy = { sameCoffeeRu: tw.ideaOf("Пить столько же кофе, сколько обычно, и в выходные"), sameCoffeeEn: tw.ideaOf("Have the same amount of coffee every day, weekends too"), retiredRun: tw.ideaOf(en.waitScreenshot?.change ?? "") };
    i18n.changeLanguage("ru");
    const runningName = tw.testNameOf("Have the same amount of coffee every day, weekends too");
    i18n.changeLanguage("en");
    return {
      headache: ex.TOPIC_IDEAS.headache, lessCoffee: ex.QUESTION_IDEAS["less-caffeine-than-usual"], screenshot: ex.QUESTION_IDEAS["screenshotted-chat"],
      jaw: ex.QUESTION_IDEAS["jaw-sore-morning"], bloated: ex.QUESTION_IDEAS.bloated, trained: ex.QUESTION_IDEAS["trained-hard"],
      retiredOffered: retired.filter((k) => offered.has(k)), retiredKept: retired.filter((k) => !ex.OLD_IDEAS.includes(k)),
      newOk: NEW.filter((k) => en[k]?.change && ru[k]?.change && ex.smartRemindTime(k) !== "10:00" || k === "noGum"),
      emptyQ: Object.entries(ex.QUESTION_IDEAS).filter(([, l]) => l.length === 0).map(([q]) => q),
      medical, gendered, missingText, legacy, runningName, sameCoffeeRu: ru.sameCoffee.change, talk: en.talkNoPhones.change,
    };
  });
  out.ideas = r;
  ok("headache no longer offers the coffee idea", !r.headache.includes("sameCoffee"), r.headache);
  ok("the coffee idea stays only for 'much less coffee', in clear words", r.lessCoffee.join() === "sameCoffee" && r.sameCoffeeRu === "Не пропускать привычный кофе, и в выходные тоже", { q: r.lessCoffee, ru: r.sameCoffeeRu });
  ok("screenshot question: simple ideas", r.screenshot.join() === "noChatShare,writeInstead", r.screenshot);
  ok("no coffee or alcohol for a sore jaw; no drink-free days for bloating; no walk for hard training", !r.jaw.includes("noCoffee14") && !r.jaw.includes("noAlcoholBed") && !r.bloated.includes("drinkFreeDays") && !r.trained.includes("walk20"), { jaw: r.jaw, bloated: r.bloated, trained: r.trained });
  ok("niche ideas are no longer offered", r.retiredOffered.length === 0, r.retiredOffered);
  ok("niche ideas still known to tests already running", r.retiredKept.length === 0 && r.legacy.retiredRun === "waitScreenshot", { kept: r.retiredKept, run: r.legacy.retiredRun });
  ok("the 5 new simple ideas have words in both languages", r.newOk.length === 5, r.newOk);
  ok("every question with its own list still has ideas", r.emptyQ.every((q) => ["heavy-flow-day", "sick-day", "morning-libido", "partner-raised-voice", "partner-said-hurtful"].includes(q)), r.emptyQ);
  ok("no doctor, vet or pills in offered ideas", r.medical.length === 0, r.medical);
  ok("Russian ideas are gender-free", r.gendered.length === 0, r.gendered);
  ok("every offered idea has EN and RU words", r.missingText.length === 0, r.missingText);
  ok("a test running with the old coffee words is still that idea, shown in the new words", r.legacy.sameCoffeeRu === "sameCoffee" && r.legacy.sameCoffeeEn === "sameCoffee" && r.runningName === "Не пропускать привычный кофе, и в выходные тоже", { legacy: r.legacy, name: r.runningName });
  ok("talk without phones says with whom", /partner/.test(r.talk), r.talk);
  await ctx.close();
}

// --- 3. saved plans with the old words refresh ---
{
  const ctx = await b.newContext(); const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(1200);
  const r = await p.evaluate(async () => {
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    localStorage.clear();
    await dz.ensureTemplates(["woke-at-night", "drank-water", "procrastinated", "talked-to-pet"]);
    const old = { "woke-at-night": "Get up if awake for 20 minutes at night, and come back when sleepy", "drank-water": "Keep a 0.7 L bottle on the desk and refill it twice a day", procrastinated: "Find ONE small start — open a doc, type one line", "talked-to-pet": "Saying thoughts out loud is normal: keep it up" };
    const T = await st.getTrackers();
    await st.saveTrackers(T.map((t) => { const k = Object.keys(old).find((id) => t.id.includes(id)); return k ? { ...t, adviceAboveThreshold: old[k] } : t; }));
    await st.runStartupMigrations();
    return (await st.getTrackers()).map((t) => t.adviceAboveThreshold);
  });
  out.plans = r;
  ok("saved niche plans refresh to the simple ones", r.join("|") === ["Keep the bedroom cool at night", "Keep a bottle of water within reach", "Start a put-off task with its smallest step", "Play with your pet for 10 minutes"].join("|"), r);
  await ctx.close();
}
console.log(JSON.stringify({ fails, out, errs }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
