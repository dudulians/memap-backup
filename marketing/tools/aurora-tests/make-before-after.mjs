// Before / after collage of a screen (Nov 9 2026: When to act folded). Run from marketing/tools:
//   node aurora-tests/make-before-after.mjs
import { chromium } from "playwright-core";
import path from "path";

const W = path.resolve("./aurora-tests/work");
import fs from "fs";
const img = (p) => "data:image/png;base64," + fs.readFileSync(path.join(W, p)).toString("base64");
const rows = [
  { label: "First screen", before: "recheck-v113-old/out/extra-en-day/01-act-lit-expanded-s0.png", after: "r91/en-1-collapsed.png" },
  { label: "A card opened", before: "recheck-v113-old/out/extra-en-day/02-act-lit-expanded-s1.png", after: "r91/en-2-expanded.png" },
];
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#EEF1F7;font-family:Manrope,Inter,system-ui,sans-serif;color:#3A3F4E}
.wrap{padding:36px 40px 44px}
h1{margin:0 0 6px;font-size:34px;font-weight:800;letter-spacing:-.01em}
.sub{margin:0 0 26px;font-size:18px;color:#6B7184;font-weight:600}
.row{display:grid;grid-template-columns:150px 1fr 1fr;gap:26px;align-items:start;margin-bottom:30px}
.rl{font-size:18px;font-weight:800;padding-top:40px}
.col h2{margin:0 0 10px;font-size:20px;font-weight:800}
.col.before h2{color:#9AA0B2}.col.after h2{color:#2E9A8A}
.col img{width:100%;border-radius:28px;box-shadow:0 14px 34px -18px rgba(20,40,90,.45);display:block}
</style></head><body><div class="wrap">
<h1>When to act — before and after</h1>
<p class="sub">Same person, 60 days of answers. Before: v113. After: v114.</p>
${rows.map((r) => `<div class="row"><div class="rl">${r.label}</div>
<div class="col before"><h2>Before</h2><img src="${img(r.before)}"></div>
<div class="col after"><h2>After</h2><img src="${img(r.after)}"></div></div>`).join("")}
</div></body></html>`;

const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await b.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1 });
await p.setContent(html, { waitUntil: "load" });
await p.waitForTimeout(500);
const out = path.resolve("../when-to-act-before-after.png");
await p.screenshot({ path: out, fullPage: true });
console.log(out);
await b.close();
