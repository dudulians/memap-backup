import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// Init i18next before any component renders so t() works everywhere
// on first paint. Side-effect import: the module self-initialises.
import "./lib/i18n";

createRoot(document.getElementById("root")!).render(<App />);
