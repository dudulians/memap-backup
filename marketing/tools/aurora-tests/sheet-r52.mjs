import { chromium } from "playwright-core";
import { readFileSync } from "fs";
const [out, ...names] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await b.newPage({ viewport: { width: names.length * 290 + 20, height: 640 } });
const imgs = names.map((n) => `<img src="data:image/png;base64,${readFileSync(n).toString("base64")}" style="width:280px;border-radius:14px">`).join("");
await p.setContent(`<body style="margin:0;padding:10px;display:flex;gap:10px;background:#e8ebf2">${imgs}</body>`, { waitUntil: "load" });
await p.screenshot({ path: out, fullPage: true });
await b.close();
