// First language (Nov 6 2026, her note): English for new installs outside Russia; Russian only
// for a Russian-language phone in Russia; old users keep the phone's language. The first
// screen shows one globe button; the list of languages only on tap.
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r50`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {};
const cases = [
  ["ru-RU, Moscow", "ru-RU", "Europe/Moscow", false, "ru"],
  ["ru-AE, Dubai", "ru-AE", "Asia/Dubai", false, "en"],
  ["ru (no region), Novosibirsk", "ru", "Asia/Novosibirsk", false, "ru"],
  ["en-US, Moscow", "en-US", "Europe/Moscow", false, "en"],
  ["ru-AE, Dubai, already using the app", "ru-AE", "Asia/Dubai", true, "ru"],
];
for (const [name, locale, timezoneId, old, want] of cases) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale, timezoneId });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${name}: ${e.message}`));
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(600);
  await p.evaluate((old) => {
    localStorage.clear();
    if (old) localStorage.setItem("memap_trackers", JSON.stringify([{ id: "t1", title: "Headache", category: "Health", problemWhen: "yes", threshold: 0, periodDays: 30, createdAt: new Date().toISOString() }]));
  }, old);
  await p.reload(); await p.waitForTimeout(2000);
  const got = await p.evaluate(() => (window.localStorage.getItem("i18nextLng") ?? document.documentElement.lang) || "");
  const lang = await p.evaluate(async () => (await import("/src/lib/i18n.ts")).getLanguage());
  out[name] = { want, got: lang, ok: lang === want };
  if (name === "ru-AE, Dubai") {
    await p.screenshot({ path: `${D}/welcome-en.png` });
    const btn = p.locator(".lang-btn");
    out.button = { visible: await btn.isVisible().catch(() => false), text: (await btn.textContent().catch(() => ""))?.trim(), ruShownBeforeTap: await p.getByText("Русский").isVisible().catch(() => false) };
    if (out.button.visible) {
      await btn.click(); await p.waitForTimeout(400);
      await p.screenshot({ path: `${D}/welcome-menu.png` });
      await p.getByRole("option", { name: "Русский" }).click(); await p.waitForTimeout(600);
      await p.screenshot({ path: `${D}/welcome-ru.png` });
      out.afterPick = await p.evaluate(async () => (await import("/src/lib/i18n.ts")).getLanguage());
    }
  }
  await ctx.close();
}
console.log(JSON.stringify({ ...out, errs }, null, 1));
await b.close();
