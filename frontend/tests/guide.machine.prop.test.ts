import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  DEFAULT_GUIDE,
  initialGuideState,
  guideStep,
  type GuideState,
  type ResolvedTarget,
} from '../src/guide';

describe('Guide Machine Properties (>= 200 runs)', () => {
  const sampleTarget: ResolvedTarget = {
    x: 0.8,
    y: 0.8,
    label: 'Point B',
  };

  it('cancel for each reason => toneOff + stopped + speak(guide.stopped)', () => {
    const reasons = ['voice', 'back', 'timeout', 'user'] as const;

    fc.assert(
      fc.property(
        fc.constantFrom(...reasons),
        fc.integer({ min: 1000, max: 100000 }),
        (reason, now) => {
          const s0 = initialGuideState();
          const started = guideStep(s0, { type: 'start', target: sampleTarget, now: 100 });
          expect(started.state.phase).toBe('guiding');

          const stepResult = guideStep(started.state, { type: 'cancel', reason, now });
          expect(stepResult.state.phase).toBe('stopped');

          const effectTypes = stepResult.effects.map((e) => e.type);
          expect(effectTypes).toContain('toneOff');
          expect(effectTypes).toContain('stopped');
          expect(effectTypes).toContain('speak');

          const stopEffect = stepResult.effects.find((e) => e.type === 'stopped');
          expect(stopEffect).toEqual({ type: 'stopped', reason });

          const speakEffect = stepResult.effects.find((e) => e.type === 'speak');
          expect(speakEffect).toEqual({ type: 'speak', key: 'guide.stopped' });
        }
      ),
      { numRuns: 200 }
    );
  });

  it('lift => toneOff, phase stays guiding', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 50000 }),
        (now) => {
          const s0 = initialGuideState();
          const started = guideStep(s0, { type: 'start', target: sampleTarget, now: 10 });
          const lifted = guideStep(started.state, { type: 'lift', now });

          expect(lifted.state.phase).toBe('guiding');
          expect(lifted.effects).toEqual([{ type: 'toneOff' }]);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('tick after timeoutMs => stopped, tick before timeoutMs => stays guiding with no effects', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 40000 }),
        (dt) => {
          const s0 = initialGuideState();
          const startNow = 1000;
          const started = guideStep(s0, { type: 'start', target: sampleTarget, now: startNow });

          const tickNow = startNow + dt;
          const ticked = guideStep(started.state, { type: 'tick', now: tickNow });

          if (dt >= DEFAULT_GUIDE.timeoutMs) {
            expect(ticked.state.phase).toBe('stopped');
            expect(ticked.effects).toContainEqual({ type: 'toneOff' });
            expect(ticked.effects).toContainEqual({ type: 'stopped', reason: 'timeout' });
            expect(ticked.effects).toContainEqual({ type: 'speak', key: 'guide.stopped' });
          } else {
            expect(ticked.state.phase).toBe('guiding');
            expect(ticked.effects).toEqual([]);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('no effects after stopped or arrived', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('stopped', 'arrived' as const),
        fc.constantFrom(
          { type: 'move' as const, finger: { x: 0.5, y: 0.5 }, now: 5000 },
          { type: 'lift' as const, now: 5100 },
          { type: 'tick' as const, now: 6000 },
          { type: 'cancel' as const, reason: 'user' as const, now: 7000 }
        ),
        (terminalPhase, input) => {
          const terminalState: GuideState = {
            phase: terminalPhase,
            target: sampleTarget,
            startedAt: 100,
            lastHintAt: 200,
            lastHint: 'up',
            lastPulseAt: 300,
          };

          const res = guideStep(terminalState, input);
          expect(res.state.phase).toBe(terminalPhase);
          expect(res.effects).toEqual([]);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('arrive emitted exactly once on reaching target radius', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: DEFAULT_GUIDE.arriveRadius * 0.99, noNaN: true }),
        (dist) => {
          const s0 = initialGuideState();
          const started = guideStep(s0, { type: 'start', target: sampleTarget, now: 100 });

          // Position finger inside arriveRadius of sampleTarget (0.8, 0.8)
          const finger = { x: sampleTarget.x + dist, y: sampleTarget.y };
          const arrivedResult = guideStep(started.state, { type: 'move', finger, now: 200 });

          expect(arrivedResult.state.phase).toBe('arrived');
          const arriveEffects = arrivedResult.effects.filter((e) => e.type === 'arrive');
          expect(arriveEffects.length).toBe(1);
          expect(arriveEffects[0]).toEqual({ type: 'arrive', label: sampleTarget.label });

          // Subsequent moves produce no effects and no further arrive
          const followUp = guideStep(arrivedResult.state, { type: 'move', finger, now: 300 });
          expect(followUp.effects).toEqual([]);
          expect(followUp.state.phase).toBe('arrived');
        }
      ),
      { numRuns: 200 }
    );
  });

  it('direction hint spoken on direction change and not more often than hintEveryMs otherwise', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 5000 }),
        (dt) => {
          const s0 = initialGuideState();
          const target: ResolvedTarget = { x: 0.5, y: 0.5, label: 'Centre' };
          const started = guideStep(s0, { type: 'start', target, now: 100 });

          // First move from (0.1, 0.5): dx = 0.4 > 0, dy = 0 -> direction 'right'
          const move1 = guideStep(
            started.state,
            { type: 'move', finger: { x: 0.1, y: 0.5 }, now: 200 }
          );
          const speak1 = move1.effects.filter((e) => e.type === 'speak');
          expect(speak1.length).toBe(1);
          expect(speak1[0]).toEqual({
            type: 'speak',
            key: 'guide.hint.right',
            hint: 'right',
          });

          // Second move in the SAME direction: dx = 0.3 > 0, dy = 0 -> direction 'right'
          const move2 = guideStep(
            move1.state,
            { type: 'move', finger: { x: 0.2, y: 0.5 }, now: 200 + dt }
          );
          const speak2 = move2.effects.filter((e) => e.type === 'speak');

          if (dt < DEFAULT_GUIDE.hintEveryMs) {
            // Direction unchanged and not enough time elapsed => no speak effect
            expect(speak2.length).toBe(0);
          } else {
            // Direction unchanged but hintEveryMs elapsed => speaks hint
            expect(speak2.length).toBe(1);
            expect(speak2[0]).toEqual({
              type: 'speak',
              key: 'guide.hint.right',
              hint: 'right',
            });
          }

          // Third move changing direction: finger at (0.2, 0.8), dx = 0.3, dy = -0.3 -> 'up-right'
          // Even at dt = 1 ms after move2, direction changed => must speak immediately!
          const move3 = guideStep(
            move2.state,
            { type: 'move', finger: { x: 0.2, y: 0.8 }, now: 200 + dt + 1 }
          );
          const speak3 = move3.effects.filter((e) => e.type === 'speak');
          expect(speak3.length).toBe(1);
          expect(speak3[0]).toEqual({
            type: 'speak',
            key: 'guide.hint.up-right',
            hint: 'up-right',
          });
        }
      ),
      { numRuns: 200 }
    );
  });
});
