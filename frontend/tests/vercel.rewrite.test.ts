// @ts-expect-error Node.js runtime fs module in Vitest node environment
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

interface VercelConfig {
  rewrites?: Array<{
    source: string;
    destination: string;
  }>;
}

describe('Vercel SPA rewrite regex', () => {
  const vercelPath = new URL('../vercel.json', import.meta.url);
  const vercelContent = fs.readFileSync(vercelPath, 'utf-8');
  const vercelConfig = JSON.parse(vercelContent) as VercelConfig;

  it('defines a rewrite to /index.html with a negative lookahead regex', () => {
    const rewrite = vercelConfig.rewrites?.find((r) => r.destination === '/index.html');
    expect(rewrite).toBeDefined();
    expect(rewrite?.source).toBeDefined();
    expect(rewrite?.source.startsWith('/((?!')).toBe(true);
  });

  const rewrite = vercelConfig.rewrites?.find((r) => r.destination === '/index.html');
  const rewriteSource = rewrite?.source ?? '';
  const rewriteRegex = new RegExp(`^${rewriteSource}$`);

  const staticPaths = [
    // assets/
    '/assets/index-CXx6tzWZ.css',
    '/assets/pdf.worker.min-CjEcRF4W.mjs',
    '/assets/atkinson-hyperlegible-latin-400-normal-BrHNak5F.woff2',
    // samples/
    '/samples/triangle.json',
    '/samples/sine.json',
    '/samples/barchart.json',
    // icons/
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    // brand/
    '/brand/logo-full.svg',
    '/brand/logo-mark.svg',
    '/brand/og-image.png',
    '/brand/og-image.svg',
    // mascot/
    '/mascot/frankenstein-phone.svg',
    // voice/
    '/voice/manifest.json',
    // root service worker & manifest
    '/sw.js',
    '/registerSW.js',
    '/workbox-835c8c05.js',
    '/manifest.webmanifest',
    // favicons & icons
    '/favicon.svg',
    '/favicon.ico',
    '/apple-touch-icon.png',
    // robots.txt
    '/robots.txt',
  ];

  for (const staticPath of staticPaths) {
    it(`does NOT rewrite static asset path: ${staticPath} (passes through)`, () => {
      const isRewritten = rewriteRegex.test(staticPath);
      expect(isRewritten).toBe(false);
    });
  }

  const spaRoutes = [
    '/',
    '/anything',
    '/saved',
    '/explore',
    '/capture',
    '/correct',
    '/debug',
    '/settings',
  ];

  for (const spaRoute of spaRoutes) {
    it(`rewrites SPA navigation route: ${spaRoute} -> index.html`, () => {
      const isRewritten = rewriteRegex.test(spaRoute);
      expect(isRewritten).toBe(true);
    });
  }
});
