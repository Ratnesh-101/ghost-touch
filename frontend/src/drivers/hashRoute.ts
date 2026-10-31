/**
 * Hash-route access for the hidden `#/debug` page.
 *
 * `window.location` is a browser API, so it lives here (not in App.tsx).
 * Shaped for React's `useSyncExternalStore(subscribeHash, readHash)`.
 * There is no router dependency (adding one needs the owner's approval).
 */

export const DEBUG_HASH = '#/debug';

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
