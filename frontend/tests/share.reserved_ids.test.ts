/**
 * Tests for reserved element ID handling in frontend/src/share/validate.ts (Lane a1-reserved-ids).
 *
 * Requirements:
 * 1. A shared scene with a point 'title' and a segment 'title'-'B' keeps the segment
 *    after validateShareScene, with endpoints renamed consistently (a: 'el_title', b: 'B').
 * 2. Case variations and surrounding spaces in reserved point IDs are handled cleanly.
 * 3. The verdict (accept / reject) is unchanged for all cases in Kiro's parity fixture.
 */

import { describe, expect, it } from 'vitest';
import parity from '../../backend/fixtures/validator_parity.json';
import { validateShareScene } from '../src/share/validate';

interface Verdict {
  verdict: 'accept' | 'reject';
  reason?: string;
}

interface ParityCase {
  name: string;
  note: string;
  scene: unknown;
  expected: Verdict;
  known_mismatch?: boolean;
  backend?: Verdict;
  frontend?: Verdict;
}

const CASES = (parity as { cases: ParityCase[] }).cases;

const REASONS: readonly [RegExp, string][] = [
  [/Points count \d+ exceeds/, 'too_many_points'],
  [/Bars count \d+ exceeds/, 'too_many_bars'],
  [/must have at least 2 coordinate pairs/, 'polyline_too_short'],
  [/out of range \[0, 1\]/, 'coord_out_of_range'],
  [/missing valid id/, 'empty_id'],
  [/Unsupported scene version/, 'bad_version'],
  [/Invalid scene kind/, 'invalid_kind'],
  [/no drawable elements/, 'no_drawable'],
];

function reasonOf(errors: readonly string[]): string {
  const text = errors.join('\n');
  for (const [pattern, key] of REASONS) {
    if (pattern.test(text)) return key;
  }
  return `unclassified: ${text.slice(0, 200)}`;
}

describe('share validator: reserved element IDs (Lane a1-reserved-ids)', () => {
  it('keeps segment connecting point "title" and "B" with consistent endpoint rename', () => {
    const rawScene = {
      version: 1,
      kind: 'geometry',
      points: [
        { id: 'title', x: 0.2, y: 0.2, label: 'Apex' },
        { id: 'B', x: 0.8, y: 0.8, label: 'Base' },
      ],
      segments: [
        { id: 'S1', a: 'title', b: 'B', label: 'hypotenuse' },
      ],
    };

    const result = validateShareScene(rawScene);
    expect(result.ok, result.ok ? '' : result.errors.join(' | ')).toBe(true);
    if (!result.ok) return;

    const { scene } = result;

    // Point 'title' must be renamed to 'el_title'
    const pointIds = scene.points?.map((p) => p.id) ?? [];
    expect(pointIds).not.toContain('title');
    expect(pointIds).toContain('el_title');
    expect(pointIds).toContain('B');

    // Segment 'S1' must NOT be dropped as dangling
    expect(scene.segments).toHaveLength(1);
    const seg = scene.segments?.[0];
    expect(seg).toBeDefined();
    if (!seg) throw new Error('missing segment');
    expect(seg.id).toBe('S1');
    expect(seg.a).toBe('el_title');
    expect(seg.b).toBe('B');
    expect(seg.label).toBe('hypotenuse');
  });

  it('handles case-insensitivity and surrounding whitespace in point and segment references', () => {
    const rawScene = {
      version: 1,
      kind: 'geometry',
      points: [
        { id: '   TITLE   ', x: 0.1, y: 0.1 },
        { id: 'Constructor', x: 0.4, y: 0.4 },
        { id: 'P3', x: 0.9, y: 0.9 },
      ],
      segments: [
        { id: 'S1', a: 'TITLE', b: 'Constructor' },
        { id: 'S2', a: '  title  ', b: 'P3' },
      ],
    };

    const result = validateShareScene(rawScene);
    expect(result.ok, result.ok ? '' : result.errors.join(' | ')).toBe(true);
    if (!result.ok) return;

    const { scene } = result;
    const ptIds = new Set(scene.points?.map((p) => p.id));

    expect(scene.segments).toHaveLength(2);
    for (const seg of scene.segments!) {
      expect(ptIds.has(seg.a)).toBe(true);
      expect(ptIds.has(seg.b)).toBe(true);
    }
  });

  it('renames other reserved prototype keys without dropping segments', () => {
    const reservedIds = [
      '__proto__',
      'prototype',
      'tostring',
      'valueof',
      'hasownproperty',
      'isprototypeof',
      'propertyisenumerable',
      'tolocalestring',
      'scene:title',
    ];

    for (const reserved of reservedIds) {
      const rawScene = {
        version: 1,
        kind: 'geometry',
        points: [
          { id: reserved, x: 0.2, y: 0.2 },
          { id: 'B', x: 0.8, y: 0.8 },
        ],
        segments: [
          { id: `seg_${reserved}`, a: reserved, b: 'B' },
        ],
      };

      const result = validateShareScene(rawScene);
      expect(result.ok, `${reserved}: ${result.ok ? '' : result.errors.join(' | ')}`).toBe(true);
      if (!result.ok) continue;

      const { scene } = result;
      expect(scene.segments).toHaveLength(1);
      const seg = scene.segments?.[0];
      expect(seg).toBeDefined();
      if (!seg) throw new Error('missing segment');
      expect(seg.a).toBe(`el_${reserved}`);
      expect(seg.b).toBe('B');
    }
  });

  it('drops dangling segment if reserved endpoint references a non-existent point', () => {
    const rawScene = {
      version: 1,
      kind: 'geometry',
      points: [
        { id: 'A', x: 0.1, y: 0.1 },
        { id: 'B', x: 0.9, y: 0.9 },
      ],
      segments: [
        { id: 'S1', a: 'A', b: 'B' },
        { id: 'S2', a: 'A', b: 'title' }, // point 'title' does not exist
      ],
    };

    const result = validateShareScene(rawScene);
    expect(result.ok, result.ok ? '' : result.errors.join(' | ')).toBe(true);
    if (!result.ok) return;

    expect(result.scene.segments).toHaveLength(1);
    const seg = result.scene.segments?.[0];
    expect(seg).toBeDefined();
    if (!seg) throw new Error('missing segment');
    expect(seg.id).toBe('S1');
  });

  it('connects distinct points when original IDs differ only in case (P84 counterexample)', () => {
    const rawScene = {
      version: 1,
      kind: 'geometry',
      points: [
        { id: 'title', x: 0.1, y: 0.0 },
        { id: 'titlE', x: 0.2, y: 0.3 },
      ],
      segments: [
        { id: 'seg0', a: 'titlE', b: 'title' },
      ],
    };

    const result = validateShareScene(rawScene);
    expect(result.ok, result.ok ? '' : result.errors.join(' | ')).toBe(true);
    if (!result.ok) return;

    const { scene } = result;
    expect(scene.points).toHaveLength(2);
    const p1 = scene.points?.[0];
    const p2 = scene.points?.[1];
    expect(p1).toBeDefined();
    expect(p2).toBeDefined();
    if (!p1 || !p2) throw new Error('missing points');

    expect(p1.id).toBe('el_title');
    expect(p1.x).toBe(0.1);
    expect(p1.y).toBe(0.0);

    expect(p2.id).toBe('el_titlE');
    expect(p2.x).toBe(0.2);
    expect(p2.y).toBe(0.3);

    expect(scene.segments).toHaveLength(1);
    const seg = scene.segments?.[0];
    expect(seg).toBeDefined();
    if (!seg) throw new Error('missing segment');

    expect(seg.id).toBe('seg0');
    expect(seg.a).toBe('el_titlE');
    expect(seg.b).toBe('el_title');
    expect(seg.a).not.toBe(seg.b);

    const ptMap = new Map(scene.points!.map((p) => [p.id, p]));
    const ptA = ptMap.get(seg.a)!;
    const ptB = ptMap.get(seg.b)!;
    expect(`${ptA.x},${ptA.y} | ${ptB.x},${ptB.y}`).toBe('0.2,0.3 | 0.1,0');
  });

  it('connects distinct points when IDs differ only in surrounding whitespace', () => {
    const rawScene = {
      version: 1,
      kind: 'geometry',
      points: [
        { id: '   title   ', x: 0.1, y: 0.0 },
        { id: 'title', x: 0.2, y: 0.3 },
      ],
      segments: [
        { id: 'seg0', a: '   title   ', b: 'title' },
      ],
    };

    const result = validateShareScene(rawScene);
    expect(result.ok, result.ok ? '' : result.errors.join(' | ')).toBe(true);
    if (!result.ok) return;

    const { scene } = result;
    expect(scene.points).toHaveLength(2);
    const p1 = scene.points?.[0];
    const p2 = scene.points?.[1];
    expect(p1).toBeDefined();
    expect(p2).toBeDefined();
    if (!p1 || !p2) throw new Error('missing points');

    expect(p1.id).toBe('el_title');
    expect(p2.id).toBe('el_title_2');

    expect(scene.segments).toHaveLength(1);
    const seg = scene.segments?.[0];
    expect(seg).toBeDefined();
    if (!seg) throw new Error('missing segment');

    expect(seg.a).toBe('el_title');
    expect(seg.b).toBe('el_title_2');
    expect(seg.a).not.toBe(seg.b);

    const ptMap = new Map(scene.points!.map((p) => [p.id, p]));
    const ptA = ptMap.get(seg.a)!;
    const ptB = ptMap.get(seg.b)!;
    expect(`${ptA.x},${ptA.y} | ${ptB.x},${ptB.y}`).toBe('0.1,0 | 0.2,0.3');
  });

  it('preserves endpoint coordinates in parity collision case (reserved_rename_collides)', () => {
    const rawScene = {
      version: 1,
      kind: 'geometry',
      points: [
        { id: 'title', x: 0.2, y: 0.6 },
        { id: 'titlE', x: 0.5, y: 0.2 },
        { id: 'P3', x: 0.9, y: 0.9 },
      ],
      segments: [
        { id: 'S1', a: 'title', b: 'P3' },
      ],
    };

    const result = validateShareScene(rawScene);
    expect(result.ok, result.ok ? '' : result.errors.join(' | ')).toBe(true);
    if (!result.ok) return;

    const { scene } = result;
    expect(scene.segments).toHaveLength(1);
    const seg = scene.segments?.[0];
    expect(seg).toBeDefined();
    if (!seg) throw new Error('missing segment');

    const ptMap = new Map(scene.points!.map((p) => [p.id, p]));
    const ptA = ptMap.get(seg.a)!;
    const ptB = ptMap.get(seg.b)!;
    expect(seg.a).toBe('el_title');
    expect(seg.b).toBe('P3');
    expect(`${ptA.x},${ptA.y} | ${ptB.x},${ptB.y}`).toBe('0.2,0.6 | 0.9,0.9');
  });

  it('verdicts are 100% unchanged for all cases in Kiro parity fixture', () => {
    for (const c of CASES) {
      const want = c.known_mismatch ? c.frontend! : c.expected;
      const result = validateShareScene(structuredClone(c.scene));
      const got = result.ok ? 'accept' : 'reject';
      expect(got, `${c.name}: ${result.ok ? '' : result.errors.join(' | ')}`).toBe(want.verdict);
      if (!result.ok) {
        expect(reasonOf(result.errors), c.name).toBe(want.reason);
      }
    }
  });
});
