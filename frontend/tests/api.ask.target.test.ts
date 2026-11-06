import { describe, expect, it, vi } from 'vitest';
import {
  AskRequestError,
  parseAskResponse,
  parseTarget,
  requestAsk,
  type AskResponse,
  type GuideTarget,
} from '../src/api/ask';
import type { DiagramScene } from '../src/core/scene';

const dummyScene: DiagramScene = {
  kind: 'geometry',
  title: 'Test Triangle',
  points: [
    { id: 'A', x: 0.2, y: 0.2, label: 'Point A' },
    { id: 'B', x: 0.8, y: 0.8, label: 'Point B' },
  ],
  segments: [{ id: 'AB', a: 'A', b: 'B' }],
  facts: [],
};

describe('parseTarget', () => {
  it('parses valid element targets', () => {
    const target = parseTarget({ elementId: 'A' });
    expect(target).toEqual<GuideTarget>({ kind: 'element', elementId: 'A' });

    const targetTrimmed = parseTarget({ elementId: '  seg_123  ' });
    expect(targetTrimmed).toEqual<GuideTarget>({ kind: 'element', elementId: 'seg_123' });
  });

  it('parses valid point targets within [0, 1]', () => {
    const pt1 = parseTarget({ x: 0.25, y: 0.75 });
    expect(pt1).toEqual<GuideTarget>({ kind: 'point', x: 0.25, y: 0.75 });

    // Exact boundaries
    const origin = parseTarget({ x: 0, y: 0 });
    expect(origin).toEqual<GuideTarget>({ kind: 'point', x: 0, y: 0 });

    const corner = parseTarget({ x: 1, y: 1 });
    expect(corner).toEqual<GuideTarget>({ kind: 'point', x: 1, y: 1 });
  });

  it('returns undefined for out-of-range point coordinates', () => {
    expect(parseTarget({ x: -0.01, y: 0.5 })).toBeUndefined();
    expect(parseTarget({ x: 1.01, y: 0.5 })).toBeUndefined();
    expect(parseTarget({ x: 0.5, y: -0.01 })).toBeUndefined();
    expect(parseTarget({ x: 0.5, y: 1.01 })).toBeUndefined();
  });

  it('returns undefined for non-finite coordinates', () => {
    expect(parseTarget({ x: Number.NaN, y: 0.5 })).toBeUndefined();
    expect(parseTarget({ x: 0.5, y: Number.NaN })).toBeUndefined();
    expect(parseTarget({ x: Number.POSITIVE_INFINITY, y: 0.5 })).toBeUndefined();
    expect(parseTarget({ x: 0.5, y: Number.NEGATIVE_INFINITY })).toBeUndefined();
  });

  it('returns undefined for empty or invalid elementId', () => {
    expect(parseTarget({ elementId: '' })).toBeUndefined();
    expect(parseTarget({ elementId: '   ' })).toBeUndefined();
    expect(parseTarget({ elementId: 123 })).toBeUndefined();
    expect(parseTarget({ elementId: null })).toBeUndefined();
    expect(parseTarget({ elementId: {} })).toBeUndefined();
  });

  it('returns undefined for incomplete point objects or wrong types', () => {
    expect(parseTarget({ x: 0.5 })).toBeUndefined();
    expect(parseTarget({ y: 0.5 })).toBeUndefined();
    expect(parseTarget({ x: '0.5', y: 0.5 })).toBeUndefined();
    expect(parseTarget({ x: 0.5, y: '0.5' })).toBeUndefined();
    expect(parseTarget({ x: true, y: false })).toBeUndefined();
  });

  it('returns undefined for arbitrary junk without throwing', () => {
    expect(parseTarget(null)).toBeUndefined();
    expect(parseTarget(undefined)).toBeUndefined();
    expect(parseTarget('just a string')).toBeUndefined();
    expect(parseTarget(12345)).toBeUndefined();
    expect(parseTarget(true)).toBeUndefined();
    expect(parseTarget([])).toBeUndefined();
    expect(parseTarget(['A'])).toBeUndefined();
    expect(parseTarget({})).toBeUndefined();
    expect(parseTarget({ foo: 'bar', baz: 42 })).toBeUndefined();
    expect(parseTarget({ target: { elementId: 'nested' } })).toBeUndefined();
  });
});

describe('parseAskResponse with target', () => {
  it('includes parsed element target when present', () => {
    const resp: AskResponse = parseAskResponse({
      answer: 'Point A is at the top left.',
      source: 'ai',
      target: { elementId: 'A' },
    });
    expect(resp).toEqual({
      answer: 'Point A is at the top left.',
      source: 'ai',
      target: { kind: 'element', elementId: 'A' },
    });
  });

  it('includes parsed point target when present', () => {
    const resp: AskResponse = parseAskResponse({
      answer: 'Here is the center.',
      source: 'ai',
      target: { x: 0.5, y: 0.5 },
    });
    expect(resp).toEqual({
      answer: 'Here is the center.',
      source: 'ai',
      target: { kind: 'point', x: 0.5, y: 0.5 },
    });
  });

  it('omits target when target is null, undefined, or missing', () => {
    const respNull = parseAskResponse({
      answer: 'AB is 5 cm.',
      source: 'facts',
      target: null,
    });
    expect(respNull.target).toBeUndefined();
    expect(respNull).toEqual({
      answer: 'AB is 5 cm.',
      source: 'facts',
    });

    const respMissing = parseAskResponse({
      answer: "I don't know from this diagram.",
      source: 'unknown',
    });
    expect(respMissing.target).toBeUndefined();
  });

  it('tolerates malformed target junk without throwing', () => {
    const junkTargets = [
      'string',
      123,
      true,
      [],
      {},
      { unknownField: 99 },
      { x: -5, y: 10 },
      { elementId: '' },
      { x: 'not-a-number', y: 0.5 },
    ];

    for (const junk of junkTargets) {
      const resp = parseAskResponse({
        answer: 'Valid answer',
        source: 'ai',
        target: junk,
      });
      expect(resp.answer).toBe('Valid answer');
      expect(resp.source).toBe('ai');
      expect(resp.target).toBeUndefined();
    }
  });

  it('still enforces answer and source shape checks', () => {
    expect(() => parseAskResponse({ target: { elementId: 'A' } })).toThrow(AskRequestError);
    expect(() =>
      parseAskResponse({ answer: 123, source: 'ai', target: { elementId: 'A' } }),
    ).toThrow(AskRequestError);
    expect(() =>
      parseAskResponse({ answer: 'Valid', source: 'bad-source', target: { elementId: 'A' } }),
    ).toThrow(AskRequestError);
  });
});

describe('requestAsk with target', () => {
  it('delivers target to caller when server returns it', async () => {
    const fakeFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          answer: 'Point A is at the top left.',
          source: 'ai',
          target: { elementId: 'A' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const res = await requestAsk(dummyScene, 'Where is point A?', 'en', {
      baseUrl: 'https://api.test',
      fetchImpl: fakeFetch,
    });

    expect(res).toEqual<AskResponse>({
      answer: 'Point A is at the top left.',
      source: 'ai',
      target: { kind: 'element', elementId: 'A' },
    });
  });

  it('tolerates bad server target and delivers response without target', async () => {
    const fakeFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          answer: 'Point A is at the top left.',
          source: 'ai',
          target: { x: 999, y: -50 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const res = await requestAsk(dummyScene, 'Where is point A?', 'en', {
      baseUrl: 'https://api.test',
      fetchImpl: fakeFetch,
    });

    expect(res.answer).toBe('Point A is at the top left.');
    expect(res.source).toBe('ai');
    expect(res.target).toBeUndefined();
  });
});
