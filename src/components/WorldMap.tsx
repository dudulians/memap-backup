// Your world (Aurora UX step: the Map, Nov 1 2026). The top of a big ball
// you roll with a finger, like the ball of a roll-on: islands come up from
// below and sink past the horizon. Her calls while testing the demo: only the
// top of the ball shows; it must roll calmly and stop (it made her dizzy);
// no idle spinning; a "Back to me" pill when you roll away; unexplored land
// is her plain cloud. "Map" melts the ball into a flat map.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Island, IslandId, Route, mapPic } from "@/lib/islands";
import { haptics } from "@/lib/haptics";

type V3 = [number, number, number];
type M3 = number[];
const mul = (A: M3, B: M3): M3 => { const C: number[] = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) C[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c]; return C; };
const axisRot = ([x, y, z]: V3, a: number): M3 => { const c = Math.cos(a), s = Math.sin(a), t = 1 - c; return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c]; };
const app = (A: M3, [x, y, z]: V3): V3 => [A[0] * x + A[1] * y + A[2] * z, A[3] * x + A[4] * y + A[5] * z, A[6] * x + A[7] * y + A[8] * z];
const vec = (lon: number, lat: number): V3 => { const l = lon * Math.PI / 180, p = lat * Math.PI / 180; return [Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l)]; };
const ease = (x: number) => (x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

interface Thing { lon: number; lat: number; w: number; base?: string; land?: [string, number, number, number][]; cloud?: boolean; locked?: boolean; fx?: number; fy?: number; island?: Island }

// Scenery all over the ball so rolling always brings something new; kept away from her islands.
const SCENERY: Thing[] = (() => {
  const kinds: Omit<Thing, "lon" | "lat">[] = [{ w: 130, base: "island_waterfall" }, { w: 120, base: "island_plain", land: [["palm_trees", .6, .02, -.46]] }, { w: 110, base: "island_rocky", land: [["pine_tree", .42, .06, -.5]] },
    { w: 110, cloud: true }, { w: 120, base: "island_plain", land: [["green_tree", .45, .04, -.44]] }, { w: 110, base: "island_mountain" }, { w: 100, base: "island_rocky" }, { w: 100, cloud: true }];
  const out: Thing[] = [], N = 72;
  for (let i = 0; i < N; i++) {
    const y = 1 - 2 * (i + .5) / N, lat = Math.asin(y) * 180 / Math.PI, lon = ((i * 137.508) % 360) - 180;
    const c = Math.cos(lat * Math.PI / 180) * Math.cos(lon * Math.PI / 180);
    if (Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI < 36) continue;
    out.push({ lon, lat, ...kinds[i % kinds.length] });
  }
  return out;
})();
const UNEXPLORED: Thing[] = [{ lon: 30, lat: 36, fx: 318, fy: 64, w: 104 }, { lon: -38, lat: 31, w: 104 }, { lon: -32, lat: -38, w: 104 }, { lon: -150, lat: 2, w: 116 }, { lon: 122, lat: -12, w: 116 }, { lon: 178, lat: 50, w: 104 }]
  .map((l) => ({ ...l, locked: true }));
const BOAT: Thing = { lon: 1, lat: 5, fx: 210, fy: 322, w: 46 };

export const WorldMap = ({ islands, routes, onOpen }: { islands: Island[]; routes: Route[]; onOpen: (id: IslandId) => void }) => {
  const { t } = useTranslation();
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
    const IMG = new Map<string, HTMLImageElement>();
    let raf = 0, alive = true;
    const kick = () => { if (!raf && alive) raf = requestAnimationFrame(frame); };
    const pic = (n: string) => { let im = IMG.get(n); if (!im) { im = new Image(); im.onload = kick; im.src = mapPic(n); IMG.set(n, im); } return im; };

    const things: Thing[] = islands.map((isl) => ({ lon: isl.slot.lon, lat: isl.slot.lat, fx: isl.slot.fx, fy: isl.slot.fy, w: 140, base: isl.def.base, land: isl.def.land, island: isl }));
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

    const place = (o: Thing, morph: boolean) => {
      const g = geom(), [x, y, z] = app(M, vec(o.lon, o.lat)), gx = g.cx + g.R * x, gy = g.cy - g.R * y;
      const e = ease(tv), k = W / 390, gs = k * (.28 + .62 * Math.max(z, 0)), f = Math.max(.22, z);
      let px = gx, py = gy, sc = gs, fz = f, al = Math.min(1, Math.max(0, (z - .02) / .2)) * (gy < H + 60 && gx > -120 && gx < W + 120 ? 1 : 0);
      if (morph && o.fx != null && o.fy != null) { const fb = flatBox(); px = gx + (fb.ox + o.fx * fb.s - gx) * e; py = gy + (fb.oy + o.fy * fb.s - gy) * e; sc = gs + (fb.s - gs) * e; fz = f + (1 - f) * e; al = al + (1 - al) * e; }
      else al *= 1 - e;
      return { x: px, y: py, z, sc, fz, al, ang: Math.atan2(gy - g.cy, gx - g.cx) * (1 - e) };
    };
    type P = ReturnType<typeof place>;
    const drawThing = (o: Thing, p: P) => {
      if (p.al <= .01) return;
      ctx.save(); ctx.globalAlpha = p.al; ctx.translate(p.x, p.y); ctx.rotate(p.ang); ctx.scale(p.fz, 1); ctx.rotate(-p.ang);
      const draw = (n: string, cx: number, cy: number, w: number) => { const im = pic(n); if (!im.complete || !im.naturalWidth) return; const h = w * im.naturalHeight / im.naturalWidth; ctx.drawImage(im, cx - w / 2, cy - h / 2, w, h); return h; };
      if (o.locked) draw("unexplored", 0, -o.w * p.sc * .28, o.w * p.sc);
      else if (o.cloud) { const w = o.w * p.sc; draw("cloud_large", 0, -w * .7, w); draw("cloud_large", w * .3, -w * 1.05, w * .75); }
      else if (o.base) { const w = o.w * p.sc; draw(o.base, 0, 0, w); (o.land ?? []).forEach(([n, lw, dx, dy]) => draw(n, dx * w, dy * w, lw * w)); }
      ctx.restore();
    };
    const pill = (x: number, y: number, text: string, icon: string | null, a: number, small: boolean) => {
      if (a <= .02) return;
      ctx.save(); ctx.globalAlpha = a; ctx.font = `700 ${small ? 12 : 14}px system-ui, -apple-system, sans-serif`;
      const ih = icon ? 24 : 0, w = ctx.measureText(text).width + (icon ? ih + 16 : 20), h = small ? 24 : 30;
      ctx.shadowColor = "rgba(20,60,80,.28)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2); ctx.fill(); ctx.shadowColor = "transparent";
      if (icon) { const im = pic(icon); if (im.complete && im.naturalWidth) ctx.drawImage(im, x - w / 2 + 4, y - ih / 2, ih, ih); }
      ctx.fillStyle = small ? "#128373" : "#13303D"; ctx.textBaseline = "middle"; ctx.fillText(text, x - w / 2 + (icon ? ih + 8 : 10), y + 1); ctx.restore();
    };
    const SKY: Record<string, [string, number]> = { storm: ["thunder_cloud", 80], clouds: ["partly_cloudy", 60], sun: ["sun", 56] };
    const WAVES: V3[] = []; { const N = 260; for (let i = 0; i < N; i++) { const y = 1 - 2 * (i + .5) / N, r = Math.sqrt(1 - y * y), th = i * 2.399963; WAVES.push([r * Math.sin(th), y, r * Math.cos(th)]); } }

    let dragging = false, awayNow = false;
    function frame() {
      raf = 0;
      let moving = false;
      if (spin) { spin.k = Math.min(1, spin.k + .06); M = mul(axisRot(spin.axis, spin.ang * ease(spin.k)), spin.M0); moving = true; if (spin.k >= 1) { const then = spin.then; spin = null; then?.(); } }
      else if (!dragging && (vx || vy)) { roll(vx, vy); vx *= .88; vy *= .88; if (Math.abs(vx) + Math.abs(vy) < .0002) vx = vy = 0; moving = true; }
      if (tv !== tTarget) { tv += (tTarget - tv) * (reduce ? 1 : .14); if (Math.abs(tTarget - tv) < .002) tv = tTarget; moving = true; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const g = geom(), e = ease(tv), ga = 1 - e;
      if (e > .01) { const fb = flatBox(); ctx.save(); ctx.globalAlpha = e; const sea = ctx.createLinearGradient(0, fb.oy, 0, fb.oy + 600 * fb.s); sea.addColorStop(0, "#DDF2FA"); sea.addColorStop(1, "#BCDDED"); ctx.fillStyle = sea; ctx.beginPath(); ctx.roundRect(fb.ox, fb.oy, 370 * fb.s, 600 * fb.s, 24 * fb.s); ctx.fill(); ctx.restore(); }
      if (ga > .01) {
        ctx.save(); ctx.globalAlpha = ga;
        const glow = ctx.createRadialGradient(g.cx, g.cy, g.R * .97, g.cx, g.cy, g.R * 1.09); glow.addColorStop(0, "rgba(155,227,238,.7)"); glow.addColorStop(1, "rgba(155,227,238,0)"); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R * 1.09, 0, 7); ctx.fill();
        const sea = ctx.createRadialGradient(g.cx, g.cy - g.R * .35, g.R * .05, g.cx, g.cy, g.R); sea.addColorStop(0, "#BDEEF6"); sea.addColorStop(.6, "#6CC4DA"); sea.addColorStop(.92, "#3A93B2"); sea.addColorStop(1, "#2C7896");
        ctx.fillStyle = sea; ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R, 0, 7); ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineCap = "round";
        for (const v of WAVES) { const [x, y, z] = app(M, v); if (z < .04) continue; const sx = g.cx + g.R * x, sy = g.cy - g.R * y; if (sy > H + 20 || sx < -20 || sx > W + 20) continue; const s = (4 + 9 * z) * W / 390; ctx.globalAlpha = ga * .5 * Math.min(1, z * 2); ctx.lineWidth = 1.4 + 1.2 * z; ctx.beginPath(); ctx.moveTo(sx - s, sy); ctx.quadraticCurveTo(sx - s / 2, sy - s * .55 * z, sx, sy); ctx.quadraticCurveTo(sx + s / 2, sy + s * .55 * z, sx + s, sy); ctx.stroke(); }
        ctx.restore();
      }
      const P = new Map<IslandId, P>(); things.forEach((o) => P.set(o.island!.id, place(o, true)));
      // sea routes: along the ball, curves on the flat map
      routes.forEach(({ a, b, k, n }, i) => {
        const label = "🔗"; // numbers live in the island sheet now (her Nov 2 note)
        const A = byId.get(a), B = byId.get(b); if (!A || !B) return;
        if (ga > .01) {
          const va = vec(A.lon, A.lat), vb = vec(B.lon, B.lat), om = Math.acos(Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2])));
          ctx.save(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 3.2; ctx.setLineDash([1, 9]); ctx.lineCap = "round"; ctx.beginPath(); let pen = false, mid: number[] | null = null;
          for (let j = 0; j <= 40; j++) { const s = j / 40, k1 = Math.sin((1 - s) * om) / Math.sin(om), k2 = Math.sin(s * om) / Math.sin(om); const [x, y, z] = app(M, [va[0] * k1 + vb[0] * k2, va[1] * k1 + vb[1] * k2, va[2] * k1 + vb[2] * k2]); const sx = g.cx + g.R * x, sy = g.cy - g.R * y; if (z > .02) { if (pen) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); pen = true; } else pen = false; if (j === 20) mid = [sx, sy, z]; }
          ctx.globalAlpha = ga * .9; ctx.stroke(); ctx.restore(); if (mid && mid[2] > .3 && mid[1] < H - 140) pill(mid[0], mid[1], label, null, ga * Math.min(1, (mid[2] - .3) * 3), true);
        }
        if (e > .01) { const fb = flatBox(), pa = P.get(a)!, pb = P.get(b)!, bend = (i % 2 ? -40 : 36) * fb.s, mx = (pa.x + pb.x) / 2 + bend, my = (pa.y + pb.y) / 2; ctx.save(); ctx.globalAlpha = e * .85; ctx.strokeStyle = "#2A8F80"; ctx.lineWidth = 3.5; ctx.setLineDash([1, 10]); ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.quadraticCurveTo(mx, my, pb.x, pb.y); ctx.stroke(); ctx.restore(); pill((pa.x + pb.x) / 2 + bend / 2, my, label, null, e, true); }
      });
      const items = [...SCENERY.map((o) => ({ o, p: place(o, false) })), ...UNEXPLORED.map((o) => ({ o, p: place(o, true) })), ...things.map((o) => ({ o, p: P.get(o.island!.id)! }))].sort((m, n) => m.p.z - n.p.z);
      items.forEach(({ o, p }) => drawThing(o, p));
      // the little boat: you, among your islands
      const bp = place(BOAT, true), boat = pic("sailboat");
      if (boat.complete && boat.naturalWidth && bp.al > .05) { const w = 46 * bp.sc, h = w * boat.naturalHeight / boat.naturalWidth; ctx.save(); ctx.globalAlpha = bp.al; ctx.drawImage(boat, bp.x - w / 2, bp.y - h / 2, w, h); ctx.restore(); }
      const isAway = tTarget === 0 && !spin && (bp.z < .6 || bp.x < 20 || bp.x > W - 20 || bp.y < g.top + 30 || bp.y > H - 170);
      if (isAway !== awayNow) { awayNow = isAway; setAway(isAway); }
      things.forEach((o) => {
        const isl = o.island!, p = P.get(isl.id)!, sk = isl.weather ? SKY[isl.weather] : null;
        if (sk) { const im = pic(sk[0]), a = p.al * Math.max(e, Math.min(1, (p.z - .3) * 3)); if (im.complete && im.naturalWidth && a > .03) { const w = sk[1] * p.sc, h = w * im.naturalHeight / im.naturalWidth; ctx.save(); ctx.globalAlpha = a; ctx.drawImage(im, p.x + (o.lon > 0 ? .3 : -.28) * o.w * p.sc - w / 2, p.y - o.w * p.sc * .62 - h, w, h); ctx.restore(); } }
      });
      // names last, so no weather picture covers them
      things.forEach((o) => { const isl = o.island!, p = P.get(isl.id)!; pill(p.x, p.y + o.w * p.sc * .34, t(`map.island.${isl.id}`), "icon_" + isl.def.icon, Math.max(e, Math.min(1, (p.z - .3) * 3)) * p.al, false); });
      if (ga > .01) { ctx.save(); ctx.globalAlpha = ga; const rim = ctx.createRadialGradient(g.cx, g.cy, g.R * .86, g.cx, g.cy, g.R); rim.addColorStop(0, "rgba(11,42,53,0)"); rim.addColorStop(1, "rgba(11,42,53,.22)"); ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R, 0, 7); ctx.fill(); ctx.restore(); }
      if (moving || dragging) kick();
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
      haptics.tap();
      if (best.locked) { setNote(t("map.unexplored")); return; }
      const id = best.island!.id;
      if (tTarget === 1) onOpenRef.current(id); else turnTo(best.lon, best.lat, () => onOpenRef.current(id));
    };

    // input: drag to roll (calm, short glide), tap an island, pinch for the flat map
    const pts = new Map<number, [number, number]>(); let down: { t: number; moved: number } | null = null, pinch0 = 0;
    const local = (ev: PointerEvent): [number, number] => { const r = canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
    const onDown = (ev: PointerEvent) => { canvas.setPointerCapture(ev.pointerId); pts.set(ev.pointerId, local(ev)); spin = null; setNote(null);
      if (pts.size === 1) { dragging = true; down = { t: performance.now(), moved: 0 }; vx = vy = 0; }
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); } };
    const onMove = (ev: PointerEvent) => { if (!pts.has(ev.pointerId)) return; const prev = pts.get(ev.pointerId)!, cur = local(ev); pts.set(ev.pointerId, cur);
      if (pts.size === 2 && pinch0) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (d < pinch0 * .8) api.current?.setFlat(false); if (d > pinch0 * 1.25) api.current?.setFlat(true); return; }
      if (!dragging || tTarget === 1 || !down) return; const dx = cur[0] - prev[0], dy = cur[1] - prev[1], k = .55 / geom().R; down.moved += Math.abs(dx) + Math.abs(dy);
      roll(dx * k, dy * k); const cap = .012; vx = Math.max(-cap, Math.min(cap, dx * k * .6)); vy = Math.max(-cap, Math.min(cap, dy * k * .6)); if (down.moved > 12) setHint(false); kick(); };
    const onUp = (ev: PointerEvent) => { if (!pts.has(ev.pointerId)) return; pts.delete(ev.pointerId); if (pts.size < 2) pinch0 = 0;
      if (pts.size === 0) { dragging = false; if (reduce) vx = vy = 0; if (down && down.moved < 8 && performance.now() - down.t < 400) tap(...local(ev)); down = null; kick(); } };
    canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove); canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onUp);

    api.current = {
      setFlat: (v) => { tTarget = v ? 1 : 0; vx = vy = 0; spin = null; setFlat(v); kick(); },
      home: () => { vx = vy = 0; const T = [M[0], M[3], M[6], M[1], M[4], M[7], M[2], M[5], M[8]], R = mul(MHOME, T), ang = Math.acos(Math.max(-1, Math.min(1, (R[0] + R[4] + R[8] - 1) / 2)));
        if (ang < 1e-4) return; const s = 2 * Math.sin(ang); let ax: V3 = [(R[7] - R[5]) / s, (R[2] - R[6]) / s, (R[3] - R[1]) / s]; const n = Math.hypot(...ax);
        if (!isFinite(n) || n < 1e-6) { M = MHOME.slice(); kick(); return; } ax = ax.map((c) => c / n) as V3; spin = { k: reduce ? 1 : 0, M0: M, axis: ax, ang }; kick(); },
    };
    kick();
    return () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove); canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onUp); };
  }, [islands, routes, t]);

  return (
    <div ref={wrap} className="relative h-full w-full overflow-hidden select-none">
      <canvas ref={cv} className="absolute inset-0 h-full w-full touch-none" aria-label={t("map.aria")} />
      <div className="absolute right-3 top-3 z-[2] flex rounded-2xl bg-white/70 p-1 shadow-sm backdrop-blur">
        {([[false, t("map.globe")], [true, t("map.flat")]] as const).map(([v, label]) => (
          <button key={label} type="button" onClick={() => api.current?.setFlat(v)} aria-pressed={flat === v}
            className={`h-9 rounded-xl px-3.5 text-[15px] font-bold transition-colors ${flat === v ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"}`}>{label}</button>
        ))}
      </div>
      {hint && !flat && (
        <div className="pointer-events-none absolute left-1/2 top-[60px] z-[2] -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-3.5 py-2 text-sm font-bold text-muted-foreground shadow-sm">{t("map.hint")}</div>
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
