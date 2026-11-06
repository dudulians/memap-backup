// A picture of her world to share (Nov 6 2026, from the hooks list: share cards for
// TikTok / Reels / stories). Story size, drawn on a canvas from her own islands at
// their stages, how many evenings, links and treasures. Nothing private: no question,
// no answer, only islands and counts.
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import planetDay from "@/assets/globe/planet-day.webp";
import planetNight from "@/assets/globe/planet-night.webp";
import { ASPECT, art, artOf } from "@/lib/globeArt";
import type { IslandId } from "@/lib/islands";

export interface ShareWorld {
  /** islands, busiest first, with the evenings answered on each */
  islands: { id: IslandId; name: string; days: number }[];
  title: string;
  sub: string;
  /** three short counts: "18 evenings", "2 links", "5 treasures" */
  stats: string[];
  footer: string;
  night: boolean;
}

const load = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });

const W = 1080, H = 1920;
const FONT = "'MeMap Sans', Manrope, system-ui, sans-serif";

const pill = (g: CanvasRenderingContext2D, text: string, cx: number, cy: number, size: number, dark: boolean) => {
  g.font = `700 ${size}px ${FONT}`;
  const w = g.measureText(text).width + size * 1.4, h = size * 1.9;
  g.fillStyle = dark ? "rgba(30,34,72,.82)" : "rgba(255,255,255,.92)";
  g.beginPath(); g.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2); g.fill();
  g.fillStyle = dark ? "#eef0ff" : "#3a3f55";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, cx, cy + size * 0.05);
};

/** The story picture as a PNG data URL. */
export const drawShareCard = async (w: ShareWorld): Promise<string> => {
  try { await document.fonts?.load(`800 96px 'MeMap Sans'`); } catch { /* falls back to Manrope/system */ }
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  // her sea, covering
  const sea = await load(w.night ? planetNight : planetDay);
  // open sea only: scaled up and anchored at the top, so the planet's land stays off the picture
  const k = Math.max(W / sea.width, H / sea.height) * 1.7;
  g.drawImage(sea, (W - sea.width * k) / 2, 0, sea.width * k, sea.height * k);
  const shade = g.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, w.night ? "rgba(14,18,50,.55)" : "rgba(255,255,255,.35)"); shade.addColorStop(0.35, "rgba(0,0,0,0)"); shade.addColorStop(1, w.night ? "rgba(14,18,50,.5)" : "rgba(255,255,255,.3)");
  g.fillStyle = shade; g.fillRect(0, 0, W, H);

  const ink = w.night ? "#f2f3ff" : "#33384f", soft = w.night ? "rgba(235,238,255,.82)" : "rgba(51,56,79,.75)";
  g.textAlign = "center"; g.textBaseline = "alphabetic";
  g.fillStyle = ink; g.font = `800 104px ${FONT}`; g.fillText(w.title, W / 2, 230);
  g.fillStyle = soft; g.font = `600 46px ${FONT}`; g.fillText(w.sub, W / 2, 310);

  // the islands: the busiest big in the middle, up to four around it
  const spots = [{ x: 540, y: 900, s: 640 }, { x: 250, y: 520, s: 320 }, { x: 830, y: 520, s: 320 }, { x: 240, y: 1300, s: 320 }, { x: 840, y: 1270, s: 320 }];
  const list = w.islands.slice(0, spots.length);
  for (let i = list.length - 1; i >= 0; i--) {
    const isl = list[i], sp = spots[i];
    const name = artOf(isl.id, isl.days);
    const im = await load(art(name, w.night));
    const ww = sp.s * (i === 0 ? 1 : 0.9), hh = ww * (ASPECT[name] ?? im.height / im.width);
    g.save(); g.shadowColor = "rgba(20,50,100,.28)"; g.shadowBlur = 30; g.shadowOffsetY = 16;
    g.drawImage(im, sp.x - ww / 2, sp.y - hh * 0.7, ww, hh); g.restore();
    pill(g, isl.name, sp.x, sp.y + hh * 0.38 + 34, i === 0 ? 40 : 32, w.night);
  }
  // counts
  const sy = 1600, gap = 24;
  g.font = `700 40px ${FONT}`;
  const ws = w.stats.map((s) => g.measureText(s).width + 56);
  let x = (W - ws.reduce((a, b) => a + b, 0) - gap * (ws.length - 1)) / 2;
  w.stats.forEach((s, i) => { pill(g, s, x + ws[i] / 2, sy, 40, w.night); x += ws[i] + gap; });
  g.fillStyle = soft; g.font = `700 40px ${FONT}`; g.textAlign = "center";
  g.fillText(w.footer, W / 2, 1790);
  return c.toDataURL("image/png");
};

/** Hand the picture to the phone's share sheet (or the browser's / a download). */
export const shareCard = async (dataUrl: string, filename: string, text: string): Promise<void> => {
  const base64 = dataUrl.split(",")[1];
  if (Capacitor.isNativePlatform()) {
    const written = await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
    await Share.share({ title: "MeMap", text, url: written.uri, dialogTitle: "MeMap" });
    return;
  }
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "MeMap", text }); } catch { /* cancelled */ }
    return;
  }
  const a = document.createElement("a"); a.href = dataUrl; a.download = filename; a.click();
};
