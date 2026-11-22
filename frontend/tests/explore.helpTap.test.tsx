// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import triangleJson from '../public/samples/triangle.json';
import type { DiagramScene } from '../src/core/scene';
import { setLang } from '../src/i18n';
import { useTouchTap } from '../src/screens/Explore';
import { setupRigEnv, teardownRigEnv, withExplore, type Rig } from './support/exploreRig';

const triangle = triangleJson as unknown as DiagramScene;

function getButton(rig: Rig, selector: string): HTMLButtonElement {
  const b = rig.container.querySelector<HTMLButtonElement>(selector);
  if (!b) throw new Error(`Button (${selector}) not found`);
  return b;
}

function renderHook<T>(hookFn: () => T): { result: { current: T }; unmount: () => void } {
  const result = { current: undefined as unknown as T };
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  function HookTester() {
    result.current = hookFn();
    return null;
  }

  act(() => {
    root.render(<HookTester />);
  });

  return {
    result,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('Item 1 & Item 2: Help and Where am I touch tap & status card help expansion', () => {
  describe('useTouchTap hook unit tests', () => {
    beforeEach(() => {
      globalThis.IS_REACT_ACT_ENVIRONMENT = true;
      vi.useFakeTimers({
        toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'],
      });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('activates on pointerUp when pointerType === "touch" and pointer started on that button', () => {
      const onActivate = vi.fn();
      const { result } = renderHook(() => useTouchTap(onActivate));

      act(() => {
        result.current.onPointerDown({
          pointerType: 'touch',
          pointerId: 1,
        } as unknown as React.PointerEvent<HTMLButtonElement>);
      });
      expect(onActivate).not.toHaveBeenCalled();

      act(() => {
        result.current.onPointerUp({
          pointerType: 'touch',
          pointerId: 1,
        } as unknown as React.PointerEvent<HTMLButtonElement>);
      });
      expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it('suppresses the synthetic click that follows pointerUp within 500 ms (one utterance only, never two)', () => {
      const onActivate = vi.fn();
      const { result } = renderHook(() => useTouchTap(onActivate));

      act(() => {
        result.current.onPointerDown({
          pointerType: 'touch',
          pointerId: 1,
        } as unknown as React.PointerEvent<HTMLButtonElement>);
        result.current.onPointerUp({
          pointerType: 'touch',
          pointerId: 1,
        } as unknown as React.PointerEvent<HTMLButtonElement>);
      });
      expect(onActivate).toHaveBeenCalledTimes(1);

      // Trailing click fired 50ms later
      vi.advanceTimersByTime(50);
      act(() => {
        result.current.onClick({
          detail: 1,
        } as unknown as React.MouseEvent<HTMLButtonElement>);
      });
      // Click is suppressed: still 1 call
      expect(onActivate).toHaveBeenCalledTimes(1);

      // Subsequent click after 500ms guard expires is allowed
      vi.advanceTimersByTime(500);
      act(() => {
        result.current.onClick({
          detail: 1,
        } as unknown as React.MouseEvent<HTMLButtonElement>);
      });
      expect(onActivate).toHaveBeenCalledTimes(2);
    });

    it('keeps onClick for keyboard (detail 0) and TalkBack when no preceding touch tap occurred', () => {
      const onActivate = vi.fn();
      const { result } = renderHook(() => useTouchTap(onActivate));

      act(() => {
        result.current.onClick({
          detail: 0,
        } as unknown as React.MouseEvent<HTMLButtonElement>);
      });
      expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it('keeps onClick for mouse click when no preceding touch tap occurred', () => {
      const onActivate = vi.fn();
      const { result } = renderHook(() => useTouchTap(onActivate));

      act(() => {
        result.current.onClick({
          detail: 1,
        } as unknown as React.MouseEvent<HTMLButtonElement>);
      });
      expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it('does not activate on pointerUp if pointerType is not touch', () => {
      const onActivate = vi.fn();
      const { result } = renderHook(() => useTouchTap(onActivate));

      act(() => {
        result.current.onPointerDown({
          pointerType: 'mouse',
          pointerId: 1,
        } as unknown as React.PointerEvent<HTMLButtonElement>);
        result.current.onPointerUp({
          pointerType: 'mouse',
          pointerId: 1,
        } as unknown as React.PointerEvent<HTMLButtonElement>);
      });
      expect(onActivate).not.toHaveBeenCalled();

      // Normal mouse click follows and activates
      act(() => {
        result.current.onClick({
          detail: 1,
        } as unknown as React.MouseEvent<HTMLButtonElement>);
      });
      expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it('does not activate on pointerUp if pointer was cancelled', () => {
      const onActivate = vi.fn();
      const { result } = renderHook(() => useTouchTap(onActivate));

      act(() => {
        result.current.onPointerDown({
          pointerType: 'touch',
          pointerId: 1,
        } as unknown as React.PointerEvent<HTMLButtonElement>);
        result.current.onPointerCancel({
          pointerId: 1,
        } as unknown as React.PointerEvent<HTMLButtonElement>);
        result.current.onPointerUp({
          pointerType: 'touch',
          pointerId: 1,
        } as unknown as React.PointerEvent<HTMLButtonElement>);
      });
      expect(onActivate).not.toHaveBeenCalled();
    });

    it('does not activate on pointerUp if pointerId does not match starting pointerId', () => {
      const onActivate = vi.fn();
      const { result } = renderHook(() => useTouchTap(onActivate));

      act(() => {
        result.current.onPointerDown({
          pointerType: 'touch',
          pointerId: 1,
        } as unknown as React.PointerEvent<HTMLButtonElement>);
        result.current.onPointerUp({
          pointerType: 'touch',
          pointerId: 2,
        } as unknown as React.PointerEvent<HTMLButtonElement>);
      });
      expect(onActivate).not.toHaveBeenCalled();
    });
  });

  describe('Explore component integration: Help & Where am I buttons', () => {
    beforeEach(() => {
      setupRigEnv();
      setLang('en');
    });
    afterEach(() => {
      setLang('en');
      teardownRigEnv();
    });

    it('Help button activates on touch tap with one utterance only and no vibrate or tone', async () => {
      await withExplore({ scene: triangle }, (rig) => {
        const helpBtn = getButton(rig, '.gt-explore__help');
        rig.clearCalls();

        // Simulate touch tap: pointerdown, pointerup, click
        act(() => {
          const downEvent = new MouseEvent('pointerdown', { bubbles: true });
          Object.assign(downEvent, { pointerType: 'touch', pointerId: 2 });
          helpBtn.dispatchEvent(downEvent);

          const upEvent = new MouseEvent('pointerup', { bubbles: true });
          Object.assign(upEvent, { pointerType: 'touch', pointerId: 2 });
          helpBtn.dispatchEvent(upEvent);

          const clickEvent = new MouseEvent('click', { bubbles: true, detail: 1 });
          helpBtn.dispatchEvent(clickEvent);
        });

        // Exactly one utterance spoken, never two
        const spoken = rig.spoken();
        expect(spoken).toHaveLength(1);
        expect(spoken[0]).toContain('Drag one finger to feel the diagram');

        // No vibration and no tone
        expect(rig.vibrations()).toHaveLength(0);
        expect(rig.tones()).toHaveLength(0);

        // Status card receives modifier class and tabIndex="0"
        const card = rig.container.querySelector('.gt-explore__status-card');
        expect(card).not.toBeNull();
        expect(card?.classList.contains('gt-explore__status--help')).toBe(true);
        expect(card?.getAttribute('tabindex')).toBe('0');
      });
    });

    it('Help status card modifier clears when status text changes to something else', async () => {
      await withExplore({ scene: triangle }, (rig) => {
        const helpBtn = getButton(rig, '.gt-explore__help');
        rig.clearCalls();

        // Tap Help
        act(() => {
          const downEvent = new MouseEvent('pointerdown', { bubbles: true });
          Object.assign(downEvent, { pointerType: 'touch', pointerId: 2 });
          helpBtn.dispatchEvent(downEvent);

          const upEvent = new MouseEvent('pointerup', { bubbles: true });
          Object.assign(upEvent, { pointerType: 'touch', pointerId: 2 });
          helpBtn.dispatchEvent(upEvent);
        });

        const card = rig.container.querySelector('.gt-explore__status-card');
        expect(card?.classList.contains('gt-explore__status--help')).toBe(true);
        expect(card?.getAttribute('tabindex')).toBe('0');

        // Tap Where am I: status changes to where am I text
        const whereAmIBtn = getButton(rig, '.gt-explore__where-am-i');
        act(() => {
          whereAmIBtn.click();
        });

        // Modifier class is cleared and tabIndex is removed
        expect(card?.classList.contains('gt-explore__status--help')).toBe(false);
        expect(card?.getAttribute('tabindex')).toBeNull();
      });
    });

    it('Where am I button activates on touch tap with one utterance only and no vibrate or tone', async () => {
      await withExplore({ scene: triangle }, (rig) => {
        const whereAmIBtn = getButton(rig, '.gt-explore__where-am-i');
        rig.clearCalls();

        // Simulate touch tap: pointerdown, pointerup, click
        act(() => {
          const downEvent = new MouseEvent('pointerdown', { bubbles: true });
          Object.assign(downEvent, { pointerType: 'touch', pointerId: 2 });
          whereAmIBtn.dispatchEvent(downEvent);

          const upEvent = new MouseEvent('pointerup', { bubbles: true });
          Object.assign(upEvent, { pointerType: 'touch', pointerId: 2 });
          whereAmIBtn.dispatchEvent(upEvent);

          const clickEvent = new MouseEvent('click', { bubbles: true, detail: 1 });
          whereAmIBtn.dispatchEvent(clickEvent);
        });

        // Exactly one utterance spoken, never two
        const spoken = rig.spoken();
        expect(spoken).toHaveLength(1);

        // No vibration and no tone
        expect(rig.vibrations()).toHaveLength(0);
        expect(rig.tones()).toHaveLength(0);
      });
    });

    it('keyboard click (detail: 0) activates Help and Where am I', async () => {
      await withExplore({ scene: triangle }, (rig) => {
        const helpBtn = getButton(rig, '.gt-explore__help');
        rig.clearCalls();

        act(() => {
          const clickEvent = new MouseEvent('click', { bubbles: true, detail: 0 });
          helpBtn.dispatchEvent(clickEvent);
        });

        expect(rig.spoken()).toHaveLength(1);

        const whereAmIBtn = getButton(rig, '.gt-explore__where-am-i');
        act(() => {
          const clickEvent = new MouseEvent('click', { bubbles: true, detail: 0 });
          whereAmIBtn.dispatchEvent(clickEvent);
        });

        expect(rig.spoken()).toHaveLength(2);
      });
    });
  });
});
