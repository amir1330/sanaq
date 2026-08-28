import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

declare const process: { env: Record<string, string | undefined> };

const PROD_API = "https://sanaq.abuyunus.cc";

export default defineConfig(({ command }) => {
  const apiTarget = process.env.VITE_API_PROXY?.trim();

  if (command === "serve" && !apiTarget) {
    throw new Error(
      [
        "VITE_API_PROXY is required for `npm run dev`.",
        "Copy frontend/.env.local.example → frontend/.env.local and set your API URL.",
        `To hit production (mutates live data): VITE_API_PROXY=${PROD_API}`,
      ].join("\n"),
    );
  }

  const target = apiTarget || PROD_API;

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": { target, changeOrigin: true, secure: true },
        "/health": { target, changeOrigin: true, secure: true },
        "/uploads": { target, changeOrigin: true, secure: true },
      },
    },
  };
});
