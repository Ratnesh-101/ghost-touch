/**
 * Crash Guard driver — last line of defence for a blind user when the app crashes.
 *
 * Requirements:
 * - stopEverything() calls navigator.vibrate(0) and window.speechSynthesis.cancel() inside try/catch.
 * - announceCrash(text, lang) speaks once (ignores repeat calls within 5 s).
 * - installGlobalHandlers() adds window 'error' and 'unhandledrejection' listeners that call
 *   stopEverything() only for 'error' events; for rejections do nothing audible.
 * - Zero dependency on the app's Drivers object (which may be the thing that broke).
 * - reloadApp() reloads the window safely inside try/catch.
 */

let lastAnnounceTime = 0;
let globalHandlersInstalled = false;

/**
 * Immediately cancel all sensory feedback (haptics and speech synthesis).
 * Safe against missing APIs or runtime exceptions.
 */
export function stopEverything(): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(0);
    }
  } catch {
    // Ignore vibrate errors
  }

  try {
    if (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      window.speechSynthesis &&
      typeof window.speechSynthesis.cancel === 'function'
    ) {
      window.speechSynthesis.cancel();
    }
  } catch {
    // Ignore speech cancellation errors
  }
}

/**
 * Announce crash message via SpeechSynthesis.
 * Enforces a 5-second silence window so repeated crashes do not flood the user.
 */
export function announceCrash(text: string, lang?: string): void {
  const now = Date.now();
  if (now - lastAnnounceTime < 5000) {
    return;
  }
  lastAnnounceTime = now;

  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis) {
      const UtteranceConstructor =
        (window as unknown as { SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance })
          .SpeechSynthesisUtterance ??
        (typeof SpeechSynthesisUtterance !== 'undefined' ? SpeechSynthesisUtterance : null);

      if (UtteranceConstructor && typeof window.speechSynthesis.speak === 'function') {
        const utterance = new UtteranceConstructor(text);
        if (lang) {
          utterance.lang = lang;
        } else if (typeof document !== 'undefined' && document.documentElement?.lang) {
          utterance.lang = document.documentElement.lang;
        }
        window.speechSynthesis.speak(utterance);
      }
    }
  } catch {
    // Speech synthesis may fail or be unsupported; never throw
  }
}

/**
 * Register global error and unhandledrejection handlers on window.
 * Calls stopEverything() only for 'error' events; unhandled rejections remain silent.
 * Returns a cleanup function for testing or teardown.
 */
export function installGlobalHandlers(): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  if (globalHandlersInstalled) {
    return () => {};
  }
  globalHandlersInstalled = true;

  const onError = (): void => {
    stopEverything();
  };

  const onUnhandledRejection = (): void => {
    // For unhandled promise rejections, do nothing audible
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);

  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
    globalHandlersInstalled = false;
  };
}

/**
 * Reload the current page to restart the app.
 * Encapsulated in the driver layer so browser APIs are never called directly in UI components.
 */
export function reloadApp(): void {
  try {
    if (
      typeof window !== 'undefined' &&
      window.location &&
      typeof window.location.reload === 'function'
    ) {
      window.location.reload();
    }
  } catch {
    // Ignore reload errors
  }
}

/**
 * Reset internal crashGuard state (for testing).
 */
export function _resetCrashGuardStateForTests(): void {
  lastAnnounceTime = 0;
  globalHandlersInstalled = false;
}
