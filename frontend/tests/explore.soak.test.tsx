// @vitest-environment jsdom
/**
 * Task 73 (Requirement 47, P150): a soak of the real `Explore` screen.
 *
 * About 60 simulated seconds of random use per run, on fake drivers and fake timers: pointer
 * down, move and up (one finger), window `blur`, `visibilitychange` to hidden, Ask start and
 * stop, Guide start (by voice) and arrival, and changes of the six Explore switches. Each run
 * ends with a settled tail (Ask stopped, Guide ended, finger on a line, 600 ms, then 300 ms).
 *
 * Invariants (Requirement 47.1 to 47.3):
 *   1. While lifted: no `vibrate` with a positive entry, no `setTone` with a frequency.
 *   2. While Ask listens: no `setTone` with a frequency.
 *   3. After the tail: `vibrate(80)` in the last 200 ms of the 300 ms.
 *
 * Runs are repeatable from their seed (a small seeded generator, no wall clock). A failing seed
 * goes into PINNED_SEEDS with a note, and the invariant is never weakened to get a green run.
 * Known limits (47.5): one finger, the triangle and the sine sample, no real speech engine.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import sineJson from '../public/samples/sine.json';
import triangleJson from '../public/samples/triangle.json';
import type { DiagramScene } from '../src/core/scene';
import {
  setStoredCornerHeartbeatSetting,
  setStoredDirectionsSetting,
  setStoredFindingSoundSetting,
  setStoredStickyLineSetting,
} from '../src/drivers/storage';
import { setStoredGraphScanSetting, setStoredSpeechDetailSetting } from '../src/flow/explore';
import { setupRigEnv, SIZE, teardownRigEnv, withExplore, type Rig } from './support/exploreRig';
import { runs } from './support/runs';

const triangle = triangleJson as unknown as DiagramScene;
const sine = sineJson as unknown as DiagramScene;

const SOAK_MS = 60_000;

/**
 * Seeds that once failed, kept as regression examples. Each entry says what broke.
 * Empty: no seed has failed so far (first run, 2026-11-17).
 */
const PINNED_SEEDS: ReadonlyArray<{ seed: number; scene: 'triangle' | 'sine'; note: string }> = [];

function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Pt {
  x: number;
  y: number;
}

function sinePeak(): Pt {
  const points = sine.polylines?.[0]?.points ?? [];
  let best = points[0];
  for (const p of points) if (best === undefined || p[1] < best[1]) best = p;
  if (best === undefined) throw new Error('sine sample has no curve');
  return { x: best[0] * SIZE, y: best[1] * SIZE };
}

function isGuiding(rig: Rig): boolean {
  return rig.container.querySelector('.gt-explore--guiding') !== null;
}

function setVisibility(state: 'hidden' | 'visible'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => state === 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
}

function positiveVibrate(call: unknown[]): boolean {
  const p = call[0];
  if (typeof p === 'number') return p > 0;
  if (Array.isArray(p)) return p.some((v) => typeof v === 'number' && v > 0);
  return false;
}

function frequencyTone(call: unknown[]): boolean {
  return typeof call[0] === 'number' && Number.isFinite(call[0]);
}

interface SoakResult {
  violations: string[];
  ops: number;
}

async function soak(kind: 'triangle' | 'sine', seed: number): Promise<SoakResult> {
  const rand = rng(seed);
  const scene = kind === 'sine' ? sine : triangle;
  const violations: string[] = [];
  const log: string[] = [];
  let ops = 0;

  await withExplore(
    { scene, guide: kind === 'sine', askAnswer: 'It is three centimetres.' },
    async (rig) => {
      const peak = kind === 'sine' ? sinePeak() : { x: 0, y: 0 };
      const curve = sine.polylines?.[0]?.points ?? [];
      const anchors: Pt[] =
        kind === 'sine'
          ? [
              peak,
              { x: 32, y: 200 },
              { x: 300, y: 200 },
              ...curve.filter((_, i) => i % 9 === 0).map((p) => ({ x: p[0] * SIZE, y: p[1] * SIZE })),
            ]
          : [
              { x: 100, y: 100 },
              { x: 280, y: 340 },
              { x: 100, y: 340 },
              { x: 100, y: 220 },
              { x: 190, y: 220 },
              { x: 190, y: 340 },
            ];
      const lineSpot: Pt = kind === 'sine' ? peak : { x: 100, y: 220 };

      let down = false;
      let registered = false; // the screen saw the touch (a touch during Ask is ignored)
      let asking = false;
      let pos: Pt = { x: 200, y: 200 };
      let time = 0;

      const pick = (): Pt => {
        const r = rand();
        if (r < 0.45) {
          const a = anchors[Math.floor(rand() * anchors.length)] ?? pos;
          return { x: a.x + (rand() - 0.5) * 6, y: a.y + (rand() - 0.5) * 6 };
        }
        if (r < 0.75) return { x: rand() * 440 - 20, y: rand() * 440 - 20 };
        return { x: pos.x + (rand() - 0.5) * 30, y: pos.y + (rand() - 0.5) * 30 };
      };

      const doDown = (p: Pt): void => {
        pos = p;
        rig.down(p.x, p.y);
        down = true;
        registered = !asking;
      };
      const doMove = (p: Pt): void => {
        pos = p;
        rig.move(p.x, p.y);
      };
      const doUp = (): void => {
        rig.up(pos.x, pos.y);
        down = false;
        registered = false;
      };
      const lose = (): void => {
        down = false;
        registered = false;
      };

      const checkAfterOp = (name: string, lifted: boolean, listening: boolean): void => {
        if (lifted) {
          const bad = rig.vibrations().filter(positiveVibrate);
          const tone = rig.tones().filter(frequencyTone);
          if (bad.length > 0) violations.push(`${name}: vibrate ${JSON.stringify(bad)} while lifted`);
          if (tone.length > 0) violations.push(`${name}: tone ${JSON.stringify(tone)} while lifted`);
        }
        if (listening) {
          const tone = rig.tones().filter(frequencyTone);
          if (tone.length > 0) violations.push(`${name}: tone ${JSON.stringify(tone)} while Ask listens`);
        }
        rig.clearCalls();
      };

      const switches: Array<() => void> = [
        () => setStoredSpeechDetailSetting(rand() < 0.5 ? 'full' : 'short'),
        () => setStoredDirectionsSetting(rand() < 0.5),
        () => setStoredFindingSoundSetting(rand() < 0.5),
        () => setStoredGraphScanSetting(rand() < 0.5),
        () => setStoredStickyLineSetting(rand() < 0.5),
        () => setStoredCornerHeartbeatSetting(rand() < 0.5),
      ];

      while (time < SOAK_MS) {
        const r = rand();
        let name: string;
        if (r < 0.4) {
          name = 'move';
          if (down) doMove(pick());
          else doDown(pick());
        } else if (r < 0.5) {
          name = 'down';
          if (!down) doDown(pick());
        } else if (r < 0.6) {
          name = 'up';
          if (down) doUp();
        } else if (r < 0.64) {
          name = 'blur';
          rig.container.ownerDocument.defaultView?.dispatchEvent(new Event('blur'));
          lose();
        } else if (r < 0.68) {
          name = 'hidden';
          setVisibility('hidden');
          setVisibility('visible');
          lose();
        } else if (r < 0.74) {
          if (!asking) {
            name = 'askStart';
            rig.openAsk();
            asking = true;
          } else {
            name = 'askStop';
            const phrase = kind === 'sine' && rand() < 0.5 ? 'find the peak' : 'how long is AB';
            await rig.resolveListen(phrase);
            await rig.flush();
            asking = false;
          }
        } else if (r < 0.8) {
          name = 'guideArrive';
          if (isGuiding(rig) && !asking) {
            if (!(down && registered)) doDown({ x: 300, y: 300 });
            doMove(peak);
          }
        } else if (r < 0.88) {
          name = 'switch';
          switches[Math.floor(rand() * switches.length)]?.();
        } else {
          name = 'idle';
        }
        const wait = Math.floor(rand() * 300);
        rig.advance(wait);
        time += wait;
        ops += 1;
        log.push(`${name}@${time}`);
        checkAfterOp(`op ${ops} ${name} (t=${time}, last: ${log.slice(-6).join(' ')})`, !down, asking);
      }

      // Settled tail: Ask stopped, Guide ended, finger on a line, 600 ms, then 300 ms.
      if (asking) {
        await rig.resolveListen('how long is AB');
        await rig.flush();
        asking = false;
      }
      if (isGuiding(rig)) {
        if (!(down && registered)) doDown({ x: 300, y: 300 });
        doMove(peak);
      }
      if (down && registered) doMove(lineSpot);
      else {
        if (down) doUp();
        doDown(lineSpot);
      }
      rig.advance(600);
      rig.advance(100);
      rig.clearCalls();
      rig.advance(200);
      if (!rig.vibrate.mock.calls.some((c) => c[0] === 80)) {
        violations.push(`tail: no vibrate(80) in the last 200 ms (last ops: ${log.slice(-8).join(' ')})`);
      }
    },
  );
  return { violations, ops };
}

describe('P150 soak on the real Explore screen (Requirement 47, task 73)', () => {
  beforeEach(setupRigEnv);
  afterEach(() => {
    Reflect.deleteProperty(document, 'visibilityState');
    Reflect.deleteProperty(document, 'hidden');
    setStoredStickyLineSetting(false);
    setStoredDirectionsSetting(true);
    setStoredFindingSoundSetting(true);
    setStoredGraphScanSetting(true);
    setStoredCornerHeartbeatSetting(false);
    setStoredSpeechDetailSetting('full');
    teardownRigEnv();
  });

  const count = runs(15);
  for (let i = 1; i <= count; i += 1) {
    const kind = i % 2 === 1 ? 'sine' : 'triangle';
    it(`seed ${i} on the ${kind} sample: about 60 s of mixed use keeps all three invariants`, async () => {
      const { violations, ops } = await soak(kind, i);
      expect(ops).toBeGreaterThan(100);
      expect(violations.slice(0, 5)).toEqual([]);
    }, 120_000);
  }

  for (const pinned of PINNED_SEEDS) {
    it(`pinned seed ${pinned.seed} (${pinned.scene}): ${pinned.note}`, async () => {
      const { violations } = await soak(pinned.scene, pinned.seed);
      expect(violations.slice(0, 5)).toEqual([]);
    }, 120_000);
  }
});
