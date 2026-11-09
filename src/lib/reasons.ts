// "Why?" reasons (her answer, Nov 9 2026: "чтоб они не усложняли само приложение, можно скипать, может
// отдельно шагом сделать? … сможешь добавить причину позже (только нормальным языком) — и чтоб это где-то
// ещё хранилось, как заметки"; a tester whose couple argues: "the plan says write down what starts the
// fights, but there is nowhere to write it").
// - In the evening deck a "yes" to a reason question gets one quiet line: "You can add why later." Nothing to tap.
// - On the path, a skippable "Why?" step (one of the day's extras) asks about the yes-answers of today and the
//   last 3 days at once: chips, a few words if wanted, Save or Skip. Skip never asks about that answer again.
// - The chips go into the answer's tags (TrackerEntry.tags), the words into a note on that day (so the day's
//   notes, the doctor's report and Notes have them); Notes lists them under "Reasons", to change any time;
//   the calendar day can change the chips too; the week report says the most common one.
// - Never on the partner-harm questions (HOME_HARM_IDS): asking "why" there would invite self-blame.
import type { TFunction } from "i18next";
import type { Tracker, TrackerEntry } from "@/types/tracker";
import { templateIdOf } from "./answerPhrases";
import { HOME_HARM_IDS } from "./supportLines";
import { getEntries, saveEntries } from "./storage";
import { addNote, deleteNote, getNotes, updateNote, type Note } from "./notes";

/** Fights: what couples say they argue about (her list). */
const FIGHT_REASONS = ["money", "chores", "kids", "phones", "timeTogether", "family", "tiredness", "other"];
/** Headaches and migraines: only what marketing/research/triggers-and-links-evidence.md §1 supports — the
 *  period (strong), stress (moderate), a skipped meal (weak–moderate) and sleep (broken or unrefreshing sleep,
 *  two short nights in a row; one short night alone had no link, so "Poor sleep", not "Short night").
 *  Left out: screens (nothing for headache), alcohol (mixed; app diaries show no effect, myth list #4),
 *  weather (pooled null, myth list #2; the measured weather planned after 2.0 tests it better than a guess).
 *  "Other" is there for anything else, with the words field. */
const HEAD_REASONS = ["poorSleep", "stress", "skippedMeal", "period", "other", "dontKnow"];
export const REASON_CHIPS: Record<string, string[]> = {
  "argued-with-partner": FIGHT_REASONS,
  headache: HEAD_REASONS,
  migraine: HEAD_REASONS,
};
const OWN_CHIPS = new Set(Object.values(REASON_CHIPS).flat());
/** Not a cause: never "most often". */
const NOT_A_CAUSE = new Set(["other", "dontKnow", "dontRemember"]);
/** The path asks about yes-answers from today and this many days back. */
export const REASON_DAYS = 3;
/** The week report says "most often" from this many answers with reasons. */
export const REASON_LINE_FROM = 3;

/** The question's template when it asks "why" (never a partner-harm one), else null. */
export const reasonTemplate = (tr?: Tracker | null): string | null => {
  if (!tr) return null;
  const id = templateIdOf(tr);
  if (!id || HOME_HARM_IDS.has(id) || !REASON_CHIPS[id]) return null;
  return id;
};
export const reasonChips = (tr?: Tracker | null): string[] => REASON_CHIPS[reasonTemplate(tr) ?? ""] ?? [];

/** A chip's words; a chip from the old door sheet keeps its own. */
export const reasonLabel = (t: TFunction, id: string): string => (OWN_CHIPS.has(id) ? t(`why.chip.${id}`) : t(`doors.reasons.${id}`));
/** "Fight" / «Ссора»: one answer. */
export const reasonName = (t: TFunction, tr?: Tracker | null): string => {
  const id = reasonTemplate(tr);
  return id ? t(`why.one.${id}`) : "";
};

export const reasonKey = (e: { trackerId: string; date: string }) => `${e.trackerId}|${e.date}`;

// --- Asked once ---------------------------------------------------------------------------------------------
// The answers the "Why?" step already asked about (saved, or skipped), with the day it happened.
const ASKED_KEY = "memap_reasons_asked";
type Asked = Record<string, { at: string; how: "saved" | "skipped"; path?: boolean }>;
const readAsked = (): Asked => {
  try { const v = JSON.parse(localStorage.getItem(ASKED_KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; }
};
/** `path`: it happened on the path's "Why?" step (a change from Notes or the calendar doesn't light the step). */
export const markAsked = (keys: string[], how: "saved" | "skipped", today: string, path = false) => {
  if (!keys.length) return;
  const all = readAsked();
  for (const k of keys) all[k] = { at: today, how, ...(path ? { path: true } : {}) };
  // the last few hundred are plenty (the step only looks 3 days back)
  const kept = Object.entries(all).sort(([, a], [, b]) => a.at.localeCompare(b.at)).slice(-300);
  try { localStorage.setItem(ASKED_KEY, JSON.stringify(Object.fromEntries(kept))); } catch { /* asked again, harmless */ }
};
/** What the path's step did today: "saved", "skipped", or null when it wasn't used today. */
export const askedToday = (today: string): "saved" | "skipped" | null => {
  const today_ = Object.values(readAsked()).filter((a) => a.at === today && a.path);
  if (!today_.length) return null;
  return today_.some((a) => a.how === "saved") ? "saved" : "skipped";
};

const addDays = (iso: string, n: number) => {
  const d = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const hasReasons = (e: TrackerEntry) => (e.tags?.length ?? 0) > 0;

// --- Resting ------------------------------------------------------------------------------------------------
/** Someone with near-daily headaches would get "Why?" most evenings (Nov 10 2026): after the step was skipped this
 *  many times in a row for a question, with no reason saved for it in between, the step stops asking about that
 *  question. A reason saved for it later (Notes, the calendar day) brings it back. Read from the asked records. */
export const SKIPS_TO_REST = 3;
const resting = (asked: Asked, trackerId: string): boolean => {
  // one event a day: a day with a save (anywhere) breaks the run; a skip on the path's step adds to it
  const days = new Map<string, "saved" | "skipped">();
  for (const [k, a] of Object.entries(asked)) {
    if (!k.startsWith(`${trackerId}|`)) continue;
    if (a.how === "saved") days.set(a.at, "saved");
    else if (a.path && !days.has(a.at)) days.set(a.at, "skipped");
  }
  let run = 0;
  for (const [, how] of [...days.entries()].sort(([a], [b]) => b.localeCompare(a))) {
    if (how === "saved") return false;
    if (++run >= SKIPS_TO_REST) return true;
  }
  return false;
};
/** The path's "Why?" step would ask about a "yes" to this question on this day: a reason question, the day within
 *  the step's look-back, the question not resting. The deck says "you can add the reason later" only then. */
export const reasonAskedLater = (tr: Tracker | null | undefined, date: string, today: string): boolean =>
  !!tr && tr.source !== "play" && !!reasonTemplate(tr) && date <= today && date >= addDays(today, -REASON_DAYS) && !resting(readAsked(), tr.id);

/** Yes-answers of today and the last REASON_DAYS days to a reason question, with no reasons yet and never
 *  asked about (and the question not resting): newest first. */
export const pendingReasons = (trackers: Tracker[], entries: TrackerEntry[], today: string): TrackerEntry[] => {
  const asked = readAsked();
  const from = addDays(today, -REASON_DAYS);
  const ok = new Set(trackers.filter((tr) => !tr.archived && tr.source !== "play" && reasonTemplate(tr) && !resting(asked, tr.id)).map((tr) => tr.id));
  return entries
    .filter((e) => e.value === true && ok.has(e.trackerId) && e.date >= from && e.date <= today && !hasReasons(e) && !asked[reasonKey(e)])
    .sort((a, b) => b.date.localeCompare(a.date) || a.trackerId.localeCompare(b.trackerId));
};

/** Every yes-answer with reasons (or a reason note), newest first: Notes' "Reasons". */
export const reasonEntries = (trackers: Tracker[], entries: TrackerEntry[], notes: Note[] = []): TrackerEntry[] => {
  const ok = new Set(trackers.filter((tr) => !tr.archived && reasonTemplate(tr)).map((tr) => tr.id));
  const withNote = new Set(notes.filter((n) => n.reasonFor).map((n) => n.reasonFor!));
  return entries
    .filter((e) => e.value === true && ok.has(e.trackerId) && (hasReasons(e) || withNote.has(reasonKey(e))))
    .sort((a, b) => b.date.localeCompare(a.date));
};

// --- Saving -------------------------------------------------------------------------------------------------

export interface ReasonInput {
  trackerId: string;
  date: string;
  tags: string[];
  /** the few words; undefined leaves the note as it is */
  text?: string;
}

/** The chips to show for an answer: the question's own, then any it already has from the old door sheet
 *  (so they can be taken off too). */
export const chipsFor = (tr: Tracker | null | undefined, tags: string[] = []): string[] => {
  const own = reasonChips(tr);
  return [...own, ...tags.filter((x) => !own.includes(x))];
};

/** Save the chips as the answers' tags (all of them: the sheet shows every chip the answer has) and the words
 *  into a note on that day, one note per answer (an empty text removes it). */
export const saveReasons = async (items: ReasonInput[]): Promise<void> => {
  if (!items.length) return;
  const all = await getEntries();
  let changed = false;
  const next = all.map((e) => {
    const it = items.find((x) => x.trackerId === e.trackerId && x.date === e.date);
    if (!it) return e;
    const tags = [...new Set(it.tags)];
    const same = tags.length === (e.tags?.length ?? 0) && tags.every((x) => e.tags?.includes(x));
    if (same) return e;
    changed = true;
    const rest: TrackerEntry = { ...e };
    delete rest.tags;
    return tags.length ? { ...rest, tags } : rest;
  });
  if (changed) await saveEntries(next);
  const withText = items.filter((x) => x.text !== undefined);
  if (!withText.length) return;
  const notes = await getNotes();
  for (const it of withText) {
    const key = reasonKey(it), text = (it.text ?? "").trim();
    const note = notes.find((n) => n.reasonFor === key);
    if (note && text && note.text !== text) await updateNote(note.id, { text });
    else if (!note && text) await addNote({ date: it.date, text, linkedPatternId: it.trackerId, reasonFor: key });
    else if (note && !text) await deleteNote(note.id);
  }
  try { window.dispatchEvent(new CustomEvent("memap-notes-changed")); } catch { /* no window */ }
};

// --- The week report ----------------------------------------------------------------------------------------

/** "Fights — most often: money (2 of 3)": per reason question with at least REASON_LINE_FROM answers with reasons
 *  up to the week's last day (all time: when the line shows), and one of them this week. The most common chip
 *  that is a cause among THIS week's answers with reasons, picked at least twice that week, and its count of
 *  them (Nov 10 2026: "(3 of 3)" counted earlier weeks too); a tie goes to the latest. */
export const reasonLines = (t: TFunction, trackers: Tracker[], entries: TrackerEntry[], weekDates: string[]): string[] => {
  if (!weekDates.length) return [];
  const last = weekDates[weekDates.length - 1];
  const inWeek = new Set(weekDates);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const tr of trackers) {
    const id = reasonTemplate(tr);
    if (!id || tr.archived || seen.has(id)) continue;
    seen.add(id);
    const all = entries.filter((e) => e.trackerId === tr.id && e.value === true && hasReasons(e) && e.date <= last);
    const mine = all.filter((e) => inWeek.has(e.date));
    if (all.length < REASON_LINE_FROM || mine.length === 0) continue;
    const count = new Map<string, { k: number; latest: string }>();
    for (const e of mine) for (const tag of new Set(e.tags)) {
      if (NOT_A_CAUSE.has(tag)) continue;
      const c = count.get(tag) ?? { k: 0, latest: "" };
      count.set(tag, { k: c.k + 1, latest: e.date > c.latest ? e.date : c.latest });
    }
    const top = [...count.entries()].sort(([, a], [, b]) => b.k - a.k || b.latest.localeCompare(a.latest))[0];
    if (!top || top[1].k < 2) continue;
    const label = reasonLabel(t, top[0]);
    out.push(t("why.mostOften", { name: t(`why.many.${id}`), reason: label.charAt(0).toLocaleLowerCase() + label.slice(1), k: top[1].k, n: mine.length }));
  }
  return out;
};
