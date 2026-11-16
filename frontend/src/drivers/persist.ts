/**
 * Storage persistence driver (Task hx9).
 *
 * Requests persistent storage permission from the browser so saved diagrams
 * are not evicted under storage pressure on low-end phones.
 *
 * Per architecture rule (tech.md): browser APIs only in `drivers/`.
 * Per requirement: never throws, never speaks, called at most once per page load.
 */

let persistPromise: Promise<boolean> | null = null;

/**
 * Request persistent storage permission once per page load.
 * Resolves to a boolean (true if granted, false otherwise); never throws and never speaks.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (persistPromise !== null) {
    return persistPromise;
  }

  persistPromise = (async () => {
    try {
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.storage?.persist === 'function'
      ) {
        const granted = await navigator.storage.persist();
        return Boolean(granted);
      }
      return false;
    } catch {
      return false;
    }
  })();

  return persistPromise;
}

/**
 * Test-only helper to reset the once-per-page-load memoization.
 */
export function resetPersistentStorageForTest(): void {
  persistPromise = null;
}
