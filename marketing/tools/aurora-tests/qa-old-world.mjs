// QA (old user): World, its 4 cards, islands. Usage: node aurora-tests/qa-old-world.mjs en aurora-light
import { launch, page, seed, shooter, installHelpers, toWorld, esc, ev, buttons, clickText, log } from "./qa-old-lib.mjs";
const lang = process.argv[2] ?? "en", theme = process.argv[3] ?? "aurora-light";
const dir = `world-${lang}-${theme === "aurora" ? "night" : "day"}`;
const b = await launch();
const { ctx, p, errs } = await page(b, { lang });
await installHelpers(p);
const info = await seed(p, { lang, theme });
log(dir, { info });
const { shot, text, save, scrollShots } = shooter(p, dir);
await shot("today");
await text("today");
await scrollShots("today", 5);
await toWorld(p);
await shot("world", { wait: 2500 });
await text("world");
log(dir, { worldButtons: await buttons(p, "main") });
// the four cards
const cards = ["calendar", "links-card", "actions", "helps"];
const cardText = await p.evaluate(() => ["calendar", "links-card", "actions", "helps"].map((k) => document.querySelector(`[data-tour=${k}]`)?.innerText.replace(/\s+/g, " ")));
log(dir, { cardText });
for (const k of cards) {
  await p.evaluate((k) => document.querySelector(`[data-tour=${k}]`)?.click(), k);
  await p.waitForTimeout(2000);
  await text(`card ${k}`);
  log(dir, { [`buttons ${k}`]: await buttons(p) });
  await scrollShots(`card-${k}`, 6);
  await esc(p, 1); await p.waitForTimeout(800);
  // make sure we're back on World
  const onWorld = await p.evaluate(() => !!document.querySelector("[data-tour=calendar]") && ![...document.querySelectorAll("[role=dialog]")].length);
  if (!onWorld) { await esc(p, 2); await toWorld(p); }
}
// islands: tap through the event (globe taps are canvas); each sheet scrolled fully
const islands = info.islands.filter((x) => typeof x === "string");
for (const isl of islands.slice(0, 4)) {
  await toWorld(p);
  await ev(p, "memap-open-island", { island: isl });
  await p.waitForTimeout(1600);
  const t = await text(`island ${isl}`);
  log(dir, { [`island ${isl} buttons`]: await buttons(p) });
  await scrollShots(`island-${isl}`, 8);
  await esc(p, 1);
}
save();
log(dir, { errs });
console.log(JSON.stringify({ info, errs: errs.slice(0, 10) }, null, 1));
await ctx.close(); await b.close();
