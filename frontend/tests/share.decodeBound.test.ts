/**
 * Decompression-bomb check for share links (task 63).
 *
 * LZ-string decompresses the whole payload before the maxDecompressedChars
 * check in decodeShare. This test builds the worst inputs that still fit in
 * LIMITS.maxHashChars and measures (a) how long decodeShare takes and (b) how
 * large the decompressed string is, then asserts the decode stays bounded.
 */
import { describe, expect, it } from 'vitest';
import LZString from 'lz-string';
import { decodeShare, ShareError } from '../src/share/codec';
import { LIMITS } from '../src/share/limits';

const MB = 1024 * 1024;
const MAX_EXPANSION_CHARS = 2 * MB;
const MAX_DECODE_MS = 250;
// Bisection on repeated "a": 12000 compressed chars expand to 18,999,680 chars (~10 ms).
const MEASURED_CEILING_CHARS = 20_000_000;

interface Pattern {
  name: string;
  unit: string;
}

const PATTERNS: Pattern[] = [
  { name: 'repeated "a"', unit: 'a' },
  { name: 'repeated "["', unit: '[' },
  { name: 'repeated \'{"a":\'', unit: '{"a":' },
];
const SIZES_MB = [1, 5, 20];

interface Case {
  label: string;
  compressed: string;
  expandedChars: number;
}

function build(): { kept: Case[]; skipped: string[] } {
  const kept: Case[] = [];
  const skipped: string[] = [];
  for (const p of PATTERNS) {
    for (const mb of SIZES_MB) {
      const target = mb * MB;
      const input = p.unit.repeat(Math.ceil(target / p.unit.length)).slice(0, target);
      const compressed = LZString.compressToEncodedURIComponent(input);
      const label = `${p.name} x ${mb} MB (compressed ${compressed.length} chars)`;
      if (compressed.length > LIMITS.maxHashChars) {
        skipped.push(label);
        continue;
      }
      const expanded = LZString.decompressFromEncodedURIComponent(compressed);
      kept.push({ label, compressed, expandedChars: expanded ? expanded.length : 0 });
    }
  }
  return { kept, skipped };
}

describe('share decode: decompression bomb bound', () => {
  const { kept, skipped } = build();

  it('builds at least one worst-case input that fits maxHashChars', () => {
    expect(kept.length, `skipped: ${skipped.join('; ')}`).toBeGreaterThan(0);
  });

  for (const c of kept) {
    it(`decodeShare rejects ${c.label} with too-large or bad-format, fast`, () => {
      const t0 = performance.now();
      let error: unknown;
      try {
        decodeShare(c.compressed);
      } catch (e) {
        error = e;
      }
      const ms = performance.now() - t0;
      expect(error).toBeInstanceOf(ShareError);
      expect(['too-large', 'bad-format']).toContain((error as ShareError).code);
      expect(ms, `${c.label}: ${ms.toFixed(1)} ms, expands to ${c.expandedChars} chars`).toBeLessThan(
        MAX_DECODE_MS,
      );
    });

    // MEASURED FINDING (task 63): inputs within maxHashChars DO expand beyond 2 MB.
    // Pin today's ceiling so it cannot get worse; the 2 MB target is the todo below.
    it(`${c.label} stays under the measured ceiling of ${MEASURED_CEILING_CHARS} chars`, () => {
      expect(c.expandedChars).toBeLessThanOrEqual(MEASURED_CEILING_CHARS);
    });
  }

  it('the largest input that fits maxHashChars expands past 2 MB (documents the finding)', () => {
    const worst = Math.max(...kept.map((c) => c.expandedChars));
    expect(worst).toBeGreaterThan(MAX_EXPANSION_CHARS);
  });

  it.todo('no input within maxHashChars expands beyond 2 MB (needs the task 63 fix)');
});
