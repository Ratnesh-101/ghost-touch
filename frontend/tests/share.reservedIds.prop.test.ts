/**
 * P84 (Kiro, task 40.3, Requirements 24.2-24.3): oracle for lane a1. After the share validator,
 * a scene whose ids mix reserved ids (any case), `el_`-prefixed ids and ordinary ids has no
 * reserved id, unique ids, no dangling segment, the same number of segments, and every segment
 * joins the same two points (matched by position, since ids may be renamed).
 *
 * Expected red until lane a1 rewrites renamed ids without colliding; see docs/reviews/kiro-round6.md.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { RESERVED_ELEMENT_IDS, isReservedId } from '../src/core/correct';
import type { DiagramScene, Point, Segment } from '../src/core/scene';
import { validateShareScene } from '../src/share/validate';

const reservedArb = fc
  .tuple(fc.constantFrom(...RESERVED_ELEMENT_IDS), fc.array(fc.boolean(), { minLength: 20, maxLength: 20 }))
  .map(([id, up]) => [...id].map((ch, i) => (up[i] ? ch.toUpperCase() : ch)).join(''));
const idArb = fc.oneof(
  reservedArb,
  reservedArb.map((r) => `el_${r}`),
  fc.constantFrom('A', 'B', 'C', 'D', 'el_x', 'title_2'),
  // Pairs that collide once the first is renamed `el_…`. Random case alone almost never builds
  // one, so a first version of this property passed on the bug the parity case shows.
  fc.constantFrom('title', 'el_title', 'constructor', 'el_constructor', '__proto__', 'el___proto__', 'el_title_2'),
);

const sceneArb: fc.Arbitrary<DiagramScene> = fc
  .uniqueArray(idArb, { minLength: 2, maxLength: 8 })
  .chain((ids) =>
    fc
      .uniqueArray(
        fc.tuple(fc.nat({ max: ids.length - 1 }), fc.nat({ max: ids.length - 1 })).filter(([a, b]) => a !== b),
        { maxLength: 6, selector: ([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}` },
      )
      .map((pairs): DiagramScene => {
        const points: Point[] = ids.map((id, i) => ({ id, x: (i + 1) / 10, y: ((i * 3) % 7) / 10 }));
        const segments: Segment[] = pairs.map(([a, b], k) => ({ id: `seg${k}`, a: ids[a]!, b: ids[b]! }));
        return { version: 1, kind: 'geometry', points, segments };
      }),
  );

function positionPairs(scene: DiagramScene): string[] {
  const where = new Map((scene.points ?? []).map((p) => [p.id, `${p.x},${p.y}`]));
  return (scene.segments ?? []).map((s) => [where.get(s.a), where.get(s.b)].sort().join(' | ')).sort();
}

describe('P84: the share validator renames reserved ids and keeps every segment (24.2, 24.3)', () => {
  it('no reserved id, unique ids, no dangling segment, same segments (250 runs)', () => {
    fc.assert(
      fc.property(sceneArb, (raw) => {
        const res = validateShareScene(structuredClone(raw));
        expect(res.ok, res.ok ? '' : res.errors.join(' | ')).toBe(true);
        if (!res.ok) return;
        const s = res.scene;
        const ids = [...(s.points ?? []), ...(s.segments ?? [])].map((e) => e.id);
        expect(ids.filter(isReservedId)).toEqual([]);
        expect(new Set(ids).size).toBe(ids.length);
        const pointIds = new Set((s.points ?? []).map((p) => p.id));
        for (const seg of s.segments ?? []) expect(pointIds.has(seg.a) && pointIds.has(seg.b)).toBe(true);
        expect(s.segments).toHaveLength(raw.segments!.length);
        expect(positionPairs(s)).toEqual(positionPairs(raw));
      }),
      { numRuns: 250 },
    );
  });
});
