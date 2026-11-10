/**
 * Kiro's review tests for Spec Ghost (task 29.5, Requirement 18). Written by Kiro after the
 * module (by Antigravity) existed; each block names the criterion it holds the module to.
 *
 * 18.6 aspect   - a wide or tall diagram whose drawing matches its facts is never flagged; x
 *                 distances count `aspect` times, as in the backend Ask (semantic.py).
 * 18.7 units    - lengths in different known units are compared after conversion; an unknown
 *                 unit among differing units means silence.
 * 18.2 wording  - whatever is flagged, the sentence never claims the diagram is right.
 * regression    - the agy regression test is titled "ZERO false disagreements" but never asserted
 *                 the count; this locks it for AI mode, the mode real photos use.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import { verifyScene } from '../src/core/verify';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface RealPoint {
  x: number;
  y: number;
}

/**
 * Build a triangle scene from a REAL triangle (any units), normalised to its bounding box per
 * axis the way a vision model does it, with `aspect` = width / height and facts from the real
 * side lengths.
 */
function sceneFromRealTriangle(
  a: RealPoint,
  b: RealPoint,
  c: RealPoint,
  facts: (len: { AB: number; BC: number; CA: number }) => string[],
): DiagramScene {
  const xs = [a.x, b.x, c.x];
  const ys = [a.y, b.y, c.y];
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX;
  const h = Math.max(...ys) - minY;
  const norm = (p: RealPoint) => ({ x: (p.x - minX) / w, y: (p.y - minY) / h });
  const len = {
    AB: Math.hypot(b.x - a.x, b.y - a.y),
    BC: Math.hypot(c.x - b.x, c.y - b.y),
    CA: Math.hypot(a.x - c.x, a.y - c.y),
  };
  return {
    version: 1,
    kind: 'geometry',
    aspect: w / h,
    points: [
      { id: 'A', ...norm(a), label: 'A' },
      { id: 'B', ...norm(b), label: 'B' },
      { id: 'C', ...norm(c), label: 'C' },
    ],
    segments: [
      { id: 'AB', a: 'A', b: 'B', label: 'AB' },
      { id: 'BC', a: 'B', b: 'C', label: 'BC' },
      { id: 'CA', a: 'C', b: 'A', label: 'CA' },
    ],
    facts: facts(len),
  };
}

/** A 3-4-5 right triangle drawn to scale in the unit square (aspect 1), right angle at B. */
function triangle345(facts: string[]): DiagramScene {
  return {
    version: 1,
    kind: 'geometry',
    points: [
      { id: 'A', x: 0.2, y: 0.2, label: 'A' },
      { id: 'B', x: 0.2, y: 0.8, label: 'B' }, // AB = 0.6 (3)
      { id: 'C', x: 1.0, y: 0.8, label: 'C' }, // BC = 0.8 (4), CA = 1.0 (5)
    ],
    segments: [
      { id: 'AB', a: 'A', b: 'B', label: 'AB' },
      { id: 'BC', a: 'B', b: 'C', label: 'BC' },
      { id: 'CA', a: 'C', b: 'A', label: 'CA' },
    ],
    facts,
  };
}

const MM_PER: Record<string, number> = { mm: 1, cm: 10, m: 1000, km: 1_000_000, in: 25.4, ft: 304.8 };

// ---------------------------------------------------------------------------
// 18.6 aspect
// ---------------------------------------------------------------------------

describe('Requirement 18.6 — measured in the diagram\'s own proportions (aspect)', () => {
  it('an honest wide right triangle (aspect 2) is not flagged', () => {
    // Real triangle 4 wide, 2 tall: AB = 4, AC = 2, BC = sqrt(20).
    const scene = sceneFromRealTriangle({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 2 }, () => [
      'AB = 4 cm',
      'CA = 2 cm',
      'BC = 4.472 cm',
      'angle A = 90 degrees',
    ]);
    expect(scene.aspect).toBe(2);
    const result = verifyScene(scene, { mode: 'sample' });
    expect(result.findings).toEqual([]);
    expect(result.status).toBe('consistent');
  });

  it('a forged side on the same wide triangle is still flagged, and only that side', () => {
    const scene = sceneFromRealTriangle({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 2 }, () => [
      'AB = 4 cm',
      'CA = 7 cm', // forged: the drawing says 2
      'BC = 4.472 cm',
    ]);
    const result = verifyScene(scene, { mode: 'sample' });
    expect(result.status).toBe('disagree');
    expect(result.findings.map((f) => f.segmentId)).toEqual(['CA']);
  });

  it('a right angle that is only right in true proportions is not flagged', () => {
    // Real right angle at A, rotated 30 degrees, in a box that is far from square.
    const r = (deg: number) => (deg * Math.PI) / 180;
    const A = { x: 0, y: 0 };
    const B = { x: 6 * Math.cos(r(30)), y: 6 * Math.sin(r(30)) };
    const C = { x: 2 * Math.cos(r(120)), y: 2 * Math.sin(r(120)) };
    const scene = sceneFromRealTriangle(A, B, C, (len) => [
      `AB = ${len.AB.toFixed(4)} cm`,
      `BC = ${len.BC.toFixed(4)} cm`,
      `CA = ${len.CA.toFixed(4)} cm`,
      'angle A = 90 degrees',
    ]);
    expect(scene.aspect).not.toBeCloseTo(1, 1);
    expect(verifyScene(scene, { mode: 'sample' }).status).toBe('consistent');
  });

  it('P47 with aspect: any real triangle in any box, facts from its real sides, is never flagged (200 runs)', () => {
    const coord = fc.double({ min: -10, max: 10, noNaN: true });
    fc.assert(
      fc.property(coord, coord, coord, coord, coord, coord, (ax, ay, bx, by, cx, cy) => {
        const a = { x: ax, y: ay };
        const b = { x: bx, y: by };
        const c = { x: cx, y: cy };
        const w = Math.max(ax, bx, cx) - Math.min(ax, bx, cx);
        const h = Math.max(ay, by, cy) - Math.min(ay, by, cy);
        // A usable triangle: not degenerate, not a sliver, box not a line.
        const area = Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2;
        const sides = [Math.hypot(bx - ax, by - ay), Math.hypot(cx - bx, cy - by), Math.hypot(ax - cx, ay - cy)];
        fc.pre(w > 0.5 && h > 0.5 && area > 0.5 && Math.min(...sides) > 0.5 && w / h < 8 && h / w < 8);
        const scene = sceneFromRealTriangle(a, b, c, (len) => [
          `AB = ${len.AB.toFixed(4)} cm`,
          `BC = ${len.BC.toFixed(4)} cm`,
          `CA = ${len.CA.toFixed(4)} cm`,
        ]);
        const result = verifyScene(scene, { mode: 'sample' });
        expect(result.findings).toEqual([]);
      }),
      { numRuns: 250 },
    );
  });

  it('an aspect that is missing, zero, negative or not a number counts as 1', () => {
    const honest = triangle345(['AB = 3 cm', 'BC = 4 cm', 'CA = 5 cm']);
    for (const aspect of [undefined, 0, -2, Number.NaN, Infinity]) {
      const scene = { ...honest, aspect } as DiagramScene;
      expect(verifyScene(scene, { mode: 'sample' }).status, String(aspect)).toBe('consistent');
    }
  });
});

// ---------------------------------------------------------------------------
// 18.7 units
// ---------------------------------------------------------------------------

describe('Requirement 18.7 — lengths in different units', () => {
  it('known units are converted before comparing (3 cm, 40 mm, 0.05 m on a 3-4-5 triangle)', () => {
    const result = verifyScene(triangle345(['AB = 3 cm', 'BC = 40 mm', 'CA = 0.05 m']), { mode: 'sample' });
    expect(result.findings).toEqual([]);
    expect(result.status).toBe('consistent');
  });

  it('a forged side is still found after conversion', () => {
    const result = verifyScene(triangle345(['AB = 3 cm', 'BC = 40 mm', 'CA = 90 mm']), { mode: 'sample' });
    expect(result.status).toBe('disagree');
    expect(result.findings.map((f) => f.segmentId)).toEqual(['CA']);
  });

  it('an unknown unit among differing units means silence, not a guess', () => {
    const result = verifyScene(triangle345(['AB = 3 cm', 'BC = 4 bananas', 'CA = 99 cm']), { mode: 'sample' });
    expect(result).toEqual({ status: 'silent', findings: [] });
  });

  it('a bare number next to two different units means silence (which unit is it?)', () => {
    const result = verifyScene(triangle345(['AB = 3 cm', 'BC = 40 mm', 'CA = 99']), { mode: 'sample' });
    expect(result).toEqual({ status: 'silent', findings: [] });
  });

  it('one unit everywhere, or bare numbers with one unit, compares as before', () => {
    expect(verifyScene(triangle345(['AB = 3 units', 'BC = 4 units', 'CA = 5 units'])).status).toBe('consistent');
    expect(verifyScene(triangle345(['AB = 3 cm', 'BC = 4', 'CA = 5 cm'])).status).toBe('consistent');
    expect(verifyScene(triangle345(['AB = 3 cm', 'BC = 4', 'CA = 9 cm'])).status).toBe('disagree');
  });

  it('P47 with units: any mix of known units, values converted honestly, is never flagged (200 runs)', () => {
    const unit = fc.constantFrom(...Object.keys(MM_PER));
    fc.assert(
      fc.property(unit, unit, unit, (uAB, uBC, uCA) => {
        // True sides in mm: 30, 40, 50 (the drawing above, scaled).
        const val = (mm: number, u: string) => (mm / MM_PER[u]!).toPrecision(8);
        const scene = triangle345([`AB = ${val(30, uAB)} ${uAB}`, `BC = ${val(40, uBC)} ${uBC}`, `CA = ${val(50, uCA)} ${uCA}`]);
        const result = verifyScene(scene, { mode: 'sample' });
        expect(result.findings).toEqual([]);
        expect(result.status).toBe('consistent');
      }),
      { numRuns: 216 }, // 6 x 6 x 6 unit combinations, each reached
    );
  });
});

// ---------------------------------------------------------------------------
// 18.2 wording
// ---------------------------------------------------------------------------

describe('Requirement 18.2 — the sentence never claims the diagram is right', () => {
  it('every finding, on any forged triangle, is exactly the agreed sentence (200 runs)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 50, noNaN: true }),
        fc.double({ min: 0.1, max: 50, noNaN: true }),
        fc.double({ min: 0.1, max: 50, noNaN: true }),
        fc.constantFrom('ai', 'raw', 'sample', 'shared' as const),
        (x, y, z, mode) => {
          const result = verifyScene(triangle345([`AB = ${x} cm`, `BC = ${y} cm`, `CA = ${z} cm`, `angle B = ${(x * 7) % 180} degrees`]), { mode });
          for (const f of result.findings) {
            expect(f.message).toMatch(/^Facts and drawing disagree on (AB|BC|CA|angle B)\. I can't tell which is right\.$/);
            expect(f.message).not.toMatch(/verified|correct|trust|checked|approved/i);
          }
          if (result.status !== 'disagree') expect(result.findings).toEqual([]);
        },
      ),
      { numRuns: 250 },
    );
  });

  // Tightened in task 39.4 (audit r5-kiro-glue LOW): the property above passes when the check
  // finds nothing, so a verifier that always stays silent would pass it. Here one side is always
  // forged by a factor of at least 1.5, which must be flagged in every mode (the error is at least
  // 1/3, over the 25 % AI tolerance), and the sentence must name exactly that side.
  it('a forged side is always flagged, and named in the agreed sentence (250 runs)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.5, max: 40, noNaN: true }),
        fc.double({ min: 1.5, max: 5, noNaN: true }),
        fc.constantFrom('AB', 'BC', 'CA'),
        fc.constantFrom('ai', 'raw', 'sample', 'shared' as const),
        (scale, factor, forged, mode) => {
          const honest: Record<string, number> = { AB: 3, BC: 4, CA: 5 };
          const facts = Object.entries(honest).map(([side, len]) => `${side} = ${len * scale * (side === forged ? factor : 1)} cm`);
          const result = verifyScene(triangle345([...facts, 'angle B = 90 degrees']), { mode });
          expect(result.status).toBe('disagree');
          expect(result.findings.map((f) => f.message)).toEqual([
            `Facts and drawing disagree on ${forged}. I can't tell which is right.`,
          ]);
        },
      ),
      { numRuns: 250 },
    );
  });
});

// ---------------------------------------------------------------------------
// regression lock
// ---------------------------------------------------------------------------

describe('Regression — every sample and research scene in AI mode', () => {
  const scenes = {
    ...import.meta.glob<DiagramScene>('../public/samples/*.json', { eager: true, import: 'default' }),
    ...import.meta.glob<DiagramScene>('../../research/samples/synthetic/ground_truth/*.json', { eager: true, import: 'default' }),
    ...import.meta.glob<DiagramScene>('../../research/results/**/predictions/**/*.json', { eager: true, import: 'default' }),
  };

  it('flags nothing (the agy test claims this in its title but did not assert it)', () => {
    const flagged: string[] = [];
    let valid = 0;
    for (const [path, scene] of Object.entries(scenes)) {
      if (!scene || !scene.version || !scene.kind) continue;
      valid++;
      if (verifyScene(scene, { mode: 'ai' }).status === 'disagree') flagged.push(path);
    }
    expect(valid).toBeGreaterThanOrEqual(60);
    expect(flagged).toEqual([]);
  });

  it('documents the strict-tolerance case: the hand-made right triangle is drawn loosely', () => {
    // research ground truth 01: labelled 3-4-5 but drawn with AB = BC (an isosceles right
    // triangle). The facts and the drawing really disagree by about 18 %: inside the 25 % AI
    // tolerance, outside the 15 % strict one. This is the check working, and it shows the risk
    // that a loosely drawn textbook figure without "not to scale" is flagged (owner decision).
    const gt = scenes['../../research/samples/synthetic/ground_truth/01_right_triangle.json'];
    expect(gt).toBeDefined();
    expect(verifyScene(gt!, { mode: 'ai' }).status).toBe('consistent');
    expect(verifyScene(gt!, { mode: 'sample' }).status).toBe('disagree');
  });
});
