// "Worth watching" (her note, Nov 8 2026: "давай добавим какие-то советы или статьи… что мы думаем
// будет полезно понаблюдать"): one short tip a day on the path, about a question from the library
// she doesn't ask yet and a button that adds the question. (Its source was shown under it until Nov 10 2026; now
// it stays in observeTipsData.ts for checks only.)
import { Tracker } from "@/types/tracker";
import { findTemplate, isoLocal } from "@/lib/doors";
import { templateIdOf } from "@/lib/answerPhrases";
import { islandOf, type IslandId } from "@/lib/islands";
import { OBSERVE_TIPS } from "@/lib/observeTipsData";
import { MINIMAL_MEDICINE, QUIET_TIPS } from "@/lib/medicalArchive";

export interface ObserveTip {
  id: string;
  templateId: string;
  en: { title: string; line: string };
  ru: { title: string; line: string };
  /** where it comes from: kept for checks, not shown in the app (her content audit, Nov 10 2026) */
  source: { name: string; url: string };
  /** how the tip was checked; "held" = not shown until a directly relevant source is found */
  review?: {
    status: "rewritten" | "needs-source-check" | "held"; limits?: string; date?: string;
    /** the source check (Nov 10 2026): does it resolve and support the copy, and what limits it */
    source?: "VERIFIED" | "PARTIAL" | "MISMATCH" | "UNVERIFIED"; sourceNote?: string;
  };
}
/** held for its source, or about an illness or a medicine while "minimum medicine" is on (medicalArchive.ts) */
const shown = (x: ObserveTip) => x.review?.status !== "held" && !(MINIMAL_MEDICINE && QUIET_TIPS.has(x.templateId));

const KEY = "memap_observe_tip";
interface TipState { day: string; id: string; done?: "added" | "later"; used: string[] }
const read = (): TipState | null => {
  try { const s = JSON.parse(localStorage.getItem(KEY) ?? "null"); return s && typeof s.day === "string" ? { used: [], ...s } : null; } catch { return null; }
};
const write = (s: TipState) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* the tip just shows again */ } };

const islandOfTemplate = (templateId: string): IslandId | null => {
  const f = findTemplate(templateId);
  return f ? islandOf({ id: "x", title: f.template.title, category: f.template.category, cluster: f.clusterId } as Tracker) : null;
};

/** Today's tip and whether it was looked at: the same one all day, never about a question she asks. */
export const tipForToday = (trackers: Tracker[], today = isoLocal(new Date())): { tip: ObserveTip; done: boolean } | null => {
  const asked = new Set(trackers.filter((t) => !t.archived).map(templateIdOf).filter(Boolean) as string[]);
  const s = read();
  const byId = (id: string) => OBSERVE_TIPS.find((x) => x.id === id);
  if (s?.day === today) {
    const tip = byId(s.id);
    if (tip && shown(tip) && (s.done || !asked.has(tip.templateId))) return { tip, done: !!s.done };
  }
  const used = new Set(s?.used ?? []);
  // the period tip only for someone who already watches a cycle
  const cycle = trackers.some((t) => !t.archived && /period|cycle|pms|месячн|цикл|пмс/i.test(t.title));
  const fits = OBSERVE_TIPS.filter((x) => shown(x) && !asked.has(x.templateId) && findTemplate(x.templateId) && (x.templateId !== "period-day" || cycle));
  if (fits.length === 0) return null;
  // her own islands first: a tip about a part of life she already watches
  const mine = new Set(trackers.filter((t) => !t.archived).map(islandOf));
  const fresh = fits.filter((x) => !used.has(x.id));
  const pool = fresh.length > 0 ? fresh : fits;
  const tip = pool.find((x) => { const i = islandOfTemplate(x.templateId); return i !== null && mine.has(i); }) ?? pool[0];
  write({ day: today, id: tip.id, used: fresh.length > 0 ? [...used] : [] });
  return { tip, done: false };
};

/** She read today's tip: added its question, or "not now". */
export const markTip = (id: string, done: "added" | "later") => {
  const s = read();
  const used = new Set(s?.used ?? []); used.add(id);
  write({ day: isoLocal(new Date()), id, done, used: [...used] });
  window.dispatchEvent(new Event("memap-settings-changed"));
};
