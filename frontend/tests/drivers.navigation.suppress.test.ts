import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetNavigationState, leaveExploreEntry, onBack, pushExploreEntry } from '../src/drivers/navigation';

describe('navigation popstate suppression', () => {
  let popHandler: ((e: unknown) => void) | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    _resetNavigationState();
    popHandler = undefined;
    vi.stubGlobal('window', {
      history: { state: null, pushState: vi.fn(), back: vi.fn() },
      location: { href: 'http://x/' },
      addEventListener: (_: string, h: (e: unknown) => void) => {
        popHandler = h;
      },
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('swallows the popstate caused by leaveExploreEntry', () => {
    const handler = vi.fn();
    onBack(handler);
    pushExploreEntry();
    leaveExploreEntry();
    popHandler?.({ state: null });
    expect(handler).not.toHaveBeenCalled();
  });

  it('stops suppressing after the timeout when no popstate arrives', () => {
    const handler = vi.fn();
    onBack(handler);
    pushExploreEntry();
    leaveExploreEntry();
    vi.advanceTimersByTime(600);
    popHandler?.({ state: null });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
