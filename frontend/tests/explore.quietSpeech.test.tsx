// @vitest-environment jsdom
/**
 * Lane ux2 tests (Requirements 31.6, 31.7, 37, 39):
 * - Lift means quiet: lift during corner speech stops it after 300 ms, re-touch at 200 ms cancels timer.
 * - Short detail labels: corner "(2.5, 3)" and bar "Q1, 2024" spoken whole.
 * - Bar rest jitter: 1 px jitter for 600 ms on a bar speaks its value.
 * - Page edge cue: edge crossing plays no earcon (no 'back' earcon).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import barsJson from '../public/samples/barchart.json';
import triangleJson from '../public/samples/triangle.json';
import type { DiagramScene } from '../src/core/scene';
import {
  initialSpeechPacingState,
  paceSpeech,
  updateBarMove,
  checkBarRest,
  BAR_REST_MAX_MOVE_PX,
} from '../src/flow/explore';
import { setupRigEnv, teardownRigEnv, withExplore } from './support/exploreRig';

const triangle = triangleJson as unknown as DiagramScene;
const bars = barsJson as unknown as DiagramScene;

describe('Lane ux2: quiet speech on lift, edge without earcon, whole labels in Short', () => {
  beforeEach(setupRigEnv);
  afterEach(teardownRigEnv);

  describe('1. Lift means quiet (Requirement 37)', () => {
    it('lift during corner speech stops it after 300 ms', async () => {
      await withExplore({ scene: triangle }, (rig) => {
        rig.down(100, 100); // Corner A
        expect(rig.spoken().length).toBeGreaterThan(0);
        rig.setSpeaking(true);
        rig.clearCalls();
        rig.up(100, 100);
        rig.advance(250);
        expect(rig.stopSpeaking).not.toHaveBeenCalled();
        rig.advance(60); // 310 ms elapsed
        expect(rig.stopSpeaking).toHaveBeenCalled();
      });
    });

    it('a re-touch at 200 ms does not stop speech', async () => {
      await withExplore({ scene: triangle }, (rig) => {
        rig.down(100, 100);
        rig.setSpeaking(true);
        rig.clearCalls();
        rig.up(100, 100);
        rig.advance(200);
        expect(rig.stopSpeaking).not.toHaveBeenCalled();
        rig.down(100, 100); // cancels quiet timer
        rig.advance(400);
        expect(rig.stopSpeaking).not.toHaveBeenCalled();
      });
    });

    it('an Ask answer in progress is not cut by a finger lift', async () => {
      await withExplore({ scene: triangle, askAnswer: 'AB is three centimetres.' }, async (rig) => {
        rig.down(330, 60);
        rig.openAsk();
        await rig.resolveListen('how long is AB');
        await rig.flush();
        expect(rig.spoken().some((s) => s.includes('three centimetres'))).toBe(true);
        rig.setSpeaking(true);
        rig.clearCalls();
        rig.up(330, 60);
        rig.advance(400);
        expect(rig.stopSpeaking).not.toHaveBeenCalled();
      });
    });
  });

  describe('2. Short detail labels (Requirement 31.6, 31.7)', () => {
    it('pure paceSpeech: corner label "(2.5, 3)" is spoken whole in Short', () => {
      const paced = paceSpeech(initialSpeechPacingState('short'), {
        t: 1000,
        text: '(2.5, 3)',
        source: 'corner',
        detail: 'short',
      });
      expect(paced.speakNow).toBe('(2.5, 3)');
    });

    it('pure paceSpeech: bar label "Q1, 2024" is spoken whole in Short when following another bar', () => {
      const first = paceSpeech(initialSpeechPacingState('short'), {
        t: 1000,
        text: 'Previous, 10',
        source: 'bar',
        detail: 'short',
        barId: 'b1',
      });
      const second = paceSpeech(first.state, {
        t: 1300,
        text: 'Q1, 2024, 25',
        label: 'Q1, 2024',
        value: 25,
        source: 'bar',
        detail: 'short',
        barId: 'b2',
      });
      expect(second.speakNow).toBe('Q1, 2024');
    });

    it('Explore rig: label "(2.5, 3)" is spoken whole in Short', async () => {
      const sceneWithCorner: DiagramScene = {
        kind: 'geometry',
        points: [{ id: 'p1', label: '(2.5, 3)', x: 0.25, y: 0.25 }],
        segments: [],
        polylines: [],
        bars: [],
      };
      await withExplore({ scene: sceneWithCorner, detail: 'short' }, (rig) => {
        rig.clearCalls();
        rig.down(100, 100);
        expect(rig.spoken().some((s) => s.includes('(2.5, 3)'))).toBe(true);
      });
    });

    it('Explore rig: bar "Q1, 2024" is spoken whole in Short', async () => {
      const sceneWithBars: DiagramScene = {
        kind: 'bar_chart',
        bars: [
          { id: 'b1', label: 'Prev', value: 10, x0: 0.1, x1: 0.3, y_top: 0.5, y_base: 0.9 },
          { id: 'b2', label: 'Q1, 2024', value: 25, x0: 0.4, x1: 0.6, y_top: 0.3, y_base: 0.9 },
        ],
        points: [],
        segments: [],
        polylines: [],
      };
      await withExplore({ scene: sceneWithBars, detail: 'short' }, (rig) => {
        rig.down(80, 280); // On bar b1
        rig.advance(100);
        rig.move(200, 240); // On bar b2 within 700 ms
        expect(rig.spoken().some((s) => s.includes('Q1, 2024'))).toBe(true);
      });
    });

    it('Explore rig: in short detail a first visit to corner A still speaks its exits', async () => {
      await withExplore({ scene: triangle, detail: 'short' }, (rig) => {
        rig.clearCalls();
        rig.down(100, 100);
        expect(rig.spoken()[0] ?? '').toMatch(/\bto B\b/);
      });
    });
  });

  describe('3. Bar rest (Requirement 31.7)', () => {
    it('pure updateBarMove: 1 px jitter does not push lastMoveTime forward', () => {
      const first = paceSpeech(initialSpeechPacingState('short'), {
        t: 1000,
        text: 'Q1, 10',
        source: 'bar',
        detail: 'short',
        barId: 'b1',
      });
      const second = paceSpeech(first.state, {
        t: 1200,
        text: 'Q2, 25',
        label: 'Q2',
        value: 25,
        source: 'bar',
        detail: 'short',
        barId: 'b2',
        coords: { x: 100, y: 100 },
      });
      let state = second.state;
      expect(state.pendingBarRest?.lastMoveTime).toBe(1200);

      // 1 px jitter moves:
      for (let i = 1; i <= 10; i++) {
        state = updateBarMove(state, 1200 + i * 50, 'b2', { x: 100 + (i % 2), y: 100 });
        expect(state.pendingBarRest?.lastMoveTime).toBe(1200);
      }

      // Check bar rest at 500 ms dwell:
      const check = checkBarRest(state, 1750, 'b2');
      expect(check.speakNow).toBe('Q2, 25');

      // A large move (>= 20 px) resets rest anchor and pushes lastMoveTime forward:
      const moved = updateBarMove(state, 1800, 'b2', { x: 100 + BAR_REST_MAX_MOVE_PX, y: 100 });
      expect(moved.pendingBarRest?.lastMoveTime).toBe(1800);
      expect(moved.pendingBarRest?.restAnchor).toEqual({ x: 120, y: 100 });
    });

    it('Explore rig: 1 px jitter for 600 ms on a bar speaks its value', async () => {
      await withExplore({ scene: bars, detail: 'short' }, (rig) => {
        const Q1 = { x: 78, y: 310 };
        const Q2 = { x: 158, y: 260 };
        rig.down(Q1.x, Q1.y);
        rig.advance(100);
        rig.move(Q2.x, Q2.y);
        for (let i = 0; i < 12; i += 1) {
          rig.advance(50);
          rig.move(Q2.x + (i % 2), Q2.y);
        }
        expect(rig.spoken().some((s) => /Q2.*25/.test(s))).toBe(true);
      });
    });
  });

  describe('4. Page-edge cue (Requirement 39)', () => {
    it('edge crossing speaks edge sentence and plays no earcon', async () => {
      await withExplore({ scene: triangle }, (rig) => {
        rig.down(200, 200);
        rig.clearCalls();
        rig.move(-30, 200); // Outside unit square to the left
        expect(rig.spoken().some((s) => s.includes('Edge, left'))).toBe(true);
        expect(rig.earcons()).not.toContain('back');
        expect(rig.earcons()).toEqual([]);
      });
    });
  });
});
