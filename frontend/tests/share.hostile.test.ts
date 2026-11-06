/**
 * Hostile inputs and security limit tests for Share feature.
 *
 * Requirements:
 * The brief's acceptance list is mandatory, one test each:
 * 1. empty string
 * 2. #s=
 * 3. garbage
 * 4. truncated payload
 * 5. wrong version
 * 6. missing scene
 * 7. oversized hash rejected BEFORE decompress (spy on lz-string)
 * 8. zip bomb
 * 9. <script> label kept inert
 * 10. 10,000-char label capped
 * 11. control chars stripped
 * 12. coordinates 5.0 rejected
 * 13. dangling segment dropped
 * 14. >300 points rejected
 * 15. __proto__ key
 * 16. qrDataUrl data URL for short and null for long
 *
 * Contract: docs/briefs/guide-share-contract.md § Share contract
 * Lane: docs/briefs/agy-t1-fix.md
 */

import LZString from 'lz-string';
import { describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import {
  decodeShare,
  encodeShare,
  LIMITS,
  qrDataUrl,
  ShareError,
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

describe('Hostile inputs acceptance list (one test each)', () => {
  it('1. empty string throws ShareError(empty)', () => {
    expect(() => decodeShare('')).toThrow(ShareError);
    try {
      decodeShare('');
    } catch (e) {
      expect((e as ShareError).code).toBe('empty');
    }
  });

  it('2. #s= throws ShareError(empty)', () => {
    expect(() => decodeShare('#s=')).toThrow(ShareError);
    try {
      decodeShare('#s=');
    } catch (e) {
      expect((e as ShareError).code).toBe('empty');
    }
  });

  it('3. garbage throws ShareError(bad-format)', () => {
    expect(() => decodeShare('!!!not-valid-lz-string-at-all!!!')).toThrow(ShareError);
    try {
      decodeShare('!!!not-valid-lz-string-at-all!!!');
    } catch (e) {
      expect((e as ShareError).code).toBe('bad-format');
    }
  });

  it('4. truncated payload throws ShareError(bad-format)', () => {
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

  it('5. wrong version (v:2) throws ShareError(bad-version)', () => {
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

  it('6. missing scene throws ShareError(bad-scene)', () => {
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

  it('7. oversized hash rejected BEFORE decompress (spy on lz-string)', () => {
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

  it('8. zip bomb expanding beyond maxDecompressedChars throws ShareError(too-large)', () => {
    const hugePadding = 'A'.repeat(LIMITS.maxDecompressedChars + 500);
    const bombJson = JSON.stringify({
      v: 1,
      scene: sampleTriangle,
      verifiedBy: 'Teacher',
      note: hugePadding,
      verifiedAt: new Date().toISOString(),
    });
    const bombHash = LZString.compressToEncodedURIComponent(bombJson);
    expect(bombHash.length).toBeLessThan(LIMITS.maxHashChars);

    expect(() => decodeShare(bombHash)).toThrow(ShareError);
    try {
      decodeShare(bombHash);
    } catch (e) {
      expect((e as ShareError).code).toBe('too-large');
    }
  });

  it('9. <script> label kept inert and length-capped', () => {
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

  it('10. 10,000-char label capped to maxLabel', () => {
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

  it('11. control chars stripped from labels, verifiedBy, and note', () => {
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

  it('12. coordinates 5.0 rejected with ShareError(bad-scene)', () => {
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

  it('13. dangling segment dropped while valid segments remain', () => {
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

  it('14. >300 points rejected with ShareError(bad-scene)', () => {
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

  it('15. __proto__ key in JSON does not pollute Object prototype', () => {
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
    const checkObj: Record<string, unknown> = {};
    expect(checkObj['polluted']).toBeUndefined();
    expect(Object.prototype.hasOwnProperty('polluted')).toBe(false);
  });

  it('16. qrDataUrl data URL for short and null for long', async () => {
    // Short URL generates a data:image/ PNG URL
    const shortUrl = 'https://ghosttouch.app/#s=test12345';
    const shortResult = await qrDataUrl(shortUrl);
    expect(shortResult).not.toBeNull();
    expect(shortResult).toMatch(/^data:image\/png;base64,/);

    // Long URL (> qrMaxUrlChars) returns null
    const longUrl = 'https://ghosttouch.app/#s=' + 'A'.repeat(LIMITS.qrMaxUrlChars + 1);
    const longResult = await qrDataUrl(longUrl);
    expect(longResult).toBeNull();
  });
});
