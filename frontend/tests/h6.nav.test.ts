import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import {
  SCREEN_NAMES,
  handleAppHashBack,
  leaveByBack,
  exploreAnnouncement,
} from '../src/flow/navigation';
import { Teach, executeTeachBack, isTeachDirty, type TeachCleanBaseline } from '../src/screens/Teach';
import { App } from '../src/App';
import { tables, t, setLang, getLang } from '../src/i18n';

const testScene: DiagramScene = {
  kind: 'geometry',
  title: 'Test Triangle',
  points: [
    { id: 'p1', x: 0.2, y: 0.2, label: 'A' },
    { id: 'p2', x: 0.8, y: 0.2, label: 'B' },
    { id: 'p3', x: 0.5, y: 0.8, label: 'C' },
  ],
  segments: [
    { id: 's1', a: 'p1', b: 'p2' },
    { id: 's2', b: 'p3', a: 'p2' },
    { id: 's3', a: 'p3', b: 'p1' },
  ],
};

const mockDrivers: Drivers = {
  haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
  audio: { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), playEarcon: vi.fn(), state: 'running' },
  speech: { speak: vi.fn(), listen: vi.fn(), canSpeak: true, canListen: true },
  diagramStore: new MemoryDiagramStore(),
};

describe('R3-04: Navigation policy table over every ScreenName', () => {
  it('defines valid back step for every ScreenName with non-empty announceKey across en, hi, gu', () => {
    for (const screen of SCREEN_NAMES) {
      for (const dirty of [false, true]) {
        for (const fromShare of [false, true]) {
          for (const hasScene of [false, true]) {
            const step = leaveByBack(screen, { dirty, fromShare, hasScene });
            expect(SCREEN_NAMES).toContain(step.next);
            expect(step.announceKey.length).toBeGreaterThan(0);

            // Assert announceKey exists in all 3 language tables
            for (const lang of ['en', 'hi', 'gu'] as const) {
              const translated = tables[lang][step.announceKey];
              expect(translated, `Missing ${step.announceKey} in ${lang}`).toBeDefined();
              expect(translated?.trim().length ?? 0, `Empty ${step.announceKey} in ${lang}`).toBeGreaterThan(0);
            }
          }
        }
      }
    }
  });
});

describe('R3-03: Hardware Back from Teach returns to Explore when scene exists', () => {
  it('routes to explore with explore.gestureHint when hasScene is true', () => {
    const cleanStep = leaveByBack('teach', { dirty: false, fromShare: false, hasScene: true });
    expect(cleanStep).toEqual({
      next: 'explore',
      announceKey: 'explore.gestureHint',
      needsConfirm: false,
    });

    const dirtyStep = leaveByBack('teach', { dirty: true, fromShare: false, hasScene: true });
    expect(dirtyStep).toEqual({
      next: 'explore',
      announceKey: 'explore.gestureHint',
      needsConfirm: true,
    });
  });

  it('routes to start with start.intro when hasScene is false or omitted', () => {
    const stepNoScene = leaveByBack('teach', { dirty: false, fromShare: false, hasScene: false });
    expect(stepNoScene).toEqual({
      next: 'start',
      announceKey: 'start.intro',
      needsConfirm: false,
    });

    const stepOmitted = leaveByBack('teach', { dirty: false, fromShare: false });
    expect(stepOmitted).toEqual({
      next: 'start',
      announceKey: 'start.intro',
      needsConfirm: false,
    });
  });

  it('handleAppHashBack navigates to explore with lastExploreScene and speaks exploreAnnouncement', () => {
    const spoken: string[] = [];
    let navigatedExplore: { scene: DiagramScene; announcement: string } | null = null;
    let navigatedStart = false;

    const result = handleAppHashBack(
      'teach',
      { dirty: false, fromShare: false, hasScene: true },
      testScene,
      {
        confirm: vi.fn().mockReturnValue(true),
        speak: (text) => spoken.push(text),
        restoreHash: vi.fn(),
        focusHeading: vi.fn(),
        onNavigateStart: () => { navigatedStart = true; },
        onNavigateExplore: (scene, announcement) => {
          navigatedExplore = { scene, announcement };
        },
      },
      'en-IN',
    );

    expect(result).toEqual({ stayed: false, next: 'explore' });
    expect(navigatedStart).toBe(false);
    const expectedAnnounced = exploreAnnouncement(testScene, 'ai');
    expect(navigatedExplore).toEqual({
      scene: testScene,
      announcement: expectedAnnounced,
    });
    expect(spoken).toEqual([expectedAnnounced]);
  });
});

describe('R3-01 & R3-07: Confirm leave speech and cancelled/suppressed outcome', () => {
  it('Teach handleBack: speaks confirmLeave, then speaks stayingInEditor on cancel/suppression and restores heading focus', () => {
    const spoken: string[] = [];
    const statusMessages: string[] = [];
    let focusedHeading = false;
    let exited = false;

    // confirm returns false (simulating user clicking Cancel or Chrome suppressing dialog)
    const result = executeTeachBack(true, {
      speak: (text) => spoken.push(text),
      confirm: vi.fn().mockReturnValue(false),
      sayAndStatus: (msg) => {
        statusMessages.push(msg);
        spoken.push(msg);
      },
      focusHeading: () => { focusedHeading = true; },
      onBack: () => { exited = true; },
    });

    expect(result).toEqual({ stayed: true });
    expect(exited).toBe(false);
    expect(focusedHeading).toBe(true);

    // Question spoken first, outcome spoken after cancel returns
    expect(spoken).toEqual([
      t('teach.confirmLeave'),
      t('teach.stayingInEditor'),
    ]);
    expect(statusMessages).toEqual([t('teach.stayingInEditor')]);
  });

  it('Teach handleBack: when confirmed, speaks question and exits without staying speech', () => {
    const spoken: string[] = [];
    let exited = false;

    const result = executeTeachBack(true, {
      speak: (text) => spoken.push(text),
      confirm: vi.fn().mockReturnValue(true),
      sayAndStatus: vi.fn(),
      focusHeading: vi.fn(),
      onBack: () => { exited = true; },
    });

    expect(result).toEqual({ stayed: false });
    expect(exited).toBe(true);
    expect(spoken).toEqual([t('teach.confirmLeave')]);
  });

  it('Teach handleBack: when clean, exits without confirm or speech', () => {
    const spoken: string[] = [];
    const confirmMock = vi.fn();
    let exited = false;

    const result = executeTeachBack(false, {
      speak: (text) => spoken.push(text),
      confirm: confirmMock,
      sayAndStatus: vi.fn(),
      focusHeading: vi.fn(),
      onBack: () => { exited = true; },
    });

    expect(result).toEqual({ stayed: false });
    expect(exited).toBe(true);
    expect(confirmMock).not.toHaveBeenCalled();
    expect(spoken).toHaveLength(0);
  });

  it('handleAppHashBack: when dirty and confirm is false (cancelled/suppressed), speaks stayingInEditor, restores hash, focuses heading and stays in teach', () => {
    const spoken: string[] = [];
    let restoredHash = false;
    let focusedHeading = false;
    let navigated = false;

    const result = handleAppHashBack(
      'teach',
      { dirty: true, fromShare: false, hasScene: true },
      testScene,
      {
        confirm: vi.fn().mockReturnValue(false),
        speak: (text) => spoken.push(text),
        restoreHash: () => { restoredHash = true; },
        focusHeading: () => { focusedHeading = true; },
        onNavigateStart: () => { navigated = true; },
        onNavigateExplore: () => { navigated = true; },
      },
      'en-IN',
    );

    expect(result).toEqual({ stayed: true });
    expect(navigated).toBe(false);
    expect(restoredHash).toBe(true);
    expect(focusedHeading).toBe(true);

    // Verifies speech order: question first, then staying utterance
    expect(spoken).toEqual([
      t('teach.confirmLeave'),
      t('teach.stayingInEditor'),
    ]);
  });
});

describe('R3-02: Clean baseline tracking and dirty flag reset on share/save', () => {
  it('isTeachDirty is false initially when scene, name, note match baseline', () => {
    const baseline: TeachCleanBaseline = {
      scene: testScene,
      name: '',
      note: '',
    };
    expect(isTeachDirty(testScene, '', '', baseline)).toBe(false);
  });

  it('isTeachDirty becomes true when scene, teacherName or teacherNote change', () => {
    const baseline: TeachCleanBaseline = {
      scene: testScene,
      name: '',
      note: '',
    };

    const editedScene: DiagramScene = {
      ...testScene,
      title: 'Edited Title',
    };

    // Scene edit -> dirty
    expect(isTeachDirty(editedScene, '', '', baseline)).toBe(true);

    // Name change -> dirty
    expect(isTeachDirty(testScene, 'Prof. Sharma', '', baseline)).toBe(true);

    // Note change -> dirty
    expect(isTeachDirty(testScene, '', 'Student note', baseline)).toBe(true);
  });

  it('isTeachDirty returns false after successful share/save updates clean baseline', () => {
    let baseline: TeachCleanBaseline = {
      scene: testScene,
      name: '',
      note: '',
    };

    const editedScene: DiagramScene = {
      ...testScene,
      title: 'Verified Triangle',
    };
    const name = 'Dr. Smith';
    const note = 'Check angle B';

    // Before verify/share: dirty
    expect(isTeachDirty(editedScene, name, note, baseline)).toBe(true);

    // Successful verify & share updates clean baseline ref
    baseline = {
      scene: editedScene,
      name,
      note,
    };

    // After share: dirty is false!
    expect(isTeachDirty(editedScene, name, note, baseline)).toBe(false);

    // Further back action with clean baseline does not need confirm
    const step = leaveByBack('teach', {
      dirty: isTeachDirty(editedScene, name, note, baseline),
      fromShare: false,
      hasScene: true,
    });
    expect(step.needsConfirm).toBe(false);
    expect(step.next).toBe('explore');
  });

  it('undoing edits back to baseline restores clean state', () => {
    const baseline: TeachCleanBaseline = {
      scene: testScene,
      name: 'Alice',
      note: 'None',
    };

    const modifiedScene: DiagramScene = { ...testScene, title: 'Temporary' };
    expect(isTeachDirty(modifiedScene, 'Alice', 'None', baseline)).toBe(true);

    // Undo returns to the exact baseline scene object
    expect(isTeachDirty(testScene, 'Alice', 'None', baseline)).toBe(false);
  });
});

describe('Markup and focus accessibility', () => {
  it('Teach markup contains accessible title with tabIndex -1 for programmatic focus', () => {
    const html = renderToStaticMarkup(createElement(Teach, { drivers: mockDrivers, onBack: vi.fn() }));
    expect(html).toContain('class="gt-teach__title"');
    expect(html).toContain('tabindex="-1"');
  });

  it('App renders with initial screen cleanly', () => {
    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain('Ghost Touch');
  });

  it('stayingInEditor i18n key exists and translates correctly in en, hi, and gu', () => {
    const prevLang = getLang();
    try {
      setLang('en');
      expect(t('teach.stayingInEditor')).toBe('Still in the editor.');
      setLang('hi');
      expect(t('teach.stayingInEditor')).toBe('अभी भी संपादक में हैं।');
      setLang('gu');
      expect(t('teach.stayingInEditor')).toBe('હજુ પણ સંપાદકમાં છો.');
    } finally {
      setLang(prevLang);
    }
  });
});
