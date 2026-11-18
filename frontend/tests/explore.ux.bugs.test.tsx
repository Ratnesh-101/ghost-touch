// @vitest-environment jsdom
/**
 * Task 67 (design.md "Seven Explore bugs"): oracles U1 to U8 on the real `Explore` screen with
 * fake drivers and fake timers. Requirements 31.6, 31.7 and 37 to 42.
 *
 * Every oracle that fails today is `it.fails` and says why. When an agy lane fixes its bug,
 * vitest reports "expected to fail but passed"; the lane removes `.fails` and the test then
 * guards the fix. Tests without `.fails` pass today: they are controls (the cue exists, so a red
 * oracle is not red for a missing fixture) or guards (behaviour a fix must not break).
 *
 * Canvas 400 x 400 CSS px, the scene is the unit square. Triangle: A (100,100), B (280,340),
 * C (100,340). Bars: Q1 x 48-108 y 276-340, Q2 x 128-188 y 176-340. Sine: y-axis at x = 32,
 * x-axis at y = 200.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import barsJson from '../public/samples/barchart.json';
import sineJson from '../public/samples/sine.json';
import triangleJson from '../public/samples/triangle.json';
import type { DiagramScene } from '../src/core/scene';
import { setupRigEnv, SIZE, teardownRigEnv, withExplore, type Rig } from './support/exploreRig';

const triangle = triangleJson as unknown as DiagramScene;
const sine = sineJson as unknown as DiagramScene;
const bars = barsJson as unknown as DiagramScene;

/** The sine sample plus one labelled point, off the curve and off both axes. */
const sineWithPoint: DiagramScene = {
  ...sine,
  points: [{ id: 'P', label: 'P', x: 0.5, y: 0.2 }],
};

/** Screen position of the highest point of the sine curve ("find the peak" goes there). */
function sinePeak(): { x: number; y: number } {
  const points = sine.polylines?.[0]?.points ?? [];
  let best = points[0];
  for (const p of points) {
    if (best === undefined || p[1] < best[1]) best = p;
  }
  if (best === undefined) throw new Error('sine sample has no curve');
  return { x: best[0] * SIZE, y: best[1] * SIZE };
}

function isGuiding(rig: Rig): boolean {
  return rig.container.querySelector('.gt-explore--guiding') !== null;
}

/** Ask is opened by its button; "find the peak" / "take me to B" start Guide. */
async function startGuide(rig: Rig, phrase: string): Promise<void> {
  rig.openAsk();
  await rig.resolveListen(phrase);
  expect(isGuiding(rig)).toBe(true);
}

describe('task 67: seven Explore bugs (Requirements 31.6, 31.7, 37 to 42)', () => {
  beforeEach(setupRigEnv);
  afterEach(teardownRigEnv);

  describe('U1 hold services survive Guide (Requirement 38)', () => {
    it('control: a finger resting on the peak with no Guide gets the line buzz within 1 s', async () => {
      await withExplore({ scene: sine }, (rig) => {
        const peak = sinePeak();
        rig.down(peak.x, peak.y);
        rig.clearCalls();
        rig.advance(1000);
        expect(rig.vibrate).toHaveBeenCalledWith(80);
      });
    });

    // Fails today: the guiding path of `handlePointerDown` calls `keepAliveTimer.stop()` and never
    // `start()`, and arrival does not restart it, so with no pointer event nothing ticks and the
    // finger resting on the curve gets no `vibrate(80)`.
    it('after Guide arrives, a finger still on the curve gets vibrate(80) within 1 s', async () => {
      await withExplore({ scene: sine, guide: true }, async (rig) => {
        await startGuide(rig, 'find the peak');
        const peak = sinePeak();
        rig.down(300, 300); // away from the peak, while guiding
        rig.advance(100);
        rig.move(peak.x, peak.y); // arrival
        expect(isGuiding(rig)).toBe(false);
        rig.clearCalls();
        rig.advance(1000); // no pointer event
        expect(rig.vibrate).toHaveBeenCalledWith(80);
      });
    });
  });

  describe('U2 lift means quiet (Requirement 37)', () => {
    it('guard: an Ask answer in progress is not cut by a finger lift', async () => {
      await withExplore({ scene: triangle, askAnswer: 'AB is three centimetres.' }, async (rig) => {
        rig.down(330, 60); // finger already down in empty space when Ask is opened
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

    it('guard: a re-touch 200 ms after a lift does not stop speech', async () => {
      await withExplore({ scene: triangle }, (rig) => {
        rig.down(100, 100);
        rig.setSpeaking(true);
        rig.up(100, 100);
        rig.advance(200);
        rig.clearCalls();
        rig.down(100, 100);
        rig.advance(400);
        expect(rig.spoken().length).toBeGreaterThan(0); // the re-touch speaks its label
        expect(rig.stopSpeaking).not.toHaveBeenCalled();
      });
    });

    // Fails today: `handlePointerLift` stops vibration and tone but nothing ever calls
    // `drivers.speech.stopSpeaking`, so corner speech keeps playing after the last finger lifts.
    it('the last finger lifting stops exploration speech within 400 ms', async () => {
      await withExplore({ scene: triangle }, (rig) => {
        rig.down(100, 100); // corner A: label and exits start
        expect(rig.spoken().length).toBeGreaterThan(0);
        rig.setSpeaking(true);
        rig.clearCalls();
        rig.up(100, 100);
        rig.advance(400);
        expect(rig.stopSpeaking).toHaveBeenCalled();
      });
    });
  });

  describe('U3 one sound, one meaning (Requirement 39)', () => {
    it('control: leaving Explore with the Back button plays the back earcon', async () => {
      await withExplore({ scene: triangle }, (rig) => {
        const back = rig.container.querySelector<HTMLButtonElement>('.gt-explore__back');
        if (!back) throw new Error('Back button not found');
        rig.clearCalls();
        back.click();
        expect(rig.earcons()).toContain('back');
      });
    });

    // Fails today: `applyMoveResult` plays `playEarcon('back')` whenever the page-edge sentence
    // is spoken, so sliding off the page sounds like leaving Explore.
    it('the page-edge cue speaks the edge and does not play the back earcon', async () => {
      await withExplore({ scene: triangle }, (rig) => {
        rig.down(200, 200);
        rig.clearCalls();
        rig.move(-30, 200); // outside the unit square, to the left
        expect(rig.spoken().some((s) => s.includes('Edge, left'))).toBe(true);
        expect(rig.earcons()).not.toContain('back');
      });
    });
  });

  describe('U4 short detail keeps the compass on a first visit (Requirement 31.7)', () => {
    it('control: in full detail a new touch on corner A speaks its exits', async () => {
      await withExplore({ scene: triangle, detail: 'full' }, (rig) => {
        rig.clearCalls();
        rig.down(100, 100);
        expect(rig.spoken()[0] ?? '').toMatch(/\bto B\b/);
      });
    });

    // Fails today: `pacedAfterAnnouncements` is empty for every short-mode corner. The label
    // properties of the same oracle are P137 in explore.ux.pacing.prop.test.ts.
    it('in short detail a new touch on corner A still speaks its exits', async () => {
      await withExplore({ scene: triangle, detail: 'short' }, (rig) => {
        rig.clearCalls();
        rig.down(100, 100);
        expect(rig.spoken()[0] ?? '').toMatch(/\bto B\b/);
      });
    });
  });

  describe('U5 a bar value is spoken after a rest, not after zero events (Requirement 31.7)', () => {
    const Q1 = { x: 78, y: 310 };
    const Q2 = { x: 158, y: 260 };

    it('control: with no events for 600 ms on Q2 its value is spoken', async () => {
      await withExplore({ scene: bars, detail: 'short' }, (rig) => {
        rig.down(Q1.x, Q1.y);
        rig.advance(100);
        rig.move(Q2.x, Q2.y); // within 700 ms of Q1
        rig.advance(600);
        expect(rig.spoken().some((s) => /Q2.*25/.test(s))).toBe(true);
      });
    });

    // Fails today: `updateBarMove` sets the rest clock on every pointer move, so 1 px of jitter
    // every 50 ms keeps restarting the 500 ms and the value is never spoken. The 20 px rule of
    // Requirement 31.7 does not exist yet.
    it('with 1 px of jitter for 600 ms on Q2 its value is still spoken', async () => {
      await withExplore({ scene: bars, detail: 'short' }, (rig) => {
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

  describe('U6 where-am-I on rest is never lost (Requirement 40)', () => {
    it('control: with no other speech a finger resting in empty space hears where it is', async () => {
      await withExplore({ scene: triangle }, (rig) => {
        rig.clearCalls();
        rig.down(330, 60);
        rig.advance(3000);
        expect(rig.speak).toHaveBeenCalled();
      });
    });

    // Fails today: the keep-alive tick marks the rest as spoken (`checkWhereAmIDwell` returns
    // `spoken: true`) before it tests `isSpeechSpeaking()`, so a dwell that falls due while the
    // overview plays is consumed and nothing is ever said for that rest.
    it('a dwell due during other speech is spoken within 1.5 s of that speech ending', async () => {
      await withExplore({ scene: triangle }, (rig) => {
        rig.setSpeaking(true); // the overview is still playing
        rig.clearCalls();
        rig.down(330, 60);
        rig.advance(3000);
        expect(rig.spoken()).toEqual([]); // nothing talks over the overview
        rig.setSpeaking(false);
        rig.advance(1500);
        expect(rig.spoken().length).toBeGreaterThan(0);
      });
    });
  });

  describe('U7 the scan tone never covers a corner (Requirement 41)', () => {
    const OFF_CURVE = { x: 200, y: 330 };
    const POINT_P = { x: 200, y: 80 };

    function frequencies(rig: Rig): unknown[] {
      return rig.tones().filter((c) => typeof c[0] === 'number');
    }

    it('control: a finger off the curve and off every point hears the scan tone', async () => {
      await withExplore({ scene: sineWithPoint }, (rig) => {
        rig.down(OFF_CURVE.x, OFF_CURVE.y);
        expect(frequencies(rig).length).toBeGreaterThan(0);
      });
    });

    // Fails today: `scanTone` only excludes the polyline target, so the scan starts a tone again
    // right after the engine stopped it for the corner. The pure property is P138.
    it('a finger resting on the point P gets no tone with a frequency', async () => {
      await withExplore({ scene: sineWithPoint }, (rig) => {
        rig.down(POINT_P.x, POINT_P.y);
        rig.advance(500);
        expect(rig.spoken().some((s) => /\bP\b/.test(s))).toBe(true); // the finger is on the vertex
        expect(frequencies(rig)).toEqual([]);
      });
    });
  });

  describe('U8 the axis side is re-seeded when a hold begins during Guide (Requirement 42)', () => {
    it('control: crossing the y-axis within one hold speaks "y-axis"', async () => {
      await withExplore({ scene: sine }, (rig) => {
        rig.down(10, 300);
        rig.advance(100);
        rig.move(100, 300);
        expect(rig.spoken().some((s) => /y-axis/.test(s))).toBe(true);
      });
    });

    // Fails today: the guiding path of `handlePointerDown` never calls `seedAxisState`, so the
    // side `left` stored by the first hold survives, and the first move after arrival speaks a
    // crossing the finger never made.
    it('after Guide arrives, one move to the right of the axis speaks no "y-axis"', async () => {
      await withExplore({ scene: sine, guide: true }, async (rig) => {
        rig.down(10, 300); // first hold, left of the y-axis (x = 32)
        rig.up(10, 300);
        await startGuide(rig, 'find the peak');
        const peak = sinePeak();
        rig.down(300, 300); // new hold during Guide, right of the axis
        rig.advance(100);
        rig.move(peak.x, peak.y); // arrival
        expect(isGuiding(rig)).toBe(false);
        rig.clearCalls();
        rig.advance(100);
        rig.move(peak.x + 1, peak.y);
        expect(rig.spoken().filter((s) => /y-axis/.test(s))).toEqual([]);
      });
    });
  });
});
