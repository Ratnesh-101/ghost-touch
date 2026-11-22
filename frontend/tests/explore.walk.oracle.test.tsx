// @vitest-environment jsdom
/**
 * Task 85 oracles for Requirement 51 (Planchette, "Walk me through") on the real `Explore` screen.
 *
 * `it.fails` oracles are red-as-expected today: there is no walk button, no walk reducer in the
 * screen and no `walk.*` string. When the Explore lane (85b) lands, vitest reports "expected to fail
 * but passed", the lane removes `.fails`, and the test then guards the feature. Tests without
 * `.fails` pass today: controls (the rig and the cue exist, so a red oracle is not red for a missing
 * fixture) and guards (behaviour the lane must not break: no button on a Raw scene).
 *
 * Expected wording is built with `tf()` from the English table, so the oracle follows the lane's
 * words and fixes only WHICH lines are spoken, WHEN, and in how many utterances.
 *
 * Canvas 400 x 400 CSS px, the scene is the unit square. Triangle sample: A (100,100), B (280,340),
 * C (100,340); sides CA x=100, BC y=340, AB the slope. Bars: Q1 x 48-108, Q4 x 288-348.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import barsJson from '../public/samples/barchart.json';
import sineJson from '../public/samples/sine.json';
import triangleJson from '../public/samples/triangle.json';
import type { DiagramScene } from '../src/core/scene';
import { WALK_KEYS } from '../src/core/walk';
import { tables, tf } from '../src/i18n';
import { setupRigEnv, teardownRigEnv, withExplore, type Rig } from './support/exploreRig';

const triangle = triangleJson as unknown as DiagramScene;
const sine = sineJson as unknown as DiagramScene;
const bars = barsJson as unknown as DiagramScene;

const CA = { x: 100, y: 220 };
const BC = { x: 190, y: 340 };
const AB = { x: 190, y: 220 };
const VERTEX_C = { x: 100, y: 340 };
const VERTEX_A = { x: 100, y: 100 };

function walkButton(rig: Rig): HTMLButtonElement | null {
  const all = Array.from(rig.container.querySelectorAll<HTMLButtonElement>('button'));
  return all.find((b) => /walk me through/i.test(`${b.getAttribute('aria-label') ?? ''} ${b.textContent ?? ''}`)) ?? null;
}

function startWalk(rig: Rig): void {
  const b = walkButton(rig);
  if (b === null) throw new Error('Walk me through button not found');
  act(() => b.click());
}

async function say(rig: Rig, phrase: string): Promise<void> {
  rig.openAsk();
  await rig.resolveListen(phrase);
  await rig.flush();
}

/** Touch a place, wait a moment, lift, and let the lift settle (no walk speech is expected from the lift). */
function tap(rig: Rig, p: { x: number; y: number }): void {
  rig.down(p.x, p.y);
  rig.advance(100);
  rig.up(p.x, p.y);
  rig.advance(600);
}

const FORBIDDEN = /verified|correct|checked|approved/i;

describe('task 85: Requirement 51 oracles (lane 85b)', () => {
  beforeEach(setupRigEnv);
  afterEach(teardownRigEnv);

  describe('W1 and W2: the button exists exactly when a walk exists (51.7)', () => {
    it('control: the footer already has the Ask button, so the rig finds the footer row', async () => {
      await withExplore({ scene: triangle }, (rig) => {
        expect(rig.container.querySelector('.gt-explore__ask')).not.toBeNull();
      });
    });

    for (const [name, scene] of [
      ['triangle', triangle],
      ['bar chart', bars],
      ['sine', sine],
    ] as const) {
      // Fails today: no "Walk me through" button exists.
      it.fails(`W1 the ${name} sample shows a Walk me through button`, async () => {
        await withExplore({ scene }, (rig) => {
          expect(walkButton(rig)).not.toBeNull();
        });
      });
    }

    it('W2 guard: a Raw Mode scene shows no button, whatever its content', async () => {
      await withExplore({ scene: triangle, isRaw: true }, (rig) => {
        expect(walkButton(rig)).toBeNull();
      });
      const rawIds: DiagramScene = {
        ...triangle,
        kind: 'unknown',
        segments: triangle.segments!.map((s, i) => ({ ...s, id: `raw_s${i}` })),
      };
      await withExplore({ scene: rawIds }, (rig) => {
        expect(walkButton(rig)).toBeNull();
      });
    });

    it('W2 guard: a draft that carries the Ghost Hand grid fact line shows no button (task 86 owns that line)', async () => {
      await withExplore({ scene: { ...triangle, facts: [...triangle.facts!, 'Grid: x 0-6, y 0-8'] } }, (rig) => {
        expect(walkButton(rig)).toBeNull();
      });
    });
  });

  describe('W3: a step is spoken only after its anchor was touched (51.4)', () => {
    it('control: touching side CA with no walk speaks nothing, and the vertex speaks its own label', async () => {
      await withExplore({ scene: triangle }, (rig) => {
        rig.clearCalls();
        rig.down(CA.x, CA.y);
        rig.advance(50);
        expect(rig.spoken()).toEqual([]);
        rig.up(CA.x, CA.y);
        rig.advance(600);
        rig.clearCalls();
        rig.down(VERTEX_C.x, VERTEX_C.y);
        expect(rig.spoken().length).toBe(1);
        expect(rig.spoken()[0]).toContain('C');
      });
    });

    // Fails today: there is no button, so the rig throws before anything is spoken.
    it.fails('W3 start speaks the first find prompt; a wrong touch is silent; the anchor speaks step one once', async () => {
      await withExplore({ scene: triangle }, async (rig) => {
        startWalk(rig);
        expect(rig.spoken().join(' ')).toContain(tf('walk.find.segment', { name: 'CA' }));
        rig.clearCalls();
        tap(rig, BC); // not the anchor
        expect(rig.spoken()).toEqual([]);
        rig.clearCalls();
        rig.down(CA.x, CA.y);
        rig.advance(50);
        const spoken = rig.spoken();
        expect(spoken).toHaveLength(1);
        expect(spoken[0]).toContain('CA');
        expect(spoken[0]).toMatch(/\b4\b/);
        rig.up(CA.x, CA.y);
        rig.advance(600);
        // the same side again does not say it twice; "next step" asks for the next find prompt
        rig.clearCalls();
        rig.down(CA.x, CA.y);
        rig.advance(50);
        expect(rig.spoken()).toEqual([]);
        rig.up(CA.x, CA.y);
        rig.advance(600);
        rig.clearCalls();
        await say(rig, 'next step');
        expect(rig.spoken().join(' ')).toContain(tf('walk.find.segment', { name: 'BC' }));
      });
    });

    // Fails today for the same reason. The vertex label and the step sentence are ONE utterance (51.8).
    it.fails('W3b the step sentence and the engine announcement for the same touch are one utterance', async () => {
      await withExplore({ scene: triangle }, async (rig) => {
        startWalk(rig);
        tap(rig, CA);
        await say(rig, 'next step');
        tap(rig, BC);
        await say(rig, 'next step');
        rig.clearCalls();
        rig.down(VERTEX_C.x, VERTEX_C.y);
        const spoken = rig.spoken();
        expect(spoken).toHaveLength(1);
        expect(spoken[0]).toContain(tf('walk.pyth.rightFact', { name: 'C' }));
        expect(spoken[0]).toContain('C');
      });
    });

    it.fails('W3c "next step" before the anchor is touched does not move on', async () => {
      await withExplore({ scene: triangle }, async (rig) => {
        startWalk(rig);
        rig.clearCalls();
        await say(rig, 'next step');
        const text = rig.spoken().join(' ');
        expect(text).toContain(tf('walk.find.segment', { name: 'CA' }));
        expect(text).not.toContain(tf('walk.find.segment', { name: 'BC' }));
      });
    });
  });

  describe('W4: a lift does not cut a walk step (Requirement 37.2 amended)', () => {
    it('control: a lift still stops a corner label (exploration speech, Requirement 37.1)', async () => {
      await withExplore({ scene: triangle }, (rig) => {
        rig.down(VERTEX_A.x, VERTEX_A.y);
        rig.setSpeaking(true);
        rig.clearCalls();
        rig.up(VERTEX_A.x, VERTEX_A.y);
        rig.advance(400);
        expect(rig.stopSpeaking).toHaveBeenCalled();
      });
    });

    // Fails today: no walk exists to protect.
    it.fails('a step sentence still playing when the finger lifts is not stopped', async () => {
      await withExplore({ scene: triangle }, (rig) => {
        startWalk(rig);
        rig.down(CA.x, CA.y);
        rig.advance(50);
        expect(rig.spoken().join(' ')).toContain('CA');
        rig.setSpeaking(true);
        rig.clearCalls();
        rig.up(CA.x, CA.y);
        rig.advance(400);
        expect(rig.stopSpeaking).not.toHaveBeenCalled();
      });
    });
  });

  describe('W5: the walk adds no vibration, tone or earcon (51.4)', () => {
    async function trace(withWalk: boolean): Promise<{ vib: unknown[][]; tone: unknown[][]; ear: string[] }> {
      let out = { vib: [] as unknown[][], tone: [] as unknown[][], ear: [] as string[] };
      await withExplore({ scene: triangle }, (rig) => {
        if (withWalk) startWalk(rig);
        rig.clearCalls();
        rig.down(CA.x, CA.y);
        rig.advance(200);
        rig.move(100, 150);
        rig.advance(200);
        rig.move(VERTEX_A.x, VERTEX_A.y);
        rig.advance(700);
        rig.move(AB.x, AB.y);
        rig.advance(300);
        rig.up(AB.x, AB.y);
        rig.advance(600);
        out = { vib: rig.vibrations(), tone: rig.tones(), ear: rig.earcons() };
      });
      return out;
    }

    it('control: the fixed trace buzzes and the walk-less run is repeatable', async () => {
      const a = await trace(false);
      const b = await trace(false);
      expect(a.vib.length).toBeGreaterThan(3);
      expect(b).toEqual(a);
    });

    // Fails today: there is no walk to start.
    it.fails('the vibrate, tone and earcon calls are identical with and without a started walk', async () => {
      const plain = await trace(false);
      const walking = await trace(true);
      expect(walking.vib).toEqual(plain.vib);
      expect(walking.tone).toEqual(plain.tone);
      expect(walking.ear).toEqual(plain.ear);
    });
  });

  describe('W6: "stop" ends the walk with one line and no earcon (51.7)', () => {
    // Fails today: there is no walk to stop, and "stop" is parsed only while Guide is active.
    it.fails('stop speaks one line, plays no earcon of its own, and later touches speak no step', async () => {
      await withExplore({ scene: triangle }, async (rig) => {
        startWalk(rig);
        rig.clearCalls();
        await say(rig, 'stop');
        expect(rig.spoken()).toEqual([tf('walk.stopped', {})]);
        // Opening Ask plays the listening earcon; nothing else (no back, success or error) may play
        expect(rig.earcons().filter((e) => e !== 'listening')).toEqual([]);
        rig.clearCalls();
        rig.down(CA.x, CA.y);
        rig.advance(50);
        expect(rig.spoken()).toEqual([]);
      });
    });
  });

  describe('W7: the walk strings are complete and honest (51.9)', () => {
    // Fails today: no `walk.*` key exists in any table.
    it.fails('every WALK_KEYS key exists in en, hi and gu with the same placeholders, differs from English, and is not a claim of correctness', () => {
      const placeholders = (s: string): string => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
      const problems: string[] = [];
      for (const key of WALK_KEYS) {
        const en = tables.en[key];
        if (typeof en !== 'string' || en.trim() === '') {
          problems.push(`${key}: missing or blank in en`);
          continue;
        }
        if (FORBIDDEN.test(en)) problems.push(`${key}: en contains a verification word`);
        for (const lang of ['hi', 'gu'] as const) {
          const v = tables[lang][key];
          if (typeof v !== 'string' || v.trim() === '') problems.push(`${key}: missing or blank in ${lang}`);
          else {
            if (placeholders(v) !== placeholders(en)) problems.push(`${key}: placeholders differ in ${lang}`);
            if (v === en) problems.push(`${key}: ${lang} equals English`);
            if (FORBIDDEN.test(v)) problems.push(`${key}: ${lang} contains a verification word`);
          }
        }
      }
      expect(problems).toEqual([]);
    });
  });
});
