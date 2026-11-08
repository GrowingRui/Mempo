import { pathToFileURL } from "node:url";
import { defineConfig, loadEnv, type Connect, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { site } from "./src/config/site.ts";

/**
 * Runs the serverless functions in api/ on localhost too (npm run dev / npm run preview), so reminders can be
 * tried before deploying. Settings come from .env.local; without Redis settings, reminders live in memory.
 * On Vercel these files are deployed as functions and this plugin isn't used.
 */
function localApi(): Plugin {
  const middleware: Connect.NextHandleFunction = async (req, res, next) => {
    const name = req.url?.match(/^\/api\/([a-z-]+)(?:\?|$)/)?.[1];
    if (!name) return next();
    try {
      // Node strips the types itself; the path is built at run time so Vite doesn't bundle it into this config.
      const mod = await import(pathToFileURL(`${process.cwd()}/api/${name}.ts`).href);
      const handler = mod[req.method ?? "GET"] as ((r: Request) => Promise<Response>) | undefined;
      if (!handler) return void res.writeHead(405).end();
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const out = await handler(new Request(`http://localhost${req.url}`, { method: req.method, headers, body }));
      res.writeHead(out.status, Object.fromEntries(out.headers)).end(Buffer.from(await out.arrayBuffer()));
    } catch (e) {
      console.error(e);
      res.writeHead(500).end(String(e));
    }
  };
  return {
    name: "local-api",
    config(_, { mode }) {
      for (const [k, v] of Object.entries(loadEnv(mode, process.cwd(), ""))) process.env[k] ??= v;
    },
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  };
}

export default defineConfig({
  plugins: [
    localApi(),
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
