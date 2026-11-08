// QA (old user): the evening chips — "Something worrying?" (red flags) on body questions and
// "Need to talk?" on mood questions. Usage: node aurora-tests/qa-old-chips.mjs en
import { launch, page, seed, shooter, installHelpers, esc, buttons, log } from "./qa-old-lib.mjs";
const lang = process.argv[2] ?? "en";
const RU = lang === "ru";
const dir = `chips-${lang}`;
const b = await launch();
const { ctx, p, errs } = await page(b, { lang });
await installHelpers(p);
await seed(p, { lang, theme: "aurora-light" });
const { shot, text, save, scrollShots } = shooter(p, dir);
const YES = RU ? /^Да$/ : /^Yes$/, NO = RU ? /^Нет$/ : /^No$/;
const FLAG = RU ? /Что-то тревожит\?/ : /Something worrying\?/, TALK = RU ? /Хочется поговорить\?/ : /Need to talk\?/;
const startStep = async (re) => {
  const hit = await p.evaluate((src) => { const re = new RegExp(src); const el = [...document.querySelectorAll("button[aria-label]")].find((x) => re.test(x.getAttribute("aria-label"))); el?.click(); return el?.getAttribute("aria-label") ?? null; }, re.source);
  await p.waitForTimeout(1200);
  const go = p.getByRole("button", { name: RU ? /^(Начать|Продолжить)$/ : /^(Start|Continue)$/ });
  if (await go.count()) { await go.last().click(); await p.waitForTimeout(1500); }
  return hit;
};
const walk = async (tag, chipRe, sheetName) => {
  let seen = false;
  for (let k = 0; k < 9; k++) {
    const q = await p.evaluate(() => [...document.querySelectorAll("[role=dialog] h2, [role=dialog] h3, [role=dialog] p, [role=dialog] div")].map((x) => x.children.length === 0 ? x.textContent.trim() : "").filter((s) => s.endsWith("?")).slice(-1)[0] ?? "");
    const chip = p.getByRole("button", { name: chipRe });
    if (!seen && (await chip.count())) {
      seen = true;
      await shot(`${tag}-q-with-chip`); log(dir, { [`${tag} chip on`]: q });
      await chip.first().click(); await p.waitForTimeout(1300);
      await shot(sheetName); await text(sheetName); log(dir, { [`${sheetName} buttons`]: await buttons(p) });
      await scrollShots(sheetName, 4);
      await p.keyboard.press("Escape"); await p.waitForTimeout(800);
      await shot(`${tag}-after-sheet`);
    }
    const btn = p.getByRole("button", { name: k % 2 ? YES : NO });
    if (!(await btn.count())) break;
    if (await p.getByRole("button", { name: RU ? /^Продолжить$/ : /^Continue$/ }).count()) break;
    await btn.last().click({ timeout: 4000 }).catch(() => {}); await p.waitForTimeout(900);
  }
  return seen;
};
log(dir, { healthStep: await startStep(RU ? /^Здоровье/ : /^Health/) });
log(dir, { flagSeen: await walk("health", FLAG, "redflags-sheet") });
await esc(p, 3); await p.reload(); await p.waitForTimeout(2500);
log(dir, { moodStep: await startStep(RU ? /Настроение/ : /Mind & mood/) });
await shot("mood-start"); await text("mood start");
log(dir, { talkSeen: await walk("mood", TALK, "support-sheet") });
save(); log(dir, { errs: errs.filter((e) => !/InAppReview/.test(e)) });
await ctx.close(); await b.close();
