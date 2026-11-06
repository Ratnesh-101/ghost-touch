import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _resetNavigationState,
  createBrowserNavigation,
  leaveCorrectEntry,
  leaveExploreEntry,
  leaveSavedEntry,
  onBack,
  onCorrectBack,
  onSavedBack,
  pushCorrectEntry,
  pushExploreEntry,
  pushSavedEntry,
  replaceSavedEntry,
} from '../src/drivers/navigation';

describe('navigation driver — secondary screens back navigation (Finding 3)', () => {
  let listeners: Record<string, ((e?: unknown) => void)[]> = {};
  let pushStateMock = vi.fn();
  let replaceStateMock = vi.fn();
  let backMock = vi.fn();
  let currentState: Record<string, unknown> | null = null;

  beforeEach(() => {
    _resetNavigationState();
    listeners = {};
    pushStateMock = vi.fn().mockImplementation((state: Record<string, unknown>) => {
      currentState = state;
    });
    replaceStateMock = vi.fn().mockImplementation((state: Record<string, unknown>) => {
      currentState = state;
    });
    backMock = vi.fn();
    currentState = null;

    (globalThis as unknown as Record<string, unknown>).window = {
      history: {
        get state() {
          return currentState;
        },
        pushState: pushStateMock,
        replaceState: replaceStateMock,
        back: backMock,
      },
      location: {
        href: 'http://localhost/',
      },
      addEventListener: (event: string, cb: (e?: unknown) => void) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(cb);
      },
      removeEventListener: (event: string, cb: (e?: unknown) => void) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((fn) => fn !== cb);
        }
      },
      dispatchEvent: (e: { type: string; state?: unknown }) => {
        listeners[e.type]?.forEach((cb) => cb(e));
        return true;
      },
    };
  });

  afterEach(() => {
    _resetNavigationState();
    delete (globalThis as unknown as Record<string, unknown>).window;
  });

  describe('SavedDiagrams screen history handling', () => {
    it('pushSavedEntry pushes a history state { screen: "saved" }', () => {
      pushSavedEntry();
      expect(pushStateMock).toHaveBeenCalledWith(
        { screen: 'saved' },
        '',
        'http://localhost/',
      );
    });

    it('pushSavedEntry guards against double effect runs in React StrictMode', () => {
      pushSavedEntry();
      expect(pushStateMock).toHaveBeenCalledTimes(1);

      pushSavedEntry();
      expect(pushStateMock).toHaveBeenCalledTimes(1);
    });

    it('leaveSavedEntry calls history.back() once and suppresses resulting popstate', () => {
      const handler = vi.fn();
      onSavedBack(handler);

      pushSavedEntry();
      expect(pushStateMock).toHaveBeenCalledTimes(1);

      leaveSavedEntry();
      expect(backMock).toHaveBeenCalledTimes(1);

      // Second leaveSavedEntry call should be a no-op
      leaveSavedEntry();
      expect(backMock).toHaveBeenCalledTimes(1);

      // Browser fires popstate resulting from history.back()
      const win = (globalThis as unknown as { window: { dispatchEvent: (e: { type: string; state?: unknown }) => boolean } }).window;
      win.dispatchEvent({ type: 'popstate', state: null });
      expect(handler).not.toHaveBeenCalled();
    });

    it('onSavedBack ignores forward navigation where state.screen is saved', () => {
      const handler = vi.fn();
      onSavedBack(handler);

      const win = (globalThis as unknown as { window: { dispatchEvent: (e: { type: string; state?: unknown }) => boolean } }).window;
      win.dispatchEvent({ type: 'popstate', state: { screen: 'saved' } });
      expect(handler).not.toHaveBeenCalled();
    });

    it('onSavedBack invokes handler on genuine Android system Back popstate', () => {
      const handler = vi.fn();
      const cleanup = onSavedBack(handler);

      pushSavedEntry();

      const win = (globalThis as unknown as { window: { dispatchEvent: (e: { type: string; state?: unknown }) => boolean } }).window;
      win.dispatchEvent({ type: 'popstate', state: null });
      expect(handler).toHaveBeenCalledTimes(1);

      cleanup();
      win.dispatchEvent({ type: 'popstate', state: null });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('replaceSavedEntry replaces history state so opening a diagram routes Back to Capture', () => {
      pushSavedEntry();
      replaceSavedEntry();
      expect(replaceStateMock).toHaveBeenCalledWith(
        { screen: 'capture' },
        '',
        'http://localhost/',
      );
    });
  });

  describe('Teacher Correct screen history handling', () => {
    it('pushCorrectEntry pushes a history state { screen: "correct" }', () => {
      pushCorrectEntry();
      expect(pushStateMock).toHaveBeenCalledWith(
        { screen: 'correct' },
        '',
        'http://localhost/',
      );
    });

    it('pushCorrectEntry guards against double effect runs in React StrictMode', () => {
      pushCorrectEntry();
      expect(pushStateMock).toHaveBeenCalledTimes(1);

      pushCorrectEntry();
      expect(pushStateMock).toHaveBeenCalledTimes(1);
    });

    it('leaveCorrectEntry calls history.back() once and suppresses resulting popstate', () => {
      const handler = vi.fn();
      onCorrectBack(handler);

      pushCorrectEntry();
      expect(pushStateMock).toHaveBeenCalledTimes(1);

      leaveCorrectEntry();
      expect(backMock).toHaveBeenCalledTimes(1);

      leaveCorrectEntry();
      expect(backMock).toHaveBeenCalledTimes(1);

      const win = (globalThis as unknown as { window: { dispatchEvent: (e: { type: string; state?: unknown }) => boolean } }).window;
      win.dispatchEvent({ type: 'popstate', state: { screen: 'explore' } });
      expect(handler).not.toHaveBeenCalled();
    });

    it('onCorrectBack ignores forward navigation where state.screen is correct', () => {
      const handler = vi.fn();
      onCorrectBack(handler);

      const win = (globalThis as unknown as { window: { dispatchEvent: (e: { type: string; state?: unknown }) => boolean } }).window;
      win.dispatchEvent({ type: 'popstate', state: { screen: 'correct' } });
      expect(handler).not.toHaveBeenCalled();
    });

    it('onCorrectBack invokes handler on genuine Android system Back popstate to Explore', () => {
      const handler = vi.fn();
      const cleanup = onCorrectBack(handler);

      pushCorrectEntry();

      const win = (globalThis as unknown as { window: { dispatchEvent: (e: { type: string; state?: unknown }) => boolean } }).window;
      win.dispatchEvent({ type: 'popstate', state: { screen: 'explore' } });
      expect(handler).toHaveBeenCalledTimes(1);

      cleanup();
      win.dispatchEvent({ type: 'popstate', state: { screen: 'explore' } });
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Explore screen history handling (Explore to Capture)', () => {
    it('pushExploreEntry pushes { screen: "explore" } and onBack invokes handler when popping back to Capture', () => {
      const handler = vi.fn();
      const cleanup = onBack(handler);

      pushExploreEntry();
      expect(pushStateMock).toHaveBeenCalledWith(
        { screen: 'explore' },
        '',
        'http://localhost/',
      );

      const win = (globalThis as unknown as { window: { dispatchEvent: (e: { type: string; state?: unknown }) => boolean } }).window;
      win.dispatchEvent({ type: 'popstate', state: null });
      expect(handler).toHaveBeenCalledTimes(1);

      cleanup();
    });

    it('leaveExploreEntry suppresses popstate and calls history.back()', () => {
      const handler = vi.fn();
      onBack(handler);

      pushExploreEntry();
      leaveExploreEntry();
      expect(backMock).toHaveBeenCalledTimes(1);

      const win = (globalThis as unknown as { window: { dispatchEvent: (e: { type: string; state?: unknown }) => boolean } }).window;
      win.dispatchEvent({ type: 'popstate', state: null });
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('createBrowserNavigation bundle', () => {
    it('includes all navigation methods for primary and secondary screens', () => {
      const nav = createBrowserNavigation();
      expect(typeof nav.pushExploreEntry).toBe('function');
      expect(typeof nav.leaveExploreEntry).toBe('function');
      expect(typeof nav.onBack).toBe('function');
      expect(typeof nav.pushSavedEntry).toBe('function');
      expect(typeof nav.leaveSavedEntry).toBe('function');
      expect(typeof nav.onSavedBack).toBe('function');
      expect(typeof nav.pushCorrectEntry).toBe('function');
      expect(typeof nav.leaveCorrectEntry).toBe('function');
      expect(typeof nav.onCorrectBack).toBe('function');
      expect(typeof nav.replaceSavedEntry).toBe('function');
    });
  });
});
