import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // OneDrive sometimes refuses a read in the big marketing/native folders (errno -4094),
    // which crashed the dev server's watcher; the app's code is never there
    watch: { ignored: ["**/marketing/**", "**/android/**", "**/ios/**", "**/docs/**"] },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
