// @vitest-environment jsdom
/**
 * Test suite for Lane o1-leavebyback:
 *
 * Verifies Back navigation from Correct mode (Requirement 24.1):
 * 1. leaveByBack returns needsConfirm: true when correctDirty === true, and false otherwise.
 * 2. Editor isolation: teach edits (dirty) do not block leaving Correct; correctDirty does not
 *    block leaving Teach.
 * 3. executeCorrectLeave prompts confirmation once and speaks once when dirty; never prompts
 *    when clean.
 * 4. In-app Cancel button in Correct confirms once and clears dirty via onDirtyChange(false)
 *    before onCancel, preventing double confirmation.
 * 5. Hardware/gesture Back (onCorrectBack) in App.tsx checks leaveByBack('correct', ctx),
 *    asking confirmation and speaking once when dirty, and navigating directly when clean.
 */

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import { handleAppHashBack, leaveByBack, type HashBackActions } from '../src/flow/navigation';
import { Correct, executeCorrectLeave } from '../src/screens/Correct';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import { setLang, t } from '../src/i18n';

const sampleScene: DiagramScene = {
  version: 1,
  kind: 'geometry',
  title: 'Right Triangle',
  points: [
    { id: 'A', x: 0.2, y: 0.8, label: 'A' },
    { id: 'B', x: 0.8, y: 0.8, label: 'B' },
    { id: 'C', x: 0.2, y: 0.2, label: 'C' },
  ],
  segments: [
    { id: 's_ab', a: 'A', b: 'B', label: 'AB' },
    { id: 's_bc', a: 'B', b: 'C', label: 'BC' },
    { id: 's_ca', a: 'C', b: 'A', label: 'CA' },
  ],
  polylines: [],
  bars: [],
};

// Mock Capture and PDF driver modules so App does not load pdfjs worker URL in jsdom
vi.mock('../src/screens/Capture', () => ({
  Capture: ({
    onScene,
  }: {
    onScene?: (scene: DiagramScene, mode: string, photo?: string, source?: string) => void;
  }) => (
    <div className="gt-capture">
      <button
        type="button"
        className="mock-open-scene-btn"
        onClick={() => onScene?.(sampleScene, 'ai', undefined, 'sample')}
      >
        Open Sample
      </button>
    </div>
  ),
}));

vi.mock('../src/drivers/pdf', () => ({
  PdfError: class PdfError extends Error {
    readonly reason: string;
    constructor(reason: string, message?: string) {
      super(message ?? `PDF error: ${reason}`);
      this.name = 'PdfError';
      this.reason = reason;
    }
  },
  defaultPdfLoader: vi.fn(async () => ({})),
  renderFirstPage: vi.fn(async () => new Blob()),
}));

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({
  default: '',
}));

let App!: typeof import('../src/App').App;
let appModulePromise: Promise<typeof import('../src/App')> | null = null;
function getAppModule(): Promise<typeof import('../src/App')> {
  if (!appModulePromise) {
    appModulePromise = import('../src/App');
  }
  return appModulePromise;
}

describe('Lane o1-leavebyback: Back from Correct', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let testDrivers: Drivers;
  let restoreRect: () => void;
  let restoreContext: () => void;

  beforeEach(() => {
    setLang('en');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    const proto = HTMLCanvasElement.prototype;
    const originalRect = proto.getBoundingClientRect;
    proto.getBoundingClientRect = function rect(): DOMRect {
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 400,
        bottom: 400,
        width: 400,
        height: 400,
        toJSON: () => ({}),
      } as DOMRect;
    };
    restoreRect = () => {
      proto.getBoundingClientRect = originalRect;
    };

    const originalContext = proto.getContext;
    proto.getContext = (() => null) as typeof proto.getContext;
    restoreContext = () => {
      proto.getContext = originalContext;
    };

    testDrivers = {
      haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
      audio: {
        unlock: vi.fn(),
        setTone: vi.fn(),
        beep: vi.fn(),
        playEarcon: vi.fn(),
        state: 'locked',
      },
      speech: { speak: vi.fn(), listen: vi.fn(), canSpeak: true, canListen: true },
      diagramStore: new MemoryDiagramStore(),
    };
  });

  afterEach(async () => {
    restoreRect();
    restoreContext();
    if (root && container) {
      await act(async () => {
        root?.unmount();
      });
      container.remove();
    }
    container = null;
    root = null;
    window.location.hash = '';
    vi.restoreAllMocks();
  });

  describe('1. Policy table: leaveByBack for Correct', () => {
    it('returns needsConfirm=true when leaving Correct with unsaved edits', () => {
      const step = leaveByBack('correct', {
        dirty: false,
        correctDirty: true,
        fromShare: false,
      });
      expect(step).toEqual({
        next: 'explore',
        announceKey: 'explore.gestureHint',
        needsConfirm: true,
      });
    });

    it('returns needsConfirm=false when leaving Correct without unsaved edits', () => {
      const step = leaveByBack('correct', {
        dirty: false,
        correctDirty: false,
        fromShare: false,
      });
      expect(step).toEqual({
        next: 'explore',
        announceKey: 'explore.gestureHint',
        needsConfirm: false,
      });
    });

    it('defaults correctDirty to false when omitted by callers', () => {
      const step = leaveByBack('correct', {
        dirty: false,
        fromShare: false,
      });
      expect(step.needsConfirm).toBe(false);
      expect(step.next).toBe('explore');
      expect(step.announceKey).toBe('explore.gestureHint');
    });

    it('keeps Teach and Correct dirty flags strictly isolated', () => {
      // Teach dirty does not require confirmation when leaving Correct
      const stepCorrect = leaveByBack('correct', {
        dirty: true,
        correctDirty: false,
        fromShare: false,
      });
      expect(stepCorrect.needsConfirm).toBe(false);

      // Correct dirty does not require confirmation when leaving Teach
      const stepTeach = leaveByBack('teach', {
        dirty: false,
        correctDirty: true,
        fromShare: false,
      });
      expect(stepTeach.needsConfirm).toBe(false);
    });

    it('correctly handles handleAppHashBack for Correct screen', () => {
      const actions: HashBackActions = {
        confirm: vi.fn(() => true),
        speak: vi.fn(),
        restoreHash: vi.fn(),
        focusHeading: vi.fn(),
        onNavigateStart: vi.fn(),
        onNavigateExplore: vi.fn(),
      };

      const result = handleAppHashBack(
        'correct',
        { dirty: false, correctDirty: true, fromShare: false },
        sampleScene,
        actions,
        'en',
      );

      expect(actions.confirm).toHaveBeenCalledWith(t('correct.confirmLeave'));
      expect(actions.speak).toHaveBeenCalledWith(t('correct.confirmLeave'), 'en');
      expect(actions.onNavigateExplore).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ stayed: false, next: 'explore' });
    });
  });

  describe('2. Helper: executeCorrectLeave', () => {
    it('speaks confirmLeave and requests confirm when isDirty=true', () => {
      const speak = vi.fn();
      const confirm = vi.fn(() => true);
      const sayAndStatus = vi.fn();
      const focusHeading = vi.fn();
      const onLeave = vi.fn();

      const result = executeCorrectLeave(true, {
        speak,
        confirm,
        sayAndStatus,
        focusHeading,
        onLeave,
      });

      expect(result.stayed).toBe(false);
      expect(speak).toHaveBeenCalledTimes(1);
      expect(speak).toHaveBeenCalledWith(t('correct.confirmLeave'));
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(confirm).toHaveBeenCalledWith(t('correct.confirmLeave'));
      expect(onLeave).toHaveBeenCalledTimes(1);
      expect(sayAndStatus).not.toHaveBeenCalled();
    });

    it('stays in editor and focuses heading when confirm is cancelled', () => {
      const speak = vi.fn();
      const confirm = vi.fn(() => false);
      const sayAndStatus = vi.fn();
      const focusHeading = vi.fn();
      const onLeave = vi.fn();

      const result = executeCorrectLeave(true, {
        speak,
        confirm,
        sayAndStatus,
        focusHeading,
        onLeave,
      });

      expect(result.stayed).toBe(true);
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(sayAndStatus).toHaveBeenCalledWith(t('correct.stayingInEditor'));
      expect(focusHeading).toHaveBeenCalledTimes(1);
      expect(onLeave).not.toHaveBeenCalled();
    });

    it('leaves immediately without prompt when isDirty=false', () => {
      const speak = vi.fn();
      const confirm = vi.fn();
      const sayAndStatus = vi.fn();
      const focusHeading = vi.fn();
      const onLeave = vi.fn();

      const result = executeCorrectLeave(false, {
        speak,
        confirm,
        sayAndStatus,
        focusHeading,
        onLeave,
      });

      expect(result.stayed).toBe(false);
      expect(confirm).not.toHaveBeenCalled();
      expect(speak).not.toHaveBeenCalled();
      expect(onLeave).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. Component: Correct in-app Cancel button', () => {
    it('notifies onDirtyChange(false) before calling onCancel when confirmed', async () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();
      const dirtyEvents: boolean[] = [];
      const onDirtyChange = vi.fn((dirty: boolean) => {
        dirtyEvents.push(dirty);
      });

      // Confirm dialog returns true
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      await act(async () => {
        root!.render(
          createElement(Correct, {
            scene: sampleScene,
            photoUrl: null,
            drivers: testDrivers,
            onSave,
            onCancel,
            onDirtyChange,
          }),
        );
      });

      // Clean on mount
      expect(dirtyEvents).toEqual([false]);

      // Apply an edit via keyboard: select first point and move it with ArrowRight
      const canvas = container!.querySelector('canvas');
      expect(canvas).not.toBeNull();
      const pointBtn = container!.querySelector<HTMLButtonElement>(
        '.gt-correct__element-btn',
      );
      expect(pointBtn).not.toBeNull();

      await act(async () => {
        pointBtn!.click();
      });

      await act(async () => {
        canvas!.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
        );
      });

      // Now dirty
      expect(dirtyEvents).toContain(true);

      // Click Cancel button
      const cancelBtn = container!.querySelector<HTMLButtonElement>(
        '.gt-correct__header .gt-correct__btn',
      );
      expect(cancelBtn).not.toBeNull();
      expect(cancelBtn!.textContent).toBe(t('correct.cancel'));

      await act(async () => {
        cancelBtn!.click();
      });

      // Confirm was requested exactly once
      expect(window.confirm).toHaveBeenCalledTimes(1);
      expect(window.confirm).toHaveBeenCalledWith(t('correct.confirmLeave'));

      // onDirtyChange(false) was called before onCancel
      expect(dirtyEvents[dirtyEvents.length - 1]).toBe(false);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('stays in editor and does not call onCancel when Cancel confirm is rejected', async () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();
      const onDirtyChange = vi.fn();

      vi.spyOn(window, 'confirm').mockReturnValue(false);

      await act(async () => {
        root!.render(
          createElement(Correct, {
            scene: sampleScene,
            photoUrl: null,
            drivers: testDrivers,
            onSave,
            onCancel,
            onDirtyChange,
          }),
        );
      });

      const canvas = container!.querySelector('canvas');
      const pointBtn = container!.querySelector<HTMLButtonElement>(
        '.gt-correct__element-btn',
      );
      await act(async () => {
        pointBtn!.click();
      });
      await act(async () => {
        canvas!.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
        );
      });

      const cancelBtn = container!.querySelector<HTMLButtonElement>(
        '.gt-correct__header .gt-correct__btn',
      );
      await act(async () => {
        cancelBtn!.click();
      });

      expect(window.confirm).toHaveBeenCalledTimes(1);
      expect(onCancel).not.toHaveBeenCalled();
      const title = container!.querySelector<HTMLElement>('.gt-correct__title');
      expect(document.activeElement).toBe(title);
    });

    it('exits immediately without confirm when clean', async () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();
      const onDirtyChange = vi.fn();

      vi.spyOn(window, 'confirm');

      await act(async () => {
        root!.render(
          createElement(Correct, {
            scene: sampleScene,
            photoUrl: null,
            drivers: testDrivers,
            onSave,
            onCancel,
            onDirtyChange,
          }),
        );
      });

      const cancelBtn = container!.querySelector<HTMLButtonElement>(
        '.gt-correct__header .gt-correct__btn',
      );
      await act(async () => {
        cancelBtn!.click();
      });

      expect(window.confirm).not.toHaveBeenCalled();
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. App integration: navigation policy wiring for Correct Back', () => {
    beforeAll(async () => {
      const appModule = await getAppModule();
      App = appModule.App;
    }, 60_000);

    it(
      'prompts confirmation on popstate when Correct is dirty, and stays if cancelled',
      async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      await act(async () => {
        root!.render(createElement(App));
      });

      // Start screen -> Click anywhere to begin
      const startBtn = container!.querySelector<HTMLButtonElement>('.gt-start-surface');
      expect(startBtn).not.toBeNull();
      await act(async () => {
        startBtn!.click();
      });

      // Capture screen -> Open Sample scene
      const sampleBtn = container!.querySelector<HTMLButtonElement>('.mock-open-scene-btn');
      expect(sampleBtn).not.toBeNull();
      await act(async () => {
        sampleBtn!.click();
      });

      // Explore screen -> Click Correct button
      const correctBtn = container!.querySelector<HTMLButtonElement>('.gt-explore__correct');
      expect(correctBtn).not.toBeNull();
      await act(async () => {
        correctBtn!.click();
      });

      // In Correct screen
      expect(container!.querySelector('.gt-correct')).not.toBeNull();

      // Make it dirty by selecting a point and moving it
      const canvas = container!.querySelector('canvas');
      const pointBtn = container!.querySelector<HTMLButtonElement>(
        '.gt-correct__element-btn',
      );
      await act(async () => {
        pointBtn!.click();
      });
      await act(async () => {
        canvas!.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
        );
      });

      // Fire hardware popstate (Android Back)
      await act(async () => {
        window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
      });

      // Since confirm returned false, App must stay in Correct mode
      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(confirmSpy).toHaveBeenCalledWith(t('correct.confirmLeave'));
      expect(container!.querySelector('.gt-correct')).not.toBeNull();
      expect(container!.querySelector('.gt-explore')).toBeNull();

      // Now change confirm to true and fire popstate again
      confirmSpy.mockReturnValue(true);
      await act(async () => {
        window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
      });

      // Now App returns to Explore
      expect(confirmSpy).toHaveBeenCalledTimes(2);
      expect(container!.querySelector('.gt-explore')).not.toBeNull();
      expect(container!.querySelector('.gt-correct')).toBeNull();
    }, 60_000);

    it('navigates to Explore without confirm on popstate when Correct is clean', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm');

      await act(async () => {
        root!.render(createElement(App));
      });

      const startBtn = container!.querySelector<HTMLButtonElement>('.gt-start-surface');
      await act(async () => {
        startBtn!.click();
      });

      const sampleBtn = container!.querySelector<HTMLButtonElement>('.mock-open-scene-btn');
      await act(async () => {
        sampleBtn!.click();
      });

      const correctBtn = container!.querySelector<HTMLButtonElement>('.gt-explore__correct');
      await act(async () => {
        correctBtn!.click();
      });

      expect(container!.querySelector('.gt-correct')).not.toBeNull();

      // Clean exit via popstate
      await act(async () => {
        window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
      });

      expect(confirmSpy).not.toHaveBeenCalled();
      expect(container!.querySelector('.gt-explore')).not.toBeNull();
      expect(container!.querySelector('.gt-correct')).toBeNull();
    }, 60_000);
  });
});
