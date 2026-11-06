/**
 * Regression and security test suite for Share fixes (Lane f2-fix-share).
 *
 * Verifies fixes for audit findings:
 * - SEC-01: Fragment-only length measurement for pre-decompression cap (full URL with origin)
 * - SEC-02: Unicode bidi / RTL overrides, C1 controls, zero-width space stripping in sanitizeString
 * - SEC-03: Honesty disclosure copy and on-demand speech in VerifiedBanner
 * - SEC-05: clearHash history replaceState without loc.hash = '' trailing hash
 * - SEC-07: Inverted bar coordinates normalization in validateShareScene
 * - SEC-08: shareUrl safe origin handling and fallback
 * - SEC-10: Capped facts array size (max 50)
 * - Prototype-key IDs: '__proto__', 'constructor', 'prototype', 'title' prefixing
 * - Deep nesting: Nesting depth limit guarding call stack
 * - NaN / -0: Sanitization of NaN, Infinity, and normalization of -0 to 0
 * - ID duplicates: Deduplication across scene elements
 * - Note spoofing: Leading checkmark stripping and <bdi> isolation
 */

import LZString from 'lz-string';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { VerifiedBanner } from '../src/components/VerifiedBanner';
import type { DiagramScene } from '../src/core/scene';
import { clearHash } from '../src/drivers/hashRoute';
import { t } from '../src/i18n';
import {
  decodeShare,
  LIMITS,
  sanitizeString,
  shareUrl,
  validateShareScene,
} from '../src/share';

const validBaseScene: DiagramScene = {
  version: 1,
  kind: 'geometry',
  points: [
    { id: 'p1', x: 0.2, y: 0.2, label: 'P1' },
    { id: 'p2', x: 0.8, y: 0.8, label: 'P2' },
  ],
  segments: [{ id: 's1', a: 'p1', b: 'p2', label: 'S1' }],
  polylines: [],
  bars: [],
};

describe('Lane f2-fix-share Regression Suite', () => {
  describe('SEC-01: Fragment measurement for pre-decompression size cap', () => {
    it('does not reject a 11,990 character raw payload wrapped in full origin URL as too-large', () => {
      const rawPayload = 'A'.repeat(11990);
      const fullUrl = `https://ghost-touch.org/#s=${rawPayload}`;
      // Total URL length is 12,016 > 12,000, but raw is 11,990 <= 12,000.
      // Must throw 'bad-format' (because 'AAAA...' is invalid compressed LZ-string), NOT 'too-large'.
      expect(() => decodeShare(fullUrl)).toThrowError(
        expect.objectContaining({ code: 'bad-format' }),
      );
    });

    it('rejects payload if raw fragment itself exceeds LIMITS.maxHashChars', () => {
      const rawOversized = 'A'.repeat(LIMITS.maxHashChars + 1);
      const fullUrl = `https://ghost-touch.org/#s=${rawOversized}`;
      expect(() => decodeShare(fullUrl)).toThrowError(
        expect.objectContaining({ code: 'too-large' }),
      );
    });
  });

  describe('SEC-02: Unicode Bidi & Zero-Width Sanitization', () => {
    it('strips RTL overrides, isolates, and bidi marks from strings', () => {
      const malicious = 'Dr. Rao\u202E ]Ministry of Education[\u2066Dept\u200E\u200F';
      const sanitized = sanitizeString(malicious, 100);
      expect(sanitized).toBe('Dr. Rao ]Ministry of Education[Dept');
      expect(sanitized).not.toMatch(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/);
    });

    it('strips zero-width space and BOM', () => {
      const hidden = 'Secret\u200B\uFEFFToken';
      const sanitized = sanitizeString(hidden, 50);
      expect(sanitized).toBe('SecretToken');
    });

    it('strips C1 control characters (0x80 - 0x9F)', () => {
      const c1String = 'Admin\u0080\u009FUser';
      const sanitized = sanitizeString(c1String, 50);
      expect(sanitized).toBe('AdminUser');
    });
  });

  describe('SEC-03: Honesty Disclosure in VerifiedBanner', () => {
    it('renders the honesty disclosure notice in the student banner area', () => {
      const html = renderToStaticMarkup(createElement(VerifiedBanner, { by: 'Teacher' }));
      expect(html).toContain('not cryptographic proof');
      expect(html).toContain(t('share.honesty'));
      expect(html).toContain('role="note"');
    });

    it('isolates teacher name and note with <bdi> elements', () => {
      const html = renderToStaticMarkup(
        createElement(VerifiedBanner, {
          by: 'Arabic Name \u0639\u0644\u064a',
          note: 'Study carefully',
        }),
      );
      expect(html).toContain('<bdi');
      expect(html).toContain('gt-verified-banner__name');
    });

    it('strips leading checkmark spoofing symbols from notes', () => {
      const spoofedNote = '✓ Officially Verified by Exam Board';
      const sanitized = sanitizeString(spoofedNote, LIMITS.maxNote, true);
      expect(sanitized).not.toContain('✓');
      expect(sanitized.trim()).toBe('Officially Verified by Exam Board');
    });
  });

  describe('SEC-05: clearHash History & Trailing Hash', () => {
    it('clears hash cleanly via replaceState without re-assigning loc.hash', () => {
      const replaceStateSpy = vi.fn();
      const mockLocation = {
        pathname: '/explore',
        search: '',
        hash: '#s=testpayload',
      };

      const originalWindow = (globalThis as Record<string, unknown>).window;
      const originalHistory = (globalThis as Record<string, unknown>).history;

      try {
        (globalThis as Record<string, unknown>).window = {
          location: mockLocation,
          dispatchEvent: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        };
        (globalThis as Record<string, unknown>).history = {
          replaceState: replaceStateSpy,
        };

        clearHash();

        expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/explore');
        // loc.hash must not have been set to '' (which would leave '#')
        expect(mockLocation.hash).toBe('#s=testpayload');
      } finally {
        (globalThis as Record<string, unknown>).window = originalWindow;
        (globalThis as Record<string, unknown>).history = originalHistory;
      }
    });
  });

  describe('SEC-07: Inverted Bar Coordinates Normalization', () => {
    it('normalizes x0 > x1 and y_top > y_base so bars are always touch-hittable', () => {
      const invertedScene = {
        version: 1,
        kind: 'bar_chart',
        bars: [
          {
            id: 'b1',
            label: 'Inverted',
            value: 25,
            x0: 0.8,
            x1: 0.2, // x0 > x1
            y_top: 0.9,
            y_base: 0.1, // y_top > y_base
          },
        ],
      };

      const res = validateShareScene(invertedScene);
      expect(res.ok).toBe(true);
      if (res.ok) {
        const bar = res.scene.bars?.[0];
        expect(bar).toBeDefined();
        expect(bar?.x0).toBe(0.2);
        expect(bar?.x1).toBe(0.8);
        expect(bar?.y_top).toBe(0.1);
        expect(bar?.y_base).toBe(0.9);
      }
    });
  });

  describe('SEC-08: shareUrl Origin Handling', () => {
    it('preserves valid http and https origins without trailing slashes', () => {
      expect(shareUrl('https://ghost-touch.org/', 'enc123')).toBe(
        'https://ghost-touch.org/#s=enc123',
      );
      expect(shareUrl('http://localhost:5173', 'enc123')).toBe(
        'http://localhost:5173/#s=enc123',
      );
    });

    it('falls back safely to https://ghosttouch.app when origin is "null"', () => {
      expect(shareUrl('null', 'enc123')).toBe('https://ghosttouch.app/#s=enc123');
    });

    it('falls back safely when origin is empty or has invalid protocol', () => {
      expect(shareUrl('', 'enc123')).toBe('https://ghosttouch.app/#s=enc123');
      expect(shareUrl('javascript:alert(1)', 'enc123')).toBe(
        'https://ghosttouch.app/#s=enc123',
      );
      expect(shareUrl('file:///path/to/app', 'enc123')).toBe(
        'https://ghosttouch.app/#s=enc123',
      );
      expect(shareUrl('//evil.com', 'enc123')).toBe('https://ghosttouch.app/#s=enc123');
    });
  });

  describe('SEC-10: Facts Array Cap', () => {
    it('caps facts array to at most 50 entries', () => {
      const sceneWithExcessiveFacts = {
        ...validBaseScene,
        facts: Array.from({ length: 120 }, (_, i) => `Fact item #${i + 1}`),
      };

      const res = validateShareScene(sceneWithExcessiveFacts);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.scene.facts?.length).toBe(50);
        expect(res.scene.facts?.[0]).toBe('Fact item #1');
        expect(res.scene.facts?.[49]).toBe('Fact item #50');
      }
    });
  });

  describe('Prototype-Key and Reserved IDs', () => {
    it('prefixes reserved prototype IDs like __proto__, constructor, prototype, title', () => {
      const sceneWithReservedIds = {
        version: 1,
        kind: 'geometry',
        points: [
          { id: '__proto__', x: 0.1, y: 0.1 },
          { id: 'constructor', x: 0.2, y: 0.2 },
          { id: 'title', x: 0.3, y: 0.3 },
          { id: 'prototype', x: 0.4, y: 0.4 },
        ],
        segments: [
          { id: 's1', a: '__proto__', b: 'constructor' },
        ],
      };

      const res = validateShareScene(sceneWithReservedIds);
      expect(res.ok).toBe(true);
      if (res.ok) {
        const pointIds = res.scene.points?.map((p) => p.id);
        expect(pointIds).toContain('el___proto__');
        expect(pointIds).toContain('el_constructor');
        expect(pointIds).toContain('el_title');
        expect(pointIds).toContain('el_prototype');

        // Segments should still connect to the renamed point IDs
        const seg = res.scene.segments?.[0];
        expect(seg?.a).toBe('el___proto__');
        expect(seg?.b).toBe('el_constructor');
      }
    });

    it('deduplicates duplicate element IDs across kinds', () => {
      const sceneWithDuplicates = {
        version: 1,
        kind: 'geometry',
        points: [
          { id: 'item', x: 0.1, y: 0.1 },
          { id: 'item', x: 0.2, y: 0.2 },
        ],
        segments: [
          { id: 'item', a: 'item', b: 'item' },
        ],
      };

      const res = validateShareScene(sceneWithDuplicates);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.scene.points?.[0]?.id).toBe('item');
        expect(res.scene.points?.[1]?.id).toBe('item_2');
        expect(res.scene.segments?.[0]?.id).toBe('item_3');
      }
    });
  });

  describe('Deep Nesting Protection', () => {
    it('rejects JSON payloads exceeding maximum bracket nesting depth', () => {
      // Craft a payload with 40 levels of nested arrays
      const nested = '['.repeat(40) + '1' + ']'.repeat(40);
      const compressed = LZString.compressToEncodedURIComponent(nested);

      expect(() => decodeShare(compressed)).toThrowError(
        expect.objectContaining({ code: 'bad-format' }),
      );
    });
  });

  describe('NaN and -0 Coordinates Handling', () => {
    it('normalizes -0 coordinates to positive 0', () => {
      const sceneWithNegZero = {
        version: 1,
        kind: 'geometry',
        points: [{ id: 'p1', x: -0, y: 0.5 }],
        bars: [{ id: 'b1', label: 'B', value: -0, x0: 0, x1: 0.5, y_top: 0, y_base: 0.5 }],
      };

      const res = validateShareScene(sceneWithNegZero);
      expect(res.ok).toBe(true);
      if (res.ok) {
        const pt = res.scene.points?.[0];
        expect(Object.is(pt?.x, 0)).toBe(true);
        expect(Object.is(pt?.x, -0)).toBe(false);

        const bar = res.scene.bars?.[0];
        expect(Object.is(bar?.value, 0)).toBe(true);
        expect(Object.is(bar?.value, -0)).toBe(false);
      }
    });

    it('rejects NaN and Infinity coordinates gracefully', () => {
      const sceneWithNaN = {
        version: 1,
        kind: 'geometry',
        points: [{ id: 'p1', x: NaN, y: Infinity }],
      };

      const res = validateShareScene(sceneWithNaN);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.errors.some((e) => e.includes('out of range'))).toBe(true);
      }
    });
  });

  describe('verifiedAt ISO 8601 validation', () => {
    it('falls back to valid ISO timestamp when verifiedAt is garbage', () => {
      const json = JSON.stringify({
        v: 1,
        scene: validBaseScene,
        verifiedBy: 'Teacher',
        note: 'Note',
        verifiedAt: 'not-a-valid-date-at-all',
      });
      const encoded = LZString.compressToEncodedURIComponent(json);
      const decoded = decodeShare(encoded);
      expect(Number.isNaN(Date.parse(decoded.verifiedAt))).toBe(false);
    });
  });
});
