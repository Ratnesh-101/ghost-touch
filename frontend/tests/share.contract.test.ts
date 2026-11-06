/**
 * Contract tests for Share feature.
 *
 * Verifies all hostile inputs, QR helper, format requirements, and security limits.
 * Contract: docs/briefs/guide-share-contract.md § Share contract
 * Lane: docs/briefs/agy-t1-share-codec.md
 */

// @ts-expect-error Node runtime fs in Vitest node environment
import fs from 'node:fs';
import LZString from 'lz-string';
import { describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import {
  decodeShare,
  encodeShare,
  LIMITS,
  qrDataUrl,
  ShareError,
  shareUrl,
} from '../src/share';

// Sample triangle scene
const sampleTriangle: DiagramScene = {
  version: 1,
  kind: 'geometry',
  title: 'Right Triangle',
  points: [
    { id: 'A', x: 0.2, y: 0.2, label: 'A' },
    { id: 'B', x: 0.8, y: 0.8, label: 'B' },
    { id: 'C', x: 0.2, y: 0.8, label: 'C' },
  ],
  segments: [
    { id: 'AB', a: 'A', b: 'B', label: 'AB' },
    { id: 'BC', a: 'B', b: 'C', label: 'BC' },
    { id: 'CA', a: 'C', b: 'A', label: 'CA' },
  ],
  polylines: [],
  bars: [],
};

describe('Share contract and hostile inputs', () => {
  describe('shareUrl helper', () => {
    it('formats URL with #s= prefix correctly', () => {
      const url1 = shareUrl('https://ghosttouch.app', 'test123');
      expect(url1).toBe('https://ghosttouch.app/#s=test123');

      const url2 = shareUrl('https://ghosttouch.app/', 'test123');
      expect(url2).toBe('https://ghosttouch.app/#s=test123');
    });
  });

  describe('Hostile inputs (one test each)', () => {
    it('hostile input 1: empty string throws ShareError(empty)', () => {
      expect(() => decodeShare('')).toThrow(ShareError);
      try {
        decodeShare('');
      } catch (e) {
        expect((e as ShareError).code).toBe('empty');
      }
    });

    it('hostile input 2: #s= throws ShareError(empty)', () => {
      expect(() => decodeShare('#s=')).toThrow(ShareError);
      try {
        decodeShare('#s=');
      } catch (e) {
        expect((e as ShareError).code).toBe('empty');
      }
    });

    it('hostile input 3: garbage throws ShareError(bad-format)', () => {
      expect(() => decodeShare('!!!not-valid-lz-string-at-all!!!')).toThrow(ShareError);
      try {
        decodeShare('!!!not-valid-lz-string-at-all!!!');
      } catch (e) {
        expect((e as ShareError).code).toBe('bad-format');
      }
    });

    it('hostile input 4: truncated payload throws ShareError(bad-format)', () => {
      const encoded = encodeShare({
        v: 1,
        scene: sampleTriangle,
        verifiedBy: 'Teacher',
        note: 'Note',
        verifiedAt: new Date().toISOString(),
      });
      const truncated = encoded.slice(0, Math.floor(encoded.length / 2));
      expect(() => decodeShare(truncated)).toThrow(ShareError);
      try {
        decodeShare(truncated);
      } catch (e) {
        expect((e as ShareError).code).toBe('bad-format');
      }
    });

    it('hostile input 5: wrong version (v:2) throws ShareError(bad-version)', () => {
      const json = JSON.stringify({
        v: 2,
        scene: sampleTriangle,
        verifiedBy: 'Teacher',
        note: 'Note',
        verifiedAt: new Date().toISOString(),
      });
      const encoded = LZString.compressToEncodedURIComponent(json);
      expect(() => decodeShare(encoded)).toThrow(ShareError);
      try {
        decodeShare(encoded);
      } catch (e) {
        expect((e as ShareError).code).toBe('bad-version');
      }
    });

    it('hostile input 6: missing scene throws ShareError(bad-scene)', () => {
      const json = JSON.stringify({
        v: 1,
        verifiedBy: 'Teacher',
        note: 'Note',
        verifiedAt: new Date().toISOString(),
      });
      const encoded = LZString.compressToEncodedURIComponent(json);
      expect(() => decodeShare(encoded)).toThrow(ShareError);
      try {
        decodeShare(encoded);
      } catch (e) {
        expect((e as ShareError).code).toBe('bad-scene');
      }
    });

    it('hostile input 7: oversized hash (> maxHashChars) rejected BEFORE decompress call', () => {
      const decompressSpy = vi.spyOn(LZString, 'decompressFromEncodedURIComponent');
      const oversized = '#s=' + 'x'.repeat(LIMITS.maxHashChars + 5);

      try {
        expect(() => decodeShare(oversized)).toThrow(ShareError);
        expect(decompressSpy).not.toHaveBeenCalled();
      } finally {
        decompressSpy.mockRestore();
      }

      try {
        decodeShare(oversized);
      } catch (e) {
        expect((e as ShareError).code).toBe('too-large');
      }
    });

    it('hostile input 8: zip bomb expanding beyond maxDecompressedChars throws ShareError(too-large)', () => {
      // Craft a payload that compresses small but expands beyond 200,000 characters
      const hugePadding = 'A'.repeat(LIMITS.maxDecompressedChars + 500);
      const bombJson = JSON.stringify({
        v: 1,
        scene: sampleTriangle,
        verifiedBy: 'Teacher',
        note: hugePadding,
        verifiedAt: new Date().toISOString(),
      });
      const bombHash = LZString.compressToEncodedURIComponent(bombJson);
      // Ensure the compressed hash is under maxHashChars
      expect(bombHash.length).toBeLessThan(LIMITS.maxHashChars);

      expect(() => decodeShare(bombHash)).toThrow(ShareError);
      try {
        decodeShare(bombHash);
      } catch (e) {
        expect((e as ShareError).code).toBe('too-large');
      }
    });

    it('hostile input 9: label containing <script>alert(1)</script> kept as inert text, length-capped', () => {
      const scriptLabel = '<script>alert(1)</script>';
      const sceneWithScript: DiagramScene = {
        ...sampleTriangle,
        points: [
          { id: 'p1', x: 0.5, y: 0.5, label: scriptLabel },
        ],
        segments: [],
      };
      const encoded = encodeShare({
        v: 1,
        scene: sceneWithScript,
        verifiedBy: 'Tester',
        note: 'Note',
        verifiedAt: new Date().toISOString(),
      });

      const decoded = decodeShare(encoded);
      expect(decoded.scene.points?.[0]?.label).toBe(scriptLabel);
      expect(decoded.scene.points?.[0]?.label?.length).toBeLessThanOrEqual(LIMITS.maxLabel);
    });

    it('hostile input 10: 10,000-char label is capped to maxLabel', () => {
      const longLabel = 'Z'.repeat(10000);
      const json = JSON.stringify({
        v: 1,
        scene: {
          kind: 'geometry',
          points: [{ id: 'p1', x: 0.5, y: 0.5, label: longLabel }],
        },
        verifiedBy: 'Teacher',
        note: 'Note',
        verifiedAt: new Date().toISOString(),
      });
      const encoded = LZString.compressToEncodedURIComponent(json);
      const decoded = decodeShare(encoded);
      expect(decoded.scene.points?.[0]?.label?.length).toBe(LIMITS.maxLabel);
    });

    it('hostile input 11: control characters are stripped from labels', () => {
      const dirtyLabel = 'Point\x00\x07\x1F\x08A';
      const json = JSON.stringify({
        v: 1,
        scene: {
          kind: 'geometry',
          points: [{ id: 'p1', x: 0.5, y: 0.5, label: dirtyLabel }],
        },
        verifiedBy: 'Teacher\x00\x07',
        note: 'Note\x00\x07',
        verifiedAt: new Date().toISOString(),
      });
      const encoded = LZString.compressToEncodedURIComponent(json);
      const decoded = decodeShare(encoded);
      expect(decoded.scene.points?.[0]?.label).toBe('PointA');
      expect(decoded.verifiedBy).toBe('Teacher');
      expect(decoded.note).toBe('Note');
    });

    it('hostile input 12: scene with coordinates 5.0 is rejected with ShareError(bad-scene)', () => {
      const json = JSON.stringify({
        v: 1,
        scene: {
          kind: 'geometry',
          points: [{ id: 'p1', x: 5.0, y: 0.5 }],
        },
        verifiedBy: 'Teacher',
        note: 'Note',
        verifiedAt: new Date().toISOString(),
      });
      const encoded = LZString.compressToEncodedURIComponent(json);
      expect(() => decodeShare(encoded)).toThrow(ShareError);
      try {
        decodeShare(encoded);
      } catch (e) {
        expect((e as ShareError).code).toBe('bad-scene');
      }
    });

    it('hostile input 13: dangling segment is dropped while valid segments remain', () => {
      const json = JSON.stringify({
        v: 1,
        scene: {
          kind: 'geometry',
          points: [
            { id: 'A', x: 0.2, y: 0.2 },
            { id: 'B', x: 0.8, y: 0.8 },
          ],
          segments: [
            { id: 'AB', a: 'A', b: 'B' },
            { id: 'dangling', a: 'A', b: 'NON_EXISTENT_POINT' },
          ],
        },
        verifiedBy: 'Teacher',
        note: 'Note',
        verifiedAt: new Date().toISOString(),
      });
      const encoded = LZString.compressToEncodedURIComponent(json);
      const decoded = decodeShare(encoded);
      expect(decoded.scene.segments?.length).toBe(1);
      expect(decoded.scene.segments?.[0]?.id).toBe('AB');
    });

    it('hostile input 14: valid-but-huge scene (>300 points) is rejected with ShareError(bad-scene)', () => {
      const points = Array.from({ length: 301 }, (_, i) => ({
        id: `p_${i}`,
        x: (i % 100) / 100,
        y: Math.floor(i / 100) / 10,
      }));
      const json = JSON.stringify({
        v: 1,
        scene: {
          kind: 'geometry',
          points,
        },
        verifiedBy: 'Teacher',
        note: 'Note',
        verifiedAt: new Date().toISOString(),
      });
      const encoded = LZString.compressToEncodedURIComponent(json);
      expect(() => decodeShare(encoded)).toThrow(ShareError);
      try {
        decodeShare(encoded);
      } catch (e) {
        expect((e as ShareError).code).toBe('bad-scene');
      }
    });

    it('hostile input 15: prototype pollution key __proto__ in JSON does not pollute Object prototype', () => {
      const json = JSON.stringify({
        __proto__: { polluted: 'danger' },
        v: 1,
        scene: sampleTriangle,
        verifiedBy: 'Teacher',
        note: 'Note',
        verifiedAt: new Date().toISOString(),
      });
      const encoded = LZString.compressToEncodedURIComponent(json);
      decodeShare(encoded);
      // Verify global Object.prototype is unpolluted
      const checkObj: Record<string, unknown> = {};
      expect(checkObj['polluted']).toBeUndefined();
      expect(Object.prototype.hasOwnProperty('polluted')).toBe(false);
    });
  });

  describe('QR Data URL Helper', () => {
    it('returns a data:image/ URL for a short URL', async () => {
      const url = 'https://ghosttouch.app/#s=test12345';
      const result = await qrDataUrl(url);
      expect(result).not.toBeNull();
      expect(result).toMatch(/^data:image\/png;base64,/);
    });

    it('returns null when URL exceeds qrMaxUrlChars', async () => {
      const longUrl = 'https://ghosttouch.app/#s=' + 'A'.repeat(LIMITS.qrMaxUrlChars + 1);
      const result = await qrDataUrl(longUrl);
      expect(result).toBeNull();
    });

    it('returns null for empty string or invalid input', async () => {
      expect(await qrDataUrl('')).toBeNull();
      // @ts-expect-error Testing invalid runtime input
      expect(await qrDataUrl(null)).toBeNull();
    });
  });

  describe('Pure architecture constraint', () => {
    it('share modules contain no React, window, or document references', () => {
      const files = ['limits.ts', 'validate.ts', 'codec.ts', 'index.ts'];

      for (const file of files) {
        const fileUrl = new URL(`../src/share/${file}`, import.meta.url);
        const content = fs.readFileSync(fileUrl, 'utf-8');
        expect(content).not.toMatch(/\bwindow\b/);
        expect(content).not.toMatch(/\bdocument\b/);
        expect(content).not.toMatch(/from\s+['"]react['"]/);
      }
    });
  });
});
