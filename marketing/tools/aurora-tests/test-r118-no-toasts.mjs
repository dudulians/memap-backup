// r118 (Nov 10 2026, her note: "там окно дурацкое как техническое выплывает «Noted.». давай все тех окна уберем,
// а там где без них нельзя — что-то другое придумаем"). No pop-up windows on the new screens: what a pop-up said
// now shows in place. This walks the spots that used to pop one up and fails if a pop-up window appears:
//   My questions: Archive → "Archived: … · Undo" line; Delete → "Deleted: … · Undo"; Edit → delete 2 → "2 questions
//   deleted · Undo"; Undo brings them back; the reminder card: refused → a line on the card, allowed → "Reminder on · 20:00".
//   Settings: reminder switch refused → a line under it; a file that isn't a backup → a line under Restore;
//   Backup → the row says "Saved".
// Run from marketing/tools:  node aurora-tests/test-r118-no-toasts.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
const D = `./aurora-tests/work/r118-toasts`; mkdirSync(D, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const errs = [], out = {}, fails = [];
const ok = (name, cond, info = "") => { out[name] = !!cond; if (!cond) fails.push(`${name} ${typeof info === "string" ? info : JSON.stringify(info)}`.trim()); };

// any pop-up window: sonner, or the Radix toast viewport (an <ol> in the "Notifications" region) with something in it
const popups = (p) => p.evaluate(() => {
  const sonner = document.querySelectorAll("[data-sonner-toast]").length;
  const radix = [...document.querySelectorAll("[role=region] ol, ol[tabindex='-1']")].reduce((n, ol) => n + ol.children.length, 0);
  const status = document.querySelectorAll("ol li[role=status]").length;
  return { sonner, radix, status, total: sonner + radix + status };
});

// the detector itself: a real pop-up (the old hook, still used by the classic screens) must be seen
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.goto("http://localhost:8080/"); await p.waitForTimeout(1500);
  await p.evaluate(async () => { const m = await import("/src/hooks/use-toast.ts"); m.toast({ title: "probe" }); });
  await p.waitForTimeout(500);
  const c = await popups(p);
  out["detector sees a real pop-up"] = c;
  ok("detector: sees a real pop-up", c.total > 0, c);
  await ctx.close();
}

for (const lang of ["en", "ru"]) {
  const W = lang === "ru"
    ? { archive: /^Архив$/, del: /^Удалить$/, edit: /^Изменить$/, del2: /^Удалить 2$/, undo: /^Отменить$/, turnOn: /^Включить$/, settings: /^Настройки$/, reminder: "Вечернее напоминание", data: /Данные и приватность/, backup: /Бэкап/,
        archived: /^Архивировано:/, deleted: /^Удалено:/, deleted2: /2 вопроса удалено/, on: /Напоминание включено · 20:00/, denied: /Уведомления для MeMap выключены/, notBackup: /Это не бэкап MeMap/, saved: /Сохранено/ }
    : { archive: /^Archive$/, del: /^Delete$/, edit: /^Edit$/, del2: /^Delete 2$/, undo: /^Undo$/, turnOn: /^Turn on$/, settings: /^Settings$/, reminder: "Evening reminder", data: /Data & Privacy/, backup: /^Backup/,
        archived: /^Archived:/, deleted: /^Deleted:/, deleted2: /2 questions deleted/, on: /Reminder on · 20:00/, denied: /Notifications are off for MeMap/, notBackup: /isn't a MeMap backup/, saved: /Saved/ };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: "Europe/London", acceptDownloads: true });
  // the web backup takes the download path (desktop Chrome would offer its share sheet)
  await ctx.addInitScript(() => { try { Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true }); } catch { /* ignore */ } });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${lang}: ${e.message}`));
  let n = 0; const shot = async (name) => { await p.waitForTimeout(450); await p.screenshot({ path: `${D}/${lang}-${String(++n).padStart(2, "0")}-${name}.png` }); };
  const noPopup = async (step) => { await p.waitForTimeout(350); const c = await popups(p); ok(`${lang}.${step}: no pop-up window`, c.total === 0, c); };
  const permission = (v) => p.evaluate((v) => { window.Notification.requestPermission = async () => v; }, v);

  await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
  await p.evaluate(async (lang) => {
    localStorage.clear(); localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_links_view", "list"); localStorage.setItem("memap_tips_seen", JSON.stringify(["any-order"])); localStorage.setItem("memap_tour_seen", "true");
    localStorage.setItem("memap_language", lang); localStorage.setItem("memap_language_chosen", "1"); localStorage.setItem("memap_theme", "aurora-light");
    localStorage.setItem("memap_discover_seen", JSON.stringify({ tour: "2026-01-01" })); localStorage.setItem("memap_tour_completed", "1"); localStorage.setItem("memap_first_link_seen", "before");
    localStorage.setItem("memap_ab_onb", "A");
    const dz = await import("/src/lib/doors.ts"), st = await import("/src/lib/storage.ts");
    const ids = await dz.ensureTemplates(["headache", "said-yes-when-meant-no", "slept-enough"]);
    const E = [];
    for (let d = 1; d <= 20; d++) ids.forEach((id, i) => E.push({ id: `${id}-${d}`, trackerId: id, date: dz.daysAgoIso(d), value: (d + i) % 3 === 0 }));
    await st.saveEntries(E);
    // a question hidden in Settings: it must survive every delete, archive and undo on My questions (Nov 10 2026:
    // Today saved its shortened list and wiped the hidden ones)
    const [hidden] = await dz.ensureTemplates(["joint-pain"]);
    const T = await st.getTrackers();
    await st.saveTrackers(T.map((t) => (t.id === hidden ? { ...t, archived: true } : t)));
    localStorage.setItem("memap_path_start", dz.daysAgoIso(20));
  }, lang);
  await p.reload(); await p.waitForTimeout(2200);

  // ── My questions ──
  await p.evaluate(() => window.dispatchEvent(new Event("memap-open-questions"))); await p.waitForTimeout(1200);
  const cards = p.locator("[data-coachmark='cards-list'] .surface[role=button]");
  const before = await cards.count();
  out[`${lang}.questions`] = before;
  ok(`${lang}.questions: three in the list`, before === 3, String(before));

  // the reminder card: refused → a line on the card
  await permission("denied");
  await p.getByRole("button", { name: W.turnOn }).click();
  await noPopup("reminder refused");
  const notifErr = p.locator("[data-notif-error]");
  ok(`${lang}.reminder refused: a line on the card says why`, (await notifErr.count()) === 1 && W.denied.test(await notifErr.innerText()));
  await shot("reminder-refused");
  // allowed → the card says "on · 20:00" for a moment, then goes
  await permission("granted");
  await p.getByRole("button", { name: W.turnOn }).click();
  await p.waitForTimeout(250);
  const card = p.locator("[data-notif-card]");
  ok(`${lang}.reminder on: the card says it`, (await card.count()) === 1 && W.on.test(await card.innerText()), await card.innerText().catch(() => ""));
  await shot("reminder-on");
  await noPopup("reminder on");
  await p.waitForTimeout(3200);
  ok(`${lang}.reminder on: the card goes after a moment`, (await card.count()) === 0);

  // Archive from a question's sheet → the "Archived: … · Undo" line
  await cards.first().click(); await p.waitForTimeout(900);
  await p.getByRole("button", { name: W.archive }).click(); await p.waitForTimeout(900);
  await noPopup("archive");
  const undoLine = p.locator("[data-undo-line]");
  ok(`${lang}.archive: an Undo line in the list`, (await undoLine.count()) === 1 && W.archived.test(await undoLine.innerText()), await undoLine.innerText().catch(() => ""));
  ok(`${lang}.archive: one fewer in the list`, (await cards.count()) === before - 1, String(await cards.count()));
  await shot("archived-undo");
  await undoLine.getByRole("button", { name: W.undo }).click(); await p.waitForTimeout(900);
  ok(`${lang}.archive undo: back in the list`, (await cards.count()) === before, String(await cards.count()));
  ok(`${lang}.archive undo: the line goes`, (await undoLine.count()) === 0);

  // Delete (after its confirm) → "Deleted: … · Undo"
  await cards.first().click(); await p.waitForTimeout(900);
  await p.getByRole("dialog").last().getByRole("button", { name: W.del }).click(); await p.waitForTimeout(600);
  await p.getByRole("alertdialog").getByRole("button", { name: W.del }).click(); await p.waitForTimeout(900);
  await noPopup("delete");
  ok(`${lang}.delete: an Undo line in the list`, (await undoLine.count()) === 1 && W.deleted.test(await undoLine.innerText()), await undoLine.innerText().catch(() => ""));
  await shot("deleted-undo");
  await undoLine.getByRole("button", { name: W.undo }).click(); await p.waitForTimeout(900);
  ok(`${lang}.delete undo: back in the list`, (await cards.count()) === before, String(await cards.count()));

  // Edit → pick two → Delete 2 → "2 questions deleted · Undo"
  await p.getByRole("button", { name: W.edit }).click(); await p.waitForTimeout(500);
  await cards.nth(0).click(); await cards.nth(1).click(); await p.waitForTimeout(300);
  await p.getByRole("button", { name: W.del2 }).click(); await p.waitForTimeout(900);
  await noPopup("bulk delete");
  ok(`${lang}.bulk delete: an Undo line`, (await undoLine.count()) === 1 && W.deleted2.test(await undoLine.innerText()), await undoLine.innerText().catch(() => ""));
  await shot("bulk-deleted-undo");
  await undoLine.getByRole("button", { name: W.undo }).click(); await p.waitForTimeout(900);
  ok(`${lang}.bulk undo: back in the list`, (await cards.count()) === before, String(await cards.count()));
  const kept = await p.evaluate(() => JSON.parse(localStorage.getItem("memap_trackers") || "[]").filter((t) => t.archived && /joint/i.test(t.title)).length);
  ok(`${lang}.the hidden question survived delete, archive and undo`, kept === 1, String(kept));

  // ── Settings ──
  await p.evaluate(() => { localStorage.setItem("memap_notification_enabled", "false"); window.dispatchEvent(new Event("memap-open-you")); });
  await p.waitForTimeout(1000);
  await p.getByRole("button", { name: W.settings }).click(); await p.waitForTimeout(1200);
  await permission("denied");
  await p.getByRole("switch", { name: W.reminder }).first().click(); await p.waitForTimeout(500);
  await noPopup("settings reminder refused");
  const setErr = p.locator("[data-settings-error]");
  ok(`${lang}.settings reminder refused: a line under the switch`, (await setErr.count()) === 1 && W.denied.test(await setErr.innerText()), await setErr.innerText().catch(() => ""));
  ok(`${lang}.settings reminder refused: the switch stays off`, (await p.getByRole("switch", { name: W.reminder }).first().getAttribute("aria-checked")) === "false");
  await shot("settings-reminder-refused");

  // Data & privacy: a file that isn't a backup, then Backup
  await p.getByRole("button", { name: W.data }).click(); await p.waitForTimeout(900);
  await p.locator("input[type=file]").setInputFiles({ name: "notes.json", mimeType: "application/json", buffer: Buffer.from('{"hello": 1}') });
  await p.waitForTimeout(600);
  await noPopup("not a backup");
  ok(`${lang}.not a backup: a line under Restore`, (await setErr.count()) === 1 && W.notBackup.test(await setErr.innerText()), await setErr.innerText().catch(() => ""));
  await shot("settings-not-a-backup");
  const dl = p.waitForEvent("download", { timeout: 8000 }).catch(() => null);
  await p.locator("[data-row=backup]").click();
  // "Saved" shows for 2.5 s: look for it right away (the download event can come later)
  const saved = await p.locator("[data-row=backup]").filter({ hasText: W.saved }).waitFor({ timeout: 2000 }).then(() => true).catch(() => false);
  ok(`${lang}.backup: the row says Saved`, saved, await p.locator("[data-row=backup]").innerText());
  ok(`${lang}.backup: the old error line went`, (await setErr.count()) === 0);
  await p.screenshot({ path: `${D}/${lang}-${String(++n).padStart(2, "0")}-settings-backup-saved.png` });
  await noPopup("backup");
  out[`${lang}.backupDownloaded`] = !!(await dl);
  ok(`${lang}.backup: the file downloaded`, out[`${lang}.backupDownloaded`]);
  await ctx.close();
}
console.log(JSON.stringify({ fails, out, errs }, null, 1));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
