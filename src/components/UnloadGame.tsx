// "Unload your mind" (her ask, Nov 2 2026: "можно реально какую-то
// залипательную игру сделать? типа разгрузи свой мозг"). Our own calm game
// on her sea: what's on her mind becomes bubbles (typed or spoken); a tap
// lets one go with a soft pop, holding keeps it "for later" (saved to Notes
// at the end). Small bubbles keep rising so there is always something to
// pop: same colours that touch merge, a big one bursts into small ones, and
// a finger dragged across pops a whole row. No score to lose, no timer.
// Calm motion (her rule): slow rise, no shaking; Reduce Motion slows it more.
// Nov 3 2026, later (her: "непонятно, что мысль становится шариком; Done и
// крестик — два выхода; непонятно, когда можно сохранить"): a short "how it
// works" the first time; holding no longer keeps a bubble; every thought can
// go to Notes right away, and the X is the one way out: if there are
// thoughts not saved yet, it asks once which to keep.
// Nov 3 2026 (her: "более ASMR-ное и ощущение, и графику, и звуки"): soap
// bubbles with a slowly shifting rainbow rim and a glint, a gentle wobble when
// they touch, a short squish before the pop, droplets and a thin ring, a wet
// "plip" panned to where it was, and a quiet sea underneath.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ArrowUp, Check, Circle, FastForward, NotebookPen, PenLine, Pointer, Volume2, VolumeX, X } from "lucide-react";
import { haptics } from "@/lib/haptics";
import { BUBBLE_SOUNDS, SOUNDS_PAUSED, gameSound, playBurst, playMerge, playPop, preloadSounds, startSea } from "@/lib/feedback";
import { isNightMap } from "@/lib/islands";
import { addNote } from "@/lib/notes";
import { isoLocal } from "@/lib/doors";
import { avatarUrl, getAvatar } from "@/lib/avatar";
import { DictateButton } from "@/components/DictateButton";
import { markUnloadPlayed } from "@/lib/pathSteps";
import { Pressable } from "@/components/ui/pressable";

/** Calm bubble colours: [hue, saturation, lightness]. */
const COLORS: [number, number, number][] = [[174, 44, 54], [200, 60, 64], [262, 45, 72], [330, 48, 74], [150, 40, 62], [42, 74, 66]];
const MAX_R = 64;

interface Bubble {
  id: number; x: number; y: number; r: number; vy: number; phase: number; c: number;
  text?: string; lines?: string[]; target?: number; grow: number;
  /** wobble left from touching another (0..1) */
  wob: number;
  /** when it pops (it squishes until then) */
  popAt?: number;
}
interface Drop { x: number; y: number; vx: number; vy: number; r: number; hue: number }
interface Burst { x: number; y: number; r: number; c: number; t: number; drops: Drop[] }
/** How long a bubble squishes before it pops, ms. */
const SQUISH = 70;

export const UnloadGame = ({ onClose }: { onClose: () => void }) => {
  const { t } = useTranslation();
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [text, setText] = useState("");
  const [popped, setPopped] = useState(0);
  const [letGo, setLetGo] = useState(0);
  // Every thought she wrote or said, and whether it's in Notes already.
  const [thoughts, setThoughts] = useState<{ text: string; saved: boolean }[]>([]);
  const [hint, setHint] = useState(true);
  // The end: which unsaved thoughts to keep (all ticked to start with).
  const [done, setDone] = useState(false);
  const [pick, setPick] = useState<Set<number>>(() => new Set());
  // How it works, the first time.
  const [intro, setIntro] = useState(() => { try { return localStorage.getItem("memap_unload_intro") !== "seen"; } catch { return true; } });
  // Faster when she wants it (her note, Nov 3 2026: "смена скорости, чтобы
  // быстрее и активнее поднимались"): 1x, 2x, 3x, remembered.
  const [pace, setPace] = useState<number>(() => {
    try { return Math.min(3, Math.max(1, Number(localStorage.getItem("memap_unload_pace")) || 1)); } catch { return 1; }
  });
  const paceRef = useRef(pace);
  paceRef.current = pace;
  // A thought said out loud (or a long one): offer to keep it in Notes (her
  // note: "когда наговариваю, предложить сохранить в заметки").
  const [offer, setOffer] = useState<{ i: number; text: string; saved: boolean } | null>(null);
  const offerTimer = useRef(0);
  const voiced = useRef(false);
  useEffect(() => () => window.clearTimeout(offerTimer.current), []);
  // The loop reads these through a ref (no re-render per frame).
  const api = useRef<{ add: (s: string) => void } | null>(null);
  // Pop sounds (her ask), with their own button here and the same switch in Settings → Sound and vibration.
  const [muted, setMuted] = useState(() => { try { return localStorage.getItem("memap_unload_sound") === "off"; } catch { return false; } });
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  useEffect(() => { markUnloadPlayed(); preloadSounds("pop1", "pop2", "pop3", "pop4", "drop", "sparkle"); }, []);
  // A quiet sea while the game is open (off when muted). While the sound is on the game plays like a player: heard
  // on silent too, the phone's volume buttons set it (her notes, Nov 12 2026); closed, the app is quiet again.
  useEffect(() => {
    gameSound(!muted);
    if (muted) return;
    const stop = startSea();
    return stop;
  }, [muted]);
  useEffect(() => () => gameSound(false), []);

  useEffect(() => {
    const canvas = cv.current!, box = wrap.current!, ctx = canvas.getContext("2d")!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const speed = reduce ? 0.45 : 1;
    let W = 0, H = 0, dpr = 1, raf = 0, alive = true, nextId = 1, lastSpawn = 0, lastTap = 0, lastMerge = 0;
    const sound = () => !mutedRef.current;
    let bubbles: Bubble[] = [];
    let bursts: Burst[] = [];
    const resize = () => {
      const r = box.getBoundingClientRect();
      W = r.width; H = r.height; dpr = Math.min(devicePixelRatio || 1, 3);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(box);

    const spawn = (r = 14 + Math.random() * 16, x?: number, y?: number, c?: number, vy?: number) => {
      bubbles.push({
        id: nextId++, r, x: x ?? r + Math.random() * (W - 2 * r), y: y ?? H + r,
        vy: vy ?? -(0.35 + Math.random() * 0.35) * speed, phase: Math.random() * 6.28,
        c: c ?? Math.floor(Math.random() * COLORS.length), grow: 1, wob: 0,
      });
    };
    // A thought: a light bubble with her words; it rises to the middle and waits.
    ctx.font = "600 15px system-ui, -apple-system, sans-serif";
    const wrapText = (s: string, max: number) => {
      const words = s.split(/\s+/); const lines: string[] = []; let line = "";
      for (const w of words) {
        const next = line ? `${line} ${w}` : w;
        if (ctx.measureText(next).width > max && line) { lines.push(line); line = w; } else line = next;
        if (lines.length === 3) break;
      }
      if (line && lines.length < 3) lines.push(line);
      if (lines.length === 3 && words.join(" ").length > lines.join(" ").length) lines[2] = lines[2].replace(/.{0,2}$/, "…");
      return lines;
    };
    api.current = {
      add: (s: string) => {
        ctx.font = "600 15px system-ui, -apple-system, sans-serif";
        const lines = wrapText(s, 108);
        const wide = Math.max(...lines.map((l) => ctx.measureText(l).width));
        const r = Math.min(74, Math.max(46, wide / 2 + 18, lines.length * 11 + 22));
        bubbles.push({
          id: nextId++, r, x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H + r, vy: -0.9 * speed, phase: Math.random() * 6.28,
          c: Math.floor(Math.random() * COLORS.length), text: s, lines, target: H * (0.22 + Math.random() * 0.3), grow: 0.6, wob: 0,
        });
      },
    };

    /** Droplets flying off a pop, in the rim's colours. */
    const dropsFor = (b: Bubble, now: number): Drop[] => {
      const n = 10 + Math.round(b.r / 6);
      return Array.from({ length: n }, (_, k) => {
        const a = (k / n) * Math.PI * 2 + Math.random() * 0.3;
        const v = (1.2 + Math.random() * 1.6) * (0.6 + b.r / MAX_R);
        return { x: b.x + Math.cos(a) * b.r * 0.85, y: b.y + Math.sin(a) * b.r * 0.85, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.4, r: 1.4 + Math.random() * 2.2, hue: (now / 20 + b.phase * 60 + k * 37) % 360 };
      });
    };
    /** Touch: it squishes for a moment, then pops (burst()). */
    const pop = (b: Bubble) => {
      if (b.popAt) return;
      b.popAt = performance.now() + (reduce ? 0 : SQUISH);
    };
    const burst = (b: Bubble) => {
      bubbles = bubbles.filter((x) => x !== b);
      const now = performance.now();
      bursts.push({ x: b.x, y: b.y, r: b.r, c: b.c, t: 0, drops: dropsFor(b, now) });
      // Each pop sounds and feels its size, from where it was; a big one bursts.
      if (now - lastTap > 45) {
        const z = b.text ? 0.65 : Math.min(1, b.r / MAX_R);
        const x = W ? b.x / W : 0.5;
        if (!b.text && b.r > 40) { haptics.burst(); if (sound()) playBurst(x); }
        else { haptics.pop(z); if (sound()) playPop(z, x); }
        lastTap = now;
      }
      if (b.text) setLetGo((n) => n + 1);
      else setPopped((n) => n + 1);
      // A big one bursts into small ones (there's always more to pop).
      if (!b.text && b.r > 40) {
        const n = 3 + Math.floor(b.r / 22);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          spawn(10 + Math.random() * 8, b.x + Math.cos(a) * b.r * 0.5, b.y + Math.sin(a) * b.r * 0.5, b.c, -(0.6 + Math.random() * 0.4) * speed);
        }
      }
    };

    const draw = (b: Bubble, now: number) => {
      const [h, s, l] = COLORS[b.c];
      const r = b.r * b.grow;
      // jelly: a little wobble after touching; a squish right before the pop
      const w = reduce ? 0 : b.wob * 0.07 * Math.sin(now / 65 + b.phase * 3);
      const k = b.popAt ? Math.min(1, 1 - (b.popAt - now) / SQUISH) : 0;
      const sx = 1 + w + 0.14 * k, sy = 1 - w - 0.1 * k;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.scale(sx, sy);
      // the film: almost clear in the middle, tinted toward the edge
      const body = ctx.createRadialGradient(-r * 0.2, -r * 0.25, r * 0.1, 0, 0, r);
      body.addColorStop(0, `hsla(${h},${s}%,${Math.min(96, l + 24)}%,${b.text ? 0.86 : 0.08})`);
      body.addColorStop(0.72, `hsla(${h},${s}%,${Math.min(92, l + 14)}%,${b.text ? 0.82 : 0.16})`);
      body.addColorStop(1, `hsla(${h},${s}%,${l}%,${b.text ? 0.9 : 0.42})`);
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      // the rainbow rim, slowly turning
      const turn = now / 2600 + b.phase;
      ctx.lineWidth = Math.max(1.6, r * 0.06);
      for (let q = 0; q < 6; q++) {
        ctx.strokeStyle = `hsla(${(q * 60 + now / 18 + b.phase * 50) % 360},85%,74%,${b.text ? 0.75 : 0.6})`;
        ctx.beginPath(); ctx.arc(0, 0, r - ctx.lineWidth / 2, turn + (q * Math.PI) / 3, turn + ((q + 1) * Math.PI) / 3 + 0.02); ctx.stroke();
      }
      ctx.lineWidth = 1; ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath(); ctx.arc(0, 0, r - 3, 0, Math.PI * 2); ctx.stroke();
      // the glint and a soft lower reflection
      const gl = ctx.createRadialGradient(-r * 0.4, -r * 0.45, 0, -r * 0.4, -r * 0.45, r * 0.42);
      gl.addColorStop(0, "rgba(255,255,255,0.9)");
      gl.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gl;
      ctx.beginPath(); ctx.ellipse(-r * 0.36, -r * 0.42, r * 0.34, r * 0.22, -0.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.beginPath(); ctx.arc(-r * 0.5, -r * 0.5, Math.max(1.5, r * 0.07), 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = Math.max(1.5, r * 0.07); ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0.35, 1.25); ctx.stroke();
      if (b.text) {
        ctx.fillStyle = `hsl(${h},${Math.max(20, s - 10)}%,20%)`; ctx.font = "600 15px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const lines = b.lines ?? [];
        lines.forEach((ln, i) => ctx.fillText(ln, 0, (i - (lines.length - 1) / 2) * 18));
      }
      ctx.restore();
    };

    const frame = (now: number) => {
      raf = 0;
      if (!alive) return;
      // Keep the sea lively: small bubbles rise every ~0.7 s, never too many.
      const generic = bubbles.filter((b) => !b.text).length;
      if (now - lastSpawn > (reduce ? 1300 : 700) / paceRef.current && generic < 18 + 8 * (paceRef.current - 1)) { spawn(); lastSpawn = now; }
      // Squished long enough: pop.
      for (const b of bubbles.filter((x) => x.popAt && now >= x.popAt)) burst(b);
      for (const b of bubbles) {
        b.grow = Math.min(1, b.grow + 0.04);
        b.wob *= 0.95;
        if (b.text && b.target !== undefined && b.y <= b.target) {
          // A thought waits in the middle, bobbing gently.
          b.y += Math.sin(now / 900 + b.phase) * 0.12 * speed;
        } else b.y += b.vy * paceRef.current;
        if (!reduce) b.x += Math.sin(now / 1400 + b.phase) * 0.18;
        b.x = Math.max(b.r * 0.6, Math.min(W - b.r * 0.6, b.x));
      }
      // Touching bubbles push apart; same colours (no words) merge.
      for (let i = 0; i < bubbles.length; i++) {
        for (let j = i + 1; j < bubbles.length; j++) {
          const a = bubbles[i], b = bubbles[j];
          const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01, overlap = a.r + b.r - d;
          if (overlap <= 0) continue;
          if (!a.text && !b.text && a.c === b.c && overlap > Math.min(a.r, b.r) * 0.35 && Math.hypot(a.r, b.r) <= MAX_R) {
            const big = a.r >= b.r ? a : b, small = big === a ? b : a;
            big.x = (big.x * big.r ** 2 + small.x * small.r ** 2) / (big.r ** 2 + small.r ** 2);
            big.y = (big.y * big.r ** 2 + small.y * small.r ** 2) / (big.r ** 2 + small.r ** 2);
            big.r = Math.hypot(a.r, b.r); big.vy = Math.max(big.vy, small.vy) * 0.85; big.grow = 0.9;
            if (now - lastMerge > 160) { haptics.merge(); if (sound()) playMerge(W ? big.x / W : 0.5); lastMerge = now; }
            big.wob = 1;
            bubbles = bubbles.filter((x) => x !== small);
            j = bubbles.length; // restart the inner loop next frame
            continue;
          }
          a.wob = Math.max(a.wob, 0.7); b.wob = Math.max(b.wob, 0.7);
          const nx = dx / d, ny = dy / d;
          const wa = a.text ? 0 : b.text ? 1 : 0.5, wb = 1 - wa;
          a.x -= nx * overlap * wa; a.y -= ny * overlap * wa;
          b.x += nx * overlap * wb; b.y += ny * overlap * wb;
        }
      }
      bubbles = bubbles.filter((b) => b.y > -b.r * 1.2);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      // Soft light moving in the water (very faint, slow).
      for (let q = 0; q < 3; q++) {
        const lx = W * (0.25 + 0.5 * ((Math.sin(now / (9000 + q * 2300) + q * 2) + 1) / 2));
        const ly = H * (0.2 + 0.6 * ((Math.cos(now / (11000 + q * 1900) + q) + 1) / 2));
        const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, W * 0.45);
        lg.addColorStop(0, "rgba(255,255,255,0.10)");
        lg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = lg;
        ctx.fillRect(0, 0, W, H);
      }
      bubbles.forEach((b) => draw(b, now));
      // Pops: a thin ring opening up, and droplets that fly, fall and fade.
      bursts = bursts.filter((p) => p.t < 1);
      for (const p of bursts) {
        p.t += 0.045;
        const [h, s, l] = p.c < 0 ? [42, 74, 60] : COLORS[p.c];
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - p.t * 1.4);
        ctx.strokeStyle = p.c < 0 ? `hsl(${h},${s}%,${l}%)` : "rgba(255,255,255,0.9)";
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + p.t * 0.5), 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = Math.max(0, 1 - p.t);
        for (const d of p.drops) {
          d.x += d.vx; d.y += d.vy; d.vy += 0.09; d.vx *= 0.97;
          ctx.fillStyle = `hsla(${d.hue},80%,72%,0.95)`;
          ctx.beginPath(); ctx.arc(d.x, d.y, d.r * (1 - p.t * 0.5), 0, Math.PI * 2); ctx.fill();
        }
        if (p.c < 0) {
          ctx.fillStyle = `hsl(${h},${s}%,${l}%)`;
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2, dist = p.r * (0.6 + p.t * 0.9);
            ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * dist, p.y + Math.sin(a) * dist, 3 * (1 - p.t) + 1, 0, Math.PI * 2); ctx.fill();
          }
        }
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    // Dev only (dropped from builds): lets the tests find a thought bubble.
    if (import.meta.env.DEV) (window as unknown as { __unload?: () => Bubble[] }).__unload = () => bubbles;
    // A few to start with.
    for (let i = 0; i < 9; i++) spawn(undefined, undefined, H * (0.35 + Math.random() * 0.65));

    // Touch: tap pops; hold a thought to keep it; drag across pops small ones.
    const at = (ev: PointerEvent) => { const r = canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top] as const; };
    const hit = (x: number, y: number, words: boolean | null) =>
      [...bubbles].reverse().find((b) => !b.popAt && Math.hypot(b.x - x, b.y - y) < b.r * b.grow + 6 && (words === null || !!b.text === words));
    let down: { b: Bubble | undefined; timer: number; moved: boolean } | null = null;
    const onDown = (ev: PointerEvent) => {
      canvas.setPointerCapture(ev.pointerId);
      const [x, y] = at(ev);
      const b = hit(x, y, null);
      down = { b, moved: false, timer: 0 };
      if (b) { pop(b); down.b = undefined; }
    };
    const onMove = (ev: PointerEvent) => {
      if (!down) return;
      const [x, y] = at(ev);
      down.moved = true;
      const b = hit(x, y, false);
      if (b) pop(b);
    };
    const onUp = () => {
      if (!down) return;
      window.clearTimeout(down.timer);
      if (down.b && bubbles.includes(down.b)) pop(down.b);
      down = null;
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    return () => {
      alive = false; cancelAnimationFrame(raf); ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const add = () => {
    const s = text.trim();
    if (!s) return;
    haptics.tap();
    api.current?.add(s.slice(0, 80));
    setText("");
    setHint(false);
    voiced.current = false;
    const i = thoughts.length;
    setThoughts((ts) => [...ts, { text: s, saved: false }]);
    window.clearTimeout(offerTimer.current);
    setOffer({ i, text: s, saved: false });
    offerTimer.current = window.setTimeout(() => setOffer(null), 9000);
  };
  const saveOffer = async () => {
    if (!offer || offer.saved) return;
    await addNote({ date: isoLocal(new Date()), text: offer.text });
    window.dispatchEvent(new CustomEvent("memap-notes-changed"));
    haptics.success();
    setThoughts((ts) => ts.map((x, k) => (k === offer.i ? { ...x, saved: true } : x)));
    setOffer({ ...offer, saved: true });
    window.clearTimeout(offerTimer.current);
    offerTimer.current = window.setTimeout(() => setOffer(null), 1600);
  };
  const nextPace = () => {
    haptics.tap();
    setPace((p) => {
      const n = p >= 3 ? 1 : p + 1;
      try { localStorage.setItem("memap_unload_pace", String(n)); } catch { /* ignore */ }
      return n;
    });
  };
  // The X: thoughts not in Notes yet? Ask once which to keep; else just close.
  const finish = () => {
    const open = thoughts.map((x, k) => (x.saved ? -1 : k)).filter((k) => k >= 0);
    if (open.length === 0) { onClose(); return; }
    haptics.soft();
    setPick(new Set(open));
    setDone(true);
  };
  const saveAndClose = async () => {
    const texts = thoughts.filter((_, k) => pick.has(k)).map((x) => x.text);
    if (texts.length > 0) {
      await addNote({ date: isoLocal(new Date()), text: texts.length === 1 ? texts[0] : texts.map((x) => `• ${x}`).join("\n") });
      window.dispatchEvent(new CustomEvent("memap-notes-changed"));
      haptics.success();
    }
    onClose();
  };
  const closeIntro = () => {
    haptics.tap();
    setIntro(false);
    try { localStorage.setItem("memap_unload_intro", "seen"); } catch { /* shows again next time */ }
  };
  const tick = (on: boolean) => (
    <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-[hsl(var(--coin-teal))] bg-[hsl(var(--coin-teal))] text-white" : "border-foreground/20"}`}>
      {on && <Check className="h-4 w-4" strokeWidth={3} />}
    </span>
  );
  const night = isNightMap();
  const avatar = avatarUrl(getAvatar());

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={t("unload.title")} className="fixed inset-0 z-[70] flex flex-col animate-fade-in"
      style={{ background: night ? "linear-gradient(180deg,#141c39 0%,#1b2550 55%,#2a3470 100%)" : "linear-gradient(180deg,#eef8fb 0%,#cfeaf3 55%,#b2dfec 100%)" }}>
      <div className="flex items-center gap-2 px-3 pt-[max(env(safe-area-inset-top),12px)]">
        <button type="button" onClick={finish} aria-label={t("common.close")} className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground">
          <X className="h-6 w-6" />
        </button>
        <p className="min-w-0 flex-1 truncate text-[17px] font-bold">{t("unload.title")}</p>
        {(!SOUNDS_PAUSED || BUBBLE_SOUNDS) && <button type="button" onClick={() => { haptics.soft(); gameSound(muted); setMuted((m) => { try { localStorage.setItem("memap_unload_sound", m ? "on" : "off"); } catch { /* ignore */ } return !m; }); }}
          aria-label={muted ? t("unload.soundOn") : t("unload.soundOff")} aria-pressed={!muted}
          className="surface flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground">
          {muted ? <VolumeX className="h-[18px] w-[18px]" strokeWidth={2.2} /> : <Volume2 className="h-[18px] w-[18px]" strokeWidth={2.2} />}
        </button>}
        <span className="surface inline-flex h-9 items-center rounded-full px-3 text-[14px] font-bold tabular-nums" aria-live="polite">
          {t("unload.popped", { count: popped + letGo })}
        </span>
      </div>

      <div ref={wrap} className="relative min-h-0 flex-1">
        <canvas ref={cv} className="absolute inset-0 h-full w-full touch-none" />
        {hint && (
          <p className="pointer-events-none absolute left-1/2 top-3 w-[86%] -translate-x-1/2 rounded-2xl bg-white/80 px-4 py-2 text-center text-[15px] font-semibold text-foreground/80 shadow-sm dark:bg-[hsl(var(--surface)/0.85)]">
            {t("unload.hint")}
          </p>
        )}
      </div>

      {/* What's on her mind: typed or spoken, one thought per bubble. */}
      <div className="surface mx-3 mb-[max(env(safe-area-inset-bottom),12px)] rounded-[24px] px-3 pb-3 pt-3">
        {offer && (
          <div className="mb-2 flex items-center gap-2 rounded-2xl bg-foreground/[0.05] py-1.5 pl-3 pr-1.5 animate-fade-in">
            <NotebookPen className="h-4 w-4 shrink-0 text-[hsl(var(--coin-teal))]" strokeWidth={2.2} />
            <span className="min-w-0 flex-1 truncate text-[14px] font-medium">“{offer.text}”</span>
            {offer.saved ? (
              <span className="shrink-0 px-2 text-[14px] font-bold text-[hsl(var(--coin-teal))]">{t("unload.savedOne")}</span>
            ) : (
              <button type="button" onClick={saveOffer} className="quiet-btn h-9 shrink-0 px-3.5 text-[14px] text-[hsl(var(--coin-teal))]">
                {t("unload.toNotes")}
              </button>
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            placeholder={t("unload.placeholder")} maxLength={80} enterKeyHint="send"
            className="h-12 min-w-0 flex-1 rounded-2xl border border-foreground/[0.12] bg-foreground/[0.04] px-4 text-[16px] outline-none focus:ring-2 focus:ring-[hsl(var(--coin-teal))]" />
          <button type="button" onClick={add} disabled={!text.trim()} aria-label={t("unload.add")}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--coin-teal))] text-white disabled:opacity-40">
            <ArrowUp className="h-5 w-5" strokeWidth={2.6} />
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <DictateButton text={text} onText={(next) => { voiced.current = true; setText(next); }} />
          <button type="button" onClick={nextPace} aria-label={t("unload.speed", { n: pace })}
            className="surface inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[15px] font-bold tabular-nums">
            <FastForward className="h-4 w-4 text-[hsl(var(--coin-teal))]" strokeWidth={2.4} /> {pace}×
          </button>
        </div>
      </div>

      {/* How it works, the first time. */}
      {intro && (
        <div className="absolute inset-0 z-[3] flex items-center justify-center bg-background/75 px-6 backdrop-blur-[2px] animate-fade-in">
          <div className="surface w-full max-w-sm rounded-[24px] px-5 pb-5 pt-5">
            <p className="text-[22px] font-bold leading-tight tracking-tight">{t("unload.howTitle")}</p>
            <div className="mt-4 space-y-3.5">
              {([[PenLine, "how1"], [Circle, "how2"], [Pointer, "how3"], [NotebookPen, "how4"]] as const).map(([Icon, k]) => (
                <div key={k} className="flex items-center gap-3">
                  <span className="icon-dot h-10 w-10">
                    <Icon className="h-5 w-5" strokeWidth={2.2} />
                  </span>
                  <p className="text-[17px] font-semibold leading-snug">{t(`unload.${k}`)}</p>
                </div>
              ))}
            </div>
            <Pressable tone="teal" haptic="none" onClick={closeIntro} className="mt-5 h-[52px] w-full rounded-2xl" faceClassName="text-[16px] font-extrabold uppercase tracking-[0.06em]">
              {t("unload.start")}
            </Pressable>
          </div>
        </div>
      )}

      {/* The end (from the X), only when some thoughts aren't in Notes yet. */}
      {done && (
        <div className="absolute inset-0 z-[3] flex flex-col bg-background/95 px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-[max(env(safe-area-inset-top),28px)] backdrop-blur-sm animate-fade-in">
          <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto text-center">
            {avatar && <img src={avatar} alt="" width={72} height={72} className="mb-2 mt-4 object-contain" />}
            <p className="text-[28px] font-bold leading-tight tracking-tight">{t("unload.lighter")}</p>
            {popped + letGo > 0 && <p className="mt-1 text-[16px] font-medium text-muted-foreground">{t("unload.popped", { count: popped + letGo })}</p>}
            <p className="mt-6 text-[19px] font-bold leading-snug">{t("unload.keepAsk")}</p>
            <div className="mt-3 w-full max-w-sm space-y-2 text-left">
              {thoughts.map((x, k) => !x.saved && (
                <button key={k} type="button" role="checkbox" aria-checked={pick.has(k)}
                  onClick={() => { haptics.tap(); setPick((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; }); }}
                  className="surface flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left"
                  style={pick.has(k) ? { boxShadow: "0 0 0 2.5px hsl(var(--coin-teal))" } : undefined}>
                  <span className="min-w-0 flex-1 text-[16px] font-semibold leading-snug">{x.text}</span>
                  {tick(pick.has(k))}
                </button>
              ))}
            </div>
          </div>
          <div className="mx-auto w-full max-w-sm space-y-1 pt-4">
            <Pressable tone="teal" haptic="none" onClick={saveAndClose} disabled={pick.size === 0} className="h-[58px] w-full rounded-2xl disabled:opacity-50" faceClassName="text-[16px] font-extrabold uppercase tracking-[0.06em]">
              {t("unload.save")}{pick.size > 1 ? ` · ${pick.size}` : ""}
            </Pressable>
            <button type="button" onClick={onClose} className="h-11 w-full text-[15px] font-semibold text-muted-foreground">{t("unload.noSave")}</button>
            <button type="button" onClick={() => setDone(false)} className="h-11 w-full text-[15px] font-semibold text-[hsl(var(--coin-teal))]">{t("unload.more")}</button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
};
