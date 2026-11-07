import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

// Generates the app icons in public/ from public/favicon.svg: `npm run icons`.
// Padded icons (maskable, Apple) get the light background colour (--color-paper).
const background = "#eef0ff";

export default defineConfig({
  headLinkOptions: { preset: "2023" },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background } },
  },
  images: ["public/favicon.svg"],
});
