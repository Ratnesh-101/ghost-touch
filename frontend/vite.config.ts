import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA, type VitePWAOptions } from 'vite-plugin-pwa';
import { siteUrlPlugin } from './vite-plugins/siteUrl.ts';

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
    globPatterns: ['**/*.{js,css,html,svg,png,ico,json,woff2}'],
    globIgnores: ['**/pdf*', '**/brand/og-image.*', '**/brand/og-image.png', '**/voice/manifest.json'],
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
});
