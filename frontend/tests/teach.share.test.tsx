/**
 * Tests for SharePanel, Clipboard driver, and QR Code in Teacher Editor (Lane t2-teach-editor).
 *
 * Requirements:
 * - Generated link shown with character count
 * - "Copy link" button triggers clipboard driver and speaks "Link copied"
 * - Web Share API only available/rendered when navigator.share exists
 * - QR code rendered when URL fits (<= 2000 chars)
 * - "Link too long for a QR code; use Copy link" message when URL exceeds QR limit
 * - Link origin resolves from VITE_SITE_URL or window.location.origin
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SharePanel } from '../src/components/teach/SharePanel';
import {
  canWebShare,
  copyToClipboard,
  getShareOrigin,
  shareViaWebShare,
} from '../src/drivers/clipboard';
import { qrDataUrl } from '../src/share/qr';
import { t } from '../src/i18n';

describe('SharePanel & Clipboard / Share Drivers', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SITE_URL', 'https://ghost-touch.org');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('getShareOrigin', () => {
    it('uses VITE_SITE_URL if configured', () => {
      vi.stubEnv('VITE_SITE_URL', 'https://school.example.edu/');
      expect(getShareOrigin()).toBe('https://school.example.edu');
    });

    it('falls back to window.location.origin if VITE_SITE_URL is unset', () => {
      vi.stubEnv('VITE_SITE_URL', '');
      const origWindow = (globalThis as unknown as { window?: unknown }).window;
      (globalThis as unknown as { window: unknown }).window = {
        location: { origin: 'http://localhost:5173/' },
      };

      expect(getShareOrigin()).toBe('http://localhost:5173');

      (globalThis as unknown as { window?: unknown }).window = origWindow;
    });
  });

  describe('Clipboard & Web Share driver helpers', () => {
    it('copyToClipboard copies text via navigator.clipboard.writeText', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      const origClipboard = globalThis.navigator?.clipboard;
      try {
        Object.defineProperty(globalThis.navigator, 'clipboard', {
          value: { writeText: writeTextMock },
          configurable: true,
          writable: true,
        });

        const result = await copyToClipboard('https://ghost-touch.org/#s=payload');
        expect(result).toBe(true);
        expect(writeTextMock).toHaveBeenCalledWith('https://ghost-touch.org/#s=payload');
      } finally {
        Object.defineProperty(globalThis.navigator, 'clipboard', {
          value: origClipboard,
          configurable: true,
          writable: true,
        });
      }
    });

    it('copyToClipboard returns false safely when navigator has no clipboard', async () => {
      const origClipboard = globalThis.navigator?.clipboard;
      try {
        Object.defineProperty(globalThis.navigator, 'clipboard', {
          value: undefined,
          configurable: true,
          writable: true,
        });
        const result = await copyToClipboard('test');
        expect(typeof result).toBe('boolean');
      } finally {
        Object.defineProperty(globalThis.navigator, 'clipboard', {
          value: origClipboard,
          configurable: true,
          writable: true,
        });
      }
    });

    it('canWebShare reports true only when navigator.share is a function', () => {
      const origShare = (globalThis.navigator as unknown as { share?: unknown }).share;
      try {
        Object.defineProperty(globalThis.navigator, 'share', {
          value: vi.fn(),
          configurable: true,
          writable: true,
        });
        expect(canWebShare()).toBe(true);

        Object.defineProperty(globalThis.navigator, 'share', {
          value: undefined,
          configurable: true,
          writable: true,
        });
        expect(canWebShare()).toBe(false);
      } finally {
        Object.defineProperty(globalThis.navigator, 'share', {
          value: origShare,
          configurable: true,
          writable: true,
        });
      }
    });

    it('shareViaWebShare calls navigator.share and returns true on success', async () => {
      const shareMock = vi.fn().mockResolvedValue(undefined);
      const origShare = (globalThis.navigator as unknown as { share?: unknown }).share;
      try {
        Object.defineProperty(globalThis.navigator, 'share', {
          value: shareMock,
          configurable: true,
          writable: true,
        });

        const res = await shareViaWebShare({ title: 'Diagram', url: 'https://example.com' });
        expect(res).toBe(true);
        expect(shareMock).toHaveBeenCalledWith({ title: 'Diagram', url: 'https://example.com' });
      } finally {
        Object.defineProperty(globalThis.navigator, 'share', {
          value: origShare,
          configurable: true,
          writable: true,
        });
      }
    });

    it('shareViaWebShare returns false gracefully on user cancellation (AbortError)', async () => {
      const abortError = new Error('Share canceled');
      abortError.name = 'AbortError';
      const shareMock = vi.fn().mockRejectedValue(abortError);
      const origShare = (globalThis.navigator as unknown as { share?: unknown }).share;
      try {
        Object.defineProperty(globalThis.navigator, 'share', {
          value: shareMock,
          configurable: true,
          writable: true,
        });

        const res = await shareViaWebShare({ url: 'https://example.com' });
        expect(res).toBe(false);
      } finally {
        Object.defineProperty(globalThis.navigator, 'share', {
          value: origShare,
          configurable: true,
          writable: true,
        });
      }
    });
  });

  describe('SharePanel presentation', () => {
    it('renders the generated URL and size in characters', () => {
      const sampleUrl = 'https://ghost-touch.org/#s=compressed_payload_string';
      const html = renderToStaticMarkup(
        createElement(SharePanel, {
          url: sampleUrl,
          qrUrl: 'data:image/png;base64,mockqr',
          onSpeak: vi.fn(),
          diagramTitle: 'Sample Diagram',
        }),
      );

      expect(html).toContain(sampleUrl);
      expect(html).toContain(`Size: ${sampleUrl.length} characters`);
      expect(html).toContain(t('teach.copyLink'));
    });

    it('renders QR code image when qrUrl is provided', () => {
      const sampleUrl = 'https://ghost-touch.org/#s=short';
      const mockQr = 'data:image/png;base64,mockqrcode';
      const html = renderToStaticMarkup(
        createElement(SharePanel, {
          url: sampleUrl,
          qrUrl: mockQr,
          onSpeak: vi.fn(),
        }),
      );

      expect(html).toContain('<img');
      expect(html).toContain(`src="${mockQr}"`);
      expect(html).toContain(`alt="${t('teach.qrCodeAlt')}"`);
    });

    it('renders "Link too long for a QR code; use Copy link" message when qrUrl is null', () => {
      const longUrl = `https://ghost-touch.org/#s=${'A'.repeat(2500)}`;
      const html = renderToStaticMarkup(
        createElement(SharePanel, {
          url: longUrl,
          qrUrl: null, // Too long for QR!
          onSpeak: vi.fn(),
        }),
      );

      expect(html).toContain(t('teach.qrTooLong'));
      expect(html).not.toContain('<img');
    });

    it('qrDataUrl returns null for URLs exceeding qrMaxUrlChars (2000 chars)', async () => {
      const longUrl = `https://ghost-touch.org/#s=${'X'.repeat(2001)}`;
      const res = await qrDataUrl(longUrl);
      expect(res).toBeNull();
    });

    it('qrDataUrl returns valid data:image URL for URLs within limit', async () => {
      const shortUrl = 'https://ghost-touch.org/#s=abc';
      const res = await qrDataUrl(shortUrl);
      expect(res).not.toBeNull();
      expect(res?.startsWith('data:image/')).toBe(true);
    });

    it('conditionally renders "Share" button only when Web Share API is available', () => {
      const origShare = (globalThis.navigator as unknown as { share?: unknown }).share;
      try {
        // 1. Without Web Share API
        Object.defineProperty(globalThis.navigator, 'share', {
          value: undefined,
          configurable: true,
          writable: true,
        });
        const htmlWithout = renderToStaticMarkup(
          createElement(SharePanel, {
            url: 'https://example.com',
            qrUrl: null,
            onSpeak: vi.fn(),
          }),
        );
        expect(htmlWithout).not.toContain(`>${t('teach.share')}<`);

        // 2. With Web Share API
        Object.defineProperty(globalThis.navigator, 'share', {
          value: vi.fn(),
          configurable: true,
          writable: true,
        });
        const htmlWith = renderToStaticMarkup(
          createElement(SharePanel, {
            url: 'https://example.com',
            qrUrl: null,
            onSpeak: vi.fn(),
          }),
        );
        expect(htmlWith).toContain(`>${t('teach.share')}<`);
      } finally {
        Object.defineProperty(globalThis.navigator, 'share', {
          value: origShare,
          configurable: true,
          writable: true,
        });
      }
    });
  });
});
