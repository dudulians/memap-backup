import { createRoot } from "react-dom/client";
import { applyColorBlind } from "@/lib/colorBlind";
import App from "./App.tsx";
import "./index.css";
// Init i18next before any component renders so t() works everywhere
// on first paint. Side-effect import: the module self-initialises.
import "./lib/i18n";
// Init Sentry BEFORE the first React render so errors thrown during
// initial paint (rare but possible — bad localStorage state, plugin
// init failure, etc.) are also captured. No-op in dev.
import { initSentry, sendInstallHeartbeat } from "./lib/sentry";
// Init Mixpanel analytics. Anonymous, event-only, no PII. No-op in dev.
import { initAnalytics } from "./lib/analytics";
import { getUiMode } from "./lib/uiMode";

initSentry();
// Fire a one-time INFO event on fresh install so the Sentry dashboard
// has at least one data point — confirms the pipeline is wired up
// even when no errors actually happen in the wild. Idempotent
// (localStorage flag), no-op in dev.
sendInstallHeartbeat();
initAnalytics();
// The new screens get their own bundled font (MeMap Sans, index.css);
// classic keeps the one it shipped with.
document.documentElement.setAttribute("data-ui", getUiMode());
applyColorBlind();

createRoot(document.getElementById("root")!).render(<App />);
