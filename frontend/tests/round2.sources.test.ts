/**
 * Source-level guards for round 2 fixes that need a browser to exercise (Task 26). Written by Kiro.
 *
 * The test environment has no DOM, so pointer capture, the speech driver's notice and the React
 * wiring cannot be driven here. These tests read the source and fail if the fix is undone. They
 * are weaker than behavioural tests and are listed as such in docs/reviews/kiro-round2.md; the
 * behaviour itself is covered by the pure helpers (P43, P44, loadSavedList) and by the phone test.
 */
import { describe, expect, it } from 'vitest';
import appSource from '../src/App.tsx?raw';
import speechSource from '../src/drivers/speech.ts?raw';
import exploreSource from '../src/screens/Explore.tsx?raw';
import savedSource from '../src/screens/SavedDiagrams.tsx?raw';
import teachCanvasSource from '../src/components/teach/TeachCanvas.tsx?raw';
import { t } from '../src/i18n';

describe('CORE-08 — Explore survives a refused pointer capture', () => {
  it('wraps setPointerCapture in try/catch', () => {
    const calls = [...exploreSource.matchAll(/setPointerCapture\(/g)];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      const before = exploreSource.slice(Math.max(0, (call.index ?? 0) - 160), call.index);
      // `try {` then optionally the receiver (`e.currentTarget.`) right before the call.
      expect(before, 'setPointerCapture must sit inside a try block').toMatch(
        /try\s*\{\s*(?:[\w$]+\.)*$/,
      );
    }
  });
});

describe('CORE-09 — the Teacher canvas ends a drag when capture is revoked', () => {
  it('handles lostpointercapture', () => {
    expect(teachCanvasSource).toMatch(/onLostPointerCapture=\{/);
  });
});

describe('CORE-10 — the missing-voice notice comes from the language tables', () => {
  it('does not hold the English sentence', () => {
    expect(speechSource).not.toContain('No system voice found');
    expect(speechSource).toContain('speech.noVoiceNotice');
  });

  it('has the key in every language table', () => {
    expect(t('speech.noVoiceNotice')).toContain('{lang}');
  });
});

describe('CORE-03 — Saved Diagrams does not act after it is closed', () => {
  it('loads through the guarded helper and clears the flag on unmount', () => {
    expect(savedSource).toContain('loadSavedList(');
    expect(savedSource).toMatch(/active\s*=\s*false/);
  });

  it('announces the last deletion once and returns focus to the heading', () => {
    expect(savedSource).toContain('deletedAnnouncement(');
    expect(savedSource).not.toMatch(/setEntries\(\(prev\)\s*=>\s*\{[^}]*say\(/s);
    expect(savedSource).toMatch(/headingRef\.current\?\.focus\(\)/);
  });
});

describe('CORE-01 — leaving by Back is spoken and guarded', () => {
  it('uses leaveByBack in the hash handler and asks before discarding edits', () => {
    expect(appSource).toContain('leaveByBack(');
    expect(appSource).toContain("t('teach.confirmLeave')");
  });
});

describe('CORE-02 — Explore speaks one joined utterance per move', () => {
  it('no longer speaks axis crossings one by one', () => {
    expect(exploreSource).not.toMatch(/for \(const axisSpoken of moveResult\.axisCrossings\)/);
    expect(exploreSource.match(/mergeAnnouncements\(/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });
});
