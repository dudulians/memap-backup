// Reports from her days, two kinds (her notes, Nov 6 2026: "где календарь? даты?";
// "две версии — для себя с картинками и для врача более серьёзно, но с нашим
// названием"). A4 pages drawn on a canvas, made into a PDF (src/lib/pdfImages.ts).
//   pro — for a doctor, a therapist or a coach: MeMap's name and icon, her name if
//         she adds it, a summary of her main question (how often, per week, first
//         half vs second, last time, longest run of "no"), a calendar with day
//         numbers, every question with its counts and the dates of "yes", the days
//         as dots with dates, week by week, what tended to come together, her notes.
//   me  — for herself, with pictures: her islands on her sea, a calendar of her
//         days with the treasures on the days she earned them, her islands with
//         their stages, links with their islands, notes.
// Plain words, nothing the reader has to learn. "Patterns, not a diagnosis."
import i18n from "@/lib/i18n";
import type { Tracker, TrackerEntry } from "@/types/tracker";
import type { Note } from "@/lib/notes";
import { islandName, islandOf, isHardAnswer, linkOf, linkWorthShowing, mapPicFor, type IslandId } from "@/lib/islands";
import { linkOther, linkSentence } from "@/lib/linkText";
import { computeCorrelations, type CorrelationResult } from "@/lib/correlations";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import { isoLocal } from "@/lib/doors";
import { ASPECT, art, artOf, islandEvenings, stageOf } from "@/lib/globeArt";
import { ITEMS, keptTreasures } from "@/lib/growth";
import planetDay from "@/assets/globe/planet-day.webp";
import memapIcon from "@/assets/memap-icon-192.png";

export type Audience = "doctor" | "therapist" | "coach";
export type ReportStyle = "pro" | "me";
/** Topics ticked first for each reader (she can change them). */
export const AUDIENCE_TOPICS: Record<Audience | "me", IslandId[] | "all"> = {
  doctor: ["health", "body", "me"],
  therapist: ["me", "love", "kids", "parents", "work", "health"],
  coach: ["work", "body", "health", "me"],
  me: "all",
};

export interface ReportInput {
  trackers: Tracker[];
  entries: TrackerEntry[];
  notes: Note[];
  style: ReportStyle;
  audience: Audience;
  islands: IslandId[];
  days: number;
  withNotes: boolean;
  /** her name on a specialist's report (optional, kept nowhere) */
  name?: string;
  /** her main question (the topic she chose): the summary and the calendar */
  mainId?: string;
  /** "Your migraine days": the calendar's title in her version */
  daysLabel?: string;
}

export const REPORT_PX = { w: 1240, h: 1754 };
const PX = REPORT_PX;
const M = 92, SPAN = PX.w - 2 * M;
const FONT = "'MeMap Sans', Manrope, system-ui, sans-serif";
const INK = "#2f3448", SOFT = "#6a7088", FAINT = "#b6bbcc", LINE = "rgba(47,52,72,.12)";
const YES = "#5b63d6", NO = "#c9cdf3", NONE = "#e6e8ef", TEAL = "#2f9c90", PANEL = "#f4f5f9";
// her version: hard days reddish, good ones greenish (as in the app, Nov 6 2026); the specialist's stays neutral
const HARD = "#ec7366", CALM = "#7fcf9c";

const ru = () => !!i18n.language?.startsWith("ru");
const locale = () => (ru() ? "ru-RU" : "en-GB");
const dayList = (n: number): string[] => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (n - 1 - i)); return isoLocal(d); });
const date = (iso: string) => new Date(iso + "T00:00:00");
const fmt = (iso: string, year = false) => date(iso).toLocaleDateString(locale(), { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) });
const load = (src: string) => new Promise<HTMLImageElement | null>((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });

const wrap = (g: CanvasRenderingContext2D, text: string, max: number): string[] => {
  const out: string[] = []; let line = "";
  for (const w of text.split(/\s+/)) {
    if (!w) continue;
    const tryL = line ? `${line} ${w}` : w;
    if (g.measureText(tryL).width > max && line) { out.push(line); line = w; } else line = tryL;
  }
  if (line) out.push(line);
  return out;
};
const fit = (g: CanvasRenderingContext2D, s: string, max: number) => {
  if (g.measureText(s).width <= max) return s;
  let x = s; while (x.length > 3 && g.measureText(x + "…").width > max) x = x.slice(0, -1);
  return x.trimEnd() + "…";
};

// --- the page machinery ----------------------------------------------------------
class Pages {
  pages: HTMLCanvasElement[] = [];
  g!: CanvasRenderingContext2D;
  y = 0;
  constructor() { this.add(); }
  add() {
    const c = document.createElement("canvas"); c.width = PX.w; c.height = PX.h;
    this.g = c.getContext("2d")!; this.g.fillStyle = "#fff"; this.g.fillRect(0, 0, PX.w, PX.h);
    this.g.textBaseline = "alphabetic"; this.g.textAlign = "left";
    this.pages.push(c); this.y = M;
  }
  room(h: number) { if (this.y + h > PX.h - M - 50) this.add(); }
  text(s: string, size: number, weight: number, color: string, x = M, align: CanvasTextAlign = "left") {
    const g = this.g; g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = color; g.textAlign = align; g.fillText(s, x, this.y); g.textAlign = "left";
  }
  /** a heading never stays alone at the bottom: it takes room for what follows */
  heading(s: string, next = 60) {
    this.room(110 + next); this.y += 56; this.text(s, 34, 800, INK); this.y += 18;
    this.g.fillStyle = LINE; this.g.fillRect(M, this.y, SPAN, 2); this.y += 40;
  }
}

// --- what both versions count ----------------------------------------------------
interface Data {
  days: string[]; first: string; last: string;
  qs: Tracker[]; main?: Tracker;
  vals: Map<string, Map<string, unknown>>;
  answeredDays: number;
  pairs: CorrelationResult[];
}
const collect = (r: ReportInput): Data => {
  const days = dayList(r.days), first = days[0], last = days[days.length - 1];
  const inPeriod = r.entries.filter((e) => e.date >= first && e.date <= last);
  const qs = r.trackers
    .filter((x) => !x.archived && x.source !== "play" && x.answerType === "boolean" && r.islands.includes(islandOf(x)))
    .sort((a, b) => (a.id === r.mainId ? -1 : b.id === r.mainId ? 1 : (a.sortIndex ?? 0) - (b.sortIndex ?? 0)));
  const vals = new Map<string, Map<string, unknown>>();
  for (const e of inPeriod) { if (!vals.has(e.trackerId)) vals.set(e.trackerId, new Map()); vals.get(e.trackerId)!.set(e.date, e.value); }
  const answeredDays = new Set(inPeriod.filter((e) => qs.some((q) => q.id === e.trackerId)).map((e) => e.date)).size;
  const pairs = computeCorrelations(qs, inPeriod, 6).filter(linkWorthShowing).slice(0, 4);
  return { days, first, last, qs, main: qs.find((q) => q.id === r.mainId) ?? qs[0], vals, answeredDays, pairs };
};
const linkLine = (c: CorrelationResult) => {
  const l = linkOf(c);
  const route = { ...l, a: "other" as const, b: "other" as const, first: l.first.id, second: l.second.id };
  const title = (id: string) => localizeTrackerTitle((id === l.first.id ? l.first : l.second).title);
  return { a: l.first, b: l.second, text: `${linkSentence(i18n.t, route, title)} ${linkOther(i18n.t, route)}` };
};

// --- a month calendar ------------------------------------------------------------
type Mark = { kind: "yes" | "no" | "none" | "out"; icon?: HTMLImageElement | null };
const monthsOf = (days: string[]) => [...new Set(days.map((d) => d.slice(0, 7)))].map((k) => ({ y: +k.slice(0, 4), m: +k.slice(5, 7) - 1 }));
/** One month, Monday first, at (x, y), w wide. Returns its height. */
const drawMonth = (g: CanvasRenderingContext2D, x: number, y: number, w: number, ym: { y: number; m: number }, mark: (iso: string) => Mark, look: ReportStyle): number => {
  const cell = w / 7;
  const title = new Date(ym.y, ym.m, 1).toLocaleDateString(locale(), { month: "long", year: "numeric" }).replace(" г.", "");
  g.font = `800 ${Math.round(Math.min(34, cell * 0.5))}px ${FONT}`; g.fillStyle = INK; g.textAlign = "left";
  g.fillText(title.charAt(0).toUpperCase() + title.slice(1), x, y + cell * 0.45);
  g.font = `600 ${Math.round(Math.min(22, cell * 0.32))}px ${FONT}`; g.fillStyle = SOFT; g.textAlign = "center";
  for (let i = 0; i < 7; i++) {
    const wd = new Date(2024, 0, 1 + i).toLocaleDateString(locale(), { weekday: "short" }).replace(".", "");
    g.fillText(wd.slice(0, 2), x + cell * i + cell / 2, y + cell * 1.05);
  }
  const startDow = (new Date(ym.y, ym.m, 1).getDay() + 6) % 7;
  const daysIn = new Date(ym.y, ym.m + 1, 0).getDate();
  const top = y + cell * 1.3;
  let rows = 0;
  for (let d = 1; d <= daysIn; d++) {
    const idx = startDow + d - 1, row = Math.floor(idx / 7), col = idx % 7;
    rows = Math.max(rows, row + 1);
    const cx = x + col * cell + cell / 2, cy = top + row * cell + cell / 2;
    const mk = mark(isoLocal(new Date(ym.y, ym.m, d))), r = cell * 0.38;
    const num = Math.round(Math.min(24, cell * 0.34));
    g.textAlign = "center"; g.textBaseline = "middle";
    if (mk.kind === "yes") {
      g.fillStyle = look === "pro" ? YES : HARD; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
      g.font = `700 ${num}px ${FONT}`; g.fillStyle = "#fff"; g.fillText(String(d), cx, cy + 1);
    } else if (mk.kind === "no") {
      if (look === "pro") { g.strokeStyle = NO; g.lineWidth = Math.max(2.5, cell * 0.06); g.beginPath(); g.arc(cx, cy, r - 1, 0, Math.PI * 2); g.stroke(); }
      else { g.fillStyle = CALM; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); }
      g.font = `600 ${num}px ${FONT}`; g.fillStyle = INK; g.fillText(String(d), cx, cy + 1);
    } else {
      g.font = `500 ${num}px ${FONT}`; g.fillStyle = mk.kind === "out" ? "#dde0e8" : FAINT; g.fillText(String(d), cx, cy + 1);
    }
    if (mk.icon) { const s = cell * 0.6; g.drawImage(mk.icon, cx + r * 0.2, cy - r - s * 0.45, s, s * (mk.icon.height / mk.icon.width)); }
    g.textBaseline = "alphabetic";
  }
  g.textAlign = "left";
  return cell * 1.3 + rows * cell;
};
/** All months of the period, up to three across, wrapping. */
const drawCalendar = (p: Pages, days: string[], mark: (iso: string) => Mark, look: ReportStyle) => {
  const months = monthsOf(days);
  const cols = Math.min(3, months.length), gap = 50;
  const w = Math.min(cols === 1 ? 620 : 9999, (SPAN - gap * (cols - 1)) / cols);
  for (let i = 0; i < months.length; i += cols) {
    p.room((w / 7) * 7.6 + 20);
    let h = 0;
    months.slice(i, i + cols).forEach((ym, j) => { h = Math.max(h, drawMonth(p.g, M + j * (w + gap), p.y, w, ym, mark, look)); });
    p.y += h + 34;
  }
};
const legend = (p: Pages, items: [string, string, "fill" | "ring" | "plain"][]) => {
  const g = p.g; let lx = M;
  for (const [c, l, kind] of items) {
    if (kind === "fill") { g.fillStyle = c; g.beginPath(); g.arc(lx + 11, p.y - 9, 11, 0, Math.PI * 2); g.fill(); }
    else if (kind === "ring") { g.strokeStyle = c; g.lineWidth = 3; g.beginPath(); g.arc(lx + 11, p.y - 9, 10, 0, Math.PI * 2); g.stroke(); }
    else { g.font = `600 22px ${FONT}`; g.fillStyle = c; g.textAlign = "center"; g.fillText("7", lx + 11, p.y - 1); g.textAlign = "left"; }
    p.text(l, 23, 600, SOFT, lx + 30); g.font = `600 23px ${FONT}`; lx += 30 + g.measureText(l).width + 38;
  }
};
const weeksChart = (p: Pages, data: Data, q: Tracker, color: string) => {
  const v = data.vals.get(q.id) ?? new Map();
  const weeks: { from: string; yes: number; ans: number }[] = [];
  for (let i = 0; i < data.days.length; i += 7) { const w = data.days.slice(i, i + 7); weeks.push({ from: w[0], yes: w.filter((d) => v.get(d) === true).length, ans: w.filter((d) => v.has(d)).length }); }
  p.room(270);
  const g = p.g, col = SPAN / weeks.length, bw = Math.min(100, col - 14), h0 = 170;
  weeks.forEach((w, i) => {
    const x = M + i * col + (col - bw) / 2, h = (w.yes / 7) * h0;
    g.fillStyle = NONE; g.beginPath(); g.roundRect(x, p.y, bw, h0, 10); g.fill();
    if (h > 0) { g.fillStyle = color; g.beginPath(); g.roundRect(x, p.y + h0 - h, bw, h, 10); g.fill(); }
    g.font = `800 25px ${FONT}`; g.fillStyle = w.ans ? INK : SOFT; g.textAlign = "center"; g.fillText(w.ans ? String(w.yes) : "–", x + bw / 2, p.y + h0 - h - 12);
    g.font = `500 ${weeks.length > 9 ? 17 : 20}px ${FONT}`; g.fillStyle = SOFT; g.fillText(fmt(w.from), x + bw / 2, p.y + h0 + 30); g.textAlign = "left";
  });
  p.y += h0 + 76;
  p.text(i18n.t("report.weeksNote"), 21, 500, SOFT);
};
const footers = (p: Pages, text: string) => {
  p.pages.forEach((c, i) => {
    const g = c.getContext("2d")!;
    g.font = `500 20px ${FONT}`; g.fillStyle = SOFT; g.textAlign = "left"; g.fillText(text, M, PX.h - M + 10);
    g.textAlign = "right"; g.fillText(`${i + 1} / ${p.pages.length}`, PX.w - M, PX.h - M + 10);
  });
};
const notesSection = (p: Pages, r: ReportInput, data: Data) => {
  if (!r.withNotes) return;
  const ns = r.notes.filter((x) => x.date >= data.first && x.date <= data.last && x.text.trim()).sort((a, b) => a.date.localeCompare(b.date));
  if (!ns.length) return;
  p.heading(i18n.t("report.notes"), 80);
  for (const nt of ns) {
    p.g.font = `500 25px ${FONT}`;
    const lines = wrap(p.g, nt.text.trim().replace(/\s+/g, " "), SPAN - 170);
    p.room(Math.min(lines.length, 8) * 34 + 24);
    p.text(fmt(nt.date), 24, 700, SOFT);
    lines.slice(0, 8).forEach((l, i) => { p.text(l, 25, 500, INK, M + 160); if (i < Math.min(lines.length, 8) - 1) p.y += 34; });
    p.y += 46;
  }
};

// --- for a specialist -----------------------------------------------------------
const drawPro = async (r: ReportInput, data: Data): Promise<HTMLCanvasElement[]> => {
  const t = i18n.t.bind(i18n);
  const icon = await load(memapIcon);
  const p = new Pages();
  const g = () => p.g;
  // our name and icon, what this is
  if (icon) g().drawImage(icon, M, p.y - 8, 64, 64);
  p.y += 38; p.text("MeMap", 36, 800, INK, M + 80);
  p.text(t("report.pro.kicker"), 22, 700, SOFT, PX.w - M, "right");
  p.y += 36; g().fillStyle = LINE; g().fillRect(M, p.y, SPAN, 2);
  // who it's for, whose, when
  p.y += 76; p.text(t(`report.pro.title.${r.audience}`), 50, 800, INK);
  if (r.name?.trim()) { p.y += 52; p.text(t("report.pro.name", { name: r.name.trim() }), 28, 700, INK); }
  p.y += 48; p.text(t("report.pro.period", { from: fmt(data.first, true), to: fmt(data.last, true), count: r.days }), 26, 600, SOFT);
  p.y += 38; p.text(t("report.pro.answered", { k: data.answeredDays, count: r.days, date: fmt(isoLocal(new Date()), true) }), 23, 500, SOFT);

  const main = data.main;
  if (main) {
    // the summary of her main question
    const v = data.vals.get(main.id) ?? new Map();
    const ans = data.days.filter((d) => v.has(d)), yesD = data.days.filter((d) => v.get(d) === true);
    // the days she answered, split in two: comparable halves even if she started late
    const half = Math.floor(ans.length / 2);
    const h1 = ans.slice(0, half).filter((d) => v.get(d) === true).length, h2 = ans.slice(half).filter((d) => v.get(d) === true).length;
    let run = 0, best = 0; for (const d of data.days) { if (v.get(d) === false) { run++; best = Math.max(best, run); } else if (v.get(d) === true) run = 0; }
    const perWeek = (Math.round((yesD.length / (data.days.length / 7)) * 10) / 10).toLocaleString(locale());
    p.y += 50;
    const top = p.y, boxH = 318;
    g().fillStyle = PANEL; g().beginPath(); g().roundRect(M, top, SPAN, boxH, 24); g().fill();
    p.y = top + 58; p.text(t("report.pro.main"), 21, 700, SOFT, M + 34);
    g().font = `800 34px ${FONT}`; p.y += 48; p.text(fit(g(), localizeTrackerTitle(main.title), SPAN - 68), 34, 800, INK, M + 34);
    const tiles: [string, string][] = [
      [`${yesD.length} / ${ans.length}`, t("report.pro.yesDays", { pct: ans.length ? Math.round((yesD.length / ans.length) * 100) : 0 })],
      [perWeek, t("report.pro.perWeek")],
      [`${h1} → ${h2}`, t("report.pro.halves")],
      [yesD.length ? fmt(yesD[yesD.length - 1]) : "—", t("report.pro.lastTime")],
      [String(best), t("report.pro.longestNo")],
    ];
    const tw = (SPAN - 68) / tiles.length;
    p.y = top + 196;
    tiles.forEach(([big, small], i) => {
      const x = M + 34 + i * tw;
      g().font = `800 38px ${FONT}`; g().fillStyle = YES; g().fillText(fit(g(), big, tw - 12), x, p.y);
      g().font = `600 19px ${FONT}`; g().fillStyle = SOFT;
      wrap(g(), small, tw - 16).slice(0, 3).forEach((l, j) => g().fillText(l, x, p.y + 36 + j * 24));
    });
    p.y = top + boxH;

    // the calendar of her main question, day numbers in it
    p.heading(t("report.pro.calendar", { q: localizeTrackerTitle(main.title) }), 360);
    legend(p, [[YES, t("report.yes"), "fill"], [NO, t("report.no"), "ring"], [FAINT, t("report.none"), "plain"]]);
    p.y += 34;
    drawCalendar(p, data.days, (iso) => {
      if (iso < data.first || iso > data.last) return { kind: "out" };
      const x = v.get(iso); return { kind: x === true ? "yes" : x === false ? "no" : "none" };
    }, "pro");
  }

  // every question: how often, and the dates of "yes"
  p.heading(t("report.pro.all"), 130);
  const cQ = M, cN = M + SPAN * 0.44, cD = M + SPAN * 0.63;
  p.text(t("report.pro.colQ"), 18, 700, SOFT, cQ); p.text(t("report.pro.colN"), 18, 700, SOFT, cN); p.text(t("report.pro.colD"), 18, 700, SOFT, cD);
  p.y += 14;
  for (const q of data.qs) {
    const v = data.vals.get(q.id) ?? new Map();
    const yesD = data.days.filter((d) => v.get(d) === true), ans = data.days.filter((d) => v.has(d)).length;
    // all the dates when there are few; the last five when there are many
    const many = yesD.length > 10, list = many ? yesD.slice(-5) : yesD;
    const byM = new Map<string, number[]>();
    list.forEach((d) => { const k = date(d).toLocaleDateString(locale(), { month: "short" }).replace(".", ""); byM.set(k, [...(byM.get(k) ?? []), date(d).getDate()]); });
    const joined = [...byM].map(([mo, ds]) => `${mo}: ${ds.join(", ")}`).join("  ·  ");
    const dates = !list.length ? "" : many ? t("report.pro.lastOnes", { dates: joined }) : joined;
    g().font = `500 21px ${FONT}`;
    const dl = dates ? wrap(g(), dates, PX.w - M - cD) : [];
    const extra = Math.max(0, dl.length - 1) * 28;
    p.room(62 + extra);
    g().fillStyle = LINE; g().fillRect(M, p.y + 4, SPAN, 1.5);
    p.y += 44;
    g().font = `${q.id === main?.id ? 800 : 700} 23px ${FONT}`;
    p.text(fit(g(), localizeTrackerTitle(q.title), cN - cQ - 20), 23, q.id === main?.id ? 800 : 700, INK, cQ);
    p.text(`${yesD.length} / ${ans}`, 23, 700, INK, cN);
    const y0 = p.y;
    dl.forEach((l, i) => { p.y = y0 + i * 28; p.text(l, 21, 500, SOFT, cD); });
    p.y = y0 + extra + 8;
  }

  // the days as dots, dates under them
  p.heading(t("report.days"), 170);
  legend(p, [[YES, t("report.yes"), "fill"], [NO, t("report.no"), "fill"], [NONE, t("report.none"), "fill"]]);
  p.y += 50;
  const step = SPAN / data.days.length, rr = Math.max(3.5, Math.min(11, step * 0.36));
  const ticks = () => {
    g().font = `500 18px ${FONT}`; g().fillStyle = SOFT; g().textAlign = "center";
    for (let i = 0; i < data.days.length; i += 7) g().fillText(fmt(data.days[i]), Math.min(PX.w - M - 30, Math.max(M + 30, M + step * i + step / 2)), p.y);
    g().textAlign = "left";
  };
  data.qs.forEach((q, qi) => {
    const v = data.vals.get(q.id) ?? new Map();
    const before = p.pages.length; p.room(76);
    if (p.pages.length !== before && qi > 0) { /* new page: the dates again at the end */ }
    g().font = `700 21px ${FONT}`;
    p.text(fit(g(), localizeTrackerTitle(q.title), SPAN), 21, 700, INK);
    p.y += 22;
    data.days.forEach((d, i) => { const x = v.get(d); g().fillStyle = x === true ? YES : x === false ? NO : NONE; g().beginPath(); g().arc(M + step * i + step / 2, p.y, rr, 0, Math.PI * 2); g().fill(); });
    p.y += rr + 30;
  });
  ticks(); p.y += 6;

  // week by week
  if (main) { p.heading(t("report.weeks", { q: localizeTrackerTitle(main.title) }), 300); weeksChart(p, data, main, YES); }

  // what tended to come together
  p.heading(t("report.together"), 90);
  if (data.pairs.length === 0) { p.room(60); p.text(t("report.togetherNone"), 24, 600, SOFT); p.y += 20; }
  for (const c of data.pairs) {
    g().font = `600 24px ${FONT}`;
    const lines = wrap(g(), linkLine(c).text, SPAN - 40);
    p.room(lines.length * 34 + 20);
    g().fillStyle = TEAL; g().beginPath(); g().arc(M + 9, p.y - 9, 7, 0, Math.PI * 2); g().fill();
    lines.forEach((l, i) => { p.text(l, 24, 600, INK, M + 32); if (i < lines.length - 1) p.y += 33; });
    p.y += 42;
  }
  p.room(50); p.text(t("link.honest"), 20, 500, SOFT); p.y += 10;
  notesSection(p, r, data);
  footers(p, t("report.pro.footer"));
  return p.pages;
};

// --- for herself, with pictures -------------------------------------------------
const drawMe = async (r: ReportInput, data: Data): Promise<HTMLCanvasElement[]> => {
  const t = i18n.t.bind(i18n);
  const p = new Pages();
  const g = () => p.g;
  const evenings = islandEvenings(r.trackers, r.entries);
  const isles = r.islands.filter((i) => data.qs.some((q) => islandOf(q) === i)).sort((a, b) => (evenings.get(b) ?? 0) - (evenings.get(a) ?? 0));

  // the cover: her islands on her sea
  const bandH = 720;
  const sea = await load(planetDay);
  if (sea) {
    // open sea only, inside the band
    const k = Math.max(PX.w / sea.width, bandH / sea.height) * 2.2;
    g().save(); g().beginPath(); g().rect(0, 0, PX.w, bandH); g().clip();
    g().drawImage(sea, (PX.w - sea.width * k) / 2, (bandH - sea.height * k) / 2, sea.width * k, sea.height * k);
    g().restore();
  }
  const fade = g().createLinearGradient(0, bandH - 170, 0, bandH); fade.addColorStop(0, "rgba(255,255,255,0)"); fade.addColorStop(1, "#fff");
  g().fillStyle = fade; g().fillRect(0, bandH - 170, PX.w, 172);
  p.y = 140; p.text(t("report.me.title"), 66, 800, INK, PX.w / 2, "center");
  p.y += 56; p.text(`${fmt(data.first)} – ${fmt(data.last)}`, 30, 600, SOFT, PX.w / 2, "center");
  const spots = [{ x: 620, y: 500, s: 440 }, { x: 240, y: 390, s: 250 }, { x: 1000, y: 390, s: 250 }, { x: 205, y: 610, s: 210 }, { x: 1035, y: 610, s: 210 }];
  for (let i = Math.min(isles.length, spots.length) - 1; i >= 0; i--) {
    const id = isles[i], sp = spots[i], name = artOf(id, evenings.get(id) ?? 0);
    const im = await load(art(name, false)); if (!im) continue;
    const w = sp.s, h = w * (ASPECT[name] ?? im.height / im.width);
    g().save(); g().shadowColor = "rgba(20,50,100,.25)"; g().shadowBlur = 24; g().shadowOffsetY = 12;
    g().drawImage(im, sp.x - w / 2, sp.y - h * 0.7, w, h); g().restore();
    const label = islandName(t, id); g().font = `700 ${i === 0 ? 28 : 23}px ${FONT}`;
    const lw = g().measureText(label).width + 30, lh = i === 0 ? 46 : 40, ly = sp.y + h * 0.36 + 24;
    g().fillStyle = "rgba(255,255,255,.92)"; g().beginPath(); g().roundRect(sp.x - lw / 2, ly - lh / 2, lw, lh, lh / 2); g().fill();
    g().fillStyle = INK; g().textAlign = "center"; g().textBaseline = "middle"; g().fillText(label, sp.x, ly + 1); g().textBaseline = "alphabetic"; g().textAlign = "left";
  }
  // counts
  p.y = bandH + 26;
  const kept = keptTreasures();
  const earned = Object.values(kept).filter((d) => !!d && d >= data.first && d <= data.last).length;
  const stats = [t("share.evenings", { count: data.answeredDays }), t("share.links", { count: data.pairs.length }), t("report.me.treasures", { count: earned })];
  g().font = `700 30px ${FONT}`;
  const ws = stats.map((s) => g().measureText(s).width + 50); let sx = (PX.w - ws.reduce((a, b) => a + b, 0) - 20 * (ws.length - 1)) / 2;
  stats.forEach((s, i) => { g().fillStyle = PANEL; g().beginPath(); g().roundRect(sx, p.y - 40, ws[i], 58, 29); g().fill(); g().fillStyle = INK; g().textAlign = "center"; g().fillText(s, sx + ws[i] / 2, p.y - 1); g().textAlign = "left"; sx += ws[i] + 20; });

  // the calendar of her days, treasures on the days they came
  const main = data.main;
  if (main) {
    const v = data.vals.get(main.id) ?? new Map();
    const icons = new Map<string, HTMLImageElement | null>();
    for (const it of ITEMS) { const d = kept[it.id]; if (d && d >= data.first && d <= data.last && !icons.has(d)) icons.set(d, await load(mapPicFor(it.pic, false))); }
    p.heading(r.daysLabel || localizeTrackerTitle(main.title), 340);
    legend(p, [[HARD, t("report.me.hard"), "fill"], [CALM, t("report.me.calm"), "fill"], [FAINT, t("report.none"), "plain"]]);
    p.y += 34;
    drawCalendar(p, data.days, (iso) => {
      if (iso < data.first || iso > data.last) return { kind: "out" };
      const x = v.get(iso);
      return { kind: x === undefined ? "none" : isHardAnswer(main, x) ? "yes" : "no", icon: icons.get(iso) };
    }, "me");
    if (icons.size) { p.room(40); p.text(t("report.me.treasureDays"), 21, 500, SOFT); p.y += 10; }
    p.heading(t("report.weeks", { q: localizeTrackerTitle(main.title) }), 300); weeksChart(p, data, main, HARD);
  }

  // her islands
  p.heading(t("report.me.islands"), 220);
  const cw = (SPAN - 30) / 2;
  for (let i = 0; i < isles.length; i += 2) {
    p.room(210);
    for (let j = 0; j < 2 && i + j < isles.length; j++) {
      const id = isles[i + j], x = M + j * (cw + 30), top = p.y;
      const n = evenings.get(id) ?? 0, name = artOf(id, n);
      g().fillStyle = PANEL; g().beginPath(); g().roundRect(x, top, cw, 180, 24); g().fill();
      const im = await load(art(name, false));
      if (im) { const w = 170, h = w * (ASPECT[name] ?? im.height / im.width); g().drawImage(im, x + 18, top + 90 - h / 2, w, h); }
      const qsHere = data.qs.filter((q) => islandOf(q) === id);
      // calm days: answered there, and no hard answer
      const ansD = data.days.filter((d) => qsHere.some((q) => data.vals.get(q.id)?.has(d)));
      const calm = ansD.filter((d) => !qsHere.some((q) => { const val = data.vals.get(q.id)?.get(d); return val !== undefined && isHardAnswer(q, val); })).length;
      const ans = ansD.length;
      g().font = `800 28px ${FONT}`; g().fillStyle = INK; g().fillText(fit(g(), islandName(t, id), cw - 220), x + 206, top + 64);
      g().font = `600 21px ${FONT}`; g().fillStyle = SOFT;
      g().fillText(fit(g(), `${t(`path.stage${stageOf(n)}`)} · ${t("report.me.evenings", { count: n })}`, cw - 220), x + 206, top + 100);
      g().fillText(fit(g(), t("report.me.calmDays", { k: calm, count: ans }), cw - 220), x + 206, top + 132);
    }
    p.y += 210;
  }

  // what came together, with the islands' pictures
  p.heading(t("report.together"), 100);
  if (data.pairs.length === 0) { p.room(60); p.text(t("report.togetherNone"), 24, 600, SOFT); p.y += 20; }
  for (const c of data.pairs) {
    const L = linkLine(c);
    g().font = `600 24px ${FONT}`;
    const lines = wrap(g(), L.text, SPAN - 150);
    p.room(Math.max(96, lines.length * 34 + 34));
    const top = p.y - 32;
    for (const [k, tr] of [[0, L.a], [1, L.b]] as const) {
      const id = islandOf(tr), im = await load(art(artOf(id, evenings.get(id) ?? 0), false));
      if (im) g().drawImage(im, M + k * 50, top + (k ? 22 : 0), 72, 72 * (im.height / im.width));
    }
    const y0 = p.y;
    lines.forEach((l, i) => { p.y = y0 + i * 33; p.text(l, 24, 600, INK, M + 140); });
    p.y = Math.max(y0 + (lines.length - 1) * 33 + 46, y0 + 70);
  }
  p.room(50); p.text(t("link.honest"), 20, 500, SOFT); p.y += 10;
  notesSection(p, r, data);
  footers(p, t("report.me.footer"));
  return p.pages;
};

/** The pages as JPEG data URLs (A4, 150 dpi). */
export const drawReport = async (r: ReportInput): Promise<string[]> => {
  try { await document.fonts?.load(`700 40px 'MeMap Sans'`); await document.fonts?.load(`800 40px 'MeMap Sans'`); } catch { /* system font */ }
  const data = collect(r);
  const pages = r.style === "me" ? await drawMe(r, data) : await drawPro(r, data);
  return pages.map((c) => c.toDataURL("image/jpeg", 0.9));
};
