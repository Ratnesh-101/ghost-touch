/**
 * Share Hash Route Tests
 *
 * Tests for SHARE_HASH_PREFIX, parseShareHash, and clearHash in drivers/hashRoute.ts.
 * Contract: docs/briefs/agy-t3-student-open.md
 */

import fc from 'fast-check';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearHash,
  DEBUG_HASH,
  parseShareHash,
  readHash,
  SHARE_HASH_PREFIX,
  subscribeHash,
} from '../src/drivers/hashRoute';

interface MockWindow {
  location: { hash: string; pathname: string; search: string };
  history: { replaceState: (state: unknown, title: string, url: string) => void };
  addEventListener: (event: string, handler: () => void) => void;
  removeEventListener: (event: string, handler: () => void) => void;
  dispatchEvent: (event: { type: string }) => boolean;
}

function createMockWindow(initialHash = ''): {
  mockWindow: MockWindow;
  listeners: Map<string, Set<() => void>>;
  replaceStateSpy: ReturnType<typeof vi.fn>;
} {
  const listeners = new Map<string, Set<() => void>>();
  const replaceStateSpy = vi.fn((_state: unknown, _title: string, _url: string) => {
    mockWindow.location.hash = '';
  });

  const mockWindow: MockWindow = {
    location: { hash: initialHash, pathname: '/', search: '' },
    history: { replaceState: replaceStateSpy },
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

  return { mockWindow, listeners, replaceStateSpy };
}

describe('hashRoute: SHARE_HASH_PREFIX and parseShareHash', () => {
  it('defines SHARE_HASH_PREFIX as "#s="', () => {
    expect(SHARE_HASH_PREFIX).toBe('#s=');
  });

  it('parses valid share hash string starting with #s=', () => {
    expect(parseShareHash('#s=abc123payload')).toBe('abc123payload');
  });

  it('parses valid share hash string starting with /#s=', () => {
    expect(parseShareHash('/#s=abc123payload')).toBe('abc123payload');
  });

  it('parses valid share hash string inside full URL', () => {
    expect(parseShareHash('https://ghosttouch.app/#s=myPayload')).toBe('myPayload');
  });

  it('returns empty string when hash is exactly #s=', () => {
    expect(parseShareHash('#s=')).toBe('');
    expect(parseShareHash('/#s=')).toBe('');
  });

  it('returns null for non-share hashes like #/debug or #settings', () => {
    expect(parseShareHash(DEBUG_HASH)).toBeNull();
    expect(parseShareHash('#/debug')).toBeNull();
    expect(parseShareHash('#settings')).toBeNull();
    expect(parseShareHash('#s')).toBeNull();
    expect(parseShareHash('')).toBeNull();
    expect(parseShareHash('#')).toBeNull();
  });

  it('returns null for non-string values safely', () => {
    // @ts-expect-error Testing invalid runtime input
    expect(parseShareHash(null)).toBeNull();
    // @ts-expect-error Testing invalid runtime input
    expect(parseShareHash(undefined)).toBeNull();
    // @ts-expect-error Testing invalid runtime input
    expect(parseShareHash(123)).toBeNull();
  });

  it('property-based: any arbitrary string prefixed with #s= extracts the exact original payload', () => {
    fc.assert(
      fc.property(fc.string(), (payload) => {
        const hash = `#s=${payload}`;
        const parsed = parseShareHash(hash);
        expect(parsed).toBe(payload);
      }),
      { numRuns: 200 },
    );
  });
});

describe('hashRoute: clearHash', () => {
  const origWindow = (globalThis as unknown as { window?: unknown }).window;
  const origHistory = (globalThis as unknown as { history?: unknown }).history;

  afterEach(() => {
    (globalThis as unknown as { window?: unknown }).window = origWindow;
    (globalThis as unknown as { history?: unknown }).history = origHistory;
  });

  it('clears hash with history.replaceState and notifies subscribers', () => {
    const { mockWindow, replaceStateSpy } = createMockWindow('#s=testPayload');
    (globalThis as unknown as { window: unknown }).window = mockWindow;
    (globalThis as unknown as { history: unknown }).history = mockWindow.history;

    const onHashChange = vi.fn();
    const unsub = subscribeHash(onHashChange);

    expect(readHash()).toBe('#s=testPayload');

    clearHash();

    expect(replaceStateSpy).toHaveBeenCalledTimes(1);
    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/');
    expect(mockWindow.location.hash).toBe('');
    expect(onHashChange).toHaveBeenCalledTimes(1);

    unsub();
  });

  it('handles safe no-op outside browser environment (SSR)', () => {
    delete (globalThis as unknown as { window?: unknown }).window;
    delete (globalThis as unknown as { history?: unknown }).history;

    expect(() => clearHash()).not.toThrow();
  });
});
