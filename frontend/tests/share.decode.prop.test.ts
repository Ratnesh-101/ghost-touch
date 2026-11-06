/**
 * Property-based tests for Share Decoder totality.
 *
 * Requirements:
 * - Property: "decodeShare throws only ShareError for arbitrary strings" (>=200 runs).
 * - Total decode: for ANY arbitrary string (random unicode, random base64, empty, prefixes,
 *   malformed JSON, corrupted compressed data, zip bomb fragments, etc.), decodeShare NEVER throws
 *   any exception other than ShareError with one of the standard ShareErrorCode values.
 *
 * Contract: docs/briefs/guide-share-contract.md § Share contract
 * Lane: docs/briefs/agy-t1-fix.md
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  decodeShare,
  ShareError,
  type ShareErrorCode,
} from '../src/share';

describe('Share decode totality property', () => {
  it('property: decodeShare throws only ShareError for arbitrary strings (>=200 runs)', () => {
    const validErrorCodes: ShareErrorCode[] = [
      'too-large',
      'bad-format',
      'bad-version',
      'bad-scene',
      'empty',
    ];

    const arbHostileString = fc.oneof(
      // Arbitrary raw strings across full unicode range
      fc.string(),
      // Base64-like strings
      fc.base64String(),
      // Hash URL prefixes
      fc.string().map((s) => `#s=${s}`),
      fc.string().map((s) => `https://ghosttouch.app/#s=${s}`),
      fc.string().map((s) => `s=${s}`),
      // Edge-case strings
      fc.constant(''),
      fc.constant('   '),
      fc.constant('#s='),
      fc.constant('{"v":1}'),
      fc.constant('{"v":2}'),
      fc.constant('null'),
      fc.constant('undefined'),
      fc.constant('NaN'),
      fc.constant('[1, 2, 3]'),
      fc.constant('{"__proto__":{"polluted":true}}'),
      // Long strings
      fc.string({ minLength: 12001, maxLength: 20000 }),
    );

    fc.assert(
      fc.property(arbHostileString, (arbitraryStr) => {
        try {
          const result = decodeShare(arbitraryStr);
          // If it decoded successfully, it must have valid payload structure
          expect(result).toBeDefined();
          expect(result.v).toBe(1);
          expect(result.scene).toBeDefined();
          expect(typeof result.verifiedBy).toBe('string');
          expect(typeof result.note).toBe('string');
          expect(typeof result.verifiedAt).toBe('string');
          return true;
        } catch (err) {
          expect(err).toBeInstanceOf(ShareError);
          const shareErr = err as ShareError;
          expect(validErrorCodes).toContain(shareErr.code);
          return true;
        }
      }),
      { numRuns: 300 },
    );
  });
});
