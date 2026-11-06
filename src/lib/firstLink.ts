// The first link moment (Nov 6 2026, her pick from the list of hooks): the day her
// first link is found — what comes before what, the app's main promise — it's shown
// as a moment, not left to be noticed. Once.
import type { Route } from "@/lib/islands";
import { isoLocal } from "@/lib/doors";

const KNOWN = "memap_links_known";
const SEEN = "memap_first_link_seen";

/** The first link if it's waiting to be shown, and whether it was shown today.
 *  Only with answers in (before they load, nothing is decided). An install that
 *  already had links when this came counts as seen: no "first link" for an old
 *  hand. */
export const firstLinkState = (routes: Route[], hasAnswers: boolean): { route: Route | null; seenToday: boolean } => {
  try {
    const seen = localStorage.getItem(SEEN);
    if (seen) return { route: null, seenToday: seen === isoLocal(new Date()) };
    if (!hasAnswers) return { route: null, seenToday: false };
    if (localStorage.getItem(KNOWN) === null) {
      localStorage.setItem(KNOWN, String(routes.length));
      if (routes.length > 0) { localStorage.setItem(SEEN, "before"); return { route: null, seenToday: false }; }
    }
    return { route: routes[0] ?? null, seenToday: false };
  } catch {
    return { route: null, seenToday: false };
  }
};

export const markFirstLinkSeen = () => {
  try { localStorage.setItem(SEEN, isoLocal(new Date())); } catch { /* shows again, harmless */ }
  window.dispatchEvent(new Event("memap-first-link-seen"));
};
