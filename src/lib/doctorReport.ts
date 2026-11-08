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
import { linkOther, linkSentence } from "@/lib/linkText";
import { answerPhrase } from "@/lib/answerPhrases";
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
  /** no longer used (Nov 8 2026: no main questions in the report) */
  mainIds?: string[];
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
// a 2-week test's own question isn't one of her questions for a doctor (QA, Nov 8 2026)
const reportable = (x: Tracker) => !x.archived && x.source !== "play" && x.answerType === "boolean" && !x.id.endsWith("-test");
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
  qs: Tracker[];
  vals: Map<string, Map<string, unknown>>;
  answeredDays: number;
  pairs: CorrelationResult[];
}
const collect = (r: ReportInput): Data => {
  // the period starts at her first answer when that's later (QA: "Answered on 59 of 91 days" for 59 days of answers)
  const all = dayList(r.days);
  const firstAnswer = r.entries.filter((e) => r.ids.includes(e.trackerId) && e.date >= all[0]).reduce<string | null>((m, e) => (m === null || e.date < m ? e.date : m), null);
  const days = firstAnswer ? all.filter((d) => d >= firstAnswer) : all, first = days[0], last = days[days.length - 1];
  const inPeriod = r.entries.filter((e) => e.date >= first && e.date <= last);
  const vals = new Map<string, Map<string, unknown>>();
  for (const e of inPeriod) { if (!vals.has(e.trackerId)) vals.set(e.trackerId, new Map()); vals.get(e.trackerId)!.set(e.date, e.value); }
  const ids = new Set(r.ids);
  const groups = reportQuestions(r.trackers, r.entries, r.days, r.audience);
  const qs = groups.flatMap((gr) => gr.qs.map((x) => x.q)).filter((q) => ids.has(q.id));
  const answeredDays = new Set(inPeriod.filter((e) => ids.has(e.trackerId)).map((e) => e.date)).size;
  // links only between the questions that go in
  const pairs = computeCorrelations(qs, inPeriod.filter((e) => ids.has(e.trackerId)), 6).filter(linkWorthShowing);
  return { days, first, last, qs, vals, answeredDays, pairs };
};
const linkLine = (c: CorrelationResult, pro: boolean) => {
  const l = linkOf(c);
  const route = { ...l, a: "other" as const, b: "other" as const, first: l.first.id, second: l.second.id };
  const of = (id: string) => (id === l.first.id ? l.first : l.second);
  // whole sentences for everyone (QA: "Feeling drained → short night" read as a puzzle)
  void pro;
  return { a: l.first, b: l.second, text: `${linkSentence(i18n.t, route, of)} ${linkOther(i18n.t, route)}` };
};
/** How often, in words. Too few answered days: nothing (a week is the least to say "a week"). */
const freqOf = (k: number, n: number): string => {
  if (n < 7) return "";
  const t = i18n.t.bind(i18n);
  if (k === 0) return t("report.freq.never");
  const r = k / n;
  return t(`report.freq.${r >= 0.8 ? "almostDaily" : r >= 0.6 ? "mostDays" : r >= 0.4 ? "everySecond" : r >= 0.25 ? "twiceWeek" : r >= 0.12 ? "onceWeek" : r >= 0.05 ? "fewMonth" : "rarely"}`);
};
/** One question in the period: its answers, "yes" days, hard days. */
const countsOf = (data: Data, q: Tracker) => {
  const v = data.vals.get(q.id) ?? new Map<string, unknown>();
  const ans = data.days.filter((d) => v.has(d));
  return { v, ans, yes: ans.filter((d) => v.get(d) === true).length, hard: neutralQ(q) ? 0 : ans.filter((d) => isHardAnswer(q, v.get(d))).length };
};
const capFirst = (x: string) => x.charAt(0).toLocaleUpperCase() + x.slice(1);
/** "In short": what the numbers say, in plain sentences — the most frequent hard things, whether they
 *  came more or less often later, the longest stretch without the first one, and something good. */
const findings = (data: Data, max: number): string[] => {
  const t = i18n.t.bind(i18n), out: string[] = [];
  const rows = data.qs.filter((q) => !neutralQ(q)).map((q) => ({ q, ...countsOf(data, q) }));
  // what hurt or bothered first (a doctor reads symptoms first), then the good things that were missing
  const byHard = (x: typeof rows[number], y: typeof rows[number]) => y.hard - x.hard || y.hard / y.ans.length - x.hard / x.ans.length;
  const bad = rows.filter((r) => r.hard > 0 && r.q.problemWhen === "yes").sort(byHard);
  const missed = rows.filter((r) => r.hard > 0 && r.q.problemWhen !== "yes").sort(byHard);
  const tops = [...bad, ...missed].slice(0, 3);
  if (!tops.length && rows.length) out.push(t("report.find.none"));
  const whatOf = (r: typeof rows[number]) => answerPhrase(t, r.q, r.q.problemWhen === "yes");
  for (const r of tops) {
    const freq = freqOf(r.hard, r.ans.length);
    out.push(t(freq ? "report.find.top" : "report.find.topShort", { what: capFirst(whatOf(r)), k: r.hard, count: r.ans.length, freq }));
  }
  // the longest stretch without the first one, and something good
  const top = tops[0];
  if (top) {
    let run = 0, best = 0;
    for (const d of top.ans) { if (isHardAnswer(top.q, top.v.get(d))) run = 0; else { run++; best = Math.max(best, run); } }
    if (best >= 5) out.push(t("report.find.calm", { what: whatOf(top), count: best }));
  }
  const goods = rows.filter((r) => r.q.problemWhen === "no" && r.yes >= 3 && r.yes / r.ans.length >= 0.5).sort((x, y) => y.yes / y.ans.length - x.yes / x.ans.length);
  if (goods[0]) out.push(t("report.find.good", { what: answerPhrase(t, goods[0].q, true), k: goods[0].yes, count: goods[0].ans.length }));
  // more or less often in the second half, for what hurt or bothered
  for (const r of bad.slice(0, 3)) {
    const half = Math.floor(r.ans.length / 2);
    const h1 = r.ans.slice(0, half).filter((d) => isHardAnswer(r.q, r.v.get(d))).length;
    const h2 = r.ans.slice(half).filter((d) => isHardAnswer(r.q, r.v.get(d))).length;
    if (r.ans.length >= 10 && Math.abs(h1 - h2) >= 2) out.push(t(h2 < h1 ? "report.find.less" : "report.find.more", { what: capFirst(whatOf(r)), h1, h2 }));
  }
  return out.slice(0, max);
};
const findingsBlock = (p: Pages, data: Data, max: number) => {
  const list = findings(data, max);
  if (!list.length) return;
  const g = p.g;
  p.y += 64; p.label(i18n.t("report.inShort")); p.y += 4;
  for (const line of list) {
    g.font = `600 25px ${FONT}`;
    const lines = wrap(g, line, SPAN - 34);
    p.room(lines.length * 35 + 16); p.y += 44;
    const pg = p.g; pg.fillStyle = INK; pg.beginPath(); pg.arc(M + 7, p.y - 9, 5, 0, Math.PI * 2); pg.fill();
    lines.forEach((l, i) => { if (i) p.y += 35; p.text(l, 25, 600, INK, M + 28); });
  }
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
/** "Statistics": a question in one row — its colour, its name, "yes" of answered days, how often in words;
 *  in the full report the dates of "yes" under it. */
const COL_N = M + SPAN * 0.5, COL_F = M + SPAN * 0.69;
const statsHeader = (p: Pages) => {
  const t = i18n.t.bind(i18n);
  p.y += 40; p.text(t("report.pro.colQ"), 18, 700, SOFT, M); p.text(t("report.pro.colN"), 18, 700, SOFT, COL_N); p.text(t("report.colHow"), 18, 700, SOFT, COL_F);
};
const statRow = (p: Pages, data: Data, q: Tracker, withDates: boolean) => {
  const g = p.g, c = countsOf(data, q);
  let dl: string[] = [];
  if (withDates && c.yes) {
    const byM = new Map<string, number[]>();
    c.ans.filter((d) => c.v.get(d) === true).forEach((d) => { const k = date(d).toLocaleDateString(locale(), { month: "short" }).replace(".", ""); byM.set(k, [...(byM.get(k) ?? []), date(d).getDate()]); });
    g.font = `500 19px ${FONT}`;
    dl = wrap(g, `${i18n.t("report.yesOn")} ${[...byM].map(([mo, ds]) => `${mo} ${ds.join(", ")}`).join("; ")}`, SPAN - 26);
  }
  p.room(50 + dl.length * 27);
  const pg = p.g;
  pg.fillStyle = LINE; pg.fillRect(M, p.y + 10, SPAN, 1.5);
  p.y += 44;
  pg.fillStyle = tone(q, true); pg.beginPath(); pg.arc(M + 8, p.y - 8, 7, 0, Math.PI * 2); pg.fill();
  pg.font = `700 22px ${FONT}`; p.text(fit(pg, title(q), COL_N - M - 46), 22, 700, INK, M + 26);
  p.text(`${c.yes} / ${c.ans.length}`, 22, 700, INK, COL_N);
  pg.font = `600 21px ${FONT}`; p.text(fit(pg, freqOf(c.yes, c.ans.length), M + SPAN - COL_F), 21, 600, SOFT, COL_F);
  dl.forEach((l) => { p.y += 27; p.text(l, 19, 500, SOFT, M + 26); });
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
  p.y += 48; p.text(t("report.pro.period", { from: fmt(data.first, true), to: fmt(data.last, true), count: data.days.length }), 26, 600, SOFT);
  p.y += 38; p.text(t("report.pro.answered", { k: data.answeredDays, count: data.days.length, date: fmt(isoLocal(new Date()), true) }), 23, 500, SOFT);
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
  // what the numbers say, in plain words; then every question, as many as fit
  findingsBlock(p, data, 5);
  // one page has room for a few: the ones with the most hard days first
  const rest = [...data.qs].sort((x, y) => countsOf(data, y).hard - countsOf(data, x).hard);
  if (rest.length) {
    p.y += 70; p.label(t("report.stats")); p.y += 40; toneLegend(p, data.qs); statsHeader(p);
    const avail = BOTTOM - linksH - p.y;
    let n = Math.floor(avail / 44);
    if (n < rest.length) n = Math.floor((avail - 44) / 44);
    n = Math.max(0, Math.min(n, rest.length));
    rest.slice(0, n).forEach((q) => statRow(p, data, q, false));
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
  let evenings = new Map<IslandId, number>(), isles: IslandId[] = [];
  if (me) ({ evenings, isles } = await meTop(p, r, data, 720)); else await proTop(p, r, data);

  // what the numbers say, in plain words
  findingsBlock(p, data, 7);
  // every question, island by island: how many days, how often, the dates of "yes"
  p.heading(t("report.stats"), 130);
  toneLegend(p, data.qs); statsHeader(p);
  let isle: IslandId | null = null;
  for (const q of data.qs) {
    if (islandOf(q) !== isle) { isle = islandOf(q); p.room(130); p.y += 58; p.text(islandName(t, isle), 24, 800, INK); p.y += 2; }
    statRow(p, data, q, true);
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
