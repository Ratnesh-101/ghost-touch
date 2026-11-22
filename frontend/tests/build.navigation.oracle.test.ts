/**
 * P182 - Back from Build (Requirement 52.9, task 86). Kiro.
 *
 * The formula for every other screen is a control that passes today and stays true after lane
 * C-wire adds `'build'` to `SCREEN_NAMES`. The `build` rows are `it.fails` until then.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { leaveByBack, SCREEN_NAMES, type BackContext, type ScreenName } from '../src/flow/navigation';
import { runs } from './support/runs';

interface Flags {
  dirty: boolean;
  correctDirty: boolean;
  fromShare: boolean;
  buildDirty: boolean;
  buildFeel: boolean;
}

const flagsArb = fc.record({
  dirty: fc.boolean(),
  correctDirty: fc.boolean(),
  fromShare: fc.boolean(),
  buildDirty: fc.boolean(),
  buildFeel: fc.boolean(),
});

/** The context type does not yet have the two Build flags; the lane adds them. */
function ctxOf(f: Flags): BackContext {
  return f as unknown as BackContext;
}

const BUILD = 'build' as unknown as ScreenName;

describe('P182 control: every screen follows the extended formula', () => {
  it('needsConfirm is (teach && dirty) || (correct && correctDirty) || (build && !buildFeel && buildDirty)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...SCREEN_NAMES), flagsArb, (screen, f) => {
        const want =
          (screen === 'teach' && f.dirty) ||
          (screen === 'correct' && f.correctDirty) ||
          ((screen as string) === 'build' && !f.buildFeel && f.buildDirty);
        const step = leaveByBack(screen, ctxOf(f));
        expect(step.needsConfirm).toBe(want);
        expect(step.announceKey.length).toBeGreaterThan(0);
      }),
      { numRuns: runs(100) },
    );
  });
});

describe('P182 Back from Build (it.fails until lane C-wire)', () => {
  it.fails('Feel stays on build and speaks build.backToForm; the form goes to capture, confirming only with pins', () => {
    fc.assert(
      fc.property(flagsArb, (f) => {
        const step = leaveByBack(BUILD, ctxOf(f));
        if (f.buildFeel) {
          expect(step).toEqual({ next: 'build', announceKey: 'build.backToForm', needsConfirm: false });
        } else {
          expect(step).toEqual({ next: 'capture', announceKey: 'capture.prompt', needsConfirm: f.buildDirty });
        }
      }),
      { numRuns: runs(100) },
    );
  });

  it.fails('build is a screen name', () => {
    expect((SCREEN_NAMES as readonly string[]).includes('build')).toBe(true);
  });
});
