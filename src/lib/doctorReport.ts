// A report to take to a doctor, a therapist or a coach (her idea, Nov 6 2026: "ты
// выгружаешь — отмечаешь, для кого или темы — и идёт выгрузка красивая, но понятная и
// полезная"). A4 pages drawn on a canvas: the days of each chosen question as dots
// (dark = yes, light = no, grey = not answered), a week-by-week count for her main
// question, what tended to come together (her own links), and her notes if she adds
// them. Plain words, nothing the reader has to learn.
import i18n from "@/lib/i18n";
import type { Tracker, TrackerEntry } from "@/types/tracker";
import type { Note } from "@/lib/notes";
import { islandOf, type IslandId } from "@/lib/islands";
import { computeCorrelations } from "@/lib/correlations";
import { localizeTrackerTitle } from "@/lib/trackerLocalize";
import { isoLocal } from "@/lib/doors";

export type Audience = "doctor" | "therapist" | "coach" | "me";
/** Topics ticked first for each reader (she can change them). */
export const AUDIENCE_TOPICS: Record<Audience, IslandId[] | "all"> = {
  doctor: ["health", "body", "me"],
  therapist: ["me", "love", "kids", "parents", "work", "health"],
  coach: ["work", "body", "health", "me"],
  me: "all",
};

export interface ReportInput {
  trackers: Tracker[];
  entries: TrackerEntry[];
  notes: Note[];
  audience: Audience;
  islands: IslandId[];
  days: number;
  withNotes: boolean;
  /** her main question (the topic she chose), shown first and counted by week */
  mainId?: string;
}

const PX = { w: 1240, h: 1754 };
const M = 92;
const FONT = "'MeMap Sans', Manrope, system-ui, sans-serif";
const INK = "#2f3448", SOFT = "#6a7088", LINE = "rgba(47,52,72,.12)";
const YES = "#5b63d6", NO = "#c9cdf3", NONE = "#e6e8ef", TEAL = "#2f9c90";

const dayList = (n: number): string[] => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (n - 1 - i)); return isoLocal(d); });
const fmt = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString(i18n.language?.startsWith("ru") ? "ru-RU" : "en-GB", { day: "numeric", month: "short" });

const wrap = (g: CanvasRenderingContext2D, text: string, max: number): string[] => {
  const out: string[] = []; let line = "";
  for (const w of text.split(/\s+/)) {
    const tryL = line ? `${line} ${w}` : w;
    if (g.measureText(tryL).width > max && line) { out.push(line); line = w; } else line = tryL;
  }
  if (line) out.push(line);
  return out;
};

/** The pages as JPEG data URLs (A4, 150 dpi). */
export const drawReport = async (r: ReportInput): Promise<string[]> => {
  const t = i18n.t.bind(i18n);
  try { await document.fonts?.load(`700 40px 'MeMap Sans'`); } catch { /* system font */ }
  const days = dayList(r.days), first = days[0], last = days[days.length - 1];
  const inPeriod = r.entries.filter((e) => e.date >= first && e.date <= last);
  const qs = r.trackers
    .filter((x) => !x.archived && x.source !== "play" && x.answerType === "boolean" && r.islands.includes(islandOf(x)))
    .sort((a, b) => (a.id === r.mainId ? -1 : b.id === r.mainId ? 1 : (a.sortIndex ?? 0) - (b.sortIndex ?? 0)));
  const byDay = new Map<string, Map<string, unknown>>();
  for (const e of inPeriod) { if (!byDay.has(e.trackerId)) byDay.set(e.trackerId, new Map()); byDay.get(e.trackerId)!.set(e.date, e.value); }
  const answeredDays = new Set(inPeriod.filter((e) => qs.some((q) => q.id === e.trackerId)).map((e) => e.date)).size;

  const pages: HTMLCanvasElement[] = [];
  let g!: CanvasRenderingContext2D, y = 0;
  const newPage = () => {
    const c = document.createElement("canvas"); c.width = PX.w; c.height = PX.h;
    g = c.getContext("2d")!; g.fillStyle = "#fff"; g.fillRect(0, 0, PX.w, PX.h);
    g.textBaseline = "alphabetic"; g.textAlign = "left";
    pages.push(c); y = M;
  };
  const room = (h: number) => { if (y + h > PX.h - M - 50) newPage(); };
  const text = (s: string, size: number, weight: number, color: string, x = M) => { g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = color; g.fillText(s, x, y); };
  // a heading never stays alone at the bottom of a page: it takes room for what follows
  const heading = (s: string, next = 60) => { room(110 + next); y += 54; text(s, 34, 800, INK); y += 18; g.fillStyle = LINE; g.fillRect(M, y, PX.w - 2 * M, 2); y += 34; };

  newPage();
  // the header
  y += 40; text(t(`report.for.${r.audience}`), 54, 800, INK);
  y += 52; text(`${fmt(first)} – ${fmt(last)} · ${t("report.daysAnswered", { k: answeredDays, count: r.days })}`, 28, 600, SOFT);
  y += 40; text(t("report.made", { date: fmt(isoLocal(new Date())) }), 24, 500, SOFT);

  // the legend
  y += 54;
  const legend: [string, string][] = [[YES, t("report.yes")], [NO, t("report.no")], [NONE, t("report.none")]];
  let lx = M;
  for (const [c, l] of legend) { g.fillStyle = c; g.beginPath(); g.arc(lx + 11, y - 9, 11, 0, Math.PI * 2); g.fill(); text(l, 24, 600, SOFT, lx + 30); g.font = `600 24px ${FONT}`; lx += 30 + g.measureText(l).width + 40; }

  // 1. the days of each question
  heading(t("report.days"));
  const span = PX.w - 2 * M, step = span / days.length, rr = Math.max(3.5, Math.min(12, step * 0.36));
  for (const q of qs) {
    const vals = byDay.get(q.id) ?? new Map();
    const yes = days.filter((d) => vals.get(d) === true).length, ans = days.filter((d) => vals.has(d)).length;
    room(110);
    g.font = `700 28px ${FONT}`;
    const title = localizeTrackerTitle(q.title);
    const right = t("report.yesOf", { k: yes, count: ans });
    g.font = `600 26px ${FONT}`; const rw = g.measureText(right).width;
    g.font = `700 28px ${FONT}`;
    let shown = title; while (g.measureText(shown).width > span - rw - 30 && shown.length > 4) shown = shown.slice(0, -2);
    if (shown !== title) shown = shown.trimEnd() + "…";
    text(shown, 28, q.id === r.mainId ? 800 : 700, INK);
    text(right, 26, 600, SOFT, PX.w - M - rw);
    y += 30;
    days.forEach((d, i) => {
      const v = vals.get(d);
      g.fillStyle = v === true ? YES : v === false ? NO : NONE;
      g.beginPath(); g.arc(M + step * i + step / 2, y, rr, 0, Math.PI * 2); g.fill();
    });
    y += rr + 40;
  }
  // the days under the dots: first and last
  g.font = `500 22px ${FONT}`; g.fillStyle = SOFT;
  y += 4; g.fillText(fmt(first), M, y); const lw = g.measureText(fmt(last)).width; g.fillText(fmt(last), PX.w - M - lw, y);

  // 2. her main question, week by week
  const main = qs.find((q) => q.id === r.mainId) ?? qs[0];
  if (main) {
    heading(t("report.weeks", { q: localizeTrackerTitle(main.title) }), 300);
    const vals = byDay.get(main.id) ?? new Map();
    const weeks: { from: string; yes: number; ans: number }[] = [];
    for (let i = 0; i < days.length; i += 7) { const w = days.slice(i, i + 7); weeks.push({ from: w[0], yes: w.filter((d) => vals.get(d) === true).length, ans: w.filter((d) => vals.has(d)).length }); }
    room(260);
    const bw = Math.min(110, span / weeks.length - 14), h0 = 180, maxV = 7;
    weeks.forEach((w, i) => {
      const x = M + i * (span / weeks.length) + (span / weeks.length - bw) / 2;
      const h = (w.yes / maxV) * h0;
      g.fillStyle = NONE; g.beginPath(); g.roundRect(x, y, bw, h0, 10); g.fill();
      g.fillStyle = YES; g.beginPath(); g.roundRect(x, y + h0 - h, bw, Math.max(h, 0.01), 10); g.fill();
      g.font = `800 26px ${FONT}`; g.fillStyle = w.ans ? INK : SOFT; g.textAlign = "center"; g.fillText(w.ans ? String(w.yes) : "–", x + bw / 2, y + h0 - h - 12);
      g.font = `500 20px ${FONT}`; g.fillStyle = SOFT; g.fillText(fmt(w.from), x + bw / 2, y + h0 + 30); g.textAlign = "left";
    });
    y += h0 + 78;
    text(t("report.weeksNote"), 22, 500, SOFT);
  }

  // 3. what tended to come together
  const pairs = computeCorrelations(qs, inPeriod, 6).filter((c) => c.phi > 0).slice(0, 4);
  heading(t("report.together"), 90);
  if (pairs.length === 0) { room(60); text(t("report.togetherNone"), 26, 600, SOFT); y += 20; }
  for (const c of pairs) {
    const flip = c.lag === -1;
    const a = flip ? c.trackerB : c.trackerA, b = flip ? c.trackerA : c.trackerB;
    const n = c.counts.bothYes + (flip ? c.counts.aNoBYes : c.counts.aYesBNo);
    const s = t(c.lag !== 0 ? "link.afterNextDay" : "link.sameDay", { first: localizeTrackerTitle(a.title), second: localizeTrackerTitle(b.title), k: c.counts.bothYes, count: n });
    g.font = `600 26px ${FONT}`;
    const lines = wrap(g, s, span - 40);
    room(lines.length * 38 + 20);
    g.fillStyle = TEAL; g.beginPath(); g.arc(M + 9, y - 9, 7, 0, Math.PI * 2); g.fill();
    lines.forEach((l, i) => { text(l, 26, 600, INK, M + 32); if (i < lines.length - 1) y += 36; });
    y += 46;
  }
  room(50); text(t("link.honest"), 22, 500, SOFT); y += 10;

  // 4. her notes, if she adds them
  if (r.withNotes) {
    const ns = r.notes.filter((x) => x.date >= first && x.date <= last && x.text.trim()).sort((a, b) => a.date.localeCompare(b.date));
    if (ns.length) {
      heading(t("report.notes"), 80);
      for (const nt of ns) {
        g.font = `500 25px ${FONT}`;
        const lines = wrap(g, nt.text.trim().replace(/\s+/g, " "), span - 170);
        room(Math.min(lines.length, 8) * 34 + 24);
        text(fmt(nt.date), 24, 700, SOFT);
        lines.slice(0, 8).forEach((l, i) => { text(l, 25, 500, INK, M + 160); if (i < Math.min(lines.length, 8) - 1) y += 34; });
        y += 46;
      }
    }
  }

  // footers
  pages.forEach((c, i) => {
    const gg = c.getContext("2d")!;
    gg.font = `500 20px ${FONT}`; gg.fillStyle = SOFT; gg.textAlign = "left";
    gg.fillText(t("report.footer"), M, PX.h - M + 10);
    gg.textAlign = "right"; gg.fillText(`${i + 1} / ${pages.length}`, PX.w - M, PX.h - M + 10);
  });
  return pages.map((c) => c.toDataURL("image/jpeg", 0.9));
};
export const REPORT_PX = PX;
