/**
 * Task 20.4 (Kiro, Requirement 11.1, PR #26): `savedTitle` speaks the diagram kind in Hindi and
 * Gujarati, and keeps the raw slug in English and unknown languages. Example tests.
 */
import { describe, expect, it } from 'vitest';
import { KIND_NAMES, savedTitle } from '../src/core/savedDiagrams';
import type { DiagramScene, SceneKind } from '../src/core/scene';

const base = (kind: SceneKind, labels: string[] = [], title: string | null = null): DiagramScene => ({
  version: 1,
  kind,
  title,
  points: labels.map((label, i) => ({ id: `p${i}`, x: 0.1, y: 0.1, label })),
  segments: [],
  polylines: [],
  bars: [],
  axes: null,
});

describe('Task 20.4: savedTitle localized kind names (Req 11.1)', () => {
  it('speaks Hindi kind names', () => {
    expect(savedTitle(base('geometry'), 'hi')).toBe('ज्यामिति');
    expect(savedTitle(base('function_graph'), 'hi')).toBe('फलन ग्राफ़');
    expect(savedTitle(base('bar_chart'), 'hi')).toBe('बार चार्ट');
    expect(savedTitle(base('unknown'), 'hi')).toBe('आरेख');
    expect(savedTitle(base('geometry', ['A', 'B']), 'hi')).toBe('ज्यामिति: A, B');
  });

  it('speaks Gujarati kind names', () => {
    expect(savedTitle(base('geometry'), 'gu')).toBe('ભૂમિતિ');
    expect(savedTitle(base('function_graph'), 'gu')).toBe('વિધેય આલેખ');
    expect(savedTitle(base('bar_chart'), 'gu')).toBe('સ્તંભ આલેખ');
    expect(savedTitle(base('unknown'), 'gu')).toBe('આકૃતિ');
    expect(savedTitle(base('bar_chart', ['X']), 'gu')).toBe('સ્તંભ આલેખ: X');
  });

  it('keeps the raw kind for en, unrecognized languages and prototype names', () => {
    expect(savedTitle(base('geometry'), 'en')).toBe('geometry');
    expect(savedTitle(base('geometry'), 'fr')).toBe('geometry');
    expect(savedTitle(base('geometry'))).toBe('geometry');
    for (const lang of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      expect(savedTitle(base('bar_chart', ['X']), lang)).toBe('bar_chart: X');
    }
  });

  it('a real title wins in every language', () => {
    for (const lang of ['en', 'hi', 'gu']) expect(savedTitle(base('geometry', ['A'], '  Triangle  '), lang)).toBe('Triangle');
  });

  it('every kind has a non-blank name in hi and gu that is not the English slug', () => {
    for (const lang of ['hi', 'gu']) {
      for (const kind of ['geometry', 'function_graph', 'bar_chart', 'unknown'] as const) {
        const name = KIND_NAMES[lang]![kind]!;
        expect(name.trim().length).toBeGreaterThan(0);
        expect(name).not.toMatch(/[a-z_]/);
      }
    }
  });
});
