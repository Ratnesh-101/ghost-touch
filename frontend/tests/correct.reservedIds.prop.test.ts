/**
 * P79 (Kiro, task 39.1, Requirement 23.1-23.3): reserved ids are never given to an element.
 * Audit r5-kiro-glue HIGH: `addPoint(scene, x, y, label, 'title')` made a point whose later rename
 * changed the scene title.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  RESERVED_ELEMENT_IDS,
  addPoint,
  addSegment,
  isReservedId,
  renameLabel,
  validateSceneInvariants,
} from '../src/core/correct';
import type { DiagramScene } from '../src/core/scene';
import { validateShareScene } from '../src/share/validate';

const RUNS = { numRuns: 250 };
const RESERVED = [...RESERVED_ELEMENT_IDS];

/** A reserved id written in random case, with random spaces around it. */
const reservedArb = fc
  .tuple(fc.constantFrom(...RESERVED), fc.array(fc.boolean(), { minLength: 20, maxLength: 20 }), fc.constantFrom('', ' ', '  '), fc.constantFrom('', ' '))
  .map(([id, upper, pre, post]) => pre + [...id].map((ch, i) => (upper[i] ? ch.toUpperCase() : ch)).join('') + post);

const sceneArb: fc.Arbitrary<DiagramScene> = fc
  .uniqueArray(fc.string({ minLength: 1, maxLength: 3 }), { minLength: 1, maxLength: 8 })
  .map((ids) => ({
    version: 1,
    kind: 'geometry',
    title: 'Triangle',
    points: ids.map((id, i) => ({ id, x: (i + 1) / 10, y: (i + 1) / 20 })),
    segments: [],
  }));

describe('P79: reserved ids are never used (23.1-23.3)', () => {
  it('the list is the one the audit names, lower case', () => {
    for (const id of ['title', 'scene:title', '__proto__', 'constructor', 'prototype']) {
      expect(RESERVED_ELEMENT_IDS.has(id)).toBe(true);
    }
    for (const id of RESERVED) expect(id).toBe(id.toLowerCase());
    expect(isReservedId('  TiTlE ')).toBe(true);
    expect(isReservedId('titles')).toBe(false);
  });

  it('addPoint ignores a reserved requested id and the scene stays valid', () => {
    fc.assert(
      fc.property(sceneArb, reservedArb, fc.option(fc.string({ maxLength: 4 }), { nil: undefined }), (scene, id, label) => {
        const next = addPoint(scene, 0.55, 0.45, label, id);
        const added = next.points!.at(-1)!;
        expect(isReservedId(added.id)).toBe(false);
        expect(validateSceneInvariants(next).ok).toBe(true);
        // Renaming the new point renames the point, never the title.
        const renamed = renameLabel(next, added.id, 'Top');
        expect(renamed.title).toBe('Triangle');
        expect(renamed.points!.at(-1)!.label).toBe('Top');
      }),
      RUNS,
    );
  });

  it('addSegment ignores a reserved requested id, and never generates one', () => {
    fc.assert(
      fc.property(reservedArb, fc.nat({ max: 8 }), fc.option(reservedArb, { nil: undefined }), (reserved, cut, requested) => {
        // Two point ids whose concatenation is a reserved id ("ti" + "tle" = "title").
        const r = reserved.trim();
        const k = 1 + (cut % Math.max(1, r.length - 1));
        const a = r.slice(0, k);
        const b = r.slice(k);
        fc.pre(a !== '' && b !== '' && a !== b && !isReservedId(a) && !isReservedId(b));
        const scene: DiagramScene = {
          version: 1,
          kind: 'geometry',
          points: [
            { id: a, x: 0.1, y: 0.1 },
            { id: b, x: 0.9, y: 0.9 },
          ],
          segments: [],
        };
        const next = addSegment(scene, a, b, requested);
        const seg = next.segments!.at(-1)!;
        expect(isReservedId(seg.id)).toBe(false);
        expect(validateSceneInvariants(next).ok).toBe(true);
      }),
      RUNS,
    );
  });

  it('validateSceneInvariants rejects a scene that already holds a reserved id, of any kind', () => {
    fc.assert(
      fc.property(reservedArb, fc.constantFrom('point', 'segment', 'polyline', 'bar'), (id, kind) => {
        const scene: DiagramScene = {
          version: 1,
          kind: 'geometry',
          points: [
            { id: 'A', x: 0.1, y: 0.1 },
            { id: 'B', x: 0.9, y: 0.9 },
          ],
          segments: [],
          polylines: [],
          bars: [],
        };
        if (kind === 'point') scene.points!.push({ id, x: 0.5, y: 0.5 });
        if (kind === 'segment') scene.segments!.push({ id, a: 'A', b: 'B' });
        if (kind === 'polyline') scene.polylines!.push({ id, points: [[0, 0], [1, 1]] });
        if (kind === 'bar') scene.bars!.push({ id, label: 'x', value: 1, x0: 0, x1: 0.1, y_top: 0.2, y_base: 0.9 });
        const res = validateSceneInvariants(scene);
        expect(res.ok).toBe(false);
        expect(res.errors.some((e) => e.startsWith('Reserved ID'))).toBe(true);
      }),
      RUNS,
    );
  });

  it('the share validator still accepts such a scene by renaming the id, endpoints included', () => {
    const scene = {
      version: 1,
      kind: 'geometry',
      points: [
        { id: 'title', x: 0.5, y: 0.2 },
        { id: 'B', x: 0.9, y: 0.9 },
      ],
      segments: [{ id: 'titleB', a: 'title', b: 'B' }],
    };
    const res = validateShareScene(scene);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.scene.points!.map((p) => p.id)).toEqual(['el_title', 'B']);
      expect(res.scene.segments).toEqual([{ id: 'titleB', a: 'el_title', b: 'B' }]);
    }
  });
});
