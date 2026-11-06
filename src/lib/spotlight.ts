// What "Look around" (src/components/AppTour.tsx) and the first link moment
// (src/components/LinkMoment.tsx) share: finding a place on the page, framing an
// island with its name, and drawing a link from one island to another, dot by dot.
import { useEffect, useState } from "react";

export type Pt = { x: number; y: number };
export const MAP_VIEW = "memap_map_view";

export const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
export const frames = (n: number) => new Promise<void>((r) => { const go = (k: number) => (k <= 0 ? r() : requestAnimationFrame(() => go(k - 1))); go(n); });
export const findTarget = async (sel: string): Promise<HTMLElement | null> => {
  for (let i = 0; i < 60; i++) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el && el.getBoundingClientRect().width > 0) return el;
    await wait(40);
  }
  return null;
};
export const centre = (el: HTMLElement): Pt => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.55 }; };
/** an island on the map with its name under it */
export const isleRects = (els: HTMLElement[]): DOMRect[] => els.flatMap((e) => {
  const lab = e.querySelector<HTMLElement>(".planet-label");
  return lab ? [e.getBoundingClientRect(), lab.getBoundingClientRect()] : [e.getBoundingClientRect()];
});
export const union = (rs: DOMRect[]): DOMRect => {
  const l = Math.min(...rs.map((r) => r.left)), t = Math.min(...rs.map((r) => r.top));
  const rr = Math.max(...rs.map((r) => r.right)), b = Math.max(...rs.map((r) => r.bottom));
  return new DOMRect(l, t, rr - l, b - t);
};
/** Dots along a soft curve from one island to another, clear of both (and of
 *  their names), and the curve's middle for the link sign. */
export const curveDots = (a: Pt, b: Pt, clear = 54) => {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const c = { x: (a.x + b.x) / 2 - (dy / len) * len * 0.16, y: (a.y + b.y) / 2 + (dx / len) * len * 0.16 };
  const pt = (u: number) => ({ x: (1 - u) ** 2 * a.x + 2 * (1 - u) * u * c.x + u * u * b.x, y: (1 - u) ** 2 * a.y + 2 * (1 - u) * u * c.y + u * u * b.y });
  const n = Math.max(5, Math.round(len / 17));
  const dots = Array.from({ length: n + 1 }, (_, i) => pt(i / n)).filter((p) => Math.hypot(p.x - a.x, p.y - a.y) > clear && Math.hypot(p.x - b.x, p.y - b.y) > clear);
  return { dots, mid: pt(0.5) };
};

/** reduced motion asked: everything is simply there */
export const still = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
/** a number counting up to `to` */
export const useCount = (to: number, delay: number, step = 280) => {
  const [n, setN] = useState(() => (still() ? to : 0));
  useEffect(() => {
    if (still()) { setN(to); return; }
    setN(0);
    let k = 0;
    let timer = window.setTimeout(function tick() { k += 1; setN(k); if (k < to) timer = window.setTimeout(tick, step); }, delay);
    return () => window.clearTimeout(timer);
  }, [to, delay, step]);
  return n;
};
