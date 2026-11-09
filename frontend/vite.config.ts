import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA, type VitePWAOptions } from 'vite-plugin-pwa';
import { siteUrlPlugin } from './vite-plugins/siteUrl.ts';
import vercelConfig from './vercel.json' with { type: 'json' };

interface VercelHeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

/** The headers Vercel sends on every route (`/(.*)`), as a plain object. */
export function siteHeaders(): Record<string, string> {
  const rules = (vercelConfig as { headers?: VercelHeaderRule[] }).headers ?? [];
  const all = rules.find((rule) => rule.source === '/(.*)');
  const out: Record<string, string> = {};
  for (const { key, value } of all?.headers ?? []) out[key] = value;
  return out;
}

export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'autoUpdate',
  includeManifestIcons: false,
  manifest: {
    name: 'Ghost Touch',
    short_name: 'Ghost Touch',
    description: 'Feel STEM diagrams by touch on an Android phone.',
    theme_color: '#0b0e0c',
    background_color: '#0b0e0c',
    display: 'standalone',
    orientation: 'portrait',
    start_url: '/',
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: 'icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,ico,json,woff2,mjs}'],
    globIgnores: ['**/*.pdf', '**/brand/og-image.*', '**/brand/og-image.png', '**/voice/manifest.json'],
    maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
    runtimeCaching: [
      {
        urlPattern: /\/assets\/pdf.*/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'pdf-runtime-cache',
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
    ],
  },
};

// Vite build + dev config. Test settings live in vitest.config.ts so the
// Vite and Vitest config types don't fight over plugin option shapes.
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), siteUrlPlugin(), VitePWA(pwaOptions)],
  server: {
    host: true,
  },
  // `vite preview` serves the production build with the same security headers as Vercel, so
  // the CSP can be checked locally before deploying (A6-04). vercel.json is the one source.
  preview: {
    headers: siteHeaders(),
  },
});
