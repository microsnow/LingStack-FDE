import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // Relative URLs allow the package to work at a domain root or subdirectory.
  base: "./",
  plugins: [react()],
  build: {
    // The build script clears dist first; keep this explicit for direct Vite use too.
    emptyOutDir: true,
    // The largest lazy chunk is OpenCC's phrase dictionary. It is loaded only when
    // Chinese conversion runs and is smaller than the package's all-locales bundle.
    chunkSizeWarningLimit: 1100,
  },
});
