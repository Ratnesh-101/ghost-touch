/**
 * Hash Route Driver Tests
 *
 * Hash-route access for the hidden `#/debug` page and deep linking.
 * Architecture rule: browser APIs live only in frontend/src/drivers/.
 * Shaped for React's useSyncExternalStore(subscribeHash, readHash).
 *
 * Covers:
 * - DEBUG_HASH constant
 * - readHash: normal path, unsupported path (outside browser/SSR)
 * - subscribeHash: normal path (listener attachment, event dispatch)
 * - subscribeHash: cleanup path (unsubscribe removes listener, no lingering calls)
 * - subscribeHash: unsupported path (no window -> no-op cleanup)
 * - subscribeHash: multiple independent subscribers
 * - Property-based tests via fast-check:
 *   - Route parse/format round-trip recovery
 *   - SSR environment invariant (readHash always '' when window undefined)
 *   - Event dispatch count & unsubscribe cutoff property
 *   - DEBUG_HASH strict equality predicate property
 */

import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEBUG_HASH, readHash, subscribeHash } from '../src/drivers/hashRoute';

interface MockWindow {
  location: { hash: string };
  addEventListener: (event: string, handler: () => void) => void;
  removeEventListener: (event: string, handler: () => void) => void;
  dispatchEvent: (event: { type: string }) => boolean;
}

function createMockWindow(initialHash = ''): {
  mockWindow: MockWindow;
  listeners: Map<string, Set<() => void>>;
  dispatchHashChange: () => void;
} {
  const listeners = new Map<string, Set<() => void>>();
  const mockWindow: MockWindow = {
    location: { hash: initialHash },
    addEventListener: (event: string, handler: () => void) => {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(handler);
    },
    removeEventListener: (event: string, handler: () => void) => {
      const set = listeners.get(event);
      if (set) {
        set.delete(handler);
      }
    },
    dispatchEvent: (event: { type: string }) => {
      const set = listeners.get(event.type);
      if (set) {
        for (const cb of [...set]) {
          cb();
        }
      }
      return true;
    },
  };

  return {
    mockWindow,
    listeners,
    dispatchHashChange: () => mockWindow.dispatchEvent({ type: 'hashchange' }),
  };
}

describe('hashRoute: Constants & Normal Paths', () => {
  const origWindow = (globalThis as unknown as { window?: unknown }).window;

  afterEach(() => {
    (globalThis as unknown as { window?: unknown }).window = origWindow;
  });

  it('defines DEBUG_HASH as "#/debug"', () => {
    expect(DEBUG_HASH).toBe('#/debug');
  });

  it('reads current hash from window.location.hash (normal path)', () => {
    const { mockWindow } = createMockWindow('#/debug');
    (globalThis as unknown as { window: unknown }).window = mockWindow;

    expect(readHash()).toBe('#/debug');

    mockWindow.location.hash = '#/explore';
    expect(readHash()).toBe('#/explore');

    mockWindow.location.hash = '';
    expect(readHash()).toBe('');
  });

  it('subscribes to hashchange events and invokes callback when event fires (normal path)', () => {
    const { mockWindow, dispatchHashChange } = createMockWindow('#/');
    (globalThis as unknown as { window: unknown }).window = mockWindow;

    const onChange = vi.fn();
    const unsubscribe = subscribeHash(onChange);

    expect(onChange).not.toHaveBeenCalled();

    dispatchHashChange();
    expect(onChange).toHaveBeenCalledTimes(1);

    dispatchHashChange();
    expect(onChange).toHaveBeenCalledTimes(2);

    unsubscribe();
  });
});

describe('hashRoute: Cleanup & Multiple Subscribers', () => {
  const origWindow = (globalThis as unknown as { window?: unknown }).window;

  afterEach(() => {
    (globalThis as unknown as { window?: unknown }).window = origWindow;
  });

  it('unsubscribes listener so subsequent hashchange events are ignored (cleanup path)', () => {
    const { mockWindow, dispatchHashChange } = createMockWindow('#/');
    (globalThis as unknown as { window: unknown }).window = mockWindow;

    const onChange = vi.fn();
    const unsubscribe = subscribeHash(onChange);

    dispatchHashChange();
    expect(onChange).toHaveBeenCalledTimes(1);

    // Call unsubscribe cleanup
    unsubscribe();

    // Subsequent events must not trigger the callback
    dispatchHashChange();
    dispatchHashChange();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('supports multiple independent subscribers with selective cleanup', () => {
    const { mockWindow, dispatchHashChange } = createMockWindow('#/');
    (globalThis as unknown as { window: unknown }).window = mockWindow;

    const onChangeA = vi.fn();
    const onChangeB = vi.fn();

    const unsubA = subscribeHash(onChangeA);
    const unsubB = subscribeHash(onChangeB);

    dispatchHashChange();
    expect(onChangeA).toHaveBeenCalledTimes(1);
    expect(onChangeB).toHaveBeenCalledTimes(1);

    // Unsubscribe A only
    unsubA();

    dispatchHashChange();
    expect(onChangeA).toHaveBeenCalledTimes(1);
    expect(onChangeB).toHaveBeenCalledTimes(2);

    // Unsubscribe B
    unsubB();
    dispatchHashChange();
    expect(onChangeB).toHaveBeenCalledTimes(2);
  });

  it('is safe to call unsubscribe multiple times (idempotent cleanup)', () => {
    const { mockWindow } = createMockWindow('#/');
    (globalThis as unknown as { window: unknown }).window = mockWindow;

    const onChange = vi.fn();
    const unsubscribe = subscribeHash(onChange);

    expect(() => {
      unsubscribe();
      unsubscribe();
      unsubscribe();
    }).not.toThrow();
  });
});

describe('hashRoute: Unsupported Paths (Outside Browser / SSR)', () => {
  const origWindow = (globalThis as unknown as { window?: unknown }).window;

  beforeEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  afterEach(() => {
    (globalThis as unknown as { window?: unknown }).window = origWindow;
  });

  it('readHash returns empty string when window is undefined', () => {
    expect(typeof window).toBe('undefined');
    expect(readHash()).toBe('');
  });

  it('subscribeHash returns a no-op function that does not throw when window is undefined', () => {
    expect(typeof window).toBe('undefined');
    const onChange = vi.fn();
    const unsubscribe = subscribeHash(onChange);

    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('hashRoute: Property-Based Tests (fast-check)', () => {
  const origWindow = (globalThis as unknown as { window?: unknown }).window;

  afterEach(() => {
    (globalThis as unknown as { window?: unknown }).window = origWindow;
  });

  it('Property: route parse and format round trip for any valid path', () => {
    const routeArbitrary = fc
      .array(
        fc.stringMatching(/^[a-zA-Z0-9_-]+$/),
        { minLength: 1, maxLength: 5 },
      )
      .map((segments) => segments.join('/'));

    fc.assert(
      fc.property(routeArbitrary, (route) => {
        const { mockWindow } = createMockWindow();
        (globalThis as unknown as { window: unknown }).window = mockWindow;

        // Format as hash
        const formattedHash = `#/${route}`;
        mockWindow.location.hash = formattedHash;

        // Read and parse
        const read = readHash();
        const parsedRoute = read.replace(/^#\/?/, '');

        return read === formattedHash && parsedRoute === route;
      }),
      { numRuns: 100 },
    );
  });

  it('Property: readHash always returns empty string when window is undefined regardless of potential state', () => {
    fc.assert(
      fc.property(fc.string(), (_unused) => {
        delete (globalThis as unknown as { window?: unknown }).window;
        return readHash() === '';
      }),
      { numRuns: 50 },
    );
  });

  it('Property: subscription fires exactly N times before unsubscribe, and 0 additional times after', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 1, max: 10 }),
        (nPre, nPost) => {
          const { mockWindow, dispatchHashChange } = createMockWindow('#/');
          (globalThis as unknown as { window: unknown }).window = mockWindow;

          let callCount = 0;
          const unsubscribe = subscribeHash(() => {
            callCount++;
          });

          for (let i = 0; i < nPre; i++) {
            dispatchHashChange();
          }

          const countBeforeUnsub = callCount;
          unsubscribe();

          for (let i = 0; i < nPost; i++) {
            dispatchHashChange();
          }

          const countAfterUnsub = callCount;

          return countBeforeUnsub === nPre && countAfterUnsub === nPre;
        },
      ),
      { numRuns: 50 },
    );
  });

  it('Property: readHash() strictly equals DEBUG_HASH iff hash is exactly "#/debug"', () => {
    fc.assert(
      fc.property(fc.string(), (arbitraryHash) => {
        const { mockWindow } = createMockWindow(arbitraryHash);
        (globalThis as unknown as { window: unknown }).window = mockWindow;

        const isDebug = readHash() === DEBUG_HASH;
        const expected = arbitraryHash === '#/debug';

        return isDebug === expected;
      }),
      { numRuns: 100 },
    );
  });
});
