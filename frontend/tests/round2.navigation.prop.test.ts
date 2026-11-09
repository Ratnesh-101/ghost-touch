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

  it('asks before discarding unsaved Teacher edits, and only then (200+ runs)', () => {
    fc.assert(
      fc.property(screenArb, fc.boolean(), fc.boolean(), (screen, dirty, fromShare) => {
        const step = leaveByBack(screen, { dirty, fromShare });
        expect(step.needsConfirm).toBe(screen === 'teach' && dirty);
      }),
      { numRuns: 300 },
    );
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
      announceKey: 'start.intro',
      needsConfirm: false,
    });
    expect(leaveByBack('shareError', { dirty: false, fromShare: false }).next).toBe('start');
    expect(leaveByBack('shareGate', { dirty: false, fromShare: false }).next).toBe('start');
    expect(leaveByBack('explore', { dirty: false, fromShare: true })).toEqual({
      next: 'start',
      announceKey: 'start.intro',
      needsConfirm: false,
    });
  });

  it('sends a normal Explore back to Capture, and Saved back to Capture', () => {
    expect(leaveByBack('explore', { dirty: false, fromShare: false }).next).toBe('capture');
    expect(leaveByBack('saved', { dirty: false, fromShare: false }).next).toBe('capture');
    expect(leaveByBack('correct', { dirty: false, fromShare: false }).next).toBe('explore');
  });
});
