import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onBack, pushExploreEntry } from '../src/drivers/navigation';

describe('navigation driver', () => {
  let listeners: Record<string, ((e?: unknown) => void)[]> = {};
  let pushStateMock = vi.fn();

  beforeEach(() => {
    listeners = {};
    pushStateMock = vi.fn();
    (globalThis as unknown as Record<string, unknown>).window = {
      history: {
        pushState: pushStateMock,
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
      dispatchEvent: (e: { type: string }) => {
        listeners[e.type]?.forEach((cb) => cb(e));
        return true;
      },
    };
  });

  afterEach(() => {
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

  it('onBack attaches a popstate listener and invokes handler on popstate', () => {
    const handler = vi.fn();
    const cleanup = onBack(handler);

    const win = (globalThis as unknown as { window: { dispatchEvent: (e: { type: string }) => boolean } }).window;
    win.dispatchEvent({ type: 'popstate' });
    expect(handler).toHaveBeenCalledTimes(1);

    cleanup();
    win.dispatchEvent({ type: 'popstate' });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
