// Onboarding v2, the screens (Nov 5 2026). Her direction: no "hard days" as the hook;
// one line for both sides — "What comes before your best days — and your hardest?";
// then a fork: "Something keeps happening" or "I want more good days"; a short list;
// a promise in her own words with her first island rising from a cloud (WORLD-BIBLE #9);
// after the first answer: "in about 10 days you'll see what goes together; your world
// helps you steer each day toward the best ones". Spliced into make-onboarding-v2.mjs.
export const screens = ({ page, isle, boat, disc, cur, lab, tile, icon, tabbar, head, HUE, TEAL, ISL, ANI }) => {
  const S = {};
  const tick = `<span class="tick">${icon("check", { size: 16, sw: 3.2, color: "#fff" })}</span>`;
  const back = `<span class="back">${icon("arrow-left", { size: 22 })}</span>`;
  const dots = (k, n = 5) => `<div class="dots">${k > 0 ? back : ""}${Array.from({ length: n }, (_, i) => `<i class="${i === k ? "on" : ""}"></i>`).join("")}</div>`;
  const list = (rows) => rows.map(([ic, t, h, on]) => `<div class="card row${on ? " on" : ""}">${tile(ic, h)}${t}${on ? tick : ""}</div>`).join("");

  // 1. one line for both sides
  S["v1-welcome"] = page(`
    <div class="seg"><span class="on">EN</span><span>RU</span></div>
    ${isle(92, 330, 150, "11_sakura")}${isle(300, 300, 130, "09_waterfall")}${isle(268, 470, 120, "17_lavender_garden")}
    ${boat(118, 360, 150)}
    <div class="screen" style="padding-top:0">
      <div class="grow"></div>
      <h1 class="c" style="font-size:32px">What comes before<br>your best days —<br>and your hardest?</h1>
      <p class="sub c">A minute each evening</p>
      <div style="height:30px"></div>
      <div class="btn">Start ${icon("arrow-right", { size: 20, sw: 2.6 })}</div>
      <div class="link">I already have MeMap</div>
    </div>`);

  // 2. the fork: two big cards, nothing to read
  const fork = (on) => `
    <div class="card fork${on === 0 ? " on" : ""}">${tile("repeat", HUE.coral)}<span>Something keeps<br>happening</span>${on === 0 ? tick : ""}</div>
    <div class="card fork${on === 1 ? " on" : ""}" style="margin-top:14px">${tile("sun", HUE.amber)}<span>I want more<br>good days</span>${on === 1 ? tick : ""}</div>`;
  S["v2-fork"] = page(`<div class="screen">
    ${dots(0)}
    <h1 style="margin-top:10px">What would you<br>like to look at?</h1>
    <div style="margin-top:26px">${fork(0)}</div>
    <div class="grow"></div>
    <div class="link" style="margin-bottom:4px">Just looking around</div>
    <div class="btn">Continue</div></div>`);
  S["v2b-fork-good"] = page(`<div class="screen">
    ${dots(0)}
    <h1 style="margin-top:10px">What would you<br>like to look at?</h1>
    <div style="margin-top:26px">${fork(1)}</div>
    <div class="grow"></div>
    <div class="link" style="margin-bottom:4px">Just looking around</div>
    <div class="btn">Continue</div></div>`);

  // 3a. what keeps happening (the doors; "My sleep" is a new door)
  S["v3-pain"] = page(`<div class="screen">
    ${dots(1)}
    <h1 style="margin-top:10px">What keeps<br>happening?</h1>
    <div style="margin-top:18px">${list([["heart", "Fights with my partner", HUE.love], ["activity", "Migraines", HUE.health, 1], ["wine", "Drinking", HUE.amber], ["moon", "Bad nights", HUE.sleep], ["smile", "Snapping at my kid", HUE.coral], ["cloud", "Low mood", HUE.lilac]])}</div>
    <div class="dash" style="margin-top:12px">Something else</div>
    <div class="grow"></div>
    <div class="btn">Continue</div></div>`);
  // 3b. what she wants more of
  S["v3b-good"] = page(`<div class="screen">
    ${dots(1)}
    <h1 style="margin-top:10px">What do you want<br>more of?</h1>
    <div style="margin-top:18px">${list([["zap", "Energy", HUE.amber, 1], ["leaf", "Calm", HUE.health], ["moon", "Good sleep", HUE.sleep], ["heart", "Closeness", HUE.love], ["target", "Focus", HUE.work], ["footprints", "Movement", HUE.coral], ["smile", "Joy", HUE.lilac]])}</div>
    <div class="grow"></div>
    <div class="btn">Continue</div></div>`);

  // 4. the promise in her words; her first island rises from a cloud
  const promise = (line, island, label, k) => page(`<div class="screen">
    ${dots(2)}</div>
    ${isle(195, 360, 230, "cloud_island_03")}
    <div style="position:absolute;left:0;right:0;top:250px;display:flex;justify-content:center"><img src="${ISL(island)}" style="width:210px;filter:drop-shadow(0 8px 10px rgba(20,60,100,.28))"></div>
    <div style="position:absolute;left:0;right:0;top:395px;display:flex;justify-content:center"><span class="lab" style="position:static;transform:none;height:34px;font-size:16px;padding:0 14px">${label}</span></div>
    <div class="screen" style="padding-top:0"><div class="grow"></div>
      <h1 class="c" style="font-size:32px">${line}</h1>
      <p class="sub c">Your first island. It grows as you answer.</p>
      <div style="height:28px"></div>
      <div class="btn">Let's look ${icon("arrow-right", { size: 20, sw: 2.6 })}</div>
      <div style="height:${k ? 0 : 0}px"></div>
    </div>`);
  S["v4-promise"] = promise("What comes before<br>your migraines?", "03_flower_hill", `${icon("heart-pulse", { size: 16, color: `hsl(${HUE.health})` })}Health`, 0);
  S["v4b-promise-good"] = promise("What comes before<br>your best days?", "03_flower_hill", `${icon("flower-2", { size: 16, color: `hsl(${HUE.me})` })}Me`, 1);

  // 5. the first answer: two taps
  const chips = (all, on) => `<div class="chips" style="margin-top:12px">${all.map((c) => `<span class="chip${on.includes(c) ? " on" : ""}">${c}</span>`).join("")}</div>`;
  S["v5-first"] = page(`<div class="screen">
    ${dots(3)}
    <h1 style="margin-top:10px">When was the<br>last migraine?</h1>
    <div class="grid2" style="margin-top:18px">
      <div class="card big">Today</div><div class="card big on">Yesterday</div><div class="card big">This week</div><div class="card big">A while ago</div>
    </div>
    <p style="margin-top:28px;font-size:22px;font-weight:800">What came before?</p>
    ${chips(["Little sleep", "Stress", "Screens", "Skipped a meal", "Alcohol", "Weather", "Period", "Don't know"], ["Little sleep", "Stress"])}
    <div class="grow"></div>
    <div class="btn">Next</div></div>`);
  S["v5b-first-good"] = page(`<div class="screen">
    ${dots(3)}
    <h1 style="margin-top:10px">When did you last<br>have a lot of energy?</h1>
    <div class="grid2" style="margin-top:18px">
      <div class="card big on">Today</div><div class="card big">Yesterday</div><div class="card big">This week</div><div class="card big">A while ago</div>
    </div>
    <p style="margin-top:28px;font-size:22px;font-weight:800">What helped?</p>
    ${chips(["Slept well", "Moved", "Outside", "Ate well", "Good people", "Rest", "Sun", "Don't know"], ["Slept well", "Outside"])}
    <div class="grow"></div>
    <div class="btn">Next</div></div>`);

  // 6. the first swipe = the first lesson (as before)
  S["v6-swipe"] = page(`<div class="screen">
    ${dots(4)}
    <h1 style="margin-top:10px">What else was<br>that day?</h1></div>
    <div class="swipe" style="top:262px;height:380px;transform:scale(.9) translateY(30px);opacity:.6"></div>
    <div class="swipe" style="top:262px;height:380px;transform:scale(.95) translateY(15px);opacity:.85"></div>
    <div class="swipe" style="top:262px;height:380px;transform:rotate(-3deg)">
      <div style="padding:20px 22px;font-size:15px;font-weight:700;color:#4E6177">1 of 3</div>
      <div style="display:flex;justify-content:center;margin-top:4px"><img src="${ISL("03_flower_hill")}" style="width:180px;filter:drop-shadow(0 6px 8px rgba(20,60,100,.25))"></div>
      <p style="position:absolute;left:22px;right:22px;bottom:28px;font-size:30px;font-weight:800;line-height:1.15">Did you sleep OK the night before?</p>
    </div>
    <div style="position:absolute;left:214px;top:398px;display:flex;flex-direction:column;align-items:center;gap:6px">
      <span style="width:64px;height:64px;border-radius:32px;background:rgba(255,255,255,.9);display:flex;align-items:center;justify-content:center;box-shadow:0 10px 20px -10px rgba(20,40,80,.5)">${icon("pointer", { size: 34, sw: 2, color: "#1E2F3A" })}</span>
      <span class="lab" style="position:static;transform:none">Swipe right = Yes</span>
    </div>
    <div style="position:absolute;left:22px;right:22px;top:676px;display:flex;gap:12px">
      <div class="card big" style="flex:1;color:#4E6177">${icon("arrow-left", { size: 20 })}&nbsp;No</div><div class="card big" style="flex:1;color:#4E6177">Yes&nbsp;${icon("arrow-right", { size: 20 })}</div>
    </div>
    <div class="link" style="position:absolute;left:0;right:0;top:752px">Not sure</div>`);

  // 7. the first light: what's next, honestly (10 evenings for a first link), and the reminder
  S["v7-firstlight"] = page(`<div class="screen">
    <h1 class="c" style="margin-top:28px">Your first light<br>is lit</h1>
    </div>
    ${disc(195, 222, 38, "done", icon("check", { size: 32, sw: 3.2 }))}${lab(195, 274, "Today")}
    ${disc(250, 330, 26, "lock", icon("moon-star", { size: 20 }))}${lab(250, 366, "Tomorrow", true)}
    <div style="position:absolute;left:184px;top:396px;display:flex;flex-direction:column;gap:7px">${"<i style='width:8px;height:8px;border-radius:4px;background:rgba(30,47,58,.25);display:block'></i>".repeat(3)}</div>
    ${disc(150, 450, 30, "lock", icon("link-2", { size: 24 }), "background:#fff;box-shadow:0 6px 0 #D3DAE8;color:hsl(232 62% 62%);")}${lab(150, 490, "Day 10 · first links", true)}
    <div class="screen" style="padding-top:0">
      <div class="grow"></div>
      <p class="c" style="font-size:19px;font-weight:700;line-height:1.35;margin-bottom:18px">In about 10 days you'll see<br>what goes together.<br><span style="color:#4E6177;font-weight:600">Your world helps you steer each day<br>toward the best ones.</span></p>
      <div class="card row" style="height:58px;margin-bottom:14px">${icon("bell", { size: 22, color: `hsl(${TEAL})` })}<span style="font-size:17px">Remind me at 20:00</span><span class="toggle"></span></div>
      <div class="btn">Next</div>
    </div>`);

  // 8. who sails with you (as before)
  const animals = ["01_malu", "11_otter", "02_cat", "08_fox", "05_panda", "04_rabbit", "09_koala", "07_penguin", "29_red_panda"];
  S["v8-companion"] = page(`<div class="screen">
    <h1 class="c" style="margin-top:20px">Who sails with you?</h1></div>
    ${boat(120, 150, 150)}
    <div style="position:absolute;left:30px;right:30px;top:330px;display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
      ${animals.map((a) => `<div class="card" style="height:96px;display:flex;align-items:center;justify-content:center;${a === "11_otter" ? `box-shadow:0 0 0 3px hsl(${TEAL}),0 10px 24px -18px rgba(30,50,110,.6)` : ""}"><img src="${ANI(a)}" style="width:72px"></div>`).join("")}
    </div>
    <div class="screen" style="padding-top:0"><div class="grow"></div>
      <div class="link" style="margin-bottom:4px">More animals · No one</div>
      <div class="btn">Set sail ${icon("arrow-right", { size: 20, sw: 2.6 })}</div></div>`);

  // 9. Today: one hint, on Start
  S["v9-today"] = page(`
    ${head("Week 1 · 1/7")}
    <p class="wk" style="position:absolute;left:0;right:0;top:112px">WEEK 1 · COLLECT CLUES</p>
    ${disc(150, 180, 30, "done", icon("check", { size: 26, sw: 3.2 }))}${lab(150, 224, "First answer")}
    ${cur(225, 370, 44, HUE.health, icon("heart-pulse", { size: 38 }))}${lab(225, 438, "Health")}
    <span class="startb" style="left:225px;top:302px">Start</span>
    ${boat(92, 330, 58)}
    ${disc(265, 530, 34, "todo", icon("pen-line", { size: 26, color: "hsl(350 60% 66%)" }))}${lab(265, 578, "Write a note")}
    ${disc(195, 660, 34, "todo", icon("lightbulb", { size: 26, color: "hsl(262 40% 64%)" }))}
    <div class="coachdim" style="background:radial-gradient(circle at 225px 345px, transparent 0 98px, rgba(14,24,60,.42) 100px)"></div>
    <div class="card coach" style="top:478px"><span class="tail" style="left:196px;top:-8px"></span>
      <p class="t">Tap Start</p><p class="s">4 questions · 1 minute</p><div class="ok">Got it</div></div>
    ${tabbar(0)}`);
  return S;
};
