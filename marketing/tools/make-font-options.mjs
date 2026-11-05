// Font options for MeMap (her ask, Nov 5 2026: "а шрифты сможешь предложить?"), drawn on
// onboarding screens in English and Russian, in the text colour she picked (soft graphite).
// Every option has a full Cyrillic set. Nothing in the app changes.
// Run from marketing/tools: node make-font-options.mjs
import { chromium } from "playwright-core";
import { pathToFileURL } from "url";
import path from "path";
import { fileURLToPath } from "url";
const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SHOTS = path.join(R, "marketing/aurora-light-ux/49-onboarding-v2");
const OUT = path.join(R, "marketing/aurora-light-ux/52-font-options.png");
const TMP = path.join(R, "marketing/tools/aurora-tests/work/fonts");
const INK = "#3A3F4E", SUB = "#6B7184";
const FONTS = [
  ["Now: DM Sans + Onest", null, "the app today (Onest for Russian)"],
  ["Nunito", "Nunito", "rounded, soft, friendly"],
  ["Rubik", "Rubik", "slightly rounded corners, sturdy"],
  ["Manrope", "Manrope", "modern, clean, a little wide"],
  ["Golos Text", "Golos Text", "made for Russian, very clear"],
  ["Inter", "Inter", "neutral, like iOS"],
];
const GF = "https://fonts.googleapis.com/css2?family=Nunito:wght@400..900&family=Rubik:wght@400..900&family=Manrope:wght@400..800&family=Golos+Text:wght@400..900&family=Inter:wght@400..900&family=Onest:wght@400..900&display=swap";
const RU = {
  "v1-welcome": [["What comes before<br>your best days —<br>and your hardest?", "Что бывает перед<br>твоими лучшими днями<br>и самыми тяжёлыми?"], ["A minute each evening", "Минута каждый вечер"], ["I already have MeMap", "У меня уже есть MeMap"], ["Start ", "Начать "]],
  "v3-pain": [["What keeps<br>happening?", "Что повторяется?"], ["Fights with my partner", "Ссоры с партнёром"], ["Migraines", "Мигрень"], ["Drinking", "Алкоголь"], ["Bad nights", "Плохие ночи"], ["Snapping at my kid", "Срываюсь на ребёнка"], ["Low mood", "Плохое настроение"], ["Something else", "Другое"], ["Continue", "Дальше"]],
};
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", args: ["--allow-file-access-from-files"] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const cols = [];
let i = 0;
for (const [name, family, note] of FONTS) {
  const imgs = [];
  for (const [scr, lang] of [["v1-welcome", "en"], ["v1-welcome", "ru"], ["v3-pain", "ru"]]) {
    await p.goto(pathToFileURL(path.join(SHOTS, scr + ".html")).href);
    await p.addStyleTag({ url: GF }).catch(() => {});
    const fam = family ? `"${family}"` : (lang === "ru" ? `"Onest"` : `DM`);
    await p.addStyleTag({ content: `body, body * { font-family: ${fam}, sans-serif !important; }
      body, h1, .row, .card, .big, .chip, .lab, .head, .wk, .status { color: ${INK} !important; } .sub, .link { color: ${SUB} !important; } .btn { color: #fff !important; }` });
    if (lang === "ru") await p.evaluate((pairs) => {
      for (const el of document.querySelectorAll("h1, p, div, span")) {
        if (el.children.length && el.tagName !== "H1") continue;
        for (const [en, ru] of pairs) if (el.innerHTML.includes(en)) el.innerHTML = el.innerHTML.replace(en, ru);
      }
      document.querySelectorAll(".row").forEach((r) => { for (const [en, ru] of pairs) for (const n of r.childNodes) if (n.nodeType === 3 && n.textContent.trim() === en) n.textContent = ru; });
    }, RU[scr]);
    // load every weight the screen uses before the picture (else the first paint is a lighter face)
    await p.waitForTimeout(2500); // the web fonts need a moment for every weight (fonts.load alone was not enough)
    if (lang === "ru") await p.evaluate(() => { const h = document.querySelector("h1"); if (h && h.textContent.length > 40) h.style.fontSize = "27px"; document.querySelectorAll(".btn").forEach((x) => { const t = [...x.childNodes].find((n) => n.nodeType === 3); if (t) t.textContent = t.textContent.replace("Start", "Начать").replace("Continue", "Дальше"); }); });
    await p.waitForTimeout(400);
    const f = path.join(TMP, `f${i}-${scr}-${lang}.png`);
    await p.screenshot({ path: f });
    imgs.push(pathToFileURL(f).href);
  }
  cols.push(`<div class="c"><h3>${name}</h3><p>${note}</p>${imgs.map((s) => `<img src="${s}">`).join("")}</div>`);
  i++;
}
await p.setViewportSize({ width: FONTS.length * 290 + 60, height: 900 });
await p.setContent(`<html><head><style>body{margin:0;background:#EEF1FA;font-family:"Segoe UI",sans-serif;color:#3A3F4E}
  h2{margin:0;padding:24px 30px 4px;font-size:28px}.r{display:flex;gap:20px;padding:14px 30px}.c{width:270px}
  .c h3{margin:0;font-size:19px}.c p{margin:2px 0 10px;font-size:14px;opacity:.7}.c img{width:270px;border-radius:22px;display:block;margin-bottom:14px;box-shadow:0 12px 26px -18px rgba(20,40,80,.5)}</style></head>
  <body><h2>Fonts, in soft graphite · English and Russian</h2><div class="r">${cols.join("")}</div></body></html>`);
await p.waitForTimeout(800);
await p.screenshot({ path: OUT, fullPage: true });
await b.close();
console.log("ok");
