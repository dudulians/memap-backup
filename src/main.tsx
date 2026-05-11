import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// Init i18next before any component renders so t() works everywhere
// on first paint. Side-effect import: the module self-initialises.
import "./lib/i18n";
// Init Sentry BEFORE the first React render so errors thrown during
// initial paint (rare but possible — bad localStorage state, plugin
// init failure, etc.) are also captured. No-op in dev.
import { initSentry } from "./lib/sentry";

initSentry();

createRoot(document.getElementById("root")!).render(<App />);
