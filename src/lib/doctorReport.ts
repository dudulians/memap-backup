// Reports from her days. A4 pages drawn on a canvas, made into a PDF (src/lib/pdfImages.ts).
// v95 (Nov 7 2026), her notes: "только один вопрос основной, да ещё и какой-то ненужный";
// "в старом стиле"; "подробную версию, где будет прям всё, и какую-то справку"; "по
// дефолту всё идёт, но можно какие-то вопросы отжать, чтоб не попадали, но и связи тоже".
//   - Every question with answers in the period goes in. The ones unticked in the sheet
//     stay out, and so do their links: links are counted only between the questions in.
//   - Every topic from onboarding (up to 3) is a main question with its own summary.
//   - Two kinds: short (one page, a "справка") and full (everything).
//   - The app's look: a hard answer rose red, a good one green, a neutral one indigo,
//     days as dots, calendars with weekdays and dates; Manrope, soft graphite text.
// Two looks: for a specialist (MeMap's name and icon, her name if she adds it) and for
// herself (her islands on her sea, treasures on the days she earned them).
// Plain words, nothing the reader has to learn. "Patterns, not a diagnosis."
import i18n from "@/lib/i18n";
import type { Tracker, TrackerEntry } from "@/types/tracker";
import type { Note } from "@/lib/notes";
import { islandName, islandOf, isHardAnswer, isNeutralQuestion, isTestQuestion, linkOf, linkWorthShowing, mapPicFor, type IslandId } from "@/lib/islands";
import { linkOther, linkSentence, linkShort } from "@/lib/linkText";
import { computeCorrelations, type CorrelationResult } from "@/lib/correlations";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import { getDoorState, isoLocal } from "@/lib/doors";
import { ASPECT, art, artOf, islandEvenings, stageOf } from "@/lib/globeArt";
import { ITEMS, keptTreasures } from "@/lib/growth";
import planetDay from "@/assets/globe/planet-day.webp";
import memapIcon from "@/assets/memap-icon-192.png";

export type Audience = "doctor" | "therapist" | "coach" | "me";
export type ReportKind = "short" | "full";
/** The islands each reader sees first (all questions still go in). */
const AUDIENCE_ORDER: Record<Audience, IslandId[]> = {
  doctor: ["health", "body", "me"],
  therapist: ["me", "love", "kids", "parents", "work", "health"],
  coach: ["work", "body", "health", "me"],
  me: [],
};

export interface ReportInput {
  trackers: Tracker[];
  entries: TrackerEntry[];
  notes: Note[];
  audience: Audience;
  kind: ReportKind;
  /** the questions that go in (ticked in the sheet) */
  ids: string[];
  /** her topics' main questions, in order (up to 3) */
  mainIds: string[];
  days: number;
  withNotes: boolean;
  /** her name on a specialist's report (optional, kept nowhere) */
  name?: string;
  /** "Your migraine days": the first main calendar's title in her version */
  daysLabel?: string;
}

export const REPORT_PX = { w: 1240, h: 1754 };
const PX = REPORT_PX;
const M = 92, SPAN = PX.w - 2 * M, BOTTOM = PX.h - M - 50;
const FONT = "'MeMap Sans', Manrope, system-ui, sans-serif";
// the app's new look (src/index.css, html[data-ui="new"][data-theme="aurora-light"])
const INK = "#3A3F4E", SOFT = "#6B7184", FAINT = "#b9bdca", LINE = "rgba(58,63,78,.12)";
const HARD = "#e7798f", GOOD = "#6bc793", GOOD_INK = "#17452c", NEUTRAL = "#6272da", NEUTRAL_NO = "#c9cef3", NONE = "#e7e9ef";

const ru = () => !!i18n.language?.startsWith("ru");
const locale = () => (ru() ? "ru-RU" : "en-GB");
const dayList = (n: number): string[] => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (n - 1 - i)); return isoLocal(d); });
const date = (iso: string) => new Date(iso + "T00:00:00");
const fmt = (iso: string, year = false) => date(iso).toLocaleDateString(locale(), { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) });
const load = (src: string) => new Promise<HTMLImageElement | null>((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
const title = (q: Tracker) => localizeTrackerTitle(q.title);

/** A wish, a decision or a test: no good or bad answer. */
const neutralQ = (q: Tracker) => isNeutralQuestion(q) || isTestQuestion(q);
/** An answer's colour, by what it means (as in the app). */
const tone = (q: Tracker, v: unknown): string => v === undefined ? NONE : neutralQ(q) ? (v === true ? NEUTRAL : NEUTRAL_NO) : isHardAnswer(q, v) ? HARD : GOOD;
const toneInk = (fill: string): string => (fill === GOOD ? GOOD_INK : fill === NEUTRAL_NO ? INK : "#fff");

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

// --- which questions, in which order (the sheet uses these too) -------------------
const reportable = (x: Tracker) => !x.archived && x.source !== "play" && x.answerType === "boolean";
const orderIslands = (audience: Audience, isles: IslandId[]): IslandId[] => {
  const first = AUDIENCE_ORDER[audience].filter((i) => isles.includes(i));
  return [...first, ...isles.filter((i) => !first.includes(i))];
};
/** Her questions with answers in the period, grouped by island, the reader's islands
 *  first; each with how many days it was answered. */
export const reportQuestions = (trackers: Tracker[], entries: TrackerEntry[], days: number, audience: Audience): { island: IslandId; qs: { q: Tracker; answered: number }[] }[] => {
  const ds = dayList(days), first = ds[0], last = ds[ds.length - 1];
  const count = new Map<string, number>();
  for (const e of entries) if (e.date >= first && e.date <= last) count.set(e.trackerId, (count.get(e.trackerId) ?? 0) + 1);
  const live = trackers.filter((x) => reportable(x) && (count.get(x.id) ?? 0) > 0).sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
  const isles: IslandId[] = []; for (const q of live) { const i = islandOf(q); if (!isles.includes(i)) isles.push(i); }
  return orderIslands(audience, isles).map((island) => ({ island, qs: live.filter((q) => islandOf(q) === island).map((q) => ({ q, answered: count.get(q.id) ?? 0 })) }));
};
/** Her topics from onboarding: the first one and the others picked with it. */
export const reportMainIds = (): string[] => {
  const door = getDoorState();
  if (!door) return [];
  return [...new Set([door.trackerId, ...(door.extra ?? []).map((e) => e.trackerId)])];
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
  room(h: number) { if (this.y + h > BOTTOM) this.add(); }
  text(s: string, size: number, weight: number, color: string, x = M, align: CanvasTextAlign = "left") {
    const g = this.g; g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = color; g.textAlign = align; g.fillText(s, x, this.y); g.textAlign = "left";
  }
  /** a heading never stays alone at the bottom: it takes room for what follows */
  heading(s: string, next = 60) {
    this.room(110 + next); this.y += 60; this.text(s, 34, 800, INK); this.y += 44;
  }
  /** a small grey label over a block */
  label(s: string) { this.text(s.toUpperCase(), 20, 800, SOFT); }
}

// --- what every version counts ----------------------------------------------------
interface Data {
  days: string[]; first: string; last: string;
  qs: Tracker[]; mains: Tracker[]; others: Tracker[];
  vals: Map<string, Map<string, unknown>>;
  answeredDays: number;
  pairs: CorrelationResult[];
}
const collect = (r: ReportInput): Data => {
  const days = dayList(r.days), first = days[0], last = days[days.length - 1];
  const inPeriod = r.entries.filter((e) => e.date >= first && e.date <= last);
  const vals = new Map<string, Map<string, unknown>>();
  for (const e of inPeriod) { if (!vals.has(e.trackerId)) vals.set(e.trackerId, new Map()); vals.get(e.trackerId)!.set(e.date, e.value); }
  const ids = new Set(r.ids);
  const groups = reportQuestions(r.trackers, r.entries, r.days, r.audience);
  const qs = groups.flatMap((gr) => gr.qs.map((x) => x.q)).filter((q) => ids.has(q.id));
  let mains = r.mainIds.map((id) => qs.find((q) => q.id === id)).filter((q): q is Tracker => !!q).slice(0, 3);
  // no topic of hers in the report: the question answered most often leads
  if (!mains.length && qs.length) mains = [[...qs].sort((a, b) => (vals.get(b.id)?.size ?? 0) - (vals.get(a.id)?.size ?? 0))[0]];
  const answeredDays = new Set(inPeriod.filter((e) => ids.has(e.trackerId)).map((e) => e.date)).size;
  // links only between the questions that go in
  const pairs = computeCorrelations(qs, inPeriod.filter((e) => ids.has(e.trackerId)), 6).filter(linkWorthShowing);
  return { days, first, last, qs, mains, others: qs.filter((q) => !mains.includes(q)), vals, answeredDays, pairs };
};
const linkLine = (c: CorrelationResult, pro: boolean) => {
  const l = linkOf(c);
  const route = { ...l, a: "other" as const, b: "other" as const, first: l.first.id, second: l.second.id };
  const of = (id: string) => (id === l.first.id ? l.first : l.second);
  return { a: l.first, b: l.second, text: `${(pro ? linkShort : linkSentence)(i18n.t, route, of)} ${linkOther(i18n.t, route)}` };
};
/** How often, by halves, the last time, the longest run without. */
const summaryOf = (data: Data, q: Tracker) => {
  const v = data.vals.get(q.id) ?? new Map();
  const ans = data.days.filter((d) => v.has(d)), yesD = data.days.filter((d) => v.get(d) === true);
  const half = Math.floor(ans.length / 2);
  const h1 = ans.slice(0, half).filter((d) => v.get(d) === true).length, h2 = ans.slice(half).filter((d) => v.get(d) === true).length;
  let run = 0, best = 0; for (const d of data.days) { if (v.get(d) === false) { run++; best = Math.max(best, run); } else if (v.get(d) === true) run = 0; }
  const perWeek = (Math.round((yesD.length / (data.days.length / 7)) * 10) / 10).toLocaleString(locale());
  return { v, ans, yesD, h1, h2, best, perWeek, last: yesD.length ? fmt(yesD[yesD.length - 1]) : "—" };
};

// --- days as dots ------------------------------------------------------------------
const strip = (p: Pages, data: Data, q: Tracker, x0: number, w: number, maxR = 10) => {
  const v = data.vals.get(q.id) ?? new Map(), step = w / data.days.length, rr = Math.max(2.2, Math.min(maxR, step * 0.36));
  data.days.forEach((d, i) => { p.g.fillStyle = tone(q, v.get(d)); p.g.beginPath(); p.g.arc(x0 + step * i + step / 2, p.y, rr, 0, Math.PI * 2); p.g.fill(); });
  return rr;
};
/** The dates under a row of dots: one a week. */
const ticks = (p: Pages, data: Data, x0 = M, w = SPAN) => {
  const g = p.g, step = w / data.days.length, every = data.days.length > 60 ? 14 : 7;
  g.font = `500 18px ${FONT}`; g.fillStyle = SOFT; g.textAlign = "center";
  for (let i = 0; i < data.days.length; i += every) g.fillText(fmt(data.days[i]), Math.min(x0 + w - 34, Math.max(x0 + 34, x0 + step * i + step / 2)), p.y);
  g.textAlign = "left";
};
const legend = (p: Pages, items: [string, string][]) => {
  const g = p.g; let lx = M;
  for (const [c, l] of items) {
    g.fillStyle = c; g.beginPath(); g.arc(lx + 11, p.y - 8, 11, 0, Math.PI * 2); g.fill();
    p.text(l, 22, 600, SOFT, lx + 30); g.font = `600 22px ${FONT}`; lx += 30 + g.measureText(l).width + 36;
  }
};
/** One legend for many questions: what the colours mean. */
const toneLegend = (p: Pages, qs: Tracker[]) => {
  const t = i18n.t.bind(i18n);
  legend(p, [[HARD, t("report.legend.hard")], [GOOD, t("report.legend.good")], ...(qs.some(neutralQ) ? [[NEUTRAL, t("report.legend.neutral")] as [string, string]] : []), [NONE, t("report.none")]]);
};
/** One question's legend: its real answers in their colours. */
const answerLegend = (p: Pages, q: Tracker) => {
  const t = i18n.t.bind(i18n);
  legend(p, [[tone(q, true), t("report.yes")], [tone(q, false), t("report.no")], [NONE, t("report.none")]]);
};

/** A main question in a few lines: its name, how often, its days as dots, the trend. */
const mainBlock = (p: Pages, data: Data, q: Tracker, full = true) => {
  const t = i18n.t.bind(i18n), g = p.g, s = summaryOf(data, q);
  p.room(230);
  p.y += 46;
  const big = t("report.kOfN", { k: s.yesD.length, count: s.ans.length });
  g.font = `800 32px ${FONT}`; const bw = g.measureText(big).width;
  p.text(fit(g, title(q), SPAN - bw - 40), 32, 800, INK);
  p.text(big, 32, 800, tone(q, true) === GOOD ? "#3f9d68" : tone(q, true) === HARD ? "#d4566f" : NEUTRAL, M + SPAN, "right");
  p.y += 40; strip(p, data, q, M, SPAN);
  p.y += 40; ticks(p, data);
  p.y += 40;
  const line = t(full ? "report.statsLineFull" : "report.statsLine", { pw: s.perWeek, h1: s.h1, h2: s.h2, last: s.last, best: s.best });
  g.font = `600 21px ${FONT}`; wrap(g, line, SPAN).slice(0, 2).forEach((l, i) => { if (i) p.y += 28; p.text(l, 21, 600, SOFT); });
  p.y += 8;
};
/** A question in one row: its name, its days as small dots, how many. */
const rowLine = (p: Pages, data: Data, q: Tracker) => {
  const g = p.g, v = data.vals.get(q.id) ?? new Map();
  const yes = data.days.filter((d) => v.get(d) === true).length, ans = data.days.filter((d) => v.has(d)).length;
  const cN = M + SPAN, sx = M + SPAN * 0.42, sw = SPAN * 0.46;
  p.y += 44;
  g.font = `700 22px ${FONT}`; p.text(fit(g, title(q), sx - M - 24), 22, 700, INK);
  const y = p.y; p.y -= 8; strip(p, data, q, sx, sw, 7); p.y = y;
  p.text(`${yes} / ${ans}`, 22, 700, INK, cN, "right");
};
const linksList = (p: Pages, data: Data, max: number, pro: boolean) => {
  const t = i18n.t.bind(i18n), g = p.g;
  if (data.pairs.length === 0) { p.room(60); p.text(t("report.togetherNone"), 23, 600, SOFT); p.y += 20; return; }
  for (const c of data.pairs.slice(0, max)) {
    g.font = `600 23px ${FONT}`;
    const lines = wrap(g, linkLine(c, pro).text, SPAN - 40);
    p.room(lines.length * 33 + 20);
    g.fillStyle = NEUTRAL; g.beginPath(); g.arc(M + 9, p.y - 8, 7, 0, Math.PI * 2); g.fill();
    lines.forEach((l, i) => { p.text(l, 23, 600, INK, M + 32); if (i < lines.length - 1) p.y += 33; });
    p.y += 42;
  }
  p.room(50); p.text(t("link.honest"), 20, 500, SOFT); p.y += 10;
};

// --- a month calendar ------------------------------------------------------------
type Mark = { fill: string | null; out?: boolean; icon?: HTMLImageElement | null };
const monthsOf = (days: string[]) => [...new Set(days.map((d) => d.slice(0, 7)))].map((k) => ({ y: +k.slice(0, 4), m: +k.slice(5, 7) - 1 }));
/** One month, Monday first, at (x, y), w wide. Returns its height. */
const drawMonth = (g: CanvasRenderingContext2D, x: number, y: number, w: number, ym: { y: number; m: number }, mark: (iso: string) => Mark): number => {
  const cell = w / 7;
  const name = new Date(ym.y, ym.m, 1).toLocaleDateString(locale(), { month: "long", year: "numeric" }).replace(" г.", "");
  g.font = `800 ${Math.round(Math.min(32, cell * 0.5))}px ${FONT}`; g.fillStyle = INK; g.textAlign = "left";
  g.fillText(name.charAt(0).toUpperCase() + name.slice(1), x, y + cell * 0.45);
  g.font = `600 ${Math.round(Math.min(21, cell * 0.32))}px ${FONT}`; g.fillStyle = SOFT; g.textAlign = "center";
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
    const num = Math.round(Math.min(23, cell * 0.34));
    g.textAlign = "center"; g.textBaseline = "middle";
    if (mk.fill) {
      g.fillStyle = mk.fill; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
      g.font = `700 ${num}px ${FONT}`; g.fillStyle = toneInk(mk.fill); g.fillText(String(d), cx, cy + 1);
    } else {
      g.font = `500 ${num}px ${FONT}`; g.fillStyle = mk.out ? "#dfe1e8" : FAINT; g.fillText(String(d), cx, cy + 1);
    }
    if (mk.icon) { const s = cell * 0.6; g.drawImage(mk.icon, cx + r * 0.2, cy - r - s * 0.45, s, s * (mk.icon.height / mk.icon.width)); }
    g.textBaseline = "alphabetic";
  }
  g.textAlign = "left";
  return cell * 1.3 + rows * cell;
};
/** All months of the period, up to three across, wrapping. */
const drawCalendar = (p: Pages, data: Data, q: Tracker, icons?: Map<string, HTMLImageElement | null>) => {
  const v = data.vals.get(q.id) ?? new Map();
  const mark = (iso: string): Mark => iso < data.first || iso > data.last ? { fill: null, out: true } : { fill: v.has(iso) ? tone(q, v.get(iso)) : null, icon: icons?.get(iso) };
  const months = monthsOf(data.days);
  const cols = Math.min(3, months.length), gap = 50;
  const w = Math.min(cols === 1 ? 620 : 9999, (SPAN - gap * (cols - 1)) / cols);
  for (let i = 0; i < months.length; i += cols) {
    p.room((w / 7) * 7.6 + 20);
    let h = 0;
    months.slice(i, i + cols).forEach((ym, j) => { h = Math.max(h, drawMonth(p.g, M + j * (w + gap), p.y, w, ym, mark)); });
    p.y += h + 30;
  }
};
const weeksChart = (p: Pages, data: Data, q: Tracker) => {
  const v = data.vals.get(q.id) ?? new Map(), color = tone(q, true);
  const weeks: { from: string; yes: number; ans: number }[] = [];
  for (let i = 0; i < data.days.length; i += 7) { const w = data.days.slice(i, i + 7); weeks.push({ from: w[0], yes: w.filter((d) => v.get(d) === true).length, ans: w.filter((d) => v.has(d)).length }); }
  p.room(270);
  const g = p.g, col = SPAN / weeks.length, bw = Math.min(100, col - 14), h0 = 170;
  weeks.forEach((w, i) => {
    const x = M + i * col + (col - bw) / 2, h = (w.yes / 7) * h0;
    g.fillStyle = NONE; g.beginPath(); g.roundRect(x, p.y, bw, h0, 12); g.fill();
    if (h > 0) { g.fillStyle = color; g.beginPath(); g.roundRect(x, p.y + h0 - h, bw, h, 12); g.fill(); }
    g.font = `800 25px ${FONT}`; g.fillStyle = w.ans ? INK : SOFT; g.textAlign = "center"; g.fillText(w.ans ? String(w.yes) : "–", x + bw / 2, p.y + h0 - h - 12);
    g.font = `500 ${weeks.length > 9 ? 17 : 20}px ${FONT}`; g.fillStyle = SOFT; g.fillText(fmt(w.from), x + bw / 2, p.y + h0 + 30); g.textAlign = "left";
  });
  p.y += h0 + 74;
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
    p.g.font = `500 24px ${FONT}`;
    const lines = wrap(p.g, nt.text.trim().replace(/\s+/g, " "), SPAN - 170);
    p.room(Math.min(lines.length, 8) * 34 + 24);
    p.text(fmt(nt.date), 23, 700, SOFT);
    lines.slice(0, 8).forEach((l, i) => { p.text(l, 24, 500, INK, M + 160); if (i < Math.min(lines.length, 8) - 1) p.y += 34; });
    p.y += 46;
  }
};

// --- the tops of the first page ------------------------------------------------------
/** For a specialist: our name and icon, who it's for, whose, when. */
const proTop = async (p: Pages, r: ReportInput, data: Data) => {
  const t = i18n.t.bind(i18n), g = p.g;
  const icon = await load(memapIcon);
  if (icon) { g.save(); g.beginPath(); g.roundRect(M, p.y - 8, 64, 64, 15); g.clip(); g.drawImage(icon, M, p.y - 8, 64, 64); g.restore(); }
  p.y += 38; p.text("MeMap", 36, 800, INK, M + 80);
  p.text(t("report.pro.kicker"), 21, 700, SOFT, PX.w - M, "right");
  p.y += 100; p.text(t(`report.pro.title.${r.audience === "me" ? "doctor" : r.audience}`), 50, 800, INK);
  if (r.name?.trim()) { p.y += 52; p.text(t("report.pro.name", { name: r.name.trim() }), 28, 700, INK); }
  p.y += 48; p.text(t("report.pro.period", { from: fmt(data.first, true), to: fmt(data.last, true), count: r.days }), 26, 600, SOFT);
  p.y += 38; p.text(t("report.pro.answered", { k: data.answeredDays, count: r.days, date: fmt(isoLocal(new Date()), true) }), 23, 500, SOFT);
};
/** For herself: her islands on her sea, the counts. Returns nothing; leaves y under it. */
const meTop = async (p: Pages, r: ReportInput, data: Data, bandH: number) => {
  const t = i18n.t.bind(i18n), g = p.g;
  const evenings = islandEvenings(r.trackers, r.entries);
  const isles = [...new Set(data.qs.map((q) => islandOf(q)))].sort((a, b) => (evenings.get(b) ?? 0) - (evenings.get(a) ?? 0));
  const sea = await load(planetDay);
  if (sea) {
    const k = Math.max(PX.w / sea.width, bandH / sea.height) * 2.2;
    g.save(); g.beginPath(); g.rect(0, 0, PX.w, bandH); g.clip();
    g.drawImage(sea, (PX.w - sea.width * k) / 2, (bandH - sea.height * k) / 2, sea.width * k, sea.height * k);
    g.restore();
  }
  const fade = g.createLinearGradient(0, bandH - 170, 0, bandH); fade.addColorStop(0, "rgba(255,255,255,0)"); fade.addColorStop(1, "#fff");
  g.fillStyle = fade; g.fillRect(0, bandH - 170, PX.w, 172);
  const s = bandH / 720;
  p.y = 140 * Math.max(0.8, s); p.text(t("report.me.title"), 66, 800, INK, PX.w / 2, "center");
  p.y += 56; p.text(`${fmt(data.first)} – ${fmt(data.last)}`, 30, 600, SOFT, PX.w / 2, "center");
  const spots = [{ x: 620, y: 500, s: 440 }, { x: 240, y: 390, s: 250 }, { x: 1000, y: 390, s: 250 }, { x: 205, y: 610, s: 210 }, { x: 1035, y: 610, s: 210 }]
    .map((sp) => ({ x: sp.x, y: 180 + (sp.y - 180) * s, s: sp.s * Math.max(0.72, s) }));
  for (let i = Math.min(isles.length, spots.length) - 1; i >= 0; i--) {
    const id = isles[i], sp = spots[i], name = artOf(id, evenings.get(id) ?? 0);
    const im = await load(art(name, false)); if (!im) continue;
    const w = sp.s, h = w * (ASPECT[name] ?? im.height / im.width);
    g.save(); g.shadowColor = "rgba(20,50,100,.25)"; g.shadowBlur = 24; g.shadowOffsetY = 12;
    g.drawImage(im, sp.x - w / 2, sp.y - h * 0.7, w, h); g.restore();
    const label = islandName(t, id); g.font = `700 ${i === 0 ? 28 : 23}px ${FONT}`;
    const lw = g.measureText(label).width + 30, lh = i === 0 ? 46 : 40, ly = sp.y + h * 0.36 + 24;
    g.fillStyle = "rgba(255,255,255,.94)"; g.beginPath(); g.roundRect(sp.x - lw / 2, ly - lh / 2, lw, lh, lh / 2); g.fill();
    g.fillStyle = INK; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(label, sp.x, ly + 1); g.textBaseline = "alphabetic"; g.textAlign = "left";
  }
  p.y = bandH + 26;
  const kept = keptTreasures();
  const earned = Object.values(kept).filter((d) => !!d && d >= data.first && d <= data.last).length;
  const stats = [t("share.evenings", { count: data.answeredDays }), t("share.links", { count: data.pairs.length }), t("report.me.treasures", { count: earned })];
  g.font = `700 30px ${FONT}`;
  const ws = stats.map((x) => g.measureText(x).width + 50); let sx = (PX.w - ws.reduce((a, b) => a + b, 0) - 20 * (ws.length - 1)) / 2;
  stats.forEach((x, i) => { g.fillStyle = "#f3f4f7"; g.beginPath(); g.roundRect(sx, p.y - 40, ws[i], 58, 29); g.fill(); g.fillStyle = INK; g.textAlign = "center"; g.fillText(x, sx + ws[i] / 2, p.y - 1); g.textAlign = "left"; sx += ws[i] + 20; });
  p.y += 30;
  return { evenings, isles, kept };
};

// --- short: one page, a "справка" ----------------------------------------------------
const drawShort = async (r: ReportInput, data: Data): Promise<HTMLCanvasElement[]> => {
  const t = i18n.t.bind(i18n), me = r.audience === "me";
  const p = new Pages();
  if (me) await meTop(p, r, data, 560); else await proTop(p, r, data);
  const LINKS = Math.min(3, data.pairs.length);
  // the links' real height: label, each link's lines, the honest line
  p.g.font = `600 23px ${FONT}`;
  const linksH = 64 + 46 + (LINKS ? data.pairs.slice(0, LINKS).reduce((h, c) => h + (wrap(p.g, linkLine(c, !me).text, SPAN - 40).length - 1) * 33 + 42, 0) + 50 : 40) + 10;
  // the main questions, as many as fit with room for the links
  p.y += 64; p.label(t(data.mains.length > 1 ? "report.mainsLabel" : "report.mainLabel"));
  p.y += 44; toneLegend(p, data.qs);
  let shown = 0;
  for (const q of data.mains) { if (p.y + 210 + linksH > BOTTOM) break; mainBlock(p, data, q, false); shown++; }
  // the other questions, one row each, as many as fit
  const rest = [...data.mains.slice(shown), ...data.others];
  if (rest.length) {
    const avail = BOTTOM - linksH - (p.y + 74);
    let n = Math.floor(avail / 44);
    if (n < rest.length) n = Math.floor((avail - 44) / 44);
    n = Math.max(0, Math.min(n, rest.length));
    { p.y += 70; p.label(t("report.others")); p.text(t("report.pro.colN"), 18, 700, SOFT, M + SPAN, "right"); p.y += 4; }
    rest.slice(0, n).forEach((q) => rowLine(p, data, q));
    if (rest.length > n) { p.y += 44; p.text(t("report.more", { count: rest.length - n }), 21, 600, SOFT); }
  }
  // what came together, the strongest few
  p.y += 64; p.label(t("report.together")); p.y += 46;
  const keep = p.pages.length;
  linksList(p, { ...data, pairs: data.pairs.slice(0, LINKS) }, LINKS, !me);
  // one page, always: anything that spilled over is dropped
  p.pages.length = keep;
  footers(p, t(me ? "report.me.footer" : "report.pro.footer"));
  return p.pages;
};

// --- full: everything ---------------------------------------------------------------
const drawFull = async (r: ReportInput, data: Data): Promise<HTMLCanvasElement[]> => {
  const t = i18n.t.bind(i18n), me = r.audience === "me", g = () => p.g;
  const p = new Pages();
  let kept: Record<string, string | undefined> = {};
  let evenings = new Map<IslandId, number>(), isles: IslandId[] = [];
  if (me) ({ evenings, isles, kept } = await meTop(p, r, data, 720)); else await proTop(p, r, data);

  // the main questions in a few lines each
  p.y += 64; p.label(t(data.mains.length > 1 ? "report.mainsLabel" : "report.mainLabel"));
  p.y += 44; toneLegend(p, data.qs);
  for (const q of data.mains) mainBlock(p, data, q);

  // each main question: its calendar and its weeks (treasures on the first one, in hers)
  const icons = new Map<string, HTMLImageElement | null>();
  if (me) for (const it of ITEMS) { const d = kept[it.id]; if (d && d >= data.first && d <= data.last && !icons.has(d)) icons.set(d, await load(mapPicFor(it.pic, false))); }
  for (const [i, q] of data.mains.entries()) {
    p.heading(me && i === 0 && r.daysLabel && q.id === r.mainIds[0] ? r.daysLabel : t("report.pro.calendar", { q: title(q) }), 360);
    answerLegend(p, q); p.y += 34;
    drawCalendar(p, data, q, me && i === 0 ? icons : undefined);
    if (me && i === 0 && icons.size) { p.room(40); p.text(t("report.me.treasureDays"), 21, 500, SOFT); p.y += 10; }
    p.heading(t("report.weeks", { q: title(q) }), 300); weeksChart(p, data, q);
  }

  // her islands (hers only)
  if (me) {
    p.heading(t("report.me.islands"), 220);
    const cw = (SPAN - 30) / 2;
    for (let i = 0; i < isles.length; i += 2) {
      p.room(210);
      for (let j = 0; j < 2 && i + j < isles.length; j++) {
        const id = isles[i + j], x = M + j * (cw + 30), top = p.y;
        const n = evenings.get(id) ?? 0, name = artOf(id, n);
        g().fillStyle = "#f3f4f7"; g().beginPath(); g().roundRect(x, top, cw, 180, 24); g().fill();
        const im = await load(art(name, false));
        if (im) { const w = 170, h = w * (ASPECT[name] ?? im.height / im.width); g().drawImage(im, x + 18, top + 90 - h / 2, w, h); }
        const qsHere = data.qs.filter((q) => islandOf(q) === id);
        const ansD = data.days.filter((d) => qsHere.some((q) => data.vals.get(q.id)?.has(d)));
        const calm = ansD.filter((d) => !qsHere.some((q) => { const val = data.vals.get(q.id)?.get(d); return val !== undefined && isHardAnswer(q, val); })).length;
        g().font = `800 28px ${FONT}`; g().fillStyle = INK; g().fillText(fit(g(), islandName(t, id), cw - 220), x + 206, top + 64);
        g().font = `600 21px ${FONT}`; g().fillStyle = SOFT;
        g().fillText(fit(g(), `${t(`path.stage${stageOf(n)}`)} · ${t("report.me.evenings", { count: n })}`, cw - 220), x + 206, top + 100);
        g().fillText(fit(g(), t("report.me.calmDays", { k: calm, count: ansD.length }), cw - 220), x + 206, top + 132);
      }
      p.y += 210;
    }
  }

  // every question: how often, and every date of "yes", island by island
  p.heading(t("report.pro.all"), 130);
  const cQ = M, cN = M + SPAN * 0.44, cD = M + SPAN * 0.6;
  p.text(t("report.pro.colQ"), 18, 700, SOFT, cQ); p.text(t("report.pro.colN"), 18, 700, SOFT, cN); p.text(t("report.pro.colD"), 18, 700, SOFT, cD);
  let isle: IslandId | null = null;
  for (const q of data.qs) {
    if (islandOf(q) !== isle) { isle = islandOf(q); p.room(130); p.y += 58; p.text(islandName(t, isle), 24, 800, INK); p.y += 2; }
    const v = data.vals.get(q.id) ?? new Map();
    const yesD = data.days.filter((d) => v.get(d) === true), ans = data.days.filter((d) => v.has(d)).length;
    const byM = new Map<string, number[]>();
    yesD.forEach((d) => { const k = date(d).toLocaleDateString(locale(), { month: "short" }).replace(".", ""); byM.set(k, [...(byM.get(k) ?? []), date(d).getDate()]); });
    const dates = [...byM].map(([mo, ds]) => `${mo}: ${ds.join(", ")}`).join("  ·  ");
    g().font = `500 20px ${FONT}`;
    const dl = dates ? wrap(g(), dates, PX.w - M - cD) : [];
    const extra = Math.max(0, dl.length - 1) * 27;
    p.room(60 + extra);
    g().fillStyle = LINE; g().fillRect(M, p.y + 6, SPAN, 1.5);
    p.y += 44;
    g().font = `700 22px ${FONT}`;
    const fill = tone(q, true); g().fillStyle = fill; g().beginPath(); g().arc(M + 8, p.y - 8, 7, 0, Math.PI * 2); g().fill();
    p.text(fit(g(), title(q), cN - cQ - 46), 22, 700, INK, cQ + 26);
    p.text(`${yesD.length} / ${ans}`, 22, 700, INK, cN);
    const y0 = p.y;
    dl.forEach((l, i) => { p.y = y0 + i * 27; p.text(l, 20, 500, SOFT, cD); });
    p.y = y0 + extra + 6;
  }

  // the days as dots, island by island, dates under each island
  p.heading(t("report.days"), 170);
  toneLegend(p, data.qs); p.y += 20;
  isle = null;
  const byIsle = new Map<IslandId, Tracker[]>(); for (const q of data.qs) byIsle.set(islandOf(q), [...(byIsle.get(islandOf(q)) ?? []), q]);
  for (const [id, qs] of byIsle) {
    p.room(110 + 64 * Math.min(qs.length, 3)); p.y += 48; p.text(islandName(t, id), 24, 800, INK);
    qs.forEach((q, qi) => {
      const before = p.pages.length; p.room(64 + (qi === qs.length - 1 ? 40 : 0));
      if (p.pages.length !== before) { p.y += 10; }
      p.y += 38; g().font = `600 20px ${FONT}`; p.text(fit(g(), title(q), SPAN), 20, 600, INK);
      p.y += 24; strip(p, data, q, M, SPAN, 10);
    });
    p.y += 38; ticks(p, data); p.y += 4;
  }

  // what tended to come together: every link between the questions in it
  p.heading(t("report.together"), 90);
  if (me) {
    const all = data.pairs.slice(0, 12);
    if (all.length === 0) { p.room(60); p.text(t("report.togetherNone"), 23, 600, SOFT); p.y += 20; }
    for (const c of all) {
      const L = linkLine(c, false);
      g().font = `600 23px ${FONT}`;
      const lines = wrap(g(), L.text, SPAN - 150);
      p.room(Math.max(96, lines.length * 33 + 34));
      const top = p.y - 32;
      for (const [k, tr] of [[0, L.a], [1, L.b]] as const) {
        const id = islandOf(tr), im = await load(art(artOf(id, evenings.get(id) ?? 0), false));
        if (im) g().drawImage(im, M + k * 50, top + (k ? 22 : 0), 72, 72 * (im.height / im.width));
      }
      const y0 = p.y;
      lines.forEach((l, i) => { p.y = y0 + i * 33; p.text(l, 23, 600, INK, M + 140); });
      p.y = Math.max(y0 + (lines.length - 1) * 33 + 46, y0 + 70);
    }
    p.room(50); p.text(t("link.honest"), 20, 500, SOFT); p.y += 10;
  } else linksList(p, data, 12, true);
  notesSection(p, r, data);
  footers(p, t(me ? "report.me.footer" : "report.pro.footer"));
  return p.pages;
};

/** The pages as JPEG data URLs (A4, 150 dpi). */
export const drawReport = async (r: ReportInput): Promise<string[]> => {
  try { await document.fonts?.load(`700 40px 'MeMap Sans'`); await document.fonts?.load(`800 40px 'MeMap Sans'`); } catch { /* system font */ }
  const data = collect(r);
  const pages = r.kind === "short" ? await drawShort(r, data) : await drawFull(r, data);
  return pages.map((c) => c.toDataURL("image/jpeg", 0.9));
};
