import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _resetNavigationState,
  createBrowserNavigation,
  leaveExploreEntry,
  onBack,
  pushExploreEntry,
} from '../src/drivers/navigation';

describe('navigation driver', () => {
  let listeners: Record<string, ((e?: unknown) => void)[]> = {};
  let pushStateMock = vi.fn();
  let backMock = vi.fn();
  let currentState: Record<string, unknown> | null = null;

  beforeEach(() => {
    _resetNavigationState();
    listeners = {};
    pushStateMock = vi.fn().mockImplementation((state: Record<string, unknown>) => {
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

  it('pushExploreEntry pushes a history state', () => {
    pushExploreEntry();
    expect(pushStateMock).toHaveBeenCalledWith(
      { screen: 'explore' },
      '',
      'http://localhost/',
    );
  });

  it('pushExploreEntry guards against double effect runs in React StrictMode', () => {
    pushExploreEntry();
    expect(pushStateMock).toHaveBeenCalledTimes(1);

    // Second call (e.g. StrictMode remount)
    pushExploreEntry();
    expect(pushStateMock).toHaveBeenCalledTimes(1);
  });

  it('leaveExploreEntry calls history.back() once and suppresses resulting popstate', () => {
    const handler = vi.fn();
    onBack(handler);

    pushExploreEntry();
    expect(pushStateMock).toHaveBeenCalledTimes(1);

    leaveExploreEntry();
    expect(backMock).toHaveBeenCalledTimes(1);

    // Second leaveExploreEntry call should be a no-op
    leaveExploreEntry();
    expect(backMock).toHaveBeenCalledTimes(1);

    // Browser fires popstate resulting from history.back()
    const win = (globalThis as unknown as { window: { dispatchEvent: (e: { type: string; state?: unknown }) => boolean } }).window;
    win.dispatchEvent({ type: 'popstate', state: null });
    expect(handler).not.toHaveBeenCalled();
  });

  it('onBack ignores forward navigation where state.screen is explore', () => {
    const handler = vi.fn();
    onBack(handler);

    const win = (globalThis as unknown as { window: { dispatchEvent: (e: { type: string; state?: unknown }) => boolean } }).window;
    win.dispatchEvent({ type: 'popstate', state: { screen: 'explore' } });
    expect(handler).not.toHaveBeenCalled();
  });

  it('onBack invokes handler on genuine back popstate', () => {
    const handler = vi.fn();
    const cleanup = onBack(handler);

    pushExploreEntry();

    const win = (globalThis as unknown as { window: { dispatchEvent: (e: { type: string; state?: unknown }) => boolean } }).window;
    win.dispatchEvent({ type: 'popstate', state: null });
    expect(handler).toHaveBeenCalledTimes(1);

    cleanup();
    win.dispatchEvent({ type: 'popstate', state: null });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('createBrowserNavigation bundles methods', () => {
    const nav = createBrowserNavigation();
    expect(typeof nav.pushExploreEntry).toBe('function');
    expect(typeof nav.leaveExploreEntry).toBe('function');
    expect(typeof nav.onBack).toBe('function');
  });
});
