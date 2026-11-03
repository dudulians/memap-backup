// "Unload your mind" (her ask, Nov 2 2026: "можно реально какую-то
// залипательную игру сделать? типа разгрузи свой мозг"). Our own calm game
// on her sea: what's on her mind becomes bubbles (typed or spoken); a tap
// lets one go with a soft pop, holding keeps it "for later" (saved to Notes
// at the end). Small bubbles keep rising so there is always something to
// pop: same colours that touch merge, a big one bursts into small ones, and
// a finger dragged across pops a whole row. No score to lose, no timer.
// Calm motion (her rule): slow rise, no shaking; Reduce Motion slows it more.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Archive, ArrowUp, Volume2, VolumeX, X } from "lucide-react";
import { haptics } from "@/lib/haptics";
import { playBurst, playKeep, playMerge, playPop } from "@/lib/feedback";
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
}
interface Burst { x: number; y: number; r: number; c: number; t: number }

export const UnloadGame = ({ onClose }: { onClose: () => void }) => {
  const { t } = useTranslation();
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [text, setText] = useState("");
  const [popped, setPopped] = useState(0);
  const [letGo, setLetGo] = useState(0);
  const [kept, setKept] = useState<string[]>([]);
  const [hint, setHint] = useState(true);
  const [done, setDone] = useState(false);
  const [saved, setSaved] = useState(false);
  // The loop reads these through a ref (no re-render per frame).
  const api = useRef<{ add: (s: string) => void } | null>(null);
  // Pop sounds (her ask), with their own mute here; Settings → sounds mutes them too.
  const [muted, setMuted] = useState(() => { try { return localStorage.getItem("memap_unload_sound") === "off"; } catch { return false; } });
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  useEffect(() => { markUnloadPlayed(); }, []);

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
        c: c ?? Math.floor(Math.random() * COLORS.length), grow: 1,
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
          c: Math.floor(Math.random() * COLORS.length), text: s, lines, target: H * (0.22 + Math.random() * 0.3), grow: 0.6,
        });
      },
    };

    const pop = (b: Bubble) => {
      bubbles = bubbles.filter((x) => x !== b);
      bursts.push({ x: b.x, y: b.y, r: b.r, c: b.c, t: 0 });
      const now = performance.now();
      // Each pop sounds and feels its size; a big one bursts.
      if (now - lastTap > 55) {
        const z = b.text ? 0.65 : Math.min(1, b.r / MAX_R);
        if (!b.text && b.r > 40) { haptics.burst(); if (sound()) playBurst(); }
        else { haptics.pop(z); if (sound()) playPop(z); }
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
      setHint(false);
    };
    const keep = (b: Bubble) => {
      bubbles = bubbles.filter((x) => x !== b);
      haptics.rise();
      if (sound()) playKeep();
      if (b.text) setKept((k) => [...k, b.text!]);
      bursts.push({ x: b.x, y: b.y, r: b.r, c: -1, t: 0 });
    };

    const draw = (b: Bubble) => {
      const [h, s, l] = COLORS[b.c];
      const r = b.r * b.grow;
      ctx.save();
      if (b.text) {
        ctx.fillStyle = `hsla(${h},${s}%,${Math.min(96, l + 26)}%,0.94)`;
        ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, 7); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = `hsla(${h},${s}%,${l}%,0.9)`; ctx.stroke();
        ctx.fillStyle = `hsl(${h},${Math.max(20, s - 10)}%,22%)`; ctx.font = "600 15px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const lines = b.lines ?? [];
        lines.forEach((ln, i) => ctx.fillText(ln, b.x, b.y + (i - (lines.length - 1) / 2) * 18));
      } else {
        const g = ctx.createRadialGradient(b.x - r * 0.35, b.y - r * 0.4, r * 0.1, b.x, b.y, r);
        g.addColorStop(0, `hsla(${h},${s}%,${Math.min(95, l + 20)}%,0.95)`);
        g.addColorStop(0.7, `hsla(${h},${s}%,${l}%,0.82)`);
        g.addColorStop(1, `hsla(${h},${s}%,${l - 8}%,0.9)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, 7); ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.beginPath(); ctx.ellipse(b.x - r * 0.38, b.y - r * 0.42, r * 0.22, r * 0.13, -0.6, 0, 7); ctx.fill();
      }
      ctx.restore();
    };

    const frame = (now: number) => {
      raf = 0;
      if (!alive) return;
      // Keep the sea lively: small bubbles rise every ~0.7 s, never too many.
      const generic = bubbles.filter((b) => !b.text).length;
      if (now - lastSpawn > (reduce ? 1300 : 700) && generic < 18) { spawn(); lastSpawn = now; }
      for (const b of bubbles) {
        b.grow = Math.min(1, b.grow + 0.04);
        if (b.text && b.target !== undefined && b.y <= b.target) {
          // A thought waits in the middle, bobbing gently.
          b.y += Math.sin(now / 900 + b.phase) * 0.12 * speed;
        } else b.y += b.vy;
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
            if (now - lastMerge > 160) { haptics.merge(); if (sound()) playMerge(); lastMerge = now; }
            bubbles = bubbles.filter((x) => x !== small);
            j = bubbles.length; // restart the inner loop next frame
            continue;
          }
          const nx = dx / d, ny = dy / d;
          const wa = a.text ? 0 : b.text ? 1 : 0.5, wb = 1 - wa;
          a.x -= nx * overlap * wa; a.y -= ny * overlap * wa;
          b.x += nx * overlap * wb; b.y += ny * overlap * wb;
        }
      }
      bubbles = bubbles.filter((b) => b.y > -b.r * 1.2);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      bubbles.forEach(draw);
      // Pops: a ring and droplets that fade.
      bursts = bursts.filter((p) => p.t < 1);
      for (const p of bursts) {
        p.t += 0.06;
        const [h, s, l] = p.c < 0 ? [42, 74, 60] : COLORS[p.c];
        ctx.save(); ctx.globalAlpha = 1 - p.t;
        ctx.strokeStyle = `hsl(${h},${s}%,${l}%)`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + p.t * 0.6), 0, 7); ctx.stroke();
        ctx.fillStyle = `hsl(${h},${s}%,${l}%)`;
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2, dist = p.r * (0.6 + p.t * 0.9);
          ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * dist, p.y + Math.sin(a) * dist, 3 * (1 - p.t) + 1, 0, 7); ctx.fill();
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
      [...bubbles].reverse().find((b) => Math.hypot(b.x - x, b.y - y) < b.r * b.grow + 6 && (words === null || !!b.text === words));
    let down: { b: Bubble | undefined; timer: number; moved: boolean } | null = null;
    const onDown = (ev: PointerEvent) => {
      canvas.setPointerCapture(ev.pointerId);
      const [x, y] = at(ev);
      const b = hit(x, y, null);
      down = { b, moved: false, timer: b?.text ? window.setTimeout(() => { if (down?.b && bubbles.includes(down.b)) keep(down.b); down = null; }, 480) : 0 };
      if (b && !b.text) { pop(b); down.b = undefined; }
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
  };
  const saveKept = async () => {
    if (kept.length === 0) return;
    await addNote({ date: isoLocal(new Date()), text: kept.map((k) => `• ${k}`).join("\n") });
    window.dispatchEvent(new CustomEvent("memap-notes-changed"));
    haptics.success();
    setSaved(true);
  };
  const night = isNightMap();
  const avatar = avatarUrl(getAvatar());

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={t("unload.title")} className="fixed inset-0 z-[70] flex flex-col animate-fade-in"
      style={{ background: night ? "linear-gradient(180deg,#141c39 0%,#1b2550 55%,#2a3470 100%)" : "linear-gradient(180deg,#eef8fb 0%,#cfeaf3 55%,#b2dfec 100%)" }}>
      <div className="flex items-center gap-2 px-3 pt-[max(env(safe-area-inset-top),12px)]">
        <button type="button" onClick={onClose} aria-label={t("common.close")} className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground">
          <X className="h-6 w-6" />
        </button>
        <p className="min-w-0 flex-1 truncate text-[17px] font-bold">{t("unload.title")}</p>
        <button type="button" onClick={() => { haptics.soft(); setMuted((m) => { try { localStorage.setItem("memap_unload_sound", m ? "on" : "off"); } catch { /* ignore */ } return !m; }); }}
          aria-label={muted ? t("unload.soundOn") : t("unload.soundOff")} aria-pressed={!muted}
          className="surface flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground">
          {muted ? <VolumeX className="h-[18px] w-[18px]" strokeWidth={2.2} /> : <Volume2 className="h-[18px] w-[18px]" strokeWidth={2.2} />}
        </button>
        {kept.length > 0 && (
          <span className="surface inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[14px] font-bold">
            <Archive className="h-4 w-4 text-[hsl(var(--coin-gold))]" strokeWidth={2.4} /> {kept.length}
          </span>
        )}
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
          <DictateButton text={text} onText={setText} />
          <button type="button" onClick={() => { haptics.success(); setDone(true); }} className="h-11 shrink-0 rounded-full px-4 text-[15px] font-bold text-[hsl(var(--coin-teal))]">
            {t("unload.done")}
          </button>
        </div>
      </div>

      {done && (
        <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center bg-background/90 px-6 text-center backdrop-blur-sm animate-fade-in">
          {avatar && <img src={avatar} alt="" width={84} height={84} className="mb-3 object-contain" />}
          <p className="text-[28px] font-bold leading-tight tracking-tight">{t("unload.lighter")}</p>
          <p className="mt-2 text-[17px] font-medium text-muted-foreground">
            {[letGo > 0 && t("unload.summary", { count: letGo }), popped > 0 && t("unload.bubbles", { count: popped })].filter(Boolean).join(" · ")}
          </p>
          {kept.length > 0 && (
            <div className="surface mt-5 w-full max-w-sm rounded-[20px] px-5 py-4 text-left">
              <p className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">{t("unload.later")}</p>
              {kept.map((k, i) => <p key={i} className="mt-1.5 text-[16px] font-semibold leading-snug">{k}</p>)}
              {saved ? (
                <p className="mt-3 text-[15px] font-semibold text-[hsl(var(--coin-teal))]">{t("unload.saved")}</p>
              ) : (
                <button type="button" onClick={saveKept} className="mt-3 h-11 rounded-full bg-foreground/[0.06] px-4 text-[15px] font-bold">{t("unload.save")}</button>
              )}
            </div>
          )}
          <div className="mt-6 w-full max-w-sm space-y-2">
            <Pressable tone="teal" haptic="none" onClick={onClose} className="h-[58px] w-full rounded-2xl" faceClassName="text-[16px] font-extrabold uppercase tracking-[0.06em]">
              {t("path.continue")}
            </Pressable>
            <button type="button" onClick={() => setDone(false)} className="h-11 w-full text-[15px] font-semibold text-muted-foreground">{t("unload.more")}</button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
};
