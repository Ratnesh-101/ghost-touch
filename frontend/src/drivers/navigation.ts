/**
 * Browser navigation driver: manages history entries for the Android Back gesture
 * and TalkBack back navigation.
 *
 * Browser APIs (history.pushState, window.addEventListener('popstate')) live here
 * per tech.md (browser APIs only in drivers/).
 */

export interface NavigationDriver {
  pushExploreEntry(): void;
  leaveExploreEntry(): void;
  onBack(handler: () => void): () => void;
}

let explorePushed = false;
let suppressNextPop = false;

/**
 * Pushes a history entry marked with `{ screen: 'explore' }`.
 * Guarded against double effect runs in React StrictMode.
 */
export function pushExploreEntry(): void {
  if (typeof window !== 'undefined' && window.history) {
    if (explorePushed || window.history.state?.screen === 'explore') {
      explorePushed = true;
      return;
    }
    window.history.pushState({ screen: 'explore' }, '', window.location.href);
    explorePushed = true;
  }
}

/**
 * Pops the explore history entry when leaving Explore by a UI action
 * (on-screen Back button or two-finger swipe down).
 * Calls `history.back()` once, guarded so the resulting popstate is not
 * treated as a second exit.
 */
export function leaveExploreEntry(): void {
  if (typeof window !== 'undefined' && window.history) {
    if (explorePushed) {
      explorePushed = false;
      suppressNextPop = true;
      window.history.back();
    }
  }
}

/**
 * Listens for back navigation away from Explore.
 * Ignores suppressed pops (from leaveExploreEntry) and forward/hash popstates.
 */
export function onBack(handler: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  const listener = (event: PopStateEvent): void => {
    if (suppressNextPop) {
      suppressNextPop = false;
      return;
    }
    // Ignore forward navigation into Explore or internal state where screen is still explore
    if (event.state?.screen === 'explore') {
      return;
    }
    explorePushed = false;
    handler();
  };
  window.addEventListener('popstate', listener);
  return () => {
    window.removeEventListener('popstate', listener);
  };
}

/**
 * Reset module-internal state (useful for tests).
 */
export function _resetNavigationState(): void {
  explorePushed = false;
  suppressNextPop = false;
}

export function createBrowserNavigation(): NavigationDriver {
  return {
    pushExploreEntry,
    leaveExploreEntry,
    onBack,
  };
}
