// Sounds stay only in the bubbles (her note, Nov 5 2026: "надо оставить их в баблз").
// Counts what actually starts playing: bubble sounds must play, the rest must stay quiet;
// the game shows its own mute button, and muting silences it.
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", args: ["--autoplay-policy=no-user-gesture-required"] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
// count every sound that starts
await p.addInitScript(() => {
  window.__starts = 0;
  const wrap = (proto) => { const s = proto.start; proto.start = function (...a) { window.__starts++; return s.apply(this, a); }; };
  wrap(AudioBufferSourceNode.prototype); wrap(OscillatorNode.prototype);
});
await p.goto("http://localhost:8080/"); await p.waitForTimeout(800);
await p.evaluate(() => { localStorage.setItem("memap_ui", "new"); localStorage.setItem("memap_tour_seen", "true"); localStorage.setItem("memap_language", "en"); localStorage.setItem("memap_language_chosen", "true"); localStorage.setItem("memap_theme", "aurora-light"); });
await p.reload(); await p.waitForTimeout(1500);
const out = await p.evaluate(async () => {
  const f = await import("/src/lib/feedback.ts");
  const n = () => window.__starts;
  const r = {};
  let a = n(); f.playSparkle(); f.playThump(); f.playBloop(); f.playSwipeSound("yes"); f.playTick(); await new Promise((x) => setTimeout(x, 300)); r.otherSounds = n() - a;
  a = n(); f.playPop(0.3, 0.5); f.playMerge(); f.playBurst(); await new Promise((x) => setTimeout(x, 300)); r.bubbleSounds = n() - a;
  a = n(); const stop = f.startSea(); await new Promise((x) => setTimeout(x, 1500)); stop(); r.sea = n() - a;
  return r;
});
// the game's mute button
await p.evaluate(() => window.dispatchEvent(new CustomEvent("memap-open-unload")));
console.log(JSON.stringify({ ...out, errs }, null, 1));
await b.close();
