// @ts-expect-error Node.js runtime fs module in Vitest node environment
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pwaOptions } from '../vite.config.ts';
import {
  normalizeSiteUrl,
  siteUrlPlugin,
  transformSiteUrl,
} from '../vite-plugins/siteUrl.ts';

describe('PWA configuration and Precache hygiene', () => {
  const indexHtmlPath = new URL('../index.html', import.meta.url);
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8') as string;
  const manifest = pwaOptions.manifest && typeof pwaOptions.manifest === 'object' ? pwaOptions.manifest : null;

  it('sets theme_color and background_color to #0b0e0c in webmanifest', () => {
    expect(manifest?.theme_color).toBe('#0b0e0c');
    expect(manifest?.background_color).toBe('#0b0e0c');
  });

  it('matches theme_color in index.html and webmanifest exactly', () => {
    const metaThemeMatch = indexHtml.match(/<meta\s+name=["']theme-color["']\s+content=["']([^"']+)["']/i);
    expect(metaThemeMatch).not.toBeNull();
    const htmlThemeColor = metaThemeMatch?.[1];
    expect(htmlThemeColor).toBe('#0b0e0c');
    expect(htmlThemeColor).toBe(manifest?.theme_color);
  });

  it('does not have duplicate includeAssets for icons captured by globPatterns', () => {
    // includeAssets should either be undefined, empty, or not include the icons that globPatterns catches
    const includeAssets = pwaOptions.includeAssets;
    if (includeAssets !== undefined) {
      const assetsList = Array.isArray(includeAssets) ? includeAssets : [includeAssets];
      expect(assetsList).not.toContain('icons/icon-192.png');
      expect(assetsList).not.toContain('icons/icon-512.png');
    }
  });

  it('precaches woff2 self-hosted fonts alongside svg, png, ico, and json', () => {
    const globPatterns = pwaOptions.workbox?.globPatterns ?? [];
    const joined = globPatterns.join(',');
    expect(joined).toContain('woff2');
    expect(joined).toContain('svg');
    expect(joined).toContain('png');
    expect(joined).toContain('ico');
    expect(joined).toContain('json');
  });

  it('excludes brand/og-image and voice/manifest from precache via globIgnores', () => {
    const globIgnores = pwaOptions.workbox?.globIgnores ?? [];
    // Must ignore large og-image (~250 KB)
    const ignoresOgImage = globIgnores.some((pattern) => pattern.includes('og-image'));
    expect(ignoresOgImage).toBe(true);

    // Must ignore orphaned voice manifest
    const ignoresVoiceManifest = globIgnores.some((pattern) => pattern.includes('voice/manifest.json'));
    expect(ignoresVoiceManifest).toBe(true);

    // Must keep pdf excluded from precache
    const ignoresPdf = globIgnores.some((pattern) => pattern.includes('pdf'));
    expect(ignoresPdf).toBe(true);
  });

  it('configures runtimeCaching for dynamic PDF worker and chunks (CacheFirst)', () => {
    const runtimeCaching = pwaOptions.workbox?.runtimeCaching ?? [];
    expect(runtimeCaching.length).toBeGreaterThan(0);

    const pdfRule = runtimeCaching.find((rule) => {
      if (rule.urlPattern instanceof RegExp) {
        return rule.urlPattern.test('/assets/pdf.worker.min-12345.mjs');
      }
      return false;
    });

    expect(pdfRule).toBeDefined();
    expect(pdfRule?.handler).toBe('CacheFirst');
    expect(pdfRule?.options?.cacheName).toBe('pdf-runtime-cache');
    expect(pdfRule?.options?.expiration?.maxEntries).toBeGreaterThanOrEqual(1);
    expect(pdfRule?.options?.expiration?.maxAgeSeconds).toBeGreaterThanOrEqual(86400); // At least 1 day
  });
});

describe('Social preview and VITE_SITE_URL transform', () => {
  it('normalizes site URL by stripping trailing slashes and whitespace', () => {
    expect(normalizeSiteUrl('https://ghost-touch.vercel.app/')).toBe('https://ghost-touch.vercel.app');
    expect(normalizeSiteUrl('https://ghost-touch.vercel.app///')).toBe('https://ghost-touch.vercel.app');
    expect(normalizeSiteUrl('  https://ghost-touch.vercel.app/  ')).toBe('https://ghost-touch.vercel.app');
    expect(normalizeSiteUrl('')).toBe('');
    expect(normalizeSiteUrl(undefined)).toBe('');
  });

  it('leaves HTML untouched when site URL is undefined or empty', () => {
    const sample = '<meta property="og:image" content="/brand/og-image.png" />';
    expect(transformSiteUrl(sample, undefined)).toBe(sample);
    expect(transformSiteUrl(sample, '')).toBe(sample);
    expect(transformSiteUrl(sample, '   ')).toBe(sample);
  });

  it('rewrites og:image, twitter:image, and og:url to absolute URLs', () => {
    const sample = `
      <head>
        <meta property="og:title" content="Ghost Touch" />
        <meta property="og:url" content="/" />
        <meta property="og:image" content="/brand/og-image.png" />
        <meta name="twitter:image" content="/brand/og-image.png" />
      </head>
    `;
    const transformed = transformSiteUrl(sample, 'https://ghost-touch.vercel.app/');

    expect(transformed).toContain('<meta property="og:url" content="https://ghost-touch.vercel.app/" />');
    expect(transformed).toContain('<meta property="og:image" content="https://ghost-touch.vercel.app/brand/og-image.png" />');
    expect(transformed).toContain('<meta name="twitter:image" content="https://ghost-touch.vercel.app/brand/og-image.png" />');
  });

  it('injects og:url if missing when site URL is configured', () => {
    const sample = `
      <head>
        <meta property="og:image" content="/brand/og-image.png" />
      </head>
    `;
    const transformed = transformSiteUrl(sample, 'https://ghost-touch.vercel.app');
    expect(transformed).toContain('property="og:url" content="https://ghost-touch.vercel.app/"');
  });

  it('transforms production index.html cleanly', () => {
    const indexHtmlPath = new URL('../index.html', import.meta.url);
    const rawHtml = fs.readFileSync(indexHtmlPath, 'utf-8') as string;
    const transformed = transformSiteUrl(rawHtml, 'https://ghost-touch.vercel.app');

    expect(transformed).toContain('<meta property="og:url" content="https://ghost-touch.vercel.app/" />');
    expect(transformed).toContain('<meta property="og:image" content="https://ghost-touch.vercel.app/brand/og-image.png" />');
    expect(transformed).toContain('<meta name="twitter:image" content="https://ghost-touch.vercel.app/brand/og-image.png" />');
  });

  it('provides a functional siteUrlPlugin Vite plugin', () => {
    const plugin = siteUrlPlugin('https://preview.ghost-touch.app');
    expect(plugin.name).toBe('gt-site-url');
    // @ts-expect-error transformIndexHtml signature in Vite plugin
    const transformed = plugin.transformIndexHtml?.('<meta property="og:image" content="/brand/og-image.png" />');
    expect(transformed).toBe('<meta property="og:image" content="https://preview.ghost-touch.app/brand/og-image.png" />');
  });
});

describe('Static SVG mascot syntax check', () => {
  it('uses valid SVG XML class attribute and not JSX className', () => {
    const mascotPath = new URL('../public/mascot/frankenstein-phone.svg', import.meta.url);
    const svgContent = fs.readFileSync(mascotPath, 'utf-8') as string;
    expect(svgContent).not.toContain('className=');
    expect(svgContent).toContain('class="gt-mascot"');
  });
});
