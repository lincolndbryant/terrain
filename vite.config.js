import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Set VITE_BASE_PATH=/ in Cloudflare Pages env vars; GitHub Pages uses /terrain/
  base: process.env.VITE_BASE_PATH ?? "/terrain/",
  server: { port: 7777 },
});
