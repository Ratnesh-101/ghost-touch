/**
 * Tests for Share Aspect Preservation (Lane r2-share-aspect, Requirement 18.6).
 *
 * Verifies:
 * 1. validateShareScene keeps aspect in [0.05, 20], falls back to 1 for out-of-range / non-numeric.
 * 2. Round-trip encode -> decode -> validate keeps aspect 1.5, 0.3, 19.
 * 3. Out-of-range and non-numeric aspects fall back to 1 in round trip.
 * 4. Legacy links without aspect continue to open with default aspect 1.
 * 5. Driven check: Spec Ghost (verifyScene) sees kept aspect (silent on honest aspect,
 *    disagrees when dropped).
 */

import LZString from 'lz-string';
import { describe, expect, it } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import { verifyScene } from '../src/core/verify';
import {
  decodeShare,
  encodeShare,
  validateShareScene,
  type SharePayload,
} from '../src/share';

function makeBaseScene(aspect?: unknown): DiagramScene {
  const scene: Record<string, unknown> = {
    version: 1,
    kind: 'geometry',
    title: 'Test Aspect Diagram',
    points: [
      { id: 'p1', x: 0.1, y: 0.2, label: 'P1' },
      { id: 'p2', x: 0.9, y: 0.8, label: 'P2' },
    ],
    segments: [{ id: 's1', a: 'p1', b: 'p2', label: 'S1' }],
    polylines: [],
    bars: [],
  };
  if (aspect !== undefined) {
    scene.aspect = aspect;
  }
  return scene as unknown as DiagramScene;
}

function roundTrip(scene: DiagramScene): DiagramScene {
  const payload: SharePayload = {
    v: 1,
    scene,
    verifiedBy: 'Teacher Test',
    note: 'Aspect verification note',
    verifiedAt: new Date().toISOString(),
  };
  const encoded = encodeShare(payload);
  const decoded = decodeShare(encoded);
  const valResult = validateShareScene(decoded.scene);
  expect(valResult.ok).toBe(true);
  if (!valResult.ok) {
    throw new Error(`Validation failed: ${valResult.errors.join('; ')}`);
  }
  return valResult.scene;
}

describe('Lane r2-share-aspect: Share validator aspect handling', () => {
  describe('validateShareScene aspect preservation and fallback', () => {
    it('keeps aspect 1.5, 0.3, and 19', () => {
      for (const val of [1.5, 0.3, 19]) {
        const res = validateShareScene(makeBaseScene(val));
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.scene.aspect).toBe(val);
        }
      }
    });

    it('keeps boundary aspect values 0.05 and 20 exactly', () => {
      for (const bound of [0.05, 20]) {
        const res = validateShareScene(makeBaseScene(bound));
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.scene.aspect).toBe(bound);
        }
      }
    });

    it('falls back to 1 for out-of-range aspects', () => {
      const outOfRangeValues = [0.049, 0.01, 0, -0.05, -2, -100, 20.001, 25, 100, 1e200];
      for (const val of outOfRangeValues) {
        const res = validateShareScene(makeBaseScene(val));
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.scene.aspect).toBe(1);
        }
      }
    });

    it('falls back to 1 for non-numeric aspects without throwing', () => {
      const nonNumericValues = [
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        '1.5',
        'wide',
        'NaN',
        '',
        true,
        false,
        null,
        [],
        [1.5],
        { aspect: 1.5 },
      ];
      for (const val of nonNumericValues) {
        const res = validateShareScene(makeBaseScene(val));
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.scene.aspect).toBe(1);
        }
      }
    });

    it('defaults to 1 when aspect is omitted', () => {
      const res = validateShareScene(makeBaseScene(undefined));
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.scene.aspect).toBe(1);
      }
    });
  });

  describe('roundTrip encode -> decode -> validate', () => {
    it('round trip keeps aspect 1.5, 0.3, and 19', () => {
      for (const val of [1.5, 0.3, 19]) {
        const out = roundTrip(makeBaseScene(val));
        expect(out.aspect).toBe(val);
      }
    });

    it('round trip falls back to 1 for out-of-range aspects', () => {
      for (const val of [0.01, 25, -2, 0, 1e200]) {
        const out = roundTrip(makeBaseScene(val));
        expect(out.aspect).toBe(1);
      }
    });

    it('round trip falls back to 1 for non-numeric aspects', () => {
      for (const val of [Number.NaN, Number.POSITIVE_INFINITY, '1.5', true, null]) {
        const out = roundTrip(makeBaseScene(val));
        expect(out.aspect).toBe(1);
      }
    });

    it('opens legacy links without aspect with default aspect 1', () => {
      const legacyPayload = {
        v: 1,
        scene: {
          version: 1,
          kind: 'geometry',
          title: 'Legacy Scene No Aspect',
          points: [
            { id: 'A', x: 0.2, y: 0.2, label: 'A' },
            { id: 'B', x: 0.8, y: 0.8, label: 'B' },
          ],
          segments: [{ id: 'AB', a: 'A', b: 'B', label: 'AB' }],
          polylines: [],
          bars: [],
        },
        verifiedBy: 'Old Teacher',
        note: 'Sent before aspect existed',
        verifiedAt: new Date().toISOString(),
      };
      const json = JSON.stringify(legacyPayload);
      expect(json).not.toContain('"aspect"');

      const compressed = LZString.compressToEncodedURIComponent(json);
      const decoded = decodeShare(compressed);
      expect(decoded.scene.aspect).toBe(1);

      const validated = validateShareScene(decoded.scene);
      expect(validated.ok).toBe(true);
      if (validated.ok) {
        expect(validated.scene.aspect).toBe(1);
      }
    });
  });

  describe('Spec Ghost verification with aspect (driven check)', () => {
    it('Spec Ghost verifies scene when aspect is preserved, disagrees when aspect is dropped', () => {
      // Geometry setup:
      // AB is horizontal: A(0.1, 0.2) to B(0.3, 0.2) -> dx = 0.2, dy = 0
      // BC is vertical:   B(0.3, 0.2) to C(0.3, 0.6) -> dx = 0, dy = 0.4
      // Facts claim AB = 4 cm and BC = 4 cm (equal lengths).
      // With aspect = 2:
      // drawn AB = hypot(0.2 * 2, 0) = 0.4
      // drawn BC = hypot(0, 0.4) = 0.4
      // Both drawn lengths are equal (0.4), so scale ratio is 1.0 (difference = 0 <= 0.15).
      // Spec Ghost finds NO disagreement (silent / consistent).
      //
      // With aspect dropped to default 1:
      // drawn AB = hypot(0.2 * 1, 0) = 0.2
      // drawn BC = hypot(0, 0.4) = 0.4
      // Scale ratio diff = |0.10 - 0.05| / 0.05 = 1.0 > 0.15.
      // Spec Ghost finds a disagreement on AB and BC.
      const honestScene: DiagramScene = {
        version: 1,
        kind: 'geometry',
        aspect: 2,
        points: [
          { id: 'A', x: 0.1, y: 0.2, label: 'A' },
          { id: 'B', x: 0.3, y: 0.2, label: 'B' },
          { id: 'C', x: 0.3, y: 0.6, label: 'C' },
        ],
        segments: [
          { id: 'AB', a: 'A', b: 'B', label: 'AB' },
          { id: 'BC', a: 'B', b: 'C', label: 'BC' },
        ],
        facts: ['AB = 4 cm', 'BC = 4 cm'],
      };

      // 1. Validate and round-trip through share pipeline
      const validatedDirect = validateShareScene(honestScene);
      expect(validatedDirect.ok).toBe(true);
      if (!validatedDirect.ok) throw new Error('Direct validation failed');
      expect(validatedDirect.scene.aspect).toBe(2);

      const sharedScene = roundTrip(honestScene);
      expect(sharedScene.aspect).toBe(2);

      // 2. Driven check: Spec Ghost on validated shared scene expects silence (no disagreements)
      const ghostResultWithAspect = verifyScene(sharedScene);
      expect(ghostResultWithAspect.status).toBe('consistent');
      expect(ghostResultWithAspect.findings).toHaveLength(0);

      // 3. With aspect dropped / forced to 1: Spec Ghost expects a disagreement
      const droppedScene: DiagramScene = {
        ...sharedScene,
        aspect: 1,
      };
      const ghostResultDropped = verifyScene(droppedScene);
      expect(ghostResultDropped.status).toBe('disagree');
      expect(ghostResultDropped.findings.length).toBeGreaterThan(0);
      expect(ghostResultDropped.findings.map((f) => f.segmentId)).toContain('AB');
    });
  });
});
