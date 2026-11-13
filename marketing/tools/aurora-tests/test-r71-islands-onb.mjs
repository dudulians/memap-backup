// Onboarding by islands, variant A (Nov 7 2026): What brings you here? → islands (closed, open in
// place) → up to 3 topics → questions labelled with the same islands. Both tones; EN and RU.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r71`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const out = {}, errs = [];
// every topic's main question sits on the island it is listed under
{
  const p = await b.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  out.islandsMatch = await p.evaluate(async () => {
    localStorage.clear(); localStorage.setItem("memap_ab_onb", "A"); localStorage.setItem("memap_language", "en");
    const dz = await import("/src/lib/doors.ts"), I = await import("/src/lib/islands.ts"), st = await import("/src/lib/storage.ts");
    // every topic on the onboarding screen (Nov 8 2026: 4–8 per island)
    const O = await import("/src/components/OnboardingV7.tsx");
    const LIST = Object.fromEntries(Object.entries(O.ISLAND_TOPICS).map(([tone, gs]) => [tone, Object.fromEntries(gs.map((g) => [g.island, g.ids]))]));
    const bad = [];
    for (const [tone, groups] of Object.entries(LIST)) for (const [island, ids] of Object.entries(groups)) for (const id of ids) {
      const door = dz.getDoor(id); await dz.ensureTemplates([door.mainTemplateId]);
      const tr = (await st.getTrackers()).find((x) => x.id.includes(door.mainTemplateId)) ?? (await st.getTrackers()).slice(-1)[0];
      const got = I.islandOf(tr); if (got !== island) bad.push(`${tone}/${id}: listed ${island}, question on ${got}`);
    }
    // the words each topic needs, in both languages
    const i18n = (await import("/src/lib/i18n.ts")).default;
    for (const lng of ["en", "ru"]) for (const gs of Object.values(LIST)) for (const ids of Object.values(gs)) for (const id of ids) {
      for (const k of [`doors.${id}.name`, `path.daysLabel.${id}`]) if (!i18n.exists(k, { lng })) bad.push(`${lng} missing ${k}`);
      const n = i18n.t(`doors.${id}.noun`, { lng, count: 5 }); if (n.startsWith("doors.")) bad.push(`${lng} missing noun ${id}`);
    }
    bad.push(`topics: ${Object.values(LIST).flatMap((g) => Object.values(g).flat()).length}`);
    return bad;
  });
  await p.close();
}
for (const [lang, tone] of [["en", "bother"], ["en", "good"], ["ru", "bother"]]) {
  const tag = `${lang}-${tone}`;
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${tag}: ${e.message}`));
  let n = 0; const shot = async (name) => { await p.waitForTimeout(500); await p.screenshot({ path: `${D}/${tag}-${++n}-${name}.png` }); };
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(700);
  await p.evaluate((lang) => { localStorage.clear(); localStorage.setItem("memap_ab_onb", "A"); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_theme", "aurora-light"); }, lang);
  await p.reload(); await p.waitForTimeout(2200);
  await p.getByRole("button", { name: lang === "ru" ? /^Начать/ : /^Get started/ }).first().click(); await p.waitForTimeout(600);
  await shot("why");
  await p.getByRole("button", { name: tone === "good" ? /more good days|хороших дней/i : /bothering me|повторяется и мешает/i }).click(); await p.waitForTimeout(600);
  out[`${tag} closedAtStart`] = await p.locator("[aria-expanded=true]").count();
  await shot("islands-closed");
  const isl = (re) => p.getByRole("button", { name: re }).first();
  if (tone === "good") {
    await isl(/^Health|^Здоровье/).click(); await p.getByRole("button", { name: /^Good sleep$|^Хороший сон$/ }).click();
    await isl(/^Mind & mood|^Настроение/).click(); await p.getByRole("button", { name: /^Calm$|^Спокойствие$/ }).click();
  } else {
    await isl(/^Health|^Здоровье/).click(); await p.waitForTimeout(300);
    const chips = p.locator("[aria-pressed]");
    await chips.nth(0).click(); await chips.nth(1).click();
    await isl(/^Mind & mood|^Настроение/).click(); await p.waitForTimeout(300);
    await p.locator("[aria-pressed=false]").first().click();
    // a 4th: the gentle limit line
    await isl(/^Love life|^Любовь/).click(); await p.waitForTimeout(300);
    await p.locator("[aria-pressed=false]").first().click();
    out[`${tag} limitLine`] = await p.locator(".onb h1 + p").innerText();
  }
  out[`${tag} picked`] = await p.locator("[aria-pressed=true]").allInnerTexts();
  await shot("islands-picked");
  await p.getByRole("button", { name: /^Continue|^Дальше|^Продолжить/ }).first().click(); await p.waitForTimeout(900);
  out[`${tag} questions`] = await p.evaluate(() => [...document.querySelectorAll(".pick-on")].map((x) => x.innerText.replace(/\s+/g, " ").slice(0, 80)));
  await shot("questions");
  await ctx.close();
}
console.log(JSON.stringify({ out, errs }, null, 1));
await b.close();
