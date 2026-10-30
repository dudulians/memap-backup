/**
 * App icon options with Malu (the white lamb from @memap_tracker), drawn
 * with the same rig as the Instagram avatars (../mascot/chibi.js through
 * lamb.js), next to the old favourite "Связь" and the current icon, each
 * shown big, on a dark and a light home screen and in an App Store
 * search row. Same layout as brand/icon/options-4.png.
 *
 * Usage (from marketing/): node tools/make-icon-lamb.mjs
 *   -> brand/icon/lamb-{a,b,c,c-round}.png (1024x1024) + brand/icon/options-5.png
 * The app icon itself is installed with scripts/make-app-icons.mjs.
 */
import fs from "node:fs";
import path from "node:path";
import { openPage, INSTAGRAM, REPO } from "./lib/render.mjs";
import { fontFace } from "./lib/ui.mjs";

const MASCOT = path.join(path.dirname(INSTAGRAM), "mascot");
const OUT = path.join(path.dirname(INSTAGRAM), "brand", "icon");
const S = 1024;

// bg: [inner, outer] radial; dots: optional calendar dots behind Malu
const OPTIONS = {
  a: { name: "Малу на тёмном", note: "Цвет приложения и стора, барашка из инсты", bg: ["#2B6670", "#123139"], k: 4.1, ground: 960,
    pose: { eyes: "happy", mouth: "w", blush: 0.85, r: 2, head: { r: 5 } } },
  b: { name: "Малу на мятном", note: "Ровно как аватарка в инсте", bg: ["#F2FAF4", "#CBE9D6"], k: 4.1, ground: 960,
    pose: { eyes: "happy", mouth: "w", blush: 0.85, r: 2, head: { r: 5 } } },
  c: { name: "Малу и точки дней", note: "Барашка над точками дней из календаря", bg: ["#2B6670", "#123139"], k: 3.2, ground: 690, dots: { x0: 152, gap: 120, r: 44, y0: 790 },
    pose: { eyes: "sparkle", mouth: "open", blush: 0.7, r: -2, head: { r: -4 } } },
  // L3 pulled toward the centre so a circle mask keeps every dot: used for
  // the Android launcher icons (round and adaptive), not shown on the sheet
  "c-round": { name: "L3 для Android", note: "", bg: ["#2B6670", "#123139"], k: 2.7, ground: 640, dots: { x0: 224, gap: 96, r: 36, y0: 735 }, hidden: true,
    pose: { eyes: "sparkle", mouth: "open", blush: 0.7, r: -2, head: { r: -4 } } },
};

const read = (f) => fs.readFileSync(path.join(MASCOT, f), "utf8");
const script = `
const OPTIONS = ${JSON.stringify(OPTIONS)}, S = ${S};
const DOT = { g: "#3DBE95", r: "#EE7D93", u: "rgba(255,255,255,0.16)" };
const ROW = ["g","g","r","g","g","g","r","g","g","g","g","r","g","g"];
window.icon = (key) => {
  const o = OPTIONS[key];
  let svg = '<defs>' + lambBoil(0.2, 2.4) + '<radialGradient id="bg" cx="50%" cy="28%" r="80%"><stop offset="0" stop-color="' + o.bg[0] + '"/><stop offset="1" stop-color="' + o.bg[1] + '"/></radialGradient></defs>';
  svg += '<rect width="' + S + '" height="' + S + '" fill="url(#bg)"/>';
  if (o.dots) {
    // three weeks of days behind Malu, rose = a bad day
    ROW.forEach((c, i) => { const col = i % 7, row = Math.floor(i / 7);
      const d = o.dots; svg += '<circle cx="' + (d.x0 + col * d.gap) + '" cy="' + (d.y0 + row * d.gap) + '" r="' + d.r + '" fill="' + DOT[c] + '"/>'; });
  }
  const l = { who: "mallow", x: 512, y: o.ground, k: o.k, pose: o.pose };
  return svg + '<g filter="url(#boil)">' + (o.dots ? '' : lambShadow(l)) + lamb(l) + '</g>';
};`;
const html = (body) => `<!doctype html><html><head><meta charset="utf-8"><style>${fontFace()}*{margin:0}body{background:#fff}</style></head>
<body>${body}<script>${read("chibi.js")}</script><script>${read("lamb.js")}</script><script>${script}</script></body></html>`;

const { browser, page } = await openPage({ width: S, height: S, html: html(`<svg id="stage" width="${S}" height="${S}" xmlns="http://www.w3.org/2000/svg"></svg>`) });
const shots = {};
for (const key of Object.keys(OPTIONS)) {
  await page.evaluate((k) => { document.getElementById("stage").innerHTML = window.icon(k); }, key);
  shots[key] = await page.screenshot({ type: "png" });
  fs.writeFileSync(path.join(OUT, `lamb-${key}.png`), shots[key]);
}
await browser.close();

// comparison sheet
const b64 = (buf) => `data:image/png;base64,${buf.toString("base64")}`;
const rows = [
  ...Object.entries(OPTIONS).filter(([, o]) => !o.hidden).map(([key, o], i) => ({ label: `L${i + 1}. ${o.name}`, note: o.note, src: b64(shots[key]) })),
  { label: "О1. Связь", note: "Прошлый фаворит: два мягких шарика", src: b64(fs.readFileSync(path.join(OUT, "link-soft.png"))) },
  { label: "Сейчас", note: "Буква M и две точки", src: b64(fs.readFileSync(path.join(REPO, "resources", "icon.png"))) },
];
const app = (bg, glyph) => `<div style="width:72px;height:72px;border-radius:17px;background:${bg};display:flex;align-items:center;justify-content:center">${glyph}</div>`;
const sun = app("linear-gradient(160deg,#FFA544,#F57B1F)", `<div style="width:30px;height:30px;border-radius:50%;border:5px solid #fff"></div>`);
const notes = app("linear-gradient(160deg,#4FB2FF,#1E7CF2)", `<div style="display:flex;flex-direction:column;gap:5px"><i style="display:block;width:32px;height:5px;background:#fff;border-radius:3px"></i><i style="display:block;width:32px;height:5px;background:#fff;border-radius:3px"></i><i style="display:block;width:20px;height:5px;background:#fff;border-radius:3px"></i></div>`);
const tile = (src, dark) => `<div style="width:240px;height:216px;border-radius:24px;background:${dark ? "linear-gradient(170deg,#3B2F5C,#141B33)" : "linear-gradient(170deg,#F4F4FA,#E9E4F0)"};display:flex;justify-content:center;gap:14px;padding-top:58px;box-sizing:border-box">
  ${[["Sun", sun], ["MeMap", `<img src="${src}" style="width:72px;height:72px;border-radius:17px">`], ["Notes", notes]].map(([n, g]) => `<div style="display:flex;flex-direction:column;align-items:center;gap:7px">${g}<span style="font:500 13px 'DM Sans',sans-serif;color:${dark ? "#fff" : "#222"}">${n}</span></div>`).join("")}</div>`;
const store = (src) => `<div style="width:336px;height:216px;border-radius:24px;background:#fff;padding:22px 18px;box-sizing:border-box;display:flex;flex-direction:column;gap:22px">
  ${[[`<img src="${src}" style="width:56px;height:56px;border-radius:13px">`, "MeMap: Mood &amp; Symp…", "Triggers behind your bad days"],
     [`<div style="width:56px;height:56px;border-radius:13px;background:linear-gradient(160deg,#FFD25A,#F5B323)"></div>`, "Mood Diary &amp; Journal", "Track feelings every day"]]
    .map(([ic, t, s]) => `<div style="display:flex;align-items:center;gap:12px">${ic}<div style="flex:1;min-width:0"><div style="font:600 15px 'DM Sans',sans-serif;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t}</div><div style="font:400 13px 'DM Sans',sans-serif;color:#777;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s}</div></div><span style="font:700 13px 'DM Sans',sans-serif;color:#1E7CF2;background:#EEF2F8;border-radius:14px;padding:5px 14px">Get</span></div>`).join("")}</div>`;
const W = 1340, RH = 262;
const body = `<div style="padding:40px 40px 30px"><div style="font:700 34px 'DM Sans',sans-serif;color:#fff">MeMap: иконка с Малу</div>
<div style="font:400 17px 'DM Sans',sans-serif;color:rgba(255,255,255,.7);margin-top:8px">Три варианта с барашкой из инсты рядом с прошлым фаворитом и нынешней иконкой.</div></div>
${rows.map((r) => `<div style="display:flex;align-items:center;gap:20px;padding:0 40px;height:${RH}px;border-top:1px solid rgba(255,255,255,.1)">
  <div style="width:180px"><div style="font:700 22px 'DM Sans',sans-serif;color:#fff">${r.label}</div><div style="font:400 14px 'DM Sans',sans-serif;color:rgba(255,255,255,.7);margin-top:6px;line-height:1.35">${r.note}</div>
  <div style="display:flex;align-items:center;gap:10px;margin-top:14px"><img src="${r.src}" style="width:29px;height:29px;border-radius:7px"><span style="font:400 12px 'DM Sans',sans-serif;color:rgba(255,255,255,.55)">как в настройках</span></div></div>
  <img src="${r.src}" style="width:188px;height:188px;border-radius:42px">${tile(r.src, true)}${tile(r.src, false)}${store(r.src)}</div>`).join("")}`;
const H = 150 + rows.length * RH;
const sheet = await openPage({ width: W, height: H, html: `<!doctype html><html><head><meta charset="utf-8"><style>${fontFace()}*{margin:0}body{width:${W}px;height:${H}px;background:#16161A}</style></head><body>${body}</body></html>` });
fs.writeFileSync(path.join(OUT, "options-5.png"), await sheet.page.screenshot({ type: "png" }));
await sheet.browser.close();
console.log(path.join(OUT, "options-5.png"));
