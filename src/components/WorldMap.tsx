// Your world (Aurora UX step: the Map, Nov 1 2026). The top of a big ball
// you roll with a finger, like the ball of a roll-on: islands come up from
// below and sink past the horizon. Her calls while testing the demo: only the
// top of the ball shows; it must roll calmly and stop (it made her dizzy);
// no idle spinning; a "Back to me" pill when you roll away; unexplored land
// is her plain cloud. "Map" melts the ball into a flat map.
// Nov 3 2026 (the "Improve Map & Globe" brief she brought): a sea sphere with
// depth (bright where it faces you, a light edge of air at the horizon, no
// dark rim); islands sink behind the horizon instead of standing in the sky;
// fewer waves and filler islands, so hers lead; a found link is a line on
// the ball (no flat bridge pictures); weather sits on its island's corner.
// Later that night: it rolls with the finger (it was "слишком туго"), glides
// on after a flick and slows down by itself; a tapped island presses in and a
// ring spreads on the water; day/night redraws it in place, turned as it was.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Island, IslandId, Route, islandName, isNightMap, mapPic, mapPicFor } from "@/lib/islands";
import { growthLand, type GrowthKind } from "@/lib/growth";
import { haptics } from "@/lib/haptics";
import { playBloop } from "@/lib/feedback";

type V3 = [number, number, number];
type M3 = number[];
const mul = (A: M3, B: M3): M3 => { const C: number[] = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) C[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c]; return C; };
const axisRot = ([x, y, z]: V3, a: number): M3 => { const c = Math.cos(a), s = Math.sin(a), t = 1 - c; return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c]; };
const app = (A: M3, [x, y, z]: V3): V3 => [A[0] * x + A[1] * y + A[2] * z, A[3] * x + A[4] * y + A[5] * z, A[6] * x + A[7] * y + A[8] * z];
const vec = (lon: number, lat: number): V3 => { const l = lon * Math.PI / 180, p = lat * Math.PI / 180; return [Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l)]; };
const ease = (x: number) => (x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

// Pictures by address, kept across redraws (day/night, her avatar), so a
// switch never shows the ball without its islands.
const IMAGES = new Map<string, HTMLImageElement>();
const image = (url: string) => {
  let im = IMAGES.get(url);
  if (!im) { im = new Image(); im.decoding = "async"; im.src = url; IMAGES.set(url, im); }
  return im;
};

interface Thing { lon: number; lat: number; w: number; base?: string; land?: [string, number, number, number][]; cloud?: boolean; locked?: boolean; fx?: number; fy?: number; island?: Island }

// Scenery all over the ball so rolling always brings something new; kept away from her islands.
const UNEXPLORED: Thing[] = [{ lon: 30, lat: 36, fx: 318, fy: 64, w: 104 }, { lon: -38, lat: 31, w: 104 }, { lon: -32, lat: -38, w: 104 }, { lon: -150, lat: 2, w: 116 }, { lon: 122, lat: -12, w: 116 }, { lon: 178, lat: 50, w: 104 }]
  .map((l) => ({ ...l, locked: true }));
/** Angle between two points on the ball, in degrees. */
const apart = (a: { lon: number; lat: number }, b: { lon: number; lat: number }) => {
  const va = vec(a.lon, a.lat), vb = vec(b.lon, b.lat);
  return Math.acos(Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]))) * 180 / Math.PI;
};
const SCENERY: Thing[] = (() => {
  const kinds: Omit<Thing, "lon" | "lat">[] = [{ w: 130, base: "island_waterfall" }, { w: 120, base: "island_plain", land: [["palm_trees", .6, .02, -.46]] }, { w: 110, base: "island_rocky", land: [["pine_tree", .42, .06, -.5]] },
    { w: 120, base: "island_plain", land: [["green_tree", .45, .04, -.44]] }, { w: 110, base: "island_mountain" }, { w: 100, base: "island_rocky" }];
  const out: Thing[] = [], N = 36;
  for (let i = 0; i < N; i++) {
    const y = 1 - 2 * (i + .5) / N, lat = Math.asin(y) * 180 / Math.PI, lon = ((i * 137.508) % 360) - 180;
    const c = Math.cos(lat * Math.PI / 180) * Math.cos(lon * Math.PI / 180);
    if (Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI < 36) continue;
    if (UNEXPLORED.some((u) => apart(u, { lon, lat }) < 17)) continue;
    const kind = kinds[out.length % kinds.length];
    out.push({ lon, lat, ...kind, w: Math.round(kind.w * 0.85) });
  }
  return out;
})();
const BOAT: Thing = { lon: 1, lat: 5, fx: 210, fy: 322, w: 46 };

export const WorldMap = ({ islands, routes, growth = {}, avatar = null, onOpen }: { islands: Island[]; routes: Route[]; growth?: Record<string, GrowthKind[]>; avatar?: string | null; onOpen: (id: IslandId) => void }) => {
  const { t } = useTranslation();
  // Day or night: redrawn in place, the ball turned as it was (it used to
  // start over, and the Map tab fell back to the flat map).
  const [night, setNight] = useState(isNightMap);
  useEffect(() => {
    const sync = () => setNight(isNightMap());
    window.addEventListener("memap-theme-changed", sync);
    return () => window.removeEventListener("memap-theme-changed", sync);
  }, []);
  const camRef = useRef<M3 | null>(null);
  const flatRef = useRef(false);
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [flat, setFlat] = useState(false);
  const [away, setAway] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [hint, setHint] = useState(true);
  const api = useRef<{ setFlat: (v: boolean) => void; home: () => void } | null>(null);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  useEffect(() => {
    const canvas = cv.current!, box = wrap.current!, ctx = canvas.getContext("2d")!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const FONT = `"DM Sans", "Onest", system-ui, -apple-system, sans-serif`;
    let raf = 0, alive = true;
    const kick = () => { if (!raf && alive) raf = requestAnimationFrame(frame); };
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

    const things: Thing[] = islands.map((isl) => {
      // What grew there stands on it, as on the flat map (src/lib/growth.ts).
      const g = growthLand(growth[isl.id] ?? [], isl.def.land);
      return { lon: isl.slot.lon, lat: isl.slot.lat, fx: isl.slot.fx, fy: isl.slot.fy, w: 140, base: isl.def.base, land: [...g.back, ...(isl.def.land ?? []), ...g.front], island: isl };
    });
    const byId = new Map(things.map((x) => [x.island!.id, x]));

    let W = 0, H = 0, dpr = 1, M: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1], vx = 0, vy = 0, tv = 0, tTarget = 0;
    let spin: { k: number; M0: M3; axis: V3; ang: number; then?: () => void } | null = null;
    const geom = () => { const R = Math.max(W * 1.02, H * .6), top = H * .17; return { R, cx: W / 2, cy: top + R, top }; };
    const flatBox = () => { const s = Math.min(W / 370, (H - 150) / 600); return { s, ox: (W - 370 * s) / 2, oy: 64 + (H - 150 - 600 * s) / 2 }; };
    const focusDir = (): V3 => { const g = geom(), y = (g.cy - H * .5) / g.R; return [0, y, Math.sqrt(Math.max(0, 1 - y * y))]; };
    const roll = (dx: number, dy: number) => { if (dx) M = mul(axisRot([0, 1, 0], dx), M); if (dy) M = mul(axisRot([1, 0, 0], dy), M); };
    const resize = () => { const r = box.getBoundingClientRect(); W = r.width; H = r.height; dpr = Math.min(devicePixelRatio || 1, 3); canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); kick(); };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(box);
    { const f = focusDir(); roll(0, -(Math.asin(f[1]) + 2 * Math.PI / 180)); }
    const MHOME = M.slice();
    // drawn again (day/night, her avatar): as it was
    if (camRef.current) M = camRef.current.slice();
    tv = tTarget = flatRef.current ? 1 : 0;

    const place = (o: Thing, morph: boolean) => {
      const g = geom(), [x, y, z] = app(M, vec(o.lon, o.lat)), gx = g.cx + g.R * x, gy = g.cy - g.R * y;
      const e = ease(tv), k = W / 390, gs = k * (.28 + .62 * Math.max(z, 0)), f = Math.max(.22, z);
      let px = gx, py = gy, sc = gs, fz = f, al = Math.min(1, Math.max(0, (z - .02) / .2)) * (gy < H + 60 && gx > -120 && gx < W + 120 ? 1 : 0);
      if (morph && o.fx != null && o.fy != null) { const fb = flatBox(); px = gx + (fb.ox + o.fx * fb.s - gx) * e; py = gy + (fb.oy + o.fy * fb.s - gy) * e; sc = gs + (fb.s - gs) * e; fz = f + (1 - f) * e; al = al + (1 - al) * e; }
      else al *= 1 - e;
      return { x: px, y: py, z, sc, fz, al, ang: Math.atan2(gy - g.cy, gx - g.cx) * (1 - e) };
    };
    type P = ReturnType<typeof place>;
    // A tap: the island presses in and eases back up (no bounce), and a ring
    // spreads on the water around it.
    let press: { o: Thing; t0: number } | null = null;
    const rings: { o: Thing; t0: number }[] = [];
    const pressScale = (o: Thing, now: number) => {
      if (!press || press.o !== o) return 1;
      const u = now - press.t0;
      if (u < 110) return 1 - .08 * (u / 110);
      const v = Math.min(1, (u - 110) / 420);
      if (v >= 1) press = null;
      return .92 + .08 * (1 - Math.pow(1 - v, 3));
    };
    const drawThing = (o: Thing, p: P, k = 1) => {
      if (p.al <= .01) return;
      ctx.save(); ctx.globalAlpha = p.al; ctx.translate(p.x, p.y); ctx.rotate(p.ang); ctx.scale(p.fz * k, k); ctx.rotate(-p.ang);
      const draw = (n: string, cx: number, cy: number, w: number) => { const im = pic(n); if (!im.complete || !im.naturalWidth) return; const h = w * im.naturalHeight / im.naturalWidth; ctx.drawImage(im, cx - w / 2, cy - h / 2, w, h); return h; };
      if (o.locked) draw("unexplored", 0, -o.w * p.sc * .28, o.w * p.sc);
      else if (o.cloud) { const w = o.w * p.sc; draw("cloud_large", 0, -w * .7, w); draw("cloud_large", w * .3, -w * 1.05, w * .75); }
      else if (o.base) { const w = o.w * p.sc; draw(o.base, 0, 0, w); (o.land ?? []).forEach(([n, lw, dx, dy]) => draw(n, dx * w, dy * w, lw * w)); }
      ctx.restore();
    };
    const pill = (x: number, y: number, text: string, icon: string | null, a: number, small: boolean) => {
      if (a <= .02) return;
      ctx.save(); ctx.globalAlpha = a; ctx.font = `700 ${small ? 12 : 14}px ${FONT}`;
      const ih = icon ? 24 : 0, w = ctx.measureText(text).width + (icon ? ih + 16 : 20), h = small ? 24 : 30;
      ctx.shadowColor = "rgba(20,60,80,.28)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2); ctx.fill(); ctx.shadowColor = "transparent";
      if (icon) { const im = pic(icon); if (im.complete && im.naturalWidth) ctx.drawImage(im, x - w / 2 + 4, y - ih / 2, ih, ih); }
      ctx.fillStyle = small ? "#128373" : "#13303D"; ctx.textBaseline = "middle"; ctx.fillText(text, x - w / 2 + (icon ? ih + 8 : 10), y + 1); ctx.restore();
    };
    const SKY: Record<string, [string, number]> = { storm: ["thunder_cloud", 52], clouds: ["partly_cloudy", 46], sun: ["sun", 42] };
    const WAVES: V3[] = []; { const N = 110; for (let i = 0; i < N; i++) { const y = 1 - 2 * (i + .5) / N, r = Math.sqrt(1 - y * y), th = i * 2.399963; WAVES.push([r * Math.sin(th), y, r * Math.cos(th)]); } }

    let dragging = false, awayNow = false, lastT = 0;
    function frame() {
      raf = 0;
      let moving = false;
      // the glide counts time, not frames (60 or 120 a second)
      const now = performance.now(), dt = lastT ? Math.min(3, (now - lastT) / 16.7) : 1;
      lastT = now;
      if (spin) { spin.k = Math.min(1, spin.k + .06); M = mul(axisRot(spin.axis, spin.ang * ease(spin.k)), spin.M0); moving = true; if (spin.k >= 1) { const then = spin.then; spin = null; then?.(); } }
      else if (!dragging && (vx || vy)) { roll(vx * dt, vy * dt); const f = Math.pow(.95, dt); vx *= f; vy *= f; if (Math.abs(vx) + Math.abs(vy) < .0003) vx = vy = 0; moving = true; }
      if (tv !== tTarget) { tv += (tTarget - tv) * (reduce ? 1 : .14); if (Math.abs(tTarget - tv) < .002) tv = tTarget; moving = true; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const g = geom(), e = ease(tv), ga = 1 - e;
      if (e > .01) { const fb = flatBox(); ctx.save(); ctx.globalAlpha = e; const sea = ctx.createLinearGradient(0, fb.oy, 0, fb.oy + 600 * fb.s); sea.addColorStop(0, "#DDF2FA"); sea.addColorStop(1, "#BCDDED"); ctx.fillStyle = sea; ctx.beginPath(); ctx.roundRect(fb.ox, fb.oy, 370 * fb.s, 600 * fb.s, 24 * fb.s); ctx.fill(); ctx.restore(); }
      if (ga > .01) {
        ctx.save(); ctx.globalAlpha = ga;
        // the air around the ball: a light halo above the horizon
        const glow = ctx.createRadialGradient(g.cx, g.cy, g.R * .985, g.cx, g.cy, g.R * 1.08);
        glow.addColorStop(0, night ? "rgba(120,190,240,.42)" : "rgba(196,240,250,.9)"); glow.addColorStop(1, night ? "rgba(120,190,240,0)" : "rgba(196,240,250,0)");
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R * 1.08, 0, 7); ctx.fill();
        // the sea: brightest where it faces you, a little deeper toward the edge
        const sea = ctx.createRadialGradient(g.cx, g.cy, g.R * .15, g.cx, g.cy, g.R);
        if (night) { sea.addColorStop(0, "#3C9CB8"); sea.addColorStop(.72, "#2B82A2"); sea.addColorStop(1, "#246F93"); }
        else { sea.addColorStop(0, "#9BE1EE"); sea.addColorStop(.72, "#62C3DA"); sea.addColorStop(1, "#4AAFCC"); }
        ctx.fillStyle = sea; ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R, 0, 7); ctx.fill();
        // a soft sheen from the light above-left
        const sx0 = g.cx - g.R * .32, sy0 = g.top + g.R * .22;
        const sheen = ctx.createRadialGradient(sx0, sy0, 0, sx0, sy0, g.R * .75);
        sheen.addColorStop(0, night ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.3)"); sheen.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = sheen; ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R, 0, 7); ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineCap = "round";
        for (const v of WAVES) { const [x, y, z] = app(M, v); if (z < .04) continue; const sx = g.cx + g.R * x, sy = g.cy - g.R * y; if (sy > H + 20 || sx < -20 || sx > W + 20) continue; const s = (4 + 9 * z) * W / 390; ctx.globalAlpha = ga * (night ? .16 : .26) * Math.min(1, z * 2); ctx.lineWidth = 1.4 + 1.2 * z; ctx.beginPath(); ctx.moveTo(sx - s, sy); ctx.quadraticCurveTo(sx - s / 2, sy - s * .55 * z, sx, sy); ctx.quadraticCurveTo(sx + s / 2, sy + s * .55 * z, sx + s, sy); ctx.stroke(); }
        ctx.restore();
      }
      const P = new Map<IslandId, P>(); things.forEach((o) => P.set(o.island!.id, place(o, true)));
      const onBall = ga > .99;
      if (onBall) { ctx.save(); ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R, 0, 7); ctx.clip(); }
      // sea routes: along the ball, curves on the flat map
      routes.forEach(({ a, b, k, n }, i) => {
        const label = "🔗"; // numbers live in the island sheet now (her Nov 2 note)
        const A = byId.get(a), B = byId.get(b); if (!A || !B) return;
        if (ga > .01) {
          const va = vec(A.lon, A.lat), vb = vec(B.lon, B.lat), om = Math.acos(Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2])));
          ctx.save(); ctx.beginPath(); let pen = false;
          for (let j = 0; j <= 48; j++) { const s = j / 48, k1 = Math.sin((1 - s) * om) / Math.sin(om), k2 = Math.sin(s * om) / Math.sin(om); const [x, y, z] = app(M, [va[0] * k1 + vb[0] * k2, va[1] * k1 + vb[1] * k2, va[2] * k1 + vb[2] * k2]); const sx = g.cx + g.R * x, sy = g.cy - g.R * y; if (z > .02) { if (pen) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); pen = true; } else pen = false; }
          ctx.lineCap = "round"; ctx.lineJoin = "round";
          ctx.globalAlpha = ga * (night ? .35 : .45); ctx.strokeStyle = "#1E9C8C"; ctx.lineWidth = 8 * (W / 390); ctx.stroke();
          ctx.globalAlpha = ga * .95; ctx.strokeStyle = "#fff"; ctx.lineWidth = 3.2; ctx.setLineDash([1, 9]); ctx.stroke(); ctx.restore();
        }
        if (e > .01) { const fb = flatBox(), pa = P.get(a)!, pb = P.get(b)!, bend = (i % 2 ? -40 : 36) * fb.s, mx = (pa.x + pb.x) / 2 + bend, my = (pa.y + pb.y) / 2; ctx.save(); ctx.globalAlpha = e * .85; ctx.strokeStyle = "#2A8F80"; ctx.lineWidth = 3.5; ctx.setLineDash([1, 10]); ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.quadraticCurveTo(mx, my, pb.x, pb.y); ctx.stroke(); ctx.restore(); pill((pa.x + pb.x) / 2 + bend / 2, my, label, null, e, true); }
      });
      const items = [...SCENERY.map((o) => ({ o, p: place(o, false) })), ...UNEXPLORED.map((o) => ({ o, p: place(o, true) })), ...things.map((o) => ({ o, p: P.get(o.island!.id)! }))].sort((m, n) => m.p.z - n.p.z);
      // rings on the water first, under the islands
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i], u = (now - r.t0) / 760;
        if (u >= 1) { rings.splice(i, 1); continue; }
        const p = r.o.island ? P.get(r.o.island.id) : place(r.o, true);
        if (!p || p.al < .05) continue;
        const grow = 1 - Math.pow(1 - u, 2), rw = r.o.w * p.sc * (.32 + .5 * grow);
        ctx.save(); ctx.globalAlpha = p.al * .9 * (1 - u); ctx.strokeStyle = night ? "rgba(190,215,255,.8)" : "#fff"; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(p.x, p.y + r.o.w * p.sc * (r.o.locked ? -.1 : .16), rw, rw * .3 * Math.max(.4, p.fz), 0, 0, 7); ctx.stroke(); ctx.restore();
      }
      if (rings.length || press) moving = true;
      items.forEach(({ o, p }) => drawThing(o, p, pressScale(o, now)));
      // the little boat: you, among your islands
      const bp = place(BOAT, true), boat = pic("sailboat");
      if (boat.complete && boat.naturalWidth && bp.al > .05) {
        const w = 46 * bp.sc, h = w * boat.naturalHeight / boat.naturalWidth; ctx.save(); ctx.globalAlpha = bp.al; ctx.drawImage(boat, bp.x - w / 2, bp.y - h / 2, w, h);
        // She sails it: her avatar in the boat.
        if (avatar) { const im = avatarImg(); if (im && im.complete && im.naturalWidth) { const a = 30 * bp.sc; ctx.drawImage(im, bp.x - w * .42, bp.y - h * .62, a, a); } }
        ctx.restore();
      }
      if (onBall) ctx.restore();
      const isAway = tTarget === 0 && !spin && (bp.z < .6 || bp.x < 20 || bp.x > W - 20 || bp.y < g.top + 30 || bp.y > H - 170);
      if (isAway !== awayNow) { awayNow = isAway; setAway(isAway); }
      things.forEach((o) => {
        const isl = o.island!, p = P.get(isl.id)!, sk = isl.weather ? SKY[isl.weather] : null;
        if (sk) { const im = pic(sk[0]), a = p.al * Math.max(e, Math.min(1, (p.z - .3) * 3)); if (im.complete && im.naturalWidth && a > .03) { const w = sk[1] * p.sc, h = w * im.naturalHeight / im.naturalWidth; ctx.save(); ctx.globalAlpha = a; ctx.drawImage(im, p.x + .3 * o.w * p.sc - w / 2, p.y - o.w * p.sc * .34 - h * .8, w, h); ctx.restore(); } }
      });
      // names last, so no weather picture covers them
      things.forEach((o) => { const isl = o.island!, p = P.get(isl.id)!; pill(p.x, p.y + o.w * p.sc * .34, islandName(t, isl.id), "icon_" + isl.def.icon, Math.max(e, Math.min(1, (p.z - .3) * 3)) * p.al, false); });
      if (ga > .01) { ctx.save(); ctx.globalAlpha = ga; const rim = ctx.createRadialGradient(g.cx, g.cy, g.R * .9, g.cx, g.cy, g.R); rim.addColorStop(0, "rgba(255,255,255,0)"); rim.addColorStop(1, night ? "rgba(170,220,255,.22)" : "rgba(255,255,255,.42)"); ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R, 0, 7); ctx.fill(); ctx.restore(); }
      camRef.current = M;
      if (moving || dragging) kick();
      else lastT = 0;
    }

    // turn the ball so `target` faces you, then run `then`
    const turnTo = (lon: number, lat: number, then?: () => void) => {
      const v = app(M, vec(lon, lat)), f = focusDir(); let ax: V3 = [v[1] * f[2] - v[2] * f[1], v[2] * f[0] - v[0] * f[2], v[0] * f[1] - v[1] * f[0]]; const n = Math.hypot(...ax);
      if (n < 1e-6) { then?.(); return; } ax = ax.map((c) => c / n) as V3; spin = { k: reduce ? 1 : 0, M0: M, axis: ax, ang: Math.atan2(n, v[0] * f[0] + v[1] * f[1] + v[2] * f[2]), then }; kick();
    };
    const tap = (x: number, y: number) => {
      let best: Thing | null = null, bd = 1e9;
      for (const o of [...things, ...UNEXPLORED]) { const p = place(o, true); if (p.al < .4) continue; const cy = o.locked ? p.y - o.w * p.sc * .3 : p.y, d = Math.hypot(p.x - x, cy - y); if (d < o.w * p.sc * .6 && d < bd) { bd = d; best = o; } }
      if (!best) return;
      haptics.pop(0.55);
      playBloop(x / W);
      if (!reduce) { press = { o: best, t0: performance.now() }; rings.push({ o: best, t0: performance.now() }); kick(); }
      if (best.locked) { setNote(t("map.unexplored")); return; }
      const id = best.island!.id;
      // on the flat map: the press shows first, then the island opens
      if (tTarget === 1) window.setTimeout(() => { if (alive) onOpenRef.current(id); }, reduce ? 0 : 160);
      else turnTo(best.lon, best.lat, () => onOpenRef.current(id));
    };

    // input: drag to roll (the ball under the finger follows it), a flick
    // glides on and slows down by itself; tap an island; pinch for the flat map
    const pts = new Map<number, [number, number]>(); let down: { t: number; moved: number } | null = null, pinch0 = 0;
    let trail: [number, number, number][] = [];
    const local = (ev: PointerEvent): [number, number] => { const r = canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
    const onDown = (ev: PointerEvent) => { canvas.setPointerCapture(ev.pointerId); pts.set(ev.pointerId, local(ev)); spin = null; setNote(null);
      if (pts.size === 1) { dragging = true; down = { t: performance.now(), moved: 0 }; vx = vy = 0; trail = []; }
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); } };
    const onMove = (ev: PointerEvent) => { if (!pts.has(ev.pointerId)) return; const prev = pts.get(ev.pointerId)!, cur = local(ev); pts.set(ev.pointerId, cur);
      if (pts.size === 2 && pinch0) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); return; }
      if (!dragging || tTarget === 1 || !down) return; const dx = cur[0] - prev[0], dy = cur[1] - prev[1], k = 1 / geom().R; down.moved += Math.abs(dx) + Math.abs(dy);
      roll(dx * k, dy * k); const now = performance.now(); trail.push([now, dx * k, dy * k]); trail = trail.filter(([t0]) => now - t0 < 90);
      if (down.moved > 12) setHint(false); kick(); };
    const onUp = (ev: PointerEvent) => { if (!pts.has(ev.pointerId)) return; pts.delete(ev.pointerId); if (pts.size < 2) pinch0 = 0;
      if (pts.size === 0) {
        dragging = false;
        // the speed of the last moments of the drag, per 60th of a second
        const now = performance.now(), recent = trail.filter(([t0]) => now - t0 < 90);
        if (!reduce && recent.length > 1) {
          const span = Math.max(16, now - recent[0][0]) / 16.7, cap = .06;
          vx = Math.max(-cap, Math.min(cap, recent.reduce((a, r) => a + r[1], 0) / span));
          vy = Math.max(-cap, Math.min(cap, recent.reduce((a, r) => a + r[2], 0) / span));
        } else vx = vy = 0;
        trail = [];
        if (down && down.moved < 8 && now - down.t < 400) tap(...local(ev));
        down = null; kick();
      } };
    canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove); canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onUp);

    api.current = {
      setFlat: (v) => { tTarget = v ? 1 : 0; flatRef.current = v; vx = vy = 0; spin = null; setFlat(v); kick(); },
      home: () => { vx = vy = 0; const T = [M[0], M[3], M[6], M[1], M[4], M[7], M[2], M[5], M[8]], R = mul(MHOME, T), ang = Math.acos(Math.max(-1, Math.min(1, (R[0] + R[4] + R[8] - 1) / 2)));
        if (ang < 1e-4) return; const s = 2 * Math.sin(ang); let ax: V3 = [(R[7] - R[5]) / s, (R[2] - R[6]) / s, (R[3] - R[1]) / s]; const n = Math.hypot(...ax);
        if (!isFinite(n) || n < 1e-6) { M = MHOME.slice(); kick(); return; } ax = ax.map((c) => c / n) as V3; spin = { k: reduce ? 1 : 0, M0: M, axis: ax, ang }; kick(); },
    };
    kick();
    return () => { alive = false; cancelAnimationFrame(raf); window.clearTimeout(ahead); ro.disconnect(); canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove); canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onUp); };
  }, [islands, routes, growth, avatar, t, night]);

  void setFlat;
  return (
    <div ref={wrap} className="relative h-full w-full overflow-hidden select-none">
      <canvas ref={cv} className="absolute inset-0 h-full w-full touch-none" aria-label={t("map.aria")} />
      {/* One switch only, in the Map tab's header (her note, Nov 2). */}
      {hint && !flat && (
        <div className="pointer-events-none absolute left-1/2 top-[40px] z-[2] -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-3.5 py-2 text-sm font-bold text-muted-foreground shadow-sm">{t("map.hint")}</div>
      )}
      <button type="button" onClick={() => api.current?.home()} aria-label={t("map.backToMe")}
        className={`absolute right-4 z-[3] flex h-12 items-center gap-2 rounded-full bg-white pl-2 pr-4 text-[15px] font-extrabold text-primary shadow-lg transition-all duration-200 ${away && !flat ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`}
        style={{ bottom: "calc(7.5rem + env(safe-area-inset-bottom, 0px))" }}>
        <img src={mapPic("sailboat")} alt="" className="h-8 w-8 rounded-full bg-sky-50 object-contain p-0.5 ring-2 ring-primary" />{t("map.backToMe")}
      </button>
      {note && (
        <div className="absolute left-4 right-4 z-[3] flex items-center gap-3 rounded-[22px] border border-foreground/10 bg-white/95 p-3.5 shadow-lg" style={{ bottom: "calc(7.5rem + env(safe-area-inset-bottom, 0px))" }}>
          <img src={mapPic("unexplored")} alt="" className="h-11 w-14 object-contain" />
          <div className="min-w-0"><p className="text-xs font-extrabold uppercase tracking-wider text-primary">{t("map.unexploredLabel")}</p><p className="text-[15px] font-semibold leading-snug text-muted-foreground">{note}</p></div>
        </div>
      )}
    </div>
  );
};
