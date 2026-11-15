// Colour-blind mode (her idea, Nov 12 2026: «я бы делала режим для дальтоников отдельным, не?»; her pick «O: оранжевый
// и голубой»). About 1 in 12 men can't tell her berry red from her mint green. With the mode on, hard is orange and good
// is sky blue (the Okabe & Ito palette, which keeps its hues for all three kinds of colour blindness), and good days
// are drawn as rings, so the meaning never rests on colour alone (WCAG 1.4.1). Her colours stay for everyone else.
// The colours and rings live in index.css (html[data-cb="1"]); the PDF report draws them itself (doctorReport.ts).
//
// It also turns on by itself on an iPhone with Settings → Accessibility → Display & Text Size → "Differentiate Without
// Color" on (her ask, Nov 15 2026, for the App Store's accessibility label), as long as she hasn't chosen in MeMap's own
// Settings: her choice there always wins. Native side: A11yPlugin in ios/App/App/AppDelegate.swift.
import { Capacitor, registerPlugin } from "@capacitor/core";

const KEY = "memap_colorblind";

interface A11yPlugin {
  differentiateWithoutColor(): Promise<{ on: boolean }>;
  addListener(event: "change", cb: (d: { on: boolean }) => void): Promise<{ remove: () => Promise<void> }>;
}
const A11y = registerPlugin<A11yPlugin>("A11y");
/** the iPhone's "Differentiate Without Color", once read */
let systemOn = false;

/** her own choice in MeMap's Settings, or null when she hasn't chosen */
const chosen = (): boolean | null => {
  try { const v = localStorage.getItem(KEY); return v === "1" ? true : v === "0" ? false : null; } catch { return null; }
};

export const isColorBlind = (): boolean => chosen() ?? systemOn;

/** Puts the mode on the page (index.css reads html[data-cb]). */
export const applyColorBlind = (on = isColorBlind()) => {
  if (typeof document !== "undefined") document.documentElement.setAttribute("data-cb", on ? "1" : "0");
};

export const setColorBlind = (on: boolean) => {
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* blocked storage: on for this visit */ }
  applyColorBlind(on);
};

/** On an iPhone: follow "Differentiate Without Color" (at start and when it changes) while she hasn't chosen herself. */
export const followSystemColorBlind = (): void => {
  if (Capacitor.getPlatform() !== "ios") return;
  const take = (on: boolean) => {
    systemOn = on;
    if (chosen() === null) { applyColorBlind(on); window.dispatchEvent(new Event("memap-colorblind-changed")); }
  };
  A11y.differentiateWithoutColor().then((r) => take(!!r?.on)).catch(() => { /* an older build without the plugin: her switch only */ });
  A11y.addListener("change", (r) => take(!!r?.on)).catch(() => { /* no live updates */ });
};
