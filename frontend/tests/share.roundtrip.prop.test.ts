/**
 * Property-based tests for Share Codec round-trip.
 *
 * Requirements:
 * - Round trip property (>=200 runs): valid scenes (fixtures in frontend/public/samples/
 *   plus generated ones) encode then decode to an equal scene.
 *
 * Contract: docs/briefs/guide-share-contract.md § Share contract
 * Lane: docs/briefs/agy-t1-share-codec.md
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { DiagramScene, Point, SceneKind, Segment } from '../src/core/scene';
import {
  decodeShare,
  encodeShare,
  LIMITS,
  type SharePayload,
} from '../src/share';
import barchartFixture from '../public/samples/barchart.json';
import sineFixture from '../public/samples/sine.json';
import triangleFixture from '../public/samples/triangle.json';

// Load public sample fixtures
const triangleSample = triangleFixture as unknown as DiagramScene;
const sineSample = sineFixture as unknown as DiagramScene;
const barchartSample = barchartFixture as unknown as DiagramScene;

// Arbitrary generator for safe labels (no control chars, length <= 60)
const arbLabel = fc
  .string({ minLength: 0, maxLength: 50 })
  .map((s) => s.replace(/[\x00-\x1F\x7F]/g, ''));

// Arbitrary generator for safe verifiedBy (name <= 60)
const arbName = fc
  .string({ minLength: 1, maxLength: 50 })
  .map((s) => s.replace(/[\x00-\x1F\x7F]/g, ''));

// Arbitrary generator for safe note (<= 280)
const arbNote = fc
  .string({ minLength: 0, maxLength: 200 })
  .map((s) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''));

// Arbitrary generator for valid DiagramScene
const arbValidScene: fc.Arbitrary<DiagramScene> = fc
  .record({
    numPoints: fc.integer({ min: 1, max: 15 }),
    kind: fc.constantFrom<SceneKind>(
      'geometry',
      'function_graph',
      'bar_chart',
      'unknown',
    ),
    title: fc.option(arbLabel, { nil: undefined }),
    hasAxes: fc.boolean(),
    numFacts: fc.integer({ min: 0, max: 3 }),
  })
  .chain(({ numPoints, kind, title, hasAxes, numFacts }) => {
    // Generate unique points
    const arbPoints = fc
      .array(
        fc.record({
          x: fc.double({ min: 0, max: 1, noNaN: true }),
          y: fc.double({ min: 0, max: 1, noNaN: true }),
          label: fc.option(arbLabel, { nil: undefined }),
        }),
        { minLength: numPoints, maxLength: numPoints },
      )
      .map((rawPts) =>
        rawPts.map((p, idx): Point => ({
          id: `pt_${idx + 1}`,
          x: Math.round(p.x * 1000) / 1000,
          y: Math.round(p.y * 1000) / 1000,
          label: p.label,
        })),
      );

    return arbPoints.chain((points) => {
      const pointIds = points.map((p) => p.id);

      // Generate segments connecting existing points
      const arbSegments = fc
        .array(
          fc.record({
            idxA: fc.integer({ min: 0, max: pointIds.length - 1 }),
            idxB: fc.integer({ min: 0, max: pointIds.length - 1 }),
            label: fc.option(arbLabel, { nil: undefined }),
          }),
          { minLength: 0, maxLength: Math.min(10, pointIds.length * 2) },
        )
        .map((rawSegs) => {
          const segs: Segment[] = [];
          for (let i = 0; i < rawSegs.length; i++) {
            const raw = rawSegs[i]!;
            const a = pointIds[raw.idxA]!;
            const b = pointIds[raw.idxB]!;
            segs.push({
              id: `seg_${i + 1}`,
              a,
              b,
              label: raw.label,
            });
          }
          return segs;
        });

      // Optional axes
      const arbAxes = hasAxes
        ? fc.record({
            x_axis_y: fc.double({ min: 0, max: 1, noNaN: true }).map((v) => Math.round(v * 1000) / 1000),
            y_axis_x: fc.double({ min: 0, max: 1, noNaN: true }).map((v) => Math.round(v * 1000) / 1000),
          })
        : fc.constant(undefined);

      // Facts
      const arbFacts = fc.array(arbLabel, { minLength: numFacts, maxLength: numFacts });

      return fc.tuple(arbSegments, arbAxes, arbFacts).map(([segments, axes, facts]): DiagramScene => {
        const scene: DiagramScene = {
          version: 1,
          kind,
          points,
          segments,
          polylines: [],
          bars: [],
        };
        if (title !== undefined) scene.title = title;
        if (axes !== undefined) scene.axes = axes;
        if (facts.length > 0) scene.facts = facts;
        return scene;
      });
    });
  });

describe('Share Round-trip and Totality Properties', () => {
  it('Sample fixtures round-trip cleanly (triangle, sine, barchart)', () => {
    const samples = [
      { name: 'triangle', scene: triangleSample },
      { name: 'sine', scene: sineSample },
      { name: 'barchart', scene: barchartSample },
    ];

    for (const sample of samples) {
      const payload: SharePayload = {
        v: 1,
        scene: sample.scene,
        verifiedBy: 'Teacher Alice',
        note: `Verification note for ${sample.name}`,
        verifiedAt: '2026-11-06T12:00:00.000Z',
      };

      const encoded = encodeShare(payload);
      expect(encoded.length).toBeLessThan(LIMITS.maxHashChars);

      const decoded = decodeShare(encoded);
      expect(decoded.v).toBe(1);
      expect(decoded.verifiedBy).toBe(payload.verifiedBy);
      expect(decoded.note).toBe(payload.note);
      expect(decoded.verifiedAt).toBe(payload.verifiedAt);
      expect(decoded.scene.kind).toBe(sample.scene.kind);
      expect(decoded.scene.points?.length ?? 0).toBe(sample.scene.points?.length ?? 0);
      expect(decoded.scene.segments?.length ?? 0).toBe(sample.scene.segments?.length ?? 0);
      expect(decoded.scene.polylines?.length ?? 0).toBe(sample.scene.polylines?.length ?? 0);
      expect(decoded.scene.bars?.length ?? 0).toBe(sample.scene.bars?.length ?? 0);
    }
  });

  it('Round trip property (>=200 runs): valid scenes encode then decode to equal scene', () => {
    fc.assert(
      fc.property(arbValidScene, arbName, arbNote, (scene, verifiedBy, note) => {
        const payload: SharePayload = {
          v: 1,
          scene,
          verifiedBy,
          note,
          verifiedAt: '2026-11-06T12:00:00.000Z',
        };

        const encoded = encodeShare(payload);
        const decoded = decodeShare(encoded);

        // Verify version and metadata
        expect(decoded.v).toBe(1);
        expect(decoded.verifiedBy).toBe(verifiedBy.slice(0, LIMITS.maxName));
        expect(decoded.note).toBe(note.slice(0, LIMITS.maxNote));

        // Verify structural scene equality
        expect(decoded.scene.kind).toBe(scene.kind);
        expect(decoded.scene.points?.length ?? 0).toBe(scene.points?.length ?? 0);
        expect(decoded.scene.segments?.length ?? 0).toBe(scene.segments?.length ?? 0);

        // Coordinates equality
        const origPoints = scene.points ?? [];
        const decPoints = decoded.scene.points ?? [];
        for (let i = 0; i < origPoints.length; i++) {
          const op = origPoints[i]!;
          const dp = decPoints[i]!;
          expect(dp.id).toBe(op.id);
          expect(dp.x).toBeCloseTo(op.x, 3);
          expect(dp.y).toBeCloseTo(op.y, 3);
          if (op.label !== undefined) {
            expect(dp.label).toBe(op.label);
          }
        }

        const origSegments = scene.segments ?? [];
        const decSegments = decoded.scene.segments ?? [];
        for (let i = 0; i < origSegments.length; i++) {
          const os = origSegments[i]!;
          const ds = decSegments[i]!;
          expect(ds.id).toBe(os.id);
          expect(ds.a).toBe(os.a);
          expect(ds.b).toBe(os.b);
        }
      }),
      { numRuns: 200 },
    );
  });
});
