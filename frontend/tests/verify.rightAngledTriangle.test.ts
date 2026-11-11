/**
 * CORE-A1 (Kiro, K4, Requirement 18.11): "ABC is a right angled triangle" is a statement about the
 * figure, not an angle fact at vertex ABC.
 */
import { describe, expect, it } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import { parseFacts, verifyScene } from '../src/core/verify';

/** Right angle at C, drawn honestly. */
const scene = (facts: string[]): DiagramScene => ({
  version: 1,
  kind: 'geometry',
  points: [
    { id: 'A', x: 0.25, y: 0.25, label: 'A' },
    { id: 'B', x: 0.7, y: 0.85, label: 'B' },
    { id: 'C', x: 0.25, y: 0.85, label: 'C' },
  ],
  segments: [
    { id: 'CA', a: 'C', b: 'A' },
    { id: 'AB', a: 'A', b: 'B' },
    { id: 'BC', a: 'B', b: 'C' },
  ],
  facts,
});

describe('CORE-A1: right-angled triangle phrasing', () => {
  const phrases = [
    'ABC is a right angled triangle',
    'Triangle ABC is a right angled triangle',
    'ABC is a right angle triangle',
    'Triangle ABC is a right-angled triangle',
    'triangle ABC is right-angled',
  ];
  for (const phrase of phrases) {
    it(`"${phrase}" gives no angle fact`, () => {
      expect(parseFacts([phrase]).angles).toEqual([]);
    });
    it(`"${phrase}" with a consistent drawing is not flagged`, () => {
      const r = verifyScene(scene([phrase, 'AC = 4 cm', 'BC = 3 cm']), { mode: 'raw' });
      expect(r.findings).toEqual([]);
      expect(r.status).not.toBe('disagree');
    });
  }

  it('still reads "angle C is a right angle" and "C is a right angle"', () => {
    expect(parseFacts(['angle C is a right angle']).angles[0]).toMatchObject({ vertex: 'C', value: 90 });
    expect(parseFacts(['C is a right angle.']).angles[0]).toMatchObject({ vertex: 'C', value: 90 });
  });
});
