import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Prod API for local UI dev (no local Docker stack). Override with VITE_API_PROXY. */
const apiTarget = process.env.VITE_API_PROXY ?? "https://sanaq.abuyunus.cc";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true, secure: true },
      "/health": { target: apiTarget, changeOrigin: true, secure: true },
      "/uploads": { target: apiTarget, changeOrigin: true, secure: true },
    },
  },
});
