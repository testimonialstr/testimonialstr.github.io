import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Use relative asset paths so the build works from any GitHub Pages
// subpath (e.g. /testimonialstr/) without rebuild-time configuration.
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { port: 5174 },
});
