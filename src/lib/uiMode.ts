// Which version of the screens this install sees (1.8.0). People who
// finished onboarding before the update keep the 1.7.9 screens
// (src/classic/); new installs get the doors onboarding and the new
// screens. Her call, Oct 31 2026: "keep the old version for old users
// at first; delete it once none are left". The Mixpanel user property
// "ui" shows how many are still on classic.
//
// Decided once, on the first launch of 1.8.0, and stored, so finishing
// the new onboarding later never flips anyone back to classic.
export type UiMode = "classic" | "new";

const UI_MODE_KEY = "memap_ui";

export const getUiMode = (): UiMode => {
  try {
    const saved = localStorage.getItem(UI_MODE_KEY);
    if (saved === "classic" || saved === "new") return saved;
    const finishedOldOnboarding =
      localStorage.getItem("memap_tour_seen") === "true" && !localStorage.getItem("memap_door");
    const mode: UiMode = finishedOldOnboarding ? "classic" : "new";
    localStorage.setItem(UI_MODE_KEY, mode);
    return mode;
  } catch {
    return "new";
  }
};
