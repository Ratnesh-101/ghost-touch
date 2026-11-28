/**
 * P43 — Back navigation is total and spoken (Task 26, Requirement 17.1, CORE-01).
 *
 * Written by Kiro. Android Back from `#/teach`, a shared diagram, or the share error screen used
 * to drop to Start in silence and discard unsaved Teacher edits without asking.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { t } from '../src/i18n';
import { SCREEN_NAMES, leaveByBack, type ScreenName } from '../src/flow/navigation';

const screenArb = fc.constantFrom<ScreenName>(...SCREEN_NAMES);

describe('P43 — leaveByBack', () => {
  it('covers every screen the app can show', () => {
    expect([...SCREEN_NAMES].sort()).toEqual(
      [
        'build',
        'capture',
        'correct',
        'explore',
        'saved',
        'shareError',
        'shareGate',
        'start',
        'teach',
      ].sort(),
    );
  });

  it('always leads to a defined screen with a spoken, translated announcement (200+ runs)', () => {
    fc.assert(
      fc.property(screenArb, fc.boolean(), fc.boolean(), (screen, dirty, fromShare) => {
        const step = leaveByBack(screen, { dirty, fromShare });
        expect(SCREEN_NAMES).toContain(step.next);
        expect(step.announceKey.length).toBeGreaterThan(0);
        for (const lang of ['en', 'hi', 'gu'] as const) {
          // The same key must resolve to real text in every language table.
          expect(t(step.announceKey).trim().length, `${step.announceKey} (${lang})`).toBeGreaterThan(0);
          expect(t(step.announceKey)).not.toBe(step.announceKey);
        }
      }),
      { numRuns: 300 },
    );
  });

  // Amended by Kiro in task 40.1 (Requirement 24.1, decision (a)) and extended for Build
  // (Requirement 52.9): Teach asks with `dirty`, Correct with `correctDirty`, Build with
  // `buildDirty` unless it is in Feel mode (`buildFeel`), where Back only returns to the form.
  it('asks before discarding unsaved Teach, Correct or Build edits, and only then (200+ runs)', () => {
    fc.assert(
      fc.property(
        screenArb,
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        (screen, dirty, correctDirty, fromShare, hasScene, buildDirty, buildFeel) => {
          const step = leaveByBack(screen, { dirty, correctDirty, fromShare, hasScene, buildDirty, buildFeel });
          expect(step.needsConfirm).toBe(
            (screen === 'teach' && dirty) ||
              (screen === 'correct' && correctDirty) ||
              (screen === 'build' && !buildFeel && buildDirty),
          );
        },
      ),
      { numRuns: 300 },
    );
  });

  it('Build: Feel stays on build and speaks build.backToForm; the form goes to capture (Requirement 52.9)', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), fc.boolean(), fc.boolean(), (dirty, correctDirty, buildDirty, fromShare) => {
        const base = { dirty, correctDirty, fromShare };
        expect(leaveByBack('build', { ...base, buildDirty, buildFeel: true })).toEqual({
          next: 'build',
          announceKey: 'build.backToForm',
          needsConfirm: false,
        });
        expect(leaveByBack('build', { ...base, buildDirty, buildFeel: false })).toEqual({
          next: 'capture',
          announceKey: 'host.capture.next',
          needsConfirm: buildDirty,
        });
        // Omitted flags mean false: no confirmation, straight to Capture.
        expect(leaveByBack('build', base)).toEqual({ next: 'capture', announceKey: 'host.capture.next', needsConfirm: false });
      }),
      { numRuns: 300 },
    );
  });

  it('keeps the two editors apart: Teacher edits never block leaving Correct, and the reverse', () => {
    const teachOnly = { dirty: true, correctDirty: false, fromShare: false };
    const correctOnly = { dirty: false, correctDirty: true, fromShare: false };
    expect(leaveByBack('correct', teachOnly).needsConfirm).toBe(false);
    expect(leaveByBack('teach', correctOnly).needsConfirm).toBe(false);
    expect(leaveByBack('correct', correctOnly)).toEqual({ next: 'explore', announceKey: 'host.explore.next', needsConfirm: true });
    // A caller that omits the flag (today's App.tsx) never gets a confirmation from Correct.
    expect(leaveByBack('correct', { dirty: true, fromShare: false }).needsConfirm).toBe(false);
  });

  it('never leaves the user on a screen they were trying to leave, except Start (200+ runs)', () => {
    fc.assert(
      fc.property(screenArb, fc.boolean(), fc.boolean(), (screen, dirty, fromShare) => {
        const step = leaveByBack(screen, { dirty, fromShare });
        if (screen !== 'start') expect(step.next).not.toBe(screen);
      }),
      { numRuns: 300 },
    );
  });

  it('sends share, teach and share-error screens to Start with the intro', () => {
    expect(leaveByBack('teach', { dirty: false, fromShare: false })).toEqual({
      next: 'start',
      announceKey: 'host.start.next',
      needsConfirm: false,
    });
    expect(leaveByBack('shareError', { dirty: false, fromShare: false }).next).toBe('start');
    expect(leaveByBack('shareGate', { dirty: false, fromShare: false }).next).toBe('start');
    expect(leaveByBack('explore', { dirty: false, fromShare: true })).toEqual({
      next: 'start',
      announceKey: 'host.start.next',
      needsConfirm: false,
    });
  });

  it('sends a normal Explore back to Capture, and Saved back to Capture', () => {
    expect(leaveByBack('explore', { dirty: false, fromShare: false }).next).toBe('capture');
    expect(leaveByBack('saved', { dirty: false, fromShare: false }).next).toBe('capture');
    expect(leaveByBack('correct', { dirty: false, fromShare: false }).next).toBe('explore');
  });
});
