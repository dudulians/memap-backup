// A light tour without words (her note, Nov 10 2026, after the short onboarding: "не хватило всё-таки
// какого-то лёгкого тура… чтоб подсвечивалась кнопка World, чтоб человек захотел нажать, он нажимает —
// там светятся другие"). After her first evening the World tab glows until she opens it; in the World the
// four parts (My days · Links · When to act · What helps) glow until each is opened once. New people only,
// for their first two weeks.
import { cohort } from "@/lib/analytics";

export type GlowPart = "world" | "overview" | "findings" | "signals" | "helps";
const KEY = "memap_glow_seen";
const DAYS = 14;

const read = (): Partial<Record<GlowPart, string>> => {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}") ?? {}; } catch { return {}; }
};

/** Within her first two weeks (counted from onboarding), and a new install. */
const early = (): boolean => {
  if (cohort() === "old") return false;
  try {
    const at = localStorage.getItem("memap_onboarded_at");
    if (!at) return true;
    return Date.now() - new Date(at).getTime() < DAYS * 864e5;
  } catch { return false; }
};

/** Should this glow now? `answered`: she has at least one evening of answers. */
export const glows = (part: GlowPart, answered: boolean): boolean => {
  if (!answered || !early()) return false;
  const seen = read();
  if (seen[part]) return false;
  // the parts glow once she is in the World (after the tab itself)
  return part === "world" || !!seen.world;
};

export const markGlowSeen = (part: GlowPart): void => {
  const seen = read();
  if (seen[part]) return;
  seen[part] = new Date().toISOString();
  try { localStorage.setItem(KEY, JSON.stringify(seen)); } catch { /* it glows again next time */ }
  window.dispatchEvent(new Event("memap-glow-changed"));
};
