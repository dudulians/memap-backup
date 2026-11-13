// Phone preview of the Map step: wrap the vite build as an artifact page and seed example answers
// (so the map shows islands right away). Run from marketing/tools (playwright-core lives there).
import { chromium } from "playwright-core";
import fs from "node:fs";
const S = "./aurora-tests/work";
const O = `${S}/phone-preview-one`;
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const p = await (await b.newContext()).newPage();
await p.goto("http://localhost:8080/"); await p.waitForTimeout(1200);
const seed = await p.evaluate(async () => {
  const g = await import("/src/lib/demoDataGenerator.ts"); let T = [], E = [];
  for (const id of ["showcase", "relationship-reality", "body"]) { const r = g.generateDemoData(id); T = T.concat(r.newTrackers); E = E.concat(r.newEntries); }
  // "Cooked my own food" drew an odd link (flowers → cooking at home, 7 of 7): left out (Nov 7 2026)
  const seen = new Set(); T = T.filter((t) => { if (seen.has(t.title) || t.title === "Cooked my own food") return false; seen.add(t.title); return true; });
  const ids = new Set(T.map((t) => t.id)); E = E.filter((e) => ids.has(e.trackerId));
  // A door user on day 1 ("Try as a new user"): the fights door's questions, no answers.
  localStorage.clear();
  const dz = await import("/src/lib/doors.ts");
  const { trackerId, contextTrackerIds } = await dz.ensureDoorTrackers(dz.getDoor("fights"));
  const NT = JSON.parse(localStorage.getItem("memap_trackers") || "[]");
  localStorage.clear();
  return { T, E, NT, door: { id: "fights", trackerId, contextTrackerIds } };
});
await b.close();
let html = fs.readFileSync(`${O}/index.html`, "utf8");
html = html.replace(/<!doctype html>/i, "").replace(/<\/?html[^>]*>/gi, "").replace(/<\/?head[^>]*>/gi, "").replace(/<\/?body[^>]*>/gi, "");
html = html.replace(/<title>[^<]*<\/title>/, "<title>MeMap One System Preview</title>");
const base = `<script>(function(){try{var b=document.createElement("base");b.href=location.href;document.head.appendChild(b);if(location.pathname!=="/")history.replaceState(history.state,"","/"+location.search+location.hash);}catch(e){}})();</script>`;
// Example answers only when this phone has none yet, so her own taps are never overwritten.
// The demo's answers are moved so its last evening is yesterday: tonight is always open.
// Two buttons swap between the demo and a door user on day 1 (Aurora step 2 review).
const seedJs = `<script>(function(){
var T=${JSON.stringify(JSON.stringify(seed.T))},E=${JSON.stringify(JSON.stringify(seed.E))},NT=${JSON.stringify(JSON.stringify(seed.NT))},DOOR=${JSON.stringify(JSON.stringify(seed.door))};
function iso(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function today(){var d=new Date();return new Date(d.getFullYear(),d.getMonth(),d.getDate());}
function keep(){var k={},n=["memap_language","memap_language_chosen","memap_theme","memap_settings"];n.forEach(function(x){var v=localStorage.getItem(x);if(v!==null)k[x]=v;});return k;}
function base(k){localStorage.clear();for(var x in k)localStorage.setItem(x,k[x]);localStorage.setItem("memap_ui","new");localStorage.setItem("memap_tour_seen","true");}
window.__memapDemo=function(){var k=keep();base(k);var es=JSON.parse(E),max="";es.forEach(function(e){if(e.date>max)max=e.date;});var m=max.split("-");var last=new Date(+m[0],+m[1]-1,+m[2]);var y=today();y.setDate(y.getDate()-1);var shift=Math.round((y-last)/864e5);es.forEach(function(e){var p=e.date.split("-");var d=new Date(+p[0],+p[1]-1,+p[2]);d.setDate(d.getDate()+shift);e.date=iso(d);});localStorage.setItem("memap_trackers",T);localStorage.setItem("memap_entries",JSON.stringify(es));var first=es.reduce(function(m,e){return !m||e.date<m?e.date:m;},"");localStorage.setItem("memap_path_start",first);localStorage.setItem("memap_preview_mode","demo");};
// a new user from zero: nothing saved, the onboarding plays (Nov 5 2026, onboarding v2)
window.__memapNew=function(){var k=keep();localStorage.clear();for(var x in k)if(x!=="memap_language_chosen")localStorage.setItem(x,k[x]);localStorage.setItem("memap_ui","new");localStorage.setItem("memap_preview_mode","new");};
try{if(!localStorage.getItem("memap_trackers")&&localStorage.getItem("memap_preview_mode")!=="new")window.__memapDemo();}catch(e){}
document.addEventListener("DOMContentLoaded",function(){try{if(sessionStorage.getItem("memap_preview_world")){sessionStorage.removeItem("memap_preview_world");setTimeout(function(){window.dispatchEvent(new CustomEvent("memap-switch-tab",{detail:{tab:"patterns"}}));},1800);}}catch(e){}var b=document.createElement("button");var isNew=localStorage.getItem("memap_preview_mode")==="new";b.textContent=isNew?"Back to the demo":"Start as a new user";b.setAttribute("style","position:fixed;left:12px;bottom:calc(104px + env(safe-area-inset-bottom,0px));z-index:60;height:28px;padding:0 10px;border-radius:14px;border:1px solid rgba(16,42,56,.10);background:rgba(255,255,255,.7);color:#4a6170;font:600 12px system-ui,sans-serif");b.onclick=function(){try{isNew?window.__memapDemo():window.__memapNew();}catch(e){}var bs=document.querySelector("base");if(bs&&bs.href)location.replace(bs.href);else location.reload();};document.body.appendChild(b);if(!isNew){var f=document.createElement("button");f.textContent="Show first link";f.setAttribute("style",b.getAttribute("style").replace("left:12px","left:150px"));f.onclick=function(){try{localStorage.setItem("memap_links_known","0");localStorage.removeItem("memap_first_link_seen");}catch(e){}var bs=document.querySelector("base");if(bs&&bs.href)location.replace(bs.href);else location.reload();};document.body.appendChild(f);setInterval(function(){f.style.display=b.style.display;},500);var g=document.createElement("button");g.textContent="Show link lights";g.setAttribute("style",b.getAttribute("style").replace("bottom:calc(104px","bottom:calc(140px"));g.onclick=function(){try{localStorage.setItem("memap_links_lit","[]");localStorage.setItem("memap_first_link_seen","before");sessionStorage.setItem("memap_preview_world","1");}catch(e){}var bs=document.querySelector("base");if(bs&&bs.href)location.replace(bs.href);else location.reload();};document.body.appendChild(g);setInterval(function(){g.style.display=b.style.display;},500);}setInterval(function(){var m=document.querySelector("main");var on=!!document.querySelector("[data-path-stop]")&&!document.querySelector("[aria-modal]")&&!document.querySelector("[role=dialog]")&&(!m||m.scrollTop<40);b.style.display=on?"block":"none";},500);});
})();</script>`;
fs.writeFileSync(`${O}/memap-preview.html`, base + "\n" + seedJs + "\n" + html.trim() + "\n");
const files = {};
const walk = (d, rel = "") => { for (const f of fs.readdirSync(d)) { const full = `${d}/${f}`, r = rel ? `${rel}/${f}` : f; if (fs.statSync(full).isDirectory()) walk(full, r); else if (!/^(index\.html|memap-preview\.html|_screenshot-preview\.html)$/.test(r)) files[r] = r; } };
walk(O);
fs.writeFileSync(`${S}/phone-preview-one-files.json`, JSON.stringify(files, null, 1));
console.log("trackers", seed.T.length, "entries", seed.E.length, "files", Object.keys(files).length, "page KB", Math.round(fs.statSync(`${O}/memap-preview.html`).size / 1024));
