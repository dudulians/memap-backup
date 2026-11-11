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
import { CloudLightning, CloudSun, Link2, Minus, Plus, Sun } from "lucide-react";
import { Island, IslandId, Route, islandName, isNightMap, mapPic } from "@/lib/islands";
import { haptics } from "@/lib/haptics";
import { standAt, standsOn } from "@/lib/islandSpots";
import { playBloop } from "@/lib/feedback";
import { isPlayful } from "@/lib/playful";
import { toggleNight } from "@/lib/theme";
import planetDay from "@/assets/globe/planet-day.webp";
import planetNight from "@/assets/globe/planet-night.webp";
import skyDay from "@/assets/globe/sky-day.webp";
import skyNight from "@/assets/globe/sky-night.webp";

import { ASPECT, STAGE_SCALE, art, artOf, ringOrder, routeDots, stageOf } from "@/lib/globeArt";
import type { PlacedTreasure } from "@/lib/growth";

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
// The "unexplored" cloud islands are off (her phone test, Nov 7 2026: a blue cloud looked stuck on
// the land when the ball turned); a new island comes from the New island button.
const UNEXPLORED: { ll: [number, number]; name: string }[] = [];
// Soft clouds that sit on the planet off the ring and turn with it.
const SKY: { ll: [number, number]; name: string }[] = [
  [4, 48, "cloud_04_large"], [46, 40, "cloud_01_large"], [-20, -60, "cloud_06_large"], [56, -66, "cloud_02_large"],
  [-26, 118, "cloud_05_large"], [26, 168, "cloud_03_large"], [6, -150, "cloud_07_large"],
].map(([lat, lon, name]) => ({ ll: [lat as number, lon as number], name: name as string }));
const PITCH_MIN = -0.25, PITCH_MAX = 0.62;
// Pinch to zoom (her ask, Nov 4 2026: "зум ин зум аут"): from a little
// smaller than usual to well over twice as big.
const ZMIN = 0.75, ZMAX = 2.2;
/** How the ball is turned and zoomed: kept for the whole visit (tabs, day/night). */
let VIEW: { yaw: number; pitch: number; zoom: number; ox: number; oy: number } | null = null;

type Kind = "area" | "cloud" | "sky" | "boat";
interface Thing { key: string; kind: Kind; ll: [number, number]; v: V3; name: string; size: number; ar: number; island?: Island; lit?: boolean; flag?: boolean }

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

// Lights along her links (her "Да, добавляем", Nov 11 2026, from reel 16 «Целый мир»): a warm light runs along a
// new link's route, both islands switch on a small light, the link's sign comes at the end; at night the islands
// that have links keep their light. A light means "this is linked to this": only where a link is, never random.
const LIT_KEY = "memap_links_lit";
const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const readLit = (): Set<string> | null => { try { const s = localStorage.getItem(LIT_KEY); return s === null ? null : new Set(JSON.parse(s) as string[]); } catch { return null; } };
const addLit = (keys: string[]) => { try { const s = readLit() ?? new Set<string>(); keys.forEach((k) => s.add(k)); localStorage.setItem(LIT_KEY, JSON.stringify([...s])); } catch { /* runs again next time */ } };
/** The light along all her links, once a day when World opens: waits for her yes (Nov 11 2026). The event
 *  "memap-routes-light" plays it by hand. */
const DAILY_RUN: boolean = false;
/** how long the light takes along one route; how long the islands stay lit after it; how long night takes to come */
const RUN_MS = 1500, TAIL_MS = 2600, DAYNIGHT_MS = 1700;
const STAR = "M0 -14 Q1.6 -1.6 14 0 Q1.6 1.6 0 14 Q-1.6 1.6 -14 0 Q-1.6 -1.6 0 -14Z";
interface Light { key: string; from: string; to: string; t0: number; dur: number; fresh: boolean; litA?: boolean; litB?: boolean; gone?: boolean }

const VS = "attribute vec2 p; varying vec2 v; void main(){ v = p; gl_Position = vec4(p, 0.0, 1.0); }";
// The ball drawn per pixel: her picture, one light from the top left, a light rim and an atmosphere.
const FS = `precision highp float;
varying vec2 v;
uniform vec2 uRes; uniform vec3 uBall; uniform float uYaw; uniform float uPitch; uniform float uNight; uniform float uPx;
uniform sampler2D uTex; uniform sampler2D uTex2;
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
  // the day and the night picture mixed by uNight, so night comes softly (Nov 11 2026)
  vec3 col = mix(texture2D(uTex, uv).rgb, texture2D(uTex2, uv).rgb, uNight);
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

export const PlanetGlobe = ({ islands, routes, avatar = null, lit, days = {}, treasures, garden, paused = false, sky = true, main = null, inner, below = false, decor = false, quietHint = false, labels, onOpen, onNewIsland, onLink, onInner }: {
  islands: Island[]; routes: Route[]; avatar?: string | null;
  /** another tip is on screen: the "turn me" line waits (Nov 8 2026) */
  quietHint?: boolean;
  /** her topic's island: lit, a teal dot by its name (board 76 A) */
  main?: IslandId | null;
  /** a link inside one island: its sign k/n over the island (board 75) */
  inner?: Map<IslandId, Route>;
  onInner?: (r: Route) => void;
  /** the World's 4 parts stand over it: the ball sits in the room below them */
  below?: boolean;
  /** a picture of her world (the first screen): no buttons, no hint, it doesn't move */
  decor?: boolean;
  /** only these islands carry a name (the first screen: many islands, three names, no overlap) */
  labels?: IslandId[];
  /** draw her sky here (false: the screen draws it behind its header) */
  sky?: boolean;
  /** islands whose rule (lighthouse) is lit */
  lit?: Set<IslandId>;
  /** her treasures, each on its island (growth.ts placeTreasures) */
  treasures?: Map<IslandId, PlacedTreasure[]>;
  /** her garden: a tree for each finished test (growth.ts gardenTrees) */
  garden?: Map<IslandId, string[]>;
  /** evenings answered on each island: her own islands grow with them */
  days?: Record<string, number>;
  /** a sheet is open over the globe: nothing moves */
  paused?: boolean;
  onOpen: (id: IslandId) => void;
  onNewIsland?: () => void;
  /** a dotted route (or its sign) tapped: the link card */
  onLink?: (a: IslandId, b: IslandId) => void;
}) => {
  const { t } = useTranslation();
  const [night, setNight] = useState(isNightMap);
  useEffect(() => {
    const sync = () => setNight(isNightMap());
    window.addEventListener("memap-theme-changed", sync);
    return () => window.removeEventListener("memap-theme-changed", sync);
  }, []);
  // night comes and goes softly on the ball (the WebGL keeps running; dayNightRef fades it)
  const nightRef = useRef(night);
  nightRef.current = night;
  const dayNightRef = useRef<(toNight: boolean) => void>(() => undefined);
  // how much night there is now, and the change under way: kept outside the WebGL run, so a run made anew in the
  // middle of a change (her data reloads when the theme changes) carries it on instead of jumping
  const dn = useRef<{ v: number; anim: { from: number; to: number; t0: number } | null }>({ v: night ? 1 : 0, anim: null });
  useEffect(() => { dayNightRef.current(night); }, [night]);
  // the hint until she has turned the globe once (QA, Nov 8 2026: still shown after 59 days)
  const [hint, setHintState] = useState(() => { try { return localStorage.getItem("memap_globe_turned") !== "1"; } catch { return true; } });
  const setHint = (v: boolean) => { setHintState(v); if (!v) { try { localStorage.setItem("memap_globe_turned", "1"); } catch { /* shows again */ } } };
  const [away, setAway] = useState(false);
  const [note, setNote] = useState(false);
  const [on, setOn] = useState<string | null>(null);

  // Her islands on a ring around the boat; linked pairs side by side, so their wake is short.
  const { things, wakes } = useMemo(() => {
    const { ordered, links } = ringOrder(islands, routes);
    const n = ordered.length, ring = n <= 6 ? 28 : 31, size = n <= 6 ? 1 : 0.86;
    const list: Thing[] = ordered.map((isl, i) => {
      const ll = dest(C0, (360 / Math.max(n, 1)) * i + (n === 1 ? 0 : 38), n === 1 ? 14 : ring);
      const name = artOf(isl.id, days[isl.id] ?? 0), stage = stageOf(days[isl.id] ?? 0);
      return { key: isl.id, kind: "area", ll, v: vec(ll), name, size: size * STAGE_SCALE[stage], ar: ASPECT[name] ?? 0.55, island: isl, lit: lit?.has(isl.id), flag: stage === 4 };
    });
    for (const u of UNEXPLORED) list.push({ key: u.name, kind: "cloud", ll: u.ll, v: vec(u.ll), name: u.name, size: 0.85, ar: ASPECT[u.name] });
    const boatLL: [number, number] = [C0[0] - 1, C0[1]];
    list.push({ key: "boat", kind: "boat", ll: boatLL, v: vec(boatLL), name: "sailboat", size: 0.72, ar: 1 });
    return { things: list, wakes: links };
  }, [islands, routes, lit, days]);
  // islands with a link (between two islands or inside one): at night their small light stays on
  const linked = useMemo(() => new Set<string>([...wakes.flat(), ...(inner ? [...inner.keys()] : [])]), [wakes, inner]);
  // how strong each pair's link is (the light along all of them goes strongest first)
  const strengthRef = useRef(new Map<string, number>());
  strengthRef.current = useMemo(() => { const m = new Map<string, number>(); for (const r of routes) { const k = pairKey(r.a, r.b); m.set(k, Math.max(m.get(k) ?? 0, r.n ? r.k / r.n : 0)); } return m; }, [routes]);
  const lightG = useRef<SVGGElement>(null);

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
  const onLinkRef = useRef(onLink);
  onLinkRef.current = onLink;
  const onInnerRef = useRef(onInner);
  onInnerRef.current = onInner;
  const innerRef = useRef(inner);
  innerRef.current = inner;
  const belowRef = useRef(below);
  belowRef.current = below;
  const decorRef = useRef(decor);
  decorRef.current = decor;
  const zoomRef = useRef<(f: number) => void>(() => undefined);
  // each link's sign on the ball, moved every frame like the labels
  const chipEls = useRef(new Map<string, HTMLDivElement | null>());
  const innerEls = useRef(new Map<IslandId, HTMLDivElement | null>());
  useEffect(() => { if (!paused) { setOn(null); kickRef.current(); } }, [paused]);

  // The ball's WebGL lives as long as the globe is on screen and is freed the
  // moment it leaves (her note, Nov 4 2026: "периодически вылетает глобус"):
  // before, each visit left a context holding an 8 MB picture behind, and
  // every redraw of the islands uploaded the picture again without freeing
  // the old one, until the phone ran out of memory. If the phone drops the
  // context itself, the ball comes back when it is restored.
  const [gen, setGen] = useState(0);
  const loseRef = useRef<WEBGL_lose_context | null>(null);
  useEffect(() => {
    const canvas = cv.current;
    if (!canvas) return;
    const lost = (e: Event) => e.preventDefault();
    const back = () => setGen((g) => g + 1);
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", back);
    return () => {
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", back);
      loseRef.current?.loseContext();
    };
  }, []);

  useEffect(() => {
    const canvas = cv.current!, box = wrap.current!;
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) return;
    if (gl.isContextLost()) { loseRef.current?.restoreContext(); return; }
    loseRef.current ??= gl.getExtension("WEBGL_lose_context");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram()!, vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog); gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = Object.fromEntries(["uRes", "uBall", "uYaw", "uPitch", "uNight", "uPx", "uTex", "uTex2"].map((k) => [k, gl.getUniformLocation(prog, k)]));
    // the day and the night picture: each on the GPU only while it is shown or being faded to (8 MB each)
    const texOf = { day: gl.createTexture(), night: gl.createTexture() };
    const has = { day: false, night: false };
    const setTexture = (which: "day" | "night", c: HTMLCanvasElement) => {
      gl.activeTexture(which === "day" ? gl.TEXTURE0 : gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, texOf[which]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      has[which] = true; dirty = true; kick();
    };
    /** frees a picture's GPU memory: a 1×1 pixel in its place */
    const dropTexture = (which: "day" | "night") => {
      gl.activeTexture(which === "day" ? gl.TEXTURE0 : gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, texOf[which]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      has[which] = false;
    };
    let alive = true;
    // night as a number: 0 day, 1 night, in between while it changes (dn: it outlives this run)
    const DN = dn.current;
    const lights: Light[] = [];

    let W = 0, H = 0, DPR = 1, R = 0, CX = 0, CY = 0;
    let yaw = VIEW?.yaw ?? -C0[1] * D2R, pitch = VIEW?.pitch ?? Math.max(0, C0[0] - 20) * D2R, vy = 0, vp = 0;
    // zoom, and how far the ball's middle has moved with it (to keep the
    // spot under her fingers in place); at zoom 1 or less it sits in its place
    let zoom = VIEW?.zoom ?? 1, ox = VIEW?.ox ?? 0, oy = VIEW?.oy ?? 0, R0 = 0, CX0 = 0, CY0 = 0;
    let dirty = true, raf = 0, last = 0;
    let anim: { t0: number; dur: number; y0: number; y1: number; p0: number; p1: number; z0: number; z1: number; ox0: number; oy0: number; done?: () => void } | null = null;
    const place = () => {
      const m = Math.max(0, R0 * (zoom - 1));
      ox = Math.max(-m, Math.min(m, ox)); oy = Math.max(-m, Math.min(m, oy));
      R = R0 * zoom; CX = CX0 + ox; CY = CY0 + oy;
    };
    const resize = () => {
      const r = box.getBoundingClientRect(); W = r.width; H = r.height; DPR = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
      if (decorRef.current) { R0 = Math.min(W * 0.43, H * 0.44); CX0 = W / 2; CY0 = H * 0.5; } // bigger on the first screen (her phone test, Nov 7 2026)
      else if (belowRef.current) { R0 = Math.min(W * 0.72, H * 0.335); CX0 = W / 2; CY0 = H * 0.615; }
      else { R0 = Math.min(W * 0.74, H * 0.37); CX0 = W / 2; CY0 = H * 0.585; }
      place();
      gl.viewport(0, 0, canvas.width, canvas.height); dirty = true; kick();
    };
    let atLimit = false;
    /** Zoom to z with the point (fx, fy) staying where it is. */
    const zoomAt = (z: number, fx: number, fy: number) => {
      const nz = Math.max(ZMIN, Math.min(ZMAX, z)), k = nz / zoom;
      ox = fx + (CX - fx) * k - CX0; oy = fy + (CY - fy) * k - CY0; zoom = nz; place();
      // one soft tap where it stops growing or shrinking
      const lim = nz === ZMIN || nz === ZMAX;
      if (lim && !atLimit) haptics.soft();
      atLimit = lim; dirty = true; kick();
    };
    const rot = ([x, y, z]: V3): V3 => {
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
      return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
    };
    const pos = new Map<string, { x: number; y: number; z: number; w: number; s: number }>();
    const draw = () => {
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      const now = performance.now();
      if (has.day || has.night) {
        // a picture not on the GPU borrows the other one (it is mixed in at 0 then)
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, has.day ? texOf.day : texOf.night);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, has.night ? texOf.night : texOf.day);
        gl.uniform2f(U.uRes, canvas.width, canvas.height); gl.uniform3f(U.uBall, CX * DPR, CY * DPR, R * DPR);
        gl.uniform1f(U.uYaw, yaw); gl.uniform1f(U.uPitch, pitch); gl.uniform1f(U.uNight, DN.v); gl.uniform1f(U.uPx, DPR); gl.uniform1i(U.uTex, 0); gl.uniform1i(U.uTex2, 1);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      const base = R * 0.35;
      innerHits.length = 0;
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
        const ic = th.island ? innerEls.current.get(th.island.id) : null;
        if (ic) {
          const top = y - w * th.ar * an;
          ic.style.transform = `translate(${(x - 30).toFixed(1)}px, ${(top - 18).toFixed(1)}px)`;
          ic.style.opacity = String(vis); ic.style.zIndex = String(Math.round(160 + p[2] * 100));
          if (vis > 0.5) innerHits.push({ id: th.island!.id, x, y: top - 4 });
        }
        if (e.lab) {
          const off = w * th.ar * (1 - an) + 8;
          e.lab.style.transform = `translate(${(x - Math.sin(lean) * off).toFixed(1)}px, ${(y + Math.cos(lean) * off).toFixed(1)}px) scale(${Math.max(0.82, s).toFixed(3)})`;
          e.lab.style.opacity = String(vis); e.lab.style.zIndex = e.el.style.zIndex;
        }
      }
      // links: a dotted boat route between two islands, a sign at its middle
      let h = "", glowH = "";
      linkHits.length = 0;
      // the globe draws a few routes (bridgesOf); a light on a link it doesn't draw brings its route for the run
      const guests = lights.filter((l) => l.from !== l.to && !wakes.some(([x, y]) => pairKey(x, y) === l.key)).map((l) => [l.from, l.to, true] as const);
      for (const [a, b, guest] of [...wakes.map(([x, y]) => [x, y, false] as const), ...guests]) {
        const A = things.find((x) => x.key === a)?.v, B = things.find((x) => x.key === b)?.v; if (!A || !B) continue;
        const N = 90, runs: { x: number; y: number; z: number; t: number }[][] = []; let run: { x: number; y: number; z: number; t: number }[] = [];
        for (let k = 0; k <= N; k++) {
          const tt = k / N, p = rot(slerp(A, B, tt));
          if (p[2] > 0.06) run.push({ x: CX + R * p[0], y: CY - R * p[1], z: p[2], t: tt }); else if (run.length) { runs.push(run); run = []; }
        }
        if (run.length) runs.push(run);
        const L = lightOf(a, b, now);
        if (!guest) for (const P of runs) for (const q of P) linkHits.push({ a: a as IslandId, b: b as IslandId, x: q.x, y: q.y });
        const chip = chipEls.current.get(`${a}|${b}`);
        if (chip) {
          const pm = rot(slerp(A, B, 0.5)), cv = Math.max(0, Math.min(1, (pm[2] - 0.15) / 0.2));
          const cx = CX + R * pm[0], cy = CY - R * pm[1];
          chip.style.transform = `translate(${(cx - 17).toFixed(1)}px, ${(cy - 17).toFixed(1)}px)`;
          chip.style.opacity = String(cv * (L ? L.chip : 1)); chip.style.zIndex = String(Math.round(150 + pm[2] * 100));
          if (cv > 0.5) linkHits.push({ a: a as IslandId, b: b as IslandId, x: cx, y: cy, chip: true });
        }
        for (const P of runs) {
          for (const d of routeDots(P.map((q) => ({ x: q.x, y: q.y, t: q.t, k: 0.55 + 0.45 * q.z })), 12 * Math.sqrt(zoom))) {
            // where the light has passed, the dots are warm, then cool down again
            const warm = L && L.on ? L.warm * Math.max(0, Math.min(1, (L.head - (L.rev ? 1 - d.t : d.t)) / 0.05 + 0.5)) : 0;
            const r = d.r * Math.sqrt(zoom);
            // a guest route shows only where the light has been, and goes with it
            if (guest && warm <= 0.02) continue;
            if (warm > 0.02) glowH += `<circle class="planet-route-glow" cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="${(r * 3.4).toFixed(1)}" opacity="${(0.55 * warm * d.o).toFixed(2)}"/>`;
            h += `<circle class="planet-route${warm > 0.5 ? " is-warm" : ""}" cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="${r.toFixed(2)}" opacity="${(d.o * (guest ? warm : 1)).toFixed(2)}"/>`;
          }
        }
        // the light itself, running from one island to the other
        if (L && L.on && L.head < 1) {
          const lp = rot(slerp(L.rev ? B : A, L.rev ? A : B, L.head));
          if (lp[2] > 0.06) {
            const x = (CX + R * lp[0]).toFixed(1), y = (CY - R * lp[1]).toFixed(1), g = 22 * Math.sqrt(zoom);
            glowH += `<circle class="planet-light-glow" cx="${x}" cy="${y}" r="${g.toFixed(1)}"/><path class="planet-light-star" transform="translate(${x} ${y}) rotate(${((now / 11) % 360).toFixed(1)}) scale(${(g / 30).toFixed(3)})" d="${STAR}"/>`;
          }
        }
      }
      if (wakeG.current) wakeG.current.innerHTML = h;
      if (lightG.current) lightG.current.innerHTML = glowH;
      // far from home, or zoomed: offer the way back
      const far = rot(vec(C0))[2] < 0.82 || Math.abs(zoom - 1) > 0.15;
      if (far !== wasFar) { wasFar = far; setAway(far); }
    };
    let wasFar = false;
    /** Where the light is on the route a–b now: its head (0..1 from where it started), how warm the passed
     *  dots still are, and how far the link's sign has come back (a new link's sign comes at the end). */
    const lightOf = (a: string, b: string, now: number) => {
      const r = lights.find((x) => x.key === pairKey(a, b));
      if (!r) return null;
      const rev = r.from !== a;
      if (now < r.t0) return r.fresh ? { on: false, head: 0, warm: 0, rev, chip: 0 } : null;
      const k = r.dur ? Math.min(1, (now - r.t0) / r.dur) : 1, end = r.t0 + r.dur;
      return { on: true, head: k < 1 ? k * k * (3 - 2 * k) : 1, warm: now <= end ? 1 : Math.max(0, 1 - (now - end) / 1400), rev, chip: r.fresh ? Math.max(0, Math.min(1, (now - end) / 400)) : 1 };
    };
    /** An island's small light on or off (off only when no other light still needs it). */
    const isleLight = (id: string, on: boolean) => {
      const el = els.current.get(id)?.el;
      if (!el) return;
      if (on) { el.classList.remove("is-lit-new"); void el.offsetWidth; el.classList.add("is-lit", "is-lit-new"); }
      else if (!lights.some((x) => !x.gone && (x.from === id || x.to === id))) el.classList.remove("is-lit", "is-lit-new");
    };
    const stepLights = (now: number) => {
      for (const r of lights) {
        if (!r.litA && now >= r.t0) { r.litA = true; isleLight(r.from, true); }
        if (!r.litB && now >= r.t0 + r.dur * 0.92) { r.litB = true; isleLight(r.to, true); if (r.fresh) haptics.soft(); }
        if (now >= r.t0 + r.dur + TAIL_MS) r.gone = true;
      }
      for (let i = lights.length - 1; i >= 0; i--) {
        const r = lights[i];
        if (r.gone) { lights.splice(i, 1); isleLight(r.from, false); isleLight(r.to, false); }
      }
    };
    /** The light along the route from one island to the other, at time `at`; a fresh one (a new link) hides the sign till the end. */
    const startLight = (from: string, to: string, at: number, fresh: boolean, dur = RUN_MS) => {
      const key = pairKey(from, to);
      // a link inside one island has no route: the island just lights up
      if (!things.some((x) => x.key === from) || !things.some((x) => x.key === to)) return false;
      if (from === to) { lights.push({ key, from, to, t0: at, dur: 0, fresh }); addLit([key]); dirty = true; kick(); return true; }
      for (let i = lights.length - 1; i >= 0; i--) if (lights[i].key === key) lights.splice(i, 1);
      lights.push({ key, from, to, t0: at, dur: reduce ? 0 : dur, fresh });
      addLit([key]); dirty = true; kick();
      return true;
    };
    // where the routes and their signs are on screen, for taps
    const linkHits: { a: IslandId; b: IslandId; x: number; y: number; chip?: boolean }[] = [];
    const innerHits: { id: IslandId; x: number; y: number }[] = [];
    const linkAt = (x: number, y: number) => {
      let best: (typeof linkHits)[number] | null = null, bd = Infinity;
      for (const l of linkHits) {
        const d = Math.hypot(l.x - x, l.y - y) - (l.chip ? 10 : 0);
        if (d < bd) { bd = d; best = l; }
      }
      return best && bd < 16 ? best : null;
    };
    const FRICTION = 0.88; // per 16.7 ms: the glide stops in about 0.7 s
    const frame = (tm: number) => {
      raf = 0; const dt = last ? Math.min(48, tm - last) : 16.7; last = tm;
      let moving = false;
      if (anim) {
        const k = Math.min(1, (tm - anim.t0) / anim.dur), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        yaw = anim.y0 + (anim.y1 - anim.y0) * e; pitch = anim.p0 + (anim.p1 - anim.p0) * e; moving = k < 1;
        if (anim.z1 !== anim.z0) { zoom = anim.z0 + (anim.z1 - anim.z0) * e; ox = anim.ox0 * (1 - e); oy = anim.oy0 * (1 - e); place(); }
        if (!moving) { const done = anim.done; anim = null; done?.(); }
        dirty = true;
      } else if (!dragging && (Math.abs(vy) > 1e-5 || Math.abs(vp) > 1e-5)) {
        yaw += vy * dt; pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch + vp * dt));
        const f = Math.pow(FRICTION, dt / 16.7); vy *= f; vp *= f; if (Math.abs(vy) < 2e-5) vy = 0; if (Math.abs(vp) < 2e-5) vp = 0;
        moving = true; dirty = true;
      }
      // night coming or going
      if (DN.anim) {
        const k = Math.min(1, (tm - DN.anim.t0) / DAYNIGHT_MS), e = k * k * (3 - 2 * k);
        DN.v = DN.anim.from + (DN.anim.to - DN.anim.from) * e; dirty = true;
        if (k >= 1) { const to = DN.anim.to; DN.anim = null; dropTexture(to ? "day" : "night"); } else moving = true;
      }
      // the lights along her links
      if (lights.length) { stepLights(tm); dirty = true; if (lights.length) moving = true; }
      if (dirty) { draw(); dirty = false; VIEW = { yaw, pitch, zoom, ox, oy }; }
      if (moving && !pausedRef.current) kick(); else last = 0;
    };
    const kick = () => { if (!raf && alive) raf = requestAnimationFrame(frame); };
    kickRef.current = () => { dirty = true; kick(); };

    /** Turns the ball to ll; with z1, zooms there too (z1 = 1: back in its place). */
    const turnTo = (ll: [number, number], done?: () => void, z1 = zoom) => {
      let y1 = -ll[1] * D2R; while (y1 - yaw > Math.PI) y1 -= 2 * Math.PI; while (yaw - y1 > Math.PI) y1 += 2 * Math.PI;
      const p1 = Math.max(PITCH_MIN, Math.min(PITCH_MAX, (ll[0] - 6) * D2R));
      if (reduce) { yaw = y1; pitch = p1; if (z1 !== zoom) { zoom = z1; ox = oy = 0; place(); } dirty = true; kick(); done?.(); return; }
      anim = { t0: performance.now(), dur: 620, y0: yaw, y1, p0: pitch, p1, z0: zoom, z1, ox0: ox, oy0: oy, done }; kick();
    };
    homeRef.current = () => { haptics.tap(); turnTo([C0[0] + 20, C0[1]], undefined, 1); };
    zoomRef.current = (f: number) => {
      haptics.tap(); setHint(false);
      const z1 = Math.max(ZMIN, Math.min(ZMAX, zoom * f));
      if (reduce) { zoomAt(z1, CX, CY); return; }
      anim = { t0: performance.now(), dur: 320, y0: yaw, y1: yaw, p0: pitch, p1: pitch, z0: zoom, z1, ox0: ox, oy0: oy }; kick();
    };
    // "memap-globe-focus" {ids}: turn so these islands face her, back at zoom 1
    const turnToIds = (ids: string[], done?: () => void) => {
      const vs = things.filter((x) => x.kind === "area" && ids.includes(x.key)).map((x) => x.v);
      if (!vs.length) { done?.(); return; }
      const m = vs.reduce((a, v) => [a[0] + v[0], a[1] + v[1], a[2] + v[2]] as V3, [0, 0, 0] as V3), L = Math.hypot(...m) || 1;
      turnTo([Math.asin(m[1] / L) / D2R + 12, Math.atan2(m[0], m[2]) / D2R], done, 1);
    };
    const focus = (e: Event) => turnToIds(((e as CustomEvent).detail?.ids ?? []) as string[]);
    window.addEventListener("memap-globe-focus", focus);
    // "memap-route-light" {a, b, fresh?, focus?}: the light from island a to island b (a new link: fresh);
    // the globe turns to them first unless focus is false. Also for filming the store video.
    const onRouteLight = (e: Event) => {
      const d = ((e as CustomEvent).detail ?? {}) as { a?: string; b?: string; fresh?: boolean; focus?: boolean };
      if (!d.a || !d.b) return;
      const go = () => { if (alive) startLight(d.a!, d.b!, performance.now(), !!d.fresh); };
      if (d.focus === false) go(); else turnToIds([d.a, d.b], go);
    };
    // "memap-routes-light": the light along all her links in turn, strongest first, in two to three seconds
    const onRoutesLight = () => {
      const order = [...wakes].sort(([a1, b1], [a2, b2]) => (strengthRef.current.get(pairKey(a2, b2)) ?? 0) - (strengthRef.current.get(pairKey(a1, b1)) ?? 0));
      const step = Math.min(380, 1700 / Math.max(1, order.length)), t0 = performance.now();
      order.forEach(([a, b], i) => startLight(a, b, t0 + i * step, false, 1100));
    };
    // "memap-daynight": day to night or back, as the moon button does (for filming)
    const onDayNight = () => toggleNight();
    window.addEventListener("memap-route-light", onRouteLight);
    window.addEventListener("memap-routes-light", onRoutesLight);
    window.addEventListener("memap-daynight", onDayNight);

    // touch: drag 1:1, a short glide, tap; two fingers pinch to zoom
    let dragging = false, sx = 0, sy = 0, lx = 0, ly = 0, lt = 0, moved = 0, pid: number | null = null;
    const fingers = new Map<number, { x: number; y: number }>();
    // a pinch: the fingers' first distance and the zoom then; after one, the
    // finger left on the glass does nothing until all are up
    let pinch: { d0: number; z0: number } | null = null, pinched = false;
    const spread = () => { const [a, b] = [...fingers.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
    const onDown = (ev: PointerEvent) => {
      // the buttons over the globe answer by themselves
      if (decorRef.current || pausedRef.current || (ev.target as HTMLElement).closest("button")) return;
      fingers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      try { box.setPointerCapture(ev.pointerId); } catch { /* synthetic events */ }
      if (fingers.size === 2) {
        dragging = false; pid = null; vy = vp = 0; anim = null; setHint(false);
        pinch = { d0: Math.max(1, spread().d), z0: zoom }; pinched = true;
        return;
      }
      if (fingers.size > 2 || pid !== null || pinched) return;
      pid = ev.pointerId;
      dragging = true; anim = null; vy = vp = 0; setNote(false);
      sx = lx = ev.clientX; sy = ly = ev.clientY; lt = performance.now(); moved = 0;
    };
    const onMove = (ev: PointerEvent) => {
      if (fingers.has(ev.pointerId)) fingers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pinch && fingers.size >= 2) {
        const s = spread(), r = box.getBoundingClientRect();
        zoomAt(pinch.z0 * (s.d / pinch.d0), s.x - r.left, s.y - r.top);
        return;
      }
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
      // a link inside one island: its sign over the island
      const ih = innerHits.find((h) => Math.abs(h.x - x) < 34 && Math.abs(h.y - y) < 20);
      const ir = ih && innerRef.current?.get(ih.id);
      if (ir && onInnerRef.current) { haptics.tap(); onInnerRef.current(ir); return; }
      let hit: Thing | null = null, hz = -1;
      for (const th of things) {
        if (th.kind === "sky") continue;
        const q = pos.get(th.key); if (!q || q.z < 0.15) continue;
        const h = q.w * th.ar;
        if (Math.abs(x - q.x) < q.w * 0.55 && y > q.y - h * 0.9 && y < q.y + h * 0.4 + (th.kind === "area" ? 30 : 0) && q.z > hz) { hit = th; hz = q.z; }
      }
      if (!hit) {
        const l = onLinkRef.current ? linkAt(x, y) : null;
        if (l) { haptics.tap(); onLinkRef.current!(l.a, l.b); }
        return;
      }
      haptics.tap();
      if (hit.kind === "boat") { window.dispatchEvent(new CustomEvent("memap-open-you")); return; }
      if (hit.kind === "cloud") { turnTo(hit.ll, () => setNote(true)); return; }
      playBloop(Math.min(1, Math.max(0, x / W)));
      const id = hit.island!.id;
      setOn(id);
      turnTo(hit.ll, () => onOpenRef.current(id));
    };
    const lift = (id: number) => {
      fingers.delete(id);
      if (fingers.size < 2) pinch = null;
      if (fingers.size === 0) pinched = false;
    };
    const onUp = (ev: PointerEvent) => {
      lift(ev.pointerId);
      if (!dragging || ev.pointerId !== pid) return;
      dragging = false; pid = null;
      if (moved < 8) { vy = vp = 0; tap(ev.clientX, ev.clientY); return; }
      if (performance.now() - lt > 80 || reduce) vy = vp = 0;
      const cap = 0.004; vy = Math.max(-cap, Math.min(cap, vy)); vp = Math.max(-cap, Math.min(cap, vp));
      kick();
    };
    const onCancel = (ev: PointerEvent) => { lift(ev.pointerId); if (ev.pointerId !== pid) return; dragging = false; pid = null; vy = vp = 0; };
    // a mouse wheel or a trackpad pinch (ctrlKey) zooms where the pointer is
    const onWheel = (ev: WheelEvent) => {
      if (pausedRef.current) return;
      ev.preventDefault();
      const r = box.getBoundingClientRect();
      anim = null; setHint(false);
      zoomAt(zoom * Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0015)), ev.clientX - r.left, ev.clientY - r.top);
    };
    box.addEventListener("pointerdown", onDown); box.addEventListener("pointermove", onMove);
    box.addEventListener("pointerup", onUp); box.addEventListener("pointercancel", onCancel);
    box.addEventListener("wheel", onWheel, { passive: false });
    // Her planet, once everything it draws with exists. (It was set up top
    // before: the second visit found the picture ready, drew at once and hit
    // the frame state not made yet, and the whole app fell over: her note,
    // Nov 4 2026, "периодически вылетает глобус"; day/night did the same.)
    const load = (which: "day" | "night", then?: () => void) => {
      const src = which === "day" ? planetDay : planetNight;
      const cached = TEXTURES.get(src);
      if (cached) { setTexture(which, cached); then?.(); return; }
      const im = new Image(); im.onload = () => { if (!alive) return; const c = toTexture(im); TEXTURES.set(src, c); setTexture(which, c); then?.(); }; im.src = src;
    };
    load(DN.v >= 0.5 ? "night" : "day");
    // a change under way when this run began: both pictures, and it goes on
    if (DN.anim) load(DN.anim.to ? "night" : "day", () => kick());
    // day to night or back: the other picture goes on the GPU, then night fades in (or out)
    dayNightRef.current = (toNight: boolean) => {
      const to = toNight ? 1 : 0;
      if (DN.anim ? DN.anim.to === to : DN.v === to) return;
      const go = () => {
        if (!alive) return;
        if (reduce) { DN.v = to; DN.anim = null; dropTexture(toNight ? "day" : "night"); dirty = true; kick(); return; }
        DN.anim = { from: DN.v, to, t0: performance.now() }; kick();
      };
      if (has[toNight ? "night" : "day"]) go(); else load(toNight ? "night" : "day", go);
    };
    // the other one waits ready in memory (not on the GPU), so a change starts at once
    const other = DN.v >= 0.5 ? planetDay : planetNight;
    // a change asked for while no run was there to take it (the old run had gone, this one wasn't made yet)
    if (!DN.anim && DN.v !== (nightRef.current ? 1 : 0)) dayNightRef.current(nightRef.current);
    const ahead = window.setTimeout(() => { if (!TEXTURES.has(other)) { const im = new Image(); im.onload = () => TEXTURES.set(other, toTexture(im)); im.src = other; } }, 1500);
    const ro = new ResizeObserver(resize); ro.observe(box);
    resize();
    // for the tests in development: where an island is drawn, how the ball is turned
    if (import.meta.env.DEV) (window as unknown as { __planet?: unknown }).__planet = {
      at: (id: string) => pos.get(id) ?? null,
      state: () => ({ yaw, pitch, zoom, night: DN.v, lights: lights.length }),
    };
    return () => {
      alive = false; cancelAnimationFrame(raf); window.clearTimeout(ahead); ro.disconnect();
      box.removeEventListener("pointerdown", onDown); box.removeEventListener("pointermove", onMove);
      box.removeEventListener("pointerup", onUp); box.removeEventListener("pointercancel", onCancel);
      box.removeEventListener("wheel", onWheel);
      window.removeEventListener("memap-globe-focus", focus);
      window.removeEventListener("memap-route-light", onRouteLight);
      window.removeEventListener("memap-routes-light", onRoutesLight);
      window.removeEventListener("memap-daynight", onDayNight);
      kickRef.current = () => undefined;
      dayNightRef.current = () => undefined;
      // what this run put on the GPU goes with it
      gl.deleteTexture(texOf.day); gl.deleteTexture(texOf.night); gl.deleteBuffer(buf); gl.deleteProgram(prog); gl.deleteShader(vs); gl.deleteShader(fs);
    };
  }, [things, wakes, gen]);

  // A new link, found since she last looked: the light runs along it on the open globe (her note, Nov 11 2026: not
  // only the first one). The first link has its own moment (LinkMoment), which starts the light itself.
  useEffect(() => {
    if (decor || paused) return;
    const keys = wakes.map(([a, b]) => pairKey(a, b));
    const seen = readLit();
    if (seen === null) { addLit(keys); return; } // the links this install had before the lights: no flood of them
    let firstSeen: string | null = null;
    try { firstSeen = localStorage.getItem("memap_first_link_seen"); } catch { /* the first link's moment decides */ }
    if (!firstSeen) return;
    const fresh = wakes.filter(([a, b]) => !seen.has(pairKey(a, b)));
    if (!fresh.length) return;
    // games and rewards off: the link is just there
    if (!isPlayful()) { addLit(fresh.map(([a, b]) => pairKey(a, b))); return; }
    const timers = fresh.slice(0, 3).map(([a, b], i) => window.setTimeout(() => window.dispatchEvent(new CustomEvent("memap-route-light", { detail: { a, b, fresh: true } })), 900 + i * 2600));
    if (fresh.length > 3) addLit(fresh.slice(3).map(([a, b]) => pairKey(a, b)));
    return () => timers.forEach((x) => window.clearTimeout(x));
  }, [wakes, paused, decor]);
  // Once a day when World opens, the light along all her links: off until she says yes (DAILY_RUN)
  useEffect(() => {
    if (!DAILY_RUN || decor || paused || !wakes.length || !isPlayful()) return;
    const today = new Date().toDateString();
    try { if (localStorage.getItem("memap_links_run_day") === today) return; localStorage.setItem("memap_links_run_day", today); } catch { return; }
    const id = window.setTimeout(() => window.dispatchEvent(new Event("memap-routes-light")), 1100);
    return () => window.clearTimeout(id);
  }, [wakes, paused, decor]);

  return (
    <div ref={wrap} className={`planet-wrap${night ? " is-night" : ""}`} aria-label={t("map.aria")}>
      {/* both skies, the night one fading in over the day one (soft day and night, Nov 11 2026) */}
      {sky && <div className="planet-sky day" style={{ backgroundImage: `url(${skyDay})` }} />}
      {sky && <div className={`planet-sky night${night ? " is-on" : ""}`} style={{ backgroundImage: `url(${skyNight})` }} />}
      <canvas ref={cv} className="planet-canvas" />
      <svg className="planet-wakes" aria-hidden="true">
        <defs>
          <filter id="planet-wb" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.2" /></filter>
          <filter id="planet-ws"><feGaussianBlur stdDeviation="0.5" /></filter>
        </defs>
        <defs>
          <radialGradient id="planet-light-grad"><stop offset="0" stopColor="#fff6d6" stopOpacity="1" /><stop offset="0.35" stopColor="#ffd98a" stopOpacity="0.7" /><stop offset="1" stopColor="#ffd98a" stopOpacity="0" /></radialGradient>
          {/* by day the light is a little more amber, to show on her pale sea */}
          <radialGradient id="planet-light-grad-day"><stop offset="0" stopColor="#fff3c4" stopOpacity="1" /><stop offset="0.35" stopColor="#ffc65a" stopOpacity="0.72" /><stop offset="1" stopColor="#ffc65a" stopOpacity="0" /></radialGradient>
        </defs>
        <g ref={wakeG} />
        <g ref={lightG} />
      </svg>
      <div className="planet-things">
        {things.map((th) => {
          const W = th.island?.weather ? WEATHER_ICON[th.island.weather] : null;
          return (
            <div key={th.key}>
              <div ref={(el) => { elOf(th.key).el = el; }} data-isle={th.kind === "area" ? th.key : undefined} data-art={th.kind === "area" ? th.name : undefined}
                className={`planet-isle ${th.kind === "boat" ? "planet-boat" : ""} ${th.kind === "sky" ? "planet-cloud" : ""} ${on === th.key ? "on" : ""} ${th.kind === "area" && th.key === main ? "is-main" : ""} ${th.kind === "area" && linked.has(th.key) ? "has-link" : ""}`} style={{ opacity: 0 }}>
                {th.kind === "area" && th.key === main && <span className="main-glow" aria-hidden="true" />}
                {th.kind === "area" && <div className="ring" />}
                {th.kind === "boat" ? (
                  <div className="bob"><img src={mapPic("sailboat")} alt="" />{avatar && <img className="otter" src={avatar} alt="" />}</div>
                ) : (
                  <>
                    {/* day and night pictures together, the night one fading in over the day one */}
                    <img className="island-art d" src={art(th.name, false)} alt="" />
                    <img className="island-art n" src={art(th.name, true)} alt="" />
                  </>
                )}
                {/* its small light: on while a light runs along its link, and at night if it has a link */}
                {th.kind === "area" && <span className="isle-light" aria-hidden="true"><i /></span>}
                {th.island && garden?.get(th.island.id)?.map((pic, gi) => (
                  <span key={`g${gi}`} className="stand tree" style={standAt(th.name, gi === 0 ? "g1" : "g2")}><img src={mapPic(pic)} alt="" /></span>
                ))}
                {th.lit && <span className="stand lighthouse" style={standAt(th.name, "light")}><img src={mapPic("lighthouse")} alt="" /></span>}
                {th.flag && <span className="stand flag" style={standAt(th.name, "flag")}><img src={mapPic("marker_flag")} alt="" /></span>}
                {th.island && treasures?.get(th.island.id)?.filter((tr) => standsOn(th.name, tr.id)).map((tr) => (
                  <span key={tr.id} className={`treasure t-${tr.slot} it-${tr.id}${tr.ghost ? " is-ghost" : ""}${tr.slot !== "sky" ? " stand" : ""}`} style={tr.slot !== "sky" ? standAt(th.name, tr.slot) : undefined}><img src={mapPic(tr.pic)} alt="" /></span>
                ))}
              </div>
              {th.island && (!labels || labels.includes(th.island.id)) && (
                <div ref={(el) => { elOf(th.key).lab = el; }} className="planet-label" style={{ opacity: 0 }}>
                  <span>{th.island.id === main && <i className="main-dot" aria-hidden="true" />}{W && <W className="h-4 w-4" strokeWidth={2.4} style={{ color: WEATHER_COLOR[th.island.weather!] }} />}{islandName(t, th.island.id)}</span>
                </div>
              )}
            </div>
          );
        })}
        {onInner && inner && [...inner.entries()].map(([id, r]) => (
          <div key={`in-${id}`} ref={(el) => { innerEls.current.set(id, el); }} aria-hidden="true" className="inner-chip planet-inner-chip" style={{ opacity: 0 }}>
            <Link2 className="h-3.5 w-3.5" strokeWidth={2.6} />{r.k}/{r.n}
          </div>
        ))}
        {onLink && wakes.map(([a, b]) => (
          <div key={`${a}|${b}`} ref={(el) => { chipEls.current.set(`${a}|${b}`, el); }} aria-hidden="true" className="link-chip planet-link-chip" style={{ opacity: 0 }}>
            <Link2 className="h-4 w-4" strokeWidth={2.6} />
          </div>
        ))}
      </div>
      {hint && !decor && !quietHint && <div className="planet-hint" style={below ? { bottom: "auto", top: "12.4rem" } : undefined}>{t("map.hint")}</div>}
      {/* zoom in and out by hand too (pinch and the wheel still work) */}
      <div className={`absolute right-4 z-[5] flex flex-col overflow-hidden rounded-full bg-white shadow-lg dark:bg-[hsl(var(--surface))]${decor ? " hidden" : ""}`} style={{ bottom: "calc(11.5rem + env(safe-area-inset-bottom, 0px))" }}>
        <button type="button" onClick={() => zoomRef.current(1.35)} aria-label={t("map.zoomIn")} className="flex h-11 w-11 items-center justify-center text-foreground"><Plus className="h-5 w-5" strokeWidth={2.6} /></button>
        <span className="mx-2.5 h-px bg-foreground/10" />
        <button type="button" onClick={() => zoomRef.current(1 / 1.35)} aria-label={t("map.zoomOut")} className="flex h-11 w-11 items-center justify-center text-foreground"><Minus className="h-5 w-5" strokeWidth={2.6} /></button>
      </div>
      {/* a new island, always at hand (on the flat map it was a tile) */}
      {onNewIsland && !decor && (
        <button type="button" onClick={() => { haptics.tap(); onNewIsland(); }}
          className="absolute left-4 z-[5] flex h-12 items-center gap-1.5 rounded-full bg-white pl-3 pr-4 text-[15px] font-extrabold text-foreground shadow-lg dark:bg-[hsl(var(--surface))]"
          style={{ bottom: "calc(7.5rem + env(safe-area-inset-bottom, 0px))" }}>
          <Plus className="h-5 w-5 text-[hsl(var(--coin-teal))]" strokeWidth={2.6} />{t("islands.new")}
        </button>
      )}
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
                className="raised-btn is-small mt-2 px-5">
                <Plus className="h-4 w-4" strokeWidth={2.6} /> {t("islands.new")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
