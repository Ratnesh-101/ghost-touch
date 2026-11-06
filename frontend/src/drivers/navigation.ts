/**
 * Browser navigation driver: manages history entries for the Android Back gesture
 * and TalkBack back navigation across primary and secondary screens.
 *
 * Browser APIs (history.pushState, history.replaceState, window.addEventListener('popstate'))
 * live here per tech.md (browser APIs only in drivers/).
 */

export interface NavigationDriver {
  pushExploreEntry(): void;
  leaveExploreEntry(): void;
  onBack(handler: () => void): () => void;
  pushSavedEntry(): void;
  leaveSavedEntry(): void;
  onSavedBack(handler: () => void): () => void;
  pushCorrectEntry(): void;
  leaveCorrectEntry(): void;
  onCorrectBack(handler: () => void): () => void;
  replaceSavedEntry(): void;
}

let explorePushed = false;
let savedPushed = false;
let correctPushed = false;

let suppressNextPop = false;
let suppressTimer: ReturnType<typeof setTimeout> | null = null;
/** If history.back() never yields a popstate, stop swallowing real Back presses. */
const SUPPRESS_POP_TIMEOUT_MS = 500;

function clearSuppression(): void {
  suppressNextPop = false;
  if (suppressTimer !== null) {
    clearTimeout(suppressTimer);
    suppressTimer = null;
  }
}

function armSuppression(): void {
  suppressNextPop = true;
  if (suppressTimer !== null) {
    clearTimeout(suppressTimer);
  }
  suppressTimer = setTimeout(clearSuppression, SUPPRESS_POP_TIMEOUT_MS);
}

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
      armSuppression();
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
      clearSuppression();
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
 * Pushes a history entry marked with `{ screen: 'saved' }`.
 * Guarded against double effect runs in React StrictMode.
 */
export function pushSavedEntry(): void {
  if (typeof window !== 'undefined' && window.history) {
    if (savedPushed || window.history.state?.screen === 'saved') {
      savedPushed = true;
      return;
    }
    window.history.pushState({ screen: 'saved' }, '', window.location.href);
    savedPushed = true;
  }
}

/**
 * Pops the saved history entry when leaving SavedDiagrams by an on-screen UI action.
 */
export function leaveSavedEntry(): void {
  if (typeof window !== 'undefined' && window.history) {
    if (savedPushed) {
      savedPushed = false;
      armSuppression();
      window.history.back();
    }
  }
}

/**
 * Listens for back navigation away from SavedDiagrams (system Back or TalkBack gesture).
 */
export function onSavedBack(handler: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  const listener = (event: PopStateEvent): void => {
    if (suppressNextPop) {
      clearSuppression();
      return;
    }
    if (event.state?.screen === 'saved') {
      return;
    }
    savedPushed = false;
    handler();
  };
  window.addEventListener('popstate', listener);
  return () => {
    window.removeEventListener('popstate', listener);
  };
}

/**
 * When opening a diagram directly from Saved, replace the `{ screen: 'saved' }` entry
 * with `{ screen: 'capture' }` so that Back from the newly opened Explore screen returns
 * directly to Capture.
 */
export function replaceSavedEntry(): void {
  if (typeof window !== 'undefined' && window.history) {
    savedPushed = false;
    window.history.replaceState({ screen: 'capture' }, '', window.location.href);
  }
}

/**
 * Pushes a history entry marked with `{ screen: 'correct' }`.
 * Guarded against double effect runs in React StrictMode.
 */
export function pushCorrectEntry(): void {
  if (typeof window !== 'undefined' && window.history) {
    if (correctPushed || window.history.state?.screen === 'correct') {
      correctPushed = true;
      return;
    }
    window.history.pushState({ screen: 'correct' }, '', window.location.href);
    correctPushed = true;
  }
}

/**
 * Pops the correct history entry when leaving Teacher Correction mode by a UI action
 * (Save or Cancel button).
 */
export function leaveCorrectEntry(): void {
  if (typeof window !== 'undefined' && window.history) {
    if (correctPushed) {
      correctPushed = false;
      armSuppression();
      window.history.back();
    }
  }
}

/**
 * Listens for back navigation away from Teacher Correct mode back to Explore
 * (system Back or TalkBack gesture).
 */
export function onCorrectBack(handler: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  const listener = (event: PopStateEvent): void => {
    if (suppressNextPop) {
      clearSuppression();
      return;
    }
    if (event.state?.screen === 'correct') {
      return;
    }
    correctPushed = false;
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
  savedPushed = false;
  correctPushed = false;
  clearSuppression();
}

export function createBrowserNavigation(): NavigationDriver {
  return {
    pushExploreEntry,
    leaveExploreEntry,
    onBack,
    pushSavedEntry,
    leaveSavedEntry,
    onSavedBack,
    pushCorrectEntry,
    leaveCorrectEntry,
    onCorrectBack,
    replaceSavedEntry,
  };
}
