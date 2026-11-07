import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { site } from "./src/config/site.ts";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "prompt", // a new version waits until the user taps "Update", so a study session is never cut off
      includeManifestIcons: false, // already in globPatterns below
      injectRegister: false, // registered in src/components/UpdatePrompt.tsx
      injectManifest: {
        // App shell, fonts, icons and the word lists. Audio (~50 MB) is cached separately, see src/sw.ts.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}", "data/*.json"],
      },
      manifest: {
        name: site.name,
        short_name: site.name,
        description: `${site.tagline} ${site.description}`,
        lang: "en",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#eef0ff",
        background_color: "#eef0ff",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
});
