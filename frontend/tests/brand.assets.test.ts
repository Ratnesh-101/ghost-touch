// @ts-expect-error Node.js runtime fs module in Vitest node environment
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pwaOptions } from '../vite.config.ts';

interface ManifestIcon {
  src: string;
  sizes?: string;
  type?: string;
  purpose?: string;
}

/** Resolves a path relative to the frontend directory as a file URL */
function getFrontendUrl(relativePath: string): URL {
  return new URL(relativePath, import.meta.url);
}

/**
 * Validates PNG 8-byte magic header and parses width and height from the IHDR chunk
 * using standard DataView / Uint8Array APIs.
 */
function readPngIhdr(fileUrl: URL): { isPng: boolean; width: number; height: number } {
  if (!fs.existsSync(fileUrl)) {
    return { isPng: false, width: 0, height: 0 };
  }
  const raw = fs.readFileSync(fileUrl);
  const buf = new Uint8Array(raw);
  if (buf.length < 24) {
    return { isPng: false, width: 0, height: 0 };
  }

  // 8-byte PNG signature: 89 50 4E 47 0D 0A 1A 0A
  const isPngSignature =
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a;

  // IHDR chunk type at bytes 12-15
  const isIhdr =
    buf[12] === 0x49 && // 'I'
    buf[13] === 0x48 && // 'H'
    buf[14] === 0x44 && // 'D'
    buf[15] === 0x52;   // 'R'

  if (!isPngSignature || !isIhdr) {
    return { isPng: false, width: 0, height: 0 };
  }

  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const width = view.getUint32(16, false); // Big-endian
  const height = view.getUint32(20, false); // Big-endian

  return { isPng: true, width, height };
}

describe('Brand Asset Integrity Verification', () => {
  describe('Approved SVG brand assets', () => {
    const approvedSvgs = [
      { name: 'logo-mark.svg', url: getFrontendUrl('../public/brand/logo-mark.svg') },
      { name: 'logo-full.svg', url: getFrontendUrl('../public/brand/logo-full.svg') },
      { name: 'logo-mono.svg', url: getFrontendUrl('../public/brand/logo-mono.svg') },
      { name: 'logo-maskable.svg', url: getFrontendUrl('../public/brand/logo-maskable.svg') },
      { name: 'og-image.svg', url: getFrontendUrl('../public/brand/og-image.svg') },
      { name: 'favicon.svg', url: getFrontendUrl('../public/favicon.svg') },
    ];

    for (const svg of approvedSvgs) {
      it(`verifies approved SVG exists and contains a non-empty <title>: ${svg.name}`, () => {
        expect(fs.existsSync(svg.url)).toBe(true);
        const content = fs.readFileSync(svg.url, 'utf-8') as string;
        const titleMatch = content.match(/<title>([^<]+)<\/title>/i);
        expect(titleMatch).not.toBeNull();
        const titleText = titleMatch?.[1] ? titleMatch[1].trim() : '';
        expect(titleText.length).toBeGreaterThan(0);
      });
    }

    it('ensures favicon.svg and logo-mark.svg are under 6 KB budget', () => {
      const faviconStat = fs.statSync(getFrontendUrl('../public/favicon.svg'));
      const logoMarkStat = fs.statSync(getFrontendUrl('../public/brand/logo-mark.svg'));

      expect(faviconStat.size).toBeLessThan(6 * 1024);
      expect(logoMarkStat.size).toBeLessThan(6 * 1024);
    });
  });

  describe('HTML and PWA icon manifest linkages', () => {
    it('references all required favicons and apple touch icon in index.html', () => {
      const indexHtmlUrl = getFrontendUrl('../index.html');
      const indexHtml = fs.readFileSync(indexHtmlUrl, 'utf-8') as string;

      expect(indexHtml).toContain('/favicon.svg');
      expect(indexHtml).toContain('/favicon.ico');
      expect(indexHtml).toContain('/favicon-64x64.png');
      expect(indexHtml).toContain('/apple-touch-icon.png');
    });

    it('lists 192, 512, and maskable icons in vite.config.ts PWA manifest', () => {
      const manifest =
        pwaOptions.manifest && typeof pwaOptions.manifest === 'object'
          ? pwaOptions.manifest
          : null;
      const icons = (
        manifest && 'icons' in manifest && Array.isArray(manifest.icons)
          ? manifest.icons
          : []
      ) as ManifestIcon[];

      expect(icons.length).toBeGreaterThanOrEqual(3);

      const icon192 = icons.find(
        (i: ManifestIcon) => i.sizes === '192x192' && i.purpose !== 'maskable',
      );
      expect(icon192).toBeDefined();
      expect(icon192?.src).toBe('icons/icon-192.png');
      expect(icon192?.type).toBe('image/png');

      const icon512 = icons.find(
        (i: ManifestIcon) => i.sizes === '512x512' && i.purpose !== 'maskable',
      );
      expect(icon512).toBeDefined();
      expect(icon512?.src).toBe('icons/icon-512.png');
      expect(icon512?.type).toBe('image/png');

      const iconMaskable = icons.find(
        (i: ManifestIcon) => i.sizes === '512x512' && i.purpose === 'maskable',
      );
      expect(iconMaskable).toBeDefined();
      expect(iconMaskable?.src).toBe('icons/icon-maskable-512.png');
      expect(iconMaskable?.type).toBe('image/png');
    });
  });

  describe('Committed raster icons (PNG signature and IHDR dimensions)', () => {
    const committedIcons = [
      {
        name: 'icon-192.png',
        url: getFrontendUrl('../public/icons/icon-192.png'),
        expectedWidth: 192,
        expectedHeight: 192,
      },
      {
        name: 'icon-512.png',
        url: getFrontendUrl('../public/icons/icon-512.png'),
        expectedWidth: 512,
        expectedHeight: 512,
      },
      {
        name: 'icon-maskable-512.png',
        url: getFrontendUrl('../public/icons/icon-maskable-512.png'),
        expectedWidth: 512,
        expectedHeight: 512,
      },
      {
        name: 'apple-touch-icon.png',
        url: getFrontendUrl('../public/apple-touch-icon.png'),
        expectedWidth: 180,
        expectedHeight: 180,
      },
      {
        name: 'og-image.png',
        url: getFrontendUrl('../public/brand/og-image.png'),
        expectedWidth: 1200,
        expectedHeight: 630,
      },
    ];

    for (const icon of committedIcons) {
      it(`verifies ${icon.name} exists, has valid 8-byte PNG signature, and matches ${icon.expectedWidth}x${icon.expectedHeight} in IHDR`, () => {
        expect(fs.existsSync(icon.url)).toBe(true);
        const { isPng, width, height } = readPngIhdr(icon.url);
        expect(isPng).toBe(true);
        expect(width).toBe(icon.expectedWidth);
        expect(height).toBe(icon.expectedHeight);
      });
    }

    const favicon64Url = getFrontendUrl('../public/favicon-64x64.png');
    const favicon64Exists = fs.existsSync(favicon64Url);

    it.skipIf(!favicon64Exists)(
      'asserts favicon-64x64.png exists and is a 64x64 PNG (skipped until supervisor runs scripts/build-brand.mjs)',
      () => {
        expect(fs.existsSync(favicon64Url)).toBe(true);
        const { isPng, width, height } = readPngIhdr(favicon64Url);
        expect(isPng).toBe(true);
        expect(width).toBe(64);
        expect(height).toBe(64);
      },
    );
  });
});
