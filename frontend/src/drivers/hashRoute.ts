/**
 * Hash-route access for the hidden `#/debug` page and shared diagram links (`#s=`).
 *
 * `window.location` and `history` are browser APIs, so they live here (not in App.tsx).
 * Shaped for React's `useSyncExternalStore(subscribeHash, readHash)`.
 * There is no router dependency (adding one needs the owner's approval).
 */

export const DEBUG_HASH = '#/debug';
export const SHARE_HASH_PREFIX = '#s=';
export const TEACH_HASH = '#/teach';

/** Checks whether a hash string represents the teacher editor route (`#/teach`). */
export function isTeachHash(hash: string): boolean {
  if (typeof hash !== 'string') return false;
  const trimmed = hash.trim();
  return (
    trimmed === TEACH_HASH ||
    trimmed === `/${TEACH_HASH}` ||
    trimmed.startsWith(`${TEACH_HASH}?`) ||
    trimmed.startsWith(`${TEACH_HASH}/`)
  );
}

/** Current `location.hash`, or '' outside a browser. */
export function readHash(): string {
  return typeof window === 'undefined' ? '' : window.location.hash;
}

/** Subscribe to hash changes; returns the unsubscribe function. */
export function subscribeHash(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

/**
 * Parse a share hash string, extracting the payload component after `#s=`.
 * Accepts `#s=<payload>`, `/#s=<payload>`, or full URLs ending with `#s=<payload>`.
 * Returns the payload string (or '' if empty payload), or null if the hash is not a share route.
 */
export function parseShareHash(hash: string): string | null {
  if (typeof hash !== 'string') return null;
  const idx = hash.indexOf(SHARE_HASH_PREFIX);
  if (idx !== -1 && (idx === 0 || hash.charAt(idx - 1) === '/')) {
    const prefix = hash.slice(0, idx);
    if (idx === 0 || prefix.trim() === '' || prefix.endsWith('/')) {
      return hash.slice(idx + SHARE_HASH_PREFIX.length);
    }
  }
  return null;
}

/**
 * Clears the URL hash using `history.replaceState` and notifies hashchange listeners.
 */
export function clearHash(): void {
  if (typeof window === 'undefined') return;

  if (typeof history !== 'undefined' && typeof history.replaceState === 'function') {
    const loc = window.location;
    const path = (loc && loc.pathname ? loc.pathname : '') + (loc && loc.search ? loc.search : '');
    history.replaceState(null, '', path || '/');
    if (loc && typeof loc.hash === 'string') {
      loc.hash = '';
    }
  } else if (typeof window.location !== 'undefined' && typeof window.location.hash === 'string') {
    window.location.hash = '';
  }

  try {
    if (typeof HashChangeEvent !== 'undefined') {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } else if (typeof Event !== 'undefined') {
      window.dispatchEvent(new Event('hashchange'));
    } else {
      window.dispatchEvent({ type: 'hashchange' } as unknown as Event);
    }
  } catch {
    try {
      window.dispatchEvent({ type: 'hashchange' } as unknown as Event);
    } catch {
      // ignore
    }
  }
}

