// "Games and rewards" (her answer, Nov 9 2026: a 45-year-old tester called the bubbles, "You did great
// today!", the ranks, "Play" and the confetti "a kindergarten"; another was annoyed by streak treasures she
// could never reach). The playful layer stays on by default; Settings turns it off, and after the 10th
// answered evening Today asks once whether to keep it. Off keeps the core: islands, globe, path,
// questions, reports, When to act, tests.
import { useEffect, useState } from "react";

const KEY = "memap_playful";
const ASKED_KEY = "memap_playful_asked";
/** Screens listen to this to redraw (the old look uses the same name for its own settings). */
export const SETTINGS_EVENT = "memap-settings-changed";
/** Answered evenings (countedDays) before Today asks once: keep them? */
export const PLAYFUL_ASK_AT = 10;

/** Bubbles, treasures, ranks, confetti, the streak flame, "grew" moments: on unless turned off. */
export const isPlayful = (): boolean => {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
};

export const setPlayful = (on: boolean) => {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* stays as it was */ }
  window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: { playful: on } }));
};

/** The one-time question was answered (or the switch was used in Settings). */
export const playfulAsked = (): boolean => {
  try { return !!localStorage.getItem(ASKED_KEY); } catch { return true; }
};
export const markPlayfulAsked = () => {
  try { localStorage.setItem(ASKED_KEY, new Date().toISOString()); } catch { /* asked again, harmless */ }
};

/** The switch, kept in step with Settings and the question on Today. */
export const usePlayful = (): boolean => {
  const [on, setOn] = useState(isPlayful);
  useEffect(() => {
    const sync = () => setOn(isPlayful());
    window.addEventListener(SETTINGS_EVENT, sync);
    return () => window.removeEventListener(SETTINGS_EVENT, sync);
  }, []);
  return on;
};
