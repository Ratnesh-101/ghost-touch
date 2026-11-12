// @vitest-environment jsdom
/**
 * Test suite for FLOW-05: Teach handleLoadScene confirmation when dirty.
 *
 * Verifies:
 * 1. executeTeachLoad pure helper prompts confirmation when isDirty is true.
 * 2. Declining confirmation aborts loading and speaks staying message.
 * 3. In Teach component, loading a scene when dirty prompts window.confirm.
 * 4. Declining keeps history.present unchanged; confirming replaces it.
 */

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import { executeTeachLoad, Teach } from '../src/screens/Teach';
import { MemoryDiagramStore, type Drivers } from '../src/drivers';
import { setLang, t } from '../src/i18n';

const initialScene: DiagramScene = {
  version: 1,
  kind: 'geometry',
  title: 'Teacher Diagram Initial',
  points: [
    { id: 'A', x: 0.2, y: 0.8, label: 'A' },
    { id: 'B', x: 0.8, y: 0.8, label: 'B' },
  ],
  segments: [],
};

const newLoadedScene: DiagramScene = {
  version: 1,
  kind: 'geometry',
  title: 'Replacement Diagram',
  points: [
    { id: 'P1', x: 0.5, y: 0.5, label: 'P1' },
    { id: 'P2', x: 0.9, y: 0.9, label: 'P2' },
  ],
  segments: [],
};

describe('FLOW-05: Teach loadScene confirmation when dirty', () => {
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
        state: 'running',
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
    vi.restoreAllMocks();
  });

  describe('executeTeachLoad helper', () => {
    it('prompts confirmation when dirty, declining aborts and speaks staying message', () => {
      const speak = vi.fn();
      const confirm = vi.fn(() => false);
      const sayAndStatus = vi.fn();
      const focusHeading = vi.fn();
      const onApply = vi.fn();

      const result = executeTeachLoad(true, {
        speak,
        confirm,
        sayAndStatus,
        focusHeading,
        onApply,
      });

      expect(result.loaded).toBe(false);
      expect(speak).toHaveBeenCalledWith(t('teach.confirmLeave'));
      expect(confirm).toHaveBeenCalledWith(t('teach.confirmLeave'));
      expect(sayAndStatus).toHaveBeenCalledWith(t('teach.stayingInEditor'));
      expect(focusHeading).toHaveBeenCalledTimes(1);
      expect(onApply).not.toHaveBeenCalled();
    });

    it('prompts confirmation when dirty, accepting proceeds to apply', () => {
      const speak = vi.fn();
      const confirm = vi.fn(() => true);
      const sayAndStatus = vi.fn();
      const focusHeading = vi.fn();
      const onApply = vi.fn();

      const result = executeTeachLoad(true, {
        speak,
        confirm,
        sayAndStatus,
        focusHeading,
        onApply,
      });

      expect(result.loaded).toBe(true);
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(onApply).toHaveBeenCalledTimes(1);
    });

    it('loads immediately without confirm when not dirty', () => {
      const speak = vi.fn();
      const confirm = vi.fn();
      const sayAndStatus = vi.fn();
      const focusHeading = vi.fn();
      const onApply = vi.fn();

      const result = executeTeachLoad(false, {
        speak,
        confirm,
        sayAndStatus,
        focusHeading,
        onApply,
      });

      expect(result.loaded).toBe(true);
      expect(confirm).not.toHaveBeenCalled();
      expect(onApply).toHaveBeenCalledTimes(1);
    });
  });

  describe('Teach component UI integration', () => {
    it('prompts confirmation on load when dirty; declining retains current edits', async () => {
      const onDirtyChange = vi.fn();

      await act(async () => {
        root!.render(
          createElement(Teach, {
            initialScene,
            currentExploreScene: newLoadedScene,
            drivers: testDrivers,
            onBack: vi.fn(),
            onDirtyChange,
          }),
        );
      });

      // Initially clean: undo is disabled
      const buttons = Array.from(container!.querySelectorAll('button'));
      const undoBtn = buttons.find((b) => b.textContent?.trim() === t('teach.undo'));
      expect(undoBtn?.disabled).toBe(true);

      // Select vertex A at screen coords (80, 320) on 400x400 canvas
      const canvas = container!.querySelector('canvas');
      expect(canvas).not.toBeNull();
      await act(async () => {
        canvas!.dispatchEvent(
          new PointerEvent('pointerdown', {
            clientX: 80,
            clientY: 320,
            bubbles: true,
            cancelable: true,
            pointerId: 1,
          }),
        );
      });

      // Find Delete button and click it to make editor dirty
      const deleteBtn = Array.from(container!.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === t('teach.delete'),
      );
      expect(deleteBtn?.disabled).toBe(false);
      await act(async () => {
        deleteBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });

      // Editor is now dirty: undo is enabled, onDirtyChange was called with true
      expect(undoBtn?.disabled).toBe(false);
      expect(onDirtyChange).toHaveBeenLastCalledWith(true);

      // Install confirm mock before clicking Load
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      // Open LoadModal
      const loadBtn = container!.querySelector<HTMLButtonElement>(
        '.gt-teach__header-actions .gt-btn',
      );
      expect(loadBtn).not.toBeNull();
      await act(async () => {
        loadBtn!.click();
      });

      // Click "Load current diagram" item
      const loadCurrentBtn = container!.querySelector<HTMLButtonElement>(
        '.gt-teach-modal__item-btn',
      );
      expect(loadCurrentBtn).not.toBeNull();

      await act(async () => {
        loadCurrentBtn!.click();
      });

      // Assert window.confirm was called
      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(confirmSpy).toHaveBeenCalledWith(t('teach.confirmLeave'));

      // Since confirm returned false, current edits are retained (undo still enabled, dirty true)
      expect(undoBtn?.disabled).toBe(false);
      expect(onDirtyChange).toHaveBeenLastCalledWith(true);

      // Now set confirm to true and click load again
      confirmSpy.mockReturnValue(true);
      await act(async () => {
        loadBtn!.click();
      });

      const loadCurrentBtn2 = container!.querySelector<HTMLButtonElement>(
        '.gt-teach-modal__item-btn',
      );
      await act(async () => {
        loadCurrentBtn2!.click();
      });

      // Confirmed load occurred: confirm was called twice in total
      expect(confirmSpy).toHaveBeenCalledTimes(2);

      // Scene is now updated to clean newLoadedScene: undo is disabled, dirty is false
      expect(undoBtn?.disabled).toBe(true);
      expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    });
  });
});
