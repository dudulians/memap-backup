// QA (old user): old look and back — does Today keep its weeks? And the evening's
// "Need to talk?" and doctor-signs chips. Usage: node aurora-tests/qa-old-roundtrip.mjs en
import { launch, page, seed, shooter, installHelpers, esc, ev, buttons, clickText, log } from "./qa-old-lib.mjs";
const lang = process.argv[2] ?? "en";
const RU = lang === "ru";
const dir = `roundtrip-${lang}`;
const b = await launch();
const { ctx, p, errs } = await page(b, { lang });
await installHelpers(p);
await seed(p, { lang, theme: "aurora-light" });
const { shot, text, save, scrollShots } = shooter(p, dir);
const step = async (name, fn) => { try { await fn(); } catch (e) { log(dir, { [`FAIL ${name}`]: e.message.slice(0, 300) }); } };
const head = () => p.evaluate(() => ({ start: localStorage.getItem("memap_path_start"), header: document.querySelector("header, .path-head, [class*=head]")?.innerText?.slice(0, 80) ?? null, top: document.body.innerText.slice(0, 160).replace(/\s+/g, " ") }));

await step("evening mood", async () => {
  await shot("today-before");
  log(dir, { before: await head() });
  // the mood step: aria-labels like "Mind & mood, part 1 of 2"
  const s = await p.evaluate((RU) => { const el = [...document.querySelectorAll("button[aria-label]")].find((x) => (RU ? /Настроение/ : /Mind & mood/).test(x.getAttribute("aria-label"))); el?.click(); return el?.getAttribute("aria-label"); }, RU);
  log(dir, { moodStep: s }); await p.waitForTimeout(1500);
  await shot("mood-step-open"); await text("mood step open"); log(dir, { moodButtons: await buttons(p) });
  await clickText(p, RU ? /^Начать$/ : /^Start$/, null); await p.waitForTimeout(1500);
  for (let k = 0; k < 10; k++) {
    await shot(`mood-q${k}`, { wait: 400 }); await text(`mood q${k}`);
    const chip = p.getByRole("button", { name: RU ? /Хочется поговорить\?/ : /Need to talk\?/ });
    if (await chip.count()) {
      await chip.first().click(); await p.waitForTimeout(1300); await shot("support-sheet"); await text("support sheet"); await scrollShots("support-sheet", 3);
      await esc(p, 1); break;
    }
    const no = p.getByRole("button", { name: RU ? /^Нет$/ : /^No$/ });
    if (!(await no.count())) break;
    await no.last().click(); await p.waitForTimeout(900);
  }
  await esc(p, 3);
});
await step("evening health", async () => {
  await p.reload(); await p.waitForTimeout(2500);
  const s = await p.evaluate((RU) => { const el = [...document.querySelectorAll("button[aria-label]")].find((x) => (RU ? /^Здоровье/ : /^Health/).test(x.getAttribute("aria-label"))); el?.click(); return el?.getAttribute("aria-label"); }, RU);
  log(dir, { healthStep: s }); await p.waitForTimeout(1500);
  await clickText(p, RU ? /^Начать$/ : /^Start$/, null); await p.waitForTimeout(1500);
  for (let k = 0; k < 8; k++) {
    await shot(`health-q${k}`, { wait: 400 }); await text(`health q${k}`);
    log(dir, { [`health q${k} buttons`]: await buttons(p) });
    const chip = p.getByRole("button", { name: RU ? /Что-то тревожит/ : /Something worrying?/ });
    if (await chip.count()) { await chip.first().click(); await p.waitForTimeout(1300); await shot("redflags-sheet"); await text("red flags sheet"); await scrollShots("redflags-sheet", 4); await esc(p, 1); }
    const no = p.getByRole("button", { name: RU ? /^Нет$/ : /^No$/ });
    if (!(await no.count())) break;
    await no.last().click(); await p.waitForTimeout(900);
  }
  await shot("health-end"); await text("health end"); await scrollShots("health-end", 3);
  await esc(p, 3);
});
await step("round trip", async () => {
  await p.reload(); await p.waitForTimeout(2500);
  await ev(p, "memap-open-you", {}); await p.waitForTimeout(1200);
  await clickText(p, /^(Settings|Настройки)$/); await p.waitForTimeout(1200);
  await clickText(p, RU ? /старый вид/i : /Back to the old look/); await p.waitForTimeout(2500);
  await shot("old");
  await clickText(p, /settings|настройки/i, null); await p.waitForTimeout(1200);
  await clickText(p, RU ? /новый MeMap/i : /Try the new MeMap/); await p.waitForTimeout(3500);
  await shot("new-again-world");
  await p.locator("nav button").first().click().catch(() => {}); await p.waitForTimeout(2500);
  await shot("new-again-today"); await text("new again today");
  log(dir, { after: await head() });
  await scrollShots("new-again-today", 5);
});
save(); log(dir, { errs: errs.filter((e) => !/InAppReview/.test(e)) });
await ctx.close(); await b.close();
