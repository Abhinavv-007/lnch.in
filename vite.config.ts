import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Local dev proxies /api/* to wrangler so React app can call Pages Functions
// without hitting CORS or 404s. In prod the same paths are served by Pages.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8788",
        changeOrigin: true,
        ws: false,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    target: "es2022",
  },
});
