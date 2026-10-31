/**
 * Browser navigation driver: manages history entries for the Android Back gesture
 * and TalkBack back navigation.
 *
 * Browser APIs (history.pushState, window.addEventListener('popstate')) live here
 * per tech.md (browser APIs only in drivers/).
 */

export interface NavigationDriver {
  pushExploreEntry(): void;
  onBack(handler: () => void): () => void;
}

export function pushExploreEntry(): void {
  if (typeof window !== 'undefined' && window.history) {
    window.history.pushState({ screen: 'explore' }, '', window.location.href);
  }
}

export function onBack(handler: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  const listener = (): void => {
    handler();
  };
  window.addEventListener('popstate', listener);
  return () => {
    window.removeEventListener('popstate', listener);
  };
}

export function createBrowserNavigation(): NavigationDriver {
  return {
    pushExploreEntry,
    onBack,
  };
}
