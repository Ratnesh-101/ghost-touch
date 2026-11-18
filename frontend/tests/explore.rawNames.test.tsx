// @vitest-environment jsdom
/**
 * Lane ux3 (EX): never speak a machine id; scan tone respects corners.
 *
 * Requirements:
 * 1. A 300-segment raw scene traced for 30 simulated seconds speaks no string
 *    matching /raw_|point_|pt_/.
 * 2. The triangle sample speaks exactly what it spoke before (snapshot of speak
 *    calls on a fixed trace).
 * 3. Scan tone is silent on a labelled graph point.
 * 4. Pure helpers (speakableName, isMachineId, scanTone, cornerCompass, lineName, whereAmI, buildOverview).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import sineJson from '../public/samples/sine.json';
import triangleJson from '../public/samples/triangle.json';
import type { DiagramScene } from '../src/core/scene';
import { isMachineId, speakableName } from '../src/core/speakable';
import { cornerCompass, lineName, scanTone } from '../src/flow/explore';
import { whereAmI } from '../src/flow/commands';
import { buildOverview } from '../src/flow/overview';
import { makeViewport } from '../src/core/geometry';
import { tables } from '../src/i18n';
import { setupRigEnv, SIZE, teardownRigEnv, withExplore, type Rig } from './support/exploreRig';

const triangle = triangleJson as unknown as DiagramScene;
const sine = sineJson as unknown as DiagramScene;

/** The sine sample plus one labelled point, off the curve and off both axes. */
const sineWithPoint: DiagramScene = {
  ...sine,
  points: [{ id: 'P', label: 'P', x: 0.5, y: 0.2 }],
};

/** Build a 300-segment raw scene with machine-generated IDs. */
function build300SegmentRawScene(kind: DiagramScene['kind'] = 'unknown'): DiagramScene {
  const points = [];
  const segments = [];
  const count = 300;

  for (let i = 0; i <= count; i++) {
    points.push({
      id: `raw_p${i}`,
      x: i / count,
      y: 0.5 + 0.3 * Math.sin((i / count) * 4 * Math.PI),
    });
  }

  for (let i = 0; i < count; i++) {
    segments.push({
      id: `raw_s${i}`,
      a: `raw_p${i}`,
      b: `raw_p${i + 1}`,
    });
  }

  return {
    version: 1,
    kind,
    title: 'Raw Diagram',
    points,
    segments,
    polylines: [],
    bars: [],
    axes: null,
  };
}

describe('Lane ux3: speakable names and scan tone', () => {
  beforeEach(setupRigEnv);
  afterEach(teardownRigEnv);

  describe('isMachineId and speakableName unit behavior', () => {
    it('identifies machine-generated IDs', () => {
      expect(isMachineId('raw_p0')).toBe(true);
      expect(isMachineId('raw_s1')).toBe(true);
      expect(isMachineId('point_12')).toBe(true);
      expect(isMachineId('pt_3')).toBe(true);
      expect(isMachineId('seg_45')).toBe(true);
      expect(isMachineId('line_9')).toBe(true);
      expect(isMachineId('poly_2')).toBe(true);
      expect(isMachineId('bar_7')).toBe(true);
      expect(isMachineId('p_1')).toBe(true);
      expect(isMachineId('node_1234567890')).toBe(true);
      expect(isMachineId('A')).toBe(false);
      expect(isMachineId('B')).toBe(false);
      expect(isMachineId('Hypotenuse')).toBe(false);
      expect(isMachineId('P')).toBe(false);
      expect(isMachineId('Sales')).toBe(false);
    });

    it('speakableName returns label when available, or non-machine id, or null', () => {
      expect(speakableName('Corner A', 'raw_p0')).toBe('Corner A');
      expect(speakableName('A', 'A')).toBe('A');
      expect(speakableName(undefined, 'A')).toBe('A');
      expect(speakableName(undefined, 'raw_p0')).toBeNull();
      expect(speakableName('', 'point_1')).toBeNull();
      expect(speakableName('  ', 'pt_2')).toBeNull();
      expect(speakableName(undefined, 'seg_0')).toBeNull();
      expect(speakableName(undefined, 'P')).toBe('P');
    });

    it('i18n keys vertex.unnamed and line.unnamed exist in all 3 languages', () => {
      for (const lang of ['en', 'hi', 'gu'] as const) {
        expect(tables[lang]['vertex.unnamed']).toBeDefined();
        expect(tables[lang]['vertex.unnamed']?.trim().length).toBeGreaterThan(0);
        expect(tables[lang]['line.unnamed']).toBeDefined();
        expect(tables[lang]['line.unnamed']?.trim().length).toBeGreaterThan(0);
      }
      expect(tables.en['vertex.unnamed']).toBe('Corner');
      expect(tables.en['line.unnamed']).toBe('Line');
    });
  });

  describe('Requirement 1: 300-segment raw scene traced for 30 seconds', () => {
    it('speaks no string matching /raw_|point_|pt_/ on a 30-second trace', async () => {
      const rawScene = build300SegmentRawScene('unknown');

      await withExplore({ scene: rawScene }, (rig) => {
        rig.clearCalls();
        // Trace for 30 simulated seconds (600 steps of 50 ms = 30,000 ms)
        rig.down(50, 200);
        rig.advance(50);

        const totalSteps = 600;
        for (let step = 0; step < totalSteps; step++) {
          const tNorm = step / totalSteps;
          const x = 20 + tNorm * 360;
          const y = 200 + 100 * Math.sin(tNorm * 8 * Math.PI);
          rig.move(x, y);
          rig.advance(50);
        }

        rig.up(380, 200);
        rig.advance(500);

        const spoken = rig.spoken();
        expect(spoken.length).toBeGreaterThan(0);

        for (const utterance of spoken) {
          expect(utterance).not.toMatch(/raw_|point_|pt_/i);
        }
      });
    });

    it('speaks no machine IDs on a 30-second trace of geometry raw scene', async () => {
      const rawGeomScene = build300SegmentRawScene('geometry');

      await withExplore({ scene: rawGeomScene }, (rig) => {
        rig.clearCalls();
        rig.down(50, 200);
        rig.advance(50);

        const totalSteps = 600;
        for (let step = 0; step < totalSteps; step++) {
          const tNorm = step / totalSteps;
          const x = 20 + tNorm * 360;
          const y = 200 + 100 * Math.sin(tNorm * 8 * Math.PI);
          rig.move(x, y);
          rig.advance(50);
        }

        rig.up(380, 200);
        rig.advance(500);

        const spoken = rig.spoken();
        expect(spoken.length).toBeGreaterThan(0);

        for (const utterance of spoken) {
          expect(utterance).not.toMatch(/raw_|point_|pt_/i);
        }
      });
    });

    it('pure helpers never speak machine IDs for raw elements', () => {
      const rawScene = build300SegmentRawScene('geometry');
      const view = makeViewport(SIZE, SIZE);

      // cornerCompass
      const compass = cornerCompass(rawScene, 'raw_p0');
      expect(compass).not.toMatch(/raw_|point_|pt_/i);
      // Direction-only clause because exit has no speakable target name
      expect(compass).toMatch(/^(?:Down-right|Up-right|Right|Down|Up|Left)\.$/);

      // lineName
      const lName = lineName(rawScene, 'raw_s0');
      expect(lName).not.toMatch(/raw_|point_|pt_/i);
      expect(lName.startsWith('Line.')).toBe(true);

      // whereAmI
      const where = whereAmI(rawScene, view, { x: 0, y: 0.5 });
      expect(where).not.toMatch(/raw_|point_|pt_/i);

      // buildOverview
      const overview = buildOverview(rawScene);
      expect(overview).not.toMatch(/raw_|point_|pt_/i);
    });
  });

  describe('Requirement 2: Triangle sample speaks exactly what it spoke before', () => {
    it('matches expected snapshot of speak calls on a fixed trace', async () => {
      await withExplore({ scene: triangle }, (rig) => {
        rig.clearCalls();
        // Fixed trace visiting line CA, corner A, line AB, corner B
        rig.down(130, 220); // click zone off CA
        rig.advance(100);
        rig.move(100, 220); // on CA
        rig.advance(100);
        rig.move(100, 150);
        rig.advance(100);
        rig.move(100, 100); // vertex A, arrived along CA
        rig.advance(600);
        rig.move(140, 160); // on AB
        rig.advance(100);
        rig.move(200, 300); // off line
        rig.advance(100);
        rig.move(280, 340); // vertex B
        rig.advance(300);
        rig.up(280, 340);

        expect(rig.spoken()).toEqual([
          'A. Down-right to B.',
          'B. Up-left to A. Left to C.',
        ]);
      });
    });

    it('speaks correct line dwell and corner announcements along all three sides', async () => {
      await withExplore({ scene: triangle }, (rig) => {
        rig.clearCalls();
        rig.down(100, 200); // on side CA
        rig.advance(850);   // dwell: lineName for CA
        rig.move(100, 100); // vertex A (arrived on CA)
        rig.advance(800);   // corner speech must be older than the 1500 ms speech quiet window (Req 29.3) when the dwell on AB is due
        rig.move(190, 220); // on side AB
        rig.advance(850);   // dwell: lineName for AB
        rig.move(280, 340); // vertex B (arrived on AB)
        rig.advance(800);   // same: 800 + 850 ms is past the 1500 ms window
        rig.move(190, 340); // on side BC
        rig.advance(850);   // dwell: lineName for BC
        rig.move(100, 340); // vertex C (arrived on BC)
        rig.advance(600);
        rig.up(100, 340);

        expect(rig.spoken()).toEqual([
          'Side CA. Down to C, up to A.',
          'A. Down-right to B.',
          'Side AB. Up-left to A, down-right to B.',
          'B. Left to C.',
          'Side BC. Right to B, left to C.',
          'C. Up to A.',
        ]);
      });
    });
  });

  describe('Requirement 3: Scan tone is silent on a labelled graph point', () => {
    const OFF_CURVE = { x: 200, y: 330 };
    const POINT_P = { x: 200, y: 80 };

    function frequencies(rig: Rig): unknown[] {
      return rig.tones().filter((c) => typeof c[0] === 'number');
    }

    it('control: finger off curve and off every point hears scan tone', async () => {
      await withExplore({ scene: sineWithPoint }, (rig) => {
        rig.down(OFF_CURVE.x, OFF_CURVE.y);
        expect(frequencies(rig).length).toBeGreaterThan(0);
      });
    });

    it('scan tone is completely silent when resting on labelled graph point P', async () => {
      await withExplore({ scene: sineWithPoint }, (rig) => {
        rig.down(POINT_P.x, POINT_P.y);
        rig.advance(500);
        expect(rig.spoken().some((s) => /\bP\b/.test(s))).toBe(true);
        expect(frequencies(rig)).toEqual([]);
      });
    });

    it('pure scanTone helper returns null for vertex targets', () => {
      // Vertex targets always yield null scanTone
      expect(scanTone(sineWithPoint, { kind: 'vertex', id: 'P', label: 'P' }, 0.5, 0.2)).toBeNull();
      expect(scanTone(sineWithPoint, { kind: 'vertex', id: 'P' }, 0.5, 0.2)).toBeNull();
      expect(scanTone(sineWithPoint, { kind: 'vertex', id: 'raw_p0' }, 0.5, 0.2)).toBeNull();
    });
  });
});
