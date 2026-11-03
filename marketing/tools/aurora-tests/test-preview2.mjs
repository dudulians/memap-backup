// The built phone preview: demo opens with tonight's START, the switch makes a new user and back.
import { chromium } from "playwright-core";
const D = "./aurora-tests/work";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true })).newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://127.0.0.1:4180/phone-preview-map/memap-preview.html"); await p.waitForTimeout(2500);
const state = () => p.evaluate(() => ({
  banner: document.getElementById("memap-header-center")?.innerText.replace(/\n+/g, " "),
  start: !!document.evaluate("//*[text()='Start' or text()='Старт']", document, null, 9, null).singleNodeValue,
  flame: document.getElementById("memap-header-start")?.innerText,
  btn: [...document.querySelectorAll("body > button")].map((x) => x.textContent + ":" + x.style.display).join(","),
  scenery: document.querySelectorAll("img[aria-hidden], [aria-hidden] img").length,
}));
const out = { demo: await state() };
await p.screenshot({ path: `${D}/pv2-demo.png` });
await p.evaluate(() => { const m = document.querySelector("main"); if (m) m.scrollTop = 0; }); await p.waitForTimeout(700); await p.getByText("Try as a new user").click(); await p.waitForTimeout(2500);
out.newUser = await state();
await p.screenshot({ path: `${D}/pv2-new.png` });
await p.evaluate(() => { const m = document.querySelector("main"); if (m) m.scrollTop = 0; }); await p.waitForTimeout(700); await p.getByText(/Back to the demo/).click(); await p.waitForTimeout(2500);
out.back = await state();
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
