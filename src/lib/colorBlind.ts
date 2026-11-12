// Colour-blind mode (her idea, Nov 12 2026: «я бы делала режим для дальтоников отдельным, не?»; her pick «O: оранжевый
// и голубой»). About 1 in 12 men can't tell her berry red from her mint green. With the mode on, hard is orange and good
// is sky blue (the Okabe & Ito palette, which keeps its hues for all three kinds of colour blindness), and good days
// are drawn as rings, so the meaning never rests on colour alone (WCAG 1.4.1). Her colours stay for everyone else.
// The colours and rings live in index.css (html[data-cb="1"]); the PDF report draws them itself (doctorReport.ts).
const KEY = "memap_colorblind";

export const isColorBlind = (): boolean => {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
};

/** Puts the mode on the page (index.css reads html[data-cb]). */
export const applyColorBlind = (on = isColorBlind()) => {
  if (typeof document !== "undefined") document.documentElement.setAttribute("data-cb", on ? "1" : "0");
};

export const setColorBlind = (on: boolean) => {
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* blocked storage: on for this visit */ }
  applyColorBlind(on);
};
