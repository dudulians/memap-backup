// Every new link comes to Today as a step, not only the first one (Nov 13 2026, her note: the tile said 9 links and
// she had seen one; the others had appeared in the World silently). The first link keeps its own moment
// (firstLink.ts); this is for the links found after it.
// - The links already there when this arrives count as seen: no step for an old hand's old links.
// - "New link" stays on the path, done, for the day it was opened.
import { isoLocal } from "@/lib/doors";

const SEEN = "memap_links_seen";
const DAY = "memap_links_seen_day";
const read = (): string[] | null => { try { const v = localStorage.getItem(SEEN); return v === null ? null : (JSON.parse(v) as string[]); } catch { return []; } };

/** The links not shown as a step yet (their pair keys), and whether one was opened today. */
export const newLinkState = (pairs: string[]): { fresh: string[]; seenToday: boolean } => {
  let seenToday = false;
  try { seenToday = localStorage.getItem(DAY) === isoLocal(new Date()); } catch { /* not today */ }
  const seen = read();
  if (seen === null) { try { localStorage.setItem(SEEN, JSON.stringify(pairs)); } catch { /* next time */ } return { fresh: [], seenToday }; }
  const known = new Set(seen);
  return { fresh: pairs.filter((p) => !known.has(p)), seenToday };
};

/** The step was opened: these links are seen. */
export const markLinksSeen = (pairs: string[]) => {
  try {
    localStorage.setItem(SEEN, JSON.stringify([...new Set([...(read() ?? []), ...pairs])]));
    localStorage.setItem(DAY, isoLocal(new Date()));
  } catch { /* shows again, harmless */ }
  window.dispatchEvent(new Event("memap-first-link-seen"));
};
