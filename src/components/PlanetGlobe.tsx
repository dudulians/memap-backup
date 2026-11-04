// The globe, new look (Nov 4 2026). Her painted planet (made in ChatGPT, day
// and night) wrapped on a ball by a small WebGL shader; her island pack v2 on
// a ring around the boat in the middle; links drawn as a boat's soft wake;
// her painted sky behind. Tried first as a live demo (marketing/tools/
// globe-demo), her notes from it:
// - north stays up and the tilt stays low, so a sideways drag slides the
//   islands sideways ("острова болтаются по-дурацки" when it swung round the pole);
// - a link is one soft wavy trail, thin at both islands, never a straight line,
//   never side ripples ("как сколопендра");
// - the islands stand on open sea, her painted lands show around and below;
// - calm motion: drag 1:1, a short glide, no spinning on its own.
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CloudLightning, CloudSun, Plus, Sun } from "lucide-react";
import { Island, IslandId, Route, islandName, isNightMap, mapPic } from "@/lib/islands";
import { haptics } from "@/lib/haptics";
import { playBloop } from "@/lib/feedback";
import planetDay from "@/assets/globe/planet-day.webp";
import planetNight from "@/assets/globe/planet-night.webp";
import skyDay from "@/assets/globe/sky-day.webp";
import skyNight from "@/assets/globe/sky-night.webp";

import { ASPECT, art, artOf, ringOrder, wakeShape } from "@/lib/globeArt";

const D2R = Math.PI / 180;
type V3 = [number, number, number];
const vec = ([lat, lon]: [number, number]): V3 => { const p = lat * D2R, l = lon * D2R; return [Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l)]; };
const dest = ([lat, lon]: [number, number], bearing: number, dist: number): [number, number] => {
  const p1 = lat * D2R, l1 = lon * D2R, t = bearing * D2R, d = dist * D2R;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(t));
  const l2 = l1 + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [p2 / D2R, l2 / D2R];
};
const slerp = (a: V3, b: V3, t: number): V3 => {
  const d = Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])), s = Math.sin(d) || 1;
  const k1 = Math.sin((1 - t) * d) / s, k2 = Math.sin(t * d) / s;
  return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
};

/** The open sea of her planet where the ring of islands lives. */
const C0: [number, number] = [22, -10];
const UNEXPLORED: { ll: [number, number]; name: string }[] = [
  { ll: [16, -88], name: "cloud_island_03" }, { ll: [-12, 96], name: "cloud_island_01" }, { ll: [30, 152], name: "cloud_island_05" },
];
// Soft clouds that sit on the planet off the ring and turn with it.
const SKY: { ll: [number, number]; name: string }[] = [
  [4, 48, "cloud_04_large"], [46, 40, "cloud_01_large"], [-20, -60, "cloud_06_large"], [56, -66, "cloud_02_large"],
  [-26, 118, "cloud_05_large"], [26, 168, "cloud_03_large"], [6, -150, "cloud_07_large"],
].map(([lat, lon, name]) => ({ ll: [lat as number, lon as number], name: name as string }));
const PITCH_MIN = -0.25, PITCH_MAX = 0.62;
/** How the ball is turned: kept for the whole visit (tabs, day/night). */
let VIEW: { yaw: number; pitch: number } | null = null;

type Kind = "area" | "cloud" | "sky" | "boat";
interface Thing { key: string; kind: Kind; ll: [number, number]; v: V3; name: string; size: number; ar: number; island?: Island; lit?: boolean }

// her picture → a 2:1 texture whose left and right edges are blended into one another
const TW = 2048, TH = 1024;
const toTexture = (img: HTMLImageElement) => {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  let sw = iw, sh = iw / 2, sy = (ih - sh) / 2;
  if (sh > ih) { sh = ih; sw = ih * 2; sy = 0; }
  const sx = (iw - sw) / 2, b = Math.round(sw * 0.07);
  const mid = document.createElement("canvas"); mid.width = Math.round(sw - b); mid.height = Math.round(sh);
  const m = mid.getContext("2d")!;
  m.drawImage(img, sx, sy, sw - b, sh, 0, 0, sw - b, sh);
  const strip = document.createElement("canvas"); strip.width = b; strip.height = Math.round(sh);
  const st = strip.getContext("2d")!;
  st.drawImage(img, sx + sw - b, sy, b, sh, 0, 0, b, sh);
  st.globalCompositeOperation = "destination-in";
  const fade = st.createLinearGradient(0, 0, b, 0); fade.addColorStop(0, "rgba(0,0,0,1)"); fade.addColorStop(1, "rgba(0,0,0,0)");
  st.fillStyle = fade; st.fillRect(0, 0, b, sh);
  m.drawImage(strip, 0, 0);
  const out = document.createElement("canvas"); out.width = TW; out.height = TH;
  out.getContext("2d")!.drawImage(mid, 0, 0, TW, TH);
  return out;
};
const TEXTURES = new Map<string, HTMLCanvasElement>();

const VS = "attribute vec2 p; varying vec2 v; void main(){ v = p; gl_Position = vec4(p, 0.0, 1.0); }";
// The ball drawn per pixel: her picture, one light from the top left, a light rim and an atmosphere.
const FS = `precision highp float;
varying vec2 v;
uniform vec2 uRes; uniform vec3 uBall; uniform float uYaw; uniform float uPitch; uniform float uNight; uniform float uPx;
uniform sampler2D uTex;
const float PI = 3.14159265;
void main(){
  vec2 frag = vec2((v.x * 0.5 + 0.5) * uRes.x, (0.5 - v.y * 0.5) * uRes.y);
  vec2 q = (frag - uBall.xy) / uBall.z; q.y = -q.y;
  float d = length(q);
  vec3 glow = mix(vec3(0.86, 0.93, 1.0), vec3(0.42, 0.58, 0.98), uNight);
  float aa = 1.6 * uPx / uBall.z;
  float outer = pow(clamp((1.14 - d) / 0.14, 0.0, 1.0), 1.7) * mix(0.8, 0.5, uNight);
  if (d > 1.0) { gl_FragColor = vec4(glow * outer, outer); return; }
  float z = sqrt(max(0.0, 1.0 - d * d));
  vec3 n = vec3(q, z);
  float cp = cos(uPitch), sp = sin(uPitch), cy = cos(uYaw), sy = sin(uYaw);
  float y0 = n.y * cp + n.z * sp;
  float z1 = -n.y * sp + n.z * cp;
  float x0 = n.x * cy - z1 * sy;
  float z0 = n.x * sy + z1 * cy;
  vec2 uv = vec2(atan(x0, z0) / (2.0 * PI) + 0.5, 0.5 - asin(clamp(y0, -1.0, 1.0)) / PI);
  vec3 col = texture2D(uTex, uv).rgb;
  vec3 L = normalize(vec3(-0.35, 0.55, 0.78));
  float diff = max(dot(n, L), 0.0);
  col *= mix(0.72, 1.06, diff);
  float fr = pow(1.0 - z, 2.4);
  col = mix(col, mix(vec3(0.93, 0.97, 1.0), vec3(0.48, 0.66, 1.0), uNight), fr * mix(0.6, 0.5, uNight));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  col += pow(max(dot(n, H), 0.0), 42.0) * mix(0.16, 0.07, uNight);
  float a = 1.0 - smoothstep(1.0 - aa, 1.0, d);
  gl_FragColor = vec4(col * a + glow * outer * (1.0 - a), max(a, outer));
}`;

const WEATHER_ICON = { storm: CloudLightning, clouds: CloudSun, sun: Sun } as const;
const WEATHER_COLOR = { storm: "#7D8CC4", clouds: "#7D9CC8", sun: "#E8A93A" } as const;

export const PlanetGlobe = ({ islands, routes, avatar = null, lit, days = {}, paused = false, sky = true, onOpen, onNewIsland }: {
  islands: Island[]; routes: Route[]; avatar?: string | null;
  /** draw her sky here (false: the screen draws it behind its header) */
  sky?: boolean;
  /** islands whose rule (lighthouse) is lit */
  lit?: Set<IslandId>;
  /** evenings answered on each island: her own islands grow with them */
  days?: Record<string, number>;
  /** a sheet is open over the globe: nothing moves */
  paused?: boolean;
  onOpen: (id: IslandId) => void;
  onNewIsland?: () => void;
}) => {
  const { t } = useTranslation();
  const [night, setNight] = useState(isNightMap);
  useEffect(() => {
    const sync = () => setNight(isNightMap());
    window.addEventListener("memap-theme-changed", sync);
    return () => window.removeEventListener("memap-theme-changed", sync);
  }, []);
  const [hint, setHint] = useState(true);
  const [away, setAway] = useState(false);
  const [note, setNote] = useState(false);
  const [on, setOn] = useState<string | null>(null);

  // Her islands on a ring around the boat; linked pairs side by side, so their wake is short.
  const { things, wakes } = useMemo(() => {
    const { ordered, links } = ringOrder(islands, routes);
    const n = ordered.length, ring = n <= 6 ? 28 : 31, size = n <= 6 ? 1 : 0.86;
    const list: Thing[] = ordered.map((isl, i) => {
      const ll = dest(C0, (360 / Math.max(n, 1)) * i + (n === 1 ? 0 : 38), n === 1 ? 14 : ring);
      const name = artOf(isl.id, days[isl.id] ?? 0);
      return { key: isl.id, kind: "area", ll, v: vec(ll), name, size, ar: ASPECT[name] ?? 0.55, island: isl, lit: lit?.has(isl.id) };
    });
    for (const u of UNEXPLORED) list.push({ key: u.name, kind: "cloud", ll: u.ll, v: vec(u.ll), name: u.name, size: 0.85, ar: ASPECT[u.name] });
    for (const s of SKY) list.push({ key: `sky-${s.ll.join()}`, kind: "sky", ll: s.ll, v: vec(s.ll), name: s.name, size: 1.05, ar: ASPECT[s.name] });
    const boatLL: [number, number] = [C0[0] - 1, C0[1]];
    list.push({ key: "boat", kind: "boat", ll: boatLL, v: vec(boatLL), name: "sailboat", size: 0.72, ar: 1 });
    return { things: list, wakes: links };
  }, [islands, routes, lit, days]);

  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const wakeG = useRef<SVGGElement>(null);
  const els = useRef(new Map<string, { el: HTMLDivElement | null; lab: HTMLDivElement | null }>());
  const elOf = (key: string) => { let e = els.current.get(key); if (!e) { e = { el: null, lab: null }; els.current.set(key, e); } return e; };
  const kickRef = useRef<() => void>(() => undefined);
  const homeRef = useRef<() => void>(() => undefined);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  useEffect(() => { if (!paused) { setOn(null); kickRef.current(); } }, [paused]);

  useEffect(() => {
    const canvas = cv.current!, box = wrap.current!;
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = Object.fromEntries(["uRes", "uBall", "uYaw", "uPitch", "uNight", "uPx", "uTex"].map((k) => [k, gl.getUniformLocation(prog, k)]));
    const tex = gl.createTexture();
    let hasTex = false;
    const setTexture = (c: HTMLCanvasElement) => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      hasTex = true; dirty = true; kick();
    };
    let alive = true;
    const src = night ? planetNight : planetDay;
    const cached = TEXTURES.get(src);
    if (cached) setTexture(cached);
    else { const im = new Image(); im.onload = () => { if (!alive) return; const c = toTexture(im); TEXTURES.set(src, c); setTexture(c); }; im.src = src; }
    // the other one loads ahead, so day/night switches at once
    const other = night ? planetDay : planetNight;
    const ahead = window.setTimeout(() => { if (!TEXTURES.has(other)) { const im = new Image(); im.onload = () => TEXTURES.set(other, toTexture(im)); im.src = other; } }, 1500);

    let W = 0, H = 0, DPR = 1, R = 0, CX = 0, CY = 0;
    let yaw = VIEW?.yaw ?? -C0[1] * D2R, pitch = VIEW?.pitch ?? Math.max(0, C0[0] - 20) * D2R, vy = 0, vp = 0;
    let dirty = true, raf = 0, last = 0;
    let anim: { t0: number; dur: number; y0: number; y1: number; p0: number; p1: number; done?: () => void } | null = null;
    const resize = () => {
      const r = box.getBoundingClientRect(); W = r.width; H = r.height; DPR = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
      R = Math.min(W * 0.74, H * 0.37); CX = W / 2; CY = H * 0.585;
      gl.viewport(0, 0, canvas.width, canvas.height); dirty = true; kick();
    };
    const rot = ([x, y, z]: V3): V3 => {
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
      return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
    };
    const pos = new Map<string, { x: number; y: number; z: number; w: number; s: number }>();
    const draw = () => {
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      if (hasTex) {
        gl.uniform2f(U.uRes, canvas.width, canvas.height); gl.uniform3f(U.uBall, CX * DPR, CY * DPR, R * DPR);
        gl.uniform1f(U.uYaw, yaw); gl.uniform1f(U.uPitch, pitch); gl.uniform1f(U.uNight, night ? 1 : 0); gl.uniform1f(U.uPx, DPR); gl.uniform1i(U.uTex, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      const base = R * 0.35;
      for (const th of things) {
        const e = els.current.get(th.key); if (!e?.el) continue;
        const p = rot(th.v), vis = Math.max(0, Math.min(1, (p[2] - 0.04) / 0.24));
        if (vis <= 0) { e.el.style.opacity = "0"; if (e.lab) e.lab.style.opacity = "0"; pos.delete(th.key); continue; }
        const s = (0.5 + 0.5 * p[2]) * th.size, w = base * s, x = CX + R * p[0], y = CY - R * p[1];
        pos.set(th.key, { x, y, z: p[2], w, s });
        // an island stands on the ball: it leans out toward the edge it is near, the same way every frame
        const lean = Math.atan2(p[0], p[1] + 1.6) * 0.35;
        // where it meets the water, as a share of its height (the water halo is about 0.4 of the width tall)
        const an = th.kind === "sky" ? 0.5 : th.kind === "boat" ? 0.72 : Math.min(0.85, Math.max(0.5, 1 - 0.2 / th.ar));
        const full = base * th.size;
        e.el.style.width = `${full}px`;
        e.el.style.transformOrigin = `50% ${(an * 100).toFixed(1)}%`;
        e.el.style.transform = `translate(${(x - full / 2).toFixed(1)}px, ${(y - full * th.ar * an).toFixed(1)}px) rotate(${(lean * 57.3).toFixed(2)}deg) scale(${(s / th.size).toFixed(3)})`;
        e.el.style.opacity = String(th.kind === "sky" ? vis * 0.92 : vis);
        e.el.style.zIndex = String(Math.round(100 + p[2] * 100 + (th.kind === "sky" ? 120 : 0)));
        if (e.lab) {
          const off = w * th.ar * (1 - an) + 8;
          e.lab.style.transform = `translate(${(x - Math.sin(lean) * off).toFixed(1)}px, ${(y + Math.cos(lean) * off).toFixed(1)}px) scale(${Math.max(0.82, s).toFixed(3)})`;
          e.lab.style.opacity = String(vis); e.lab.style.zIndex = e.el.style.zIndex;
        }
      }
      // links: the wake a boat left between two islands
      let h = "";
      const delay = -Math.round(performance.now() % 2600);
      for (const [a, b] of wakes) {
        const A = things.find((x) => x.key === a)?.v, B = things.find((x) => x.key === b)?.v; if (!A || !B) continue;
        const N = 90, runs: { x: number; y: number; z: number; t: number }[][] = []; let run: { x: number; y: number; z: number; t: number }[] = [];
        for (let k = 0; k <= N; k++) {
          const tt = k / N, p = rot(slerp(A, B, tt));
          if (p[2] > 0.06) run.push({ x: CX + R * p[0], y: CY - R * p[1], z: p[2], t: tt }); else if (run.length) { runs.push(run); run = []; }
        }
        if (run.length) runs.push(run);
        for (const P of runs) {
          if (P.length < 3) continue;
          const w = wakeShape(P.map((q) => ({ x: q.x, y: q.y, t: q.t, k: 0.5 + 0.5 * q.z })));
          h += `<path d="${w.glow}" class="planet-wake-glow" filter="url(#planet-wb)"/><path d="${w.core}" class="planet-wake-core" filter="url(#planet-ws)"/>`;
          h += `<path class="planet-shimmer" style="animation-delay:${delay}ms" d="${w.mid}" stroke-width="2.4" stroke-dasharray="0.1 22" fill="none" stroke-linecap="round"/>`;
        }
      }
      if (wakeG.current) wakeG.current.innerHTML = h;
      // far from home: offer the way back
      const far = rot(vec(C0))[2] < 0.82;
      if (far !== wasFar) { wasFar = far; setAway(far); }
    };
    let wasFar = false;
    const FRICTION = 0.88; // per 16.7 ms: the glide stops in about 0.7 s
    const frame = (tm: number) => {
      raf = 0; const dt = last ? Math.min(48, tm - last) : 16.7; last = tm;
      let moving = false;
      if (anim) {
        const k = Math.min(1, (tm - anim.t0) / anim.dur), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        yaw = anim.y0 + (anim.y1 - anim.y0) * e; pitch = anim.p0 + (anim.p1 - anim.p0) * e; moving = k < 1;
        if (!moving) { const done = anim.done; anim = null; done?.(); }
        dirty = true;
      } else if (!dragging && (Math.abs(vy) > 1e-5 || Math.abs(vp) > 1e-5)) {
        yaw += vy * dt; pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch + vp * dt));
        const f = Math.pow(FRICTION, dt / 16.7); vy *= f; vp *= f; if (Math.abs(vy) < 2e-5) vy = 0; if (Math.abs(vp) < 2e-5) vp = 0;
        moving = true; dirty = true;
      }
      if (dirty) { draw(); dirty = false; VIEW = { yaw, pitch }; }
      if (moving && !pausedRef.current) kick(); else last = 0;
    };
    const kick = () => { if (!raf && alive) raf = requestAnimationFrame(frame); };
    kickRef.current = () => { dirty = true; kick(); };

    const turnTo = (ll: [number, number], done?: () => void) => {
      let y1 = -ll[1] * D2R; while (y1 - yaw > Math.PI) y1 -= 2 * Math.PI; while (yaw - y1 > Math.PI) y1 += 2 * Math.PI;
      const p1 = Math.max(PITCH_MIN, Math.min(PITCH_MAX, (ll[0] - 6) * D2R));
      if (reduce) { yaw = y1; pitch = p1; dirty = true; kick(); done?.(); return; }
      anim = { t0: performance.now(), dur: 620, y0: yaw, y1, p0: pitch, p1, done }; kick();
    };
    homeRef.current = () => { haptics.tap(); turnTo([C0[0] + 20, C0[1]]); };

    // touch: drag 1:1, a short glide, tap
    let dragging = false, sx = 0, sy = 0, lx = 0, ly = 0, lt = 0, moved = 0, pid: number | null = null;
    const onDown = (ev: PointerEvent) => {
      // the buttons over the globe answer by themselves
      if (pid !== null || pausedRef.current || (ev.target as HTMLElement).closest("button")) return;
      pid = ev.pointerId; try { box.setPointerCapture(pid); } catch { /* synthetic events */ }
      dragging = true; anim = null; vy = vp = 0; setNote(false);
      sx = lx = ev.clientX; sy = ly = ev.clientY; lt = performance.now(); moved = 0;
    };
    const onMove = (ev: PointerEvent) => {
      if (!dragging || ev.pointerId !== pid) return;
      const dx = ev.clientX - lx, dy = ev.clientY - ly, now = performance.now(), dt = Math.max(1, now - lt);
      lx = ev.clientX; ly = ev.clientY; lt = now; moved = Math.max(moved, Math.hypot(ev.clientX - sx, ev.clientY - sy));
      yaw += dx / R; pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch + dy / R));
      const k = 0.35; vy = vy * (1 - k) + (dx / R / dt) * k; vp = vp * (1 - k) + (dy / R / dt) * k;
      if (moved > 8) setHint(false);
      dirty = true; kick();
    };
    const tap = (cx: number, cy: number) => {
      const r = box.getBoundingClientRect(), x = cx - r.left, y = cy - r.top;
      let hit: Thing | null = null, hz = -1;
      for (const th of things) {
        if (th.kind === "sky") continue;
        const q = pos.get(th.key); if (!q || q.z < 0.15) continue;
        const h = q.w * th.ar;
        if (Math.abs(x - q.x) < q.w * 0.55 && y > q.y - h * 0.9 && y < q.y + h * 0.4 + (th.kind === "area" ? 30 : 0) && q.z > hz) { hit = th; hz = q.z; }
      }
      if (!hit) return;
      haptics.tap();
      if (hit.kind === "boat") { window.dispatchEvent(new CustomEvent("memap-open-you")); return; }
      if (hit.kind === "cloud") { turnTo(hit.ll, () => setNote(true)); return; }
      playBloop(Math.min(1, Math.max(0, x / W)));
      const id = hit.island!.id;
      setOn(id);
      turnTo(hit.ll, () => onOpenRef.current(id));
    };
    const onUp = (ev: PointerEvent) => {
      if (!dragging || ev.pointerId !== pid) return;
      dragging = false; pid = null;
      if (moved < 8) { vy = vp = 0; tap(ev.clientX, ev.clientY); return; }
      if (performance.now() - lt > 80 || reduce) vy = vp = 0;
      const cap = 0.004; vy = Math.max(-cap, Math.min(cap, vy)); vp = Math.max(-cap, Math.min(cap, vp));
      kick();
    };
    const onCancel = (ev: PointerEvent) => { if (ev.pointerId !== pid) return; dragging = false; pid = null; vy = vp = 0; };
    box.addEventListener("pointerdown", onDown); box.addEventListener("pointermove", onMove);
    box.addEventListener("pointerup", onUp); box.addEventListener("pointercancel", onCancel);
    const ro = new ResizeObserver(resize); ro.observe(box);
    resize();
    // for the tests in development: where an island is drawn, how the ball is turned
    if (import.meta.env.DEV) (window as unknown as { __planet?: unknown }).__planet = {
      at: (id: string) => pos.get(id) ?? null,
      state: () => ({ yaw, pitch }),
    };
    return () => {
      alive = false; cancelAnimationFrame(raf); window.clearTimeout(ahead); ro.disconnect();
      box.removeEventListener("pointerdown", onDown); box.removeEventListener("pointermove", onMove);
      box.removeEventListener("pointerup", onUp); box.removeEventListener("pointercancel", onCancel);
      kickRef.current = () => undefined;
    };
  }, [things, wakes, night]);

  return (
    <div ref={wrap} className="planet-wrap" aria-label={t("map.aria")}>
      {sky && <div className={`planet-sky ${night ? "night" : "day"}`} style={{ backgroundImage: `url(${night ? skyNight : skyDay})` }} />}
      <canvas ref={cv} className="planet-canvas" />
      <svg className="planet-wakes" aria-hidden="true">
        <defs>
          <filter id="planet-wb" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.2" /></filter>
          <filter id="planet-ws"><feGaussianBlur stdDeviation="0.5" /></filter>
        </defs>
        <g ref={wakeG} />
      </svg>
      <div className="planet-things">
        {things.map((th) => {
          const W = th.island?.weather ? WEATHER_ICON[th.island.weather] : null;
          return (
            <div key={th.key}>
              <div ref={(el) => { elOf(th.key).el = el; }} className={`planet-isle ${th.kind === "boat" ? "planet-boat" : ""} ${th.kind === "sky" ? "planet-cloud" : ""} ${on === th.key ? "on" : ""}`} style={{ opacity: 0 }}>
                {th.kind === "area" && <div className="ring" />}
                {th.kind === "boat" ? (
                  <div className="bob"><img src={mapPic("sailboat")} alt="" />{avatar && <img className="otter" src={avatar} alt="" />}</div>
                ) : (
                  <img src={art(th.name, night)} alt="" />
                )}
                {th.lit && <img className="lighthouse" src={mapPic("lighthouse")} alt="" />}
              </div>
              {th.island && (
                <div ref={(el) => { elOf(th.key).lab = el; }} className="planet-label" style={{ opacity: 0 }}>
                  <span>{W && <W className="h-4 w-4" strokeWidth={2.4} style={{ color: WEATHER_COLOR[th.island.weather!] }} />}{islandName(t, th.island.id)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {hint && <div className="planet-hint">{t("map.hint")}</div>}
      <button type="button" onClick={() => homeRef.current()} aria-label={t("map.backToMe")}
        className={`absolute right-4 z-[5] flex h-12 items-center gap-2 rounded-full bg-white pl-2 pr-4 text-[15px] font-extrabold text-primary shadow-lg transition-all duration-200 dark:bg-[hsl(var(--surface))] ${away ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`}
        style={{ bottom: "calc(7.5rem + env(safe-area-inset-bottom, 0px))" }}>
        <img src={mapPic("sailboat")} alt="" className="h-8 w-8 rounded-full bg-sky-50 object-contain p-0.5 ring-2 ring-primary" />{t("map.backToMe")}
      </button>
      {note && (
        <div className="absolute left-4 right-4 z-[5] flex items-center gap-3 rounded-[22px] bg-white/95 p-3.5 shadow-lg dark:bg-[hsl(var(--surface))]" style={{ bottom: "calc(7.5rem + env(safe-area-inset-bottom, 0px))" }}>
          <img src={art("cloud_island_03", night)} alt="" className="h-11 w-16 shrink-0 object-contain" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold uppercase tracking-wider text-primary">{t("map.unexploredLabel")}</p>
            <p className="text-[15px] font-semibold leading-snug text-muted-foreground">{t("map.unexplored")}</p>
            {onNewIsland && (
              <button type="button" onClick={() => { haptics.tap(); setNote(false); onNewIsland(); }}
                className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-full bg-[hsl(var(--coin-teal))] px-4 text-[15px] font-bold text-white">
                <Plus className="h-4 w-4" strokeWidth={2.6} /> {t("islands.new")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
