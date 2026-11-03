// Your world (Aurora UX step: the Map, Nov 1 2026). The top of a big ball
// you roll with a finger, like the ball of a roll-on: islands come up from
// below and sink past the horizon. Her calls while testing the demo: only the
// top of the ball shows; it must roll calmly and stop (it made her dizzy);
// no idle spinning; a "Back to me" pill when you roll away; unexplored land
// is her plain cloud.
// Nov 3 2026 (her notes and the plan in plans/map-globe-2026-11-03.md):
// - It is a globe with north up: sideways spins it, up and down tilts it
//   within soft limits; the spot under the finger follows the finger; a
//   flick glides on briefly (by time, the same at 60 and 120 Hz) and a touch
//   stops it; a light tick as an island passes the middle.
// - Every touch answers within 0.1 s: a pressed island sinks, a ring spreads
//   on the water, then it turns and opens; the sea ripples; unexplored land
//   offers a new island; the boat opens You.
// - The look without new art: no white dashes ("дурацкие белые чёрточки");
//   one light from the top left, a sun spot with glints that roll with the
//   sea, a sky above the horizon (stars at night), each island in its own
//   shallows with a soft shadow, upright islands that sink bottom-first into
//   haze past the horizon, small rocky islets as background, the boat
//   bobbing, her animal seated in it. A found link is a wooden walkway.
// - Day/night redraws in place, turned as it was (the view lives here, at
//   module level, so tab switches keep it too).
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Island, IslandId, Route, bridgesOf, islandName, isNightMap, mapPic, mapPicFor } from "@/lib/islands";
import { growthLand, type GrowthKind } from "@/lib/growth";
import { haptics } from "@/lib/haptics";
import { playBloop, playWheelTick } from "@/lib/feedback";

type V3 = [number, number, number];
type M3 = number[];
const mul = (A: M3, B: M3): M3 => { const C: number[] = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) C[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c]; return C; };
const axisRot = ([x, y, z]: V3, a: number): M3 => { const c = Math.cos(a), s = Math.sin(a), t = 1 - c; return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c]; };
const app = (A: M3, [x, y, z]: V3): V3 => [A[0] * x + A[1] * y + A[2] * z, A[3] * x + A[4] * y + A[5] * z, A[6] * x + A[7] * y + A[8] * z];
const vec = (lon: number, lat: number): V3 => { const l = lon * DEG, p = lat * DEG; return [Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l)]; };
const DEG = Math.PI / 180;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
/** cubic-bezier(.16,1,.3,1), close enough: a calm ease-out with no overshoot */
const settle = (x: number) => 1 - Math.pow(1 - x, 4);
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const apart = (a: { lon: number; lat: number }, b: { lon: number; lat: number }) => {
  const va = vec(a.lon, a.lat), vb = vec(b.lon, b.lat);
  return Math.acos(clamp(va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2], -1, 1)) / DEG;
};

// Pictures by address, kept across redraws (day/night, her avatar), so a
// switch never shows the ball without its islands.
const IMAGES = new Map<string, HTMLImageElement>();
const image = (url: string) => {
  let im = IMAGES.get(url);
  if (!im) { im = new Image(); im.decoding = "async"; im.src = url; IMAGES.set(url, im); }
  return im;
};
const ready = (im: HTMLImageElement | null | undefined): im is HTMLImageElement => !!im && im.complete && im.naturalWidth > 0;

/** How the ball is turned: kept for the whole visit (tabs, day/night). */
let VIEW: { yaw: number; pitch: number } | null = null;
/** If the planks don't convince on her phone: false, and links live on the map and in the sheets. */
const GLOBE_BRIDGES = true;

interface Thing { lon: number; lat: number; w: number; base?: string; land?: [string, number, number, number][]; locked?: boolean; islet?: string; flip?: boolean; island?: Island }

// Land nobody has explored yet: her plain cloud.
const UNEXPLORED: Thing[] = [{ lon: 30, lat: 36, w: 88 }, { lon: -38, lat: 31, w: 84 }, { lon: -32, lat: -38, w: 88 }, { lon: -150, lat: 2, w: 92 }, { lon: 122, lat: -12, w: 92 }, { lon: 178, lat: 50, w: 84 }]
  .map((l) => ({ ...l, locked: true }));
const SLOT_HOME = { lon: 0, lat: 5 };
const SLOT_SPOTS = [{ lon: -13, lat: 15 }, { lon: 15, lat: 19 }, { lon: -15, lat: -5 }, { lon: 15, lat: -3 }, { lon: -1, lat: -22 }, { lon: 32, lat: -22 }, { lon: -34, lat: 6 }, { lon: 34, lat: 6 }, { lon: 0, lat: 33 }];
// Small rocky islets as background, away from her islands and the clouds
// (her unused rock pictures; they used to be copies of her island art).
const ISLETS: Thing[] = (() => {
  const out: Thing[] = [];
  for (let i = 0; i < 400 && out.length < 10; i++) {
    const y = 1 - 2 * (i + .5) / 400, lat = Math.asin(y) / DEG, lon = ((i * 137.508) % 360) - 180, at = { lon, lat };
    const d = apart(at, SLOT_HOME);
    if (d < 40 || d > 75) continue;
    if (SLOT_SPOTS.some((s) => apart(s, at) < 25) || UNEXPLORED.some((u) => apart(u, at) < 17) || out.some((o) => apart(o, at) < 14)) continue;
    out.push({ lon, lat, w: 50 + (out.length % 3) * 5, islet: out.length % 2 ? "single_rock" : "rock_cluster", flip: out.length % 4 > 1 });
  }
  return out;
})();
const SKY: Record<string, [string, number]> = { storm: ["thunder_cloud", 52], clouds: ["partly_cloudy", 46], sun: ["sun", 42] };
// Glints on the water: points fixed on the sphere, lit only under the sun spot.
const GLINTS: { v: V3; ph: number }[] = Array.from({ length: 90 }, (_, i) => {
  const y = 1 - 2 * (i + .5) / 90, r = Math.sqrt(1 - y * y), th = i * 2.399963;
  return { v: [r * Math.sin(th), y, r * Math.cos(th)] as V3, ph: (i * 1.7) % (Math.PI * 2) };
});
const STARS = Array.from({ length: 24 }, (_, i) => ({ fx: ((i * 0.618034) % 1), fy: ((i * 0.381966 * 7) % 1), r: .6 + (i % 5) * .2, ph: i * 1.3 }));

/** A rounded rectangle path (ctx.roundRect is missing on iOS 15). */
const roundPath = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
};

export const WorldMap = ({ islands, routes, growth = {}, avatar = null, near, paused = false, onOpen, onNewIsland }: {
  islands: Island[]; routes: Route[]; growth?: Record<string, GrowthKind[]>; avatar?: string | null;
  /** the island she answered last: the boat sails beside it */
  near?: IslandId;
  /** a sheet is open over the globe: no idle life */
  paused?: boolean;
  onOpen: (id: IslandId) => void;
  onNewIsland?: () => void;
}) => {
  const { t } = useTranslation();
  // Day or night: redrawn in place, the ball turned as it was.
  const [night, setNight] = useState(isNightMap);
  useEffect(() => {
    const sync = () => setNight(isNightMap());
    window.addEventListener("memap-theme-changed", sync);
    return () => window.removeEventListener("memap-theme-changed", sync);
  }, []);
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [away, setAway] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [hint, setHint] = useState(true);
  const api = useRef<{ home: () => void } | null>(null);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const kickRef = useRef<() => void>(() => undefined);
  useEffect(() => { if (!paused) kickRef.current(); }, [paused]);

  useEffect(() => {
    const canvas = cv.current!, box = wrap.current!, ctx = canvas.getContext("2d")!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const FONT = `"DM Sans", "Onest", system-ui, -apple-system, sans-serif`;
    let raf = 0, idle = 0, alive = true;
    const kick = () => { if (idle) { window.clearTimeout(idle); idle = 0; } if (!raf && alive) raf = requestAnimationFrame(frame); };
    kickRef.current = kick;
    // every picture drawn, so the other theme's can load ahead
    const used = new Set<string>(), waiting = new Set<HTMLImageElement>();
    const pic = (n: string) => {
      used.add(n);
      const im = image(mapPic(n));
      if (!im.complete && !waiting.has(im)) { waiting.add(im); im.addEventListener("load", () => { waiting.delete(im); kick(); }, { once: true }); }
      return im;
    };
    const ahead = window.setTimeout(() => { if (alive) used.forEach((n) => image(mapPicFor(n, !night))); }, 1500);
    let av: HTMLImageElement | null = null;
    const avatarImg = () => { if (!avatar) return null; if (!av) { av = new Image(); av.onload = kick; av.src = avatar; } return av; };

    // Her islands on the ball. Linked pairs sit side by side (slot pairs
    // 0-1, 2-3, 4-5) so their walkway is short; the rest follow.
    const bridges = bridgesOf(routes, 3);
    const ordered: Island[] = [];
    for (const r of bridges) for (const id of [r.a, r.b]) { const isl = islands.find((i) => i.id === id); if (isl && !ordered.includes(isl)) ordered.push(isl); }
    for (const isl of islands) if (!ordered.includes(isl)) ordered.push(isl);
    const things: Thing[] = ordered.map((isl, i) => {
      // What grew there stands on it, as on the flat map (src/lib/growth.ts).
      const g = growthLand(growth[isl.id] ?? [], isl.def.land);
      const s = SLOT_SPOTS[i % SLOT_SPOTS.length];
      return { lon: s.lon, lat: s.lat, w: 140, base: isl.def.base, land: [...g.back, ...(isl.def.land ?? []), ...g.front], island: isl };
    });
    const byId = new Map(things.map((x) => [x.island!.id, x]));
    // The boat sails beside the island she answered last.
    const nearThing = (near && byId.get(near)) || things[0];
    const BOAT: Thing = nearThing ? { lon: nearThing.lon + 10, lat: nearThing.lat - 6, w: 46 } : { lon: 1, lat: 5, w: 46 };

    let W = 0, H = 0, dpr = 1;
    const geom = () => { const R = Math.max(W * 1.02, H * .6), top = H * .17; return { R, cx: W / 2, cy: top + R, top }; };
    /** the elevation of the spot in the middle of the screen */
    const focusLat = () => { const g = geom(); return Math.asin(clamp((g.cy - H * .5) / g.R, -1, 1)); };
    // how far the ball may tilt (every slot can come to the middle)
    const LAT_MIN = -32 * DEG, LAT_MAX = 38 * DEG;
    const pitchLimits = () => { const f = focusLat(); return [LAT_MIN - f, LAT_MAX - f] as const; };
    // home is her boat in the middle (beside the island she answered last), so "Back to me" means it
    const home = () => { const [lo, hi] = pitchLimits(); return { yaw: -BOAT.lon * DEG, pitch: clamp(BOAT.lat * DEG - focusLat(), lo, hi) }; };
    let yaw = 0, pitch = 0, wYaw = 0, wPitch = 0;
    let M: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    const setM = () => { M = mul(axisRot([1, 0, 0], pitch), axisRot([0, 1, 0], yaw)); };

    // The still parts, drawn once per size and theme: sky, halo, sea, light, sun spot; and the rim haze.
    const base = document.createElement("canvas"), rim = document.createElement("canvas");
    const paintLayers = () => {
      const g = geom();
      for (const c of [base, rim]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
      const b = base.getContext("2d")!; b.setTransform(dpr, 0, 0, dpr, 0, 0);
      // the sky, continuing the map header, warm at the horizon (indigo at night)
      const sky = b.createLinearGradient(0, 0, 0, g.top + 24);
      if (night) { sky.addColorStop(0, "#141C39"); sky.addColorStop(.6, "#2A2F6E"); sky.addColorStop(1, "#4A4596"); }
      else { sky.addColorStop(0, "#E3F3F8"); sky.addColorStop(.6, "#EEF0F8"); sky.addColorStop(1, "#FBF1DD"); }
      b.fillStyle = sky; b.fillRect(0, 0, W, H);
      // the air around the ball
      const glow = b.createRadialGradient(g.cx, g.cy, g.R * .985, g.cx, g.cy, g.R * 1.08);
      glow.addColorStop(0, night ? "rgba(140,150,255,.38)" : "rgba(196,240,250,.9)"); glow.addColorStop(1, night ? "rgba(140,150,255,0)" : "rgba(196,240,250,0)");
      b.fillStyle = glow; b.beginPath(); b.arc(g.cx, g.cy, g.R * 1.08, 0, 7); b.fill();
      // the sea: brightest where it faces you
      const sea = b.createRadialGradient(g.cx, g.cy, g.R * .15, g.cx, g.cy, g.R);
      if (night) { sea.addColorStop(0, "#2F3F86"); sea.addColorStop(.72, "#27347A"); sea.addColorStop(1, "#212C66"); }
      else { sea.addColorStop(0, "#9BE1EE"); sea.addColorStop(.72, "#62C3DA"); sea.addColorStop(1, "#4AAFCC"); }
      b.fillStyle = sea; b.beginPath(); b.arc(g.cx, g.cy, g.R, 0, 7); b.fill();
      // one light from the top left for everything
      b.save(); b.beginPath(); b.arc(g.cx, g.cy, g.R, 0, 7); b.clip();
      const wash = b.createLinearGradient(0, g.top, W, H);
      wash.addColorStop(0, night ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.12)"); wash.addColorStop(1, night ? "rgba(10,14,50,.18)" : "rgba(16,42,86,.10)");
      b.fillStyle = wash; b.fillRect(0, 0, W, H);
      const sun = sunSpot(), spot = b.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, sun.r);
      spot.addColorStop(0, night ? "rgba(200,220,255,.18)" : "rgba(255,255,255,.35)"); spot.addColorStop(1, "rgba(255,255,255,0)");
      b.fillStyle = spot; b.fillRect(sun.x - sun.r, sun.y - sun.r, sun.r * 2, sun.r * 2);
      b.restore();
      const r = rim.getContext("2d")!; r.setTransform(dpr, 0, 0, dpr, 0, 0);
      const haze = r.createRadialGradient(g.cx, g.cy, g.R * .86, g.cx, g.cy, g.R);
      haze.addColorStop(0, "rgba(255,255,255,0)"); haze.addColorStop(1, night ? "rgba(150,180,255,.28)" : "rgba(220,245,255,.5)");
      r.fillStyle = haze; r.beginPath(); r.arc(g.cx, g.cy, g.R, 0, 7); r.fill();
    };
    const sunSpot = () => { const g = geom(); return { x: g.cx - g.R * .3, y: g.top + g.R * .2, r: g.R * .18 }; };

    const resize = () => {
      const r = box.getBoundingClientRect(); W = r.width; H = r.height; dpr = Math.min(devicePixelRatio || 1, 2);
      // only when the size changed: setting it blanks the picture until the next frame
      const cw = Math.round(W * dpr), ch = Math.round(H * dpr);
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
      const [lo, hi] = pitchLimits(); pitch = clamp(pitch, lo, hi);
      paintLayers(); setM(); kick();
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(box);
    // as it was, or her islands in the middle
    { const v = VIEW ?? home(); yaw = v.yaw; pitch = v.pitch; const [lo, hi] = pitchLimits(); pitch = clamp(pitch, lo, hi); setM(); }

    // Where a thing is drawn: on the front it stands upright and grows toward
    // you; just past the horizon it sinks, bottom first.
    const place = (o: Thing) => {
      const g = geom(), [x, y, z] = app(M, vec(o.lon, o.lat));
      return { x: g.cx + g.R * x, y: g.cy - g.R * y, z, sc: (W / 390) * (.28 + .62 * Math.max(z, 0)), al: smooth(0, .12, z) };
    };
    type P = ReturnType<typeof place>;
    const shown = (p: P) => p.al > .01 && p.y < H + 80 && p.x > -140 && p.x < W + 140;

    // Silhouettes for the haze, one per picture and colour.
    const silhouettes = new Map<string, HTMLCanvasElement>();
    const HAZE = night ? "rgb(150,180,255)" : "rgb(220,245,255)";
    const silhouette = (n: string, im: HTMLImageElement) => {
      let s = silhouettes.get(n);
      if (!s) {
        s = document.createElement("canvas"); s.width = im.naturalWidth; s.height = im.naturalHeight;
        const c = s.getContext("2d")!; c.drawImage(im, 0, 0); c.globalCompositeOperation = "source-in"; c.fillStyle = HAZE; c.fillRect(0, 0, s.width, s.height);
        silhouettes.set(n, s);
      }
      return s;
    };
    // Name pills, drawn once per name (a shadow blur every frame is slow).
    const pills = new Map<string, HTMLCanvasElement>();
    const pillCanvas = (text: string, icon: string) => {
      const key = `${text}|${icon}|${dpr}`;
      let c = pills.get(key);
      const im = pic(icon);
      if (!c && ready(im)) {
        const m = document.createElement("canvas").getContext("2d")!; m.font = `700 14px ${FONT}`;
        const w = Math.ceil(m.measureText(text).width) + 40, h = 30, pad = 12;
        c = document.createElement("canvas"); c.width = (w + pad * 2) * dpr; c.height = (h + pad * 2) * dpr;
        const p = c.getContext("2d")!; p.setTransform(dpr, 0, 0, dpr, 0, 0); p.translate(pad, pad);
        p.shadowColor = "rgba(20,60,80,.28)"; p.shadowBlur = 10; p.shadowOffsetY = 3; p.fillStyle = "#fff"; roundPath(p, 0, 0, w, h, h / 2); p.fill(); p.shadowColor = "transparent";
        p.drawImage(im, 4, 3, 24, 24);
        p.font = `700 14px ${FONT}`; p.fillStyle = "#13303D"; p.textBaseline = "middle"; p.fillText(text, 32, h / 2 + 1);
        pills.set(key, c);
      }
      return c;
    };

    // Touch feedback: a press (sinks, like the flat map's islands), rings on the water, a lit name.
    let press: { o: Thing; t0: number; up?: number; k0?: number } | null = null;
    const pressK = (o: Thing, now: number) => {
      if (!press || press.o !== o || reduce) return 0;
      if (press.up == null) return Math.min(1, (now - press.t0) / 90);
      const u = (now - press.up) / 420;
      if (u >= 1) { press = null; return 0; }
      return (press.k0 ?? 1) * (1 - settle(u));
    };
    const releasePress = (now: number) => { if (press && press.up == null) { press.k0 = Math.min(1, (now - press.t0) / 90); press.up = now; } };
    const rings: { o?: Thing; x?: number; y?: number; t0: number; w?: number }[] = [];
    let lit: { id: IslandId; t0: number } | null = null;

    // the walkway between two linked islands: planks across a path along the ball
    const walkway = (A: Thing, B: Thing) => {
      const va = vec(A.lon, A.lat), vb = vec(B.lon, B.lat), om = Math.acos(clamp(va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2], -1, 1));
      if (om < 1e-3) return;
      const g = geom(), pa = place(A), pb = place(B), pts: { x: number; y: number; z: number }[] = [];
      for (let j = 0; j <= 24; j++) {
        const s = j / 24, k1 = Math.sin((1 - s) * om) / Math.sin(om), k2 = Math.sin(s * om) / Math.sin(om);
        const [x, y, z] = app(M, [va[0] * k1 + vb[0] * k2, va[1] * k1 + vb[1] * k2, va[2] * k1 + vb[2] * k2]);
        const px = g.cx + g.R * x, py = g.cy - g.R * y;
        // not on the islands themselves
        if (Math.hypot(px - pa.x, (py - pa.y) * 1.8) < A.w * pa.sc * .42 || Math.hypot(px - pb.x, (py - pb.y) * 1.8) < B.w * pb.sc * .42) continue;
        pts.push({ x: px, y: py + 4 * (W / 390), z });
      }
      if (pts.length < 2) return;
      const wood = night ? ["#ECAB64", "#B97E43"] : ["#DDAC8B", "#C59374"];
      let carry = 0;
      for (let j = 1; j < pts.length; j++) {
        const a = pts[j - 1], b = pts[j], seg = Math.hypot(b.x - a.x, b.y - a.y);
        const k = (W / 390) * (.28 + .62 * Math.max(0, (a.z + b.z) / 2)), al = smooth(.05, .25, (a.z + b.z) / 2);
        if (al <= .02 || seg < .5) { carry = 0; continue; }
        const ux = (b.x - a.x) / seg, uy = (b.y - a.y) / seg, nx = -uy, ny = ux, gap = 6 * k / .9, half = 7 * k / .9;
        ctx.save(); ctx.globalAlpha = al;
        // the rails and their soft shadow
        ctx.lineCap = "round"; ctx.strokeStyle = "rgba(16,42,56,.16)"; ctx.lineWidth = 2;
        for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(a.x + nx * half * side, a.y + ny * half * side + 2); ctx.lineTo(b.x + nx * half * side, b.y + ny * half * side + 2); ctx.stroke(); }
        for (let d = gap - carry; d < seg; d += gap) {
          const cx0 = a.x + ux * d, cy0 = a.y + uy * d, th = 3.5 * k / .9;
          ctx.fillStyle = wood[1]; ctx.beginPath(); ctx.moveTo(cx0 - nx * half, cy0 - ny * half + th * .5); ctx.lineTo(cx0 + nx * half, cy0 + ny * half + th * .5); ctx.lineTo(cx0 + nx * half + ux * th, cy0 + ny * half + uy * th + th * .5); ctx.lineTo(cx0 - nx * half + ux * th, cy0 - ny * half + uy * th + th * .5); ctx.fill();
          ctx.fillStyle = wood[0]; ctx.beginPath(); ctx.moveTo(cx0 - nx * half, cy0 - ny * half); ctx.lineTo(cx0 + nx * half, cy0 + ny * half); ctx.lineTo(cx0 + nx * half + ux * th, cy0 + ny * half + uy * th); ctx.lineTo(cx0 - nx * half + ux * th, cy0 - ny * half + uy * th); ctx.fill();
          carry = seg - d;
        }
        ctx.strokeStyle = wood[1]; ctx.lineWidth = 1.2;
        for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(a.x + nx * half * side, a.y + ny * half * side); ctx.lineTo(b.x + nx * half * side, b.y + ny * half * side); ctx.stroke(); }
        ctx.restore();
      }
    };

    let dragging = false, awayNow = false, lastT = 0, anim: { y0: number; p0: number; y1: number; p1: number; t0: number; then?: () => void } | null = null;
    let snapBack: { from: number; to: number; t0: number } | null = null;
    let lastNear: IslandId | null = null, lastTick = 0;
    // (any sheet or dialog over it: You, Settings, the island sheets)
    const idleLife = () => !reduce && !pausedRef.current && !document.hidden && !document.querySelector('[role="dialog"]');

    function frame() {
      raf = 0;
      const now = performance.now(), dt = lastT ? clamp(now - lastT, 0, 32) : 16;
      lastT = now;
      let moving = false;
      const g = geom(), [lo, hi] = pitchLimits();
      if (anim) {
        const u = reduce ? 1 : Math.min(1, (now - anim.t0) / 350), e = easeOut(u);
        yaw = anim.y0 + (anim.y1 - anim.y0) * e; pitch = anim.p0 + (anim.p1 - anim.p0) * e; moving = true;
        if (u >= 1) { const then = anim.then; anim = null; then?.(); }
      } else if (!dragging && (wYaw || wPitch)) {
        yaw += wYaw * dt; pitch += wPitch * dt;
        const f = Math.pow(.996, dt); wYaw *= f; wPitch *= f;
        if (pitch < lo || pitch > hi) { pitch = clamp(pitch, lo, hi); wPitch = 0; }
        if (Math.hypot(wYaw, wPitch) * g.R < .008) wYaw = wPitch = 0;
        moving = true;
      } else if (snapBack) {
        const u = Math.min(1, (now - snapBack.t0) / 300);
        pitch = snapBack.from + (snapBack.to - snapBack.from) * easeOut(u); moving = true;
        if (u >= 1) snapBack = null;
      }
      yaw = wrapAngle(yaw);
      setM();
      VIEW = { yaw, pitch };

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      ctx.drawImage(base, 0, 0, W, H);
      const life = idleLife(), clock = life ? now : 0;
      // stars at night, above the ball
      if (night) {
        ctx.save(); ctx.fillStyle = "#fff";
        for (const s of STARS) { const x = s.fx * W, y = s.fy * g.top * .95; ctx.globalAlpha = .45 + .35 * Math.sin(clock / 1300 + s.ph); ctx.beginPath(); ctx.arc(x, y, s.r, 0, 7); ctx.fill(); }
        ctx.restore();
      }
      const P = new Map<Thing, P>();
      const at = (o: Thing) => { let p = P.get(o); if (!p) { p = place(o); P.set(o, p); } return p; };
      // on the ball: glints, shores and shadows, walkways, rings
      ctx.save(); ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R, 0, 7); ctx.clip();
      const sun = sunSpot(), reach = g.R * .55;
      ctx.fillStyle = "#fff";
      for (const gl of GLINTS) {
        const [x, y, z] = app(M, gl.v); if (z < .05) continue;
        const sx = g.cx + g.R * x, sy = g.cy - g.R * y, d = Math.hypot(sx - sun.x, sy - sun.y); if (d > reach) continue;
        const w = 1 - d / reach, tw = .5 + .5 * Math.sin((clock / 2600) * Math.PI * 2 + gl.ph), rx = (2 + 4 * w) * (W / 390);
        ctx.globalAlpha = w * (.15 + .25 * tw); ctx.beginPath(); ctx.ellipse(sx, sy, rx, rx * (.25 + .2 * z), 0, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
      const breathe = 1 + (life ? .015 * (1 + Math.sin(clock / 4000 * Math.PI * 2)) : 0);
      const ground = (o: Thing, p: P, k: number, haze = 0) => {
        if (p.z < 0 || !shown(p)) return;
        const w = o.w * p.sc, wl = p.y, flat = .45 + .55 * p.z;
        // a soft contact shadow, then her shallows
        const rx = w * .42 * (1 - .25 * k), ry = rx * .25 * flat, sh = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        sh.addColorStop(0, night ? "rgba(5,8,30,.30)" : "rgba(16,42,56,.16)"); sh.addColorStop(1, "rgba(16,42,56,0)");
        ctx.save(); ctx.translate(p.x + 3, wl + 4); ctx.scale(rx, ry); ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(0, 0, 1, 0, 7); ctx.fill(); ctx.restore();
        const rip = pic("water_ripple");
        if (ready(rip)) {
          const sw = w * 1.3 * breathe, shh = sw * .33 * flat;
          ctx.save(); ctx.globalAlpha = (night ? .6 : .85) * (1 - haze); ctx.drawImage(rip, p.x - sw / 2, wl - shh / 2 + 5 * k, sw, shh); ctx.restore();
        }
      };
      for (const o of [...ISLETS, ...UNEXPLORED, ...things]) ground(o, at(o), pressK(o, now), o.islet ? .25 : 0);
      if (GLOBE_BRIDGES) for (const r of bridges) { const A = byId.get(r.a), B = byId.get(r.b); if (A && B) walkway(A, B); }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i], dur = reduce ? 300 : 780, u = (now - r.t0) / dur;
        if (u >= 1) { rings.splice(i, 1); continue; }
        let x: number, y: number, w: number, z = 1;
        if (r.o) { const p = at(r.o); if (p.z < 0) continue; w = r.o.w * p.sc; x = p.x; y = p.y; z = p.z; } else { x = r.x!; y = r.y!; w = r.w!; }
        const grow = reduce ? 1 : .35 + 1.15 * (1 - Math.pow(1 - u, 2.4));
        ctx.save(); ctx.globalAlpha = .95 * (1 - u); ctx.strokeStyle = night ? "rgba(190,215,255,.55)" : "rgba(255,255,255,.9)"; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(x, y, w * grow / 2, w * grow / 2 * .33 * (.45 + .55 * z), 0, 0, 7); ctx.stroke(); ctx.restore();
      }
      ctx.restore();
      if (rings.length || press) moving = true;

      // the pictures, back to front: upright; past the horizon only what
      // sticks up above it shows (bottom first), hazed. Since her note on v23
      // ("как будто левитируют"): each stands on its spot, its waterline on the
      // water, leaning with the ball, and fades out before the horizon.
      const sprite = (o: Thing, p: P, k: number) => {
        if (!shown(p)) return;
        const w = o.w * p.sc;
        ctx.save();
        const lean = (Math.atan2(p.y - g.cy, p.x - g.cx) + Math.PI / 2) * .8;
        ctx.globalAlpha = p.al; ctx.translate(p.x, p.y + 5 * k * (W / 390)); ctx.rotate(lean); ctx.scale(1 - .07 * k, 1 - .07 * k);
        const haze = o.islet ? .25 : 0, fog = Math.max(haze, .45 * (1 - smooth(.08, .45, p.z)));
        const draw = (n: string, cx: number, cy: number, dw: number, flip = false) => {
          const im = pic(n); if (!ready(im)) return; const dh = dw * im.naturalHeight / im.naturalWidth;
          ctx.save(); if (flip) { ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.translate(-cx, 0); }
          ctx.drawImage(im, cx - dw / 2, cy - dh / 2, dw, dh);
          if (fog > .01) { const a = ctx.globalAlpha; ctx.globalAlpha = a * fog; ctx.drawImage(silhouette(n, im), cx - dw / 2, cy - dh / 2, dw, dh); ctx.globalAlpha = a; }
          ctx.restore();
        };
        if (o.locked) draw("unexplored", 0, -w * .28, w);
        else if (o.islet) draw(o.islet, 0, -w * .1, w, o.flip);
        else if (o.base) {
          // the base picture's waterline (about 68% down) on the spot
          const im = pic(o.base), up = -(ready(im) ? w * im.naturalHeight / im.naturalWidth : w * .7) * .18;
          draw(o.base, 0, up, w); (o.land ?? []).forEach(([n, lw, dx, dy]) => draw(n, dx * w, up + dy * w, lw * w));
        }
        ctx.restore();
      };
      const items = [...ISLETS, ...UNEXPLORED, ...things].map((o) => ({ o, p: at(o) })).sort((m, n) => m.p.z - n.p.z);
      items.forEach(({ o, p }) => sprite(o, p, pressK(o, now)));

      // the little boat: you, among your islands, bobbing a little
      const bp = at(BOAT), boat = pic("sailboat");
      if (ready(boat) && shown(bp) && bp.z > 0) {
        const bob = life ? Math.sin(clock / 3000 * Math.PI * 2) : 0, w = 46 * bp.sc, h = w * boat.naturalHeight / boat.naturalWidth, k = pressK(BOAT, now);
        ctx.save(); ctx.translate(bp.x, bp.y + bob * 1.5 + 4 * k); ctx.rotate(bob * 2 * DEG); ctx.scale(1 - .07 * k, 1 - .07 * k);
        ctx.fillStyle = "rgba(16,42,56,.15)"; ctx.beginPath(); ctx.ellipse(2, h * .42, w * .42, w * .1, 0, 0, 7); ctx.fill();
        ctx.drawImage(boat, -w / 2, -h / 2, w, h);
        // she sits in it: the animal, then the hull again over its lower half
        const im = avatarImg();
        if (ready(im)) {
          const a = w * .62;
          ctx.drawImage(im, -w * .08 - a / 2, h * .18 - a, a, a);
          ctx.save(); ctx.beginPath(); ctx.rect(-w / 2, h * (.5 - .38), w, h * .38); ctx.clip(); ctx.drawImage(boat, -w / 2, -h / 2, w, h); ctx.restore();
        }
        ctx.restore();
      }
      const isAway = !anim && (bp.z < .6 || bp.x < 20 || bp.x > W - 20 || bp.y < g.top + 30 || bp.y > H - 170);
      if (isAway !== awayNow) { awayNow = isAway; setAway(isAway); }
      // weather on each island's corner, then the names, so nothing covers them
      for (const o of things) {
        const isl = o.island!, p = at(o), sk = isl.weather ? SKY[isl.weather] : null;
        if (!sk || !shown(p) || p.z < .3) continue;
        const im = pic(sk[0]), a = Math.min(1, (p.z - .3) * 3);
        if (ready(im)) { const w = sk[1] * p.sc, h = w * im.naturalHeight / im.naturalWidth; ctx.save(); ctx.globalAlpha = a; ctx.drawImage(im, p.x + .3 * o.w * p.sc - w / 2, p.y - o.w * p.sc * .47 - h * .8, w, h); ctx.restore(); }
      }
      for (const o of things) {
        const isl = o.island!, p = at(o); if (!shown(p) || p.z < .3) continue;
        const c = pillCanvas(islandName(t, isl.id), "icon_" + isl.def.icon); if (!c) continue;
        const cw = c.width / dpr, ch = c.height / dpr, hot = lit && lit.id === isl.id ? Math.max(0, 1 - (now - lit.t0) / 300) : 0;
        ctx.save(); ctx.globalAlpha = Math.min(1, (p.z - .3) * 3); ctx.translate(p.x, p.y + o.w * p.sc * .22); ctx.scale(1 + .06 * hot, 1 + .06 * hot);
        ctx.drawImage(c, -cw / 2, -ch / 2, cw, ch);
        if (hot > 0) { ctx.strokeStyle = "#1E9C8C"; ctx.lineWidth = 2; roundPath(ctx, -cw / 2 + 11, -ch / 2 + 11, cw - 22, ch - 22, (ch - 22) / 2); ctx.stroke(); moving = true; }
        ctx.restore();
      }
      ctx.drawImage(rim, 0, 0, W, H);

      // a light tick as an island passes the middle (only while she turns it)
      if (dragging || wYaw || wPitch) {
        const f = focusLat(); let best: IslandId | null = null, bd = 15;
        for (const o of things) { const v = app(M, vec(o.lon, o.lat)), d = Math.acos(clamp(v[1] * Math.sin(f) + v[2] * Math.cos(f), -1, 1)) / DEG; if (d < bd) { bd = d; best = o.island!.id; } }
        if (best !== lastNear) { if (best && now - lastTick > 120) { haptics.tick(); playWheelTick(); lastTick = now; } lastNear = best; }
      }

      if (moving || dragging) kick();
      else { lastT = 0; if (life && !idle) idle = window.setTimeout(() => { idle = 0; kick(); }, 33); }
    }

    // turn the ball so (lon, lat) is in the middle, then run `then`
    const turnTo = (lon: number, lat: number, then?: () => void) => {
      const [lo, hi] = pitchLimits(), y1 = yaw + wrapAngle(-lon * DEG - yaw), p1 = clamp(lat * DEG - focusLat(), lo, hi);
      wYaw = wPitch = 0; snapBack = null;
      anim = { y0: yaw, p0: pitch, y1, p1, t0: performance.now(), then }; kick();
    };
    const nearMiddle = (o: Thing) => { const v = app(M, vec(o.lon, o.lat)), f = focusLat(); return Math.acos(clamp(v[1] * Math.sin(f) + v[2] * Math.cos(f), -1, 1)) / DEG < 3; };
    // what is under the finger: her islands, the clouds, the islets, the boat (front of the ball only)
    const hitTest = (x: number, y: number): Thing | null => {
      let best: Thing | null = null, bd = 1e9;
      for (const o of [...things, ...UNEXPLORED, ...ISLETS, BOAT]) {
        const p = place(o); if (p.z < .05 || !shown(p)) continue;
        const cy = o.locked ? p.y - o.w * p.sc * .3 : o.islet || o === BOAT ? p.y : p.y - o.w * p.sc * .13, d = Math.hypot(p.x - x, cy - y), r = Math.max(22, .6 * o.w * p.sc);
        if (d < r && d < bd) { bd = d; best = o; }
      }
      return best;
    };
    const tap = (x: number, y: number, o: Thing | null) => {
      const now = performance.now();
      if (!o) { haptics.soft(); rings.push({ x, y, w: 56, t0: now }); kick(); return; }
      if (o === BOAT) { haptics.soft(); window.dispatchEvent(new CustomEvent("memap-open-you")); return; }
      rings.push({ o, t0: now }); kick();
      if (o.locked || o.islet) { haptics.soft(); setNote(t("map.unexplored")); return; }
      haptics.pop(0.55); playBloop(x / W);
      const id = o.island!.id;
      lit = { id, t0: now };
      if (nearMiddle(o)) window.setTimeout(() => { if (alive) onOpenRef.current(id); }, reduce ? 0 : 160);
      else turnTo(o.lon, o.lat, () => { if (alive) onOpenRef.current(id); });
    };

    // input: the spot under the finger follows it; a flick glides on; a touch stops it
    let pointer: number | null = null, start: [number, number] = [0, 0], last: [number, number] = [0, 0], downAt = 0, moved = 0, stopped = false;
    let samples: { t: number; x: number; y: number }[] = [];
    const local = (ev: PointerEvent): [number, number] => { const r = canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
    const gains = () => { const g = geom(), f = focusLat(); return { gy: 1 / (g.R * Math.max(.6, Math.cos(f + pitch))), gp: 1 / (g.R * Math.cos(f)) }; };
    const onDown = (ev: PointerEvent) => {
      if (pointer !== null) return; // a second finger: ignored
      try { canvas.setPointerCapture(ev.pointerId); } catch { /* synthetic events */ }
      pointer = ev.pointerId; setNote(null);
      const p = local(ev); start = p; last = p; downAt = performance.now(); moved = 0; samples = [{ t: ev.timeStamp, x: p[0], y: p[1] }];
      // a touch stops the ball; if it was moving fast, this touch is not a tap
      stopped = Math.hypot(wYaw, wPitch) * geom().R > .05 || !!anim;
      wYaw = wPitch = 0; anim = null; snapBack = null; dragging = true;
      const o = hitTest(p[0], p[1]);
      if (o && !stopped) press = { o, t0: performance.now() };
      kick();
    };
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointer) return;
      const evs = (typeof ev.getCoalescedEvents === "function" ? ev.getCoalescedEvents() : []) as PointerEvent[];
      for (const e of evs.length ? evs : [ev]) {
        const p = local(e), dx = p[0] - last[0], dy = p[1] - last[1]; last = p;
        moved = Math.max(moved, Math.hypot(p[0] - start[0], p[1] - start[1]));
        const { gy, gp } = gains(), [lo, hi] = pitchLimits();
        yaw += dx * gy;
        const np = pitch + dy * gp;
        // past a limit it gives only a little (it eases back on release)
        pitch = np < lo || np > hi ? clamp(pitch + dy * gp * .35, lo - .2, hi + .2) : np;
        samples.push({ t: e.timeStamp, x: p[0], y: p[1] });
      }
      const tNow = ev.timeStamp; samples = samples.filter((s) => tNow - s.t < 100);
      if (moved > 10 && press && press.up == null) releasePress(performance.now());
      if (moved > 12) setHint(false);
      kick();
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointer) return;
      pointer = null; dragging = false;
      const now = performance.now(), [lo, hi] = pitchLimits();
      // the fling: the last 80 ms of the drag, if the finger was still moving
      const newest = samples[samples.length - 1], recent = samples.filter((s) => newest && newest.t - s.t <= 80);
      // (a tap's jitter is not a flick)
      if (!reduce && moved > 10 && newest && ev.timeStamp - newest.t < 50 && recent.length > 1 && newest.t - recent[0].t >= 10) {
        const span = newest.t - recent[0].t, { gy, gp } = gains();
        let vx = (newest.x - recent[0].x) / span, vy = (newest.y - recent[0].y) / span;
        const sp = Math.hypot(vx, vy); if (sp > .85) { vx *= .85 / sp; vy *= .85 / sp; }
        wYaw = vx * gy; wPitch = pitch <= lo || pitch >= hi ? 0 : vy * gp;
      }
      if (pitch < lo || pitch > hi) { wPitch = 0; snapBack = { from: pitch, to: clamp(pitch, lo, hi), t0: now }; }
      const o = press?.o ?? null;
      releasePress(now);
      if (!stopped && moved <= 10 && now - downAt <= 500) { const p = local(ev); tap(p[0], p[1], o ?? hitTest(p[0], p[1])); }
      samples = [];
      kick();
    };
    const onCancel = (ev: PointerEvent) => { if (ev.pointerId !== pointer) return; pointer = null; dragging = false; releasePress(performance.now()); samples = []; kick(); };
    const onVisible = () => { if (!document.hidden) kick(); };
    canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove); canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onCancel);
    document.addEventListener("visibilitychange", onVisible);

    // for the tests in development: how it is turned, where an island is drawn
    if (import.meta.env.DEV) (window as unknown as { __globe?: unknown }).__globe = {
      state: () => ({ yaw, pitch, wYaw, wPitch }),
      at: (id: IslandId) => { const o = byId.get(id); if (!o) return null; const p = place(o); return { x: p.x, y: p.y, z: p.z }; },
    };
    api.current = { home: () => { const h = home(); wYaw = wPitch = 0; snapBack = null; anim = { y0: yaw, p0: pitch, y1: yaw + wrapAngle(h.yaw - yaw), p1: h.pitch, t0: performance.now() }; kick(); } };
    kick();
    return () => {
      alive = false; cancelAnimationFrame(raf); window.clearTimeout(idle); window.clearTimeout(ahead); ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove); canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onCancel);
      document.removeEventListener("visibilitychange", onVisible);
      kickRef.current = () => undefined;
    };
  }, [islands, routes, growth, avatar, near, t, night]);

  return (
    <div ref={wrap} className="relative h-full w-full overflow-hidden select-none">
      <canvas ref={cv} className="globe-in absolute inset-0 h-full w-full touch-none" aria-label={t("map.aria")} />
      {hint && (
        <div className="pointer-events-none absolute left-1/2 top-[40px] z-[2] -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-3.5 py-2 text-sm font-bold text-muted-foreground shadow-sm">{t("map.hint")}</div>
      )}
      <button type="button" onClick={() => api.current?.home()} aria-label={t("map.backToMe")}
        className={`absolute right-4 z-[3] flex h-12 items-center gap-2 rounded-full bg-white pl-2 pr-4 text-[15px] font-extrabold text-primary shadow-lg transition-all duration-200 ${away ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`}
        style={{ bottom: "calc(7.5rem + env(safe-area-inset-bottom, 0px))" }}>
        <img src={mapPic("sailboat")} alt="" className="h-8 w-8 rounded-full bg-sky-50 object-contain p-0.5 ring-2 ring-primary" />{t("map.backToMe")}
      </button>
      {note && (
        <div className="absolute left-4 right-4 z-[3] flex items-center gap-3 rounded-[22px] border border-foreground/10 bg-white/95 p-3.5 shadow-lg dark:bg-[hsl(var(--surface))]" style={{ bottom: "calc(7.5rem + env(safe-area-inset-bottom, 0px))" }}>
          <img src={mapPic("unexplored")} alt="" className="h-11 w-14 shrink-0 object-contain" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold uppercase tracking-wider text-primary">{t("map.unexploredLabel")}</p>
            <p className="text-[15px] font-semibold leading-snug text-muted-foreground">{note}</p>
            {onNewIsland && (
              <button type="button" onClick={() => { haptics.tap(); setNote(null); onNewIsland(); }}
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
